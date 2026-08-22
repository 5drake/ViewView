import React from 'react';
import { AppSettings } from '../../../types';
import { MUTED_HINT_STYLE } from './tabStyles';

// Setting row card (identical literal duplicated across all six rows)
const SETTING_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px',
  background: 'var(--bg-surface-hover)',
  borderRadius: '10px',
  border: '1px solid var(--border-subtle)',
};

// Compact select box on a setting row (identical literal duplicated twice)
const SETTING_SELECT_STYLE: React.CSSProperties = {
  padding: '6px 10px',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '6px',
  fontSize: '12px',
  outline: 'none',
};

// Toggle checkbox (identical literal duplicated across the toggles)
const TOGGLE_CHECKBOX_STYLE: React.CSSProperties = {
  width: '18px',
  height: '18px',
  accentColor: 'var(--accent)',
  cursor: 'pointer',
};

// Clickable label wrapping a toggle checkbox (identical literal duplicated)
const TOGGLE_LABEL_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
};

interface BehaviorTabProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const BehaviorTab: React.FC<BehaviorTabProps> = ({ settings, onUpdateSettings }) => {
  return (
    <>
      {/* Double Click Action */}
      <div style={SETTING_ROW_STYLE}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>더블클릭 실행 동작</div>
          <div style={MUTED_HINT_STYLE}>갤러리에서 이미지를 더블클릭했을 때 열리는 뷰어</div>
        </div>
        <select
          value={settings.doubleClickAction}
          onChange={(e) => onUpdateSettings({ doubleClickAction: e.target.value as any })}
          style={SETTING_SELECT_STYLE}
        >
          <option value="quicklook">뷰뷰 퀵룩(QuickLook) 뷰어</option>
          <option value="defaultViewer">Windows 기본 사진 뷰어</option>
        </select>
      </div>

      {/* Show Filename Overlay on Cards */}
      <div style={SETTING_ROW_STYLE}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>카드 파일명/해상도 뱃지 표시</div>
          <div style={MUTED_HINT_STYLE}>썸네일 위에 파일 정보 오버레이 표시 조건</div>
        </div>
        <select
          value={settings.showFilenameOnCards}
          onChange={(e) => onUpdateSettings({ showFilenameOnCards: e.target.value as any })}
          style={SETTING_SELECT_STYLE}
        >
          <option value="hover">마우스 호버 시에만 표시 (기본)</option>
          <option value="always">항상 표시</option>
          <option value="never">표시 안 함</option>
        </select>
      </div>

      {/* Real-Time Auto Refresh Toggle */}
      <div style={SETTING_ROW_STYLE}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>실시간 자동 새로고침 (Auto-Refresh)</div>
          <div style={MUTED_HINT_STYLE}>ComfyUI, 다운로드 등 새 파일 생성 시 실시간 감지</div>
        </div>
        <label style={TOGGLE_LABEL_STYLE}>
          <input
            type="checkbox"
            checked={settings.enableAutoRefresh}
            onChange={(e) => onUpdateSettings({ enableAutoRefresh: e.target.checked })}
            style={TOGGLE_CHECKBOX_STYLE}
          />
        </label>
      </div>

      {/* Show Folders in Gallery Toggle */}
      <div style={SETTING_ROW_STYLE}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>갤러리 내 하위 폴더 표시</div>
          <div style={MUTED_HINT_STYLE}>현재 경로의 하위 폴더들을 갤러리 상단에 폴더 카드로 표시</div>
        </div>
        <label style={TOGGLE_LABEL_STYLE}>
          <input
            type="checkbox"
            checked={settings.showFoldersInGallery}
            onChange={(e) => onUpdateSettings({ showFoldersInGallery: e.target.checked })}
            style={TOGGLE_CHECKBOX_STYLE}
          />
        </label>
      </div>

      {/* Confirm Delete Toggle */}
      <div style={SETTING_ROW_STYLE}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>삭제 시 확인 팝업 표시</div>
          <div style={MUTED_HINT_STYLE}>휴지통 이동 전 확인 대화상자 출력 여부</div>
        </div>
        <label style={TOGGLE_LABEL_STYLE}>
          <input
            type="checkbox"
            checked={settings.confirmDelete}
            onChange={(e) => onUpdateSettings({ confirmDelete: e.target.checked })}
            style={TOGGLE_CHECKBOX_STYLE}
          />
        </label>
      </div>

      {/* Explorer Thumbnail Wheel Zoom Throttle Toggle */}
      <div style={SETTING_ROW_STYLE}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>탐색기 썸네일 줌 스마트 스로틀링</div>
          <div style={MUTED_HINT_STYLE}>Ctrl+휠로 갤러리 썸네일 크기 조절 시 지연 제한을 두어 부드럽게 조절 (기본: 끔)</div>
        </div>
        <label style={TOGGLE_LABEL_STYLE}>
          <input
            type="checkbox"
            checked={Boolean(settings.explorerWheelThrottle)}
            onChange={(e) => onUpdateSettings({ explorerWheelThrottle: e.target.checked })}
            style={TOGGLE_CHECKBOX_STYLE}
          />
        </label>
      </div>

      {/* QuickLook Wheel Throttle Toggle */}
      <div style={SETTING_ROW_STYLE}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>퀵룩 휠 이미지 탐색 스마트 스로틀링</div>
          <div style={MUTED_HINT_STYLE}>Alt/Ctrl+휠로 사진 탐색 시 120ms 지연 제한을 두어 오버스크롤 방지 (기본: 끔)</div>
        </div>
        <label style={TOGGLE_LABEL_STYLE}>
          <input
            type="checkbox"
            checked={Boolean(settings.quickLookWheelThrottle)}
            onChange={(e) => onUpdateSettings({ quickLookWheelThrottle: e.target.checked })}
            style={TOGGLE_CHECKBOX_STYLE}
          />
        </label>
      </div>

      {/* Performance Limits */}
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
        성능
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>동시 썸네일 로드 수</span>
          <span style={{ fontSize: '12px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{settings.thumbConcurrentLoads}개</span>
        </div>
        <input
          type="range"
          min={1}
          max={24}
          step={1}
          value={settings.thumbConcurrentLoads}
          onChange={(e) => onUpdateSettings({ thumbConcurrentLoads: Number(e.target.value) })}
          className="custom-range"
          style={{ width: '100%' }}
        />
        <div style={MUTED_HINT_STYLE}>한 번에 불러오는 썸네일 개수 — 높이면 첫 로딩이 빨라지지만 순간 부담이 커짐</div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>썸네일 캐시 메모리</span>
          <span style={{ fontSize: '12px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{settings.thumbCacheMaxMb}MB</span>
        </div>
        <input
          type="range"
          min={64}
          max={1024}
          step={64}
          value={settings.thumbCacheMaxMb}
          onChange={(e) => onUpdateSettings({ thumbCacheMaxMb: Number(e.target.value) })}
          className="custom-range"
          style={{ width: '100%' }}
        />
        <div style={MUTED_HINT_STYLE}>세션 동안 유지되는 축소 썸네일 캐시 예산 — 클수록 재방문이 빠름</div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>폴더 선로딩 한도</span>
          <span style={{ fontSize: '12px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
            {settings.thumbWarmLimit === 0 ? '끔' : `${settings.thumbWarmLimit.toLocaleString()}장`}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={20000}
          step={500}
          value={settings.thumbWarmLimit}
          onChange={(e) => onUpdateSettings({ thumbWarmLimit: Number(e.target.value) })}
          className="custom-range"
          style={{ width: '100%' }}
        />
        <div style={MUTED_HINT_STYLE}>폴더 진입 시 스크롤과 무관하게 미리 로드할 최대 장수 (0 = 끔)</div>
      </div>
    </>
  );
};

export default BehaviorTab;
