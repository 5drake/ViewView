import { app, BrowserWindow, ipcMain, shell, protocol, net, dialog, clipboard, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import zlib from 'zlib';
import { exec } from 'child_process';
import util from 'util';
import { pathToFileURL } from 'url';

const execPromise = util.promisify(exec);

// Consistent Windows app identity: userData folder name, notifications, and
// taskbar grouping. (In dev the running binary is still electron.exe, so Task
// Manager shows "Electron" — only a packaged ViewView.exe shows "ViewView".)
app.setName('ViewView');
app.setAppUserModelId('com.5drake.viewview');

// Supported image extensions
const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp', '.ico', '.avif'
]);

let mainWindow: BrowserWindow | null = null;

// Custom protocol for serving local media safely with correct MIME types
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: true,
    title: 'ViewView - High-Performance Image Explorer',
    backgroundColor: '#0c0d12',
    icon: path.join(__dirname, '../public/app-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: true,
    },
  });

  // Remove default menu for clean UI
  mainWindow.setMenuBarVisibility(false);

  // Drop the reference when the window is gone so watcher sends and dialogs
  // never touch a destroyed window.
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// Register media:// protocol
function registerMediaProtocol() {
  protocol.handle('media', async (request) => {
    try {
      const url = new URL(request.url);
      let targetPath = url.searchParams.get('path');
      
      if (!targetPath) {
        let rawPath = decodeURIComponent(url.pathname);
        if (rawPath.startsWith('/') && process.platform === 'win32') {
          rawPath = rawPath.slice(1);
        }
        if (url.host && /^[a-zA-Z]$/.test(url.host)) {
          targetPath = `${url.host.toUpperCase()}:/${rawPath.replace(/^\//, '')}`;
        } else if (url.host && url.host !== 'local-file' && url.host !== 'media') {
          targetPath = `${url.host}/${rawPath.replace(/^\//, '')}`;
        } else {
          targetPath = rawPath;
        }
      }

      if (!targetPath) {
        return new Response('File path not provided', { status: 404 });
      }

      // Restrict the media protocol to supported image extensions to avoid
      // turning the renderer into an arbitrary local-file read primitive.
      const ext = path.extname(targetPath).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(ext)) {
        return new Response('Forbidden file type', { status: 403 });
      }

      const fileUrl = pathToFileURL(targetPath).toString();
      const fileResponse = await net.fetch(fileUrl);
      // Re-wrap with long-lived cache headers: custom-protocol responses carry
      // no caching metadata by default, so every virtualization remount of an
      // <img> re-read the whole file. With these headers Chromium's image cache
      // can serve remounted thumbnails without touching the disk again.
      const headers = new Headers(fileResponse.headers);
      headers.set('Cache-Control', 'public, max-age=31536000');
      return new Response(fileResponse.body, {
        status: fileResponse.status,
        headers,
      });
    } catch (err: any) {
      console.error('Failed to load media via protocol:', err);
      return new Response('Failed to load media: ' + err.message, { status: 500 });
    }
  });
}

// Get Windows drives & common user folders
async function getSystemDrives() {
  const drives: Array<{ name: string; path: string; label?: string }> = [];

  if (process.platform === 'win32') {
    try {
      // PowerShell + JSON output is far more robust than the deprecated `wmic`.
      const { stdout } = await execPromise(
        'powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,VolumeName | ConvertTo-Json -Compress"'
      );
      const parsed = JSON.parse(stdout.trim());
      const list: Array<{ DeviceID?: string; VolumeName?: string }> = Array.isArray(parsed)
        ? parsed
        : parsed
          ? [parsed]
          : [];
      for (const d of list) {
        if (d && d.DeviceID) {
          drives.push({
            name: d.DeviceID,
            path: `${d.DeviceID}\\`,
            label: d.VolumeName || `로컬 디스크 (${d.DeviceID})`,
          });
        }
      }
    } catch (e) {
      console.error('Failed to enumerate drives via PowerShell:', e);
    }

    // Fallback: probe drive letters directly when PowerShell failed
    if (drives.length === 0) {
      for (let code = 65; code <= 90; code++) {
        const letter = String.fromCharCode(code);
        const drivePath = `${letter}:\\`;
        if (fs.existsSync(drivePath)) {
          drives.push({ name: `${letter}:`, path: drivePath, label: `로컬 디스크 (${letter}:)` });
        }
      }
    }
  } else {
    drives.push({ name: 'Root', path: '/' });
  }

  // Common user shortcut folders
  const homeDir = os.homedir();
  const shortcuts = [
    { name: '사진', path: path.join(homeDir, 'Pictures') },
    { name: '다운로드', path: path.join(homeDir, 'Downloads') },
    { name: '바탕화면', path: path.join(homeDir, 'Desktop') },
    { name: '문서', path: path.join(homeDir, 'Documents') },
    { name: '홈 디렉토리', path: homeDir },
  ].filter(item => fs.existsSync(item.path));

  return { drives, shortcuts };
}

