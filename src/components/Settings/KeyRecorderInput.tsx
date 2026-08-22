import React, { useState } from 'react';
import { X } from 'lucide-react';
import { formatKeyEvent } from '../../utils/keyboard';

// Mirrors the stored-binding normalization used by matchesKeybinding() in
// src/utils/keyboard.ts (alias map + modifier set + lowercase) so duplicate
// detection here agrees with how runtime key events are matched.
const KEY_ALIASES: Record<string, string> = { esc: 'escape', del: 'delete' };

export function normalizeBinding(binding?: string): string {
  if (!binding || !binding.trim()) return '';
  const parts = binding
    .trim()
    .split('+')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return '';
  const key = KEY_ALIASES[parts[parts.length - 1]] || parts[parts.length - 1];
  const mods = parts.slice(0, -1).sort();
  return [...mods, key].join('+');
}

// Interactive key capture recorder with clear option.
// `takenKeys` lists every shortcut string already assigned to OTHER actions or
// vault slots: recording one of those shows a warning and is not applied.
const KeyRecorderInput: React.FC<{
  value?: string;
  onChange: (newKey: string) => void;
  placeholder?: string;
  canClear?: boolean;
  takenKeys?: string[];
}> = ({ value = '', onChange, placeholder = '미지정', canClear = false, takenKeys }) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [conflictKey, setConflictKey] = useState<string>('');

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
    const candidate = normalizeBinding(formatted);
    const isTaken =
      candidate !== '' && (takenKeys ?? []).some((taken) => normalizeBinding(taken) === candidate);
    if (isTaken) {
      // Duplicate of another action/vault shortcut: warn and do not apply.
      setConflictKey(formatted);
      setIsRecording(false);
      return;
    }
    setConflictKey('');
    onChange(formatted);
    setIsRecording(false);
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', position: 'relative' }}>
      <button
        type="button"
        onClick={() => {
          setConflictKey('');
          setIsRecording(true);
        }}
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
      {conflictKey && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '2px',
            fontSize: '10px',
            color: '#ef4444',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}
        >
          {`'${conflictKey}'은(는) 다른 동작에 이미 할당됨`}
        </div>
      )}
    </div>
  );
};

export default KeyRecorderInput;
