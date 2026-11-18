import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';

// ═══════════════════════════════════════════════════════════════════════════
// PROMEMORIA CONSEGNE — alert visibile su tutto il gestionale.
// 1) Banner "oggi da fare": lavorazioni con scadenza/controllo entro oggi.
// 2) Alert a orario: se la consegna ha orarioPromemoria (es. riunione 15:00,
//    persona da chiamare), all'ora indicata appare un avviso evidente.
// Polling ogni 60s; nessun dato viene modificato, solo lettura.
// ═══════════════════════════════════════════════════════════════════════════

interface PromItem {
  id: string; source: string; titolo: string; tipo: string;
  quando?: string; orario?: string; paziente?: string; urgente?: boolean;
}

const NASCOSTO_PER_MS = 30 * 60 * 1000; // il banner riappare dopo 30 min

function chiaveOggi() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export default function PromemoriaConsegne() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PromItem[]>([]);
  const [alertOrario, setAlertOrario] = useState<PromItem[]>([]);
  const [nascostoFino, setNascostoFino] = useState<number>(0);
  const notificati = useRef<Set<string>>(new Set());

  const carica = useCallback(async () => {
    try {
      const { data } = await api.get('/hub-consegne/promemoria');
      const lista: PromItem[] = data.items || [];
      setItems(lista);

      // Alert a orario: orario <= adesso e non ancora notificato oggi
      const adesso = new Date();
      const hhmm = `${String(adesso.getHours()).padStart(2, '0')}:${String(adesso.getMinutes()).padStart(2, '0')}`;
      const daAvvisare = lista.filter(p => {
        if (!p.orario || p.orario > hhmm) return false;
        const k = `${chiaveOggi()}:${p.source}:${p.id}`;
        if (notificati.current.has(k)) return false;
        notificati.current.add(k);
        return true;
      });
      if (daAvvisare.length) {
        setAlertOrario(v => [...v, ...daAvvisare]);
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            daAvvisare.forEach(p => new Notification('🔔 Promemoria Abbraccio', { body: `${p.orario} — ${p.titolo}` }));
          } else if ('Notification' in window && Notification.permission !== 'denied') {
            Notification.requestPermission();
          }
        } catch { /* notifiche non disponibili: resta l'avviso in pagina */ }
      }
    } catch { /* rete/auth: riprova al prossimo giro */ }
  }, []);

  useEffect(() => {
    carica();
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch { /* noop */ }
    const t = setInterval(carica, 60_000);
    return () => clearInterval(t);
  }, [carica]);

  const chiudiAlert = (p: PromItem) => setAlertOrario(v => v.filter(x => `${x.source}:${x.id}` !== `${p.source}:${p.id}`));
  const visibile = items.length > 0 && Date.now() > nascostoFino;

  return (
    <>
      {/* Alert a orario — riunioni, persone da chiamare, appuntamenti */}
      {alertOrario.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '22px 24px', maxWidth: 480, width: '100%', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', border: '3px solid #f59e0b' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.15rem', color: '#92400e' }}>🔔 Promemoria — è ora!</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {alertOrario.map(p => (
                <div key={`${p.source}:${p.id}`} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#78350f' }}>{p.orario} — {p.titolo}</div>
                    {p.paziente && <div style={{ fontSize: '0.8rem', color: '#92400e' }}>{p.paziente}</div>}
                  </div>
                  <button onClick={() => chiudiAlert(p)} style={{ border: 'none', background: '#f59e0b', color: '#fff', borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Ok</button>
                </div>
              ))}
            </div>
            <button onClick={() => navigate('/consegne')} style={{ marginTop: 12, width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              Apri Consegne e attività
            </button>
          </div>
        </div>
      )}

      {/* Banner "oggi da fare" — sempre visibile finché ci sono cose in giornata */}
      {visibile && alertOrario.length === 0 && (
        <div style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 9000, background: '#fff', border: '2px solid #f59e0b', borderRadius: 14, boxShadow: '0 10px 30px rgba(0,0,0,0.18)', padding: '10px 14px', maxWidth: 340 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.2rem' }}>🔔</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#92400e' }}>
                Oggi da fare: {items.length} {items.length === 1 ? 'consegna/attività' : 'consegne/attività'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#78350f', marginTop: 2 }}>
                {items.slice(0, 3).map(p => `${p.orario ? p.orario + ' — ' : ''}${p.titolo}`).join(' · ')}
                {items.length > 3 ? ` · +${items.length - 3}` : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button onClick={() => navigate('/consegne')} style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
              Apri
            </button>
            <button onClick={() => setNascostoFino(Date.now() + NASCOSTO_PER_MS)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>
              Ricordami dopo
            </button>
          </div>
        </div>
      )}
    </>
  );
}