// Fast lightweight image dimensions probe (PNG, JPEG, GIF, WebP, SVG, BMP)
// Non-blocking: reads a bounded header via async file handle so large directory
// scans never freeze the Electron main process event loop.
async function getImageDimensionsFast(filePath: string): Promise<{ width: number; height: number }> {
  let handle: fs.promises.FileHandle | null = null;
  try {
    // 64KB header is enough to skip large EXIF/IPTC segments and still reach SOF markers.
    const buffer = Buffer.alloc(64 * 1024);
    handle = await fs.promises.open(filePath, 'r');
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const data = bytesRead < buffer.length ? buffer.subarray(0, bytesRead) : buffer;

    // PNG: bytes 16-23 contain width & height (big-endian uint32)
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
      const width = data.readUInt32BE(16);
      const height = data.readUInt32BE(20);
      return { width, height };
    }

    // GIF: bytes 6-9 (little-endian uint16)
    if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
      const width = data.readUInt16LE(6);
      const height = data.readUInt16LE(8);
      return { width, height };
    }

    // BMP: bytes 18-25 (little-endian int32)
    if (data[0] === 0x42 && data[1] === 0x4D) {
      const width = Math.abs(data.readInt32LE(18));
      const height = Math.abs(data.readInt32LE(22));
      if (width > 0 && height > 0) return { width, height };
    }

    // WebP: RIFF ... WEBP VP8 / VP8L / VP8X
    if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') {
      const format = data.toString('ascii', 12, 16);
      if (format === 'VP8 ') {
        const width = (data.readUInt16LE(26) & 0x3fff);
        const height = (data.readUInt16LE(28) & 0x3fff);
        return { width, height };
      } else if (format === 'VP8L') {
        const b0 = data[21];
        const b1 = data[22];
        const b2 = data[23];
        const b3 = data[24];
        const width = 1 + (((b1 & 0x3f) << 8) | b0);
        const height = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
        return { width, height };
      } else if (format === 'VP8X') {
        const width = 1 + data.readUIntLE(24, 3);
        const height = 1 + data.readUIntLE(27, 3);
        return { width, height };
      }
    }

    // JPEG: Scan markers for SOF0 (0xFF, 0xC0), SOF2 (0xFF, 0xC2)
    if (data[0] === 0xFF && data[1] === 0xD8) {
      let offset = 2;
      while (offset < data.length - 8) {
        if (data[offset] !== 0xFF) {
          offset++;
          continue;
        }
        const marker = data[offset + 1];
        // Skip fill bytes (0xFF padding) and standalone restart markers
        if (marker === 0xFF) {
          offset++;
          continue;
        }
        if (marker === 0x00 || (marker >= 0xD0 && marker <= 0xD7)) {
          offset += 2;
          continue;
        }
        // SOF markers: 0xC0 to 0xCF except 0xC4, 0xC8, 0xCC
        if ((marker >= 0xC0 && marker <= 0xCF) && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
          const height = data.readUInt16BE(offset + 5);
          const width = data.readUInt16BE(offset + 7);
          if (width > 0 && height > 0) {
            return { width, height };
          }
        }
        // Segment length
        const length = data.readUInt16BE(offset + 2);
        if (length < 2) break; // guard against malformed segments
        offset += 2 + length;
      }
    }
  } catch {
    // Ignore probing errors and return default ratio
  } finally {
    if (handle) {
      try { await handle.close(); } catch {}
    }
  }
  return { width: 1920, height: 1080 }; // fallback standard 16:9
}

