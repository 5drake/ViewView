import React, { useState, useRef, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

/**
 * Promise-based confirm dialog. Replaces the blocking native `confirm()`
 * with a themed, async modal that matches the rest of the UI.
 */
export function useConfirm(): {
  confirm: ConfirmFn;
  confirmState: ConfirmOptions | null;
  resolveConfirm: (result: boolean) => void;
} {
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setConfirmState(options);
    });
  }, []);

  const resolveConfirm = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setConfirmState(null);
  }, []);

  return { confirm, confirmState, resolveConfirm };
}

export const ConfirmDialog: React.FC<{
  options: ConfirmOptions | null;
  onResolve: (result: boolean) => void;
}> = ({ options, onResolve }) => {
  if (!options) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(10px)',
        zIndex: 5000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.12s ease-out',
      }}
      onClick={() => onResolve(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={options.title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '400px',
          maxWidth: '92vw',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
          animation: 'scaleUp 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', padding: '18px 18px 8px 18px', alignItems: 'flex-start' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: options.danger ? 'rgba(239, 68, 68, 0.15)' : 'var(--accent-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={18} color={options.danger ? '#f87171' : 'var(--accent)'} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
              {options.title}
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5', wordBreak: 'break-word' }}>
              {options.message}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '14px 18px 18px 18px' }}>
          <button
            className="nav-btn"
            onClick={() => onResolve(false)}
            style={{ padding: '8px 16px', fontSize: '12.5px' }}
          >
            {options.cancelLabel || '취소'}
          </button>
          <button
            onClick={() => onResolve(true)}
            autoFocus
            style={{
              padding: '8px 18px',
              fontSize: '12.5px',
              fontWeight: 600,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: options.danger ? '#ef4444' : 'var(--accent)',
              color: '#ffffff',
            }}
          >
            {options.confirmLabel || '확인'}
          </button>
        </div>
      </div>
    </div>
  );
};
