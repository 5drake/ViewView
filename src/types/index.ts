export type LayoutMode = 'justified' | 'masonry' | 'grid';
export type ThemeMode = 'dark' | 'light';

export type SortField = 'name' | 'date' | 'size' | 'width' | 'height' | 'type';
export type SortDirection = 'asc' | 'desc';

export interface ImageItem {
  id: string;
  name: string;
  path: string;
  dir: string;
  size: number;
  extension: string;
  createdAt: number;
  modifiedAt: number;
  width: number;
  height: number;
  aspectRatio: number; // width / height
  url: string; // file:// or custom media://
  isBookmarked?: boolean;
  isFavorite?: boolean;
  rating?: number; // 0-5
}

export interface FolderBookmark {
  path: string;
  name: string;
  addedAt: number;
}

export interface FolderItem {
  name: string;
  path: string;
  hasChildren: boolean;
  imageCount?: number;
}

export interface DriveInfo {
  name: string;
  path: string;
  label?: string;
  isRemovable?: boolean;
}

export interface ExifData {
  make?: string;
  model?: string;
  lens?: string;
  focalLength?: number | string;
  fNumber?: number | string;
  exposureTime?: number | string;
  iso?: number;
  dateTimeOriginal?: string;
  width?: number;
  height?: number;
  colorSpace?: string;
  software?: string;
  latitude?: number;
  longitude?: number;
  aiGenerator?: string;
  aiPrompt?: string;
  aiCharacterPrompt?: string;
  aiNegativePrompt?: string;
  aiSeed?: string;
  aiSampler?: string;
  aiModel?: string;
  aiSteps?: string;
  aiCfg?: string;
  aiNoiseSchedule?: string;
  aiSmea?: string;
  aiClipSkip?: string;
}

export interface ColorPaletteItem {
  hex: string;
  rgb: [number, number, number];
  percent: number;
}

export type SearchMode = 'name' | 'prompt' | 'all';

export interface PromptIndexItem {
  prompt: string;
  characterPrompt?: string;
  negativePrompt?: string;
  model?: string;
  sampler?: string;
  generator?: string;
}

export interface FilterOptions {
  searchQuery: string;
  searchMode?: SearchMode;
  extensions: string[];
  minWidth?: number;
  minHeight?: number;
  minRating?: number;
  orientation?: 'all' | 'landscape' | 'portrait' | 'square';
}

export type ToastType = 'info' | 'success' | 'warning' | 'error' | 'vault' | 'bookmark' | 'trash' | 'copy';

export interface ToastMessage {
  id: string;
  type?: ToastType;
  message: string;
  duration?: number;
}

export interface StorageVault {
  id: string;
  name: string;
  path: string;
  shortcutKey: string; // 1차 단축키 (Primary key, e.g. '1')
  secondaryKey?: string; // 2차 단축키 (Secondary key, e.g. 'Q')
  color?: string;
  createdAt: number;
}

export interface KeybindingPair {
  primary: string;
  secondary?: string;
}

export interface KeybindingsConfig {
  quickLook: KeybindingPair;       // Default: { primary: 'Space', secondary: '' }
  openDefault: KeybindingPair;     // Default: { primary: 'Enter', secondary: '' }
  toggleBookmark: KeybindingPair;  // Default: { primary: 'B', secondary: 'F' }
  toggleSidebar: KeybindingPair;   // Default: { primary: 'Ctrl+B', secondary: '' }
  toggleInspector: KeybindingPair; // Default: { primary: 'Ctrl+I', secondary: '' }
  openSettings: KeybindingPair;    // Default: { primary: 'Ctrl+,', secondary: '' }
  deleteSelection: KeybindingPair; // Default: { primary: 'Delete', secondary: 'D' }
  navigateBack: KeybindingPair;    // Default: { primary: 'Backspace', secondary: 'Alt+ArrowLeft' }
  navigateForward: KeybindingPair; // Default: { primary: 'Alt+ArrowRight', secondary: '' }
  navigateUp: KeybindingPair;      // Default: { primary: 'Alt+ArrowUp', secondary: '' }
}

export interface AppSettings {
  defaultLayout: LayoutMode;
  defaultThumbnailSize: number;
  defaultGap: number;
  defaultSortField: SortField;
  defaultSortDirection: SortDirection;
  doubleClickAction: 'quicklook' | 'defaultViewer';
  showFilenameOnCards: 'hover' | 'always' | 'never';
  showFoldersInGallery: boolean;
  enableAutoRefresh: boolean;
  confirmDelete: boolean;
  explorerWheelThrottle: boolean;
  quickLookWheelThrottle: boolean;
  keybindings: KeybindingsConfig;
}