// Parse a single PNG text chunk (tEXt / iTXt / zTXt) into key/value.
function parsePngTextChunk(type: string, chunk: Buffer): { key: string; value: string } | null {
  try {
    if (type === 'tEXt') {
      let idx = 0;
      while (idx < chunk.length && chunk[idx] !== 0) idx++;
      return { key: chunk.toString('utf8', 0, idx), value: chunk.toString('utf8', idx + 1) };
    }
    if (type === 'zTXt') {
      let idx = 0;
      while (idx < chunk.length && chunk[idx] !== 0) idx++;
      // chunk[idx + 1] is the compression method (0 = zlib/deflate)
      const value = zlib.inflateSync(chunk.subarray(idx + 2)).toString('utf8');
      return { key: chunk.toString('utf8', 0, idx), value };
    }
    if (type === 'iTXt') {
      let idx = 0;
      while (idx < chunk.length && chunk[idx] !== 0) idx++;
      const key = chunk.toString('utf8', 0, idx);
      const compFlag = chunk[idx + 1];
      // iTXt: keyword\0 compFlag(1B) compMethod(1B) langTag\0 transKey\0 text
      let pos = idx + 3;
      while (pos < chunk.length && chunk[pos] !== 0) pos++;
      pos++;
      while (pos < chunk.length && chunk[pos] !== 0) pos++;
      pos++;
      if (pos >= chunk.length) return null;
      const value = compFlag
        ? zlib.inflateSync(chunk.subarray(pos)).toString('utf8')
        : chunk.toString('utf8', pos);
      return { key, value };
    }
  } catch {
    // ignore malformed chunks
  }
  return null;
}

// Streams through PNG chunks and extracts only text metadata (tEXt / iTXt / zTXt),
// which is where ComfyUI / NovelAI / A1111 embed prompts & workflow JSON.
// Avoids loading the whole image into memory (AI PNGs can be hundreds of MB).
async function readPngTextChunks(filePath: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  let handle: fs.promises.FileHandle | null = null;
  try {
    handle = await fs.promises.open(filePath, 'r');

    const sig = Buffer.alloc(8);
    const sigRead = await handle.read(sig, 0, 8, 0);
    if (sigRead.bytesRead < 8) return result;
    if (sig[0] !== 0x89 || sig[1] !== 0x50 || sig[2] !== 0x4E || sig[3] !== 0x47) return result;

    const stat = await handle.stat();
    const fileSize = stat.size;

    let offset = 8;
    while (true) {
      const header = Buffer.alloc(8);
      const h = await handle.read(header, 0, 8, offset);
      if (h.bytesRead < 8) break;

      const length = header.readUInt32BE(0);
      const type = header.toString('ascii', 4, 8);
      if (type === 'IEND') break;

      if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') {
        // Sanity cap (16MB) + file bounds so a corrupt length field can
        // neither OOM the process nor read past EOF.
        if (length > 0 && length <= 16 * 1024 * 1024 && offset + 12 + length <= fileSize) {
          const chunk = Buffer.alloc(length);
          await handle.read(chunk, 0, length, offset + 8);
          const parsed = parsePngTextChunk(type, chunk);
          if (parsed) result[parsed.key] = parsed.value;
        }
      }

      offset += 12 + length;
    }
  } catch {
    // ignore read errors
  } finally {
    if (handle) {
      try { await handle.close(); } catch {}
    }
  }
  return result;
}

// Scan directory for subfolders and image files
async function scanDirectory(dirPath: string) {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    
    const folders: Array<{ name: string; path: string; hasChildren: boolean }> = [];
    const images: Array<{
      id: string;
      name: string;
      path: string;
      dir: string;
      size: number;
      extension: string;
      createdAt: number;
      modifiedAt: number;
      width: number;
      height: number;
      aspectRatio: number;
      url: string;
    }> = [];

    const folderEntries = entries.filter(
      (entry) => entry.isDirectory() && !entry.name.startsWith('$') && entry.name !== 'System Volume Information'
    );
    const fileEntries = entries.filter(
      (entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    );

    for (const entry of folderEntries) {
      folders.push({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        hasChildren: true,
      });
    }

    // Bounded-concurrency stat + header probe. A sequential per-file await left
    // fast SSDs idle on large directories, while an unbounded Promise.all risks
    // exhausting file handles on huge folders — a small worker pool gets both
    // right and keeps the main process event loop responsive.
    const CONCURRENCY = 24;
    let cursor = 0;
    const worker = async () => {
      while (cursor < fileEntries.length) {
        const entry = fileEntries[cursor++];
        try {
          const fullPath = path.join(dirPath, entry.name);
          const stats = await fs.promises.stat(fullPath);
          const dims = await getImageDimensionsFast(fullPath);
          const aspectRatio = dims.width && dims.height ? +(dims.width / dims.height).toFixed(4) : 1.333;

          // media:// format with URL-encoded query parameter
          const safeMediaUrl = `media://local-file?path=${encodeURIComponent(fullPath)}`;

          images.push({
            id: fullPath,
            name: entry.name,
            path: fullPath,
            dir: dirPath,
            size: stats.size,
            extension: path.extname(entry.name).replace('.', '').toUpperCase(),
            createdAt: stats.birthtimeMs || stats.ctimeMs,
            modifiedAt: stats.mtimeMs,
            width: dims.width,
            height: dims.height,
            aspectRatio,
            url: safeMediaUrl,
          });
        } catch {
          // Skip permission denied / vanished files
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, fileEntries.length) }, () => worker())
    );

    // Sort folders alphabetically
    folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    return {
      currentPath: dirPath,
      folders,
      images,
      error: null,
    };
  } catch (err: any) {
    return {
      currentPath: dirPath,
      folders: [],
      images: [],
      error: err.message,
    };
  }
}

