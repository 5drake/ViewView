import React from 'react';
import { ToastType } from '../../../types';
import { Trash2, Check, RotateCcw } from 'lucide-react';
import type { ConfirmFn } from '../../Common/ConfirmDialog';
import { SECTION_CARD_STYLE } from './tabStyles';

// Stat tile inside the bookmark statistics card (identical literal duplicated)
const STAT_CARD_STYLE: React.CSSProperties = {
  padding: '10px',
  background: 'var(--bg-surface)',
  borderRadius: '8px',
  border: '1px solid var(--border-subtle)',
};

// Muted label above a stat value (identical literal duplicated)
const STAT_LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-muted)',
};

interface DataTabProps {
  bookmarkCounts: { folders: number; images: number };
  isResetDone: boolean;
  onReset: () => void;
  onClearAllBookmarks?: () => void;
  onShowToast?: (message: string, type?: ToastType) => void;
  confirm?: ConfirmFn;
}

export const DataTab: React.FC<DataTabProps> = ({
  bookmarkCounts,
  isResetDone,
  onReset,
  onClearAllBookmarks,
  onShowToast,
  confirm,
}) => {
  return (
    <>
      {/* Bookmark Statistics Card */}
      <div style={SECTION_CARD_STYLE}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>
          저장된 북마크 현황
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={STAT_CARD_STYLE}>
            <div style={STAT_LABEL_STYLE}>북마크된 폴더</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#fbbf24', marginTop: '2px' }}>{bookmarkCounts.folders}개</div>
          </div>
          <div style={STAT_CARD_STYLE}>
            <div style={STAT_LABEL_STYLE}>북마크된 이미지</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent)', marginTop: '2px' }}>{bookmarkCounts.images}장</div>
          </div>
        </div>

        {onClearAllBookmarks && (bookmarkCounts.folders > 0 || bookmarkCounts.images > 0) && (
          <button
            onClick={async () => {
              const ok = confirm
                ? await confirm({
                    title: '북마크 초기화',
                    message: '저장된 모든 북마크(폴더 및 이미지)를 비우시겠습니까?',
                    confirmLabel: '초기화',
                    danger: true,
                  })
                : window.confirm('저장된 모든 북마크(폴더 및 이미지)를 비우시겠습니까?');
              if (!ok) return;
              onClearAllBookmarks();
              onShowToast?.('모든 북마크가 초기화되었습니다.', 'info');
            }}
            style={{
              marginTop: '12px',
              width: '100%',
              padding: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Trash2 size={13} />
            <span>북마크 데이터 전체 초기화</span>
          </button>
        )}
      </div>

      {/* Reset App Settings */}
      <div style={SECTION_CARD_STYLE}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
          환경설정 기본값 복원
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', marginBottom: '10px' }}>
          레이아웃, 썸네일 크기, 정렬 방식, 단축키 등의 모든 옵션을 초기 권장 상태로 복원합니다.
        </div>
        <button
          onClick={onReset}
          style={{
            padding: '8px 14px',
            background: isResetDone ? '#10b981' : 'var(--bg-surface)',
            color: isResetDone ? '#ffffff' : 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          {isResetDone ? <Check size={14} /> : <RotateCcw size={14} />}
          <span>{isResetDone ? '기본값으로 복원 완료!' : '모든 설정 기본값으로 리셋'}</span>
        </button>
      </div>
    </>
  );
};

export default DataTab;
