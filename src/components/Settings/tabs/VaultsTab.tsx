import React from 'react';
import { AppSettings, StorageVault, KeybindingsConfig, ToastType } from '../../../types';
import { DEFAULT_KEYBINDINGS } from '../../../hooks/useSettings';
import { Package, Plus, Trash2, Keyboard, RotateCcw } from 'lucide-react';
import KeyRecorderInput from '../KeyRecorderInput';
import { MUTED_HINT_STYLE } from './tabStyles';

// "1차:" / "2차:" label in front of a recorder (identical literal duplicated)
const KEY_SLOT_LABEL_STYLE: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--text-muted)',
};

interface VaultsTabProps {
  settings: AppSettings;
  vaults: StorageVault[];
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onAddVault: (path: string, name?: string, shortcutKey?: string, secondaryKey?: string) => Promise<any>;
  onRemoveVault: (id: string) => void;
  onUpdateVault: (id: string, updates: Partial<StorageVault>) => void;
  onShowToast?: (message: string, type?: ToastType) => void;
}

export const VaultsTab: React.FC<VaultsTabProps> = ({
  settings,
  vaults,
  onUpdateSettings,
  onAddVault,
  onRemoveVault,
  onUpdateVault,
  onShowToast,
}) => {
  const currentKeybindings = settings.keybindings || DEFAULT_KEYBINDINGS;

  // Every shortcut string currently assigned anywhere (global actions + vault
  // primary/secondary slots). The recorders compare against this registry to
  // detect duplicates with OTHER slots; each recorder's own current value is
  // filtered out so re-recording the same key into the same slot stays legal.
  const allAssignedKeys: string[] = [];
  Object.values(currentKeybindings).forEach((pair) => {
    if (pair.primary) allAssignedKeys.push(pair.primary);
    if (pair.secondary) allAssignedKeys.push(pair.secondary);
  });
  vaults.forEach((vault) => {
    if (vault.shortcutKey) allAssignedKeys.push(vault.shortcutKey);
    if (vault.secondaryKey) allAssignedKeys.push(vault.secondaryKey);
  });

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

  return (
    <>
      {/* Storage Vaults Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Package size={15} color="#818cf8" />
              <span>보관함 (Storage Vaults) 설정</span>
            </div>
            <div style={MUTED_HINT_STYLE}>
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
                    <span style={KEY_SLOT_LABEL_STYLE}>1차:</span>
                    <KeyRecorderInput
                      value={vault.shortcutKey}
                      takenKeys={allAssignedKeys.filter((k) => k !== vault.shortcutKey)}
                      onChange={(newKey) => onUpdateVault(vault.id, { shortcutKey: newKey })}
                      placeholder="미지정"
                      canClear={true}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={KEY_SLOT_LABEL_STYLE}>2차:</span>
                    <KeyRecorderInput
                      value={vault.secondaryKey}
                      takenKeys={allAssignedKeys.filter((k) => k !== vault.secondaryKey)}
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
            <div style={MUTED_HINT_STYLE}>
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
            { key: 'zoomIn', label: '썸네일 확대' },
            { key: 'zoomOut', label: '썸네일 축소' },
            { key: 'zoomReset', label: '썸네일 크기 초기화' },
            { key: 'cycleLayout', label: '레이아웃 순환 전환 (저스티파이드→메이슨리→그리드)' },
            { key: 'copyImage', label: '이미지 클립보드 복사' },
            { key: 'copyPath', label: '파일 경로 복사' },
            { key: 'showInExplorer', label: '탐색기에서 표시' },
            { key: 'selectAll', label: '전체 선택' },
            { key: 'clearSelection', label: '선택 해제' },
            { key: 'refresh', label: '새로고침' },
            { key: 'qlNext', label: '퀵룩: 다음 이미지' },
            { key: 'qlPrev', label: '퀵룩: 이전 이미지' },
            { key: 'qlZoomIn', label: '퀵룩: 뷰 확대' },
            { key: 'qlZoomOut', label: '퀵룩: 뷰 축소' },
            { key: 'qlZoomReset', label: '퀵룩: 배율 초기화' },
            { key: 'qlToggleInfo', label: '퀵룩: 메타데이터 패널 토글' },
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
                    takenKeys={allAssignedKeys.filter((k) => k !== pair.primary)}
                    onChange={(newKey) => handleUpdateKeybinding(item.key as any, 'primary', newKey)}
                    placeholder="미지정"
                    canClear={true}
                  />

                  <KeyRecorderInput
                    value={pair.secondary}
                    takenKeys={allAssignedKeys.filter((k) => k !== pair.secondary)}
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
  );
};

export default VaultsTab;
