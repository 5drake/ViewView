import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ImageItem, LayoutMode, StorageVault, FolderItem, ToastType } from '../../types';
import { computeJustifiedLayout } from '../../utils/justifiedLayout';
import { computeMasonryLayout, computeSquareGridLayout } from '../../utils/masonryLayout';
import { Image as ImageIcon, Star, Folder, Check } from 'lucide-react';
import { ContextMenu } from '../ContextMenu/ContextMenu';
import { GalleryCardImage, THUMBNAIL_SIZE_CLASSES, setThumbnailCacheMaxBytes, warmThumbnailCache } from './GalleryCardImage';
import { setThumbnailConcurrency } from '../../utils/thumbnailScheduler';
import { matchesActionBinding } from '../../utils/keyboard';
import { hasOpenModals } from '../../utils/modalStack';
import { ThumbnailPlaceholder, KeybindingsConfig } from '../../types';

// Scroll band size for band-quantized virtualization updates.
const SCROLL_BAND = 200;
// Formats that must not be decoded-and-resized to a static JPEG thumbnail.
const SKIP_RESIZE_EXTENSIONS = new Set(['gif', 'webp', 'apng', 'svg']);

/** How a marquee drag combines with the selection made before it started. */
type MarqueeMode = 'replace' | 'add' | 'subtract';

