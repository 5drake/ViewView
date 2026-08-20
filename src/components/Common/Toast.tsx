import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, Package, Star, Trash2, Copy } from 'lucide-react';
import { ToastMessage } from '../../types';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

interface ActiveToastItem extends ToastMessage {
  isExiting?: boolean;
}

const ToastRow: React.FC<{
  toast: ActiveToastItem;
  isLatest: boolean;
  onDismiss: (id: string) => void;
  onExited: (id: string) => void;
}> = ({ toast, isLatest, onDismiss, onExited }) => {
  const [internalExiting, setInternalExiting] = useState<boolean>(false);
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  const isExiting = Boolean(toast.isExiting || internalExiting);

  // Auto-dismiss countdown based solely on this item's creation
  useEffect(() => {
    if (isExiting) {
      const exitTimer = setTimeout(() => {
        onExitedRef.current(toast.id);
      }, 200);
      return () => clearTimeout(exitTimer);
    }

    const duration = toast.duration || 2500;
    const dismissTimer = setTimeout(() => {
      setInternalExiting(true);
    }, duration);

    return () => clearTimeout(dismissTimer);
  }, [isExiting, toast.id, toast.duration]);

  let icon = <CheckCircle2 size={16} color="#34d399" />;
  let baseColor = '#34d399';
  let glowRgba = '52, 211, 153';

  if (toast.type === 'bookmark') {
    icon = <Star size={16} color="#fbbf24" fill="#fbbf24" />;
    baseColor = '#fbbf24';
    glowRgba = '251, 191, 36';
  } else if (toast.type === 'trash') {
    icon = <Trash2 size={16} color="#f87171" />;
    baseColor = '#f87171';
    glowRgba = '248, 113, 113';
  } else if (toast.type === 'copy') {
    icon = <Copy size={16} color="#c084fc" />;
    baseColor = '#c084fc';
    glowRgba = '192, 132, 252';
  } else if (toast.type === 'vault') {
    icon = <Package size={16} color="#818cf8" />;
    baseColor = '#818cf8';
    glowRgba = '129, 140, 248';
  } else if (toast.type === 'error') {
    icon = <AlertCircle size={16} color="#ef4444" />;
    baseColor = '#ef4444';
    glowRgba = '239, 68, 68';
  } else if (toast.type === 'info') {
    icon = <Info size={16} color="#38bdf8" />;
    baseColor = '#38bdf8';
    glowRgba = '56, 189, 248';
  }

  // Active / Latest visual emphasis styling
  const border = isLatest
    ? `1.5px solid ${baseColor}`
    : `1px solid rgba(${glowRgba}, 0.35)`;

  const boxShadow = isLatest
    ? `0 10px 32px rgba(0, 0, 0, 0.7), 0 0 22px rgba(${glowRgba}, 0.5), 0 0 40px rgba(${glowRgba}, 0.25)`
    : `0 6px 20px rgba(0, 0, 0, 0.5), 0 0 12px rgba(${glowRgba}, 0.15)`;

  const opacity = isLatest ? 1 : 0.88;

  return (
    <div
      onClick={() => onDismiss(toast.id)}
      className={isExiting ? 'toast-item-exit' : 'toast-item-enter'}
      style={{
        padding: isLatest ? '10px 20px' : '9px 18px',
        backgroundColor: 'rgba(18, 20, 29, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        border,
        boxShadow,
        opacity,
        display: 'flex',
        alignItems: 'center',
        gap: '9px',
        color: '#ffffff',
        fontSize: '12.5px',
        fontWeight: isLatest ? 600 : 500,
        pointerEvents: 'auto',
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        willChange: 'transform, opacity',
        transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {icon}
      <span>{toast.message}</span>
      {isLatest && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: baseColor,
            boxShadow: `0 0 8px ${baseColor}`,
            marginLeft: '2px',
          }}
        />
      )}
    </div>
  );
};

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  const [activeList, setActiveList] = useState<ActiveToastItem[]>([]);

  // Keep active list synchronized and enforce max 3 items with smooth oldest exit
  useEffect(() => {
    setActiveList((currentActive) => {
      const incomingIds = new Set(toasts.map((t) => t.id));

      // Mark dropped items as exiting
      let updated: ActiveToastItem[] = currentActive.map((item) => {
        if (!incomingIds.has(item.id) && !item.isExiting) {
          return { ...item, isExiting: true };
        }
        return item;
      });

      // Add new incoming items
      for (const incoming of toasts) {
        if (!updated.some((item) => item.id === incoming.id)) {
          updated.push({ ...incoming, isExiting: false });
        }
      }

      // Enforce max 3: mark oldest non-exiting items as exiting
      const nonExiting = updated.filter((item) => !item.isExiting);
      if (nonExiting.length > 3) {
        const excess = nonExiting.length - 3;
        let markCount = 0;
        updated = updated.map((item) => {
          if (!item.isExiting && markCount < excess) {
            markCount++;
            return { ...item, isExiting: true };
          }
          return item;
        });
      }

      return updated;
    });
  }, [toasts]);

  const handleExited = useRef((id: string) => {
    setActiveList((prev) => prev.filter((item) => item.id !== id));
    onDismiss(id);
  });
  handleExited.current = (id: string) => {
    setActiveList((prev) => prev.filter((item) => item.id !== id));
    onDismiss(id);
  };

  const handleManualDismiss = (id: string) => {
    setActiveList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isExiting: true } : item))
    );
    setTimeout(() => {
      setActiveList((prev) => prev.filter((item) => item.id !== id));
      onDismiss(id);
    }, 200);
  };

  if (activeList.length === 0) return null;

  // Identify the latest non-exiting item
  const nonExitingItems = activeList.filter((t) => !t.isExiting);
  const latestId = nonExitingItems.length > 0 ? nonExitingItems[nonExitingItems.length - 1].id : null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '38px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      {activeList.map((toast) => (
        <ToastRow
          key={toast.id}
          toast={toast}
          isLatest={toast.id === latestId}
          onDismiss={handleManualDismiss}
          onExited={(id) => handleExited.current(id)}
        />
      ))}
    </div>
  );
};
