import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = 'Nessun dato',
  description = 'Non ci sono elementi da visualizzare.',
  icon,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
      }}
      className={className}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: '#f1f5f9',
          marginBottom: '16px',
          color: '#9ca3af',
        }}
      >
        {icon || <Inbox size={32} />}
      </div>
      <h3
        style={{
          margin: '0 0 8px 0',
          fontSize: '1.125rem',
          fontWeight: 600,
          color: '#374151',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: '0 0 16px 0',
          fontSize: '0.9375rem',
          color: '#6b7280',
          maxWidth: '400px',
        }}
      >
        {description}
      </p>
      {action}
    </div>
  );
}
