import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Package,
  Star,
  Trash2,
  Info,
  Copy,
  Check,
  Camera,
  Sparkles,
  Layers,
  Calendar,
  HardDrive
} from 'lucide-react';
import { ImageItem, StorageVault, KeybindingsConfig, ExifData, ToastType } from '../../types';
import { matchesVaultBinding, matchesActionBinding } from '../../utils/keyboard';
import { parseImageExif } from '../../utils/metadata';
import { AnimationPlayer } from './AnimationPlayer';

interface QuickLookProps {
  isOpen: boolean;
  image: ImageItem | null;
  currentIndex?: number;
  totalCount?: number;
  vaults?: StorageVault[];
  isBookmarked?: boolean;
  keybindings?: KeybindingsConfig;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onSendToVault?: (vaultId: string, filePaths: string[]) => void;
  onToggleBookmark?: (filePath: string) => void;
  onTrashBatch?: (paths: string[]) => void;
  onShowToast?: (message: string, type?: ToastType) => void;
  wheelThrottle?: boolean;
}

export const QuickLookModal: React.FC<QuickLookProps> = ({
  isOpen,
  image,
  currentIndex = 0,
  totalCount = 0,
  vaults = [],
  isBookmarked = false,
  keybindings,
  onClose,
  onNext,
  onPrev,
  onSendToVault,
  onToggleBookmark,
  onTrashBatch,
  onShowToast,
  wheelThrottle = false,
}) => {
  const [scale, setScale] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showMetadata, setShowMetadata] = useState<boolean>(false);
  const [exif, setExif] = useState<ExifData | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const hasMovedRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragOffsetStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastWheelNavTime = useRef<number>(0);

  // Reset zoom & pan when image changes or modal opens
  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);
  }, [image]);

  // Load EXIF & metadata when active image changes
  useEffect(() => {
    if (!image) {
      setExif(null);
      return;
    }
    let isMounted = true;
    parseImageExif(image.url, image.path).then((data) => {
      if (isMounted) {
        setExif(data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [image?.url]);

  // Copy text helper
  const handleCopyText = useCallback((text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    onShowToast?.(`${fieldName}이(가) 클립보드에 복사되었습니다.`, 'copy');
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  }, [onShowToast]);

  // Open in default OS image viewer
  const handleOpenDefault = useCallback(() => {
    if (!image) return;
    if (window.electronAPI?.openWithDefault) {
      window.electronAPI.openWithDefault(image.path);
    } else {
      window.open(image.url, '_blank');
    }
    onClose();
  }, [image, onClose]);

  // Keyboard navigation & zoom shortcuts inside QuickLook
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      // Check Space / Escape / custom quickLook keybinding to close immediately
      const isSpace = e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar';
      const isEscape = e.key === 'Escape' || e.key === 'Esc';
      const isQuickLookBinding = keybindings?.quickLook && matchesActionBinding(e, keybindings.quickLook);

      if (isEscape || isSpace || isQuickLookBinding) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      // Next / Previous Image navigation
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        e.stopPropagation();
        onNext?.();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        e.stopPropagation();
        onPrev?.();
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        handleOpenDefault();
      } else if (e.key === '0' || e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setScale(1);
        setOffset({ x: 0, y: 0 });
      } else if (e.key === '1') {
        // Only zoom 1.5x if '1' is not bound to a vault shortcut
        const hasVault1 = vaults.some(v => v.shortcutKey === '1' || v.secondaryKey === '1');
        if (!hasVault1) {
          e.preventDefault();
          setScale(1.5);
          setOffset({ x: 0, y: 0 });
        }
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setScale((prev) => Math.min(30, prev * 1.25));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setScale((prev) => Math.max(0.1, prev / 1.25));
      } else if (e.key === 'Tab' || e.code === 'Tab' || e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setShowMetadata((prev) => !prev);
      }

      // Toggle bookmark (B key)
      if (e.key === 'b' || e.key === 'B') {
        if (image && onToggleBookmark) {
          e.preventDefault();
          onToggleBookmark(image.path);
          return;
        }
      }

      // Delete image (Delete / D or custom deleteSelection keybinding)
      if (
        (keybindings?.deleteSelection && matchesActionBinding(e, keybindings.deleteSelection)) ||
        (!e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 'Delete' || e.code === 'Delete' || e.key === 'd' || e.key === 'D'))
      ) {
        if (image && onTrashBatch) {
          e.preventDefault();
          onTrashBatch([image.path]);
          return;
        }
      }

      // Copy image to clipboard (Ctrl+C / Cmd+C)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        if (image) {
          e.preventDefault();
          if (window.electronAPI?.copyImageToClipboard) {
            window.electronAPI.copyImageToClipboard(image.path);
          }
          onShowToast?.('이미지가 클립보드에 복사되었습니다.', 'copy');
          return;
        }
      }

      // Check vault shortcut keys (1st & 2nd keys)
      if (vaults && onSendToVault && image) {
        const matchingVault = vaults.find((v) => matchesVaultBinding(e, v));
        if (matchingVault) {
          e.preventDefault();
          onSendToVault(matchingVault.id, [image.path]);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, handleOpenDefault, onClose, onNext, onPrev, vaults, onSendToVault, onToggleBookmark, onTrashBatch, keybindings, image]);

  // Mouse wheel zoom towards cursor position or Alt/Ctrl+Wheel to navigate images
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Alt or Ctrl or Meta + Wheel: Navigate between images
    if (e.altKey || e.ctrlKey || e.metaKey) {
      if (wheelThrottle) {
        const now = Date.now();
        if (now - lastWheelNavTime.current > 120) {
          lastWheelNavTime.current = now;
          if (e.deltaY > 0) {
            onNext?.();
          } else if (e.deltaY < 0) {
            onPrev?.();
          }
        }
      } else {
        if (e.deltaY > 0) {
          onNext?.();
        } else if (e.deltaY < 0) {
          onPrev?.();
        }
      }
      return;
    }

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const nextScale = Math.max(0.1, Math.min(30, scale * zoomFactor));

    const container = containerRef.current;
    if (!container) {
      setScale(nextScale);
      return;
    }

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;

    // Adjust offset to keep mouse point anchored during zoom
    const nextOffsetX = mouseX - (mouseX - offset.x) * (nextScale / scale);
    const nextOffsetY = mouseY - (mouseY - offset.y) * (nextScale / scale);

    setScale(nextScale);
    setOffset({ x: nextOffsetX, y: nextOffsetY });
  }, [scale, offset, onNext, onPrev, wheelThrottle]);

  // Mouse drag pan handlers (window-level listeners to prevent losing tracking)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    hasMovedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dragOffsetStartRef.current = offset;
  }, [offset]);

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.hypot(dx, dy) > 3) {
        hasMovedRef.current = true;
      }
      setOffset({
        x: dragOffsetStartRef.current.x + dx,
        y: dragOffsetStartRef.current.y + dy,
      });
    };

    const handleWindowMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
        setTimeout(() => {
          hasMovedRef.current = false;
        }, 80);
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, []);

  // Double click toggles between Fit (1x) and 2x Zoom
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale !== 1) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    } else {
      setScale(2);
      setOffset({ x: 0, y: 0 });
    }
  }, [scale]);

  // Clean backdrop click (only closes if user didn't drag/pan)
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (hasMovedRef.current) {
      return;
    }
    if (e.target === containerRef.current) {
      onClose();
    }
  }, [onClose]);

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (!isOpen || !image) return null;

  const aspectRatio = image.width && image.height 
    ? (image.width / image.height).toFixed(2) 
    : null;

  return (
    <div
      className="quicklook-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(20px)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        userSelect: 'none',
        animation: 'fadeIn 0.12s ease-out',
      }}
    >
      {/* Top Floating Glass HUD Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          zIndex: 1010,
          background: 'rgba(15, 17, 24, 0.88)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: '12px',
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.65)',
          maxWidth: '92vw',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* File Info Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          <span 
            style={{ 
              fontSize: '13px', 
              fontWeight: 600, 
              color: '#ffffff', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap', 
              maxWidth: '280px',
            }}
            title={image.name}
          >
            {image.name}
          </span>
          <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
            {image.width > 0 ? `${image.width} × ${image.height}` : ''} {image.size ? `(${formatSize(image.size)})` : ''}
          </span>
        </div>

        {/* Zoom Controls & Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <button
            className="quicklook-btn"
            style={{ width: '32px', height: '32px', padding: 0 }}
            onClick={() => setScale((prev) => Math.max(0.1, prev / 1.2))}
            title="축소 (-)"
          >
            <ZoomOut size={14} />
          </button>
          
          <button
            className="quicklook-btn"
            style={{ 
              height: '32px', 
              padding: '0 10px', 
              fontSize: '11px', 
              fontWeight: 600, 
              fontFamily: 'var(--font-mono)',
              minWidth: '56px',
              textAlign: 'center'
            }}
            onClick={() => {
              setScale(1);
              setOffset({ x: 0, y: 0 });
            }}
            title="화면에 맞추기 / 100% 초기화 (0)"
          >
            {Math.round(scale * 100)}%
          </button>

          <button
            className="quicklook-btn"
            style={{ width: '32px', height: '32px', padding: 0 }}
            onClick={() => setScale((prev) => Math.min(30, prev * 1.2))}
            title="확대 (+)"
          >
            <ZoomIn size={14} />
          </button>
        </div>

        {/* Vaults Quick Send Buttons */}
        {vaults && vaults.length > 0 && onSendToVault && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', borderLeft: '1px solid rgba(255, 255, 255, 0.12)', paddingLeft: '10px' }}>
            {vaults.map((vault) => (
              <button
                key={vault.id}
                className="quicklook-btn"
                onClick={() => onSendToVault(vault.id, [image.path])}
                title={`[${vault.name}] 보관함으로 복제 ${vault.shortcutKey ? `(단축키: ${vault.shortcutKey}${vault.secondaryKey ? ` / ${vault.secondaryKey}` : ''})` : ''}`}
                style={{ height: '32px', display: 'flex', alignItems: 'center', gap: '5px', padding: '0 10px', fontSize: '11px', fontWeight: 600 }}
              >
                <Package size={14} color={vault.color || '#818cf8'} />
                <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vault.name}</span>
                {vault.shortcutKey && (
                  <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)', fontFamily: 'var(--font-mono)' }}>
                    [{vault.shortcutKey}{vault.secondaryKey ? `/${vault.secondaryKey}` : ''}]
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Clean Icon-Only Action Buttons (Info, Bookmark, Delete, Open in Default, Close) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid rgba(255, 255, 255, 0.12)', paddingLeft: '10px' }}>
          {/* Metadata Inspector Toggle Button */}
          <button
            className={`quicklook-btn ${showMetadata ? 'bookmark-active' : ''}`}
            onClick={() => setShowMetadata((prev) => !prev)}
            title="이미지 메타데이터 및 EXIF 정보 [Tab]"
            style={{ 
              width: '34px', 
              height: '34px', 
              padding: 0,
              backgroundColor: showMetadata ? 'rgba(99, 102, 241, 0.25)' : undefined,
              borderColor: showMetadata ? 'rgba(99, 102, 241, 0.6)' : undefined,
              color: showMetadata ? '#a5b4fc' : undefined
            }}
          >
            <Info size={16} />
          </button>

          {/* Bookmark Toggle Button */}
          {onToggleBookmark && image && (
            <button
              className={`quicklook-btn ${isBookmarked ? 'bookmark-active' : ''}`}
              onClick={() => onToggleBookmark(image.path)}
              title={isBookmarked ? "즐겨찾기(북마크) 해제 [B]" : "즐겨찾기(북마크) 등록 [B]"}
              style={{ width: '34px', height: '34px', padding: 0 }}
            >
              <Star size={16} color="#fbbf24" fill={isBookmarked ? '#fbbf24' : 'transparent'} />
            </button>
          )}

          {/* Delete Button */}
          {onTrashBatch && image && (
            <button
              className="quicklook-btn delete-btn"
              onClick={() => onTrashBatch([image.path])}
              title="휴지통으로 삭제 [Del / D]"
              style={{ width: '34px', height: '34px', padding: 0 }}
            >
              <Trash2 size={16} color="#f87171" />
            </button>
          )}

          {/* Open in Default Viewer */}
          <button
            className="quicklook-btn"
            onClick={handleOpenDefault}
            title="기본 이미지 뷰어로 열기 [Enter]"
            style={{ width: '34px', height: '34px', padding: 0 }}
          >
            <ExternalLink size={16} />
          </button>

          {/* Close QuickLook */}
          <button
            className="quicklook-btn"
            onClick={onClose}
            title="퀵룩 닫기 [Space / Esc]"
            style={{ width: '34px', height: '34px', padding: 0 }}
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Floating Metadata Inspector Card */}
      {showMetadata && (
        <div
          style={{
            position: 'fixed',
            top: '72px',
            right: '20px',
            width: '340px',
            maxHeight: 'calc(100vh - 100px)',
            zIndex: 1020,
            background: 'rgba(15, 17, 24, 0.94)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            borderRadius: '14px',
            padding: '16px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 24px rgba(99, 102, 241, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            overflowY: 'auto',
            animation: 'toastSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            color: '#f8fafc',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Metadata Card Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
              <Layers size={16} color="#818cf8" />
              <span>이미지 메타데이터</span>
              <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'var(--font-mono)' }}>[Tab]</span>
            </div>
            <button
              onClick={() => setShowMetadata(false)}
              className="quicklook-btn"
              style={{ width: '24px', height: '24px', padding: 0 }}
              title="메타데이터 창 닫기 (Tab / Esc)"
            >
              <X size={14} />
            </button>
          </div>

          {/* Basic File Properties */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              기본 파일 정보
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>파일명</span>
              <span style={{ fontWeight: 600, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={image.name}>
                {image.name}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>해상도 / 비율</span>
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                {image.width} × {image.height} {aspectRatio ? `(${aspectRatio}:1)` : ''}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>파일 크기</span>
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                {formatSize(image.size)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>파일 형식</span>
              <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                {image.extension}
              </span>
            </div>

            {image.modifiedAt && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>수정 일시</span>
                <span style={{ fontWeight: 500, fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)' }}>
                  {new Date(image.modifiedAt).toLocaleString('ko-KR')}
                </span>
              </div>
            )}

            {/* Path with Copy Button */}
            <div style={{ marginTop: '4px', background: 'rgba(255, 255, 255, 0.05)', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)' }}>저장 경로</span>
                <button
                  onClick={() => handleCopyText(image.path, '파일 경로')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: copiedField === '파일 경로' ? '#34d399' : '#818cf8',
                    cursor: 'pointer',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0
                  }}
                >
                  {copiedField === '파일 경로' ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedField === '파일 경로' ? '복사됨' : '경로 복사'}</span>
                </button>
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
                {image.path}
              </div>
            </div>
          </div>

          {/* Camera EXIF Info (if present) */}
          {exif && (exif.model || exif.iso || exif.fNumber || exif.exposureTime) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <Camera size={13} color="#38bdf8" />
                <span>카메라 EXIF 촬영 정보</span>
              </div>

              {exif.model && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>카메라 기종</span>
                  <span style={{ fontWeight: 600 }}>{exif.make ? `${exif.make} ` : ''}{exif.model}</span>
                </div>
              )}

              {exif.lens && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>렌즈</span>
                  <span style={{ fontWeight: 600, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={exif.lens}>
                    {exif.lens}
                  </span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginTop: '4px' }}>
                {exif.fNumber && (
                  <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '6px 8px', borderRadius: '6px', fontSize: '11px' }}>
                    <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '9px' }}>조리개</div>
                    <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{exif.fNumber}</div>
                  </div>
                )}
                {exif.exposureTime && (
                  <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '6px 8px', borderRadius: '6px', fontSize: '11px' }}>
                    <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '9px' }}>셔터스피드</div>
                    <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{exif.exposureTime}</div>
                  </div>
                )}
                {exif.iso && (
                  <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '6px 8px', borderRadius: '6px', fontSize: '11px' }}>
                    <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '9px' }}>ISO</div>
                    <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>ISO {exif.iso}</div>
                  </div>
                )}
                {exif.focalLength && (
                  <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '6px 8px', borderRadius: '6px', fontSize: '11px' }}>
                    <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '9px' }}>초점거리</div>
                    <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{exif.focalLength}</div>
                  </div>
                )}
              </div>

              {exif.dateTimeOriginal && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '2px' }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>촬영 일시</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.8)' }}>{exif.dateTimeOriginal}</span>
                </div>
              )}
            </div>
          )}

          {/* AI Generation Metadata (if present) */}
          {exif && (exif.aiPrompt || exif.aiModel || exif.aiSeed || exif.aiGenerator) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <Sparkles size={13} color="#c084fc" />
                  <span>AI 생성 메타데이터</span>
                </div>
                {exif.aiGenerator && (
                  <span style={{ 
                    fontSize: '10px', 
                    fontWeight: 700, 
                    color: '#e0e7ff', 
                    background: 'rgba(99, 102, 241, 0.3)', 
                    border: '1px solid rgba(99, 102, 241, 0.5)',
                    padding: '2px 8px', 
                    borderRadius: '12px' 
                  }}>
                    {exif.aiGenerator}
                  </span>
                )}
              </div>

              {exif.aiPrompt && (
                <div style={{ background: 'rgba(192, 132, 252, 0.08)', border: '1px solid rgba(192, 132, 252, 0.25)', borderRadius: '8px', padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#c084fc' }}>🌟 긍정 프롬프트 (Positive Prompt)</span>
                    <button
                      onClick={() => handleCopyText(exif.aiPrompt!, '긍정 프롬프트')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: copiedField === '긍정 프롬프트' ? '#34d399' : '#c084fc',
                        cursor: 'pointer',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: 0
                      }}
                    >
                      {copiedField === '긍정 프롬프트' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedField === '긍정 프롬프트' ? '복사됨' : '복사'}</span>
                    </button>
                  </div>
                  <div style={{ fontSize: '11px', color: '#ffffff', lineHeight: 1.4, maxHeight: '120px', overflowY: 'auto' }}>
                    {exif.aiPrompt}
                  </div>
                </div>
              )}

              {exif.aiCharacterPrompt && (
                <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '8px', padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#38bdf8' }}>👤 캐릭터 프롬프트 (Character Prompt)</span>
                    <button
                      onClick={() => handleCopyText(exif.aiCharacterPrompt!, '캐릭터 프롬프트')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: copiedField === '캐릭터 프롬프트' ? '#34d399' : '#38bdf8',
                        cursor: 'pointer',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: 0
                      }}
                    >
                      {copiedField === '캐릭터 프롬프트' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedField === '캐릭터 프롬프트' ? '복사됨' : '복사'}</span>
                    </button>
                  </div>
                  <div style={{ fontSize: '11px', color: '#ffffff', lineHeight: 1.4, maxHeight: '80px', overflowY: 'auto' }}>
                    {exif.aiCharacterPrompt}
                  </div>
                </div>
              )}

              {exif.aiNegativePrompt && (
                <div style={{ background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.25)', borderRadius: '8px', padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#f87171' }}>🚫 부정 프롬프트 (Negative Prompt)</span>
                    <button
                      onClick={() => handleCopyText(exif.aiNegativePrompt!, '부정 프롬프트')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: copiedField === '부정 프롬프트' ? '#34d399' : '#f87171',
                        cursor: 'pointer',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: 0
                      }}
                    >
                      {copiedField === '부정 프롬프트' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedField === '부정 프롬프트' ? '복사됨' : '복사'}</span>
                    </button>
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.4, maxHeight: '80px', overflowY: 'auto' }}>
                    {exif.aiNegativePrompt}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                {exif.aiModel && (
                  <span style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '3px 8px', borderRadius: '12px', fontSize: '10px', color: '#e2e8f0' }}>
                    Model: <strong>{exif.aiModel}</strong>
                  </span>
                )}
                {exif.aiSteps && (
                  <span style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '3px 8px', borderRadius: '12px', fontSize: '10px', color: '#e2e8f0' }}>
                    Steps: <strong>{exif.aiSteps}</strong>
                  </span>
                )}
                {exif.aiSampler && (
                  <span style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '3px 8px', borderRadius: '12px', fontSize: '10px', color: '#e2e8f0' }}>
                    Sampler: <strong>{exif.aiSampler}</strong>
                  </span>
                )}
                {exif.aiCfg && (
                  <span style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '3px 8px', borderRadius: '12px', fontSize: '10px', color: '#e2e8f0' }}>
                    CFG: <strong>{exif.aiCfg}</strong>
                  </span>
                )}
                {exif.aiNoiseSchedule && (
                  <span style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '3px 8px', borderRadius: '12px', fontSize: '10px', color: '#e2e8f0' }}>
                    Schedule: <strong>{exif.aiNoiseSchedule}</strong>
                  </span>
                )}
                {exif.aiSmea && (
                  <span style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '3px 8px', borderRadius: '12px', fontSize: '10px', color: '#e2e8f0' }}>
                    SMEA: <strong>{exif.aiSmea}</strong>
                  </span>
                )}
                {exif.aiClipSkip && (
                  <span style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '3px 8px', borderRadius: '12px', fontSize: '10px', color: '#e2e8f0' }}>
                    Clip skip: <strong>{exif.aiClipSkip}</strong>
                  </span>
                )}
                {exif.aiSeed && (
                  <span style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '3px 8px', borderRadius: '12px', fontSize: '10px', color: '#e2e8f0' }}>
                    Seed: <strong>{exif.aiSeed}</strong>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Interactive Zoomable / Pannable Image Canvas (Fills ViewView window) */}
      <div
        ref={containerRef}
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          cursor: isDragging ? 'grabbing' : scale > 1 ? 'grab' : 'default',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onClick={handleCanvasClick}
      >
        <AnimationPlayer
          imageUrl={image.url}
          isAnimated={Boolean(image?.extension && ['gif', 'webp', 'apng'].includes(image.extension.toLowerCase()))}
          scale={scale}
          offset={offset}
          isDragging={isDragging}
          onMouseDown={handleMouseDown}
        />
      </div>

      {/* Floating Previous Image Button */}
      {onPrev && totalCount > 1 && (
        <button
          className="quicklook-nav-arrow-btn"
          style={{ left: '20px' }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            (e.currentTarget as HTMLElement)?.blur();
            onPrev();
          }}
          title="이전 이미지 (← / PageUp)"
        >
          <ChevronLeft size={22} color="#ffffff" />
        </button>
      )}

      {/* Floating Next Image Button */}
      {onNext && totalCount > 1 && (
        <button
          className="quicklook-nav-arrow-btn"
          style={{ right: '20px' }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            (e.currentTarget as HTMLElement)?.blur();
            onNext();
          }}
          title="다음 이미지 (→ / PageDown)"
        >
          <ChevronRight size={22} color="#ffffff" />
        </button>
      )}

      {/* Bottom Floating Index & Shortcut Hint */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1010,
          background: 'rgba(15, 17, 24, 0.8)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '20px',
          padding: '5px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.65)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
          fontFamily: 'var(--font-mono)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span style={{ fontWeight: 600, color: '#ffffff' }}>
          {totalCount > 0 ? `${currentIndex + 1} / ${totalCount}` : '1 / 1'}
        </span>
        <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>|</span>
        <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
          ← / → 또는 <strong style={{ color: '#ffffff' }}>Alt/Ctrl+휠</strong> 이동 • 휠 줌 • <strong style={{ color: '#a5b4fc' }}>Tab</strong> 정보 • <strong style={{ color: '#fbbf24' }}>B</strong> 즐겨찾기 • <strong style={{ color: '#f87171' }}>Del</strong> 삭제
        </span>
      </div>
    </div>
  );
};
