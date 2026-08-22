import React from 'react';
import { AppSettings, LayoutMode, SortField, SortDirection, ThumbnailPlaceholder } from '../../../types';
import { Check, Rows3, Columns3, LayoutGrid } from 'lucide-react';

// Section label above a form control (identical literal duplicated twice)
const FORM_LABEL_STYLE: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginBottom: '8px',
  display: 'block',
};

interface GeneralTabProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ settings, onUpdateSettings }) => {
  return (
    <>
      {/* Default Layout Mode */}
      <div>
        <label style={FORM_LABEL_STYLE}>
          기본 갤러리 레이아웃
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {[
            { id: 'justified', label: '저스티파이드', desc: '원본 비율 무크롭', icon: <Rows3 size={16} /> },
            { id: 'masonry', label: '메이슨리', desc: '핀터레스트형 폭 고정', icon: <Columns3 size={16} /> },
            { id: 'grid', label: '스퀘어 그리드', desc: '1:1 정방형 격자', icon: <LayoutGrid size={16} /> },
          ].map((item) => {
            const isSelected = settings.defaultLayout === item.id;
            return (
              <div
                key={item.id}
                onClick={() => onUpdateSettings({ defaultLayout: item.id as LayoutMode })}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  background: isSelected ? 'var(--accent-light)' : 'var(--bg-surface-hover)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '12px' }}>
                    {item.icon}
                    {item.label}
                  </span>
                  {isSelected && <Check size={14} />}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {item.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Default Sort Field & Direction */}
      <div>
        <label style={FORM_LABEL_STYLE}>
          기본 정렬 방식
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            value={`${settings.defaultSortField}-${settings.defaultSortDirection}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split('-');
              onUpdateSettings({
                defaultSortField: field as SortField,
                defaultSortDirection: dir as SortDirection,
              });
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: 'var(--bg-surface-hover)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              fontSize: '12px',
              outline: 'none',
            }}
          >
            <option value="date-desc">최신 수정일순 (기본 권장)</option>
            <option value="date-asc">오래된 수정일순</option>
            <option value="name-asc">이름 오름차순 (A-Z, 가-힣)</option>
            <option value="name-desc">이름 내림차순 (Z-A, 힣-가)</option>
            <option value="size-desc">파일 용량 큰 순</option>
            <option value="size-asc">파일 용량 작은 순</option>
            <option value="width-desc">해상도(가로) 높은 순</option>
            <option value="type-asc">확장자 형식순</option>
          </select>
        </div>
      </div>

      {/* Default Thumbnail Size & Gap */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>기본 썸네일 크기</span>
            <span style={{ fontSize: '12px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{settings.defaultThumbnailSize}px</span>
          </div>
          <input
            type="range"
            min={80}
            max={600}
            step={10}
            value={settings.defaultThumbnailSize}
            onChange={(e) => onUpdateSettings({ defaultThumbnailSize: Number(e.target.value) })}
            className="custom-range"
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>기본 이미지 간격</span>
            <span style={{ fontSize: '12px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{settings.defaultGap}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={24}
            step={2}
            value={settings.defaultGap}
            onChange={(e) => onUpdateSettings({ defaultGap: Number(e.target.value) })}
            className="custom-range"
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Loading Thumbnail Placeholder Style */}
      <div>
        <label style={FORM_LABEL_STYLE}>
          로딩 중 임시 썸네일
        </label>
        <select
          value={settings.thumbnailPlaceholder}
          onChange={(e) => onUpdateSettings({ thumbnailPlaceholder: e.target.value as ThumbnailPlaceholder })}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: 'var(--bg-surface-hover)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            fontSize: '12px',
            outline: 'none',
          }}
        >
          <option value="shimmer">쉬머 그라데이션 (기본 권장)</option>
          <option value="pulse">펄스 깜빡임</option>
          <option value="solid">단색 (애니메이션 없음)</option>
          <option value="none">사용 안 함</option>
        </select>
        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
          썸네일이 로드되기 전까지 표시할 임시 플레이스홀더 모양입니다.
        </div>
      </div>
    </>
  );
};

export default GeneralTab;
