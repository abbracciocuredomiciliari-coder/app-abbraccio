import { useEffect, useState } from 'react';
import api from '../api/api';
import { useToast } from '../hooks/useToast';
import { Activity, Plus, RefreshCw, AlertTriangle, Loader2, Save, Trash2 } from 'lucide-react';

type Dispositivo = { _id: string; codice: string; pazienteId: string; pazienteNome: string; tipo: string; modello?: string; serialNumber?: string; fornitore?: string; stato: string; ultimaSincronizzazione?: string; parametriSupportati: string[]; note?: string };
type Parametro = { _id: string; pazienteId: string; pazienteNome: string; tipo: string; valore: number; unita: string; rilevatoIl: string; fonte: string; anomalo: boolean; note?: string };
type Alert = { _id: string; pazienteId: string; pazienteNome: string; tipo: string; priorita: string; stato: string; messaggio: string; dettagli?: string; createdAt: string };
type PatientMini = { _id: string; firstName: string; lastName: string; email?: string };

const tipiParametro: Record<string, string> = {
  frequenza_cardiaca: 'bpm', pressione_sistolica: 'mmHg', pressione_diastolica: 'mmHg', saturazione_o2: '%', glicemia: 'mg/dL',
  temperatura: '°C', peso: 'kg', altezza: 'cm', bmi: 'kg/m²', co2: 'mmHg', passi: 'passi', dolore_nrs: 'NRS', spo2: '%', altro: '',
};

const tipiDispositivo = [
  'pressione', 'saturazione', 'glucometro', 'bilancia', 'termometro', 'elettrocardiografo', 'sfigmomanometro', 'ossimetro', 'spirometro', 'altro'
];

