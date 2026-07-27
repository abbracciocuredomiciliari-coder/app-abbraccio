import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useToast } from '../hooks/useToast';
import { Stethoscope, Bone, Brain, Ear, HeartPulse, FileText, Activity, MessageSquare, Calendar, Plus, Loader2, List, Dumbbell, ClipboardList } from 'lucide-react';

type Professione = 'medico' | 'infermiere' | 'fisioterapista' | 'logopedista' | 'psicologo';

type Protocollo = {
  _id: string;
  nome: string;
  professione: string;
  descrizione: string;
  passi: string[];
  esercizi: string[];
  questionari: string[];
  soglieTipo: string[];
  attivo: boolean;
};

interface SezioneProfessionale {
  key: Professione;
  label: string;
  icon: React.ReactNode;
  colore: string;
  attivita: string[];
  strumenti: string[];
  documenti: string[];
}

const sezioni: SezioneProfessionale[] = [
  {
    key: 'medico',
    label: 'Medico',
    icon: <Stethoscope size={20} />,
    colore: 'bg-rose-50 border-rose-200 text-rose-800',
    attivita: ['Visita medica da remoto', 'Controllo compliance terapia', 'Valutazione esami strumentali', 'Gestione dolore e sintomi'],
    strumenti: ['Sfigmomanometro digitale', 'Termometro', 'Bilancia', 'Ossimetro'],
    documenti: ['Anamnesi telematica', 'Referto tele-visita', 'Lettera di riepilogo'],
  },
  {
    key: 'infermiere',
    label: 'Infermiere',
    icon: <HeartPulse size={20} />,
    colore: 'bg-sky-50 border-sky-200 text-sky-800',
    attivita: ['Tele-assistenza educazionale', 'Monitoraggio parametri vitali', 'Follow-up ferite e medicazioni', 'Supporto al caregiver'],
    strumenti: ['Glucometro', 'Termometro', 'Bilancia', 'Fascia cardio'],
    documenti: ['Scheda parametri', 'Diario infermieristico', 'Consenso informato'],
  },
  {
    key: 'fisioterapista',
    label: 'Fisioterapista',
    icon: <Bone size={20} />,
    colore: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    attivita: ['Prescrizione esercizi video', 'Valutazione ROM e forza', 'Rieducazione deambulazione', 'Gestione dolore muscolo-scheletrico'],
    strumenti: ['App esercizi', 'Video analisi movimento', 'Bilancia dinamica'],
    documenti: ['Programma riabilitativo', 'Scala valutativa', 'Referto fisioterapico'],
  },
  {
    key: 'logopedista',
    label: 'Logopedista',
    icon: <MessageSquare size={20} />,
    colore: 'bg-amber-50 border-amber-200 text-amber-800',
    attivita: ['Terapia del linguaggio a distanza', 'Rieducazione deglutizione', 'Logopedia post-ictus', 'Supporto caregiver'],
    strumenti: ['Microfono qualità', 'Tablet paziente', 'Materiali stimolazione'],
    documenti: ['Scheda logopedica', 'Obiettivi terapeutici', 'Referto'],
  },
  {
    key: 'psicologo',
    label: 'Psicologo',
    icon: <Brain size={20} />,
    colore: 'bg-violet-50 border-violet-200 text-violet-800',
    attivita: ['Colloqui psicologici da remoto', 'Counselling di coping', 'Valutazione cognitiva', 'Sostegno caregiver'],
    strumenti: ['Video sicuro', 'Questionari mood', 'Diario emozionale'],
    documenti: ['Scheda psicologica', 'Piano di supporto', 'Nota informativa'],
  },
];

function parseArrayInput(value: string): string[] {
  return value.split('\n').map(v => v.trim()).filter(Boolean);
}

