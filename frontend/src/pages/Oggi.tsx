import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useModalita } from '../context/ModalitaContext';
import { Plus, UserCheck, Hourglass, CheckCircle, XCircle, ArrowLeftRight, RotateCcw, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';

// ═════════════════════════════════════════════════════════════════════════════
// PAGINA OGGI — vista operativa del giorno. Regola: nessuna pratica aperta
// senza responsabile e prossima azione datata. Ogni avviso apre il filtro
// esatto. Una lettura non chiude il compito.
// ═════════════════════════════════════════════════════════════════════════════

type Stato = 'da_prendere' | 'in_lavorazione' | 'in_attesa' | 'completata' | 'annullata';
type Vista = 'oggi' | 'mie' | 'da_prendere' | 'scadute' | 'ricontatti' | 'in_attesa' | 'senza_responsabile' | 'trasferimenti' | 'completate' | 'tutte' | 'consegne';
type PraticaTipo = 'richiesta' | 'paziente' | 'intermediazione' | 'consegna' | 'documento' | 'checklist' | 'magazzino' | 'generale';

interface Attivita {
  _id: string;
  titolo: string;
  azioneRichiesta?: string;
  praticaTipo?: string;
  praticaId?: string;
  praticaLabel?: string;
  priorita: 'bassa' | 'normale' | 'alta' | 'urgente';
  scadenza?: string;
  stato: Stato;
  responsabileNome?: string;
  autoreNome: string;
  interlocutoreAttesa?: string;
  dataControlloAttesa?: string;
  esito?: string;
  completataIl?: string;
  completataDa?: string;
  motivoAnnullamento?: string;
  lettaDa?: { userId: string; nome: string; il: string }[];
  trasferimento?: { aId: string; aNome: string; daNome: string; richiestoIl: string; accettato: boolean };
  aggiornamenti: { data: string; autoreNome: string; testo: string }[];
  storico: { azione: string; data: string; autoreNome: string; nota?: string }[];
  createdAt: string;
}

interface Utente { _id?: string; id?: string; name: string; role: string; }

interface ConsegnaAperta {
  _id: string;
  titolo: string;
  testo?: string;
  tipo?: string;
  priorita?: string;
  stato: 'da_gestire' | 'presa_in_carico' | 'in_attesa_riscontro' | 'gestita';
  riferimento?: string;
  scadenza?: string;
  interlocutoreAttesa?: string;
  dataControlloAttesa?: string;
  presaInCaricoDaNome?: string;
  autoreNome: string;
  trasferimento?: { aId: string; aNome: string; daNome: string; accettato: boolean };
  createdAt: string;
}

interface PraticaOpt { id: string; tipo: string; label: string }

// Dove porta il collegamento pratica nella pagina giusta dell'area
const PRATICA_ROUTE: Record<string, string> = {
  richiesta: '/gestione-richieste',
  paziente: '/patients',
  intermediazione: '/archivi-intermediazione',
  consegna: '/consegne',
  documento: '/amministrazione',
  checklist: '/checklist-hub',
  magazzino: '/strumenti',
};

const STATO_CONSEGNA: Record<string, { label: string; bg: string; color: string }> = {
  da_gestire: { label: 'Da gestire', bg: '#fee2e2', color: '#b91c1c' },
  presa_in_carico: { label: 'Presa in carico', bg: 'var(--brand-100)', color: '#1d4ed8' },
  in_attesa_riscontro: { label: 'Attesa riscontro', bg: '#fef3c7', color: '#b45309' },
  gestita: { label: 'Gestita', bg: '#dcfce7', color: '#15803d' },
};

const STATO_LABEL: Record<Stato, string> = {
  da_prendere: 'Da prendere', in_lavorazione: 'In lavorazione', in_attesa: 'In attesa',
  completata: 'Completata', annullata: 'Annullata',
};
const STATO_STYLE: Record<Stato, { bg: string; color: string }> = {
  da_prendere: { bg: '#fee2e2', color: '#b91c1c' },
  in_lavorazione: { bg: 'var(--brand-100)', color: '#1d4ed8' },
  in_attesa: { bg: '#fef3c7', color: '#b45309' },
  completata: { bg: '#dcfce7', color: '#15803d' },
  annullata: { bg: '#f1f5f9', color: '#64748b' },
};
const PRIORITA_LABEL: Record<string, string> = { urgente: '🔴 Urgente', alta: '🟠 Alta', normale: '', bassa: '⚪ Bassa' };

const VISTE: { key: Vista; label: string }[] = [
  { key: 'oggi', label: '📌 Da fare oggi' },
  { key: 'mie', label: '👤 Le mie attività' },
  { key: 'da_prendere', label: '📥 Da prendere' },
  { key: 'scadute', label: '⏰ Scadute' },
  { key: 'ricontatti', label: '📞 Ricontatti' },
  { key: 'in_attesa', label: '⏳ Attesa risposte' },
  { key: 'senza_responsabile', label: '❓ Senza responsabile' },
  { key: 'trasferimenti', label: '🔁 Da accettare' },
  { key: 'consegne', label: '📮 Consegne' },
  { key: 'completate', label: '✅ Chiuse' },
  { key: 'tutte', label: '📋 Tutte aperte' },
];

const fmtData = (d?: string) => d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
const fmtOra = (d?: string) => d ? new Date(d).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
const scaduta = (a: Attivita) => a.scadenza && new Date(a.scadenza) < new Date() && !['completata', 'annullata'].includes(a.stato);

export default function Oggi() {
  const { user } = useAuth();
  const { modalita } = useModalita();
  const isGestione = !!user && ['admin', 'coordinator', 'direttore'].includes(user.role);

  const [vista, setVista] = useState<Vista>('oggi');
  const [attivita, setAttivita] = useState<Attivita[]>([]);
  const [consegne, setConsegne] = useState<ConsegnaAperta[]>([]);
  const [conteggi, setConteggi] = useState<Record<string, number>>({});
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [loading, setLoading] = useState(true);
  const [apertaId, setApertaId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState('');

  // Form nuova attività
  const [showForm, setShowForm] = useState(false);
  const [fTitolo, setFTitolo] = useState('');
  const [fAzione, setFAzione] = useState('');
  const [fPraticaTipo, setFPraticaTipo] = useState<PraticaTipo | ''>('');
  const [fPraticaQ, setFPraticaQ] = useState('');
  const [fPraticaSel, setFPraticaSel] = useState<PraticaOpt | null>(null);
  const [pratiche, setPratiche] = useState<PraticaOpt[]>([]);
  const [fResponsabile, setFResponsabile] = useState('');
  const [fScadenza, setFScadenza] = useState('');
  const [fPriorita, setFPriorita] = useState('normale');

  // Storico espanso + nota
  const [notaTesto, setNotaTesto] = useState('');
  const [storicoId, setStoricoId] = useState<string | null>(null);

  const area = modalita === 'privato' ? 'privato' : modalita;

  const carica = async () => {
    try {
      const richieste: Promise<any>[] = [
        api.get('/attivita/conteggi', { params: { area } }),
      ];
      if (vista === 'consegne') {
        richieste.unshift(api.get('/consegne-amministrative', { params: { aperte: '1' } }));
      } else {
        richieste.unshift(api.get('/attivita', { params: { vista, area } }));
      }
      const [lista, c] = await Promise.all(richieste);
      if (vista === 'consegne') setConsegne(lista.data || []);
      else setAttivita(lista.data || []);
      setConteggi(c.data || {});
    } catch { /* noop */ } finally { setLoading(false); }
  };

  useEffect(() => { setLoading(true); carica(); }, [vista, area]);

  // Ricerca pratiche reali (debounce)
  useEffect(() => {
    if (!fPraticaTipo || fPraticaSel) { setPratiche([]); return; }
    const t = setTimeout(() => {
      api.get('/attivita/pratiche', { params: { tipo: fPraticaTipo, q: fPraticaQ } })
        .then(r => setPratiche(r.data || [])).catch(() => setPratiche([]));
    }, 300);
    return () => clearTimeout(t);
  }, [fPraticaTipo, fPraticaQ, fPraticaSel]);
  useEffect(() => {
    api.get('/auth/all-users').then(r => {
      const list = (r.data || []).map((x: any) => ({ _id: x._id || x.id, name: x.name, role: x.role }));
      setUtenti(list.filter((x: Utente) => x._id));
    }).catch(() => {});
  }, []);

  const azione = async (fn: () => Promise<any>) => {
    if (busy) return;
    setBusy(true); setErrore('');
    try { await fn(); await carica(); }
    catch (e: any) { setErrore(e?.response?.data?.message || 'Errore, riprova.'); }
    finally { setBusy(false); }
  };

  const crea = () => azione(async () => {
    await api.post('/attivita', {
      titolo: fTitolo, azioneRichiesta: fAzione,
      praticaTipo: fPraticaSel ? fPraticaSel.tipo : 'generale',
      praticaId: fPraticaSel?.id,
      praticaLabel: fPraticaSel?.label,
      area, priorita: fPriorita,
      scadenza: fScadenza || undefined, responsabileId: fResponsabile || undefined,
    });
    setFTitolo(''); setFAzione(''); setFPraticaTipo(''); setFPraticaQ(''); setFPraticaSel(null);
    setFResponsabile(''); setFScadenza(''); setShowForm(false);
  });

  const accettaConsegna = (id: string) => azione(() => api.post(`/consegne-amministrative/${id}/accetta-trasferimento`));

  const prendi = (id: string) => azione(() => api.post(`/attivita/${id}/prendi`));
  const attesa = (id: string) => {
    const interlocutore = prompt('Con chi siete in attesa? (es. famiglia Rossi, ASL, fornitore)');
    if (!interlocutore) return;
    const data = prompt('Data di controllo (YYYY-MM-DD):', new Date(Date.now() + 86400000).toISOString().slice(0, 10));
    if (!data) return;
    return azione(() => api.patch(`/attivita/${id}/stato`, { stato: 'in_attesa', interlocutore, dataControllo: data }));
  };
  const completa = (id: string) => {
    const esito = prompt('Esito del lavoro (obbligatorio):');
    if (!esito) return;
    return azione(() => api.patch(`/attivita/${id}/stato`, { stato: 'completata', esito }));
  };
  const annulla = (id: string) => {
    const motivo = prompt("Motivo dell'annullamento (obbligatorio):");
    if (!motivo) return;
    return azione(() => api.patch(`/attivita/${id}/stato`, { stato: 'annullata', motivo }));
  };
  const riapri = (id: string) => azione(() => api.patch(`/attivita/${id}/stato`, { stato: 'riaperta' }));
  const trasferisci = (id: string) => {
    const nomi = utenti.map((x, i) => `${i + 1}. ${x.name}`).join('\n');
    const scelta = prompt(`Passa l'attività a (numero):\n${nomi}`);
    const idx = parseInt(scelta || '', 10) - 1;
    if (isNaN(idx) || !utenti[idx]?._id) return;
    return azione(() => api.post(`/attivita/${id}/trasferisci`, { aId: utenti[idx]._id }));
  };
  const accettaTrasf = (id: string) => azione(() => api.post(`/attivita/${id}/accetta-trasferimento`));
  const aggiungiNota = (id: string) => {
    if (!notaTesto.trim()) return;
    return azione(async () => { await api.post(`/attivita/${id}/aggiornamento`, { testo: notaTesto }); setNotaTesto(''); });
  };

  const inputSt: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' };
  const btnSt = (bg: string, color = '#fff'): React.CSSProperties => ({ padding: '6px 12px', borderRadius: 7, border: 'none', background: bg, color, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 });

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand-700)', margin: 0 }}>📌 Oggi</h1>
        <button style={btnSt('var(--brand-700)')} onClick={() => setShowForm(v => !v)}><Plus size={15} /> Nuova attività</button>
      </div>

      {/* Contatori cliccabili */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 16 }}>
        {([
          ['daPrendere', 'Da prendere', '#dc2626', 'da_prendere'],
          ['mie', 'Le mie', '#1d4ed8', 'mie'],
          ['scadute', 'Scadute', '#b45309', 'scadute'],
          ['ricontatti', 'Ricontatti', '#7c3aed', 'ricontatti'],
          ['senzaResp', 'Senza resp.', '#64748b', 'senza_responsabile'],
          ['trasferimenti', 'Da accettare', '#0891b2', 'trasferimenti'],
          ['consegneAperte', 'Consegne', '#b58b44', 'consegne'],
        ] as const).map(([k, label, col, v]) => (
          <button key={k} onClick={() => setVista(v)} style={{
            background: vista === v ? col : '#fff', color: vista === v ? '#fff' : col,
            border: `2px solid ${col}`, borderRadius: 10, padding: '10px 8px', cursor: 'pointer', textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{conteggi[k] ?? 0}</div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700 }}>{label}</div>
          </button>
        ))}
      </div>

      {/* Form nuova attività */}
      {showForm && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: 'var(--brand-700)', marginBottom: 10 }}>Nuova attività</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <input style={inputSt} placeholder="Titolo * (es. Ricontattare famiglia Rossi)" value={fTitolo} onChange={e => setFTitolo(e.target.value)} />
            <input style={inputSt} placeholder="Azione richiesta (cosa deve fare il responsabile)" value={fAzione} onChange={e => setFAzione(e.target.value)} />
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 200px) 1fr', gap: 10 }}>
              <select style={inputSt} value={fPraticaTipo} onChange={e => { setFPraticaTipo(e.target.value as PraticaTipo | ''); setFPraticaSel(null); setFPraticaQ(''); }}>
                <option value="">Nessuna pratica collegata</option>
                <option value="richiesta">Richiesta / prenotazione</option>
                <option value="paziente">Paziente</option>
                <option value="intermediazione">Pratica intermediazione</option>
                <option value="consegna">Consegna aperta</option>
                <option value="documento">Documento fatturazione</option>
              </select>
              <div style={{ position: 'relative' }}>
                {fPraticaSel ? (
                  <div style={{ ...inputSt, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--brand-50)', borderColor: 'var(--brand-300)' }}>
                    <span style={{ color: '#1d4ed8', fontWeight: 600 }}>📂 {fPraticaSel.label}</span>
                    <button type="button" onClick={() => setFPraticaSel(null)} style={{ border: 'none', background: 'none', color: '#b91c1c', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                  </div>
                ) : (
                  <>
                    <input style={inputSt} disabled={!fPraticaTipo} placeholder={fPraticaTipo ? 'Cerca la pratica reale…' : 'Scegli prima il tipo'} value={fPraticaQ} onChange={e => setFPraticaQ(e.target.value)} />
                    {fPraticaTipo && pratiche.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, marginTop: 4, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 20px rgba(0,0,0,0.12)' }}>
                        {pratiche.map(p => (
                          <button key={p.id} type="button" onClick={() => setFPraticaSel(p)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', borderBottom: '1px solid #f1f5f9' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {fPraticaTipo && pratiche.length === 0 && fPraticaQ && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, marginTop: 4, padding: '8px 12px', fontSize: '0.78rem', color: '#64748b' }}>
                        Nessuna pratica trovata
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <select style={inputSt} value={fResponsabile} onChange={e => setFResponsabile(e.target.value)}>
                <option value="">Responsabile (vuoto = da prendere)</option>
                {utenti.map(x => <option key={x._id} value={x._id}>{x.name}</option>)}
              </select>
              <input style={inputSt} type="date" value={fScadenza} onChange={e => setFScadenza(e.target.value)} />
              <select style={inputSt} value={fPriorita} onChange={e => setFPriorita(e.target.value)}>
                <option value="bassa">Priorità bassa</option>
                <option value="normale">Priorità normale</option>
                <option value="alta">Priorità alta</option>
                <option value="urgente">Priorità urgente</option>
              </select>
            </div>
            <button style={{ ...btnSt('#15803d'), justifyContent: 'center' }} onClick={crea} disabled={!fTitolo.trim() || busy}>
              Crea attività
            </button>
          </div>
        </div>
      )}

      {errore && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontWeight: 600 }}>{errore}</div>}

      {/* Selettore vista */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {VISTE.map(v => (
          <button key={v.key} onClick={() => setVista(v.key)} style={{
            padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
            background: vista === v.key ? 'var(--brand-700)' : '#e2e8f0', color: vista === v.key ? '#fff' : '#475569',
          }}>{v.label}</button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Caricamento…</div>
      : vista === 'consegne' ? (
        // ── Consegne aperte: stessa fonte della pagina Consegne, qui solo
        //    riepilogo operativo — nessuna duplicazione del lavoro.
        consegne.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b', background: '#f8fafc', borderRadius: 12 }}>
            Nessuna consegna aperta. 🎉
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {consegne.map(c => {
              const st = STATO_CONSEGNA[c.stato] || STATO_CONSEGNA.da_gestire;
              const scad = c.scadenza && new Date(c.scadenza) < new Date();
              const trasfMio = c.trasferimento && !c.trasferimento.accettato && String(c.trasferimento.aId) === (user as any)?.id;
              return (
                <div key={c._id} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', border: `2px solid ${scad ? '#fca5a5' : trasfMio ? '#e3d3ae' : '#e2e8f0'}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{c.titolo}</span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: st.bg, color: st.color }}>{st.label}</span>
                        {c.priorita === 'urgente' && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b91c1c' }}>🔴 urgente</span>}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {c.riferimento && <span>📂 {c.riferimento}</span>}
                        <span>👤 {c.presaInCaricoDaNome || <em style={{ color: '#b91c1c' }}>non presa in carico</em>}</span>
                        {c.scadenza && <span style={{ color: scad ? '#b91c1c' : undefined, fontWeight: scad ? 700 : 400 }}>📅 {fmtData(c.scadenza)}{scad ? ' — SCADUTA' : ''}</span>}
                        {c.stato === 'in_attesa_riscontro' && <span>⏳ {c.interlocutoreAttesa} · controllo {fmtData(c.dataControlloAttesa)}</span>}
                        <span>✍️ {c.autoreNome}</span>
                      </div>
                      {c.trasferimento && !c.trasferimento.accettato && (
                        <div style={{ fontSize: '0.78rem', color: '#865d17', marginTop: 6, background: '#fbf5e9', padding: '4px 8px', borderRadius: 6, display: 'inline-block' }}>
                          🔁 Passaggio a {c.trasferimento.aNome} in attesa di accettazione (responsabilità: {c.trasferimento.daNome})
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {trasfMio && <button style={btnSt('#0891b2')} onClick={() => accettaConsegna(c._id)} disabled={busy}>✓ Accetta</button>}
                      <Link to="/consegne" style={{ ...btnSt('#e2e8f0', '#334155'), textDecoration: 'none' }}>Gestisci →</Link>
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', textAlign: 'center' }}>
              Le consegne si lavorano nella pagina Consegne — qui contano nel riepilogo senza duplicare il lavoro.
            </div>
          </div>
        )
      ) : (
        attivita.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b', background: '#f8fafc', borderRadius: 12 }}>
            Nessuna attività in questa vista. 🎉
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {attivita.map(a => {
              const aperta = apertaId === a._id;
              const chiusa = ['completata', 'annullata'].includes(a.stato);
              const mia = a.trasferimento && !a.trasferimento.accettato && String(a.trasferimento.aId) === (user as any)?.id;
              return (
                <div key={a._id} style={{
                  background: '#fff', borderRadius: 12, padding: '12px 14px',
                  border: `2px solid ${scaduta(a) ? '#fca5a5' : mia ? '#67e8f9' : '#e2e8f0'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{a.titolo}</span>
                        <span style={{ ...{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10 }, background: STATO_STYLE[a.stato].bg, color: STATO_STYLE[a.stato].color }}>
                          {STATO_LABEL[a.stato]}
                        </span>
                        {PRIORITA_LABEL[a.priorita] && <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>{PRIORITA_LABEL[a.priorita]}</span>}
                      </div>
                      {a.azioneRichiesta && <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: 4 }}>→ {a.azioneRichiesta}</div>}
                      <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {a.praticaLabel && (PRATICA_ROUTE[a.praticaTipo || ''] ? (
                          <Link to={PRATICA_ROUTE[a.praticaTipo!]} style={{ color: '#1d4ed8', fontWeight: 600, textDecoration: 'none' }}>📂 {a.praticaLabel} →</Link>
                        ) : (
                          <span>📂 {a.praticaLabel}</span>
                        ))}
                        <span>👤 {a.responsabileNome || <em style={{ color: '#b91c1c' }}>senza responsabile</em>}</span>
                        {a.scadenza && <span style={{ color: scaduta(a) ? '#b91c1c' : undefined, fontWeight: scaduta(a) ? 700 : 400 }}>📅 {fmtData(a.scadenza)}{scaduta(a) ? ' — SCADUTA' : ''}</span>}
                        {a.stato === 'in_attesa' && <span>⏳ {a.interlocutoreAttesa} · controllo {fmtData(a.dataControlloAttesa)}</span>}
                        <span>✍️ {a.autoreNome}</span>
                      </div>
                      {a.esito && <div style={{ fontSize: '0.8rem', color: '#15803d', marginTop: 6 }}>✅ Esito: {a.esito} <span style={{ color: '#64748b' }}>({a.completataDa} · {fmtOra(a.completataIl)})</span></div>}
                      {a.motivoAnnullamento && <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 6 }}>Annullata: {a.motivoAnnullamento}</div>}
                      {a.trasferimento && !a.trasferimento.accettato && (
                        <div style={{ fontSize: '0.78rem', color: '#0e7490', marginTop: 6, background: '#ecfeff', padding: '4px 8px', borderRadius: 6, display: 'inline-block' }}>
                          🔁 Passaggio a {a.trasferimento.aNome} in attesa di accettazione
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {mia && <button style={btnSt('#0891b2')} onClick={() => accettaTrasf(a._id)} disabled={busy}>✓ Accetta</button>}
                        {!chiusa && a.stato === 'da_prendere' && <button style={btnSt('#1d4ed8')} onClick={() => prendi(a._id)} disabled={busy}><UserCheck size={13} /> Prendi</button>}
                        {!chiusa && a.stato !== 'in_attesa' && <button style={btnSt('#b45309')} onClick={() => attesa(a._id)} disabled={busy}><Hourglass size={13} /> Attesa</button>}
                        {!chiusa && <button style={btnSt('#15803d')} onClick={() => completa(a._id)} disabled={busy}><CheckCircle size={13} /> Completa</button>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {!chiusa && isGestione && <button style={btnSt('#e2e8f0', '#475569')} onClick={() => trasferisci(a._id)} disabled={busy}><ArrowLeftRight size={13} /> Passa</button>}
                        {!chiusa && <button style={btnSt('#e2e8f0', '#b91c1c')} onClick={() => annulla(a._id)} disabled={busy}><XCircle size={13} /> Annulla</button>}
                        {chiusa && <button style={btnSt('#e2e8f0', '#475569')} onClick={() => riapri(a._id)} disabled={busy}><RotateCcw size={13} /> Riapri</button>}
                        <button style={btnSt('#e2e8f0', '#475569')} onClick={() => setApertaId(aperta ? null : a._id)}>
                          {aperta ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Dettagli
                        </button>
                      </div>
                    </div>
                  </div>

                  {aperta && (
                    <div style={{ marginTop: 12, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--brand-700)', marginBottom: 6 }}>
                        Aggiornamenti ({a.aggiornamenti?.length || 0})
                        <button onClick={() => setStoricoId(storicoId === a._id ? null : a._id)} style={{ marginLeft: 10, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.72rem' }}>
                          {storicoId === a._id ? 'nascondi cronologia' : 'mostra cronologia'}
                        </button>
                      </div>
                      {storicoId === a._id ? (
                        <div style={{ fontSize: '0.75rem', color: '#475569', display: 'grid', gap: 4, marginBottom: 10 }}>
                          {(a.storico || []).slice().reverse().map((s, i) => (
                            <div key={i}>· <strong>{s.azione}</strong> — {s.autoreNome} · {fmtOra(s.data)}{s.nota ? ` (${s.nota})` : ''}</div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.78rem', display: 'grid', gap: 6, marginBottom: 10 }}>
                          {(a.aggiornamenti || []).slice().reverse().slice(0, 5).map((g, i) => (
                            <div key={i} style={{ background: '#f8fafc', borderRadius: 6, padding: '6px 10px' }}>
                              <span style={{ color: '#64748b' }}>{g.autoreNome} · {fmtOra(g.data)}</span><br />{g.testo}
                            </div>
                          ))}
                        </div>
                      )}
                      {!chiusa && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input style={{ ...inputSt, flex: 1 }} placeholder="Aggiungi aggiornamento…" value={notaTesto} onChange={e => setNotaTesto(e.target.value)} />
                          <button style={btnSt('var(--brand-700)')} onClick={() => aggiungiNota(a._id)} disabled={busy || !notaTesto.trim()}><MessageSquare size={13} /> Invia</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
