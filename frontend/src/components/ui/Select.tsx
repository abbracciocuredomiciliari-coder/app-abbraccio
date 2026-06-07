interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  disabled?: boolean;
}

export function Select({
  label,
  options,
  value,
  onChange,
  placeholder = 'Seleziona...',
  error,
  helperText,
  fullWidth = true,
  disabled = false,
}: SelectProps) {
  return (
    <div style={{ width: fullWidth ? '100%' : 'auto' }}>
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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: `1px solid ${error ? '#ef4444' : '#d1d5db'}`,
          borderRadius: '8px',
          fontSize: '0.9375rem',
          outline: 'none',
          backgroundColor: disabled ? '#f3f4f6' : 'white',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: error ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : 'none',
        }}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p style={{ marginTop: '4px', fontSize: '0.875rem', color: '#ef4444' }}>{error}</p>
      )}
      {!error && helperText && (
        <p style={{ marginTop: '4px', fontSize: '0.875rem', color: '#6b7280' }}>{helperText}</p>
      )}
    </div>
  );
}
