import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { Video, Plus, Activity, Calendar, AlertCircle, Loader2, RefreshCw, ClipboardList, Stethoscope, TrendingUp, Shield } from 'lucide-react';
import TelemedicinaDispositivi from '../components/TelemedicinaDispositivi';
import TelemedicinaProfessioni from '../components/TelemedicinaProfessioni';
import TelemedicinaReport from '../components/TelemedicinaReport';
import TelemedicinaGovernance from '../components/TelemedicinaGovernance';
import TelemedicinaPacchetti from '../components/TelemedicinaPacchetti';
import './Telemedicina.css';

type Teleconsulto = {
  _id: string;
  patientId: string;
  patientNome: string;
  dataOra: string;
  durataMinuti: number;
  professione: string;
  titolo: string;
  stato: 'pianificato' | 'in_corso' | 'completato' | 'annullato' | 'non_presentato';
  roomId: string;
  operatori: { userId?: string; nome: string; email: string; ruolo: string }[];
  pazientiCaregiver: { nome: string; email: string; ruolo: string }[];
  consensoVerificato: boolean;
};

type PatientMini = { _id: string; firstName: string; lastName: string; email?: string };

const professioni = [
  { value: 'medico', label: 'Medico' },
  { value: 'infermiere', label: 'Infermiere' },
  { value: 'fisioterapista', label: 'Fisioterapista' },
  { value: 'logopedista', label: 'Logopedista' },
  { value: 'psicologo', label: 'Psicologo' },
  { value: 'coordinatore', label: 'Coordinatore' },
  { value: 'generico', label: 'Generico' },
];