// Get metadata for specific image file paths (for bookmark gallery view)
async function getImagesMetadata(filePaths: string[]) {
  const images: any[] = [];
  await Promise.all(
    filePaths.map(async (fullPath) => {
      try {
        if (!fs.existsSync(fullPath)) return;
        const stats = await fs.promises.stat(fullPath);
        if (!stats.isFile()) return;
        const ext = path.extname(fullPath).toLowerCase();
        const fileName = path.basename(fullPath);
        const dims = await getImageDimensionsFast(fullPath);
        const aspectRatio = dims.width && dims.height ? +(dims.width / dims.height).toFixed(4) : 1.333;
        const safeMediaUrl = `media://local-file?path=${encodeURIComponent(fullPath)}`;

        images.push({
          id: fullPath,
          name: fileName,
          path: fullPath,
          dir: path.dirname(fullPath),
          size: stats.size,
          extension: ext.replace('.', '').toUpperCase(),
          createdAt: stats.birthtimeMs || stats.ctimeMs,
          modifiedAt: stats.mtimeMs,
          width: dims.width,
          height: dims.height,
          aspectRatio,
          url: safeMediaUrl,
          isBookmarked: true,
        });
      } catch {}
    })
  );
  return images;
}

// Single instance: launching ViewView again focuses the existing window
// instead of starting a second process fighting over the same watcher and
// settings files.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  registerMediaProtocol();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

let currentWatcher: fs.FSWatcher | null = null;
let watcherDebounceTimeout: NodeJS.Timeout | null = null;

function watchDirectory(dirPath: string) {
  if (currentWatcher) {
    try {
      currentWatcher.close();
    } catch {}
    currentWatcher = null;
  }
  if (watcherDebounceTimeout) {
    clearTimeout(watcherDebounceTimeout);
    watcherDebounceTimeout = null;
  }

  if (!fs.existsSync(dirPath)) return;

  try {
    currentWatcher = fs.watch(dirPath, { persistent: false }, (eventType, filename) => {
      if (filename) {
        const ext = path.extname(filename).toLowerCase();
        // Ignore temporary download files or office lock files
        if (ext.startsWith('.tmp') || ext.startsWith('.crdownload') || filename.startsWith('~$')) {
          return;
        }
      }

      if (watcherDebounceTimeout) {
        clearTimeout(watcherDebounceTimeout);
      }

      // Debounce rapid writes (e.g. AI batch generation / downloads) into a single clean refresh
      watcherDebounceTimeout = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('directory-changed', { dirPath });
        }
      }, 250);
    });

    currentWatcher.on('error', (err) => {
      console.error('Watcher error for', dirPath, err);
    });
  } catch (err) {
    console.error('Failed to watch directory:', dirPath, err);
  }
}

// IPC Handlers
ipcMain.handle('get-system-drives', async () => {
  return await getSystemDrives();
});

ipcMain.handle('scan-directory', async (_, dirPath: string, enableWatch: boolean = true) => {
  const result = await scanDirectory(dirPath);
  if (!result.error) {
    if (enableWatch) {
      watchDirectory(dirPath);
    } else if (currentWatcher) {
      try { currentWatcher.close(); } catch {}
      currentWatcher = null;
    }
  }
  return result;
});

ipcMain.handle('get-images-metadata', async (_, filePaths: string[]) => {
  return await getImagesMetadata(filePaths);
});

