import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useToast } from '../hooks/useToast';
import { Video, Loader2, Calendar, Clock, User } from 'lucide-react';

type Teleconsulto = {
  _id: string;
  titolo: string;
  patientNome: string;
  dataOra: string;
  durataMinuti: number;
  professione: string;
  stato: string;
  consensoVerificato: boolean;
};

const professioni: Record<string, string> = {
  medico: 'Medico', infermiere: 'Infermiere', fisioterapista: 'Fisioterapista', logopedista: 'Logopedista', psicologo: 'Psicologo', coordinatore: 'Coordinatore', generico: 'Generico'
};

export default function TelemedicinaPaziente() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [list, setList] = useState<Teleconsulto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await api.get('/telemedicina/teleconsulti', { params: { from: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10) } });
      setList(res.data.filter((t: any) => t.stato !== 'annullato'));
    } catch (err: any) {
      addToast('Errore caricamento appuntamenti', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-teal-600" /></div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-teal-700 mb-6 flex items-center gap-2"><Video /> Telemedicina</h1>
      {list.length === 0 ? (
        <div className="text-center p-8 border rounded-xl bg-slate-50 text-slate-600">
          <Calendar className="mx-auto mb-2" size={40} />
          <p>Nessun teleconsulto programmato.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map(t => (
            <div key={t._id} className="bg-white border rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-semibold text-lg">{t.titolo}</h2>
                  <p className="text-sm text-slate-500 flex items-center gap-1"><User size={14} /> {professioni[t.professione] || t.professione}</p>
                  <p className="text-sm text-slate-500 flex items-center gap-1"><Calendar size={14} /> {new Date(t.dataOra).toLocaleString('it-IT')} · <Clock size={14} /> {t.durataMinuti} min</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${t.stato === 'in_corso' ? 'bg-amber-100 text-amber-800' : t.stato === 'completato' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                  {t.stato.replace('_', ' ')}
                </span>
              </div>
              {t.stato !== 'completato' && t.stato !== 'annullato' && (
                <button onClick={() => navigate(`/telemedicina/sala?id=${t._id}`)} className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg font-medium flex items-center gap-2">
                  <Video size={18} /> Entra nella sala
                </button>
              )}
              {!t.consensoVerificato && <p className="text-xs text-amber-600 mt-2">Il consenso alla telemedicina deve essere raccolto dal personale prima della visita.</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