export default function Telemedicina() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<'agenda' | 'nuovo' | 'dispositivi' | 'professioni' | 'report' | 'governance' | 'pacchetti'>((searchParams.get('tab') as any) || 'agenda');
  const [teleconsulti, setTeleconsulti] = useState<Teleconsulto[]>([]);
  const [patients, setPatients] = useState<PatientMini[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filters, setFilters] = useState({ from: '', to: '', stato: '' });
  const [form, setForm] = useState({
    patientId: '',
    dataOra: '',
    durataMinuti: 30,
    professione: 'generico',
    titolo: '',
    note: '',
    partecipanteEmail: '',
    partecipanteNome: '',
  });

  const isPriv = useMemo(() => ['admin', 'coordinator', 'direttore'].includes(user?.role || ''), [user]);

  async function loadData() {
    try {
      setLoading(true);
      const [tRes, pRes] = await Promise.all([
        api.get('/telemedicina/teleconsulti', { params: { from: filters.from || undefined, to: filters.to || undefined, stato: filters.stato || undefined } }),
        api.get('/patients'),
      ]);
      setTeleconsulti(tRes.data);
      setPatients(pRes.data);
    } catch (err: any) {
      addToast('Errore caricamento telemedicina', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [filters.from, filters.to, filters.stato]);

  useEffect(() => {
    setSearchParams({ tab });
    const p = searchParams.get('professione');
    if (p && tab === 'nuovo') setForm(s => ({ ...s, professione: p }));
  }, [tab, setSearchParams, searchParams]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patientId || !form.dataOra) return;
    try {
      setCreating(true);
      const partecipanti = [];
      if (form.partecipanteEmail && form.partecipanteNome) {
        partecipanti.push({ email: form.partecipanteEmail.trim(), nome: form.partecipanteNome.trim() });
      }
      await api.post('/telemedicina/teleconsulti', {
        patientId: form.patientId,
        dataOra: new Date(form.dataOra).toISOString(),
        durataMinuti: Number(form.durataMinuti),
        professione: form.professione,
        titolo: form.titolo,
        notePianificazione: form.note,
        partecipantiEmail: partecipanti,
      });
      addToast('Teleconsulto creato e inviti inviati', 'success');
      setForm({ patientId: '', dataOra: '', durataMinuti: 30, professione: 'generico', titolo: '', note: '', partecipanteEmail: '', partecipanteNome: '' });
      setTab('agenda');
      await loadData();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Errore creazione teleconsulto', 'error');
    } finally {
      setCreating(false);
    }
  };

  const entraSala = async (id: string) => {
    try {
      const res = await api.post(`/telemedicina/teleconsulti/${id}/entra`);
      navigate(`/telemedicina/sala?id=${id}`);
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Errore accesso sala', 'error');
    }
  };

  const badge = (stato: string) => {
    const map: Record<string, string> = {
      pianificato: 'bg-blue-100 text-blue-800',
      in_corso: 'bg-amber-100 text-amber-800',
      completato: 'bg-emerald-100 text-emerald-800',
      annullato: 'bg-slate-100 text-slate-800',
      non_presentato: 'bg-rose-100 text-rose-800',
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${map[stato] || 'bg-gray-100'}`}>{stato.replace('_', ' ')}</span>;
  };

  return (
    <div className="telemedicina-page">
      <div className="telemedicina-header">
        <h1 className="telemedicina-title"><Video /> Telemedicina</h1>
        <div className="telemedicina-tabs">
          <button onClick={() => setTab('agenda')} className={`px-3 py-2 rounded-lg text-sm font-medium ${tab === 'agenda' ? 'bg-teal-600 text-white' : 'bg-white border'}`}>Agenda</button>
          <button onClick={() => setTab('nuovo')} className={`px-3 py-2 rounded-lg text-sm font-medium ${tab === 'nuovo' ? 'bg-teal-600 text-white' : 'bg-white border'}`}>Nuovo</button>
          {isPriv && <button onClick={() => setTab('dispositivi')} className={`px-3 py-2 rounded-lg text-sm font-medium ${tab === 'dispositivi' ? 'bg-teal-600 text-white' : 'bg-white border'}`}>Dispositivi</button>}
          <button onClick={() => setTab('professioni')} className={`px-3 py-2 rounded-lg text-sm font-medium ${tab === 'professioni' ? 'bg-teal-600 text-white' : 'bg-white border'}`}>Professioni</button>
          {isPriv && <button onClick={() => setTab('report')} className={`px-3 py-2 rounded-lg text-sm font-medium ${tab === 'report' ? 'bg-teal-600 text-white' : 'bg-white border'}`}>Report</button>}
          {isPriv && <button onClick={() => setTab('governance')} className={`px-3 py-2 rounded-lg text-sm font-medium ${tab === 'governance' ? 'bg-teal-600 text-white' : 'bg-white border'}`}>Governance</button>}
          {isPriv && <button onClick={() => setTab('pacchetti')} className={`px-3 py-2 rounded-lg text-sm font-medium ${tab === 'pacchetti' ? 'bg-teal-600 text-white' : 'bg-white border'}`}>Pacchetti</button>}
        </div>
      </div>

      {tab === 'agenda' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div><label className="text-xs text-slate-500">Da</label><input type="date" value={filters.from} onChange={e => setFilters(s => ({ ...s, from: e.target.value }))} className="w-full border rounded p-2" /></div>
            <div><label className="text-xs text-slate-500">A</label><input type="date" value={filters.to} onChange={e => setFilters(s => ({ ...s, to: e.target.value }))} className="w-full border rounded p-2" /></div>
            <div><label className="text-xs text-slate-500">Stato</label>
              <select value={filters.stato} onChange={e => setFilters(s => ({ ...s, stato: e.target.value }))} className="w-full border rounded p-2">
                <option value="">Tutti</option><option value="pianificato">Pianificato</option><option value="in_corso">In corso</option><option value="completato">Completato</option><option value="annullato">Annullato</option><option value="non_presentato">Non presentato</option>
              </select>
            </div>
            <div className="flex items-end"><button onClick={loadData} className="w-full px-3 py-2 bg-teal-600 text-white rounded-lg flex items-center justify-center gap-2"><RefreshCw size={16} /> Aggiorna</button></div>
          </div>

          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-teal-600" /></div>
          ) : teleconsulti.length === 0 ? (
            <div className="text-center p-12 border rounded-xl bg-slate-50">
              <Calendar className="mx-auto mb-2 text-slate-400" size={40} />
              <p className="text-slate-600">Nessun teleconsulto. Crea il primo dalla scheda "Nuovo".</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {teleconsulti.map(t => (
                <div key={t._id} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow transition">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg">{t.titolo || `Teleconsulto ${t.patientNome}`}</h3>
                      <p className="text-sm text-slate-500 flex items-center gap-1"><Calendar size={14} /> {new Date(t.dataOra).toLocaleString('it-IT')} · {t.durataMinuti} min · {professioni.find(p => p.value === t.professione)?.label || t.professione}</p>
                      <p className="text-sm text-slate-600">{t.patientNome}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {badge(t.stato)}
                      {!t.consensoVerificato && <span className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle size={12} /> Consenso mancante</span>}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {t.stato !== 'completato' && t.stato !== 'annullato' && (
                      <button onClick={() => entraSala(t._id)} className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"><Video size={16} /> Entra in sala</button>
                    )}
                    <button onClick={() => navigate(`/telemedicina/sala?id=${t._id}`)} className="px-3 py-2 border rounded-lg text-sm font-medium flex items-center gap-2"><ClipboardList size={16} /> Dettagli</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'nuovo' && (
        <form onSubmit={handleCreate} className="bg-white border rounded-xl p-6 max-w-2xl shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Plus size={20} /> Nuovo Teleconsulto</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Paziente</label>
              <select required value={form.patientId} onChange={e => setForm(s => ({ ...s, patientId: e.target.value }))} className="w-full border rounded p-2">
                <option value="">Seleziona paziente</option>
                {patients.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName} {p.email ? `· ${p.email}` : ''}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium mb-1">Data e ora</label><input required type="datetime-local" value={form.dataOra} onChange={e => setForm(s => ({ ...s, dataOra: e.target.value }))} className="w-full border rounded p-2" /></div>
            <div><label className="block text-sm font-medium mb-1">Durata (min)</label><input required type="number" min={5} value={form.durataMinuti} onChange={e => setForm(s => ({ ...s, durataMinuti: Number(e.target.value) }))} className="w-full border rounded p-2" /></div>
            <div><label className="block text-sm font-medium mb-1">Professione</label>
              <select value={form.professione} onChange={e => setForm(s => ({ ...s, professione: e.target.value }))} className="w-full border rounded p-2">
                {professioni.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium mb-1">Titolo</label><input type="text" value={form.titolo} onChange={e => setForm(s => ({ ...s, titolo: e.target.value }))} placeholder="es. Visita medica remota" className="w-full border rounded p-2" /></div>
          </div>
          <div className="mb-4"><label className="block text-sm font-medium mb-1">Note di pianificazione</label><textarea value={form.note} onChange={e => setForm(s => ({ ...s, note: e.target.value }))} className="w-full border rounded p-2 h-24" /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 border rounded-lg p-4 bg-slate-50">
            <div className="md:col-span-2 text-sm font-semibold text-slate-600">Partecipante esterno (caregiver/paziente)</div>
            <div><label className="block text-xs text-slate-500 mb-1">Nome</label><input type="text" value={form.partecipanteNome} onChange={e => setForm(s => ({ ...s, partecipanteNome: e.target.value }))} className="w-full border rounded p-2" /></div>
            <div><label className="block text-xs text-slate-500 mb-1">Email</label><input type="email" value={form.partecipanteEmail} onChange={e => setForm(s => ({ ...s, partecipanteEmail: e.target.value }))} className="w-full border rounded p-2" /></div>
          </div>
          <button disabled={creating} type="submit" className="px-6 py-2 bg-teal-600 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-60">
            {creating && <Loader2 className="animate-spin" size={16} />} Crea teleconsulto
          </button>
        </form>
      )}

      {tab === 'dispositivi' && isPriv && (
        <TelemedicinaDispositivi patients={patients} />
      )}

      {tab === 'professioni' && (
        <TelemedicinaProfessioni pazienteNome={patients[0] ? `${patients[0].firstName} ${patients[0].lastName}` : undefined} />
      )}

      {tab === 'report' && isPriv && (
        <TelemedicinaReport patients={patients} />
      )}

      {tab === 'governance' && isPriv && (
        <TelemedicinaGovernance patients={patients} />
      )}

      {tab === 'pacchetti' && isPriv && (
        <TelemedicinaPacchetti />
      )}
    </div>
  );
}
