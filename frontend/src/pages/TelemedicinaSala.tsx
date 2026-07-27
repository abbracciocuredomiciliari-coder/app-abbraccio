import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { PhoneOff, ClipboardList, Loader2, AlertCircle, Save, Activity } from 'lucide-react';

type Teleconsulto = {
  _id: string;
  patientId: string;
  patientNome: string;
  dataOra: string;
  professione: string;
  titolo: string;
  stato: string;
  roomId: string;
  consensoVerificato: boolean;
  diarioEntrata: string;
  diarioUscita: string;
  noteCliniche: { autoreNome: string; testo: string; inseritaIl: string }[];
};

export default function TelemedicinaSala() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id') || '';
  const [tele, setTele] = useState<Teleconsulto | null>(null);
  const [loading, setLoading] = useState(true);
  const [roomUrl, setRoomUrl] = useState('');
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) { addToast('ID teleconsulto mancante', 'error'); navigate('/telemedicina'); return; }
    loadSala();
  }, [id]);

  async function loadSala() {
    try {
      setLoading(true);
      const [tRes, eRes] = await Promise.all([
        api.get(`/telemedicina/teleconsulti/${id}`),
        api.post(`/telemedicina/teleconsulti/${id}/entra`),
      ]);
      setTele(tRes.data);
      setRoomUrl(`https://meet.jit.si/${eRes.data.roomId}#config.startWithVideoMuted=false`);
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Errore accesso sala', 'error');
      navigate('/telemedicina');
    } finally {
      setLoading(false);
    }
  }

  const termina = async () => {
    try {
      await api.patch(`/telemedicina/teleconsulti/${id}/stato`, { stato: 'completato' });
      await api.post(`/telemedicina/teleconsulti/${id}/esci`);
      addToast('Teleconsulto completato', 'success');
      navigate('/telemedicina');
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Errore chiusura', 'error');
    }
  };

  const salvaNota = async (tipo: 'nota' | 'diario_ingresso' | 'diario_uscita') => {
    if (!nota.trim()) return;
    try {
      setSaving(true);
      await api.post(`/telemedicina/teleconsulti/${id}/note`, { testo: nota, tipo });
      setNota('');
      addToast('Nota salvata', 'success');
      await loadSala();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Errore salvataggio', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="p-12 flex flex-col items-center justify-center text-slate-600">
      <Loader2 className="animate-spin mb-2" size={32} />
      <p>Caricamento sala...</p>
    </div>
  );

  if (!tele) return null;

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-white border-b px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-bold text-lg flex items-center gap-2"><Activity className="text-teal-600" /> {tele.titolo}</h1>
          <p className="text-sm text-slate-500">{tele.patientNome} · {new Date(tele.dataOra).toLocaleString('it-IT')}</p>
        </div>
        <div className="flex items-center gap-2">
          {!tele.consensoVerificato && <span className="text-amber-600 text-sm flex items-center gap-1"><AlertCircle size={14} /> Consenso mancante</span>}
          <button onClick={termina} className="px-4 py-2 bg-rose-600 text-white rounded-lg flex items-center gap-2 text-sm font-medium"><PhoneOff size={16} /> Termina</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 bg-slate-900 relative min-h-[50vh] lg:min-h-0">
          {roomUrl ? (
            <iframe allow="camera; microphone; fullscreen; display-capture" src={roomUrl} className="w-full h-full border-0" title="Sala video" />
          ) : (
            <div className="text-white flex items-center justify-center h-full">Sala non disponibile</div>
          )}
        </div>

        <div className="w-full lg:w-96 bg-white border-l overflow-y-auto p-4 flex flex-col gap-4">
          <div className="border rounded-xl p-4">
            <h2 className="font-semibold mb-2 flex items-center gap-2"><ClipboardList size={18} /> Diario / Note</h2>
            <textarea value={nota} onChange={e => setNota(e.target.value)} placeholder="Annota note cliniche o diario ingresso/uscita" className="w-full border rounded p-2 h-28 mb-2" />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => salvaNota('nota')} disabled={saving || !nota.trim()} className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm flex items-center gap-1 disabled:opacity-60"><Save size={14} /> Salva nota</button>
              <button onClick={() => salvaNota('diario_ingresso')} disabled={saving || !nota.trim()} className="px-3 py-2 border rounded-lg text-sm">Ingresso</button>
              <button onClick={() => salvaNota('diario_uscita')} disabled={saving || !nota.trim()} className="px-3 py-2 border rounded-lg text-sm">Uscita</button>
            </div>
          </div>

          <div className="border rounded-xl p-4 flex-1">
            <h3 className="font-semibold mb-2">Cronologia</h3>
            <div className="space-y-3">
              {tele.diarioEntrata && <div className="bg-teal-50 p-2 rounded"><strong className="text-xs text-teal-700">Diario ingresso</strong><p className="text-sm whitespace-pre-wrap">{tele.diarioEntrata}</p></div>}
              {tele.noteCliniche.map((n, i) => (
                <div key={i} className="bg-slate-50 p-2 rounded">
                  <strong className="text-xs text-slate-600">{n.autoreNome} · {new Date(n.inseritaIl).toLocaleString('it-IT')}</strong>
                  <p className="text-sm whitespace-pre-wrap">{n.testo}</p>
                </div>
              ))}
              {tele.diarioUscita && <div className="bg-rose-50 p-2 rounded"><strong className="text-xs text-rose-700">Diario uscita</strong><p className="text-sm whitespace-pre-wrap">{tele.diarioUscita}</p></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
