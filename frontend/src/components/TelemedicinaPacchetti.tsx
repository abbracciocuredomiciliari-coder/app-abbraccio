import { useEffect, useState } from 'react';
import api from '../api/api';
import { useToast } from '../hooks/useToast';
import { Package, Plus, Save, Loader2, Euro, Calendar, Activity, Users, TrendingUp, CheckCircle } from 'lucide-react';

type Pacchetto = { _id: string; codice: string; nome: string; descrizione: string; tipo: string; prezzoMensile: number; prezzoAttivazione: number; durataMinimaMesi: number; incluseProfessioni: string[]; dispositiviInclusi: string[]; visiteIncluse: number; parametriInclusi: string[]; verticali: string[]; attivo: boolean; note?: string };
type Sottoscrizione = { _id: string; pazienteId: string; pazienteNome: string; pacchettoNome: string; pacchettoCodice: string; tipo: string; prezzoMensile: number; dataInizio: string; dataFine?: string; stato: string };
type PazienteMini = { _id: string; firstName: string; lastName: string };

const professioni = ['medico', 'infermiere', 'fisioterapista', 'logopedista', 'psicologo', 'coordinatore', 'generico'];
const tipiParametro = ['frequenza_cardiaca', 'pressione_sistolica', 'pressione_diastolica', 'saturazione_o2', 'glicemia', 'temperatura', 'peso', 'spo2', 'co2', 'passi', 'dolore_nrs', 'altro'];
const dispositivi = ['pressione', 'saturazione', 'glucometro', 'bilancia', 'termometro', 'elettrocardiografo', 'sfigmomanometro', 'ossimetro', 'spirometro', 'altro'];
const verticali = ['BPCO', 'diabete', 'scompenso', 'demenza', 'Parkinson', 'post-ictus', 'fragilita', 'altro'];
const tipiPacchetto = ['canone', 'noleggio', 'ibrido'];

