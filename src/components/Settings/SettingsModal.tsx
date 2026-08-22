import React, { useState, useEffect } from 'react';
import {
  X,
  Settings as SettingsIcon,
  Sliders,
  MousePointer,
  Database,
  Info,
  Package,
} from 'lucide-react';
import { AppSettings, StorageVault, ToastType } from '../../types';
import { pushModal, popModal, isTopmostModal } from '../../utils/modalStack';
import type { ConfirmFn } from '../Common/ConfirmDialog';
import { GeneralTab } from './tabs/GeneralTab';
import { BehaviorTab } from './tabs/BehaviorTab';
import { VaultsTab } from './tabs/VaultsTab';
import { DataTab } from './tabs/DataTab';
import { AboutTab } from './tabs/AboutTab';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AppSettings;
  vaults: StorageVault[];
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onResetSettings: () => void;
  onAddVault: (path: string, name?: string, shortcutKey?: string, secondaryKey?: string) => Promise<any>;
  onRemoveVault: (id: string) => void;
  onUpdateVault: (id: string, updates: Partial<StorageVault>) => void;
  onClose: () => void;
  bookmarkCounts: { folders: number; images: number };
  onClearAllBookmarks?: () => void;
  onShowToast?: (message: string, type?: ToastType) => void;
  confirm?: ConfirmFn;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  vaults,
  onUpdateSettings,
  onResetSettings,
  onAddVault,
  onRemoveVault,
  onUpdateVault,
  onClose,
  bookmarkCounts,
  onClearAllBookmarks,
  onShowToast,
  confirm,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'behavior' | 'vaults' | 'data' | 'about'>('general');
  const [isResetDone, setIsResetDone] = useState<boolean>(false);

  // Register in the topmost-modal stack while open, and close on Escape only
  // when no higher overlay (e.g. this modal's own ConfirmDialog) is above us.
  useEffect(() => {
    if (!isOpen) return;
    pushModal('settings');
    return () => popModal('settings');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (!isTopmostModal('settings')) return;
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleReset = () => {
    onResetSettings();
    setIsResetDone(true);
    onShowToast?.('모든 설정이 기본값으로 복원되었습니다.', 'info');
    setTimeout(() => setIsResetDone(false), 1500);
  };

  const handleOpenLink = (url: string) => {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(16px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '860px',
          height: '600px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 28px 72px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'row',
          animation: 'scaleUp 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Settings Sidebar */}
        <div
          style={{
            width: '210px',
            backgroundColor: 'var(--bg-sidebar)',
            borderRight: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            padding: '16px 10px',
            gap: '3px',
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          {/* Logo & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '2px 8px 14px 8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--accent-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
              flexShrink: 0
            }}>
              <SettingsIcon size={18} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>환경설정</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>ViewView Settings</div>
            </div>
          </div>

          {/* Navigation Tab Menu List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
            {[
              { id: 'general', label: '일반 및 레이아웃', icon: <Sliders size={16} /> },
              { id: 'behavior', label: '동작 및 인터랙션', icon: <MousePointer size={16} /> },
              { id: 'vaults', label: '보관함 & 단축키', icon: <Package size={16} />, badge: vaults.length > 0 ? String(vaults.length) : undefined },
              { id: 'data', label: '데이터 관리', icon: <Database size={16} /> },
              { id: 'about', label: '정보 및 크레딧', icon: <Info size={16} /> },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isActive ? 'var(--accent-light)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 650 : 500,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                    {tab.icon}
                    <span>{tab.label}</span>
                  </div>
                  {tab.badge && (
                    <span style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      backgroundColor: isActive ? 'var(--accent)' : 'var(--border-subtle)',
                      color: isActive ? '#ffffff' : 'var(--text-muted)',
                      fontWeight: 700,
                    }}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Note */}
          <div style={{ padding: '8px 4px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', borderTop: '1px solid var(--border-subtle)' }}>
            단축키: <kbd style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-surface)', padding: '2px 5px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>Ctrl + ,</kbd>
          </div>
        </div>

        {/* Right Content Column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', backgroundColor: 'var(--bg-surface)' }}>
          {/* Header inside right pane */}
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-surface)',
              flexShrink: 0,
            }}
          >
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {activeTab === 'general' && '일반 및 레이아웃 설정'}
                {activeTab === 'behavior' && '동작 및 인터랙션 설정'}
                {activeTab === 'vaults' && '보관함 & 단축키 관리'}
                {activeTab === 'data' && '데이터 관리 & 초기화'}
                {activeTab === 'about' && 'ViewView 정보 및 오픈소스 크레딧'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {activeTab === 'general' && '기본 레이아웃 모드, 썸네일 크기 및 정렬 기준을 설정합니다.'}
                {activeTab === 'behavior' && '더블클릭 실행 동작, 하위 폴더 표시 및 삭제 확인 창 옵션.'}
                {activeTab === 'vaults' && '보관함 폴더 등록 및 전역 1차/2차 단축키를 설정합니다.'}
                {activeTab === 'data' && '북마크 데이터 현황 조회 및 전체 설정 초기화.'}
                {activeTab === 'about' && 'ViewView 프로젝트 정보, 라이선스 및 오픈소스 크레딧.'}
              </div>
            </div>

            <button
              className="nav-btn"
              onClick={onClose}
              title="닫기 (Esc)"
              style={{ width: '30px', height: '30px', padding: 0 }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
          {/* TAB 1: General & Layout */}
          {activeTab === 'general' && (
            <GeneralTab
              settings={settings}
              onUpdateSettings={onUpdateSettings}
            />
          )}

          {/* TAB 2: Vaults & Keybindings */}
          {activeTab === 'vaults' && (
            <VaultsTab
              settings={settings}
              vaults={vaults}
              onUpdateSettings={onUpdateSettings}
              onAddVault={onAddVault}
              onRemoveVault={onRemoveVault}
              onUpdateVault={onUpdateVault}
              onShowToast={onShowToast}
            />
          )}

          {/* TAB 3: Behavior & Interaction */}
          {activeTab === 'behavior' && (
            <BehaviorTab
              settings={settings}
              onUpdateSettings={onUpdateSettings}
            />
          )}

          {/* TAB 4: Data & Reset */}
          {activeTab === 'data' && (
            <DataTab
              bookmarkCounts={bookmarkCounts}
              isResetDone={isResetDone}
              onReset={handleReset}
              onClearAllBookmarks={onClearAllBookmarks}
              onShowToast={onShowToast}
              confirm={confirm}
            />
          )}

          {/* TAB 5: About & Open-Source Credits */}
          {activeTab === 'about' && (
            <AboutTab onOpenLink={handleOpenLink} />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: 'var(--bg-sidebar)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>ViewView</span>
            <span>•</span>
            <span>https://github.com/5drake/ViewView</span>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '7px 18px',
              backgroundColor: 'var(--accent)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  </div>
  );
};
