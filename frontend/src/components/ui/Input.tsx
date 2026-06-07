import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, fullWidth = true, className = '', style = {}, ...props }, ref) => {
    return (
      <div style={{ width: fullWidth ? '100%' : 'auto' }} className={className}>
        {label && (
          <label
            style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#374151',
            }}
          >
            {label}
          </label>
        )}
        <div style={{ position: 'relative' }}>
          {icon && (
            <span
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af',
                pointerEvents: 'none',
              }}
            >
              {icon}
            </span>
          )}
          <input
            ref={ref}
            style={{
              width: '100%',
              padding: icon ? '10px 12px 10px 40px' : '10px 12px',
              border: `1px solid ${error ? '#ef4444' : '#d1d5db'}`,
              borderRadius: '8px',
              fontSize: '0.9375rem',
              outline: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              boxShadow: error ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : 'none',
              ...style,
            }}
            {...props}
          />
        </div>
        {error && (
          <p style={{ marginTop: '4px', fontSize: '0.875rem', color: '#ef4444' }}>{error}</p>
        )}
        {!error && helperText && (
          <p style={{ marginTop: '4px', fontSize: '0.875rem', color: '#6b7280' }}>{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
