import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { ImageItem } from '../src/types';

export interface ElectronAPI {
  getSystemDrives: () => Promise<{
    drives: Array<{ name: string; path: string; label?: string }>;
    shortcuts: Array<{ name: string; path: string }>;
  }>;
  scanDirectory: (dirPath: string, enableWatch?: boolean) => Promise<{
    currentPath: string;
    folders: Array<{ name: string; path: string; hasChildren: boolean }>;
    images: ImageItem[];
    error: string | null;
  }>;
  selectDirectoryDialog: () => Promise<string | null>;
  trashFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  showInFolder: (filePath: string) => Promise<boolean>;
  openWithDefault: (filePath: string) => Promise<boolean>;
  getParentPath: (currentPath: string) => Promise<string>;
  startDrag: (filePath: string) => void;
  copyImageToClipboard: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  copyTextToClipboard: (text: string) => Promise<{ success: boolean }>;
  resolveDropPath: (droppedPath: string) => Promise<{ isDirectory: boolean; targetDir: string; fileName: string | null } | null>;
  openExternal: (url: string) => Promise<boolean>;
  copyFilesToVault: (params: { sourcePaths: string[]; targetDir: string }) => Promise<{ success: boolean; copiedCount: number; skippedCount: number; targetDirName: string; error?: string }>;
  getPathForFile: (file: File) => string;
  getImagesMetadata: (filePaths: string[]) => Promise<ImageItem[]>;
  readImageMetadata: (filePath: string) => Promise<{ textChunks: Record<string, string> }>;
  onDirectoryChanged: (callback: (data: { dirPath: string }) => void) => () => void;
}

const api: ElectronAPI = {
  getSystemDrives: () => ipcRenderer.invoke('get-system-drives'),
  scanDirectory: (dirPath: string, enableWatch?: boolean) => ipcRenderer.invoke('scan-directory', dirPath, enableWatch),
  getImagesMetadata: (filePaths: string[]) => ipcRenderer.invoke('get-images-metadata', filePaths),
  readImageMetadata: (filePath: string) => ipcRenderer.invoke('read-image-metadata', filePath),
  selectDirectoryDialog: () => ipcRenderer.invoke('select-directory-dialog'),
  trashFile: (filePath: string) => ipcRenderer.invoke('trash-file', filePath),
  showInFolder: (filePath: string) => ipcRenderer.invoke('show-in-folder', filePath),
  openWithDefault: (filePath: string) => ipcRenderer.invoke('open-with-default', filePath),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  copyFilesToVault: (params) => ipcRenderer.invoke('copy-files-to-vault', params),
  getParentPath: (currentPath: string) => ipcRenderer.invoke('get-parent-path', currentPath),
  startDrag: (filePath: string) => ipcRenderer.send('start-drag', filePath),
  copyImageToClipboard: (filePath: string) => ipcRenderer.invoke('copy-image-to-clipboard', filePath),
  copyTextToClipboard: (text: string) => ipcRenderer.invoke('copy-text-to-clipboard', text),
  resolveDropPath: (droppedPath: string) => ipcRenderer.invoke('resolve-drop-path', droppedPath),
  getPathForFile: (file: File) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file);
      }
    } catch (e) {
      console.error('webUtils.getPathForFile error:', e);
    }
    return (file as any).path || '';
  },
  onDirectoryChanged: (callback: (data: { dirPath: string }) => void) => {
    const handler = (_: any, data: { dirPath: string }) => callback(data);
    ipcRenderer.on('directory-changed', handler);
    return () => {
      ipcRenderer.removeListener('directory-changed', handler);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
