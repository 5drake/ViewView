import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ImageItem, LayoutMode, StorageVault, FolderItem, ToastType } from '../../types';
import { computeJustifiedLayout } from '../../utils/justifiedLayout';
import { computeMasonryLayout, computeSquareGridLayout } from '../../utils/masonryLayout';
import { Image as ImageIcon, Star, Folder, Check } from 'lucide-react';
import { ContextMenu } from '../ContextMenu/ContextMenu';

interface GalleryProps {
  images: ImageItem[];
  layoutMode: LayoutMode;
  thumbnailSize: number;
  gap: number;
  selectedId: string | null;
  selectedIds: Set<string>;
  folders?: FolderItem[];
  showFolders?: boolean;
  isBookmarksView?: boolean;
  showFilenameOnCards?: 'hover' | 'always' | 'never';
  doubleClickAction?: 'quicklook' | 'defaultViewer';
  vaults?: StorageVault[];
  onSelectImage: (id: string, isMulti: boolean) => void;
  onSelectMultipleImages?: (ids: Set<string>) => void;
  onClearSelection: () => void;
  onOpenQuickLook: (index: number) => void;
  onThumbnailSizeChange: (size: number) => void;
  onToggleBookmark?: (filePath: string) => void;
  onTrashBatch: (paths: string[]) => void;
  onSendToVault?: (vaultId: string, filePaths: string[]) => void;
  onNavigateToFolder?: (path: string) => void;
  onShowToast?: (message: string, type?: ToastType) => void;
  wheelThrottle?: boolean;
}

