import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, Bone, Brain, Ear, HeartPulse, FileText, Activity, MessageSquare, Calendar } from 'lucide-react';

type Professione = 'medico' | 'infermiere' | 'fisioterapista' | 'logopedista' | 'psicologo';

interface SezioneProfessionale {
  key: Professione;
  label: string;
  icon: React.ReactNode;
  colore: string;
  ambito: string;
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
    ambito: 'Visite remote, controllo terapie, revisione esami, counselling e gestione cronicità.',
    attivita: ['Visita medica da remoto', 'Controllo compliance terapia', 'Valutazione esami strumentali', 'Gestione dolore e sintomi'],
    strumenti: ['Sfigmomanometro digitale', 'Termometro', 'Bilancia', 'Ossimetro'],
    documenti: ['Anamnesi telematica', 'Referto tele-visita', 'Lettera di riepilogo'],
  },
  {
    key: 'infermiere',
    label: 'Infermiere',
    icon: <HeartPulse size={20} />,
    colore: 'bg-sky-50 border-sky-200 text-sky-800',
    ambito: 'Educazione terapeutica, controllo parametri, gestione ferite e follow-up post-dimissione.',
    attivita: ['Tele-assistenza educazionale', 'Monitoraggio parametri vitali', 'Follow-up ferite e medicazioni', 'Supporto al caregiver'],
    strumenti: ['Glucometro', 'Termometro', 'Bilancia', 'Fascia cardio'],
    documenti: ['Scheda parametri', 'Diario infermieristico', 'Consenso informato'],
  },
  {
    key: 'fisioterapista',
    label: 'Fisioterapista',
    icon: <Bone size={20} />,
    colore: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    ambito: 'Riabilitazione motoria remota, esercizi prescritti, valutazione funzionale e monitoraggio adesione.',
    attivita: ['Prescrizione esercizi video', 'Valutazione ROM e forza', 'Rieducazione deambulazione', 'Gestione dolore muscolo-scheletrico'],
    strumenti: ['App esercizi', 'Video analisi movimento', 'Bilancia dinamica'],
    documenti: ['Programma riabilitativo', 'Scala valutativa', 'Referto fisioterapico'],
  },
  {
    key: 'logopedista',
    label: 'Logopedista',
    icon: <MessageSquare size={20} />,
    colore: 'bg-amber-50 border-amber-200 text-amber-800',
    ambito: 'Riabilitazione del linguaggio, deglutizione e comunicazione con sedute video e esercizi da remoto.',
    attivita: ['Terapia del linguaggio a distanza', 'Rieducazione deglutizione', 'Logopedia post-ictus', 'Supporto caregiver'],
    strumenti: ['Microfono qualità', 'Tablet paziente', 'Materiali stimolazione'],
    documenti: ['Scheda logopedica', 'Obiettivi terapeutici', 'Referto'],
  },
  {
    key: 'psicologo',
    label: 'Psicologo',
    icon: <Brain size={20} />,
    colore: 'bg-violet-50 border-violet-200 text-violet-800',
    ambito: 'Sostegno psicologico, counselling, attivazione reti e gestione dello stress di paziente e caregiver.',
    attivita: ['Colloqui psicologici da remoto', 'Counselling di coping', 'Valutazione cognitiva', 'Sostegno caregiver'],
    strumenti: ['Video sicuro', 'Questionari mood', 'Diario emozionale'],
    documenti: ['Scheda psicologica', 'Piano di supporto', 'Nota informativa'],
  },
];

export default function TelemedicinaProfessioni({ pazienteNome }: { pazienteNome?: string }) {
  const [prof, setProf] = useState<Professione>('medico');
  const navigate = useNavigate();
  const sezione = sezioni.find(s => s.key === prof)!;

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
      <div className={`rounded-xl border p-5 ${sezione.colore} mb-6`}>
        <div className="flex items-center gap-2 font-bold text-lg mb-2">{sezione.icon} {sezione.label}</div>
        <p className="text-sm opacity-90">{sezione.ambito}</p>
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
      <button onClick={() => navigate(`/telemedicina?tab=nuovo&professione=${prof}`)} className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium flex items-center gap-2">
        <Calendar size={18} /> Pianifica teleconsulto {sezione.label.toLowerCase()}
      </button>
    </div>
  );
}
