import { useState, useCallback, useEffect } from 'react';
import { StorageVault, ToastType } from '../types';

const DEFAULT_VAULTS: StorageVault[] = [];

// Palette of colors for vaults
export const VAULT_COLORS = [
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#8b5cf6', // Purple
  '#f43f5e', // Rose
  '#3b82f6', // Blue
];

export function useVaults(showToastProp?: (message: string, type?: ToastType) => void) {
  const [vaults, setVaults] = useState<StorageVault[]>(() => {
    try {
      const saved = localStorage.getItem('viewview-vaults');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load vaults from localStorage:', e);
    }
    return DEFAULT_VAULTS;
  });

  const showToast = useCallback((message: string, type: ToastType = 'vault') => {
    showToastProp?.(message, type);
  }, [showToastProp]);

  // Save to localStorage whenever vaults change
  useEffect(() => {
    try {
      localStorage.setItem('viewview-vaults', JSON.stringify(vaults));
    } catch (e) {
      console.error('Failed to save vaults to localStorage:', e);
    }
  }, [vaults]);

  // Pick next unused shortcut digit ('1', '2', '3'...)
  const getNextShortcutKey = useCallback(() => {
    const usedKeys = new Set(vaults.map((v) => v.shortcutKey.toLowerCase()));
    for (let i = 1; i <= 9; i++) {
      if (!usedKeys.has(String(i))) {
        return String(i);
      }
    }
    return '';
  }, [vaults]);

  const addVault = useCallback(async (dirPath: string, customName?: string, customShortcut?: string, customSecondary?: string) => {
    if (!dirPath) return null;
    
    // Check if already registered
    const normalized = dirPath.replace(/\\/g, '/').toLowerCase();
    const existing = vaults.find((v) => v.path.replace(/\\/g, '/').toLowerCase() === normalized);
    if (existing) {
      showToast(`이미 '${existing.name}'(으)로 등록된 보관함입니다.`, 'info');
      return existing;
    }

    const baseName = customName || dirPath.split(/[\\/]/).filter(Boolean).pop() || '새 보관함';
    const color = VAULT_COLORS[vaults.length % VAULT_COLORS.length];
    const shortcut = customShortcut !== undefined ? customShortcut : getNextShortcutKey();

    const newVault: StorageVault = {
      id: 'vault_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: baseName,
      path: dirPath,
      shortcutKey: shortcut,
      secondaryKey: customSecondary || '',
      color,
      createdAt: Date.now(),
    };

    setVaults((prev) => [...prev, newVault]);
    showToast(`'${newVault.name}' 보관함이 등록되었습니다. ${shortcut ? `(단축키: [${shortcut}])` : ''}`, 'vault');
    return newVault;
  }, [vaults, getNextShortcutKey, showToast]);

  const removeVault = useCallback((vaultId: string) => {
    setVaults((prev) => {
      const target = prev.find((v) => v.id === vaultId);
      if (target) {
        showToast(`'${target.name}' 보관함 등록이 해제되었습니다.`, 'info');
      }
      return prev.filter((v) => v.id !== vaultId);
    });
  }, [showToast]);

  const updateVault = useCallback((vaultId: string, updates: Partial<StorageVault>) => {
    setVaults((prev) =>
      prev.map((v) => (v.id === vaultId ? { ...v, ...updates } : v))
    );
  }, []);

  const sendToVault = useCallback(async (vaultId: string, filePaths: string[]) => {
    const vault = vaults.find((v) => v.id === vaultId);
    if (!vault) return;
    if (!filePaths || filePaths.length === 0) {
      showToast('복사할 이미지가 선택되지 않았습니다.', 'info');
      return;
    }

    if (!window.electronAPI?.copyFilesToVault) {
      showToast('Electron 환경이 아닙니다.', 'error');
      return;
    }

    try {
      const res = await window.electronAPI.copyFilesToVault({
        sourcePaths: filePaths,
        targetDir: vault.path,
      });

      if (res && res.success) {
        const skipped = res.skippedCount ? ` (${res.skippedCount}개는 이미 보관함에 있어 건너뜀)` : '';
        showToast(`${res.copiedCount}개 이미지가 [${vault.name}] 보관함으로 복사되었습니다.${skipped}`, 'vault');
      } else {
        showToast(`보관함 복사 실패: ${res?.error || '알 수 없는 오류'}`, 'error');
      }
    } catch (err: any) {
      showToast(`보관함 복사 중 오류 발생: ${err.message}`, 'error');
    }
  }, [vaults, showToast]);

  // Quick send by matching shortcut key
  const sendToVaultByShortcut = useCallback((key: string, filePaths: string[]) => {
    const k = key.toLowerCase();
    const matching = vaults.find(
      (v) => v.shortcutKey.toLowerCase() === k || (v.secondaryKey && v.secondaryKey.toLowerCase() === k)
    );
    if (matching) {
      sendToVault(matching.id, filePaths);
      return true;
    }
    return false;
  }, [vaults, sendToVault]);

  return {
    vaults,
    addVault,
    removeVault,
    updateVault,
    sendToVault,
    sendToVaultByShortcut,
    showToast,
  };
}
