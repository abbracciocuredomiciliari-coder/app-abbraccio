import { useEffect, useState } from 'react';
import api from '../api/api';
import { useToast } from '../hooks/useToast';
import { Package, Plus, Save, Loader2, Euro, Calendar, Activity } from 'lucide-react';

type Pacchetto = { _id: string; codice: string; nome: string; descrizione: string; prezzoMensile: number; durataMinimaMesi: number; incluseProfessioni: string[]; dispositiviInclusi: string[]; visiteIncluse: number; parametriInclusi: string[]; attivo: boolean; note?: string };

const professioni = ['medico', 'infermiere', 'fisioterapista', 'logopedista', 'psicologo', 'coordinatore', 'generico'];
const tipiParametro = ['frequenza_cardiaca', 'pressione_sistolica', 'pressione_diastolica', 'saturazione_o2', 'glicemia', 'temperatura', 'peso', 'spo2', 'co2', 'passi', 'dolore_nrs', 'altro'];
const dispositivi = ['pressione', 'saturazione', 'glucometro', 'bilancia', 'termometro', 'elettrocardiografo', 'sfigmomanometro', 'ossimetro', 'spirometro', 'altro'];

export default function TelemedicinaPacchetti() {
  const { addToast } = useToast();
  const [pacchetti, setPacchetti] = useState<Pacchetto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ codice: '', nome: '', descrizione: '', prezzoMensile: '', durataMinimaMesi: 12, incluseProfessioni: [] as string[], dispositiviInclusi: [] as string[], visiteIncluse: 0, parametriInclusi: [] as string[], note: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const res = await api.get('/telemedicina/pacchetti');
      setPacchetti(res.data);
    } catch (err: any) { addToast('Errore caricamento pacchetti', 'error'); }
    finally { setLoading(false); }
  }

  const toggle = (arr: string[], val: string, set: (arr: string[]) => void) => {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post('/telemedicina/pacchetti', { ...form, prezzoMensile: Number(form.prezzoMensile) });
      addToast('Pacchetto salvato', 'success');
      setForm({ codice: '', nome: '', descrizione: '', prezzoMensile: '', durataMinimaMesi: 12, incluseProfessioni: [], dispositiviInclusi: [], visiteIncluse: 0, parametriInclusi: [], note: '' });
      await load();
    } catch (err: any) { addToast(err.response?.data?.message || 'Errore salvataggio', 'error'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-teal-600" /></div>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="bg-white border rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Package size={20} /> Pacchetti commerciali</h2>
        <div className="space-y-3 max-h-96 overflow-auto">
          {pacchetti.length === 0 ? <p className="text-sm text-slate-500">Nessun pacchetto. Crea il primo.</p> : pacchetti.map(p => (
            <div key={p._id} className="border rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div><strong>{p.nome}</strong> <span className="text-xs text-slate-500">({p.codice})</span></div>
                <span className={`text-xs px-2 py-1 rounded ${p.attivo ? 'bg-emerald-100' : 'bg-slate-100'}`}>{p.attivo ? 'attivo' : 'inattivo'}</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">{p.descrizione}</p>
              <div className="flex flex-wrap gap-2 mt-2 text-xs">
                <span className="bg-teal-50 px-2 py-1 rounded flex items-center gap-1"><Euro size={12} /> {p.prezzoMensile}/mese</span>
                <span className="bg-slate-50 px-2 py-1 rounded flex items-center gap-1"><Calendar size={12} /> {p.durataMinimaMesi} mesi</span>
                <span className="bg-slate-50 px-2 py-1 rounded flex items-center gap-1"><Activity size={12} /> {p.visiteIncluse} visite</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Professioni: {p.incluseProfessioni.join(', ') || 'tutte'} · Dispositivi: {p.dispositiviInclusi.join(', ') || 'nessuno'} · Parametri: {p.parametriInclusi.join(', ') || 'nessuno'}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Plus size={20} /> Nuovo pacchetto</h2>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input required value={form.codice} onChange={e => setForm(s => ({ ...s, codice: e.target.value }))} placeholder="Codice" className="border rounded p-2" />
            <input required type="number" min={0} step="0.01" value={form.prezzoMensile} onChange={e => setForm(s => ({ ...s, prezzoMensile: e.target.value }))} placeholder="Prezzo mensile" className="border rounded p-2" />
          </div>
          <input required value={form.nome} onChange={e => setForm(s => ({ ...s, nome: e.target.value }))} placeholder="Nome pacchetto" className="w-full border rounded p-2" />
          <textarea required value={form.descrizione} onChange={e => setForm(s => ({ ...s, descrizione: e.target.value }))} placeholder="Descrizione" className="w-full border rounded p-2 h-20" />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" min={1} value={form.durataMinimaMesi} onChange={e => setForm(s => ({ ...s, durataMinimaMesi: Number(e.target.value) }))} placeholder="Durata minima mesi" className="border rounded p-2" />
            <input type="number" min={0} value={form.visiteIncluse} onChange={e => setForm(s => ({ ...s, visiteIncluse: Number(e.target.value) }))} placeholder="Visite incluse" className="border rounded p-2" />
          </div>
          <div><label className="text-xs text-slate-500">Professioni incluse</label><div className="flex flex-wrap gap-2 mt-1">{professioni.map(p => <button key={p} type="button" onClick={() => toggle(form.incluseProfessioni, p, arr => setForm(s => ({ ...s, incluseProfessioni: arr })))} className={`px-2 py-1 text-xs rounded border ${form.incluseProfessioni.includes(p) ? 'bg-teal-600 text-white' : 'bg-white'}`}>{p}</button>)}</div></div>
          <div><label className="text-xs text-slate-500">Dispositivi inclusi</label><div className="flex flex-wrap gap-2 mt-1">{dispositivi.map(d => <button key={d} type="button" onClick={() => toggle(form.dispositiviInclusi, d, arr => setForm(s => ({ ...s, dispositiviInclusi: arr })))} className={`px-2 py-1 text-xs rounded border ${form.dispositiviInclusi.includes(d) ? 'bg-teal-600 text-white' : 'bg-white'}`}>{d}</button>)}</div></div>
          <div><label className="text-xs text-slate-500">Parametri inclusi</label><div className="flex flex-wrap gap-2 mt-1">{tipiParametro.map(t => <button key={t} type="button" onClick={() => toggle(form.parametriInclusi, t, arr => setForm(s => ({ ...s, parametriInclusi: arr })))} className={`px-2 py-1 text-xs rounded border ${form.parametriInclusi.includes(t) ? 'bg-teal-600 text-white' : 'bg-white'}`}>{t.replace(/_/g, ' ')}</button>)}</div></div>
          <textarea value={form.note} onChange={e => setForm(s => ({ ...s, note: e.target.value }))} placeholder="Note commerciali" className="w-full border rounded p-2 h-16" />
          <button disabled={saving} type="submit" className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Salva pacchetto</button>
        </form>
      </div>
    </div>
  );
}