ipcMain.handle('read-image-metadata', async (_, filePath: string) => {
  try {
    const textChunks = await readPngTextChunks(filePath);
    return { textChunks };
  } catch (err: any) {
    return { textChunks: {} };
  }
});

ipcMain.handle('select-directory-dialog', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('trash-file', async (_, filePath: string) => {
  try {
    await shell.trashItem(filePath);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('show-in-folder', (_, filePath: string) => {
  shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle('open-with-default', (_, filePath: string) => {
  shell.openPath(filePath);
  return true;
});

ipcMain.handle('get-parent-path', (_, currentPath: string) => {
  return path.dirname(currentPath);
});

// Native file drag to external applications (Photoshop, Discord, Windows Explorer, etc.)
ipcMain.on('start-drag', (event, filePath: string) => {
  if (fs.existsSync(filePath)) {
    try {
      const icon = nativeImage.createFromPath(filePath).resize({ width: 64, height: 64 });
      event.sender.startDrag({
        file: filePath,
        icon: icon.isEmpty() ? path.join(__dirname, '../public/app-icon.png') : icon,
      });
    } catch {
      event.sender.startDrag({
        file: filePath,
        icon: path.join(__dirname, '../public/app-icon.png'),
      });
    }
  }
});

// Copy image to clipboard as bitmap image
ipcMain.handle('copy-image-to-clipboard', (_, filePath: string) => {
  try {
    const img = nativeImage.createFromPath(filePath);
    if (!img.isEmpty()) {
      clipboard.writeImage(img);
      return { success: true };
    }
    return { success: false, error: 'Could not load image as bitmap' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Copy text or path to clipboard
ipcMain.handle('copy-text-to-clipboard', (_, text: string) => {
  clipboard.writeText(text);
  return { success: true };
});

// Check if dropped path is folder or file and resolve target directory
ipcMain.handle('resolve-drop-path', async (_, droppedPath: string) => {
  try {
    if (fs.existsSync(droppedPath)) {
      const stat = fs.statSync(droppedPath);
      if (stat.isDirectory()) {
        return { isDirectory: true, targetDir: droppedPath, fileName: null };
      } else {
        return { isDirectory: false, targetDir: path.dirname(droppedPath), fileName: path.basename(droppedPath) };
      }
    }
  } catch (err) {
    console.error('Error resolving dropped path:', err);
  }
  return null;
});

// Open external URL in system browser
ipcMain.handle('open-external', async (_, url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      console.error('Blocked non-http(s) external URL:', url);
      return false;
    }
    await shell.openExternal(parsed.toString());
    return true;
  } catch (err) {
    console.error('Failed to open external url:', err);
    return false;
  }
});

// Copy files to target vault directory with non-destructive auto-deduplication
ipcMain.handle('copy-files-to-vault', async (_, { sourcePaths, targetDir }: { sourcePaths: string[]; targetDir: string }) => {
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    let copiedCount = 0;
    let skippedCount = 0;
    const targetResolved = path.resolve(targetDir).toLowerCase();
    for (const src of sourcePaths) {
      if (!fs.existsSync(src)) continue;

      // Skip files that already live inside the target vault to avoid
      // "send to vault" silently duplicating an image onto itself.
      if (path.dirname(path.resolve(src)).toLowerCase() === targetResolved) {
        skippedCount++;
        continue;
      }

      const baseName = path.basename(src);
      const ext = path.extname(baseName);
      const nameWithoutExt = path.basename(baseName, ext);

      let destPath = path.join(targetDir, baseName);
      let counter = 1;

      // Deduplicate filename if already exists in target directory
      while (fs.existsSync(destPath)) {
        destPath = path.join(targetDir, `${nameWithoutExt} (${counter})${ext}`);
        counter++;
      }

      // Async, non-blocking copy: fs.copyFileSync here stalled the main
      // process event loop (every IPC + all UI) for the duration of large
      // multi-hundred-MB AI image batches.
      await fs.promises.copyFile(src, destPath);
      copiedCount++;
    }

    return {
      success: true,
      copiedCount,
      skippedCount,
      targetDirName: path.basename(targetDir) || targetDir,
    };
  } catch (err: any) {
    console.error('Error copying files to vault:', err);
    return {
      success: false,
      copiedCount: 0,
      skippedCount: 0,
      targetDirName: path.basename(targetDir) || targetDir,
      error: err.message,
    };
  }
});