export default function TelemedicinaPacchetti() {
  const { addToast } = useToast();
  const [pacchetti, setPacchetti] = useState<Pacchetto[]>([]);
  const [sottoscrizioni, setSottoscrizioni] = useState<Sottoscrizione[]>([]);
  const [pazienti, setPazienti] = useState<PazienteMini[]>([]);
  const [billing, setBilling] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [form, setForm] = useState({ codice: '', nome: '', descrizione: '', tipo: 'canone' as string, prezzoMensile: '', prezzoAttivazione: '0', durataMinimaMesi: 12, incluseProfessioni: [] as string[], dispositiviInclusi: [] as string[], visiteIncluse: 0, parametriInclusi: [] as string[], verticali: [] as string[], note: '' });
  const [subForm, setSubForm] = useState({ pazienteId: '', pacchettoId: '', dataInizio: '', dispositiviAssegnati: [] as string[], note: '' });
  const [billingDate, setBillingDate] = useState({ mese: new Date().getMonth() + 1, anno: new Date().getFullYear() });

  useEffect(() => { load(); loadPazienti(); loadSubs(); loadBilling(); }, []);

  async function load() {
    try {
      setLoading(true);
      const res = await api.get('/telemedicina/pacchetti');
      setPacchetti(res.data);
    } catch (err: any) { addToast('Errore caricamento pacchetti', 'error'); }
    finally { setLoading(false); }
  }

  async function loadPazienti() { try { const r = await api.get('/patients'); setPazienti(r.data); } catch {} }

  async function loadSubs() {
    try { const r = await api.get('/telemedicina/sottoscrizioni?attivo=true'); setSottoscrizioni(r.data); }
    catch { addToast('Errore caricamento sottoscrizioni', 'error'); }
  }

  async function loadBilling() {
    try { const r = await api.get(`/telemedicina/sottoscrizioni/billing?mese=${billingDate.mese}&anno=${billingDate.anno}`); setBilling(r.data); }
    catch { addToast('Errore caricamento rendicontazione', 'error'); }
  }

  const toggle = (arr: string[], val: string, set: (arr: string[]) => void) => {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post('/telemedicina/pacchetti', { ...form, prezzoMensile: Number(form.prezzoMensile), prezzoAttivazione: Number(form.prezzoAttivazione) });
      addToast('Pacchetto salvato', 'success');
      setForm({ codice: '', nome: '', descrizione: '', tipo: 'canone', prezzoMensile: '', prezzoAttivazione: '0', durataMinimaMesi: 12, incluseProfessioni: [], dispositiviInclusi: [], visiteIncluse: 0, parametriInclusi: [], verticali: [], note: '' });
      await load();
    } catch (err: any) { addToast(err.response?.data?.message || 'Errore salvataggio', 'error'); }
    finally { setSaving(false); }
  };

  const attiva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subForm.pazienteId || !subForm.pacchettoId || !subForm.dataInizio) return;
    try {
      setSubscribing(subForm.pacchettoId);
      await api.post('/telemedicina/sottoscrizioni', { ...subForm, dispositiviAssegnati: subForm.dispositiviAssegnati });
      addToast('Sottoscrizione attivata', 'success');
      setSubForm({ pazienteId: '', pacchettoId: '', dataInizio: '', dispositiviAssegnati: [], note: '' });
      await loadSubs();
      await loadBilling();
    } catch (err: any) { addToast(err.response?.data?.message || 'Errore attivazione', 'error'); }
    finally { setSubscribing(null); }
  };

  const pacchettoSelezionato = pacchetti.find(p => p._id === subForm.pacchettoId);

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-teal-600" /></div>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="bg-white border rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Package size={20} /> Pacchetti commerciali</h2>
        <div className="space-y-3 max-h-80 overflow-auto mb-4">
          {pacchetti.length === 0 ? <p className="text-sm text-slate-500">Nessun pacchetto. Crea il primo.</p> : pacchetti.map(p => (
            <div key={p._id} className="border rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div><strong>{p.nome}</strong> <span className="text-xs text-slate-500">({p.codice})</span> <span className="text-xs px-1.5 py-0.5 bg-slate-100 rounded uppercase">{p.tipo}</span></div>
                <span className={`text-xs px-2 py-1 rounded ${p.attivo ? 'bg-emerald-100' : 'bg-slate-100'}`}>{p.attivo ? 'attivo' : 'inattivo'}</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">{p.descrizione}</p>
              <div className="flex flex-wrap gap-2 mt-2 text-xs">
                <span className="bg-teal-50 px-2 py-1 rounded flex items-center gap-1"><Euro size={12} /> {p.prezzoMensile}/mese</span>
                <span className="bg-slate-50 px-2 py-1 rounded flex items-center gap-1"><Calendar size={12} /> {p.durataMinimaMesi} mesi</span>
                <span className="bg-slate-50 px-2 py-1 rounded flex items-center gap-1"><Activity size={12} /> {p.visiteIncluse} visite</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Professioni: {p.incluseProfessioni.join(', ') || 'tutte'} · Dispositivi: {p.dispositiviInclusi.join(', ') || 'nessuno'} · Parametri: {p.parametriInclusi.join(', ') || 'nessuno'}</p>
              {p.verticali?.length > 0 && <p className="text-xs text-slate-500">Verticali: {p.verticali.join(', ')}</p>}
              <button onClick={() => setSubForm(s => ({ ...s, pacchettoId: p._id }))} className="mt-2 px-3 py-1.5 bg-teal-600 text-white rounded text-sm flex items-center gap-1"><Plus size={14} /> Attiva paziente</button>
            </div>
          ))}
        </div>

        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Users size={16} /> Sottoscrizioni attive</h3>
        <div className="space-y-2 max-h-60 overflow-auto">
          {sottoscrizioni.length === 0 ? <p className="text-sm text-slate-500">Nessuna sottoscrizione attiva.</p> : sottoscrizioni.map(s => (
            <div key={s._id} className="bg-slate-50 border rounded p-2 text-sm">
              <div className="font-medium">{s.pazienteNome}</div>
              <div className="text-xs text-slate-500">{s.pacchettoNome} · {new Date(s.dataInizio).toLocaleDateString('it-IT')} · {s.stato} · <Euro size={10} className="inline" /> {s.prezzoMensile}/mese</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Plus size={20} /> Nuovo pacchetto</h2>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input required value={form.codice} onChange={e => setForm(s => ({ ...s, codice: e.target.value }))} placeholder="Codice" className="border rounded p-2" />
            <select value={form.tipo} onChange={e => setForm(s => ({ ...s, tipo: e.target.value }))} className="border rounded p-2">
              {tipiPacchetto.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <input required value={form.nome} onChange={e => setForm(s => ({ ...s, nome: e.target.value }))} placeholder="Nome pacchetto" className="w-full border rounded p-2" />
          <textarea required value={form.descrizione} onChange={e => setForm(s => ({ ...s, descrizione: e.target.value }))} placeholder="Descrizione" className="w-full border rounded p-2 h-20" />
          <div className="grid grid-cols-3 gap-3">
            <input required type="number" min={0} step="0.01" value={form.prezzoMensile} onChange={e => setForm(s => ({ ...s, prezzoMensile: e.target.value }))} placeholder="Prezzo mensile" className="border rounded p-2" />
            <input type="number" min={0} step="0.01" value={form.prezzoAttivazione} onChange={e => setForm(s => ({ ...s, prezzoAttivazione: e.target.value }))} placeholder="Attivazione" className="border rounded p-2" />
            <input type="number" min={1} value={form.durataMinimaMesi} onChange={e => setForm(s => ({ ...s, durataMinimaMesi: Number(e.target.value) }))} placeholder="Durata minima mesi" className="border rounded p-2" />
          </div>
          <input type="number" min={0} value={form.visiteIncluse} onChange={e => setForm(s => ({ ...s, visiteIncluse: Number(e.target.value) }))} placeholder="Visite incluse" className="w-full border rounded p-2" />
          <div><label className="text-xs text-slate-500">Professioni incluse</label><div className="flex flex-wrap gap-2 mt-1">{professioni.map(p => <button key={p} type="button" onClick={() => toggle(form.incluseProfessioni, p, arr => setForm(s => ({ ...s, incluseProfessioni: arr })))} className={`px-2 py-1 text-xs rounded border ${form.incluseProfessioni.includes(p) ? 'bg-teal-600 text-white' : 'bg-white'}`}>{p}</button>)}</div></div>
          <div><label className="text-xs text-slate-500">Dispositivi inclusi</label><div className="flex flex-wrap gap-2 mt-1">{dispositivi.map(d => <button key={d} type="button" onClick={() => toggle(form.dispositiviInclusi, d, arr => setForm(s => ({ ...s, dispositiviInclusi: arr })))} className={`px-2 py-1 text-xs rounded border ${form.dispositiviInclusi.includes(d) ? 'bg-teal-600 text-white' : 'bg-white'}`}>{d}</button>)}</div></div>
          <div><label className="text-xs text-slate-500">Parametri inclusi</label><div className="flex flex-wrap gap-2 mt-1">{tipiParametro.map(t => <button key={t} type="button" onClick={() => toggle(form.parametriInclusi, t, arr => setForm(s => ({ ...s, parametriInclusi: arr })))} className={`px-2 py-1 text-xs rounded border ${form.parametriInclusi.includes(t) ? 'bg-teal-600 text-white' : 'bg-white'}`}>{t.replace(/_/g, ' ')}</button>)}</div></div>
          <div><label className="text-xs text-slate-500">Verticali</label><div className="flex flex-wrap gap-2 mt-1">{verticali.map(v => <button key={v} type="button" onClick={() => toggle(form.verticali, v, arr => setForm(s => ({ ...s, verticali: arr })))} className={`px-2 py-1 text-xs rounded border ${form.verticali.includes(v) ? 'bg-teal-600 text-white' : 'bg-white'}`}>{v}</button>)}</div></div>
          <textarea value={form.note} onChange={e => setForm(s => ({ ...s, note: e.target.value }))} placeholder="Note commerciali" className="w-full border rounded p-2 h-16" />
          <button disabled={saving} type="submit" className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Salva pacchetto</button>
        </form>
      </div>

      <div className="bg-white border rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Users size={20} /> Attivazione & Rendicontazione</h2>
        {subForm.pacchettoId ? (
          <form onSubmit={attiva} className="space-y-3 mb-6">
            <div className="text-sm font-medium">Attiva {pacchettoSelezionato?.nome || 'pacchetto'}</div>
            <select required value={subForm.pazienteId} onChange={e => setSubForm(s => ({ ...s, pazienteId: e.target.value }))} className="w-full border rounded p-2">
              <option value="">Seleziona paziente</option>
              {pazienti.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}
            </select>
            <input required type="date" value={subForm.dataInizio} onChange={e => setSubForm(s => ({ ...s, dataInizio: e.target.value }))} className="w-full border rounded p-2" />
            <div><label className="text-xs text-slate-500">Dispositivi assegnati</label><div className="flex flex-wrap gap-2 mt-1">{(pacchettoSelezionato?.dispositiviInclusi || dispositivi).map(d => <button key={d} type="button" onClick={() => toggle(subForm.dispositiviAssegnati, d, arr => setSubForm(s => ({ ...s, dispositiviAssegnati: arr })))} className={`px-2 py-1 text-xs rounded border ${subForm.dispositiviAssegnati.includes(d) ? 'bg-teal-600 text-white' : 'bg-white'}`}>{d}</button>)}</div></div>
            <textarea value={subForm.note} onChange={e => setSubForm(s => ({ ...s, note: e.target.value }))} placeholder="Note" className="w-full border rounded p-2 h-16" />
            <div className="flex gap-2">
              <button disabled={!!subscribing} type="submit" className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-60">{subscribing ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />} Conferma</button>
              <button type="button" onClick={() => setSubForm({ pazienteId: '', pacchettoId: '', dataInizio: '', dispositiviAssegnati: [], note: '' })} className="px-4 py-2 bg-slate-200 rounded-lg">Annulla</button>
            </div>
          </form>
        ) : <p className="text-sm text-slate-500 mb-6">Seleziona “Attiva paziente” da un pacchetto per sottoscrivere.</p>}

        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><TrendingUp size={16} /> Rendicontazione mensile</h3>
        <div className="flex gap-2 mb-3">
          <select value={billingDate.mese} onChange={e => setBillingDate(s => ({ ...s, mese: Number(e.target.value) }))} className="border rounded p-2 flex-1">{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select>
          <input type="number" value={billingDate.anno} onChange={e => setBillingDate(s => ({ ...s, anno: Number(e.target.value) }))} className="border rounded p-2 w-24" />
          <button onClick={loadBilling} className="px-3 py-2 bg-slate-700 text-white rounded-lg text-sm"><TrendingUp size={14} /></button>
        </div>
        {billing && (
          <div className="bg-slate-50 border rounded-lg p-3">
            <div className="text-2xl font-bold text-teal-700"><Euro size={20} className="inline" /> {billing.importoTotale.toFixed(2)}</div>
            <div className="text-xs text-slate-500 mb-2">{billing.periodo} · {billing.sottoscrizioni} sottoscrizioni attive</div>
            <div className="text-xs font-semibold">{billing.dettaglio.map((d: any) => `${d.pazienteNome}: ${d.pacchettoNome}`).join(' · ')}</div>
          </div>
        )}
      </div>
    </div>
  );
}