/** Layout dispatch shared by the render memo and the wheel dead-zone skipper. */
function computeLayout(
  images: ImageItem[],
  layoutMode: LayoutMode,
  containerWidth: number,
  thumbnailSize: number,
  gap: number
) {
  if (layoutMode === 'justified') {
    return computeJustifiedLayout(images, containerWidth, thumbnailSize, gap);
  }
  if (layoutMode === 'masonry') {
    return computeMasonryLayout(images, containerWidth, thumbnailSize, gap);
  }
  return computeSquareGridLayout(images, containerWidth, thumbnailSize, gap);
}

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
  /** Accepts a functional updater so rapid wheel steps are never coalesced. */
  onThumbnailSizeChange: (update: number | ((prev: number) => number)) => void;
  onToggleBookmark?: (filePath: string) => void;
  onTrashBatch: (paths: string[]) => void;
  onSendToVault?: (vaultId: string, filePaths: string[]) => void;
  onNavigateToFolder?: (path: string) => void;
  onShowToast?: (message: string, type?: ToastType) => void;
  wheelThrottle?: boolean;
  placeholderStyle?: ThumbnailPlaceholder;
  /** Custom keybindings (zoom / layout cycle / clear selection). */
  keybindings?: KeybindingsConfig;
  /** Size applied by the zoom-reset action (settings default). */
  defaultZoom?: number;
  /** Layout switcher for the cycle-layout shortcut. */
  onLayoutModeChange?: (mode: LayoutMode) => void;
  /** Max simultaneous thumbnail loads (settings). */
  thumbConcurrency?: number;
  /** Session thumbnail cache budget in MB (settings). */
  thumbCacheMb?: number;
  /** Whole-folder pre-load limit, 0 disables warming (settings). */
  thumbWarmLimit?: number;
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
  placeholderStyle = 'shimmer',
  thumbConcurrency = 8,
  thumbCacheMb = 192,
  thumbWarmLimit = 4000,
  keybindings,
  defaultZoom = 240,
  onLayoutModeChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const justifiedContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1000);
  const [viewportHeight, setViewportHeight] = useState<number>(800);
  // Virtual window updates in coarse scroll BANDS, not per pixel: raw
  // scrollTop changes would re-render every mounted card on every scroll
  // frame. The exact offset lives in a ref (priority calc only).
  const scrollTopRef = useRef<number>(0);
  const appliedBandRef = useRef<number>(0);
  const [scrollBand, setScrollBand] = useState<number>(0);
  const lastThumbnailZoomTime = useRef<number>(0);
  // Raw Ctrl+wheel deltaY accumulator — guarantees one size step per notch
  // even when events arrive faster than React can re-render.
  const wheelAccumRef = useRef<number>(0);

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
  const [marqueeMode, setMarqueeMode] = useState<MarqueeMode>('replace');
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

  // Track scroll position for virtual windowing (rAF-batched, band-quantized:
  // state updates only when the scroll crosses a band boundary, so scrolling
  // no longer re-renders every mounted card per frame).
  const scrollRafRef = useRef<number | null>(null);
  const handleScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      if (!containerRef.current) return;
      const st = containerRef.current.scrollTop;
      scrollTopRef.current = st;
      const band = Math.floor(st / SCROLL_BAND);
      if (band !== appliedBandRef.current) {
        appliedBandRef.current = band;
        setScrollBand(band);
      }
    });
  }, []);

  // Cancel any pending scroll frame on unmount
  useEffect(() => () => {
    if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
  }, []);

  // Zoom scaling with Ctrl + Wheel — attached as a NATIVE non-passive listener.
  // React registers wheel as passive at its root, so preventDefault() inside
  // React's onWheel is a no-op and Chromium's page zoom would fire too.
  // Re-binds on view-branch flips (empty ↔ gallery) because the ref element
  // is remounted between them.
  const isEmptyView = images.length === 0;
  const isEmptyViewRef = useRef(isEmptyView);
  isEmptyViewRef.current = isEmptyView;
  // Committed layout, read by the wheel updater to detect dead-zone steps.
  const layoutResultRef = useRef<{ totalHeight: number } | null>(null);

  // One zoom step with dead-zone skipping (shared by Ctrl+wheel & keyboard):
  // justified/masonry layouts are pixel-identical between grouping thresholds,
  // so keep stepping until the rendered layout actually differs from on-screen.
  const stepThumbnailSize = useCallback((current: number, dir: number): number => {
    const clampSize = (v: number) => Math.max(80, Math.min(1200, v));
    let next = clampSize(current + dir * 30);
    if (next === current || isEmptyViewRef.current || !layoutResultRef.current) return next;

    let guard = 0;
    while (guard++ < 24) {
      const candidate = computeLayout(images, layoutMode, containerWidth, next, gap);
      if (candidate.totalHeight !== layoutResultRef.current.totalHeight) break;
      const stepped = clampSize(next + dir * 30);
      if (stepped === next) break; // hit a zoom clamp boundary
      next = stepped;
    }
    return next;
  }, [images, layoutMode, containerWidth, gap]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheelNative = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();

      // Normalize to pixels (line/page deltaModes report tiny values) and
      // ACCUMULATE raw deltas: a standard notch is ~100. Every notch then
      // yields exactly one ±30px size step via a FUNCTIONAL update, so wheel
      // events arriving faster than React re-renders can no longer be
      // coalesced away (the old closure-based math silently dropped notches
      // while the app was busy, e.g. during mass thumbnail loading).
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 100 : e.deltaY;
      wheelAccumRef.current += dy;
      const rawSteps = Math.trunc(wheelAccumRef.current / 100);
      if (rawSteps === 0) return;
      wheelAccumRef.current -= rawSteps * 100;
      // Zoom semantics: wheel UP (negative deltaY) enlarges, wheel DOWN shrinks.
      const steps = -rawSteps;

      if (wheelThrottle && Date.now() - lastThumbnailZoomTime.current <= 40) {
        return; // remainder stays accumulated; applied on the next event
      }
      lastThumbnailZoomTime.current = Date.now();

      const dir = Math.sign(steps * 30);
      onThumbnailSizeChange((current) => stepThumbnailSize(current, dir));
    };

    el.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', handleWheelNative);
  }, [isEmptyView, onThumbnailSizeChange, wheelThrottle, stepThumbnailSize]);

  // Gallery-level custom keys: thumbnail zoom, layout cycling, clear selection.
  // Base-layer listener — ignored while any modal is open or an input is
  // focused; App's global handler skips QuickLook/Settings-open states.
  useEffect(() => {
    if (!keybindings) return;
    const handleKey = (e: KeyboardEvent) => {
      if (hasOpenModals()) return;
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (matchesActionBinding(e, keybindings.zoomIn)) {
        e.preventDefault();
        onThumbnailSizeChange((current) => stepThumbnailSize(current, 1));
        return;
      }
      if (matchesActionBinding(e, keybindings.zoomOut)) {
        e.preventDefault();
        onThumbnailSizeChange((current) => stepThumbnailSize(current, -1));
        return;
      }
      if (matchesActionBinding(e, keybindings.zoomReset)) {
        e.preventDefault();
        onThumbnailSizeChange(defaultZoom);
        return;
      }
      if (matchesActionBinding(e, keybindings.cycleLayout)) {
        e.preventDefault();
        const next: LayoutMode = layoutMode === 'justified' ? 'masonry' : layoutMode === 'masonry' ? 'grid' : 'justified';
        onLayoutModeChange?.(next);
        return;
      }
      if (matchesActionBinding(e, keybindings.clearSelection)) {
        e.preventDefault();
        onClearSelection();
        return;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [keybindings, onThumbnailSizeChange, stepThumbnailSize, defaultZoom, onLayoutModeChange, layoutMode, onClearSelection]);

  // Compute Layout Boxes (Zero-crop Justified / Masonry / Grid)
  const layoutResult = useMemo(
    () => computeLayout(images, layoutMode, containerWidth, thumbnailSize, gap),
    [images, layoutMode, containerWidth, thumbnailSize, gap]
  );
  layoutResultRef.current = layoutResult;

  // Virtualization: filter only visible boxes within viewport + buffer, in
  // band-quantized windows (± one extra band of margin guarantees coverage
  // between band jumps).
  const visibleBoxes = useMemo(() => {
    const buffer = 600;
    const bandTop = scrollBand * SCROLL_BAND;
    const minTop = bandTop - buffer - SCROLL_BAND;
    const maxTop = bandTop + viewportHeight + buffer + SCROLL_BAND;

    return layoutResult.boxes.filter((box) => {
      const boxBottom = box.top + box.height;
      return boxBottom >= minTop && box.top <= maxTop;
    });
  }, [layoutResult.boxes, scrollBand, viewportHeight]);

  // Downscaled-cache size class for the current thumbnail zoom level.
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const renderPx = Math.min(1536, Math.max(96, Math.round(thumbnailSize * dpr)));
  const sizeClass = THUMBNAIL_SIZE_CLASSES.find((c) => renderPx <= c) ?? 1536;

  // Apply performance limits from settings (immediate, no reload needed).
  useEffect(() => {
    setThumbnailConcurrency(thumbConcurrency);
    setThumbnailCacheMaxBytes(thumbCacheMb * 1024 * 1024);
  }, [thumbConcurrency, thumbCacheMb]);

  // Eagerly warm the WHOLE current folder (up to the configured limit; 0
  // disables warming) so every thumbnail is ready before the user scrolls to
  // it. Runs at priority 2 — below visible(0)/buffer(1) cards — and no-ops
  // for anything already cached or in flight.
  useEffect(() => {
    if (thumbWarmLimit <= 0) return;
    const limit = Math.min(images.length, thumbWarmLimit);
    for (let i = 0; i < limit; i++) {
      const item = images[i];
      warmThumbnailCache(
        item.url,
        sizeClass,
        SKIP_RESIZE_EXTENSIONS.has(item.extension.toLowerCase()),
        2
      );
    }
  }, [images, sizeClass, thumbWarmLimit]);

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

    // Marquee combination mode, snapshotted at drag start:
    // Shift+drag adds to the existing selection, Ctrl(+Meta)+drag removes
    // from it, plain drag replaces it.
    const mode: MarqueeMode = e.ctrlKey || e.metaKey ? 'subtract' : e.shiftKey ? 'add' : 'replace';
    marqueeModeRef.current = mode;
    setMarqueeMode(mode);
    baseSelectionRef.current = mode === 'replace' ? null : new Set(selectedIds);

    hasMarqueeMoved.current = false;
    setIsMarqueeDragging(true);
    setMarqueeStart({ x: startX, y: startY });
    setMarqueeCurrent({ x: startX, y: startY });
  };

  // Latest pointer position during a marquee drag. Flushed to state at most
  // once per animation frame so dragging never re-renders the app per mousemove.
  const marqueePointRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeRafRef = useRef<number | null>(null);
  const lastMarqueeSelectionRef = useRef<Set<string> | null>(null);
  const marqueeModeRef = useRef<MarqueeMode>('replace');
  const baseSelectionRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!isMarqueeDragging || !marqueeStart) return;
    lastMarqueeSelectionRef.current = null;

    const computeSelection = (currentX: number, currentY: number): Set<string> => {
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
      return selected;
    };

    const flush = () => {
      marqueeRafRef.current = null;
      const point = marqueePointRef.current;
      if (!point) return;
      setMarqueeCurrent(point);

      const hitSet = computeSelection(point.x, point.y);
      // Combine with the pre-drag selection according to the mode snapshotted
      // at mousedown: Shift+drag unions, Ctrl+drag subtracts, plain replaces.
      const mode = marqueeModeRef.current;
      let selected: Set<string>;
      if (mode === 'add' && baseSelectionRef.current) {
        selected = new Set(baseSelectionRef.current);
        hitSet.forEach((id) => selected.add(id));
      } else if (mode === 'subtract') {
        selected = new Set(baseSelectionRef.current ?? []);
        hitSet.forEach((id) => selected.delete(id));
      } else {
        selected = hitSet;
      }

      // Propagate only when the selection actually changed — otherwise every
      // mousemove churns App-level state through the whole component tree.
      const prev = lastMarqueeSelectionRef.current;
      const changed =
        !prev ||
        prev.size !== selected.size ||
        Array.from(selected).some((id) => !prev.has(id));
      if (changed && onSelectMultipleImages) {
        lastMarqueeSelectionRef.current = selected;
        onSelectMultipleImages(selected);
      }
    };

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

      marqueePointRef.current = { x: currentX, y: currentY };
      if (marqueeRafRef.current === null) {
        marqueeRafRef.current = requestAnimationFrame(flush);
      }
    };

    const handleMouseUp = () => {
      // Flush any pending frame so the final selection sticks before teardown.
      if (marqueeRafRef.current !== null) {
        cancelAnimationFrame(marqueeRafRef.current);
        marqueeRafRef.current = null;
        flush();
      }
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
      setMarqueeMode('replace');
      marqueeModeRef.current = 'replace';
      baseSelectionRef.current = null;
      clickedCardId.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (marqueeRafRef.current !== null) {
        cancelAnimationFrame(marqueeRafRef.current);
        marqueeRafRef.current = null;
      }
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
        {/* Marquee Drag Selection Box (color reflects combine mode) */}
        {marqueeBoxStyle && (
          <div
            className={`marquee-selection-box${marqueeMode === 'add' ? ' mode-add' : marqueeMode === 'subtract' ? ' mode-subtract' : ''}`}
            style={marqueeBoxStyle}
          />
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
              {/* Image element (downscaled cache + scheduled load) */}
              <GalleryCardImage
                url={box.item.url}
                alt={box.item.name}
                priority={box.top < scrollTopRef.current + viewportHeight && box.top + box.height > scrollTopRef.current ? 0 : 1}
                placeholder={placeholderStyle}
                sizeClass={sizeClass}
                skipResize={SKIP_RESIZE_EXTENSIONS.has(box.item.extension.toLowerCase())}
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