export const JustifiedGallery: React.FC<GalleryProps> = ({
  images,
  layoutMode,
  thumbnailSize,
  gap,
  selectedId,
  selectedIds,
  folders = [],
  showFolders = true,
  isBookmarksView = false,
  showFilenameOnCards = 'hover',
  doubleClickAction = 'quicklook',
  vaults = [],
  onSelectImage,
  onSelectMultipleImages,
  onClearSelection,
  onOpenQuickLook,
  onThumbnailSizeChange,
  onToggleBookmark,
  onTrashBatch,
  onSendToVault,
  onNavigateToFolder,
  onShowToast,
  wheelThrottle = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const justifiedContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1000);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [viewportHeight, setViewportHeight] = useState<number>(800);
  const lastThumbnailZoomTime = useRef<number>(0);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: ImageItem;
  } | null>(null);

  // Marquee selection box state
  const [isMarqueeDragging, setIsMarqueeDragging] = useState<boolean>(false);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeCurrent, setMarqueeCurrent] = useState<{ x: number; y: number } | null>(null);
  const hasMarqueeMoved = useRef<boolean>(false);
  const clickedCardId = useRef<string | null>(null);
  const isModifierKey = useRef<boolean>(false);

  // Measure container dimensions with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = Math.floor(entry.contentRect.width) - 16; // subtract padding
        if (width > 50) {
          setContainerWidth(width);
        }
        setViewportHeight(entry.contentRect.height || 800);
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Track scroll position for virtual windowing
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  // Zoom scaling with Ctrl + Wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      if (wheelThrottle) {
        const now = Date.now();
        if (now - lastThumbnailZoomTime.current > 40) {
          lastThumbnailZoomTime.current = now;
          const delta = e.deltaY < 0 ? 30 : -30;
          const nextSize = Math.max(80, Math.min(1200, thumbnailSize + delta));
          onThumbnailSizeChange(nextSize);
        }
      } else {
        const delta = e.deltaY < 0 ? 30 : -30;
        const nextSize = Math.max(80, Math.min(1200, thumbnailSize + delta));
        onThumbnailSizeChange(nextSize);
      }
    }
  }, [thumbnailSize, onThumbnailSizeChange, wheelThrottle]);

  // Compute Layout Boxes (Zero-crop Justified / Masonry / Grid)
  const layoutResult = useMemo(() => {
    if (layoutMode === 'justified') {
      return computeJustifiedLayout(images, containerWidth, thumbnailSize, gap);
    } else if (layoutMode === 'masonry') {
      return computeMasonryLayout(images, containerWidth, thumbnailSize, gap);
    } else {
      return computeSquareGridLayout(images, containerWidth, thumbnailSize, gap);
    }
  }, [images, layoutMode, containerWidth, thumbnailSize, gap]);

  // Virtualization: filter only visible boxes within viewport + 600px buffer
  const visibleBoxes = useMemo(() => {
    const buffer = 600;
    const minTop = scrollTop - buffer;
    const maxTop = scrollTop + viewportHeight + buffer;

    return layoutResult.boxes.filter((box) => {
      const boxBottom = box.top + box.height;
      return boxBottom >= minTop && box.top <= maxTop;
    });
  }, [layoutResult.boxes, scrollTop, viewportHeight]);

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Open default image viewer
  const handleOpenDefault = useCallback((filePath: string) => {
    if (window.electronAPI?.openWithDefault) {
      window.electronAPI.openWithDefault(filePath);
    } else {
      const found = images.find((img) => img.path === filePath);
      if (found) window.open(found.url, '_blank');
    }
  }, [images]);

  // Copy image bitmap to clipboard
  const handleCopyImage = useCallback(async (filePath: string) => {
    if (window.electronAPI?.copyImageToClipboard) {
      await window.electronAPI.copyImageToClipboard(filePath);
    }
  }, []);

  // Copy file path to clipboard
  const handleCopyPath = useCallback(async (filePath: string) => {
    if (window.electronAPI?.copyTextToClipboard) {
      await window.electronAPI.copyTextToClipboard(filePath);
    } else {
      navigator.clipboard.writeText(filePath);
    }
  }, []);

  // Show in Windows Explorer
  const handleShowInFolder = useCallback((filePath: string) => {
    if (window.electronAPI?.showInFolder) {
      window.electronAPI.showInFolder(filePath);
    }
  }, []);

  // Marquee Drag Selection Handlers (Supports starting drag anywhere, including directly on images)
  const handleMouseDownOnCanvas = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only start marquee selection with left click
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    // Do not initiate drag selection when clicking on buttons or folder cards
    if (target.closest('button') || target.closest('.gallery-folder-card')) return;

    const justContainer = justifiedContainerRef.current;
    if (!justContainer) return;

    const rect = justContainer.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    const cardEl = target.closest('.gallery-card');
    clickedCardId.current = cardEl ? cardEl.getAttribute('data-id') : null;
    isModifierKey.current = Boolean(e.ctrlKey || e.shiftKey || e.metaKey);

    hasMarqueeMoved.current = false;
    setIsMarqueeDragging(true);
    setMarqueeStart({ x: startX, y: startY });
    setMarqueeCurrent({ x: startX, y: startY });
  };

  useEffect(() => {
    if (!isMarqueeDragging || !marqueeStart) return;

    const handleMouseMove = (e: MouseEvent) => {
      const justContainer = justifiedContainerRef.current;
      if (!justContainer) return;

      const rect = justContainer.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const dist = Math.hypot(currentX - marqueeStart.x, currentY - marqueeStart.y);
      if (dist > 4) {
        hasMarqueeMoved.current = true;
      }

      setMarqueeCurrent({ x: currentX, y: currentY });

      // Compute bounding box
      const minX = Math.min(marqueeStart.x, currentX);
      const maxX = Math.max(marqueeStart.x, currentX);
      const minY = Math.min(marqueeStart.y, currentY);
      const maxY = Math.max(marqueeStart.y, currentY);

      // Check intersecting boxes
      const selected = new Set<string>();
      for (const box of layoutResult.boxes) {
        const boxRight = box.left + box.width;
        const boxBottom = box.top + box.height;

        const isIntersecting = !(
          box.left > maxX ||
          boxRight < minX ||
          box.top > maxY ||
          boxBottom < minY
        );

        if (isIntersecting) {
          selected.add(box.item.id);
        }
      }

      if (onSelectMultipleImages) {
        onSelectMultipleImages(selected);
      }
    };

    const handleMouseUp = () => {
      // If user simply clicked without dragging
      if (!hasMarqueeMoved.current) {
        if (clickedCardId.current) {
          onSelectImage(clickedCardId.current, isModifierKey.current);
        } else {
          onClearSelection();
        }
      }
      setIsMarqueeDragging(false);
      setMarqueeStart(null);
      setMarqueeCurrent(null);
      clickedCardId.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isMarqueeDragging, marqueeStart, layoutResult.boxes, onSelectMultipleImages, onSelectImage, onClearSelection]);

  // Smoothly scroll active image into viewport when selected (e.g. navigated in QuickLook)
  useEffect(() => {
    if (!selectedId || !containerRef.current || isMarqueeDragging) return;
    const box = layoutResult.boxes.find((b) => b.item.id === selectedId);
    if (!box) return;

    const container = containerRef.current;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    const boxTop = box.top;
    const boxBottom = box.top + box.height;

    if (boxTop < viewTop) {
      container.scrollTo({ top: Math.max(0, boxTop - 24), behavior: 'smooth' });
    } else if (boxBottom > viewBottom) {
      container.scrollTo({ top: boxBottom - container.clientHeight + 24, behavior: 'smooth' });
    }
  }, [selectedId, layoutResult.boxes, isMarqueeDragging]);

  // Compute marquee box visual bounds
  const marqueeBoxStyle = useMemo(() => {
    if (!isMarqueeDragging || !marqueeStart || !marqueeCurrent || !hasMarqueeMoved.current) return null;
    const left = Math.min(marqueeStart.x, marqueeCurrent.x);
    const top = Math.min(marqueeStart.y, marqueeCurrent.y);
    const width = Math.abs(marqueeCurrent.x - marqueeStart.x);
    const height = Math.abs(marqueeCurrent.y - marqueeStart.y);

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    };
  }, [isMarqueeDragging, marqueeStart, marqueeCurrent]);

  // Selected images array for batch context menu
  const selectedImagesList = useMemo(() => {
    if (selectedIds.size > 1) {
      return images.filter((img) => selectedIds.has(img.id));
    }
    if (contextMenu) {
      return [contextMenu.item];
    }
    return [];
  }, [images, selectedIds, contextMenu]);

  const renderFolderSection = () => {
    if (!showFolders || !folders || folders.length === 0 || isBookmarksView) {
      return null;
    }

    return (
      <div style={{ marginBottom: '18px', userSelect: 'none' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '10px',
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--text-secondary)',
            paddingLeft: '2px',
          }}
        >
          <Folder size={15} color="#60a5fa" fill="rgba(96, 165, 250, 0.2)" />
          <span>폴더 ({folders.length})</span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
            gap: '8px',
          }}
        >
          {folders.map((folder) => (
            <div
              key={folder.path}
              onClick={() => onNavigateToFolder?.(folder.path)}
              style={{
                padding: '10px 12px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              title={folder.path}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(96, 165, 250, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Folder size={18} color="#60a5fa" fill="rgba(96, 165, 250, 0.3)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {folder.name}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  하위 폴더 열기
                </div>
              </div>
            </div>
          ))}
        </div>

        {images.length > 0 && (
          <div
            style={{
              marginTop: '18px',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              paddingLeft: '2px',
            }}
          >
            <ImageIcon size={14} color="var(--accent)" />
            <span>이미지 ({images.length})</span>
          </div>
        )}
      </div>
    );
  };

  if (images.length === 0) {
    const hasVisibleFolders = showFolders && folders && folders.length > 0 && !isBookmarksView;
    return (
      <div 
        ref={containerRef} 
        className="gallery-workspace" 
        style={hasVisibleFolders ? { padding: '16px' } : { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}
      >
        {renderFolderSection()}

        {isBookmarksView ? (
          <>
            <Star size={48} color="#fbbf24" style={{ opacity: 0.7 }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              북마크된 이미지가 없습니다
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              갤러리에서 마음에 드는 이미지의 별표(⭐)를 눌러 북마크에 추가해 보세요.
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: hasVisibleFolders ? '30px 20px' : '0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <ImageIcon size={44} color="var(--text-muted)" style={{ opacity: 0.4 }} />
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              이 폴더에 직접 포함된 이미지가 없습니다
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {hasVisibleFolders ? '위 하위 폴더를 클릭하여 이동하거나 탐색기에서 파일을 드래그 앤 드롭하세요.' : '탐색기에서 폴더나 이미지 파일을 직접 드래그 앤 드롭해 보세요.'}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="gallery-workspace"
      onScroll={handleScroll}
      onWheel={handleWheel}
      onMouseDown={handleMouseDownOnCanvas}
    >
      {renderFolderSection()}

      <div
        ref={justifiedContainerRef}
        className="justified-container"
        style={{
          height: `${layoutResult.totalHeight + 32}px`,
        }}
      >
        {/* Marquee Drag Selection Box */}
        {marqueeBoxStyle && (
          <div className="marquee-selection-box" style={marqueeBoxStyle} />
        )}

        {visibleBoxes.map((box) => {
          const isSelected = selectedIds.has(box.item.id) || selectedId === box.item.id;
          const isBookmarked = box.item.isBookmarked || false;

          return (
            <div
              key={box.item.id}
              data-id={box.item.id}
              className={`gallery-card ${isSelected ? 'selected' : ''}`}
              style={{
                top: `${box.top}px`,
                left: `${box.left}px`,
                width: `${box.width}px`,
                height: `${box.height}px`,
              }}
              onDoubleClick={() => {
                if (doubleClickAction === 'defaultViewer') {
                  handleOpenDefault(box.item.path);
                } else {
                  const idx = images.findIndex((img) => img.id === box.item.id);
                  if (idx >= 0) {
                    onOpenQuickLook(idx);
                  }
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // If right-clicked card is NOT already part of multi-selection, select only this card
                if (!selectedIds.has(box.item.id)) {
                  onSelectImage(box.item.id, false);
                }

                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  item: box.item,
                });
              }}
            >
              {/* Image element */}
              <img
                src={box.item.url}
                alt={box.item.name}
                className="card-image"
                loading="lazy"
                decoding="async"
                draggable={false}
              />

              {/* Selection Checkmark Badge (Top-Left) */}
              <div className={`card-select-badge ${isSelected ? 'selected' : ''}`}>
                {isSelected && <Check size={11} color="#ffffff" strokeWidth={3.5} />}
              </div>

              {/* Bookmark Star Button (Hover / Active) */}
              <button
                type="button"
                className={`card-bookmark-btn ${isBookmarked ? 'active' : ''}`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onToggleBookmark?.(box.item.path);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                title={isBookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가'}
              >
                <Star
                  size={14}
                  color="#fbbf24"
                  fill={isBookmarked ? '#fbbf24' : 'transparent'}
                />
              </button>

              {/* Overlay info on hover / always */}
              {showFilenameOnCards !== 'never' && (
                <div className={`card-overlay-info ${showFilenameOnCards === 'always' ? 'always-visible' : ''}`}>
                  <div className="card-filename" title={box.item.name}>
                    {box.item.name}
                  </div>
                  <div className="card-dimens">
                    {box.item.width > 0 ? `${box.item.width}×${box.item.height}` : formatSize(box.item.size)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Right-Click Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          targetImage={contextMenu.item}
          selectedImages={selectedImagesList}
          isBookmarked={contextMenu.item.isBookmarked || false}
          vaults={vaults}
          onClose={() => setContextMenu(null)}
          onOpenDefault={() => handleOpenDefault(contextMenu.item.path)}
          onQuickLook={() => {
            const idx = images.findIndex((img) => img.id === contextMenu.item.id);
            if (idx >= 0) onOpenQuickLook(idx);
          }}
          onToggleBookmark={() => {
            if (selectedImagesList.length > 1) {
              selectedImagesList.forEach((img) => onToggleBookmark?.(img.path));
            } else {
              onToggleBookmark?.(contextMenu.item.path);
            }
          }}
          onCopyImage={() => handleCopyImage(contextMenu.item.path)}
          onCopyPath={() => handleCopyPath(contextMenu.item.path)}
          onShowInFolder={() => handleShowInFolder(contextMenu.item.path)}
          onTrashBatch={(paths) => onTrashBatch(paths)}
          onSendToVault={onSendToVault}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};
