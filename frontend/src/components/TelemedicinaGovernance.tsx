import { useEffect, useState } from 'react';
import api from '../api/api';
import { useToast } from '../hooks/useToast';
import { Shield, Plus, Save, Activity, FileText, Loader2, Trash2 } from 'lucide-react';

type Soglia = { _id: string; pazienteId?: string; pazienteNome?: string; tipoParametro: string; min?: number; max?: number; unita: string; professione?: string; attiva: boolean; note?: string };
type Protocollo = { _id: string; nome: string; professione: string; descrizione: string; passi: string[]; soglieTipo: string[]; attivo: boolean };

type PatientMini = { _id: string; firstName: string; lastName: string };

const tipiParametro = [
  'frequenza_cardiaca', 'pressione_sistolica', 'pressione_diastolica', 'saturazione_o2', 'glicemia',
  'temperatura', 'peso', 'spo2', 'co2', 'passi', 'dolore_nrs', 'altro'
];

const professioni = ['medico', 'infermiere', 'fisioterapista', 'logopedista', 'psicologo', 'coordinatore', 'generico'];

export default function TelemedicinaGovernance({ patients }: { patients: PatientMini[] }) {
  const { addToast } = useToast();
  const [soglie, setSoglie] = useState<Soglia[]>([]);
  const [protocolli, setProtocolli] = useState<Protocollo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sogliaForm, setSogliaForm] = useState({ pazienteId: '', tipoParametro: 'frequenza_cardiaca', min: '', max: '', unita: 'bpm', professione: '', note: '' });
  const [protForm, setProtForm] = useState({ nome: '', professione: 'medico', descrizione: '', passi: '', soglieTipo: [] as string[] });

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const [sRes, pRes] = await Promise.all([api.get('/telemedicina/soglie'), api.get('/telemedicina/protocolli')]);
      setSoglie(sRes.data);
      setProtocolli(pRes.data);
    } catch (err: any) {
      addToast('Errore caricamento governance', 'error');
    } finally { setLoading(false); }
  }

  const salvaSoglia = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const p = patients.find(x => x._id === sogliaForm.pazienteId);
      await api.post('/telemedicina/soglie', {
        ...sogliaForm,
        pazienteNome: p ? `${p.firstName} ${p.lastName}` : undefined,
        min: sogliaForm.min ? Number(sogliaForm.min) : undefined,
        max: sogliaForm.max ? Number(sogliaForm.max) : undefined,
      });
      addToast('Soglia salvata', 'success');
      setSogliaForm({ pazienteId: '', tipoParametro: 'frequenza_cardiaca', min: '', max: '', unita: 'bpm', professione: '', note: '' });
      await load();
    } catch (err: any) { addToast(err.response?.data?.message || 'Errore salvataggio', 'error'); }
    finally { setSaving(false); }
  };

  const salvaProtocollo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post('/telemedicina/protocolli', { ...protForm, passi: protForm.passi.split('\n').filter(Boolean) });
      addToast('Protocollo salvato', 'success');
      setProtForm({ nome: '', professione: 'medico', descrizione: '', passi: '', soglieTipo: [] });
      await load();
    } catch (err: any) { addToast(err.response?.data?.message || 'Errore salvataggio', 'error'); }
    finally { setSaving(false); }
  };

  const toggleTipo = (tipo: string) => {
    setProtForm(s => ({ ...s, soglieTipo: s.soglieTipo.includes(tipo) ? s.soglieTipo.filter(t => t !== tipo) : [...s.soglieTipo, tipo] }));
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-teal-600" /></div>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="bg-white border rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Shield size={20} /> Soglie parametri</h2>
        <div className="max-h-60 overflow-auto space-y-2 mb-4">
          {soglie.length === 0 ? <p className="text-sm text-slate-500">Nessuna soglia personalizzata. Vengono usati i valori di default.</p> : soglie.map(s => (
            <div key={s._id} className="border rounded p-2 text-sm flex justify-between items-center">
              <div><strong>{s.tipoParametro.replace(/_/g, ' ')}</strong> {s.min ?? ''}-{s.max ?? ''} {s.unita} {s.pazienteNome ? `· ${s.pazienteNome}` : '· globale'} {s.professione ? `· ${s.professione}` : ''}</div>
              <span className={`text-xs px-2 py-1 rounded ${s.attiva ? 'bg-emerald-100' : 'bg-slate-100'}`}>{s.attiva ? 'attiva' : 'disattiva'}</span>
            </div>
          ))}
        </div>
        <form onSubmit={salvaSoglia} className="space-y-3 border rounded-lg p-3 bg-slate-50">
          <div className="grid grid-cols-2 gap-3">
            <select value={sogliaForm.pazienteId} onChange={e => setSogliaForm(s => ({ ...s, pazienteId: e.target.value }))} className="border rounded p-2"><option value="">Globale (tutti)</option>{patients.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}</select>
            <select required value={sogliaForm.tipoParametro} onChange={e => setSogliaForm(s => ({ ...s, tipoParametro: e.target.value }))} className="border rounded p-2">{tipiParametro.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select>
            <input type="number" step="0.01" value={sogliaForm.min} onChange={e => setSogliaForm(s => ({ ...s, min: e.target.value }))} placeholder="Min" className="border rounded p-2" />
            <input type="number" step="0.01" value={sogliaForm.max} onChange={e => setSogliaForm(s => ({ ...s, max: e.target.value }))} placeholder="Max" className="border rounded p-2" />
            <input value={sogliaForm.unita} onChange={e => setSogliaForm(s => ({ ...s, unita: e.target.value }))} placeholder="Unità" className="border rounded p-2" required />
            <select value={sogliaForm.professione} onChange={e => setSogliaForm(s => ({ ...s, professione: e.target.value }))} className="border rounded p-2"><option value="">Tutte le professioni</option>{professioni.map(p => <option key={p} value={p}>{p}</option>)}</select>
          </div>
          <textarea value={sogliaForm.note} onChange={e => setSogliaForm(s => ({ ...s, note: e.target.value }))} placeholder="Note" className="w-full border rounded p-2 h-16" />
          <button disabled={saving} type="submit" className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"><Save size={16} /> Salva soglia</button>
        </form>
      </div>

      <div className="bg-white border rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><FileText size={20} /> Protocolli</h2>
        <div className="max-h-60 overflow-auto space-y-2 mb-4">
          {protocolli.length === 0 ? <p className="text-sm text-slate-500">Nessun protocollo. Crea il primo per uniformare i percorsi.</p> : protocolli.map(p => (
            <div key={p._id} className="border rounded p-2 text-sm">
              <strong>{p.nome}</strong> · {p.professione} · {p.attivo ? 'attivo' : 'inattivo'}
              <p className="text-xs text-slate-500">{p.descrizione}</p>
            </div>
          ))}
        </div>
        <form onSubmit={salvaProtocollo} className="space-y-3 border rounded-lg p-3 bg-slate-50">
          <input required value={protForm.nome} onChange={e => setProtForm(s => ({ ...s, nome: e.target.value }))} placeholder="Nome protocollo" className="w-full border rounded p-2" />
          <select required value={protForm.professione} onChange={e => setProtForm(s => ({ ...s, professione: e.target.value }))} className="w-full border rounded p-2">{professioni.map(p => <option key={p} value={p}>{p}</option>)}</select>
          <textarea required value={protForm.descrizione} onChange={e => setProtForm(s => ({ ...s, descrizione: e.target.value }))} placeholder="Descrizione" className="w-full border rounded p-2 h-16" />
          <textarea value={protForm.passi} onChange={e => setProtForm(s => ({ ...s, passi: e.target.value }))} placeholder="Passi (uno per riga)" className="w-full border rounded p-2 h-20" />
          <div><label className="text-xs text-slate-500">Parametri monitorati</label><div className="flex flex-wrap gap-2 mt-1">{tipiParametro.map(t => <button key={t} type="button" onClick={() => toggleTipo(t)} className={`px-2 py-1 text-xs rounded border ${protForm.soglieTipo.includes(t) ? 'bg-teal-600 text-white' : 'bg-white'}`}>{t.replace(/_/g, ' ')}</button>)}</div></div>
          <button disabled={saving} type="submit" className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"><Save size={16} /> Salva protocollo</button>
        </form>
      </div>
    </div>
  );
}
