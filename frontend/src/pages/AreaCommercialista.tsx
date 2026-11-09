import { useEffect, useState } from 'react';
import api from '../api/api';
import { FileDown } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// AREA COMMERCIALISTA — accesso limitato alla sola documentazione resa
// disponibile dall'ufficio. Nessuna cartella clinica, nota operativa o pratica:
// questo utente vede esclusivamente le consegne consegnate/scaricabili.
// ═══════════════════════════════════════════════════════════════════════════

const data = (d?: string) => { try { return d ? new Date(d).toLocaleDateString('it-IT') : '—'; } catch { return '—'; } };

export default function AreaCommercialista() {
  const [consegne, setConsegne] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState('');

  useEffect(() => {
    api.get('/commercialista/consegne')
      .then(r => setConsegne(r.data || []))
      .catch(e => setErrore(e?.response?.data?.message || 'Errore caricamento'))
      .finally(() => setLoading(false));
  }, []);

  const scarica = async (id: string) => {
    try {
      const res = await api.get(`/commercialista/consegne/${id}/pacchetto`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url; a.download = `documenti-${id}.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Errore download pacchetto');
    }
  };

  return (
    <section className="fade-in section-wide">
      <h1 style={{ margin: 0, color: 'var(--brand-700)' }}>Documenti amministrativi</h1>
      <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '6px' }}>
        Pacchetti documentali resi disponibili dallo studio. Ogni pacchetto contiene l'indice dei documenti e gli originali disponibili.
      </p>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>Caricamento…</p>
      ) : errore ? (
        <div className="error-text">{errore}</div>
      ) : consegne.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          Nessun pacchetto documentale disponibile al momento.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
          {consegne.map(c => (
            <div key={c._id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '14px 18px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <strong>Periodo {data(c.periodoDal)} → {data(c.periodoAl)}</strong>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  {c.totaleDocumenti} documenti · {(c.tipologie || []).join(', ')} · preparato il {data(c.preparataIl)}
                  {c.anomalie > 0 && <span style={{ color: '#b45309' }}> · ⚠ {c.anomalie} note di verifica</span>}
                </div>
              </div>
              <span style={{ borderRadius: '10px', padding: '3px 12px', fontSize: '0.74rem', fontWeight: 700, background: c.stato === 'verificata' ? '#dcfce7' : 'var(--brand-100)', color: c.stato === 'verificata' ? '#166534' : 'var(--brand-700)' }}>
                {c.stato}
              </span>
              <button onClick={() => scarica(c._id)}
                style={{ background: 'var(--brand-700)', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 16px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileDown size={15} /> Scarica pacchetto
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
