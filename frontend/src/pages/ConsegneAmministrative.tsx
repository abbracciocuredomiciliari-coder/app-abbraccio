import { useEffect, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { ClipboardList, Plus, Bell, UserCheck, Hourglass, CheckCircle, RotateCcw, Trash2, MessageSquare, AlertTriangle, Calendar } from 'lucide-react';
import { Button } from '../components/ui/Button';

// ═════════════════════════════════════════════════════════════════════════════
// CONSEGNE AMMINISTRATIVE — bacheca condivisa tra ufficio e personale esterno.
// Visibile a tutti gli utenti autenticati, identica in Gestione Privata e
// Intermediazioni. Le consegne non gestite restano attive come promemoria.
// ═════════════════════════════════════════════════════════════════════════════

type Stato = 'da_gestire' | 'presa_in_carico' | 'in_attesa_riscontro' | 'gestita';

interface Movimento { azione: string; daNome?: string; il: string; nota?: string; }
interface Consegna {
  _id: string;
  titolo: string;
  testo: string;
  tipo: 'giornata' | 'pratica' | 'generale';
  priorita: 'normale' | 'urgente';
  dataGiornata?: string;
  riferimento?: string;
  stato: Stato;
  autoreNome: string;
  presaInCaricoDaNome?: string;
  presaInCaricoIl?: string;
  gestitaDaNome?: string;
  gestitaIl?: string;
  storico: Movimento[];
  createdAt: string;
}

const STATO_LABEL: Record<Stato, string> = {
  da_gestire: 'Da gestire',
  presa_in_carico: 'Presa in carico',
  in_attesa_riscontro: 'In attesa di riscontro',
  gestita: 'Gestita',
};
const STATO_STYLE: Record<Stato, { bg: string; color: string; border: string }> = {
  da_gestire: { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  presa_in_carico: { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
  in_attesa_riscontro: { bg: '#fef3c7', color: '#b45309', border: '#fcd34d' },
  gestita: { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
};
const TIPO_LABEL: Record<Consegna['tipo'], string> = {
  giornata: '📅 Giornata lavorativa',
  pratica: '📂 Pratica',
  generale: '📋 Generale',
};

const fmtData = (d?: string) => d
  ? new Date(d).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '';

export default function ConsegneAmministrative() {
  const { user } = useAuth();
  const isGestione = !!user && ['admin', 'coordinator', 'direttore'].includes(user.role);
  const [consegne, setConsegne] = useState<Consegna[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostraGestite, setMostraGestite] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [apertaId, setApertaId] = useState<string | null>(null);
  const [notaTesto, setNotaTesto] = useState('');

  const [titolo, setTitolo] = useState('');
  const [testo, setTesto] = useState('');
  const [tipo, setTipo] = useState<'giornata' | 'pratica' | 'generale'>('generale');
  const [priorita, setPriorita] = useState<'normale' | 'urgente'>('normale');
  const [dataGiornata, setDataGiornata] = useState('');
  const [riferimento, setRiferimento] = useState('');

  const carica = async () => {
    try {
      const res = await api.get('/consegne-amministrative');
      setConsegne(res.data || []);
    } catch { /* noop */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carica(); const id = setInterval(carica, 30000); return () => clearInterval(id); }, []);

  const aperte = consegne.filter(c => c.stato !== 'gestita');
  const gestite = consegne.filter(c => c.stato === 'gestita');
  const visibili = mostraGestite ? consegne : aperte;

  const crea = async () => {
    if (!titolo.trim() || !testo.trim()) { alert('Inserisci titolo e testo della consegna.'); return; }
    setBusy(true);
    try {
      await api.post('/consegne-amministrative', {
        titolo: titolo.trim(), testo: testo.trim(), tipo, priorita,
        dataGiornata: tipo === 'giornata' && dataGiornata ? dataGiornata : undefined,
        riferimento: tipo === 'pratica' && riferimento.trim() ? riferimento.trim() : undefined,
      });
      setTitolo(''); setTesto(''); setRiferimento(''); setDataGiornata(''); setTipo('generale'); setPriorita('normale'); setShowForm(false);
      await carica();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel salvataggio della consegna');
    } finally {
      setBusy(false);
    }
  };

  const cambiaStato = async (id: string, stato: Stato) => {
    let nota: string | undefined;
    if (stato === 'in_attesa_riscontro' || stato === 'gestita') {
      const n = window.prompt(stato === 'in_attesa_riscontro' ? 'Nota (es. cosa si attende):' : 'Nota di chiusura (opzionale):', '');
      if (n === null) return;
      nota = n.trim() || undefined;
    }
    try {
      await api.patch(`/consegne-amministrative/${id}/stato`, { stato, nota });
      await carica();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore aggiornamento consegna');
    }
  };

  const aggiungiNota = async (id: string) => {
    const n = notaTesto.trim();
    if (!n) return;
    try {
      await api.post(`/consegne-amministrative/${id}/nota`, { nota: n });
      setNotaTesto('');
      await carica();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore aggiunta nota');
    }
  };

  const elimina = async (c: Consegna) => {
    if (!window.confirm(`Eliminare la consegna "${c.titolo}"?`)) return;
    try {
      await api.delete(`/consegne-amministrative/${c._id}`);
      await carica();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore eliminazione');
    }
  };

  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.92rem', boxSizing: 'border-box', fontFamily: 'inherit' };
  const label: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' };

  return (
    <div className="page-container tw-p-5">
      <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-3 tw-mb-5">
        <div>
          <h1 className="tw-flex tw-items-center tw-gap-2 tw-text-blue-900 tw-m-0 tw-text-2xl tw-font-extrabold">
            <ClipboardList size={26} /> Consegne amministrative
          </h1>
          <p className="tw-text-slate-500 tw-text-sm tw-mt-1.5 tw-mb-0">
            Passaggio di consegne tra ufficio e personale sul territorio — visibile a tutta l'équipe in ogni area. Le consegne non gestite restano attive come promemoria.
          </p>
        </div>
        <Button onClick={() => setShowForm(v => !v)} className="tw-flex tw-items-center tw-gap-2">
          <Plus size={18} /> Nuova consegna
        </Button>
      </div>

      {aperte.length > 0 && (
        <div className="tw-flex tw-items-center tw-gap-2 tw-bg-red-50 tw-border tw-border-red-200 tw-text-red-700 tw-rounded-xl tw-px-4 tw-py-3 tw-mb-5 tw-font-bold tw-text-sm">
          <Bell size={18} /> {aperte.length} consegn{aperte.length === 1 ? 'a aperta' : 'e aperte'} da gestire — {consegne.filter(c => c.stato === 'da_gestire').length} nuov{consegne.filter(c => c.stato === 'da_gestire').length === 1 ? 'a' : 'e'}
        </div>
      )}

      {showForm && (
        <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-blue-200 tw-shadow-sm tw-p-5 tw-mb-5">
          <h2 className="tw-m-0 tw-mb-4 tw-text-lg tw-text-blue-900 tw-font-bold">Nuova consegna</h2>
          <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-3 tw-mb-3">
            <div className="md:tw-col-span-2">
              <span style={label}>Titolo *</span>
              <input style={input} value={titolo} onChange={e => setTitolo(e.target.value)} placeholder="Es. Pratica Rossi in attesa documenti" />
            </div>
            <div>
              <span style={label}>Tipo</span>
              <select style={input} value={tipo} onChange={e => setTipo(e.target.value as any)}>
                <option value="generale">📋 Generale</option>
                <option value="giornata">📅 Giornata lavorativa</option>
                <option value="pratica">📂 Pratica</option>
              </select>
            </div>
            {tipo === 'giornata' && (
              <div>
                <span style={label}>Data giornata</span>
                <input style={input} type="date" value={dataGiornata} onChange={e => setDataGiornata(e.target.value)} />
              </div>
            )}
            {tipo === 'pratica' && (
              <div>
                <span style={label}>Riferimento pratica</span>
                <input style={input} value={riferimento} onChange={e => setRiferimento(e.target.value)} placeholder="Es. Rossi Mario — contratto badante" />
              </div>
            )}
            <div>
              <span style={label}>Priorità</span>
              <select style={input} value={priorita} onChange={e => setPriorita(e.target.value as any)}>
                <option value="normale">Normale</option>
                <option value="urgente">🔴 Urgente</option>
              </select>
            </div>
          </div>
          <div className="tw-mb-3">
            <span style={label}>Consegna *</span>
            <textarea style={{ ...input, minHeight: '90px', resize: 'vertical' }} value={testo} onChange={e => setTesto(e.target.value)}
              placeholder="Scrivi la consegna: cosa è stato fatto, cosa resta da fare, a chi è rivolta…" />
          </div>
          <div className="tw-flex tw-gap-2">
            <Button onClick={crea} disabled={busy}>{busy ? 'Salvataggio…' : 'Registra consegna'}</Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Annulla</Button>
          </div>
        </div>
      )}

      <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
        <h2 className="tw-m-0 tw-text-base tw-font-bold tw-text-slate-700">
          {mostraGestite ? `Tutte le consegne (${consegne.length})` : `Consegne aperte (${aperte.length})`}
        </h2>
        <button type="button" onClick={() => setMostraGestite(v => !v)}
          className="tw-text-sm tw-font-semibold tw-text-blue-700 tw-bg-transparent tw-border-0 tw-cursor-pointer hover:tw-underline">
          {mostraGestite ? 'Nascondi quelle gestite' : `Mostra anche le gestite (${gestite.length})`}
        </button>
      </div>

      {loading ? (
        <p className="tw-text-slate-400">Caricamento…</p>
      ) : visibili.length === 0 ? (
        <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-slate-100 tw-p-8 tw-text-center tw-text-slate-400">
          {mostraGestite ? 'Nessuna consegna registrata.' : 'Nessuna consegna aperta: tutto gestito. ✅'}
        </div>
      ) : (
        <div className="tw-flex tw-flex-col tw-gap-3">
          {visibili.map(c => {
            const st = STATO_STYLE[c.stato];
            const aperta = apertaId === c._id;
            return (
              <div key={c._id} className="tw-bg-white tw-rounded-xl tw-border tw-border-slate-200 tw-shadow-sm tw-overflow-hidden" style={{ borderLeft: `5px solid ${c.priorita === 'urgente' ? '#dc2626' : st.border}` }}>
                <div className="tw-p-4">
                  <div className="tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-2">
                    <div className="tw-flex-1 tw-min-w-[220px]">
                      <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-mb-1">
                        <strong className="tw-text-slate-800">{c.titolo}</strong>
                        {c.priorita === 'urgente' && <span className="tw-text-xs tw-font-bold tw-text-red-600 tw-flex tw-items-center tw-gap-1"><AlertTriangle size={13} />URGENTE</span>}
                      </div>
                      <div className="tw-flex tw-flex-wrap tw-gap-2 tw-text-xs tw-text-slate-500">
                        <span>{TIPO_LABEL[c.tipo]}</span>
                        {c.dataGiornata && <span className="tw-flex tw-items-center tw-gap-1"><Calendar size={12} />{new Date(c.dataGiornata).toLocaleDateString('it-IT')}</span>}
                        {c.riferimento && <span>📂 {c.riferimento}</span>}
                        <span>· di <strong>{c.autoreNome}</strong> il {fmtData(c.createdAt)}</span>
                      </div>
                    </div>
                    <span className="tw-text-xs tw-font-bold tw-px-2.5 tw-py-1 tw-rounded-full" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                      {STATO_LABEL[c.stato]}
                    </span>
                  </div>

                  <p className="tw-text-sm tw-text-slate-700 tw-whitespace-pre-wrap tw-my-3 tw-mb-2">{c.testo}</p>

                  {c.stato !== 'da_gestire' && (
                    <div className="tw-text-xs tw-text-slate-500 tw-mb-2">
                      {c.presaInCaricoDaNome && <span>👤 Presa in carico da <strong>{c.presaInCaricoDaNome}</strong> il {fmtData(c.presaInCaricoIl)} · </span>}
                      {c.stato === 'gestita' && c.gestitaDaNome && <span>✅ Gestita da <strong>{c.gestitaDaNome}</strong> il {fmtData(c.gestitaIl)}</span>}
                    </div>
                  )}

                  <div className="tw-flex tw-flex-wrap tw-gap-2 tw-mt-2">
                    {c.stato === 'da_gestire' && (
                      <Button size="sm" onClick={() => cambiaStato(c._id, 'presa_in_carico')} className="tw-flex tw-items-center tw-gap-1.5">
                        <UserCheck size={14} /> Prendi in carico
                      </Button>
                    )}
                    {(c.stato === 'da_gestire' || c.stato === 'presa_in_carico') && (
                      <Button size="sm" variant="secondary" onClick={() => cambiaStato(c._id, 'in_attesa_riscontro')} className="tw-flex tw-items-center tw-gap-1.5">
                        <Hourglass size={14} /> Attesa riscontro
                      </Button>
                    )}
                    {c.stato !== 'gestita' && (
                      <Button size="sm" variant="secondary" onClick={() => cambiaStato(c._id, 'gestita')} className="tw-flex tw-items-center tw-gap-1.5" style={{ borderColor: '#86efac', color: '#15803d' }}>
                        <CheckCircle size={14} /> Segna gestita
                      </Button>
                    )}
                    {c.stato === 'gestita' && isGestione && (
                      <Button size="sm" variant="secondary" onClick={() => cambiaStato(c._id, 'da_gestire')} className="tw-flex tw-items-center tw-gap-1.5">
                        <RotateCcw size={14} /> Riapri
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => { setApertaId(aperta ? null : c._id); setNotaTesto(''); }} className="tw-flex tw-items-center tw-gap-1.5">
                      <MessageSquare size={14} /> {aperta ? 'Chiudi' : `Storico/note (${c.storico.length})`}
                    </Button>
                    {(isGestione || c.autoreNome === user?.name) && (
                      <Button size="sm" variant="secondary" onClick={() => elimina(c)} className="tw-flex tw-items-center tw-gap-1.5" style={{ borderColor: '#fca5a5', color: '#b91c1c' }}>
                        <Trash2 size={14} /> Elimina
                      </Button>
                    )}
                  </div>

                  {aperta && (
                    <div className="tw-mt-3 tw-border-t tw-border-slate-100 tw-pt-3">
                      <div className="tw-flex tw-flex-col tw-gap-1.5 tw-mb-3">
                        {c.storico.map((m, i) => (
                          <div key={i} className="tw-text-xs tw-text-slate-500 tw-flex tw-gap-2">
                            <span className="tw-text-slate-400">{fmtData(m.il)}</span>
                            <span><strong>{m.daNome}</strong> — {m.azione === 'nota' ? `nota: ${m.nota}` : STATO_LABEL[m.azione as Stato] || m.azione}{m.nota && m.azione !== 'nota' ? ` (${m.nota})` : ''}</span>
                          </div>
                        ))}
                      </div>
                      {c.stato !== 'gestita' && (
                        <div className="tw-flex tw-gap-2">
                          <input style={{ ...input, flex: 1 }} value={notaTesto} onChange={e => setNotaTesto(e.target.value)}
                            placeholder="Aggiungi una nota alla consegna…" onKeyDown={e => { if (e.key === 'Enter') aggiungiNota(c._id); }} />
                          <Button size="sm" variant="secondary" onClick={() => aggiungiNota(c._id)}>Aggiungi</Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
