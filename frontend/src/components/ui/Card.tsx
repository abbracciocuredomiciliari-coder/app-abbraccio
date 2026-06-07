import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  border?: boolean;
  style?: React.CSSProperties;
}

export function Card({
  children,
  title,
  icon,
  action,
  className = '',
  padding = 'md',
  shadow = 'sm',
  border = true,
  style,
}: CardProps) {
  const paddingStyles = {
    none: { padding: 0 },
    sm: { padding: '12px' },
    md: { padding: '20px' },
    lg: { padding: '28px' },
  };

  const shadowStyles = {
    none: { boxShadow: 'none' },
    sm: { boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    md: { boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },
    lg: { boxShadow: '0 10px 15px rgba(0,0,0,0.1)' },
  };

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        border: border ? '1px solid #e2e8f0' : 'none',
        ...shadowStyles[shadow],
        ...paddingStyles[padding],
        ...style,
      }}
      className={className}
    >
      {(title || action) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: padding === 'none' ? 0 : '16px',
            paddingBottom: padding === 'none' ? 0 : '16px',
            borderBottom: padding === 'none' ? 'none' : '1px solid #f1f5f9',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {icon && (
              <span style={{ color: '#0d9488' }}>
                {icon}
              </span>
            )}
            {title && (
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#1e293b' }}>
                {title}
              </h3>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
