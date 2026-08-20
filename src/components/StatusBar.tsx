import React from 'react';
import { ImageItem, LayoutMode } from '../types';

interface StatusBarProps {
  totalCount: number;
  filteredCount: number;
  selectedImage: ImageItem | null;
  selectedCount: number;
  layoutMode: LayoutMode;
  thumbnailSize: number;
  gap: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  totalCount,
  filteredCount,
  selectedImage,
  selectedCount,
  layoutMode,
  thumbnailSize,
  gap,
}) => {
  const getLayoutName = (m: LayoutMode) => {
    switch (m) {
      case 'justified': return '🧱 저스티파이드 (원본비율 무크롭)';
      case 'masonry': return '📌 메이슨리 워터폴';
      case 'grid': return '🔲 클래식 그리드';
      default: return m;
    }
  };

  return (
    <footer className="app-statusbar">
      <div className="statusbar-section">
        <span>총 {totalCount}개 이미지 {filteredCount !== totalCount ? `(필터됨: ${filteredCount}개)` : ''}</span>
        {selectedCount > 0 && (
          <span style={{ color: 'var(--accent)' }}>
            {selectedCount}개 선택됨
          </span>
        )}
        {selectedImage && (
          <span style={{ color: 'var(--text-secondary)' }}>
            선택: {selectedImage.name} ({selectedImage.width}×{selectedImage.height}px)
          </span>
        )}
      </div>

      <div className="statusbar-section">
        <span>모드: {getLayoutName(layoutMode)}</span>
        <span>배율: {thumbnailSize}px</span>
        <span>간격: {gap}px</span>
      </div>
    </footer>
  );
};
