import { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  icon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  loading = false,
  type = 'button',
  icon,
  fullWidth = false,
  className = '',
}: ButtonProps) {
  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    opacity: disabled || loading ? 0.6 : 1,
  };

  const sizeStyles = {
    sm: { padding: '6px 12px', fontSize: '0.875rem' },
    md: { padding: '10px 16px', fontSize: '0.9375rem' },
    lg: { padding: '14px 24px', fontSize: '1rem' },
  };

  const variantStyles = {
    primary: {
      backgroundColor: '#0d9488',
      color: 'white',
      boxShadow: '0 1px 3px rgba(13, 148, 136, 0.3)',
    },
    secondary: {
      backgroundColor: '#f1f5f9',
      color: '#475569',
      border: '1px solid #e2e8f0',
    },
    danger: {
      backgroundColor: '#dc2626',
      color: 'white',
    },
    success: {
      backgroundColor: '#059669',
      color: 'white',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: '#64748b',
    },
  };

  const hoverStyles = !disabled && !loading ? {
    primary: { backgroundColor: '#0f766e', transform: 'translateY(-1px)' },
    secondary: { backgroundColor: '#e2e8f0' },
    danger: { backgroundColor: '#b91c1c' },
    success: { backgroundColor: '#047857' },
    ghost: { backgroundColor: '#f1f5f9' },
  }[variant] : {};

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        ...baseStyles,
        ...sizeStyles[size],
        ...variantStyles[variant],
        width: fullWidth ? '100%' : 'auto',
        ...hoverStyles,
      }}
      className={className}
    >
      {loading && (
        <span style={{
          width: size === 'sm' ? '14px' : '16px',
          height: size === 'sm' ? '14px' : '16px',
          border: '2px solid transparent',
          borderTopColor: 'currentColor',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
      )}
      {!loading && icon}
      {children}
    </button>
  );
}
