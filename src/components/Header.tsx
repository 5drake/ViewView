import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ArrowUp, 
  FolderOpen, 
  LayoutGrid, 
  Columns3, 
  Rows3, 
  Maximize2, 
  SlidersHorizontal, 
  Sun, 
  Moon, 
  Star,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  Settings,
  Search,
  X,
  Sparkles,
  Loader2
} from 'lucide-react';
import { LayoutMode, SortField, SortDirection, ThemeMode, SearchMode } from '../types';

interface HeaderProps {
  currentPath: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onGoUp: () => void;
  onOpenFolderDialog: () => void;
  onNavigateTo: (path: string) => void;
  isFolderBookmarked?: boolean;
  onToggleFolderBookmark?: () => void;
  showSidebar: boolean;
  onToggleSidebar: () => void;
  showInspector: boolean;
  onToggleInspector: () => void;
  onOpenSettings?: () => void;
  layoutMode: LayoutMode;
  onLayoutModeChange: (mode: LayoutMode) => void;
  thumbnailSize: number;
  onThumbnailSizeChange: (size: number) => void;
  gap: number;
  onGapChange: (gap: number) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, dir: SortDirection) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchMode: SearchMode;
  onSearchModeChange: (mode: SearchMode) => void;
  isIndexing?: boolean;
  indexedCount?: number;
  totalImageCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentPath,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  onGoUp,
  onOpenFolderDialog,
  onNavigateTo,
  isFolderBookmarked,
  onToggleFolderBookmark,
  showSidebar,
  onToggleSidebar,
  showInspector,
  onToggleInspector,
  onOpenSettings,
  layoutMode,
  onLayoutModeChange,
  thumbnailSize,
  onThumbnailSizeChange,
  gap,
  onGapChange,
  sortField,
  sortDirection,
  onSortChange,
  theme,
  onToggleTheme,
  searchQuery,
  onSearchQueryChange,
  searchMode,
  onSearchModeChange,
  isIndexing = false,
  indexedCount = 0,
  totalImageCount = 0,
}) => {
  // Split path into breadcrumbs
  const pathParts = React.useMemo(() => {
    if (!currentPath || currentPath === 'bookmarks://images') return [];
    const normalized = currentPath.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);
    
    return segments.map((seg, idx) => {
      let accumulated = segments.slice(0, idx + 1).join('/');
      if (currentPath.includes('\\')) {
        accumulated = accumulated.replace(/\//g, '\\');
        if (idx === 0 && accumulated.endsWith(':')) {
          accumulated += '\\';
        }
      }
      return { name: seg, path: accumulated };
    });
  }, [currentPath]);

  const breadcrumbBarRef = React.useRef<HTMLDivElement>(null);

  // Automatically scroll breadcrumbs to the right so the active folder is always in view
  React.useEffect(() => {
    if (breadcrumbBarRef.current) {
      breadcrumbBarRef.current.scrollLeft = breadcrumbBarRef.current.scrollWidth;
    }
  }, [currentPath]);

  return (
    <header className="app-header">
      {/* Left: Navigation & Breadcrumbs */}
      <div className="header-left">
        {/* Toggle Left Sidebar Button */}
        <button 
          className={`nav-btn ${showSidebar ? 'active' : ''}`} 
          onClick={onToggleSidebar} 
          title={showSidebar ? '사이드바 접기 (Ctrl+B)' : '사이드바 펼치기 (Ctrl+B)'}
          style={{ marginRight: '2px' }}
        >
          {showSidebar ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
        </button>

        {/* Back Button */}
        <button 
          className="nav-btn" 
          onClick={onGoBack} 
          disabled={!canGoBack}
          title="뒤로 가기 (Alt+← / 마우스 4번 버튼)"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Forward Button */}
        <button 
          className="nav-btn" 
          onClick={onGoForward} 
          disabled={!canGoForward}
          title="앞으로 가기 (Alt+→ / 마우스 5번 버튼)"
        >
          <ChevronRight size={16} />
        </button>

        {/* Up to Parent Directory Button */}
        <button 
          className="nav-btn" 
          onClick={onGoUp} 
          disabled={!currentPath || currentPath === 'bookmarks://images'}
          title="상위 폴더로 이동 (Alt+↑ / Backspace)"
        >
          <ArrowUp size={16} />
        </button>

        {/* Open Folder System Dialog Button */}
        <button 
          className="nav-btn" 
          onClick={onOpenFolderDialog} 
          title="폴더 열기 (Ctrl+O)"
          style={{ background: 'var(--accent-light)', borderColor: 'var(--accent)', color: 'var(--accent)' }}
        >
          <FolderOpen size={16} />
        </button>

        {/* Bookmark Current Folder Button */}
        {currentPath && currentPath !== 'bookmarks://images' && onToggleFolderBookmark && (
          <button
            className={`nav-btn ${isFolderBookmarked ? 'active' : ''}`}
            onClick={onToggleFolderBookmark}
            title={isFolderBookmarked ? '현재 폴더 북마크 해제' : '현재 폴더를 즐겨찾기 북마크에 추가'}
            style={{ color: isFolderBookmarked ? '#fbbf24' : 'var(--text-muted)' }}
          >
            <Star size={16} fill={isFolderBookmarked ? '#fbbf24' : 'none'} />
          </button>
        )}

        {/* Breadcrumb Path Bar */}
        <div className="breadcrumb-bar" ref={breadcrumbBarRef}>
          {currentPath === 'bookmarks://images' ? (
            <span className="breadcrumb-item current" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Star size={13} color="#fbbf24" fill="#fbbf24" />
              <span>북마크된 이미지</span>
            </span>
          ) : pathParts.length === 0 ? (
            <span className="breadcrumb-item current">내 PC</span>
          ) : (
            pathParts.map((part, index) => {
              const isLast = index === pathParts.length - 1;
              return (
                <React.Fragment key={part.path}>
                  <span 
                    className={`breadcrumb-item ${isLast ? 'current' : ''}`}
                    onClick={() => onNavigateTo(part.path)}
                    title={part.path}
                  >
                    {part.name}
                  </span>
                  {!isLast && (
                    <span className="breadcrumb-separator">/</span>
                  )}
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>

      {/* Center: Search Bar with Mode Toggle */}
      <div className="header-search-container">
        <div className="search-mode-pill">
          <button
            className={`search-mode-btn ${searchMode === 'all' ? 'active' : ''}`}
            onClick={() => onSearchModeChange('all')}
            title="파일명 + AI 프롬프트 통합 검색 (기본값)"
          >
            <span>통합</span>
          </button>
          <button
            className={`search-mode-btn ${searchMode === 'prompt' ? 'active' : ''}`}
            onClick={() => onSearchModeChange('prompt')}
            title="AI 생성 프롬프트 및 메타데이터로 검색"
          >
            <Sparkles size={11} color={searchMode === 'prompt' ? '#c084fc' : 'currentColor'} />
            <span>AI 프롬프트</span>
          </button>
          <button
            className={`search-mode-btn ${searchMode === 'name' ? 'active' : ''}`}
            onClick={() => onSearchModeChange('name')}
            title="파일명으로만 검색"
          >
            <FolderOpen size={11} />
            <span>파일명</span>
          </button>
        </div>

        <div className="search-input-wrapper">
          <Search size={13} className="search-icon" />
          <input
            type="text"
            className="search-input"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={
              searchMode === 'prompt'
                ? 'AI 프롬프트 검색 (e.g. 1girl, blond, smile)...'
                : searchMode === 'all'
                ? '파일명 또는 프롬프트 검색...'
                : '파일명 검색...'
            }
          />
          {searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => onSearchQueryChange('')}
              title="검색어 지우기"
            >
              <X size={12} />
            </button>
          )}
          {isIndexing && (
            <span
              className="search-indexing-badge"
              title={`프롬프트 인덱싱 진행 중 (${indexedCount}/${totalImageCount})`}
            >
              <Loader2 size={11} className="spin-icon" />
              <span>{Math.round(((indexedCount || 0) / Math.max(1, totalImageCount || 1)) * 100)}%</span>
            </span>
          )}
        </div>
      </div>

      {/* Right: Settings, Layout Switcher, Sliders, Sort, Theme, Inspector Toggle */}
      <div className="header-right">
        {/* Settings & Options Button (Placed to the Left of Grid/Layout selector) */}
        {onOpenSettings && (
          <button
            className="nav-btn"
            onClick={onOpenSettings}
            title="환경설정 및 옵션 (Settings)"
            style={{ width: '32px', height: '32px', padding: 0 }}
          >
            <Settings size={15} />
          </button>
        )}

        {/* Layout Mode Segmented Button (Clean Icons Only) */}
        <div className="segmented-control">
          <button 
            className={`segment-btn ${layoutMode === 'justified' ? 'active' : ''}`}
            onClick={() => onLayoutModeChange('justified')}
            title="저스티파이드 (원본비율 무크롭)"
          >
            <Rows3 size={15} />
          </button>
          <button 
            className={`segment-btn ${layoutMode === 'masonry' ? 'active' : ''}`}
            onClick={() => onLayoutModeChange('masonry')}
            title="메이슨리 (핀터레스트형)"
          >
            <Columns3 size={15} />
          </button>
          <button 
            className={`segment-btn ${layoutMode === 'grid' ? 'active' : ''}`}
            onClick={() => onLayoutModeChange('grid')}
            title="스퀘어 그리드 (1:1 격자)"
          >
            <LayoutGrid size={15} />
          </button>
        </div>

        {/* Thumbnail Size Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }} title={`썸네일 크기: ${thumbnailSize}px (Ctrl + 마우스 휠)`}>
          <Maximize2 size={13} color="var(--text-muted)" />
          <input
            type="range"
            min={80}
            max={800}
            step={10}
            value={thumbnailSize}
            onChange={(e) => onThumbnailSizeChange(Number(e.target.value))}
            className="custom-range"
            style={{ width: '65px' }}
          />
        </div>

        {/* Gap Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }} title={`간격: ${gap}px`}>
          <SlidersHorizontal size={13} color="var(--text-muted)" />
          <input
            type="range"
            min={0}
            max={24}
            step={2}
            value={gap}
            onChange={(e) => onGapChange(Number(e.target.value))}
            className="custom-range"
            style={{ width: '55px' }}
          />
        </div>

        {/* Sort Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <select 
            value={`${sortField}-${sortDirection}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split('-');
              onSortChange(field as SortField, dir as SortDirection);
            }}
            style={{
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '5px 8px',
              fontSize: '12px',
              cursor: 'pointer',
              outline: 'none',
              flexShrink: 0,
            }}
          >
            <option value="date-desc">최신 수정일순</option>
            <option value="date-asc">오래된 수정일순</option>
            <option value="name-asc">이름 (A-Z)</option>
            <option value="name-desc">이름 (Z-A)</option>
            <option value="size-desc">용량 큰 순</option>
            <option value="size-asc">용량 작은 순</option>
            <option value="width-desc">해상도 높은 순</option>
            <option value="type-asc">확장자 형식순</option>
          </select>
        </div>

        {/* Theme Toggle (Dark / Light) */}
        <button
          className="nav-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? '밝은 테마(라이트 모드)로 전환' : '어두운 테마(다크 모드)로 전환'}
          style={{ width: '32px', height: '32px', padding: 0 }}
        >
          {theme === 'dark' ? (
            <Sun size={16} color="#fbbf24" style={{ filter: 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.4))' }} />
          ) : (
            <Moon size={16} color="var(--accent)" />
          )}
        </button>

        {/* Toggle Right Inspector Button */}
        <button
          className={`nav-btn ${showInspector ? 'active' : ''}`}
          onClick={onToggleInspector}
          title={showInspector ? '정보 패널 접기 (Ctrl+I)' : '정보 패널 펼치기 (Ctrl+I)'}
          style={{ width: '32px', height: '32px', padding: 0 }}
        >
          {showInspector ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
        </button>
      </div>
    </header>
  );
};
