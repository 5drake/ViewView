import { useState, useCallback, useEffect } from 'react';
import { AppSettings, KeybindingsConfig, ThumbnailPlaceholder } from '../types';
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
  zoomIn: { primary: '=', secondary: '+' },
  zoomOut: { primary: '-', secondary: '' },
  zoomReset: { primary: '0', secondary: '' },
  cycleLayout: { primary: 'L', secondary: '' },
  copyImage: { primary: 'Ctrl+C', secondary: '' },
  copyPath: { primary: 'Shift+P', secondary: '' },
  showInExplorer: { primary: 'Shift+E', secondary: '' },
  selectAll: { primary: 'Ctrl+A', secondary: '' },
  clearSelection: { primary: 'Escape', secondary: '' },
  refresh: { primary: 'F5', secondary: '' },
  qlNext: { primary: 'ArrowRight', secondary: 'PageDown' },
  qlPrev: { primary: 'ArrowLeft', secondary: 'PageUp' },
  qlZoomIn: { primary: '=', secondary: '+' },
  qlZoomOut: { primary: '-', secondary: '_' },
  qlZoomReset: { primary: '0', secondary: '' },
  qlToggleInfo: { primary: 'I', secondary: 'Tab' },
};

export const DEFAULT_SETTINGS: AppSettings = {
  defaultLayout: 'justified',
  defaultThumbnailSize: 240,
  defaultGap: 8,
  defaultSortField: 'date',
  defaultSortDirection: 'desc',
  thumbnailPlaceholder: 'shimmer',
  thumbConcurrentLoads: 8,
  thumbCacheMaxMb: 192,
  thumbWarmLimit: 4000,
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
  // Whitelist-validate every field against its union/range: corrupt-but-valid
  // JSON (e.g. defaultLayout: 42) previously flowed straight into toolbar and
  // gallery state.
  base.defaultLayout = ['justified', 'masonry', 'grid'].includes(loaded?.defaultLayout)
    ? loaded.defaultLayout
    : DEFAULT_SETTINGS.defaultLayout;
  base.defaultThumbnailSize =
    typeof loaded?.defaultThumbnailSize === 'number' && Number.isFinite(loaded.defaultThumbnailSize) && loaded.defaultThumbnailSize > 0
      ? Math.min(1200, loaded.defaultThumbnailSize)
      : DEFAULT_SETTINGS.defaultThumbnailSize;
  base.defaultGap =
    typeof loaded?.defaultGap === 'number' && Number.isFinite(loaded.defaultGap) && loaded.defaultGap >= 0 && loaded.defaultGap <= 24
      ? loaded.defaultGap
      : DEFAULT_SETTINGS.defaultGap;
  base.defaultSortField = ['name', 'date', 'size', 'width', 'height', 'type'].includes(loaded?.defaultSortField)
    ? loaded.defaultSortField
    : DEFAULT_SETTINGS.defaultSortField;
  base.defaultSortDirection = loaded?.defaultSortDirection === 'asc' ? 'asc' : 'desc';
  base.thumbnailPlaceholder = (['shimmer', 'pulse', 'solid', 'none'] as ThumbnailPlaceholder[]).includes(loaded?.thumbnailPlaceholder)
    ? loaded.thumbnailPlaceholder
    : DEFAULT_SETTINGS.thumbnailPlaceholder;
  const clampInt = (v: any, min: number, max: number, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
  base.thumbConcurrentLoads = clampInt(loaded?.thumbConcurrentLoads, 1, 24, DEFAULT_SETTINGS.thumbConcurrentLoads);
  base.thumbCacheMaxMb = clampInt(loaded?.thumbCacheMaxMb, 32, 2048, DEFAULT_SETTINGS.thumbCacheMaxMb);
  base.thumbWarmLimit = clampInt(loaded?.thumbWarmLimit, 0, 50000, DEFAULT_SETTINGS.thumbWarmLimit);
  base.doubleClickAction = loaded?.doubleClickAction === 'defaultViewer' ? 'defaultViewer' : 'quicklook';
  base.showFilenameOnCards = ['hover', 'always', 'never'].includes(loaded?.showFilenameOnCards)
    ? loaded.showFilenameOnCards
    : DEFAULT_SETTINGS.showFilenameOnCards;
  base.showFoldersInGallery = typeof loaded?.showFoldersInGallery === 'boolean' ? loaded.showFoldersInGallery : true;
  base.enableAutoRefresh = typeof loaded?.enableAutoRefresh === 'boolean' ? loaded.enableAutoRefresh : true;
  base.confirmDelete = typeof loaded?.confirmDelete === 'boolean' ? loaded.confirmDelete : false;
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
    zoomIn: normalizeKeybindingPair(rawKb.zoomIn, DEFAULT_KEYBINDINGS.zoomIn.primary, DEFAULT_KEYBINDINGS.zoomIn.secondary),
    zoomOut: normalizeKeybindingPair(rawKb.zoomOut, DEFAULT_KEYBINDINGS.zoomOut.primary, DEFAULT_KEYBINDINGS.zoomOut.secondary),
    zoomReset: normalizeKeybindingPair(rawKb.zoomReset, DEFAULT_KEYBINDINGS.zoomReset.primary, DEFAULT_KEYBINDINGS.zoomReset.secondary),
    cycleLayout: normalizeKeybindingPair(rawKb.cycleLayout, DEFAULT_KEYBINDINGS.cycleLayout.primary, DEFAULT_KEYBINDINGS.cycleLayout.secondary),
    copyImage: normalizeKeybindingPair(rawKb.copyImage, DEFAULT_KEYBINDINGS.copyImage.primary, DEFAULT_KEYBINDINGS.copyImage.secondary),
    copyPath: normalizeKeybindingPair(rawKb.copyPath, DEFAULT_KEYBINDINGS.copyPath.primary, DEFAULT_KEYBINDINGS.copyPath.secondary),
    showInExplorer: normalizeKeybindingPair(rawKb.showInExplorer, DEFAULT_KEYBINDINGS.showInExplorer.primary, DEFAULT_KEYBINDINGS.showInExplorer.secondary),
    selectAll: normalizeKeybindingPair(rawKb.selectAll, DEFAULT_KEYBINDINGS.selectAll.primary, DEFAULT_KEYBINDINGS.selectAll.secondary),
    clearSelection: normalizeKeybindingPair(rawKb.clearSelection, DEFAULT_KEYBINDINGS.clearSelection.primary, DEFAULT_KEYBINDINGS.clearSelection.secondary),
    refresh: normalizeKeybindingPair(rawKb.refresh, DEFAULT_KEYBINDINGS.refresh.primary, DEFAULT_KEYBINDINGS.refresh.secondary),
    qlNext: normalizeKeybindingPair(rawKb.qlNext, DEFAULT_KEYBINDINGS.qlNext.primary, DEFAULT_KEYBINDINGS.qlNext.secondary),
    qlPrev: normalizeKeybindingPair(rawKb.qlPrev, DEFAULT_KEYBINDINGS.qlPrev.primary, DEFAULT_KEYBINDINGS.qlPrev.secondary),
    qlZoomIn: normalizeKeybindingPair(rawKb.qlZoomIn, DEFAULT_KEYBINDINGS.qlZoomIn.primary, DEFAULT_KEYBINDINGS.qlZoomIn.secondary),
    qlZoomOut: normalizeKeybindingPair(rawKb.qlZoomOut, DEFAULT_KEYBINDINGS.qlZoomOut.primary, DEFAULT_KEYBINDINGS.qlZoomOut.secondary),
    qlZoomReset: normalizeKeybindingPair(rawKb.qlZoomReset, DEFAULT_KEYBINDINGS.qlZoomReset.primary, DEFAULT_KEYBINDINGS.qlZoomReset.secondary),
    qlToggleInfo: normalizeKeybindingPair(rawKb.qlToggleInfo, DEFAULT_KEYBINDINGS.qlToggleInfo.primary, DEFAULT_KEYBINDINGS.qlToggleInfo.secondary),
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
