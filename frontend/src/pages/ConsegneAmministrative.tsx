import { useEffect, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, CheckCircle, Clock, AlertTriangle, MessageSquare } from 'lucide-react';

const TIPI: Record<string, string> = { generale: 'Generale', giornata: 'Consegna di giornata', pratica: 'Pratica amministrativa' };

export default function ConsegneAmministrative() {
  const { user } = useAuth();
  const [lista, setLista] = useState<any[]>([]);
  const [soloAperte, setSoloAperte] = useState(true);
  const [err, setErr] = useState('');
  const [form, setForm] = useState(false);
  const [f, setF] = useState({ titolo: '', testo: '', tipo: 'generale', priorita: 'normale', riferimento: '', dataGiornata: '' });
  const [notaPer, setNotaPer] = useState<string | null>(null);
  const [nota, setNota] = useState('');

  const carica = () => api.get('/consegne-amministrative', { params: soloAperte ? { aperte: '1' } : {} })
    .then(r => setLista(r.data.consegne || r.data || [])).catch(() => setErr('Errore caricamento'));
  useEffect(() => { carica(); }, [soloAperte]);

  async function crea(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post('/consegne-amministrative', { ...f, riferimento: f.riferimento || undefined, dataGiornata: f.dataGiornata || undefined });
      setForm(false); setF({ titolo: '', testo: '', tipo: 'generale', priorita: 'normale', riferimento: '', dataGiornata: '' });
      carica();
    } catch { setErr('Errore nel salvataggio'); }
  }

  const setStato = (id: string, accetta: boolean) =>
    api.patch(`/consegne-amministrative/${id}/stato`, { stato: accetta ? 'gestita' : 'da_gestire' }).then(carica).catch(() => setErr('Errore aggiornamento'));
  const elimina = (id: string) => { if (confirm('Eliminare questa consegna?')) api.delete(`/consegne-amministrative/${id}`).then(carica); };
  const aggiungiNota = (id: string) => {
    if (!nota.trim()) return;
    api.post(`/consegne-amministrative/${id}/nota`, { nota }).then(() => { setNotaPer(null); setNota(''); carica(); });
  };

  const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.88rem', boxSizing: 'border-box', marginTop: 4 };
  const lbl: React.CSSProperties = { display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569' };

  return (
    <div className="tw-p-4 tw-max-w-4xl tw-mx-auto">
      <div className="tw-flex tw-items-center tw-justify-between tw-flex-wrap tw-gap-3 tw-mb-5">
        <div>
          <h1 className="tw-text-xl tw-font-bold tw-text-slate-800">Consegne amministrative</h1>
          <p className="tw-text-sm tw-text-slate-500">Richieste e consegne dell'équipe da prendere in carico</p>
        </div>
        <div className="tw-flex tw-gap-2">
          <button onClick={() => setSoloAperte(s => !s)}
            className={`tw-px-3 tw-py-2 tw-rounded-lg tw-text-sm tw-font-semibold tw-border ${soloAperte ? 'tw-bg-amber-50 tw-border-amber-300 tw-text-amber-800' : 'tw-bg-white tw-border-slate-300 tw-text-slate-600'}`}>
            {soloAperte ? 'Solo aperte' : 'Tutte'}
          </button>
          <button onClick={() => setForm(f => !f)}
            className="tw-px-4 tw-py-2 tw-rounded-lg tw-text-sm tw-font-bold tw-bg-teal-700 tw-text-white tw-flex tw-items-center tw-gap-2">
            <Plus size={16} /> Nuova consegna
          </button>
        </div>
      </div>

      {err && <p className="tw-text-red-600 tw-text-sm tw-mb-3">{err}</p>}

      {form && (
        <form onSubmit={crea} className="tw-bg-white tw-rounded-xl tw-border tw-border-teal-200 tw-shadow-sm tw-p-4 tw-mb-5 tw-grid tw-gap-3">
          <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-3">
            <label style={lbl}>Tipo
              <select style={inp} value={f.tipo} onChange={e => setF(s => ({ ...s, tipo: e.target.value }))}>
                {Object.entries(TIPI).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            {f.tipo === 'giornata' && <label style={lbl}>Data giornata<input style={inp} type="date" value={f.dataGiornata} onChange={e => setF(s => ({ ...s, dataGiornata: e.target.value }))} /></label>}
            <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
              <input type="checkbox" checked={f.priorita === 'urgente'} onChange={e => setF(s => ({ ...s, priorita: e.target.checked ? 'urgente' : 'normale' }))} /> Urgente
            </label>
          </div>
          <label style={lbl}>Titolo *<input style={inp} required value={f.titolo} onChange={e => setF(s => ({ ...s, titolo: e.target.value }))} /></label>
          <label style={lbl}>Testo *<textarea style={{ ...inp, resize: 'vertical' }} rows={3} required value={f.testo} onChange={e => setF(s => ({ ...s, testo: e.target.value }))} /></label>
          <label style={lbl}>Riferimento<input style={inp} value={f.riferimento} onChange={e => setF(s => ({ ...s, riferimento: e.target.value }))} placeholder="Es. paziente, pratica..." /></label>
          <button type="submit" className="tw-px-4 tw-py-2 tw-rounded-lg tw-bg-teal-700 tw-text-white tw-font-bold">Salva consegna</button>
        </form>
      )}

      {lista.length === 0 && <p className="tw-text-slate-400 tw-text-center tw-py-10">Nessuna consegna {soloAperte ? 'aperta' : ''}.</p>}

      <div className="tw-grid tw-gap-3">
        {lista.map((c: any) => (
          <div key={c._id} className={`tw-bg-white tw-rounded-xl tw-border tw-shadow-sm tw-p-4 ${c.stato === 'gestita' ? 'tw-border-emerald-200 tw-opacity-75' : c.priorita === 'urgente' ? 'tw-border-amber-300' : 'tw-border-slate-200'}`}>
            <div className="tw-flex tw-items-start tw-gap-3 tw-flex-wrap">
              <div className="tw-flex-1 tw-min-w-[200px]">
                <div className="tw-flex tw-items-center tw-gap-2 tw-flex-wrap">
                  {c.priorita === 'urgente' && <AlertTriangle size={15} className="tw-text-amber-600" />}
                  <strong className="tw-text-slate-800">{c.titolo}</strong>
                  <span className="tw-text-[0.68rem] tw-font-bold tw-px-2 tw-py-0.5 tw-rounded-full tw-bg-slate-100 tw-text-slate-600">{TIPI[c.tipo] || c.tipo}</span>
                  {c.stato === 'gestita' && <span className="tw-text-[0.68rem] tw-font-bold tw-px-2 tw-py-0.5 tw-rounded-full tw-bg-emerald-100 tw-text-emerald-700">GESTITA</span>}
                </div>
                <div className="tw-text-[0.75rem] tw-text-slate-500 tw-mt-0.5">
                  {c.autoreNome || 'Anonimo'}{c.origine === 'esterna' ? ' (modulo esterno)' : ''} · {new Date(c.createdAt).toLocaleDateString('it-IT')} {new Date(c.createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  {c.dataGiornata ? ` · giornata del ${new Date(c.dataGiornata).toLocaleDateString('it-IT')}` : ''}
                  {c.riferimento ? ` · rif: ${c.riferimento}` : ''}
                </div>
                <p className="tw-text-sm tw-text-slate-700 tw-mt-2 tw-whitespace-pre-wrap">{c.testo}</p>
                {(c.storico || []).length > 0 && (
                  <div className="tw-mt-2 tw-border-t tw-border-slate-100 tw-pt-2">
                    {c.storico.map((s: any, i: number) => (
                      <div key={i} className="tw-text-[0.75rem] tw-text-slate-500 tw-py-0.5">
                        <strong>{s.autoreNome || s.daNome || 'Sistema'}</strong> — {s.azione || s.nota} <span className="tw-text-slate-400">({new Date(s.il || s.data).toLocaleDateString('it-IT')})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-2 tw-shrink-0">
                {c.stato !== 'gestita' && (
                  <button onClick={() => setStato(c._id, true)} title="Segna gestita"
                    className="tw-p-2 tw-rounded-lg tw-bg-emerald-50 tw-text-emerald-700 hover:tw-bg-emerald-100"><CheckCircle size={17} /></button>
                )}
                <button onClick={() => setNotaPer(notaPer === c._id ? null : c._id)} title="Aggiungi nota"
                  className="tw-p-2 tw-rounded-lg tw-bg-slate-50 tw-text-slate-600 hover:tw-bg-slate-100"><MessageSquare size={17} /></button>
                {user?.role === 'admin' && (
                  <button onClick={() => elimina(c._id)} title="Elimina"
                    className="tw-p-2 tw-rounded-lg tw-bg-red-50 tw-text-red-600 hover:tw-bg-red-100"><Trash2 size={17} /></button>
                )}
              </div>
            </div>
            {notaPer === c._id && (
              <div className="tw-flex tw-gap-2 tw-mt-3">
                <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Nota di lavorazione..."
                  className="tw-flex-1 tw-px-3 tw-py-2 tw-border tw-border-slate-300 tw-rounded-lg tw-text-sm" />
                <button onClick={() => aggiungiNota(c._id)} className="tw-px-3 tw-py-2 tw-rounded-lg tw-bg-teal-700 tw-text-white tw-text-sm tw-font-bold">Aggiungi</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
