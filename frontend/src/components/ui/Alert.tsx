import { ReactNode } from 'react';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

interface AlertProps {
  children: ReactNode;
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  onClose?: () => void;
  className?: string;
}

export function Alert({
  children,
  type = 'info',
  title,
  onClose,
  className = '',
}: AlertProps) {
  const styles = {
    success: {
      background: '#f0fdf4',
      border: '1px solid #bbf7d0',
      color: '#166534',
      icon: <CheckCircle size={20} />,
    },
    error: {
      background: '#fef2f2',
      border: '1px solid #fecaca',
      color: '#dc2626',
      icon: <XCircle size={20} />,
    },
    warning: {
      background: '#fffbeb',
      border: '1px solid #fde68a',
      color: '#d97706',
      icon: <AlertCircle size={20} />,
    },
    info: {
      background: '#eff6ff',
      border: '1px solid #bfdbfe',
      color: '#0369a1',
      icon: <Info size={20} />,
    },
  };

  const style = styles[type];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '16px',
        borderRadius: '8px',
        ...style,
      }}
      className={className}
    >
      <span style={{ flexShrink: 0, marginTop: '2px' }}>{style.icon}</span>
      <div style={{ flex: 1 }}>
        {title && (
          <h4 style={{ margin: '0 0 4px 0', fontWeight: 600, fontSize: '0.9375rem' }}>
            {title}
          </h4>
        )}
        <div style={{ fontSize: '0.875rem', lineHeight: 1.5 }}>{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: 'inherit',
            opacity: 0.6,
          }}
        >
          <XCircle size={18} />
        </button>
      )}
    </div>
  );
}
