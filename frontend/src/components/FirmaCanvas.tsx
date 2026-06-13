import { useRef, useEffect, useState } from 'react';
import { Trash2, Check } from 'lucide-react';

interface FirmaCanvasProps {
  label: string;
  sublabel?: string;
  onFirmaCompleta: (firmaBase64: string) => void;
  onCancella?: () => void;
  firmaEsistente?: string;
  disabled?: boolean;
  altezza?: number;
}

export default function FirmaCanvas({
  label,
  sublabel,
  onFirmaCompleta,
  onCancella,
  firmaEsistente,
  disabled = false,
  altezza = 180,
}: FirmaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [disegnando, setDisegnando] = useState(false);
  const [haFirmato, setHaFirmato] = useState(false);
  const [mostraFirmaEsistente, setMostraFirmaEsistente] = useState(!!firmaEsistente);
  const [firmaSalvata, setFirmaSalvata] = useState<string>(firmaEsistente || '');
  const ultimoPunto = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configura canvas
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Sfondo bianco
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Linea guida
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(20, altezza * 0.72);
    ctx.lineTo(canvas.width - 20, altezza * 0.72);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ripristina stile per disegno
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 2.5;
  }, [altezza, mostraFirmaEsistente]);

  const getPunto = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  };

  const iniziaDisegno = (e: React.TouchEvent | React.MouseEvent) => {
    if (disabled || mostraFirmaEsistente) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDisegnando(true);
    ultimoPunto.current = getPunto(e, canvas);
  };

  const disegna = (e: React.TouchEvent | React.MouseEvent) => {
    if (!disegnando || disabled || mostraFirmaEsistente) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !ultimoPunto.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const punto = getPunto(e, canvas);
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(ultimoPunto.current.x, ultimoPunto.current.y);
    ctx.lineTo(punto.x, punto.y);
    ctx.stroke();
    ultimoPunto.current = punto;
    setHaFirmato(true);
  };

  const fineDisegno = (e: React.TouchEvent | React.MouseEvent) => {
    if (!disegnando) return;
    e.preventDefault();
    setDisegnando(false);
    ultimoPunto.current = null;
  };

  const confermaFirma = () => {
    const canvas = canvasRef.current;
    if (!canvas || !haFirmato) return;
    const firmaBase64 = canvas.toDataURL('image/png');
    onFirmaCompleta(firmaBase64);
    setFirmaSalvata(firmaBase64);
    setMostraFirmaEsistente(true);
  };

  const cancellaFirma = () => {
    setHaFirmato(false);
    setMostraFirmaEsistente(false);
    setFirmaSalvata('');
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Ridisegna linea guida
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(20, altezza * 0.72);
    ctx.lineTo(canvas.width - 20, altezza * 0.72);
    ctx.stroke();
    ctx.setLineDash([]);

    onCancella?.();
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontWeight: '600', fontSize: '1rem', color: '#1e3a5f' }}>{label}</div>
        {sublabel && <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '2px' }}>{sublabel}</div>}
      </div>

      {mostraFirmaEsistente && (firmaSalvata || firmaEsistente) ? (
        // Mostra firma esistente come immagine
        <div style={{ border: '2px solid #10b981', borderRadius: '12px', overflow: 'hidden', background: 'white', position: 'relative' }}>
          <img src={firmaSalvata || firmaEsistente} alt="Firma" style={{ width: '100%', height: `${altezza}px`, objectFit: 'contain' }} />
          <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#10b981', color: 'white', borderRadius: '20px', padding: '4px 12px', fontSize: '0.8rem', fontWeight: '600' }}>
            ✓ Firmato
          </div>
          {!disabled && (
            <button
              onClick={cancellaFirma}
              style={{ position: 'absolute', bottom: '8px', right: '8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
            >
              <Trash2 size={14} /> Rifirma
            </button>
          )}
        </div>
      ) : (
        // Canvas per disegnare firma
        <div>
          <div style={{ border: `2px ${haFirmato ? 'solid #2563eb' : 'dashed #d1d5db'}`, borderRadius: '12px', overflow: 'hidden', background: 'white', touchAction: 'none' }}>
            <canvas
              ref={canvasRef}
              width={600}
              height={altezza}
              style={{ width: '100%', height: `${altezza}px`, display: 'block', cursor: disabled ? 'not-allowed' : 'crosshair', touchAction: 'none' }}
              onMouseDown={iniziaDisegno}
              onMouseMove={disegna}
              onMouseUp={fineDisegno}
              onMouseLeave={fineDisegno}
              onTouchStart={iniziaDisegno}
              onTouchMove={disegna}
              onTouchEnd={fineDisegno}
            />
          </div>

          {!disabled && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={cancellaFirma}
                style={{ flex: 1, background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.9rem' }}
              >
                <Trash2 size={16} /> Cancella
              </button>
              <button
                onClick={confermaFirma}
                disabled={!haFirmato}
                style={{
                  flex: 2,
                  background: haFirmato ? '#16a34a' : '#d1fae5',
                  color: haFirmato ? 'white' : '#6b7280',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px',
                  cursor: haFirmato ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                }}
              >
                <Check size={16} /> Conferma Firma
              </button>
            </div>
          )}

          {!haFirmato && !disabled && (
            <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem', marginTop: '8px' }}>
              ✍️ Firma qui con il dito o con la penna
            </p>
          )}
        </div>
      )}
    </div>
  );
}
