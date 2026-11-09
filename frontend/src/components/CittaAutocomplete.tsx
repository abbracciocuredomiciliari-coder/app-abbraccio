import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  // seconda uscita: true se la città è stata scelta dai suggerimenti (vincolata)
  onChange: (citta: string, valida: boolean) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  required?: boolean;
}

// Comuni italiani reali via OpenStreetMap Nominatim: la città è valida
// solo se scelta dalla lista — niente testo libero inventato.
export default function CittaAutocomplete({ value, onChange, placeholder = 'Es. Roma', style, required }: Props) {
  const [testo, setTesto] = useState(value);
  const [suggerimenti, setSuggerimenti] = useState<string[]>([]);
  const [valida, setValida] = useState(!!value);
  const [aperta, setAperta] = useState(false);
  const [cercando, setCercando] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { setTesto(value); setValida(!!value); }, [value]);

  useEffect(() => {
    const chiudi = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAperta(false);
    };
    document.addEventListener('mousedown', chiudi);
    return () => document.removeEventListener('mousedown', chiudi);
  }, []);

  const cerca = (q: string) => {
    clearTimeout(debounceRef.current);
    if (q.trim().length < 3) { setSuggerimenti([]); setAperta(false); return; }
    debounceRef.current = setTimeout(async () => {
      setCercando(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=8&addressdetails=1&countrycodes=it&accept-language=it&q=${encodeURIComponent(q.trim())}`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'it' } });
        const data: any[] = await res.json();
        const nomi = new Set<string>();
        (Array.isArray(data) ? data : []).forEach((r) => {
          const a = r.address || {};
          const comune = a.city || a.town || a.village || a.municipality;
          if (comune) {
            const prov = a.county || a.province;
            nomi.add(prov && prov !== comune ? `${comune} (${prov})` : comune);
          }
        });
        setSuggerimenti([...nomi].slice(0, 6));
        setAperta(nomi.size > 0);
      } catch {
        setSuggerimenti([]);
      } finally {
        setCercando(false);
      }
    }, 300);
  };

  const scrivi = (v: string) => {
    setTesto(v);
    setValida(false);
    onChange(v, false);
    cerca(v);
  };

  const scegli = (nome: string) => {
    const pulito = nome.replace(/\s*\([^)]*\)$/, ''); // tiene "Roma", toglie "(RM)"
    setTesto(nome);
    setValida(true);
    setAperta(false);
    setSuggerimenti([]);
    onChange(pulito, true);
  };

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={testo}
        onChange={(e) => scrivi(e.target.value)}
        onFocus={() => suggerimenti.length && setAperta(true)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        style={{
          ...style,
          borderColor: testo && !valida ? '#f59e0b' : valida ? '#16a34a' : (style?.borderColor || undefined),
        }}
      />
      {testo && (
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem', pointerEvents: 'none' }}>
          {cercando ? '⏳' : valida ? '✅' : '⚠️'}
        </span>
      )}
      {aperta && suggerimenti.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px',
          boxShadow: '0 8px 20px rgba(0,0,0,0.12)', overflow: 'hidden', marginTop: '2px',
        }}>
          {suggerimenti.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => scegli(s)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px',
                background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--brand-50)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              📍 {s}
            </button>
          ))}
        </div>
      )}
      {testo.trim().length >= 3 && !valida && !aperta && (
        <span style={{ display: 'block', fontSize: '0.72rem', color: '#b45309', marginTop: '3px' }}>
          Seleziona la città dai suggerimenti
        </span>
      )}
    </div>
  );
}