export default function TelemedicinaProfessioni() {
  const [prof, setProf] = useState<Professione>('medico');
  const navigate = useNavigate();
  const { addToast } = useToast();
  const sezione = sezioni.find(s => s.key === prof)!;
  const [protocolli, setProtocolli] = useState<Protocollo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: '', descrizione: '', passi: '', esercizi: '', questionari: '', soglieTipo: '' });

  const carica = async () => {
    setLoading(true);
    try {
      const res = await api.get('/telemedicina/protocolli', { params: { professione: prof } });
      setProtocolli(res.data || []);
    } catch { addToast('Errore caricamento protocolli', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { carica(); }, [prof]);

  const crea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim() || !form.descrizione.trim()) return;
    try {
      await api.post('/telemedicina/protocolli', {
        nome: form.nome.trim(),
        professione: prof,
        descrizione: form.descrizione.trim(),
        passi: parseArrayInput(form.passi),
        esercizi: parseArrayInput(form.esercizi),
        questionari: parseArrayInput(form.questionari),
        soglieTipo: parseArrayInput(form.soglieTipo),
      });
      addToast('Protocollo creato', 'success');
      setForm({ nome: '', descrizione: '', passi: '', esercizi: '', questionari: '', soglieTipo: '' });
      setShowForm(false);
      await carica();
    } catch { addToast('Errore creazione protocollo', 'error'); }
  };

  return (
    <div className="bg-white border rounded-xl p-5 shadow-sm">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Activity size={20} /> Tele-riabilitazione e sezioni professionali</h2>
      <div className="flex flex-wrap gap-2 mb-6">
        {sezioni.map(s => (
          <button key={s.key} onClick={() => setProf(s.key)} className={`px-3 py-2 rounded-lg text-sm font-medium border flex items-center gap-2 ${prof === s.key ? s.colore : 'bg-white'}`}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="border rounded-lg p-3">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-1"><Calendar size={16} /> Attività</h3>
          <ul className="text-sm space-y-1 list-disc list-inside">{sezione.attivita.map(a => <li key={a}>{a}</li>)}</ul>
        </div>
        <div className="border rounded-lg p-3">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-1"><Activity size={16} /> Strumenti</h3>
          <ul className="text-sm space-y-1 list-disc list-inside">{sezione.strumenti.map(s => <li key={s}>{s}</li>)}</ul>
        </div>
        <div className="border rounded-lg p-3">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-1"><FileText size={16} /> Documenti</h3>
          <ul className="text-sm space-y-1 list-disc list-inside">{sezione.documenti.map(d => <li key={d}>{d}</li>)}</ul>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setShowForm(v => !v)} className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"><Plus size={16} /> {showForm ? 'Chiudi' : 'Nuovo protocollo'}</button>
        <button onClick={() => navigate(`/telemedicina?tab=nuovo&professione=${prof}`)} className="px-3 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"><Calendar size={16} /> Pianifica teleconsulto</button>
      </div>

      {showForm && (
        <form onSubmit={crea} className="bg-slate-50 border rounded-xl p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={form.nome} onChange={e => setForm(s => ({ ...s, nome: e.target.value }))} placeholder="Nome protocollo" className="border rounded p-2" />
            <input value={form.soglieTipo} onChange={e => setForm(s => ({ ...s, soglieTipo: e.target.value }))} placeholder="Parametri monitorati (separati da virgola)" className="border rounded p-2" />
          </div>
          <textarea value={form.descrizione} onChange={e => setForm(s => ({ ...s, descrizione: e.target.value }))} placeholder="Descrizione" className="w-full border rounded p-2 h-20" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className="text-xs text-slate-500 flex items-center gap-1"><List size={14} /> Passi (uno per riga)</label><textarea value={form.passi} onChange={e => setForm(s => ({ ...s, passi: e.target.value }))} className="w-full border rounded p-2 h-24" /></div>
            <div><label className="text-xs text-slate-500 flex items-center gap-1"><Dumbbell size={14} /> Esercizi (uno per riga)</label><textarea value={form.esercizi} onChange={e => setForm(s => ({ ...s, esercizi: e.target.value }))} className="w-full border rounded p-2 h-24" /></div>
            <div><label className="text-xs text-slate-500 flex items-center gap-1"><ClipboardList size={14} /> Questionari (uno per riga)</label><textarea value={form.questionari} onChange={e => setForm(s => ({ ...s, questionari: e.target.value }))} className="w-full border rounded p-2 h-24" /></div>
          </div>
          <div className="flex justify-end"><button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium flex items-center gap-2"><Plus size={16} /> Salva protocollo</button></div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-teal-600" /></div>
      ) : (
        <div className="space-y-3">
          {protocolli.length === 0 ? (
            <p className="text-slate-500 text-sm">Nessun protocollo per {sezione.label.toLowerCase()}. Crea il primo.</p>
          ) : (
            protocolli.map(p => (
              <div key={p._id} className="border rounded-lg p-4 bg-white">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-semibold">{p.nome}</div>
                    <p className="text-sm text-slate-600">{p.descrizione}</p>
                  </div>
                  <button onClick={() => navigate(`/telemedicina?tab=nuovo&professione=${prof}&protocolloId=${p._id}`)} className="px-3 py-1.5 bg-teal-600 text-white rounded text-sm flex items-center gap-1"><Calendar size={14} /> Pianifica</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  {p.passi.length > 0 && <div className="bg-slate-50 rounded p-2"><strong className="text-xs uppercase text-slate-500">Passi</strong><ul className="list-disc list-inside">{p.passi.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                  {p.esercizi.length > 0 && <div className="bg-slate-50 rounded p-2"><strong className="text-xs uppercase text-slate-500">Esercizi</strong><ul className="list-disc list-inside">{p.esercizi.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                  {p.questionari.length > 0 && <div className="bg-slate-50 rounded p-2"><strong className="text-xs uppercase text-slate-500">Questionari</strong><ul className="list-disc list-inside">{p.questionari.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
