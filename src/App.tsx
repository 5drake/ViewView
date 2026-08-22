import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useExplorer } from './hooks/useExplorer';
import { useQuickLook } from './hooks/useQuickLook';
import { useSettings, DEFAULT_KEYBINDINGS } from './hooks/useSettings';
import { useVaults } from './hooks/useVaults';
import { useToast } from './hooks/useToast';
import { usePromptIndex } from './hooks/usePromptIndex';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { JustifiedGallery } from './components/Gallery/JustifiedGallery';
import { InspectorPanel } from './components/Inspector/InspectorPanel';
import { QuickLookModal } from './components/QuickLook/QuickLookModal';
import { SettingsModal } from './components/Settings/SettingsModal';
import { StatusBar } from './components/StatusBar';
import { Toast } from './components/Common/Toast';
import { ConfirmDialog, useConfirm } from './components/Common/ConfirmDialog';
import { ThemeMode, AppSettings, ImageItem } from './types';
import { matchesActionBinding, matchesVaultBinding } from './utils/keyboard';
import { FolderDown } from 'lucide-react';

export function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('viewview-theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  const [showSidebar, setShowSidebar] = useState<boolean>(() => {
    const saved = localStorage.getItem('viewview-show-sidebar');
    return saved !== 'false';
  });

  const [showInspector, setShowInspector] = useState<boolean>(() => {
    const saved = localStorage.getItem('viewview-show-inspector');
    return saved !== 'false';
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const { settings, updateSettings, resetSettings } = useSettings();
  const { toasts, showToast, dismissToast } = useToast();
  const { confirm, confirmState, resolveConfirm } = useConfirm();
  const {
    vaults,
    addVault,
    removeVault,
    updateVault,
    sendToVault,
  } = useVaults(showToast);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('viewview-theme', theme);
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setShowSidebar((prev) => {
      const next = !prev;
      localStorage.setItem('viewview-show-sidebar', String(next));
      return next;
    });
  }, []);

  const handleToggleInspector = useCallback(() => {
    setShowInspector((prev) => {
      const next = !prev;
      localStorage.setItem('viewview-show-inspector', String(next));
      return next;
    });
  }, []);

  const [promptMatcher, setPromptMatcher] = useState<((image: ImageItem, query: string) => boolean) | undefined>(undefined);

  const {
    currentPath,
    folders,
    images,
    rawImages,
    totalRawCount,
    drives,
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
    canGoBack,
    canGoForward,
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
    sortDirection,
    setSortField,
    setSortDirection,
    searchQuery,
    setSearchQuery,
    searchMode,
    setSearchMode,
    error: explorerError,
  } = useExplorer(showToast, promptMatcher, settings.enableAutoRefresh, confirm);

  // Surface scan/navigation failures instead of leaving the previous grid
  // silently frozen. Dismissable per message; a new failure re-shows it.
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const activeExplorerError = explorerError && explorerError !== dismissedError ? explorerError : null;

  const promptIndex = usePromptIndex(rawImages);

  useEffect(() => {
    setPromptMatcher(() => promptIndex.matchesPromptQuery);
  }, [promptIndex.matchesPromptQuery]);

  const handleUpdateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    updateSettings(newSettings);
    if (newSettings.defaultLayout) setLayoutMode(newSettings.defaultLayout);
    if (newSettings.defaultThumbnailSize) setThumbnailSize(newSettings.defaultThumbnailSize);
    if (newSettings.defaultGap !== undefined) setGap(newSettings.defaultGap);
    if (newSettings.defaultSortField) setSortField(newSettings.defaultSortField);
    if (newSettings.defaultSortDirection) setSortDirection(newSettings.defaultSortDirection);
  }, [updateSettings, setLayoutMode, setThumbnailSize, setGap, setSortField, setSortDirection]);

  const handleClearAllBookmarks = useCallback(() => {
    localStorage.removeItem('viewview-folder-bookmarks');
    localStorage.removeItem('viewview-image-bookmarks');
    window.location.reload();
  }, []);

  const handleAddVaultFromSidebar = useCallback(async () => {
    if (window.electronAPI?.selectDirectoryDialog) {
      const selected = await window.electronAPI.selectDirectoryDialog();
      if (selected) {
        await addVault(selected);
      }
    }
  }, [addVault]);

  const handleQuickLookIndexChange = useCallback((_index: number, img: ImageItem | null) => {
    if (img) {
      setSelectedImageId(img.id);
      setSelectedImageIds(new Set([img.id]));
    }
  }, [setSelectedImageId, setSelectedImageIds]);

  const quickLook = useQuickLook(images, handleQuickLookIndexChange);

  const handleTrashFiles = useCallback((paths: string[]) => {
    trashFiles(paths, settings.confirmDelete);
  }, [trashFiles, settings.confirmDelete]);

  // Mouse Back/Forward auxiliary buttons (Buttons 3 & 4) & Universal Customizable Keybindings
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        goBack();
      } else if (e.button === 4) {
        e.preventDefault();
        goForward();
      }
    };

    const keybindings = settings.keybindings || DEFAULT_KEYBINDINGS;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      // If QuickLook modal is open, let QuickLookModal handle its keys
      if (quickLook.isOpen || isSettingsOpen) {
        return;
      }

      // Core Actions matching custom keybindings (1st & 2nd keys)
      if (matchesActionBinding(e, keybindings.toggleSidebar)) {
        e.preventDefault();
        handleToggleSidebar();
        return;
      }
      if (matchesActionBinding(e, keybindings.toggleInspector)) {
        e.preventDefault();
        handleToggleInspector();
        return;
      }
      if (matchesActionBinding(e, keybindings.openSettings)) {
        e.preventDefault();
        setIsSettingsOpen(true);
        return;
      }
      if (matchesActionBinding(e, keybindings.navigateBack)) {
        e.preventDefault();
        if (canGoBack) goBack();
        else goUp();
        return;
      }
      if (matchesActionBinding(e, keybindings.navigateForward)) {
        e.preventDefault();
        goForward();
        return;
      }
      if (matchesActionBinding(e, keybindings.navigateUp)) {
        e.preventDefault();
        goUp();
        return;
      }
      if (matchesActionBinding(e, keybindings.quickLook)) {
        e.preventDefault();
        const selectedIdx = images.findIndex((img) => img.id === selectedImageId);
        if (selectedIdx >= 0) {
          quickLook.openQuickLook(selectedIdx);
        }
        return;
      }
      if (matchesActionBinding(e, keybindings.openDefault)) {
        if (selectedImage) {
          e.preventDefault();
          if (window.electronAPI?.openWithDefault) {
            window.electronAPI.openWithDefault(selectedImage.path);
          } else {
            window.open(selectedImage.url, '_blank');
          }
        }
        return;
      }
      if (matchesActionBinding(e, keybindings.deleteSelection)) {
        if (selectedImageIds.size > 0) {
          e.preventDefault();
          const targetPaths = images
            .filter((img) => selectedImageIds.has(img.id))
            .map((img) => img.path);
          if (targetPaths.length > 0) {
            handleTrashFiles(targetPaths);
          }
        } else if (selectedImage) {
          e.preventDefault();
          handleTrashFiles([selectedImage.path]);
        }
        return;
      }
      if (matchesActionBinding(e, keybindings.toggleBookmark)) {
        if (selectedImageIds.size > 0) {
          e.preventDefault();
          const targetImages = images.filter((img) => selectedImageIds.has(img.id));
          for (const img of targetImages) {
            toggleImageBookmark(img.path);
          }
        } else if (selectedImage) {
          e.preventDefault();
          toggleImageBookmark(selectedImage.path);
        }
        return;
      }

      // Arrow-key selection navigation (single select). Skipped when any
      // modifier is held so Alt+Arrow back/forward/up bindings still win.
      if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          const currIdx = images.findIndex((img) => img.id === selectedImageId);
          if (currIdx >= 0 && currIdx < images.length - 1) {
            e.preventDefault();
            const next = images[currIdx + 1];
            setSelectedImageId(next.id);
            setSelectedImageIds(new Set([next.id]));
            return;
          }
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          const currIdx = images.findIndex((img) => img.id === selectedImageId);
          if (currIdx > 0) {
            e.preventDefault();
            const prev = images[currIdx - 1];
            setSelectedImageId(prev.id);
            setSelectedImageIds(new Set([prev.id]));
            return;
          }
        }
      }

      const targetPaths = selectedImageIds.size > 0
        ? images.filter((img) => selectedImageIds.has(img.id)).map((img) => img.path)
        : selectedImage ? [selectedImage.path] : [];

      // Copy selected image to clipboard (customizable; default Ctrl+C)
      if (matchesActionBinding(e, keybindings.copyImage)) {
        if (targetPaths.length > 0) {
          e.preventDefault();
          if (window.electronAPI?.copyImageToClipboard) {
            window.electronAPI.copyImageToClipboard(targetPaths[0]);
          }
          showToast(targetPaths.length > 1 ? `${targetPaths.length}개 이미지 중 첫 번째 이미지가 클립보드에 복사되었습니다.` : '이미지가 클립보드에 복사되었습니다.', 'copy');
          return;
        }
      }

      // Copy file path(s) as text
      if (matchesActionBinding(e, keybindings.copyPath)) {
        if (targetPaths.length > 0) {
          e.preventDefault();
          const text = targetPaths.join('\n');
          if (window.electronAPI?.copyTextToClipboard) {
            window.electronAPI.copyTextToClipboard(text);
          } else {
            navigator.clipboard.writeText(text);
          }
          showToast(targetPaths.length > 1 ? `${targetPaths.length}개 경로가 복사되었습니다.` : '파일 경로가 복사되었습니다.', 'copy');
          return;
        }
      }

      // Show selected image in Windows Explorer
      if (matchesActionBinding(e, keybindings.showInExplorer)) {
        if (selectedImage && window.electronAPI?.showInFolder) {
          e.preventDefault();
          window.electronAPI.showInFolder(selectedImage.path);
          return;
        }
      }

      // Select all images in the current view
      if (matchesActionBinding(e, keybindings.selectAll)) {
        if (images.length > 0) {
          e.preventDefault();
          setSelectedImageIds(new Set(images.map((img) => img.id)));
          return;
        }
      }

      // Refresh current directory
      if (matchesActionBinding(e, keybindings.refresh)) {
        e.preventDefault();
        refreshDirectory();
        return;
      }

      // Check Storage Vault shortcut keys (1st & 2nd keys)
      if (targetPaths.length > 0) {
        for (const vault of vaults) {
          if (matchesVaultBinding(e, vault)) {
            e.preventDefault();
            sendToVault(vault.id, targetPaths);
            return;
          }
        }
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    goBack,
    goForward,
    goUp,
    canGoBack,
    canGoForward,
    handleToggleSidebar,
    handleToggleInspector,
    settings.keybindings,
    quickLook,
    isSettingsOpen,
    images,
    selectedImageId,
    selectedImage,
    selectedImageIds,
    trashFiles,
    refreshDirectory,
    showToast,
    vaults,
    sendToVault
  ]);

  // Window-level Drag & Drop folder/file navigation with robust dragCounter
  const [isWindowDragOver, setIsWindowDragOver] = useState<boolean>(false);
  const dragCounter = useRef<number>(0);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
        dragCounter.current += 1;
        if (dragCounter.current === 1) {
          setIsWindowDragOver(true);
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      // Mirror dragenter's Files gate: non-file drags previously drove the
      // counter negative and could stick the overlay open.
      if (!e.dataTransfer || !e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsWindowDragOver(false);
      }
    };

    // A drag cancelled outside the window (alt-tab, drop on the taskbar) never
    // delivers matching leave events — clear the overlay defensively.
    const handleDragCancelled = () => {
      dragCounter.current = 0;
      setIsWindowDragOver(false);
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsWindowDragOver(false);

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        // Resolve every dropped item, not just the first: Explorer multi-drops
        // silently discarded everything after file[0] before.
        const paths: string[] = [];
        for (const file of Array.from(e.dataTransfer.files)) {
          let filePath = '';
          if (window.electronAPI?.getPathForFile) {
            filePath = window.electronAPI.getPathForFile(file);
          }
          if (!filePath && (file as any).path) {
            filePath = (file as any).path;
          }
          if (filePath) {
            paths.push(filePath);
          }
        }

        if (paths.length > 0) {
          handleExternalDrop(paths[0]);
          if (paths.length > 1) {
            showToast?.(`첫 항목의 폴더로 이동했습니다 (드롭 ${paths.length}개 중 1번째)`, 'info');
          }
        }
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('blur', handleDragCancelled);
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('blur', handleDragCancelled);
    };
  }, [handleExternalDrop, showToast]);

  // Handle single and multi selection
  const handleSelectImage = useCallback((id: string, isMulti: boolean) => {
    if (isMulti) {
      const isCurrentlySelected = selectedImageIds.has(id);
      setSelectedImageIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      if (isCurrentlySelected) {
        // Toggled OFF — it must not stay the inspector's current image while
        // the selection count drops (previously showed an image with 0 selected).
        setSelectedImageId((cur) => (cur === id ? null : cur));
      } else {
        setSelectedImageId(id);
      }
    } else {
      setSelectedImageId(id);
      setSelectedImageIds(new Set([id]));
    }
  }, [selectedImageIds, setSelectedImageId, setSelectedImageIds]);

  const handleSortChange = (field: any, dir: any) => {
    setSortField(field);
    setSortDirection(dir);
  };

  return (
    <div className="app-container">
      {/* Top Header & Toolbar Controls */}
      <Header
        currentPath={currentPath}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onGoBack={goBack}
        onGoForward={goForward}
        onGoUp={goUp}
        onOpenFolderDialog={openDirectoryDialog}
        onNavigateTo={navigateTo}
        isFolderBookmarked={isCurrentFolderBookmarked}
        onToggleFolderBookmark={() => toggleFolderBookmark(currentPath)}
        showSidebar={showSidebar}
        onToggleSidebar={handleToggleSidebar}
        showInspector={showInspector}
        onToggleInspector={handleToggleInspector}
        onOpenSettings={() => setIsSettingsOpen(true)}
        layoutMode={layoutMode}
        onLayoutModeChange={setLayoutMode}
        thumbnailSize={thumbnailSize}
        onThumbnailSizeChange={setThumbnailSize}
        gap={gap}
        onGapChange={setGap}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchMode={searchMode}
        onSearchModeChange={setSearchMode}
        isIndexing={promptIndex.isIndexing}
        indexedCount={promptIndex.indexedCount}
        totalImageCount={promptIndex.totalCount}
      />

      {/* Main Workspace (Sidebar + Gallery + Inspector) */}
      <main className="app-main">
        {activeExplorerError && (
          <div className="explorer-error-banner" role="alert">
            <span className="explorer-error-message">⚠ {activeExplorerError}</span>
            <button
              className="nav-btn"
              style={{ padding: '4px 12px', fontSize: '12px', flexShrink: 0 }}
              onClick={() => setDismissedError(activeExplorerError)}
            >
              닫기
            </button>
          </div>
        )}
        {/* Left Drive / Folder / Vaults Sidebar */}
        <Sidebar
          drives={drives}
          folderBookmarks={folderBookmarks}
          imageBookmarksCount={imageBookmarks.size}
          vaults={vaults}
          currentPath={currentPath}
          folders={folders}
          onNavigateTo={navigateTo}
          onRemoveFolderBookmark={toggleFolderBookmark}
          onAddVault={handleAddVaultFromSidebar}
          onRemoveVault={removeVault}
          collapsed={!showSidebar}
        />

        {/* Center Zero-Crop Justified / Masonry / Grid Gallery */}
        <JustifiedGallery
          images={images}
          layoutMode={layoutMode}
          thumbnailSize={thumbnailSize}
          gap={gap}
          selectedId={selectedImageId}
          selectedIds={selectedImageIds}
          folders={folders}
          showFolders={settings.showFoldersInGallery}
          isBookmarksView={currentPath === 'bookmarks://images'}
          showFilenameOnCards={settings.showFilenameOnCards}
          doubleClickAction={settings.doubleClickAction}
          vaults={vaults}
          onSelectImage={handleSelectImage}
          onSelectMultipleImages={setSelectedImageIds}
          onClearSelection={clearSelection}
          onOpenQuickLook={quickLook.openQuickLook}
          onThumbnailSizeChange={setThumbnailSize}
          onToggleBookmark={toggleImageBookmark}
          onTrashBatch={handleTrashFiles}
          onSendToVault={sendToVault}
          onNavigateToFolder={navigateTo}
          onShowToast={showToast}
          wheelThrottle={settings.explorerWheelThrottle}
          placeholderStyle={settings.thumbnailPlaceholder}
          thumbConcurrency={settings.thumbConcurrentLoads}
          thumbCacheMb={settings.thumbCacheMaxMb}
          thumbWarmLimit={settings.thumbWarmLimit}
          keybindings={settings.keybindings}
          defaultZoom={settings.defaultThumbnailSize}
          onLayoutModeChange={setLayoutMode}
        />

        {/* Right EXIF & Histogram Inspector Panel */}
        <InspectorPanel
          image={selectedImage}
          isBookmarked={selectedImage ? isImageBookmarked(selectedImage.path) : false}
          onToggleBookmark={toggleImageBookmark}
          onShowToast={showToast}
          confirm={confirm}
          onOpenViewer={() => {
            if (selectedImage) {
              const idx = images.findIndex(img => img.id === selectedImage.id);
              if (idx >= 0) quickLook.openQuickLook(idx);
            }
          }}
          collapsed={!showInspector}
        />
      </main>

      {/* Bottom Status Bar */}
      <StatusBar
        totalCount={totalRawCount}
        filteredCount={images.length}
        selectedImage={selectedImage}
        selectedCount={selectedImageIds.size}
        layoutMode={layoutMode}
        thumbnailSize={thumbnailSize}
        gap={gap}
      />

      {/* Immersive Spacebar QuickLook Modal */}
      <QuickLookModal
        isOpen={quickLook.isOpen}
        image={quickLook.currentImage || selectedImage}
        currentIndex={quickLook.currentIndex}
        totalCount={images.length}
        vaults={vaults}
        isBookmarked={(quickLook.currentImage || selectedImage) ? isImageBookmarked((quickLook.currentImage || selectedImage)!.path) : false}
        onClose={quickLook.closeQuickLook}
        onNext={quickLook.nextImage}
        onPrev={quickLook.prevImage}
        onSendToVault={sendToVault}
        onToggleBookmark={toggleImageBookmark}
        onTrashBatch={handleTrashFiles}
        keybindings={settings.keybindings}
        onShowToast={showToast}
        wheelThrottle={settings.quickLookWheelThrottle}
      />

      {/* Global Settings & Options Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        vaults={vaults}
        onUpdateSettings={handleUpdateSettings}
        onResetSettings={resetSettings}
        onAddVault={addVault}
        onRemoveVault={removeVault}
        onUpdateVault={updateVault}
        onClose={() => setIsSettingsOpen(false)}
        bookmarkCounts={{
          folders: folderBookmarks.length,
          images: imageBookmarks.size,
        }}
        onClearAllBookmarks={handleClearAllBookmarks}
        onShowToast={showToast}
        confirm={confirm}
      />

      {/* Floating Action Toast Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Themed async confirmation dialog (replaces native confirm()) */}
      <ConfirmDialog options={confirmState} onResolve={resolveConfirm} />

      {/* Full Window External Drag & Drop Overlay */}
      {isWindowDragOver && (
        <div className="external-drop-overlay" style={{ position: 'fixed', inset: '16px', zIndex: 9999 }}>
          <FolderDown size={56} color="var(--accent)" />
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            폴더 또는 이미지를 드롭하여 바로 열기
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
