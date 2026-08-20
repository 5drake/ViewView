import { useState, useCallback, useEffect } from 'react';
import { AppSettings, KeybindingsConfig } from '../types';
import { normalizeKeybindingPair } from '../utils/keyboard';

export const DEFAULT_KEYBINDINGS: KeybindingsConfig = {
  quickLook: { primary: 'Space', secondary: '' },
  openDefault: { primary: 'Enter', secondary: '' },
  toggleBookmark: { primary: 'B', secondary: 'F' },
  toggleSidebar: { primary: 'Ctrl+B', secondary: '' },
  toggleInspector: { primary: 'Ctrl+I', secondary: '' },
  openSettings: { primary: 'Ctrl+,', secondary: '' },
  deleteSelection: { primary: 'Delete', secondary: 'D' },
  navigateBack: { primary: 'Backspace', secondary: 'Alt+ArrowLeft' },
  navigateForward: { primary: 'Alt+ArrowRight', secondary: '' },
  navigateUp: { primary: 'Alt+ArrowUp', secondary: '' },
};

export const DEFAULT_SETTINGS: AppSettings = {
  defaultLayout: 'justified',
  defaultThumbnailSize: 240,
  defaultGap: 8,
  defaultSortField: 'date',
  defaultSortDirection: 'desc',
  doubleClickAction: 'quicklook',
  showFilenameOnCards: 'hover',
  showFoldersInGallery: true,
  enableAutoRefresh: true,
  confirmDelete: false,
  explorerWheelThrottle: false,
  quickLookWheelThrottle: false,
  keybindings: DEFAULT_KEYBINDINGS,
};

function normalizeLoadedSettings(loaded: any): AppSettings {
  if (!loaded) return DEFAULT_SETTINGS;
  const base: AppSettings = { ...DEFAULT_SETTINGS, ...loaded };
  base.explorerWheelThrottle = typeof loaded?.explorerWheelThrottle === 'boolean' ? loaded.explorerWheelThrottle : false;
  base.quickLookWheelThrottle = typeof loaded?.quickLookWheelThrottle === 'boolean' ? loaded.quickLookWheelThrottle : false;
  const rawKb = loaded?.keybindings || {};

  base.keybindings = {
    quickLook: normalizeKeybindingPair(rawKb.quickLook, DEFAULT_KEYBINDINGS.quickLook.primary, DEFAULT_KEYBINDINGS.quickLook.secondary),
    openDefault: normalizeKeybindingPair(rawKb.openDefault, DEFAULT_KEYBINDINGS.openDefault.primary, DEFAULT_KEYBINDINGS.openDefault.secondary),
    toggleBookmark: normalizeKeybindingPair(rawKb.toggleBookmark, DEFAULT_KEYBINDINGS.toggleBookmark.primary, DEFAULT_KEYBINDINGS.toggleBookmark.secondary),
    toggleSidebar: normalizeKeybindingPair(rawKb.toggleSidebar, DEFAULT_KEYBINDINGS.toggleSidebar.primary, DEFAULT_KEYBINDINGS.toggleSidebar.secondary),
    toggleInspector: normalizeKeybindingPair(rawKb.toggleInspector, DEFAULT_KEYBINDINGS.toggleInspector.primary, DEFAULT_KEYBINDINGS.toggleInspector.secondary),
    openSettings: normalizeKeybindingPair(rawKb.openSettings, DEFAULT_KEYBINDINGS.openSettings.primary, DEFAULT_KEYBINDINGS.openSettings.secondary),
    deleteSelection: normalizeKeybindingPair(rawKb.deleteSelection, DEFAULT_KEYBINDINGS.deleteSelection.primary, DEFAULT_KEYBINDINGS.deleteSelection.secondary),
    navigateBack: normalizeKeybindingPair(rawKb.navigateBack, DEFAULT_KEYBINDINGS.navigateBack.primary, DEFAULT_KEYBINDINGS.navigateBack.secondary),
    navigateForward: normalizeKeybindingPair(rawKb.navigateForward, DEFAULT_KEYBINDINGS.navigateForward.primary, DEFAULT_KEYBINDINGS.navigateForward.secondary),
    navigateUp: normalizeKeybindingPair(rawKb.navigateUp, DEFAULT_KEYBINDINGS.navigateUp.primary, DEFAULT_KEYBINDINGS.navigateUp.secondary),
  };

  return base;
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('viewview-app-settings');
      if (saved) {
        return normalizeLoadedSettings(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load settings from localStorage:', e);
    }
    return DEFAULT_SETTINGS;
  });

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('viewview-app-settings', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save settings to localStorage:', e);
      }
      return updated;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.setItem('viewview-app-settings', JSON.stringify(DEFAULT_SETTINGS));
    } catch (e) {
      console.error('Failed to reset settings:', e);
    }
  }, []);

  return {
    settings,
    updateSettings,
    resetSettings,
  };
}
