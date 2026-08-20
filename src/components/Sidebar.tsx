import React from 'react';
import { 
  HardDrive, 
  Folder, 
  ChevronRight, 
  ChevronDown, 
  Star, 
  Package, 
  Plus, 
  X 
} from 'lucide-react';
import { DriveInfo, FolderItem, FolderBookmark, StorageVault } from '../types';

interface SidebarProps {
  drives: DriveInfo[];
  folderBookmarks: FolderBookmark[];
  imageBookmarksCount: number;
  vaults: StorageVault[];
  currentPath: string;
  folders: FolderItem[];
  onNavigateTo: (path: string) => void;
  onRemoveFolderBookmark?: (path: string) => void;
  onAddVault?: () => void;
  onRemoveVault?: (id: string) => void;
  collapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  drives,
  folderBookmarks,
  imageBookmarksCount,
  vaults,
  currentPath,
  folders,
  onNavigateTo,
  onRemoveFolderBookmark,
  onAddVault,
  onRemoveVault,
  collapsed = false,
}) => {
  const [foldersOpen, setFoldersOpen] = React.useState<boolean>(true);
  const [bookmarksOpen, setBookmarksOpen] = React.useState<boolean>(true);
  const [vaultsOpen, setVaultsOpen] = React.useState<boolean>(true);

  const isBookmarkImagesActive = currentPath === 'bookmarks://images';

  return (
    <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Bookmarked Images & Folders Section */}
      <div style={{ marginBottom: '16px' }}>
        <div className="sidebar-section-title" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Star size={12} color="#fbbf24" fill="#fbbf24" />
          <span>즐겨찾기</span>
        </div>

        {/* Bookmarked Images Main Button */}
        <div
          className={`sidebar-item ${isBookmarkImagesActive ? 'active' : ''}`}
          onClick={() => onNavigateTo('bookmarks://images')}
          style={{ fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
            <span className="sidebar-item-icon">
              <Star size={15} color="#fbbf24" fill={isBookmarkImagesActive ? '#fbbf24' : 'transparent'} />
            </span>
            <span>북마크된 이미지</span>
          </div>
          {imageBookmarksCount > 0 && (
            <span className="sidebar-count-badge">
              {imageBookmarksCount}
            </span>
          )}
        </div>
      </div>

      {/* Bookmarked Folders (Favorites) */}
      {folderBookmarks.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div 
            className="sidebar-section-title"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => setBookmarksOpen(!bookmarksOpen)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Folder size={12} color="#fbbf24" />
              <span>북마크된 폴더 ({folderBookmarks.length})</span>
            </span>
            {bookmarksOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>

          {bookmarksOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {folderBookmarks.map((bm) => {
                const isActive = currentPath.replace(/\\/g, '/').toLowerCase() === bm.path.replace(/\\/g, '/').toLowerCase();
                return (
                  <div
                    key={bm.path}
                    className={`sidebar-item ${isActive ? 'active' : ''}`}
                    onClick={() => onNavigateTo(bm.path)}
                    title={bm.path}
                    style={{ position: 'relative', paddingRight: '28px' }}
                  >
                    <span className="sidebar-item-icon">
                      <Folder size={15} color="#fbbf24" />
                    </span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {bm.name}
                    </span>
                    {onRemoveFolderBookmark && (
                      <button
                        className="sidebar-remove-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFolderBookmark(bm.path);
                        }}
                        title="북마크 해제"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Storage Vaults (보관함) Section */}
      <div style={{ marginBottom: '16px' }}>
        <div 
          className="sidebar-section-title"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <span 
            style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', flex: 1 }}
            onClick={() => setVaultsOpen(!vaultsOpen)}
          >
            <Package size={12} color="#818cf8" />
            <span>보관함 ({vaults.length})</span>
            {vaultsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          {onAddVault && (
            <button
              className="sidebar-add-btn"
              onClick={onAddVault}
              title="기존 폴더를 보관함으로 지정..."
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <Plus size={13} />
            </button>
          )}
        </div>

        {vaultsOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {vaults.length === 0 ? (
              <div 
                onClick={onAddVault}
                style={{ 
                  fontSize: '11px', 
                  color: 'var(--text-muted)', 
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px dashed var(--border-subtle)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  marginTop: '4px'
                }}
              >
                + 폴더를 보관함으로 지정
              </div>
            ) : (
              vaults.map((vault) => {
                const isActive = currentPath.replace(/\\/g, '/').toLowerCase() === vault.path.replace(/\\/g, '/').toLowerCase();
                return (
                  <div
                    key={vault.id}
                    className={`sidebar-item ${isActive ? 'active' : ''}`}
                    onClick={() => onNavigateTo(vault.path)}
                    title={`${vault.name} (${vault.path})${vault.shortcutKey ? ` - 단축키 [${vault.shortcutKey}${vault.secondaryKey ? ` / ${vault.secondaryKey}` : ''}]` : ''}`}
                    style={{ position: 'relative', paddingRight: '28px' }}
                  >
                    <span className="sidebar-item-icon">
                      <Package size={15} color={vault.color || '#818cf8'} />
                    </span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {vault.name}
                    </span>
                    {vault.shortcutKey && (
                      <span 
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--bg-surface-active)',
                          color: vault.color || 'var(--accent)',
                          border: '1px solid var(--border-subtle)',
                          marginRight: onRemoveVault ? '16px' : '0',
                        }}
                      >
                        {vault.shortcutKey}{vault.secondaryKey ? `/${vault.secondaryKey}` : ''}
                      </span>
                    )}
                    {onRemoveVault && (
                      <button
                        className="sidebar-remove-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveVault(vault.id);
                        }}
                        title="보관함 등록 해제"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* System Drives (C:, D:) */}
      <div style={{ marginBottom: '16px' }}>
        <div className="sidebar-section-title">드라이브 및 장치</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {drives.map((drive) => {
            const isActive = currentPath.startsWith(drive.path) || currentPath.startsWith(drive.name);
            return (
              <div
                key={drive.path}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                onClick={() => onNavigateTo(drive.path)}
                title={drive.path}
              >
                <span className="sidebar-item-icon">
                  <HardDrive size={15} color={isActive ? 'var(--accent)' : '#818cf8'} />
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {drive.label || drive.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Subfolders in Current Directory */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div 
          className="sidebar-section-title" 
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => setFoldersOpen(!foldersOpen)}
        >
          <span>하위 폴더 ({folders.length})</span>
          {foldersOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>

        {foldersOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto', flex: 1 }}>
            {folders.length === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '8px 10px' }}>
                하위 폴더 없음
              </div>
            ) : (
              folders.map((folder) => (
                <div
                  key={folder.path}
                  className="sidebar-item"
                  onClick={() => onNavigateTo(folder.path)}
                  title={folder.name}
                >
                  <span className="sidebar-item-icon">
                    <Folder size={14} color="#60a5fa" />
                  </span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {folder.name}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
