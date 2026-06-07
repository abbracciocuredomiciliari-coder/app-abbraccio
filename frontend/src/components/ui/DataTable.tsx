import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState } from './EmptyState';

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    pageSize: number;
    totalItems: number;
  };
  onRowClick?: (item: T) => void;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  loading = false,
  emptyTitle = 'Nessun dato',
  emptyDescription = 'Non ci sono elementi da visualizzare',
  pagination,
  onRowClick,
  className = '',
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        Caricamento...
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={className}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#475569',
                    borderBottom: '1px solid #e2e8f0',
                    width: col.width || 'auto',
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                style={{
                  borderBottom: '1px solid #f1f5f9',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (onRowClick) {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: '14px 16px',
                      fontSize: '0.9375rem',
                      color: '#1e293b',
                    }}
                  >
                    {col.render ? col.render(item) : (item as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 0',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
            Mostrando {((pagination.currentPage - 1) * pagination.pageSize) + 1} -
            {' '}{Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems)} di{' '}
            {pagination.totalItems}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: 'white',
                cursor: pagination.currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: pagination.currentPage === 1 ? 0.5 : 1,
              }}
            >
              <ChevronLeft size={18} />
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter((page) => {
                const current = pagination.currentPage;
                return page === 1 || page === pagination.totalPages ||
                  (page >= current - 1 && page <= current + 1);
              })
              .map((page, index, arr) => (
                <span key={page} style={{ display: 'flex', alignItems: 'center' }}>
                  {index > 0 && arr[index - 1] !== page - 1 && (
                    <span style={{ padding: '0 8px', color: '#9ca3af' }}>...</span>
                  )}
                  <button
                    onClick={() => pagination.onPageChange(page)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: pagination.currentPage === page ? '#0d9488' : '#e2e8f0',
                      backgroundColor: pagination.currentPage === page ? '#0d9488' : 'white',
                      color: pagination.currentPage === page ? 'white' : '#374151',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {page}
                  </button>
                </span>
              ))}
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: 'white',
                cursor: pagination.currentPage === pagination.totalPages ? 'not-allowed' : 'pointer',
                opacity: pagination.currentPage === pagination.totalPages ? 0.5 : 1,
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
