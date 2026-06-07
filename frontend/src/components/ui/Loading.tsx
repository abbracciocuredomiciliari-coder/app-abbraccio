interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

export function Loading({
  size = 'md',
  text = 'Caricamento...',
  fullScreen = false,
  className = '',
}: LoadingProps) {
  const sizeMap = {
    sm: { width: '24px', height: '24px', border: '2px' },
    md: { width: '40px', height: '40px', border: '3px' },
    lg: { width: '64px', height: '64px', border: '4px' },
  };

  const { width, height, border } = sizeMap[size];

  const spinner = (
    <div
      style={{
        width,
        height,
        border: `${border} solid #e5e7eb`,
        borderTopColor: '#0d9488',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
    />
  );

  if (fullScreen) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255, 255, 255, 0.9)',
          zIndex: 9999,
        }}
        className={className}
      >
        {spinner}
        {text && (
          <p style={{ marginTop: '16px', color: '#4b5563', fontSize: '0.9375rem' }}>{text}</p>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      className={className}
    >
      {spinner}
      {text && (
        <p style={{ marginTop: '12px', color: '#6b7280', fontSize: '0.875rem' }}>{text}</p>
      )}
    </div>
  );
}
