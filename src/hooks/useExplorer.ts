import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ImageItem, FolderItem, DriveInfo, SortField, SortDirection, LayoutMode, FilterOptions, FolderBookmark, ToastType, SearchMode } from '../types';
import type { ConfirmFn } from '../components/Common/ConfirmDialog';
import { parseSearchTokens } from './usePromptIndex';

export function useExplorer(
  showToast?: (msg: string, type?: ToastType) => void,
  promptMatcher?: (image: ImageItem, query: string) => boolean,
  enableAutoRefresh: boolean = true,
  confirmAction?: ConfirmFn
) {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [shortcuts, setShortcuts] = useState<Array<{ name: string; path: string }>>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  
  // Navigation history kept in ONE atomic state so concurrent navigations can
  // never truncate the stack against a stale closure index (see navigateTo).
  const [history, setHistory] = useState<{ stack: string[]; index: number }>({ stack: [], index: -1 });
  const historyIndex = history.index;

  // Monotonic id guarding async scan results: only the newest navigation may
  // apply state; watch-triggered refreshes discard themselves when a newer
  // navigation superseded them or the directory already changed.
  const requestIdRef = useRef(0);
  const currentPathRef = useRef<string>('');

  // Folder bookmarks (stored in localStorage)
  const [folderBookmarks, setFolderBookmarks] = useState<FolderBookmark[]>(() => {
    try {
      const saved = localStorage.getItem('viewview-folder-bookmarks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Image bookmarks (Set of file paths stored in localStorage)
  const [imageBookmarks, setImageBookmarks] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('viewview-image-bookmarks');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Toggle folder bookmark
  const toggleFolderBookmark = useCallback((folderPath: string, name?: string) => {
    const normalized = folderPath.replace(/\\/g, '/').toLowerCase();
    const exists = folderBookmarks.some((b) => b.path.replace(/\\/g, '/').toLowerCase() === normalized);
    const segs = folderPath.replace(/\\/g, '/').split('/').filter(Boolean);
    const autoName = name || segs[segs.length - 1] || folderPath;

    // Compute the next value OUTSIDE the updater: localStorage writes inside a
    // state updater are impure (StrictMode double-invokes updaters).
    const updated: FolderBookmark[] = exists
      ? folderBookmarks.filter((b) => b.path.replace(/\\/g, '/').toLowerCase() !== normalized)
      : [...folderBookmarks, { path: folderPath, name: autoName, addedAt: Date.now() }];
    setFolderBookmarks(updated);
    try {
      localStorage.setItem('viewview-folder-bookmarks', JSON.stringify(updated));
    } catch {}

    if (exists) {
      showToast?.('폴더 북마크가 해제되었습니다.', 'info');
    } else {
      showToast?.(`'${autoName}' 폴더가 북마크에 등록되었습니다.`, 'bookmark');
    }
  }, [folderBookmarks, showToast]);

  // Toggle image bookmark
  const toggleImageBookmark = useCallback((filePath: string) => {
    const isCurrentlyBookmarked = imageBookmarks.has(filePath);
    const next = new Set(imageBookmarks);
    if (isCurrentlyBookmarked) {
      next.delete(filePath);
    } else {
      next.add(filePath);
    }
    setImageBookmarks(next);
    try {
      localStorage.setItem('viewview-image-bookmarks', JSON.stringify(Array.from(next)));
    } catch {}

    if (!isCurrentlyBookmarked) {
      showToast?.('이미지가 북마크에 추가되었습니다.', 'bookmark');
    } else {
      showToast?.('이미지 북마크가 해제되었습니다.', 'info');
    }
  }, [imageBookmarks, showToast]);

  const isImageBookmarked = useCallback((filePath: string) => {
    return imageBookmarks.has(filePath);
  }, [imageBookmarks]);

  const [layoutMode, setLayoutMode] = useState<LayoutMode>('justified');
  const [thumbnailSize, setThumbnailSize] = useState<number>(240); // 80px ~ 1200px
  const [gap, setGap] = useState<number>(8); // 0px ~ 24px

  const [sortField, setSortField] = useState<SortField>(() => {
    return (localStorage.getItem('viewview-sort-field') as SortField) || 'date';
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    return (localStorage.getItem('viewview-sort-dir') as SortDirection) || 'desc';
  });

  const handleSetSortField = useCallback((field: SortField) => {
    setSortField(field);
    try {
      localStorage.setItem('viewview-sort-field', field);
    } catch {}
  }, []);

  const handleSetSortDirection = useCallback((dir: SortDirection) => {
    setSortDirection(dir);
    try {
      localStorage.setItem('viewview-sort-dir', dir);
    } catch {}
  }, []);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchMode, setSearchMode] = useState<SearchMode>('all');
  const [filterExtension, setFilterExtension] = useState<string>('ALL');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize drives and default directory
  useEffect(() => {
    async function init() {
      if (window.electronAPI) {
        try {
          const sys = await window.electronAPI.getSystemDrives();
          setDrives(sys.drives);
          setShortcuts(sys.shortcuts);

          // Default path: Pictures shortcut or first drive
          const defaultPath = sys.shortcuts.find(s => s.name === '사진')?.path || sys.shortcuts[0]?.path || sys.drives[0]?.path || 'C:\\';
          navigateTo(defaultPath);
        } catch (err) {
          console.error('Failed to init drives:', err);
        }
      } else {
        // Fallback for browser preview mode with high-res sample images
        const sampleImages: ImageItem[] = [
          {
            id: 'demo-1',
            name: 'Aurora_Borealis_Norway.jpg',
            path: 'demo-1.jpg',
            dir: 'Demo',
            size: 4520100,
            extension: 'JPG',
            createdAt: Date.now() - 3600000 * 24,
            modifiedAt: Date.now() - 3600000 * 24,
            width: 3840,
            height: 2160,
            aspectRatio: 1.7778,
            url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1600&auto=format&fit=crop&q=80',
          },
          {
            id: 'demo-2',
            name: 'Cyberpunk_Tokyo_Rain.png',
            path: 'demo-2.png',
            dir: 'Demo',
            size: 8940120,
            extension: 'PNG',
            createdAt: Date.now() - 3600000 * 48,
            modifiedAt: Date.now() - 3600000 * 48,
            width: 2560,
            height: 3840,
            aspectRatio: 0.6667,
            url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1600&auto=format&fit=crop&q=80',
          },
          {
            id: 'demo-3',
            name: 'Fuji_Mountain_Sunrise.webp',
            path: 'demo-3.webp',
            dir: 'Demo',
            size: 3200100,
            extension: 'WEBP',
            createdAt: Date.now() - 3600000 * 12,
            modifiedAt: Date.now() - 3600000 * 12,
            width: 3840,
            height: 1600,
            aspectRatio: 2.4,
            url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1600&auto=format&fit=crop&q=80',
          },
          {
            id: 'demo-4',
            name: 'Swiss_Alps_Lake.jpg',
            path: 'demo-4.jpg',
            dir: 'Demo',
            size: 6100200,
            extension: 'JPG',
            createdAt: Date.now() - 3600000 * 5,
            modifiedAt: Date.now() - 3600000 * 5,
            width: 3000,
            height: 2000,
            aspectRatio: 1.5,
            url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=80',
          },
          {
            id: 'demo-5',
            name: 'Minimal_Abstract_Architecture.png',
            path: 'demo-5.png',
            dir: 'Demo',
            size: 2400100,
            extension: 'PNG',
            createdAt: Date.now() - 3600000 * 2,
            modifiedAt: Date.now() - 3600000 * 2,
            width: 2000,
            height: 3000,
            aspectRatio: 0.6667,
            url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1600&auto=format&fit=crop&q=80',
          },
          {
            id: 'demo-6',
            name: 'Cosmic_Galaxy_Nebula.jpg',
            path: 'demo-6.jpg',
            dir: 'Demo',
            size: 5200900,
            extension: 'JPG',
            createdAt: Date.now() - 3600000 * 1,
            modifiedAt: Date.now() - 3600000 * 1,
            width: 4000,
            height: 2500,
            aspectRatio: 1.6,
            url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&auto=format&fit=crop&q=80',
          },
        ];
        setCurrentPath('C:\\Sample Photos\\Wallpapers');
        setImages(sampleImages);
        setDrives([
          { name: 'C:', path: 'C:\\', label: '로컬 디스크 (C:)' },
          { name: 'D:', path: 'D:\\', label: '데이터 디스크 (D:)' },
        ]);
        setShortcuts([
          { name: '사진', path: 'C:\\Users\\User\\Pictures' },
          { name: '다운로드', path: 'C:\\Users\\User\\Downloads' },
          { name: '바탕화면', path: 'C:\\Users\\User\\Desktop' },
        ]);
      }
    }
    init();
  }, []);

  const navigateTo = useCallback(async (dirPath: string, pushHistory = true, selectTargetName?: string) => {
    if (!dirPath) return;
    const reqId = ++requestIdRef.current;
    // Record intent immediately so an in-flight refreshDirectory for another
    // directory discards itself instead of painting over this navigation.
    currentPathRef.current = dirPath;
    setIsLoading(true);
    setError(null);

    // Bookmarked Images View
    if (dirPath === 'bookmarks://images') {
      try {
        if (window.electronAPI?.getImagesMetadata) {
          const metaImages = await window.electronAPI.getImagesMetadata(Array.from(imageBookmarks));
          if (reqId !== requestIdRef.current) return; // superseded by a newer navigation
          setCurrentPath('bookmarks://images');
          setFolders([]);
          setImages(metaImages);
        } else {
          if (reqId !== requestIdRef.current) return;
          setCurrentPath('bookmarks://images');
          setFolders([]);
          setImages([]);
        }
        setSelectedImageId(null);
        setSelectedImageIds(new Set());
        if (pushHistory) {
          setHistory((h) => {
            const stack = h.stack.slice(0, h.index + 1);
            stack.push('bookmarks://images');
            return { stack, index: stack.length - 1 };
          });
        }
      } catch (err: any) {
        if (reqId === requestIdRef.current) setError(err.message);
      } finally {
        if (reqId === requestIdRef.current) setIsLoading(false);
      }
      return;
    }

    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.scanDirectory(dirPath, enableAutoRefresh);
        // A newer navigation superseded this one — drop the stale result so a
        // slow older scan can never paint its folder under the newer path.
        if (reqId !== requestIdRef.current) return;

        if (result.error) {
          setError(result.error);
          // Navigation failed — resync with the folder actually still displayed
          // so watcher refreshes for it keep applying.
          currentPathRef.current = currentPath;
        } else {
          setCurrentPath(result.currentPath);
          currentPathRef.current = result.currentPath;
          setFolders(result.folders);
          setImages(result.images);

          // If target filename specified (e.g. from file drop), select that image
          if (selectTargetName) {
            const targetImg = result.images.find(img => img.name.toLowerCase() === selectTargetName.toLowerCase());
            if (targetImg) {
              setSelectedImageId(targetImg.id);
              setSelectedImageIds(new Set([targetImg.id]));
            } else {
              setSelectedImageId(null);
              setSelectedImageIds(new Set());
            }
          } else {
            // Neutral state
            setSelectedImageId(null);
            setSelectedImageIds(new Set());
          }

          if (pushHistory) {
            setHistory((h) => {
              const stack = h.stack.slice(0, h.index + 1);
              stack.push(result.currentPath);
              return { stack, index: stack.length - 1 };
            });
          }
        }
      } catch (err: any) {
        currentPathRef.current = currentPath;
        if (reqId === requestIdRef.current) setError(err.message);
      } finally {
        if (reqId === requestIdRef.current) setIsLoading(false);
      }
    } else {
      setCurrentPath(dirPath);
      setIsLoading(false);
    }
  }, [currentPath, imageBookmarks, enableAutoRefresh]);

  // Keep bookmarks view in sync if imageBookmarks array changes
  useEffect(() => {
    if (currentPath === 'bookmarks://images') {
      if (window.electronAPI?.getImagesMetadata) {
        let stale = false;
        window.electronAPI.getImagesMetadata(Array.from(imageBookmarks))
          .then((metaImages) => {
            // Ignore late responses after the user navigated away.
            if (!stale && currentPathRef.current === 'bookmarks://images') {
              setImages(metaImages);
            }
          })
          .catch(() => {});
        return () => { stale = true; };
      }
    }
  }, [currentPath, imageBookmarks]);

  const clearSelection = useCallback(() => {
    setSelectedImageId(null);
    setSelectedImageIds(new Set());
  }, []);

  // Silent background refresh when files are added, modified, or deleted in the current directory
  const refreshDirectory = useCallback(async (dirPath?: string) => {
    const target = dirPath || currentPath;
    if (!target || !window.electronAPI) return;

    const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();
    // Do not bump the navigation counter — a refresh never supersedes a
    // navigation. Instead, discard the result if a newer navigation started or
    // the user already moved to a different directory while we were scanning.
    const myId = requestIdRef.current;
    try {
      const result = await window.electronAPI.scanDirectory(target, enableAutoRefresh);
      if (myId !== requestIdRef.current || norm(target) !== norm(currentPathRef.current)) return;
      if (!result.error) {
        setFolders(result.folders);
        setImages(result.images);

        // Keep current selected image if it still exists in the refreshed list
        setSelectedImageId((prev) => {
          if (prev && result.images.some((img: any) => img.id === prev)) {
            return prev;
          }
          return null;
        });

        setSelectedImageIds((prev) => {
          const next = new Set<string>();
          for (const id of prev) {
            if (result.images.some((img: any) => img.id === id)) {
              next.add(id);
            }
          }
          return next;
        });
      }
    } catch (err) {
      console.error('Silent refresh error:', err);
    }
  }, [currentPath, enableAutoRefresh]);
  // Subscribe to real-time directory changes from Electron file watcher
  useEffect(() => {
    if (!window.electronAPI?.onDirectoryChanged) return;

    const cleanup = window.electronAPI.onDirectoryChanged((data) => {
      if (
        data.dirPath && 
        currentPath && 
        data.dirPath.replace(/\\/g, '/').toLowerCase() === currentPath.replace(/\\/g, '/').toLowerCase()
      ) {
        refreshDirectory(data.dirPath);
      }
    });

    return () => {
      cleanup();
    };
  }, [currentPath, refreshDirectory]);

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      setHistory((h) => (h.index > 0 ? { ...h, index: h.index - 1 } : h));
      navigateTo(history.stack[historyIndex - 1], false);
    }
  }, [history, historyIndex, navigateTo]);

  const goForward = useCallback(() => {
    if (historyIndex < history.stack.length - 1) {
      setHistory((h) => (h.index < h.stack.length - 1 ? { ...h, index: h.index + 1 } : h));
      navigateTo(history.stack[historyIndex + 1], false);
    }
  }, [history, historyIndex, navigateTo]);

  const goUp = useCallback(async () => {
    if (window.electronAPI && currentPath) {
      const parent = await window.electronAPI.getParentPath(currentPath);
      if (parent && parent !== currentPath) {
        navigateTo(parent);
      }
    }
  }, [currentPath, navigateTo]);

  const openDirectoryDialog = useCallback(async () => {
    if (window.electronAPI) {
      const selected = await window.electronAPI.selectDirectoryDialog();
      if (selected) {
        navigateTo(selected);
      }
    }
  }, [navigateTo]);

  // Handle external folder / image drop from Windows Explorer
  const handleExternalDrop = useCallback(async (droppedPath: string) => {
    if (!window.electronAPI?.resolveDropPath) return;
    try {
      const res = await window.electronAPI.resolveDropPath(droppedPath);
      if (res && res.targetDir) {
        await navigateTo(res.targetDir, true, res.fileName || undefined);
      }
    } catch (err) {
      console.error('Error handling external drop:', err);
    }
  }, [navigateTo]);

  // Batch trash multiple files
  const trashFiles = useCallback(async (filePaths: string[], needConfirm: boolean = false) => {
    if (!window.electronAPI?.trashFile || filePaths.length === 0) return;
    const count = filePaths.length;

    if (needConfirm) {
      const confirmMsg = count === 1 
        ? `선택한 파일을 휴지통으로 이동하시겠습니까?` 
        : `선택한 ${count}개 파일을 모두 휴지통으로 이동하시겠습니까?`;

      if (confirmAction) {
        const ok = await confirmAction({
          title: '휴지통으로 이동',
          message: confirmMsg,
          confirmLabel: '휴지통으로 이동',
          cancelLabel: '취소',
          danger: true,
        });
        if (!ok) return;
      } else if (!confirm(confirmMsg)) {
        return;
      }
    }

    const results = await Promise.all(filePaths.map((p) => window.electronAPI?.trashFile(p)));
    const failed = results.filter((r) => !r || !r.success).length;
    const moved = count - failed;

    if (currentPath && moved > 0) {
      await navigateTo(currentPath, false);
    }
    clearSelection();

    // Report partial failures instead of claiming blanket success.
    if (failed === 0) {
      showToast?.(`${count}개 파일이 휴지통으로 이동되었습니다.`, 'trash');
    } else if (moved === 0) {
      showToast?.('파일을 휴지통으로 이동하지 못했습니다.', 'error');
    } else {
      showToast?.(`${moved}개 이동됨, ${failed}개 실패`, 'warning');
    }
  }, [currentPath, navigateTo, clearSelection, showToast, confirmAction]);

  // Filtered and Sorted Images
  const processedImages = useMemo(() => {
    let list = images.map((img) => ({
      ...img,
      isBookmarked: imageBookmarks.has(img.path),
    }));

    // Favorites / Bookmark filter
    if (filterExtension === 'FAVORITES') {
      list = list.filter((img) => img.isBookmarked);
    } else if (filterExtension !== 'ALL') {
      list = list.filter((img) => img.extension === filterExtension);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const tokens = parseSearchTokens(searchQuery);
      if (tokens.length > 0) {
        if (searchMode === 'name') {
          list = list.filter((img) => {
            const nameLower = img.name.toLowerCase();
            return tokens.every((token) => nameLower.includes(token));
          });
        } else if (searchMode === 'prompt') {
          list = list.filter((img) => (promptMatcher ? promptMatcher(img, searchQuery) : false));
        } else if (searchMode === 'all') {
          list = list.filter((img) => {
            const nameLower = img.name.toLowerCase();
            const matchName = tokens.every((token) => nameLower.includes(token));
            const matchPrompt = promptMatcher ? promptMatcher(img, searchQuery) : false;
            return matchName || matchPrompt;
          });
        }
      }
    }

    // Sorting
    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name, undefined, { numeric: true });
      } else if (sortField === 'date') {
        comparison = a.modifiedAt - b.modifiedAt;
      } else if (sortField === 'size') {
        comparison = a.size - b.size;
      } else if (sortField === 'width') {
        comparison = a.width - b.width;
      } else if (sortField === 'height') {
        comparison = a.height - b.height;
      } else if (sortField === 'type') {
        comparison = a.extension.localeCompare(b.extension);
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [images, imageBookmarks, filterExtension, searchQuery, searchMode, promptMatcher, sortField, sortDirection]);

  // Check if current path is in folder bookmarks
  const isCurrentFolderBookmarked = useMemo(() => {
    if (!currentPath) return false;
    const normalized = currentPath.replace(/\\/g, '/').toLowerCase();
    return folderBookmarks.some((b) => b.path.replace(/\\/g, '/').toLowerCase() === normalized);
  }, [currentPath, folderBookmarks]);

  // Currently selected image item (null if nothing is selected)
  const selectedImage = useMemo(() => {
    if (!selectedImageId) return null;
    return processedImages.find((img) => img.id === selectedImageId) || null;
  }, [processedImages, selectedImageId]);

  return {
    currentPath,
    folders,
    images: processedImages,
    rawImages: images,
    totalRawCount: images.length,
    drives,
    shortcuts,
    folderBookmarks,
    toggleFolderBookmark,
    isCurrentFolderBookmarked,
    imageBookmarks,
    toggleImageBookmark,
    isImageBookmarked,
    selectedImage,
    selectedImageId,
    selectedImageIds,
    setSelectedImageId,
    setSelectedImageIds,
    clearSelection,
    navigateTo,
    goBack,
    goForward,
    goUp,
    canGoBack: historyIndex > 0,
    canGoForward: historyIndex < history.stack.length - 1,
    openDirectoryDialog,
    handleExternalDrop,
    trashFiles,
    refreshDirectory,
    layoutMode,
    setLayoutMode,
    thumbnailSize,
    setThumbnailSize,
    gap,
    setGap,
    sortField,
    setSortField: handleSetSortField,
    sortDirection,
    setSortDirection: handleSetSortDirection,
    searchQuery,
    setSearchQuery,
    searchMode,
    setSearchMode,
    filterExtension,
    setFilterExtension,
    isLoading,
    error,
  };
}