export default function TelemedicinaDispositivi({ patients }: { patients: PatientMini[] }) {
  const { addToast } = useToast();
  const [dispositivi, setDispositivi] = useState<Dispositivo[]>([]);
  const [parametri, setParametri] = useState<Parametro[]>([]);
  const [alert, setAlert] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [formDisp, setFormDisp] = useState({ codice: '', pazienteId: '', tipo: 'altro', modello: '', serialNumber: '', fornitore: '', parametriSupportati: [] as string[], note: '' });
  const [formParam, setFormParam] = useState({ pazienteId: '', dispositivoId: '', tipo: 'frequenza_cardiaca', valore: '', unita: 'bpm', rilevatoIl: '', note: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const [dRes, pRes, aRes] = await Promise.all([
        api.get('/telemedicina/dispositivi'),
        api.get('/telemedicina/parametri', { params: { limit: 100 } }),
        api.get('/telemedicina/alert'),
      ]);
      setDispositivi(dRes.data);
      setParametri(pRes.data);
      setAlert(aRes.data);
    } catch (err: any) {
      addToast('Errore caricamento dati', 'error');
    } finally {
      setLoading(false);
    }
  }

  const saveDispositivo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const p = patients.find(x => x._id === formDisp.pazienteId);
      await api.post('/telemedicina/dispositivi', { ...formDisp, pazienteNome: p ? `${p.firstName} ${p.lastName}` : '' });
      addToast('Dispositivo aggiunto', 'success');
      setFormDisp({ codice: '', pazienteId: '', tipo: 'altro', modello: '', serialNumber: '', fornitore: '', parametriSupportati: [], note: '' });
      await load();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Errore salvataggio', 'error');
    } finally { setSaving(false); }
  };

  const saveParametro = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const p = patients.find(x => x._id === formParam.pazienteId);
      await api.post('/telemedicina/parametri', { ...formParam, valore: Number(formParam.valore), pazienteNome: p ? `${p.firstName} ${p.lastName}` : '' });
      addToast('Parametro salvato', 'success');
      setFormParam(s => ({ ...s, valore: '', note: '' }));
      await load();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Errore salvataggio', 'error');
    } finally { setSaving(false); }
  };

  const syncDevice = async (id: string) => {
    try {
      await api.post(`/telemedicina/dispositivi/${id}/sync`);
      addToast('Sincronizzazione avviata', 'success');
      await load();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Errore sincronizzazione', 'error');
    }
  };

  const toggleParametro = (tipo: string) => {
    setFormDisp(s => ({ ...s, parametriSupportati: s.parametriSupportati.includes(tipo) ? s.parametriSupportati.filter(t => t !== tipo) : [...s.parametriSupportati, tipo] }));
  };

  const prioritaColor: Record<string, string> = { bassa: 'bg-slate-100', media: 'bg-blue-100 text-blue-800', alta: 'bg-amber-100 text-amber-800', critica: 'bg-rose-100 text-rose-800' };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-teal-600" /></div>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Activity size={20} /> Dispositivi assegnati</h2>
          {dispositivi.length === 0 ? <p className="text-sm text-slate-500">Nessun dispositivo registrato.</p> : (
            <div className="space-y-3 max-h-80 overflow-auto">
              {dispositivi.map(d => (
                <div key={d._id} className="border rounded-lg p-3 flex justify-between items-start">
                  <div>
                    <p className="font-medium">{d.codice} · <span className="capitalize">{d.tipo}</span></p>
                    <p className="text-xs text-slate-500">{d.pazienteNome} {d.modello ? `· ${d.modello}` : ''} {d.serialNumber ? `· SN ${d.serialNumber}` : ''}</p>
                    <p className="text-xs text-slate-500">Stato: <span className="font-semibold">{d.stato}</span> · {d.parametriSupportati.join(', ') || 'nessun parametro'}</p>
                  </div>
                  <button onClick={() => syncDevice(d._id)} className="p-2 rounded hover:bg-slate-100" title="Sincronizza"><RefreshCw size={16} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Plus size={20} /> Nuovo dispositivo</h2>
          <form onSubmit={saveDispositivo} className="space-y-3">
            <select required value={formDisp.pazienteId} onChange={e => setFormDisp(s => ({ ...s, pazienteId: e.target.value }))} className="w-full border rounded p-2"><option value="">Paziente</option>{patients.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}</select>
            <div className="grid grid-cols-2 gap-3"><input required value={formDisp.codice} onChange={e => setFormDisp(s => ({ ...s, codice: e.target.value }))} placeholder="Codice" className="border rounded p-2" />
            <select value={formDisp.tipo} onChange={e => setFormDisp(s => ({ ...s, tipo: e.target.value }))} className="border rounded p-2">{tipiDispositivo.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3"><input value={formDisp.modello} onChange={e => setFormDisp(s => ({ ...s, modello: e.target.value }))} placeholder="Modello" className="border rounded p-2" />
            <input value={formDisp.serialNumber} onChange={e => setFormDisp(s => ({ ...s, serialNumber: e.target.value }))} placeholder="Serial number" className="border rounded p-2" /></div>
            <input value={formDisp.fornitore} onChange={e => setFormDisp(s => ({ ...s, fornitore: e.target.value }))} placeholder="Fornitore / gateway API" className="w-full border rounded p-2" />
            <div><label className="text-xs text-slate-500">Parametri supportati</label><div className="flex flex-wrap gap-2 mt-1">{Object.keys(tipiParametro).map(t => <button key={t} type="button" onClick={() => toggleParametro(t)} className={`px-2 py-1 text-xs rounded border ${formDisp.parametriSupportati.includes(t) ? 'bg-teal-600 text-white' : 'bg-white'}`}>{t.replace(/_/g, ' ')}</button>)}</div></div>
            <button disabled={saving} type="submit" className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"><Save size={16} /> Salva dispositivo</button>
          </form>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Ultimi parametri vitali</h2>
          {parametri.length === 0 ? <p className="text-sm text-slate-500">Nessun parametro registrato.</p> : (
            <div className="space-y-2 max-h-60 overflow-auto">
              {parametri.map(p => (
                <div key={p._id} className={`p-2 rounded border flex justify-between ${p.anomalo ? 'bg-rose-50 border-rose-200' : 'bg-slate-50'}`}>
                  <span className="text-sm"><strong className="capitalize">{p.tipo.replace(/_/g, ' ')}</strong> {p.valore} {p.unita}<br /><span className="text-xs text-slate-500">{p.pazienteNome} · {new Date(p.rilevatoIl).toLocaleString('it-IT')} · {p.fonte}</span></span>
                  {p.anomalo && <AlertTriangle size={16} className="text-rose-600" />}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Activity size={20} /> Inserisci parametro manuale</h2>
          <form onSubmit={saveParametro} className="space-y-3">
            <select required value={formParam.pazienteId} onChange={e => setFormParam(s => ({ ...s, pazienteId: e.target.value }))} className="w-full border rounded p-2"><option value="">Paziente</option>{patients.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}</select>
            <select required value={formParam.tipo} onChange={e => setFormParam(s => ({ ...s, tipo: e.target.value, unita: tipiParametro[e.target.value] || '' }))} className="w-full border rounded p-2">{Object.keys(tipiParametro).map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select>
            <div className="grid grid-cols-2 gap-3"><input required type="number" step="0.01" value={formParam.valore} onChange={e => setFormParam(s => ({ ...s, valore: e.target.value }))} placeholder="Valore" className="border rounded p-2" /><input required value={formParam.unita} onChange={e => setFormParam(s => ({ ...s, unita: e.target.value }))} placeholder="Unità" className="border rounded p-2" /></div>
            <input type="datetime-local" value={formParam.rilevatoIl} onChange={e => setFormParam(s => ({ ...s, rilevatoIl: e.target.value }))} className="w-full border rounded p-2" />
            <textarea value={formParam.note} onChange={e => setFormParam(s => ({ ...s, note: e.target.value }))} placeholder="Note" className="w-full border rounded p-2 h-20" />
            <button disabled={saving} type="submit" className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-60"><Save size={16} /> Salva parametro</button>
          </form>
        </div>

        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><AlertTriangle size={20} /> Alert aperti</h2>
          {alert.length === 0 ? <p className="text-sm text-slate-500">Nessun alert attivo.</p> : (
            <div className="space-y-2 max-h-60 overflow-auto">
              {alert.map(a => (
                <div key={a._id} className={`p-3 rounded border ${prioritaColor[a.priorita] || 'bg-slate-50'}`}>
                  <p className="text-sm font-medium">{a.messaggio}</p>
                  <p className="text-xs text-slate-600">{a.pazienteNome} · {a.priorita} · {a.stato} · {new Date(a.createdAt).toLocaleString('it-IT')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
