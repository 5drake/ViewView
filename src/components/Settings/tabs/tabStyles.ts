import type { CSSProperties } from 'react';

// Inline-style constants extracted verbatim from identical inline literals
// duplicated across the settings tabs (pure copy-paste moves, no redesign).

// Muted 11px hint line under section titles (Behavior rows, Vaults sections)
export const MUTED_HINT_STYLE: CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  marginTop: '2px',
};

// Card wrapper for a full-width settings section (Data, About)
export const SECTION_CARD_STYLE: CSSProperties = {
  padding: '14px',
  background: 'var(--bg-surface-hover)',
  borderRadius: '10px',
  border: '1px solid var(--border-subtle)',
};
