import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings as SettingsIcon, 
  LayoutGrid, 
  Sliders, 
  MousePointer, 
  Database, 
  RotateCcw, 
  Check, 
  Sparkles,
  Rows3,
  Columns3,
  Trash2,
  Info,
  ExternalLink,
  Code2,
  Cpu,
  Layers,
  ShieldCheck,
  Package,
  Keyboard,
  Plus,
  FolderOpen
} from 'lucide-react';
import { AppSettings, LayoutMode, SortField, SortDirection, StorageVault, KeybindingsConfig, ToastType } from '../../types';
import { DEFAULT_KEYBINDINGS } from '../../hooks/useSettings';
import { formatKeyEvent } from '../../utils/keyboard';
import { VAULT_COLORS } from '../../hooks/useVaults';
import type { ConfirmFn } from '../Common/ConfirmDialog';

const GithubIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

// Interactive key capture recorder with clear option
const KeyRecorderInput: React.FC<{
  value?: string;
  onChange: (newKey: string) => void;
  placeholder?: string;
  canClear?: boolean;
}> = ({ value = '', onChange, placeholder = '미지정', canClear = false }) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      setIsRecording(false);
      return;
    }

    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      return;
    }

    const formatted = formatKeyEvent(e);
    onChange(formatted);
    setIsRecording(false);
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', position: 'relative' }}>
      <button
        type="button"
        onClick={() => setIsRecording(true)}
        onBlur={() => setIsRecording(false)}
        onKeyDown={isRecording ? handleKeyDown : undefined}
        style={{
          padding: '4px 8px',
          borderRadius: '6px',
          border: `1px solid ${isRecording ? 'var(--accent)' : 'var(--border-subtle)'}`,
          background: isRecording ? 'var(--accent-light)' : 'var(--bg-surface)',
          color: isRecording ? 'var(--accent)' : value ? 'var(--text-primary)' : 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          fontWeight: 600,
          minWidth: '64px',
          textAlign: 'center',
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.15s ease',
        }}
        title="클릭 후 변경할 단축키를 누르세요 (Esc로 취소)"
      >
        {isRecording ? '키 입력...' : value || placeholder}
      </button>
      {canClear && value && !isRecording && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange('');
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '2px',
            borderRadius: '3px',
            display: 'flex',
            alignItems: 'center',
          }}
          title="단축키 제거"
          onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
};

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

  // Close on Escape when the modal is open (title/tooltip advertise this).
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
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

  const handleSelectVaultFolder = async () => {
    if (window.electronAPI?.selectDirectoryDialog) {
      const selected = await window.electronAPI.selectDirectoryDialog();
      if (selected) {
        onAddVault(selected);
      }
    }
  };

  const handleUpdateKeybinding = (
    actionKey: keyof KeybindingsConfig,
    slot: 'primary' | 'secondary',
    newKey: string
  ) => {
    const currentPair = (currentKeybindings as any)[actionKey] || { primary: '', secondary: '' };
    onUpdateSettings({
      keybindings: {
        ...currentKeybindings,
        [actionKey]: {
          primary: slot === 'primary' ? newKey : currentPair.primary,
          secondary: slot === 'secondary' ? newKey : (currentPair.secondary || ''),
        },
      },
    });
  };

  const handleResetKeybindings = () => {
    onUpdateSettings({
      keybindings: DEFAULT_KEYBINDINGS,
    });
    onShowToast?.('단축키가 기본값으로 초기화되었습니다.', 'info');
  };

  const currentKeybindings = settings.keybindings || DEFAULT_KEYBINDINGS;

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
            <>
              {/* Default Layout Mode */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', display: 'block' }}>
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
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', display: 'block' }}>
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
            </>
          )}

          {/* TAB 2: Vaults & Keybindings */}
          {activeTab === 'vaults' && (
            <>
              {/* Storage Vaults Section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Package size={15} color="#818cf8" />
                      <span>보관함 (Storage Vaults) 설정</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      자주 저장하는 폴더를 등록하고 단축키로 선택한 이미지를 원본 그대로 복제합니다.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSelectVaultFolder}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--accent)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Plus size={14} />
                    <span>보관함 추가</span>
                  </button>
                </div>

                {vaults.length === 0 ? (
                  <div 
                    onClick={handleSelectVaultFolder}
                    style={{
                      padding: '24px',
                      border: '1.5px dashed var(--border-subtle)',
                      borderRadius: '10px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: 'var(--bg-surface-hover)',
                    }}
                  >
                    <Package size={28} color="var(--text-muted)" style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      등록된 보관함이 없습니다
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      [보관함 추가]를 클릭하여 PC의 기존 폴더를 보관함으로 지정하세요
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {vaults.map((vault) => (
                      <div
                        key={vault.id}
                        style={{
                          padding: '10px 14px',
                          background: 'var(--bg-surface-hover)',
                          borderRadius: '10px',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        {/* Vault Color indicator */}
                        <div
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: vault.color || '#818cf8',
                            flexShrink: 0,
                          }}
                        />

                        {/* Name & Path */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <input
                            type="text"
                            value={vault.name}
                            onChange={(e) => onUpdateVault(vault.id, { name: e.target.value })}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              borderBottom: '1px solid transparent',
                              fontSize: '13px',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              width: '100%',
                              outline: 'none',
                              padding: '1px 0',
                            }}
                            placeholder="보관함 이름"
                            onFocus={(e) => (e.target.style.borderBottomColor = 'var(--accent)')}
                            onBlur={(e) => (e.target.style.borderBottomColor = 'transparent')}
                          />
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={vault.path}>
                            {vault.path}
                          </div>
                        </div>

                        {/* 1차 & 2차 Keybinding Recorders for this Vault */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>1차:</span>
                            <KeyRecorderInput
                              value={vault.shortcutKey}
                              onChange={(newKey) => onUpdateVault(vault.id, { shortcutKey: newKey })}
                              placeholder="미지정"
                              canClear={true}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>2차:</span>
                            <KeyRecorderInput
                              value={vault.secondaryKey}
                              onChange={(newKey) => onUpdateVault(vault.id, { secondaryKey: newKey })}
                              placeholder="+ 2차키"
                              canClear={true}
                            />
                          </div>
                        </div>

                        {/* Delete Vault button */}
                        <button
                          type="button"
                          onClick={() => onRemoveVault(vault.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title="보관함 등록 해제"
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)' }} />

              {/* Global Keybindings Section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Keyboard size={15} color="var(--accent)" />
                      <span>전역 단축키 (1차 / 2차 커스텀)</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      각 기능별로 1차 단축키 및 2차 보조 단축키를 자유롭게 지정할 수 있습니다. (예: Del 및 D)
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetKeybindings}
                    style={{
                      padding: '4px 10px',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title="단축키를 기본값으로 되돌립니다"
                  >
                    <RotateCcw size={12} />
                    <span>단축키 초기화</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {/* Table Header */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                    <div style={{ flex: 1 }}>기능 및 동작</div>
                    <div style={{ width: '80px', textAlign: 'center', marginRight: '12px' }}>1차 단축키</div>
                    <div style={{ width: '80px', textAlign: 'center' }}>2차 단축키</div>
                  </div>

                  {[
                    { key: 'deleteSelection', label: '선택 항목 휴지통으로 삭제' },
                    { key: 'toggleBookmark', label: '선택 이미지 북마크(⭐) 토글' },
                    { key: 'quickLook', label: '퀵룩(QuickLook) 풀화면 열기/닫기' },
                    { key: 'openDefault', label: 'Windows 기본 사진 뷰어로 열기' },
                    { key: 'toggleSidebar', label: '좌측 사이드바 접기/펼치기' },
                    { key: 'toggleInspector', label: '우측 인스펙터 패널 접기/펼치기' },
                    { key: 'openSettings', label: '환경설정 및 옵션 열기' },
                    { key: 'navigateBack', label: '뒤로 가기' },
                    { key: 'navigateForward', label: '앞으로 가기' },
                    { key: 'navigateUp', label: '상위 폴더로 이동' },
                  ].map((item) => {
                    const pair = (currentKeybindings as any)[item.key] || { primary: '', secondary: '' };
                    return (
                      <div
                        key={item.key}
                        style={{
                          padding: '8px 12px',
                          background: 'var(--bg-surface-hover)',
                          borderRadius: '8px',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >
                        <span style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.label}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <KeyRecorderInput
                            value={pair.primary}
                            onChange={(newKey) => handleUpdateKeybinding(item.key as any, 'primary', newKey)}
                            placeholder="미지정"
                            canClear={true}
                          />

                          <KeyRecorderInput
                            value={pair.secondary}
                            onChange={(newKey) => handleUpdateKeybinding(item.key as any, 'secondary', newKey)}
                            placeholder="+ 2차키"
                            canClear={true}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* TAB 3: Behavior & Interaction */}
          {activeTab === 'behavior' && (
            <>
              {/* Double Click Action */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-surface-hover)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>더블클릭 실행 동작</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>갤러리에서 이미지를 더블클릭했을 때 열리는 뷰어</div>
                </div>
                <select
                  value={settings.doubleClickAction}
                  onChange={(e) => onUpdateSettings({ doubleClickAction: e.target.value as any })}
                  style={{
                    padding: '6px 10px',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                >
                  <option value="quicklook">뷰뷰 퀵룩(QuickLook) 뷰어</option>
                  <option value="defaultViewer">Windows 기본 사진 뷰어</option>
                </select>
              </div>

              {/* Show Filename Overlay on Cards */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-surface-hover)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>카드 파일명/해상도 뱃지 표시</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>썸네일 위에 파일 정보 오버레이 표시 조건</div>
                </div>
                <select
                  value={settings.showFilenameOnCards}
                  onChange={(e) => onUpdateSettings({ showFilenameOnCards: e.target.value as any })}
                  style={{
                    padding: '6px 10px',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                >
                  <option value="hover">마우스 호버 시에만 표시 (기본)</option>
                  <option value="always">항상 표시</option>
                  <option value="never">표시 안 함</option>
                </select>
              </div>

              {/* Real-Time Auto Refresh Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-surface-hover)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>실시간 자동 새로고침 (Auto-Refresh)</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>ComfyUI, 다운로드 등 새 파일 생성 시 실시간 감지</div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.enableAutoRefresh}
                    onChange={(e) => onUpdateSettings({ enableAutoRefresh: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                </label>
              </div>

              {/* Show Folders in Gallery Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-surface-hover)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>갤러리 내 하위 폴더 표시</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>현재 경로의 하위 폴더들을 갤러리 상단에 폴더 카드로 표시</div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.showFoldersInGallery}
                    onChange={(e) => onUpdateSettings({ showFoldersInGallery: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                </label>
              </div>

              {/* Confirm Delete Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-surface-hover)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>삭제 시 확인 팝업 표시</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>휴지통 이동 전 확인 대화상자 출력 여부</div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.confirmDelete}
                    onChange={(e) => onUpdateSettings({ confirmDelete: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                </label>
              </div>

              {/* Explorer Thumbnail Wheel Zoom Throttle Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-surface-hover)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>탐색기 썸네일 줌 스마트 스로틀링</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Ctrl+휠로 갤러리 썸네일 크기 조절 시 지연 제한을 두어 부드럽게 조절 (기본: 끔)</div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.explorerWheelThrottle)}
                    onChange={(e) => onUpdateSettings({ explorerWheelThrottle: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                </label>
              </div>

              {/* QuickLook Wheel Throttle Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-surface-hover)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>퀵룩 휠 이미지 탐색 스마트 스로틀링</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Alt/Ctrl+휠로 사진 탐색 시 120ms 지연 제한을 두어 오버스크롤 방지 (기본: 끔)</div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.quickLookWheelThrottle)}
                    onChange={(e) => onUpdateSettings({ quickLookWheelThrottle: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                </label>
              </div>
            </>
          )}

          {/* TAB 4: Data & Reset */}
          {activeTab === 'data' && (
            <>
              {/* Bookmark Statistics Card */}
              <div style={{ padding: '14px', background: 'var(--bg-surface-hover)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>
                  저장된 북마크 현황
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>북마크된 폴더</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#fbbf24', marginTop: '2px' }}>{bookmarkCounts.folders}개</div>
                  </div>
                  <div style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>북마크된 이미지</div>
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
              <div style={{ padding: '14px', background: 'var(--bg-surface-hover)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  환경설정 기본값 복원
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', marginBottom: '10px' }}>
                  레이아웃, 썸네일 크기, 정렬 방식, 단축키 등의 모든 옵션을 초기 권장 상태로 복원합니다.
                </div>
                <button
                  onClick={handleReset}
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
          )}

          {/* TAB 5: About & Open-Source Credits */}
          {activeTab === 'about' && (
            <>
              {/* App Identity Banner */}
              <div style={{ 
                padding: '16px', 
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.08) 100%)', 
                borderRadius: '12px', 
                border: '1px solid rgba(99, 102, 241, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
              }}>
                <div style={{ 
                  width: '52px', 
                  height: '52px', 
                  borderRadius: '12px', 
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)',
                  flexShrink: 0,
                  color: '#ffffff'
                }}>
                  <Sparkles size={28} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                      ViewView (뷰뷰)
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'var(--accent)', color: '#ffffff' }}>
                      v1.0.0 Release
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      MIT License
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                    초고속 무손실(Zero-Crop) 레이아웃 엔진과 60FPS 몰입형 퀵룩 뷰어를 갖춘 오픈소스 데스크톱 이미지 익스플로러
                  </div>
                </div>
              </div>

              {/* GitHub Repository Quick Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  onClick={() => handleOpenLink('https://github.com/5drake/ViewView')}
                  style={{
                    padding: '12px 14px',
                    background: 'var(--bg-surface-hover)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <GithubIcon size={20} color="var(--text-primary)" />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>GitHub 저장소</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>소스코드 및 릴리즈 보기</div>
                    </div>
                  </div>
                  <ExternalLink size={14} color="var(--text-muted)" />
                </button>

                <button
                  onClick={() => handleOpenLink('https://github.com/5drake/ViewView/issues')}
                  style={{
                    padding: '12px 14px',
                    background: 'var(--bg-surface-hover)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Code2 size={20} color="var(--accent)" />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>이슈 & 기능 제안</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>버그 제보 및 피드백</div>
                    </div>
                  </div>
                  <ExternalLink size={14} color="var(--text-muted)" />
                </button>
              </div>

              {/* Core Technologies & Architecture */}
              <div style={{ padding: '14px', background: 'var(--bg-surface-hover)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu size={14} color="var(--accent)" />
                  <span>주요 아키텍처 및 핵심 기술</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ fontSize: '11px', padding: '8px 10px', background: 'var(--bg-surface)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>⚡ Zero-Crop Justified Engine</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>원본 비율 100% 무손실 동적 갤러리 계산</div>
                  </div>
                  <div style={{ fontSize: '11px', padding: '8px 10px', background: 'var(--bg-surface)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>🔍 60FPS QuickLook Viewer</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>커서 앵커 줌(최대 30x) & 드래그 팬</div>
                  </div>
                  <div style={{ fontSize: '11px', padding: '8px 10px', background: 'var(--bg-surface)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>📦 Storage Vaults & Cloner</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>단축키 원본 복제 & 중복 파일명 회피</div>
                  </div>
                  <div style={{ fontSize: '11px', padding: '8px 10px', background: 'var(--bg-surface)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>🎨 EXIF & AI Metadata Parser</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>프롬프트/시드 파싱 & 주요 색상 팔레트</div>
                  </div>
                </div>
              </div>

              {/* Open-Source Dependencies Credits */}
              <div style={{ padding: '14px', background: 'var(--bg-surface-hover)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={14} color="var(--accent)" />
                  <span>오픈소스 라이브러리 및 크레딧</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { name: 'Electron', author: 'OpenJS Foundation', license: 'MIT License', desc: 'Cross-platform desktop application framework' },
                    { name: 'React 19 & TypeScript', author: 'Meta & Microsoft', license: 'MIT / Apache-2.0', desc: 'Type-safe reactive component UI library' },
                    { name: 'Vite', author: 'Evan You & Vite Contributors', license: 'MIT License', desc: 'Next generation ultra-fast frontend tooling' },
                    { name: 'Lucide Icons', author: 'Lucide Project', license: 'ISC License', desc: 'Beautiful & consistent pixel-perfect icon set' },
                    { name: 'exifr', author: 'Mike Kovarik', license: 'MIT License', desc: 'Comprehensive fast image metadata parser' },
                  ].map((dep) => (
                    <div 
                      key={dep.name} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '6px 8px', 
                        background: 'var(--bg-surface)', 
                        borderRadius: '6px', 
                        border: '1px solid var(--border-subtle)',
                        fontSize: '11px'
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{dep.name}</span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: '6px', fontSize: '10px' }}>({dep.author})</span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: '10px', background: 'var(--accent-light)', padding: '1px 6px', borderRadius: '4px' }}>
                        {dep.license}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* License Notice */}
              <div style={{ 
                textAlign: 'center', 
                padding: '12px 10px', 
                fontSize: '11px', 
                color: 'var(--text-muted)', 
                lineHeight: '1.6',
                background: 'var(--bg-surface)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  <ShieldCheck size={14} color="#10b981" />
                  <span>Free and Open Source Software under MIT License</span>
                </div>
                <div>Copyright © 2026 5drake. Built with ❤️ for image creators and power users.</div>
              </div>
            </>
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
