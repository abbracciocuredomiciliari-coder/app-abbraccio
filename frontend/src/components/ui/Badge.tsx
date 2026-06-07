interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
}: BadgeProps) {
  const styles = {
    default: { background: '#f1f5f9', color: '#64748b' },
    primary: { background: '#e0f2fe', color: '#0369a1' },
    success: { background: '#f0fdf4', color: '#059669' },
    warning: { background: '#fffbeb', color: '#d97706' },
    danger: { background: '#fef2f2', color: '#dc2626' },
    info: { background: '#eff6ff', color: '#3b82f6' },
  };

  const sizeStyles = {
    sm: { padding: '2px 8px', fontSize: '0.75rem' },
    md: { padding: '4px 12px', fontSize: '0.875rem' },
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '9999px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        ...styles[variant],
        ...sizeStyles[size],
      }}
      className={className}
    >
      {children}
    </span>
  );
}
