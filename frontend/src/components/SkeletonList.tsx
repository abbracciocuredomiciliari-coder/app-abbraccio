interface SkeletonListProps {
  rows?: number;
  showHeader?: boolean;
}

export default function SkeletonList({ rows = 5, showHeader = true }: SkeletonListProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {showHeader && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', alignItems: 'center' }}>
          <div className="skeleton" style={{ height: '36px', width: '220px', borderRadius: '8px' }} />
          <div className="skeleton" style={{ height: '36px', width: '120px', borderRadius: '8px', marginLeft: 'auto' }} />
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: '14px 18px',
            border: '1.5px solid var(--gray-200)',
            borderRadius: '12px',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="skeleton skeleton-text" style={{ width: `${55 + (i % 3) * 15}%` }} />
            <div className="skeleton skeleton-text" style={{ width: `${30 + (i % 4) * 10}%`, height: '0.75rem' }} />
          </div>
          <div className="skeleton" style={{ width: '80px', height: '28px', borderRadius: '6px', flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}
