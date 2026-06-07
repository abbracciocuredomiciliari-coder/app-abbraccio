import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import type { Toast, ToastType } from '../hooks/useToast';

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={20} color="#059669" />,
  error: <XCircle size={20} color="#dc2626" />,
  warning: <AlertCircle size={20} color="#d97706" />,
  info: <Info size={20} color="#0369a1" />,
};

const stylesMap: Record<ToastType, { background: string; border: string }> = {
  success: { background: '#f0fdf4', border: '#bbf7d0' },
  error: { background: '#fef2f2', border: '#fecaca' },
  warning: { background: '#fffbeb', border: '#fde68a' },
  info: { background: '#eff6ff', border: '#bfdbfe' },
};

export function ToastContainer({
  toasts,
  onRemove,
  position = 'top-right',
}: ToastContainerProps) {
  const positionStyles = {
    'top-right': { top: '20px', right: '20px' },
    'top-left': { top: '20px', left: '20px' },
    'bottom-right': { bottom: '20px', right: '20px' },
    'bottom-left': { bottom: '20px', left: '20px' },
    'top-center': { top: '20px', left: '50%', transform: 'translateX(-50%)' },
    'bottom-center': { bottom: '20px', left: '50%', transform: 'translateX(-50%)' },
  };

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        ...positionStyles[position],
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
}) {
  useEffect(() => {
    // Animation on mount
    const timer = setTimeout(() => {
      // Could trigger animation here
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const style = stylesMap[toast.type];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 20px',
        borderRadius: '10px',
        backgroundColor: style.background,
        border: `1px solid ${style.border}`,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        minWidth: '300px',
        maxWidth: '400px',
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      <span style={{ flexShrink: 0 }}>{iconMap[toast.type]}</span>
      <p
        style={{
          flex: 1,
          margin: 0,
          fontSize: '0.9375rem',
          color: '#1f2937',
          lineHeight: 1.4,
        }}
      >
        {toast.message}
      </p>
      <button
        onClick={() => onRemove(toast.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9ca3af',
          transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#6b7280';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#9ca3af';
        }}
      >
        <X size={18} />
      </button>
    </div>
  );
}
