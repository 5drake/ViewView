import React, { useEffect, useRef } from 'react';
import { 
  ExternalLink, 
  Eye, 
  Star, 
  Copy, 
  FolderOpen, 
  Trash2, 
  FileText, 
  Check,
  Layers,
  Package
} from 'lucide-react';
import { ImageItem, StorageVault, ToastType } from '../../types';

interface ContextMenuProps {
  x: number;
  y: number;
  targetImage: ImageItem;
  selectedImages: ImageItem[];
  isBookmarked: boolean;
  vaults?: StorageVault[];
  onClose: () => void;
  onOpenDefault: () => void;
  onQuickLook: () => void;
  onToggleBookmark: () => void;
  onCopyImage: () => void;
  onCopyPath: () => void;
  onShowInFolder: () => void;
  onTrashBatch: (paths: string[]) => void;
  onSendToVault?: (vaultId: string, filePaths: string[]) => void;
  onShowToast?: (message: string, type?: ToastType) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  targetImage,
  selectedImages,
  isBookmarked,
  vaults = [],
  onClose,
  onOpenDefault,
  onQuickLook,
  onToggleBookmark,
  onCopyImage,
  onCopyPath,
  onShowInFolder,
  onTrashBatch,
  onSendToVault,
  onShowToast,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const isMultiSelect = selectedImages.length > 1;

  // Close context menu on outside click or scroll. The latest onClose is read
  // through a ref so callers passing an inline arrow (recreated every render)
  // don't cause the window listeners to be torn down and re-added per render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };
    const handleWheelClose = () => onCloseRef.current();

    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('wheel', handleWheelClose, { passive: true });
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('wheel', handleWheelClose);
    };
  }, []);

  // Adjust positioning within viewport
  const menuWidth = 220;
  const menuHeight = isMultiSelect ? 280 : 340;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const handleCopyImg = () => {
    onCopyImage();
    setCopied('image');
    onShowToast?.('이미지가 클립보드에 복사되었습니다.', 'copy');
    setTimeout(() => onClose(), 400);
  };

  const handleCopyTxt = () => {
    if (isMultiSelect) {
      const paths = selectedImages.map(img => img.path).join('\n');
      if (window.electronAPI?.copyTextToClipboard) {
        window.electronAPI.copyTextToClipboard(paths);
      } else {
        navigator.clipboard.writeText(paths);
      }
      onShowToast?.(`${selectedImages.length}개 파일 경로가 클립보드에 복사되었습니다.`, 'copy');
    } else {
      onCopyPath();
      onShowToast?.('파일 경로가 클립보드에 복사되었습니다.', 'copy');
    }
    setCopied('path');
    setTimeout(() => onClose(), 400);
  };

  const handleBatchTrash = () => {
    const paths = isMultiSelect ? selectedImages.map(img => img.path) : [targetImage.path];
    onTrashBatch(paths);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        left: `${adjustedX}px`,
        top: `${adjustedY}px`,
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Menu Header */}
      <div className="context-menu-header">
        {isMultiSelect ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={14} color="var(--accent)" />
            <span className="context-menu-filename" style={{ fontWeight: 600 }}>
              선택 항목 {selectedImages.length}개
            </span>
          </div>
        ) : (
          <>
            <div className="context-menu-filename" title={targetImage.name}>
              {targetImage.name}
            </div>
            <div className="context-menu-dimens">
              {targetImage.width > 0 ? `${targetImage.width} × ${targetImage.height}` : targetImage.extension}
            </div>
          </>
        )}
      </div>

      <div className="context-menu-divider" />

      {/* Single vs Multi Item Actions */}
      {!isMultiSelect && (
        <>
          <button 
            className="context-menu-item"
            onClick={() => handleAction(onOpenDefault)}
          >
            <ExternalLink size={14} color="var(--accent)" />
            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>기본 뷰어로 열기</span>
            <span className="context-menu-shortcut">Enter</span>
          </button>

          <button 
            className="context-menu-item"
            onClick={() => handleAction(onQuickLook)}
          >
            <Eye size={14} color="#38bdf8" />
            <span>빠른 미리보기 (퀵룩)</span>
            <span className="context-menu-shortcut">Space</span>
          </button>
        </>
      )}

      {/* Bookmark Toggle */}
      <button 
        className="context-menu-item"
        onClick={() => handleAction(onToggleBookmark)}
      >
        <Star 
          size={14} 
          color="#fbbf24" 
          fill={isBookmarked ? '#fbbf24' : 'transparent'} 
        />
        <span>
          {isMultiSelect 
            ? `선택한 ${selectedImages.length}개 즐겨찾기 일괄 토글` 
            : (isBookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가')}
        </span>
      </button>

      {/* Send to Storage Vault Submenu */}
      {vaults && vaults.length > 0 && onSendToVault && (
        <>
          <div className="context-menu-divider" />
          <div style={{ padding: '4px 10px 2px 10px', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            보관함으로 원본 복사
          </div>
          {vaults.map((vault) => (
            <button
              key={vault.id}
              className="context-menu-item"
              onClick={() => {
                const paths = isMultiSelect ? selectedImages.map((img) => img.path) : [targetImage.path];
                onSendToVault(vault.id, paths);
                onClose();
              }}
              title={`${vault.name} (${vault.path})`}
            >
              <Package size={14} color={vault.color || '#818cf8'} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                [{vault.name}]
              </span>
              {vault.shortcutKey && (
                <span className="context-menu-shortcut" style={{ color: vault.color || 'var(--accent)' }}>
                  [{vault.shortcutKey}{vault.secondaryKey ? `/${vault.secondaryKey}` : ''}]
                </span>
              )}
            </button>
          ))}
        </>
      )}

      <div className="context-menu-divider" />

      {/* Copy Actions */}
      {!isMultiSelect && (
        <button 
          className="context-menu-item"
          onClick={handleCopyImg}
        >
          {copied === 'image' ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
          <span>{copied === 'image' ? '이미지 복사됨!' : '이미지 복사'}</span>
        </button>
      )}

      <button 
        className="context-menu-item"
        onClick={handleCopyTxt}
      >
        {copied === 'path' ? <Check size={14} color="#4ade80" /> : <FileText size={14} />}
        <span>
          {copied === 'path' 
            ? '경로 복사됨!' 
            : (isMultiSelect ? `경로 ${selectedImages.length}개 일괄 복사` : '파일 경로 복사')}
        </span>
      </button>

      <button 
        className="context-menu-item"
        onClick={() => handleAction(onShowInFolder)}
      >
        <FolderOpen size={14} color="#60a5fa" />
        <span>탐색기 위치 열기</span>
      </button>

      <div className="context-menu-divider" />

      {/* Batch Delete / Trash */}
      <button 
        className="context-menu-item danger"
        onClick={handleBatchTrash}
      >
        <Trash2 size={14} color="#f87171" />
        <span style={{ fontWeight: 500 }}>
          {isMultiSelect 
            ? `선택한 ${selectedImages.length}개 일괄 삭제` 
            : '휴지통으로 이동'}
        </span>
        <span className="context-menu-shortcut">Del / D</span>
      </button>
    </div>
  );
};
