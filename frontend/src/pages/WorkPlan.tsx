import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import EsamiStrumentali from './EsamiStrumentali';
import {
  Calendar,
  Plus,
  TestTube2,
  Bandage,
  Activity,
  Clock,
  Users,
  CalendarDays,
  Trash2,
  CheckCircle,
  AlertCircle,
  Search,
  Link2,
  Copy,
  Euro,
  ClipboardList,
  X,
  Archive,
  HeartPulse,
  Syringe,
  FileText,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';

interface PatientOption {
  _id: string;
  firstName: string;
  lastName: string;
}

interface StaffMember {
  _id: string;
  firstName: string;
  lastName: string;
  role: string;
  category: string;
  active: boolean;
}

interface GiornoSettimana {
  giorno: number; // 0=Dom, 1=Lun, ..., 6=Sab
  accessiAlGiorno: number;
  minutiPerAccesso: number;
}

interface WorkPlanItem {
  _id: string;
  type: 'prestazionale' | 'assistenziale';
  category?: string; // retrocompatibilità
  categories?: string[];
  tipoEsame?: string;
  patient: PatientOption;
  staff: StaffMember;
  date: string;
  dataFine?: string;
  time?: string;
  duration?: number;
  task: string;
  notes?: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
  giorniSettimana?: GiornoSettimana[];
  tipoCompenso?: 'orario' | 'fisso' | 'nessuno';
  tariffa?: number;
  compensoTotale?: number;
  compensoPagato?: boolean;
  costoPrestazione?: number;
}

interface Accesso {
  _id: string;
  staffName: string;
  staffRole: string;
  oraEntrata: string;
  oraUscita?: string;
  note?: string;
  firmaLogin: string;
  durataMinuti?: number;
  compensoMaturato?: number;
}

interface RiepilogoAccessi {
  totaleAccessi: number;
  accessiCompletati: number;
  accessiAperti: number;
  minutiTotali: number;
  oreTotali: number;
  compensoCalcolato: number;
  compensoSalvato: number;
  compensoPagato: boolean;
  costoPrestazione: number;
  utile: number;
}

// ─── Catalogo completo prestazioni SIAT/ADI ───────────────────────────────────────────
type CatPrestazione = 'infermieristica' | 'riabilitativa' | 'medica' | 'assistenziale' | 'sociale';

interface PrestazioneForm {
  id: string; // uuid locale per React key
  categoria: CatPrestazione;
  tipoPrestazione: string;
  staff: string;
  note: string;
}

interface CatalogoPrestazione {
  value: string;
  label: string;
  categoria: CatPrestazione;
  color: string;
}

const CATALOGO_PRESTAZIONI: CatalogoPrestazione[] = [
  // ── INFERMIERISTICHE ──
  { value: 'valutazione_infermieristica',   label: 'Valutazione infermieristica',             categoria: 'infermieristica', color: '#2563eb' },
  { value: 'medicazione_lesione',            label: 'Medicazione lesione / ferita',             categoria: 'infermieristica', color: '#2563eb' },
  { value: 'medicazione_ulcera_pressione',   label: 'Medicazione ulcera da pressione',          categoria: 'infermieristica', color: '#2563eb' },
  { value: 'medicazione_ulcera_vascolare',   label: 'Medicazione ulcera vascolare',             categoria: 'infermieristica', color: '#2563eb' },
  { value: 'medicazione_stomia',             label: 'Gestione e medicazione stomia',            categoria: 'infermieristica', color: '#2563eb' },
  { value: 'cateterismo_vescicale',          label: 'Cateterismo vescicale / gestione CV',      categoria: 'infermieristica', color: '#2563eb' },
  { value: 'gestione_catetere_cv',           label: 'Gestione catetere venoso centrale',        categoria: 'infermieristica', color: '#2563eb' },
  { value: 'gestione_pic',                   label: 'Gestione PICC/Port',                       categoria: 'infermieristica', color: '#2563eb' },
  { value: 'infusione_ev',                   label: 'Infusione endovenosa / terapia parenterale',categoria: 'infermieristica', color: '#2563eb' },
  { value: 'iniezione_sc_im',                label: 'Iniezione sottocutanea / intramuscolare',  categoria: 'infermieristica', color: '#2563eb' },
  { value: 'gestione_npt',                   label: 'Nutrizione parenterale totale (NPT)',      categoria: 'infermieristica', color: '#2563eb' },
  { value: 'gestione_peg',                   label: 'Nutrizione enterale / gestione PEG/SNG',   categoria: 'infermieristica', color: '#2563eb' },
  { value: 'aspirazione_tracheale',          label: 'Aspirazione tracheale',                    categoria: 'infermieristica', color: '#2563eb' },
  { value: 'gestione_tracheostomia',         label: 'Gestione tracheostomia',                   categoria: 'infermieristica', color: '#2563eb' },
  { value: 'ossigenoterapia',                label: 'Ossigenoterapia / gestione O₂',             categoria: 'infermieristica', color: '#2563eb' },
  { value: 'gestione_ventilatore',           label: 'Gestione ventilatore meccanico',           categoria: 'infermieristica', color: '#2563eb' },
  { value: 'prelievo_ematico',               label: 'Prelievo ematico / venoso',               categoria: 'infermieristica', color: '#2563eb' },
  { value: 'ecg',                            label: 'Elettrocardiogramma (ECG)',                categoria: 'infermieristica', color: '#2563eb' },
  { value: 'monitoraggio_parametri',         label: 'Monitoraggio parametri vitali',           categoria: 'infermieristica', color: '#2563eb' },
  { value: 'glicemia_capillare',             label: 'Glicemia capillare / gestione insulina',  categoria: 'infermieristica', color: '#2563eb' },
  { value: 'clistere_enteroclisma',          label: 'Clistere / enteroclisma',                 categoria: 'infermieristica', color: '#2563eb' },
  { value: 'raccolta_campioni',              label: 'Raccolta campioni biologici',             categoria: 'infermieristica', color: '#2563eb' },
  { value: 'valutazione_braden',             label: 'Valutazione scala Braden',                categoria: 'infermieristica', color: '#2563eb' },
  { value: 'valutazione_barthel',            label: 'Valutazione scala Barthel',               categoria: 'infermieristica', color: '#2563eb' },
  { value: 'educazione_sanitaria',           label: 'Educazione sanitaria a paziente/caregiver',categoria: 'infermieristica', color: '#2563eb' },
  { value: 'gestione_pompa_infusionale',     label: 'Gestione pompa infusionale',              categoria: 'infermieristica', color: '#2563eb' },
  { value: 'gestione_drenaggio',             label: 'Gestione drenaggio / tubo di toraci',     categoria: 'infermieristica', color: '#2563eb' },
  { value: 'terapia_inalatoria',             label: 'Terapia inalatoria / aerosol',            categoria: 'infermieristica', color: '#2563eb' },
  // ── RIABILITATIVE ──
  { value: 'valutazione_fisioterapica',      label: 'Valutazione fisioterapica',               categoria: 'riabilitativa', color: '#16a34a' },
  { value: 'fisioterapia_motoria',           label: 'Fisioterapia motoria / mobilizzazione',   categoria: 'riabilitativa', color: '#16a34a' },
  { value: 'rieducazione_posturale',         label: 'Rieducazione posturale',                  categoria: 'riabilitativa', color: '#16a34a' },
  { value: 'riabilitazione_neurologica',     label: 'Riabilitazione neurologica',              categoria: 'riabilitativa', color: '#16a34a' },
  { value: 'riabilitazione_ortopedica',      label: 'Riabilitazione ortopedica',               categoria: 'riabilitativa', color: '#16a34a' },
  { value: 'riabilitazione_respiratoria',    label: 'Riabilitazione respiratoria',             categoria: 'riabilitativa', color: '#16a34a' },
  { value: 'riabilitazione_cardiologica',    label: 'Riabilitazione cardiologica',             categoria: 'riabilitativa', color: '#16a34a' },
  { value: 'terapia_occupazionale',          label: 'Terapia occupazionale',                   categoria: 'riabilitativa', color: '#16a34a' },
  { value: 'logopedia',                      label: 'Logopedia / rieducazione deglutizione',   categoria: 'riabilitativa', color: '#16a34a' },
  { value: 'massoterapia',                   label: 'Massoterapia / linfodrenaggio',           categoria: 'riabilitativa', color: '#16a34a' },
  { value: 'tens_elettrostimolazione',       label: 'TENS / Elettrostimolazione',              categoria: 'riabilitativa', color: '#16a34a' },
  { value: 'valutazione_deambulazione',      label: 'Addestramento deambulazione / ausili',    categoria: 'riabilitativa', color: '#16a34a' },
  { value: 'valutazione_psicomotoria',       label: 'Valutazione psicomotoria',                categoria: 'riabilitativa', color: '#16a34a' },
  // ── MEDICHE ──
  { value: 'visita_medica',                  label: 'Visita medica domiciliare',               categoria: 'medica', color: '#dc2626' },
  { value: 'valutazione_medica_urgente',     label: 'Valutazione medica urgente',              categoria: 'medica', color: '#dc2626' },
  { value: 'prescrizione_terapia',           label: 'Prescrizione / revisione terapia farmacologica', categoria: 'medica', color: '#dc2626' },
  { value: 'visita_specialistica_dom',       label: 'Visita specialistica domiciliare',        categoria: 'medica', color: '#dc2626' },
  { value: 'ecografia_dom',                  label: 'Ecografia domiciliare',                   categoria: 'medica', color: '#dc2626' },
  { value: 'holter_ecg',                     label: 'Holter ECG applicazione/refertazione',    categoria: 'medica', color: '#dc2626' },
  { value: 'piano_terapeutico',              label: 'Redazione piano terapeutico ADI',         categoria: 'medica', color: '#dc2626' },
  { value: 'valutazione_multidimensionale',  label: 'Valutazione multidimensionale (UVM)',     categoria: 'medica', color: '#dc2626' },
  { value: 'certificazione_medica',          label: 'Certificazione / documentazione medica',  categoria: 'medica', color: '#dc2626' },
  // ── ASSISTENZIALI ──
  { value: 'igiene_personale',               label: 'Igiene personale / bagno assistito',      categoria: 'assistenziale', color: '#d97706' },
  { value: 'mobilizzazione_posizionamento',  label: 'Mobilizzazione e posizionamento',         categoria: 'assistenziale', color: '#d97706' },
  { value: 'assistenza_alimentazione',       label: 'Assistenza all’alimentazione',             categoria: 'assistenziale', color: '#d97706' },
  { value: 'assistenza_eliminazione',        label: 'Assistenza eliminazione urinaria/fecale', categoria: 'assistenziale', color: '#d97706' },
  { value: 'assistenza_oraria',              label: 'Assistenza oraria domiciliare',           categoria: 'assistenziale', color: '#d97706' },
  { value: 'sorveglianza_notturna',          label: 'Sorveglianza notturna',                   categoria: 'assistenziale', color: '#d97706' },
  { value: 'accompagnamento',                label: 'Accompagnamento visite / commissioni',    categoria: 'assistenziale', color: '#d97706' },
  { value: 'supporto_caregiver',             label: 'Supporto e sollievo al caregiver',        categoria: 'assistenziale', color: '#d97706' },
  { value: 'gestione_farmaci',               label: 'Gestione e somministrazione farmaci orali',categoria: 'assistenziale', color: '#d97706' },
  // ── SOCIALI ──
  { value: 'valutazione_sociale',            label: 'Valutazione sociale domiciliare',         categoria: 'sociale', color: '#7c3aed' },
  { value: 'sostegno_psicologico',           label: 'Sostegno psicologico / ascolto attivo',   categoria: 'sociale', color: '#7c3aed' },
  { value: 'attivazione_servizi',            label: 'Attivazione servizi territoriali',        categoria: 'sociale', color: '#7c3aed' },
  { value: 'segretariato_sociale',           label: 'Segretariato sociale / orientamento',     categoria: 'sociale', color: '#7c3aed' },
];

const CATEGORIA_LABELS: Record<CatPrestazione, { label: string; color: string; bg: string }> = {
  infermieristica: { label: '💉 Infermieristica', color: '#2563eb', bg: '#eff6ff' },
  riabilitativa:   { label: '🏃 Riabilitativa',   color: '#16a34a', bg: '#f0fdf4' },
  medica:          { label: '🩺 Medica',          color: '#dc2626', bg: '#fef2f2' },
  assistenziale:   { label: '🤍 Assistenziale',  color: '#d97706', bg: '#fffbeb' },
  sociale:         { label: '🤝 Sociale',         color: '#7c3aed', bg: '#fdf4ff' },
};

const CATEGORIE_ORDINE: CatPrestazione[] = ['infermieristica','riabilitativa','medica','assistenziale','sociale'];

// ═════════════════════════════════════════════════════════════════════════════
// FABBISOGNI per le 3 macro-categorie admin (Infermieristico, Riabilitativo, Medico/specialistiche)
// ═════════════════════════════════════════════════════════════════════════════
const FABBISOGNI_OPTIONS = {
  infermieristico: [
    { value: 'medicazioni', label: 'Medicazioni' },
    { value: 'prelievi', label: 'Prelievi ematici' },
    { value: 'catetere', label: 'Gestione catetere vescicale' },
    { value: 'picc', label: 'Gestione PICC/Port-a-Cath' },
    { value: 'peg', label: 'Gestione PEG (sonda enterale)' },
    { value: 'tracheo', label: 'Gestione tracheostomia' },
    { value: 'ossigeno', label: 'Gestione ossigenoterapia' },
    { value: 'parametri', label: 'Controllo parametri vitali' },
    { value: 'insulina', label: 'Somministrazione insulina' },
    { value: 'terapia', label: 'Terapia farmacologica' },
    { value: 'prevenzione', label: 'Prevenzione lesioni da decubito' },
    { value: 'igiene', label: 'Assistenza igienica' },
    { value: 'mobilizzazione', label: 'Mobilizzazione e cambio postura' },
    { value: 'altro', label: 'Altro (specificare in note)' },
  ],
  riabilitativo: [
    { value: 'fisio_motorio', label: 'Fisioterapia motoria' },
    { value: 'fisio_respiratoria', label: 'Fisioterapia respiratoria' },
    { value: 'riabilitazione', label: 'Riabilitazione post-chirurgica' },
    { value: 'riabilitazione_ictus', label: 'Riabilitazione post-ictus' },
    { value: 'deambulazione', label: 'Training deambulazione' },
    { value: 'equilibrio', label: 'Rieducazione equilibrio' },
    { value: 'logopedia', label: 'Logopedia' },
    { value: 'terapia_occupazionale', label: 'Terapia occupazionale' },
    { value: 'tens', label: 'TENS / elettroterapia' },
    { value: 'altro', label: 'Altro (specificare in note)' },
  ],
  medico_specialistiche: [
    { value: 'visita_medica', label: 'Visita medica domiciliare' },
    { value: 'ecg', label: 'ECG' },
    { value: 'ecografia', label: 'Ecografia' },
    { value: 'rx', label: 'Rx domiciliare' },
    { value: 'specialistica_cardio', label: 'Visita specialistica cardiologica' },
    { value: 'specialistica_neuro', label: 'Visita specialistica neurologica' },
    { value: 'specialistica_gm', label: 'Visita specialistica geriatrica' },
    { value: 'specialistica_pneumo', label: 'Visita specialistica pneumologica' },
    { value: 'wound_care', label: 'Wound care specialistica' },
    { value: 'valutazione_pai', label: 'Valutazione PAI' },
    { value: 'piano_terapeutico', label: 'Piano terapeutico ADI' },
    { value: 'altro', label: 'Altro (specificare in note)' },
  ],
};

const MACRO_CATEGORIE_LABELS: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  infermieristico: { label: '💉 Infermieristico', color: '#2563eb', bg: '#eff6ff', icon: null },
  riabilitativo: { label: '🏃 Riabilitativo', color: '#16a34a', bg: '#f0fdf4', icon: null },
  medico_specialistiche: { label: '🩺 Medico e Specialistiche', color: '#7c3aed', bg: '#f5f3ff', icon: null },
};

// retrocompatibilità per la lista esistente
const prestazioneCategories = [
  { value: 'esame_ematico', label: 'Esame Ematico', icon: TestTube2, color: '#ef4444' },
  { value: 'medicazione', label: 'Medicazione', icon: Bandage, color: '#f59e0b' },
  { value: 'prestazione_varia', label: 'Prestazione Varia', icon: Activity, color: '#10b981' },
];

const assistenzaCategories = [
  { value: 'assistenza_oraria', label: 'Assistenza Oraria', icon: Clock, color: '#3b82f6' },
  { value: 'variazione_orario', label: 'Variazione Orario', icon: CalendarDays, color: '#8b5cf6' },
  { value: 'visita_programmata', label: 'Visita Programmata', icon: Users, color: '#06b6d4' },
];

// TIPI SERVIZIO - UI a card colorate come RichiestaServizio.tsx
const TIPI_SERVIZIO = [
  { value: 'prelievo', label: 'Prelievo', emoji: '💉', color: '#dc2626', bg: '#fee2e2', Icon: Syringe,
    tipi: ['Emocromo completo','Glicemia','Coagulazione (PT/INR/aPTT)','Elettroliti','Funzionalità epatica','Funzionalità renale','Profilo lipidico','Ormoni tiroidei (TSH/fT4)','PCR / VES','Esame urine','Emogasanalisi','Altro'] },
  { value: 'esame_strumentale', label: 'Esame Strumentale', emoji: '🔬', color: '#7c3aed', bg: '#ede9fe', Icon: HeartPulse,
    tipi: ['ECG','Holter ECG','Holter pressorio','Glicemia capillare','EGA','Spirometria','Ecocardiogramma','Polisonnografia','Titolazione CPAP','Altro'] },
  { value: 'prestazione', label: 'Prestazione Infermieristica', emoji: '🏥', color: '#0369a1', bg: '#eff6ff', Icon: Activity,
    tipi: ['Medicazione','Somministrazione farmaci','Misurazione parametri vitali','Cateterismo','Gestione stomia','Prelievo arterioso','Altro'] },
  { value: 'riabilitazione', label: 'Riabilitazione', emoji: '🏋️', color: '#16a34a', bg: '#dcfce7', Icon: Activity,
    tipi: ['Fisioterapia','Logopedia','Ergoterapia','Neuro-riabilitazione','Riabilitazione respiratoria','Altro'] },
  { value: 'medico', label: 'Visita Medica', emoji: '👨‍⚕️', color: '#2563eb', bg: '#dbeafe', Icon: HeartPulse,
    tipi: ['Visita generale','Visita specialista','Consulenza geriatrica','Valutazione clinica','Prescrizione terapia','Altro'] },
];

function WorkPlan() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Tab principale: piano di lavoro (prestazionale/assistenziale) oppure esami strumentali
  const [mainTab, setMainTab] = useState<'piano' | 'esami'>('piano');
  const [workplans, setWorkplans] = useState<WorkPlanItem[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [activeTab, setActiveTab] = useState<'prestazionale' | 'assistenziale'>('prestazionale');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredWorkplans, setFilteredWorkplans] = useState<WorkPlanItem[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Modal storico accessi + compenso
  const [showAccessiModal, setShowAccessiModal] = useState(false);
  const [selectedWorkPlan, setSelectedWorkPlan] = useState<WorkPlanItem | null>(null);
  const [accessi, setAccessi] = useState<Accesso[]>([]);
  const [riepilogo, setRiepilogo] = useState<RiepilogoAccessi | null>(null);
  const [loadingAccessi, setLoadingAccessi] = useState(false);

  // Diario clinico nel modal
  const [diarioModal, setDiarioModal] = useState<any[]>([]);
  const [showDiarioModal, setShowDiarioModal] = useState(false);

  // Obiettivi nel modal
  const [obiettiviModal, setObiettiviModal] = useState<any[]>([]);
  const [showObiettiviModal, setShowObiettiviModal] = useState(false);

  // Export PDF nel modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDaData, setExportDaData] = useState('');
  const [exportAData, setExportAData] = useState('');
  const [exportDataModal, setExportDataModal] = useState<any>(null);
  const [loadingExportModal, setLoadingExportModal] = useState(false);

  // Form compenso
  const [editCompenso, setEditCompenso] = useState(false);
  const [formTipoCompenso, setFormTipoCompenso] = useState<'orario' | 'fisso' | 'nessuno'>('nessuno');
  const [formTariffa, setFormTariffa] = useState<number>(0);
  const [formCompensoPagato, setFormCompensoPagato] = useState(false);
  const [formCostoPrestazione, setFormCostoPrestazione] = useState<number>(0);

  // Form stati per nuovo incarico
  const [task, setTask] = useState('');
  const [date, setDate] = useState('');
  const [dataFine, setDataFine] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [patient, setPatient] = useState('');
  const [staff, setStaff] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [tipoCompenso, setTipoCompenso] = useState<'orario' | 'fisso' | 'nessuno'>('nessuno');
  const [tariffa, setTariffa] = useState<number>(0);
  const [costoPrestazione, setCostoPrestazione] = useState<number>(0);
  // Multi-prestazione con operatore per ciascuna
  const [prestazioniForm, setPrestazioniForm] = useState<PrestazioneForm[]>([]);
  const [catFiltro, setCatFiltro] = useState<CatPrestazione | ''>('');
  
  // Stati per selezione tipo servizio con UI a card (come RichiestaServizio)
  const [tipoServizio, setTipoServizio] = useState<string>('');
  const [tipoSpecifico, setTipoSpecifico] = useState<string>('');

  // Nuove 3 macro-categorie per admin (Infermieristico, Riabilitativo, Medico/specialistiche)
  type MacroCategoria = 'infermieristico' | 'riabilitativo' | 'medico_specialistiche';
  const [macroCats, setMacroCats] = useState<Record<MacroCategoria, boolean>>({
    infermieristico: false,
    riabilitativo: false,
    medico_specialistiche: false,
  });
  // Fabbisogni selezionati per ogni macro-categoria
  const [fabbisogni, setFabbisogni] = useState<Record<MacroCategoria, string[]>>({
    infermieristico: [],
    riabilitativo: [],
    medico_specialistiche: [],
  });

  // Giorni settimana: array di {giorno, attivo, accessiAlGiorno, minutiPerAccesso}
  const [giorniForm, setGiorniForm] = useState([
    { giorno: 1, label: 'Lun', attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 },
    { giorno: 2, label: 'Mar', attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 },
    { giorno: 3, label: 'Mer', attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 },
    { giorno: 4, label: 'Gio', attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 },
    { giorno: 5, label: 'Ven', attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 },
    { giorno: 6, label: 'Sab', attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 },
    { giorno: 0, label: 'Dom', attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 },
  ]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterWorkplans();
  }, [searchTerm, workplans, activeTab]);

  const loadData = async () => {
    try {
      const [workplanRes, patientRes, staffRes] = await Promise.all([
        api.get('/workplan'),
        api.get('/patients'),
        api.get('/staff')
      ]);
      setWorkplans(workplanRes.data);
      setPatients(patientRes.data);
      setStaffMembers(staffRes.data);
    } catch (err) {
      console.error('Errore caricamento piano di lavoro', err);
    }
  };

  const filterWorkplans = () => {
    let filtered = workplans.filter(w => w.type === activeTab);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(w =>
        w.patient?.firstName?.toLowerCase().includes(term) ||
        w.patient?.lastName?.toLowerCase().includes(term) ||
        w.staff?.firstName?.toLowerCase().includes(term) ||
        w.staff?.lastName?.toLowerCase().includes(term) ||
        w.task.toLowerCase().includes(term)
      );
    }
    setFilteredWorkplans(filtered);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (!patient || !date) {
        setError('Compila paziente e data inizio.');
        return;
      }
      if (!task) {
        setError('Compila il campo Attività / Descrizione.');
        return;
      }

      // Validazione macro-categorie e fabbisogni
      const macroSelezionate = (Object.keys(macroCats) as MacroCategoria[]).filter(c => macroCats[c]);
      if (macroSelezionate.length === 0) {
        setError('Seleziona almeno una categoria assistenziale.');
        return;
      }
      const fabbisogniTotali = fabbisogni.infermieristico.length + fabbisogni.riabilitativo.length + fabbisogni.medico_specialistiche.length;
      if (fabbisogniTotali === 0) {
        setError('Seleziona almeno un fabbisogno per categoria.');
        return;
      }

      // Verifica che ogni categoria selezionata abbia almeno un fabbisogno
      for (const cat of macroSelezionate) {
        if (fabbisogni[cat].length === 0) {
          setError(`Seleziona almeno un fabbisogno per la categoria ${MACRO_CATEGORIE_LABELS[cat].label}`);
          return;
        }
      }

      const giorniAttivi = giorniForm
        .filter(g => g.attivo)
        .map(g => ({
          giorno: g.giorno,
          accessiAlGiorno: g.accessiAlGiorno,
          minutiPerAccesso: g.minutiPerAccesso,
        }));

      // Costruisci lista categorie per retrocompatibilità
      const allFabbisogniLabels: string[] = [];
      macroSelezionate.forEach(cat => {
        const labels = fabbisogni[cat].map(f => {
          const opt = FABBISOGNI_OPTIONS[cat].find(o => o.value === f);
          return opt ? `${MACRO_CATEGORIE_LABELS[cat].label.split(' ')[1]}: ${opt.label}` : f;
        });
        allFabbisogniLabels.push(...labels);
      });

      await api.post('/workplan', {
        type: activeTab,
        // Nuovo formato con macro-categorie e fabbisogni
        macroCategorie: macroSelezionate,
        fabbisogni: {
          infermieristico: fabbisogni.infermieristico,
          riabilitativo: fabbisogni.riabilitativo,
          medico_specialistiche: fabbisogni.medico_specialistiche,
        },
        // Retrocompatibilità
        categories: allFabbisogniLabels,
        patient,
        staff: staff || undefined,
        task,
        date,
        dataFine: dataFine || undefined,
        time: time || undefined,
        duration,
        notes: notes || undefined,
        giorniSettimana: giorniAttivi.length > 0 ? giorniAttivi : undefined,
        tipoCompenso,
        tariffa: tipoCompenso !== 'nessuno' ? tariffa : 0,
        costoPrestazione: costoPrestazione > 0 ? costoPrestazione : 0,
      });
      await loadData();
      setTask(''); setDate(''); setDataFine(''); setTime(''); setDuration(60);
      setPatient(''); setStaff(''); setCategories([]); setNotes('');
      setPrestazioniForm([]); setCatFiltro('');
      // Reset nuove macro-categorie e fabbisogni
      setMacroCats({ infermieristico: false, riabilitativo: false, medico_specialistiche: false });
      setFabbisogni({ infermieristico: [], riabilitativo: [], medico_specialistiche: [] });
      setTipoCompenso('nessuno'); setTariffa(0); setCostoPrestazione(0);
      setGiorniForm(prev => prev.map(g => ({ ...g, attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 })));
      setSuccess('Incarico aggiunto con successo!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Errore creazione piano:', err.response?.data || err.message);
      const msg = err.response?.data?.message || err.response?.data?.error?.message || err.message || 'Impossibile salvare l\'incarico. Riprova.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(err.response?.data));
    }
  };

  const completeWorkplan = async (id: string) => {
    try {
      await api.patch(`/workplan/${id}`, { status: 'completed' });
      await loadData();
      setSuccess('Incarico completato!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Errore completamento incarico', err);
    }
  };

  const deleteWorkplan = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo incarico?')) return;
    try {
      await api.delete(`/workplan/${id}`);
      await loadData();
      setSuccess('Incarico eliminato!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Errore eliminazione incarico', err);
    }
  };

  // Segna esame strumentale come eseguito (accesso eseguito)
  const segnaEsameEseguito = async (id: string, currentStatus: string) => {
    if (currentStatus === 'completed') return; // già eseguito
    if (!confirm('Confermi che l\'accesso/esame è stato eseguito?')) return;
    try {
      await api.patch(`/workplan/${id}/eseguito`, {
        dataEsecuzione: new Date().toISOString().substring(0, 10),
        orario: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      });
      await loadData();
      setSuccess('✅ Accesso segnato come eseguito!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nel segnare l\'accesso come eseguito.');
      setTimeout(() => setError(''), 4000);
    }
  };

  const apriAccesso = (id: string) => navigate(`/accesso/${id}`);

  // Archivia incarico (snapshot completo in archivio permanente)
  const archiviaIncarico = async (item: WorkPlanItem) => {
    if (!confirm(`Archiviare definitivamente la cartella clinica di ${item.patient?.firstName} ${item.patient?.lastName}?\n\nVerrà creato uno snapshot permanente di tutto il piano, diario clinico, accessi e allegati.\nL'incarico rimarrà anche nel Piano di Lavoro.`)) return;
    try {
      await api.post(`/archivio/${item._id}`);
      setSuccess(`✅ Cartella di ${item.patient?.firstName} ${item.patient?.lastName} archiviata con successo!`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      if (err.response?.status === 400) {
        setError('Questo incarico è già stato archiviato.');
      } else {
        setError(err.response?.data?.message || 'Errore durante l\'archiviazione.');
      }
      setTimeout(() => setError(''), 4000);
    }
  };

  const visualizzaCartellaClinica = async (item: WorkPlanItem) => {
    try {
      const patientId = item.patient?._id;
      if (!patientId) { setError('ID paziente non trovato'); return; }
      const [patientRes, diarioRes] = await Promise.all([
        api.get(`/patients/${patientId}`),
        api.get(`/diario/paziente/${patientId}`),
      ]);
      const html = generaCartellaClinicaHtml(patientRes.data, item, diarioRes.data || []);
      const win = window.open('', '_blank');
      if (!win) { setError('Impossibile aprire il PDF. Controlla il blocco popup.'); return; }
      win.document.write(html);
      win.document.close();
      win.focus();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Errore nel caricamento della cartella clinica');
      setTimeout(() => setError(''), 4000);
    }
  };

  const generaCartellaClinicaHtml = (patient: any, wp: WorkPlanItem, entries: any[]) => {
    const fd = (d?: string) => d ? new Date(d).toLocaleDateString('it-IT') : 'N/D';
    const diarioHtml = entries.length === 0
      ? '<p style="color:#6b7280;">Nessuna voce di diario clinico registrata.</p>'
      : entries.map((e, i) => `
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:12px;background:#f9fafb;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <strong style="color:#1e4d8c;">Accesso #${i + 1}</strong>
            <span style="font-size:0.85rem;color:#6b7280;">${fd(e.dataRegistrazione)}</span>
          </div>
          <p style="margin:0 0 8px;font-size:0.9rem;"><strong>Operatore:</strong> ${e.staffName || 'N/D'}</p>
          <p style="margin:0 0 8px;font-size:0.9rem;">${(e.testo || '').replace(/</g, '&lt;')}</p>
          ${e.parametriVitali ? `<div style="background:white;padding:8px;border-radius:6px;font-size:0.8rem;"><strong>Parametri:</strong> ${[
            e.parametriVitali.pressioneSistolica && `PA ${e.parametriVitali.pressioneSistolica}/${e.parametriVitali.pressioneDiastolica}`,
            e.parametriVitali.frequenzaCardiaca && `FC ${e.parametriVitali.frequenzaCardiaca}`,
            e.parametriVitali.temperatura && `T ${e.parametriVitali.temperatura}°C`,
            e.parametriVitali.saturazione && `SpO2 ${e.parametriVitali.saturazione}%`,
            e.parametriVitali.glicemia && `Gli ${e.parametriVitali.glicemia}`,
          ].filter(Boolean).join(' · ')}</div>` : ''}
          ${e.firmato ? '<span style="display:inline-block;background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:4px;font-size:0.75rem;margin-top:8px;">✓ Firmato</span>' : ''}
        </div>`).join('');
    return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Cartella Clinica - ${patient.firstName} ${patient.lastName}</title><style>
      body{font-family:Arial,sans-serif;color:#111;margin:0;padding:24px;line-height:1.6}
      h1{font-size:18pt;color:#1e40af;border-bottom:2px solid #1e40af;padding-bottom:8px}
      h2{font-size:14pt;color:#1e40af;margin-top:20px}
      .section{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .label{font-weight:600;color:#4b5563;font-size:0.9rem}
      @media print{body{padding:12px}}
    </style></head><body>
      <h1>🏥 CARTELLA CLINICA</h1>
      <div class="section"><h2>Dati Anagrafici</h2><div class="grid">
        <div><span class="label">Nome:</span> ${patient.firstName} ${patient.lastName}</div>
        <div><span class="label">Data nascita:</span> ${fd(patient.birthDate)}</div>
        <div><span class="label">Codice Fiscale:</span> ${patient.codiceFiscale || 'N/D'}</div>
        <div><span class="label">Indirizzo:</span> ${patient.address || 'N/D'}</div>
        <div><span class="label">Telefono:</span> ${patient.contactPhone || 'N/D'}</div>
        <div><span class="label">Email:</span> ${patient.email || 'N/D'}</div>
      </div></div>
      <div class="section"><h2>Dati Clinici</h2><div class="grid">
        <div style="grid-column:1/-1;"><span class="label">Diagnosi:</span> ${patient.diagnosiAmmissione || 'N/D'}</div>
        <div style="grid-column:1/-1;"><span class="label">Comorbilità:</span> ${patient.comorbilita || 'Nessuna'}</div>
        <div style="grid-column:1/-1;"><span class="label">Allergie:</span> <span style="color:${patient.allergie ? '#dc2626' : '#111'};">${patient.allergie || 'Nessuna nota'}</span></div>
        <div><span class="label">Caregiver:</span> ${patient.caregiverRiferimento || 'N/D'}</div>
        <div><span class="label">Tel. Caregiver:</span> ${patient.caregiverTelefono || 'N/D'}</div>
      </div></div>
      <div class="section"><h2>Incarico</h2><div class="grid">
        <div><span class="label">Tipo:</span> ${wp.type}</div>
        <div><span class="label">Categoria:</span> ${wp.category || 'N/D'}</div>
        <div><span class="label">Attività:</span> ${wp.task || 'N/D'}</div>
        <div><span class="label">Data:</span> ${fd(wp.date)}</div>
      </div></div>
      <div class="section"><h2>Diario Clinico (${entries.length} voci)</h2>${diarioHtml}</div>
      <p style="margin-top:24px;font-size:8pt;color:#6b7280;text-align:center;border-top:1px solid #e5e7eb;padding-top:12px;">
        Generata il ${new Date().toLocaleString('it-IT')} - Abbraccio Cure Domiciliari
      </p>
      <script>window.onload=function(){window.print()}</script>
    </body></html>`;
  };

  const copiaLink = async (id: string) => {
    const url = `${window.location.origin}/accesso/${id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('input');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Apri modal storico accessi
  const apriStorico = async (item: WorkPlanItem) => {
    setSelectedWorkPlan(item);
    setFormTipoCompenso(item.tipoCompenso || 'nessuno');
    setFormTariffa(item.tariffa || 0);
    setFormCompensoPagato(item.compensoPagato || false);
    setFormCostoPrestazione(item.costoPrestazione || 0);
    setEditCompenso(false);
    setLoadingAccessi(true);
    setShowAccessiModal(true);
    setShowDiarioModal(false);
    setShowObiettiviModal(false);
    setShowExportModal(false);
    setExportDataModal(null);
    setExportDaData('');
    setExportAData('');
    try {
      const [accessiRes, diarioRes, obiettiviRes] = await Promise.allSettled([
        api.get(`/workplan/${item._id}/accessi`),
        api.get(`/diario/${item._id}`),
        api.get(`/obiettivi/${item._id}`),
      ]);
      if (accessiRes.status === 'fulfilled') {
        setAccessi(accessiRes.value.data.accessi);
        setRiepilogo(accessiRes.value.data.riepilogo);
      }
      if (diarioRes.status === 'fulfilled') setDiarioModal(diarioRes.value.data || []);
      if (obiettiviRes.status === 'fulfilled') setObiettiviModal(obiettiviRes.value.data || []);
    } catch (err) {
      console.error('Errore caricamento accessi', err);
    } finally {
      setLoadingAccessi(false);
    }
  };

  // Carica export PDF nel modal
  const caricaExportModal = async () => {
    if (!selectedWorkPlan) return;
    setLoadingExportModal(true);
    try {
      const params: any = {};
      if (exportDaData) params.dataInizio = exportDaData;
      if (exportAData) params.dataFine = exportAData;
      const res = await api.get(`/workplan/${selectedWorkPlan._id}/accessi/export`, { params });
      setExportDataModal(res.data);
    } catch (err: any) {
      console.error('Errore export', err);
    } finally {
      setLoadingExportModal(false);
    }
  };

  // Genera HTML per il PDF export
  const generaHTMLExport = () => {
    if (!exportDataModal) return '';
    const righe = exportDataModal.accessi.map((acc: any) => `<tr>
      <td>${acc.data}</td><td>${acc.oraEntrata}</td><td>${acc.oraUscita || '—'}</td>
      <td>${acc.durataOre}</td><td>${acc.note || '—'}</td>
    </tr>`).join('');
    return `<html><head><title>Registro Accessi</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:12px;color:#222;margin:20px}
      h1{font-size:18px;color:#1e4d8c;margin-bottom:4px}
      h2{font-size:14px;color:#444;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#1e4d8c;color:#fff;padding:8px;text-align:left;font-size:11px}
      td{padding:7px 8px;border-bottom:1px solid #e2e8f0;font-size:11px}
      tr:nth-child(even) td{background:#f8fafc}
      .riepilogo{margin-top:20px;background:#f1f5f9;padding:12px;border-radius:6px}
      .riepilogo p{margin:4px 0}
      @media print{body{margin:0}}
    </style></head><body>
    <h1>Registro Accessi — ${exportDataModal.piano.paziente}</h1>
    <h2>Operatore: ${exportDataModal.piano.operatore} (${exportDataModal.piano.ruoloOperatore})</h2>
    <p><strong>Attività:</strong> ${exportDataModal.piano.task}</p>
    <p><strong>Periodo:</strong> ${exportDataModal.periodo.da} — ${exportDataModal.periodo.a}</p>
    <table>
      <thead><tr>
        <th>Data</th><th>Entrata</th><th>Uscita</th><th>Durata</th><th>Note</th>
      </tr></thead>
      <tbody>${righe}</tbody>
    </table>
    <div class="riepilogo">
      <p><strong>Totale accessi:</strong> ${exportDataModal.riepilogo.totaleAccessi}</p>
      <p><strong>Ore totali:</strong> ${exportDataModal.riepilogo.oreTotali}</p>
    </div>
    </body></html>`;
  };

  // Visualizza PDF in nuova tab (senza stampare)
  const visualizzaExportModal = () => {
    const html = generaHTMLExport();
    if (!html) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  // Stampa PDF direttamente (apre dialogo stampa)
  const stampaExportModal = () => {
    const html = generaHTMLExport();
    if (!html) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  // Salva compenso
  const salvaCompenso = async (ricalcola = false) => {
    if (!selectedWorkPlan) return;
    try {
      await api.patch(`/workplan/${selectedWorkPlan._id}/compenso`, {
        tipoCompenso: formTipoCompenso,
        tariffa: formTariffa,
        compensoPagato: formCompensoPagato,
        costoPrestazione: formCostoPrestazione,
        ricalcola,
      });
      // Ricarica
      const res = await api.get(`/workplan/${selectedWorkPlan._id}/accessi`);
      setRiepilogo(res.data.riepilogo);
      setSelectedWorkPlan({ ...selectedWorkPlan, tipoCompenso: formTipoCompenso, tariffa: formTariffa, compensoPagato: formCompensoPagato, compensoTotale: res.data.riepilogo.compensoSalvato, costoPrestazione: formCostoPrestazione });
      await loadData();
      setEditCompenso(false);
      setSuccess('Compenso aggiornato!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Errore salvataggio compenso', err);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' });

  const formatOra = (data: string) =>
    new Date(data).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  const formatDataOra = (data: string) =>
    new Date(data).toLocaleString('it-IT');

  const calcolaDurata = (entrata: string, uscita?: string) => {
    const fine = uscita ? new Date(uscita) : new Date();
    const minuti = Math.round((fine.getTime() - new Date(entrata).getTime()) / 60000);
    const ore = Math.floor(minuti / 60);
    const min = minuti % 60;
    return ore > 0 ? `${ore}h ${min}min` : `${min}min`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'cancelled': return '#6b7280';
      default: return '#f59e0b';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Completato';
      case 'cancelled': return 'Annullato';
      default: return 'In attesa';
    }
  };

  const getCategoryInfo = (catValue: string) => {
    const allCategories = [
      ...prestazioneCategories,
      ...assistenzaCategories,
      { value: 'esame_strumentale', label: 'Esame Strumentale', icon: HeartPulse, color: '#e11d48' },
    ];
    return allCategories.find(c => c.value === catValue) || { label: catValue, icon: Calendar, color: '#6b7280' };
  };

  const esamiCategories = [
    { value: 'esame_strumentale', label: 'Esame Strumentale', icon: HeartPulse, color: '#e11d48' },
  ];

  const currentCategories = activeTab === 'prestazionale'
    ? prestazioneCategories
    : activeTab === 'assistenziale'
    ? assistenzaCategories
    : esamiCategories;

  return (
    <section>
      {/* Tab principali: Piano di lavoro vs Esami strumentali */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '24px', borderBottom: '2px solid var(--gray-200)' }}>
        {([
          { key: 'piano' as const, label: '📋 Prestazionale / Assistenziale' },
          { key: 'esami' as const, label: '🫀 Esami Strumentali' },
        ]).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setMainTab(tab.key)}
            style={{
              background: mainTab === tab.key ? 'var(--primary)' : 'transparent',
              color: mainTab === tab.key ? '#fff' : 'var(--primary)',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              padding: '10px 18px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: '-2px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mainTab === 'esami' ? (
        <EsamiStrumentali />
      ) : (
      <>
      <h2>
        <Calendar size={28} />
        Piano di Lavoro
      </h2>

      {success && (
        <Alert type="success" onClose={() => setSuccess('')} style={{ marginBottom: '16px' }}>
          {success}
        </Alert>
      )}

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid var(--gray-200)', paddingBottom: '8px' }}>
        <button type="button" onClick={() => setActiveTab('prestazionale')} style={{ padding: '12px 24px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: activeTab === 'prestazionale' ? '600' : '400', color: activeTab === 'prestazionale' ? 'var(--primary)' : 'var(--gray-500)', borderBottom: activeTab === 'prestazionale' ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: '-10px' }}>
          <Activity size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Prestazionale
        </button>
        <button type="button" onClick={() => setActiveTab('assistenziale')} style={{ padding: '12px 24px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: activeTab === 'assistenziale' ? '600' : '400', color: activeTab === 'assistenziale' ? 'var(--primary)' : 'var(--gray-500)', borderBottom: activeTab === 'assistenziale' ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: '-10px' }}>
          <Users size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          Assistenziale
        </button>
      </div>

      {/* Search Bar + Nuovo Incarico */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input type="text" placeholder="Cerca per paziente, operatore o attività..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '12px 14px 12px 44px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-md)', fontSize: '0.95rem', outline: 'none' }} />
        </div>
        {(user?.role === 'admin' || user?.role === 'coordinator') && (
          <button type="button" onClick={() => setShowForm(prev => !prev)} style={{ background: showForm ? '#dc2626' : '#059669', color: 'white', padding: '10px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            {showForm ? <><X size={16} /> Chiudi</> : <><Plus size={16} /> Nuovo Incarico</>}
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showForm ? 'minmax(280px, 380px) 1fr' : '1fr', gap: '24px' }}>
        {/* Form Section */}
        {showForm && <div className="dashboard-folder">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}>
            <Plus size={20} />
            {activeTab === 'prestazionale' ? 'Nuovo Incarico Prestazionale' : 'Nuovo Incarico Assistenziale'}
          </h3>

          <form onSubmit={handleSubmit} className="user-form" noValidate>
            <label>
              Paziente *
              <select value={patient} onChange={(e) => setPatient(e.target.value)} required>
                <option value="">Seleziona un paziente</option>
                {patients.map((item) => (
                  <option key={item._id} value={item._id}>{item.firstName} {item.lastName}</option>
                ))}
              </select>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <label>
                Data inizio *
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </label>
              <label>
                Data fine (opzionale)
                <input type="date" value={dataFine} onChange={(e) => setDataFine(e.target.value)} min={date} />
              </label>
            </div>

            <label>
              Orario
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>

            {/* Sezione Tipo Servizio con UI a card (come RichiestaServizio) */}
            {activeTab === 'prestazionale' && (
              <>
                <div style={{ marginTop: '16px' }}>
                  <label style={{ fontWeight: 600, marginBottom: '12px', display: 'block' }}>
                    Tipo di prestazione *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    {TIPI_SERVIZIO.map((tipo) => {
                      const Icon = tipo.Icon;
                      const isSelected = tipoServizio === tipo.value;
                      return (
                        <button
                          key={tipo.value}
                          type="button"
                          onClick={() => { setTipoServizio(tipo.value); setTipoSpecifico(''); }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '16px 12px',
                            border: `2px solid ${isSelected ? tipo.color : '#e5e7eb'}`,
                            borderRadius: '12px',
                            background: isSelected ? tipo.bg : 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <span style={{ fontSize: '28px' }}>{tipo.emoji}</span>
                          <Icon size={24} color={tipo.color} />
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: tipo.color, textAlign: 'center' }}>
                            {tipo.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tipo specifico */}
                {tipoServizio && (
                  <div style={{ marginTop: '12px' }}>
                    <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                      Specifica la prestazione *
                    </label>
                    <select
                      value={tipoSpecifico}
                      onChange={(e) => setTipoSpecifico(e.target.value)}
                      required
                    >
                      <option value="">Seleziona tipo specifico</option>
                      {TIPI_SERVIZIO.find(t => t.value === tipoServizio)?.tipi.map((tipo) => (
                        <option key={tipo} value={tipo}>{tipo}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            {/* ── Sezione Categorie e Fabbisogni ── */}
            <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '14px', marginTop: '4px' }}>
              <div style={{ fontWeight: '700', fontSize: '0.92rem', color: '#1e4d8c', marginBottom: '10px' }}>
                🩺 Categorie assistenziali * (seleziona una o più)
              </div>

              {/* 3 Macro-categorie toggle */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {(Object.keys(MACRO_CATEGORIE_LABELS) as MacroCategoria[]).map(cat => {
                  const info = MACRO_CATEGORIE_LABELS[cat];
                  const selected = macroCats[cat];
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setMacroCats(prev => ({ ...prev, [cat]: !prev[cat] }));
                        if (macroCats[cat]) {
                          // Se deseleziono, svuoto i fabbisogni di questa categoria
                          setFabbisogni(prev => ({ ...prev, [cat]: [] }));
                        }
                      }}
                      style={{
                        flex: '1 1 30%',
                        minWidth: '140px',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        border: `2px solid ${selected ? info.color : '#e5e7eb'}`,
                        background: selected ? info.bg : 'white',
                        color: selected ? info.color : '#374151',
                        fontWeight: selected ? '700' : '500',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <span style={{ fontSize: '1.1rem' }}>{info.label.split(' ')[0]}</span>
                      <span>{info.label.split(' ').slice(1).join(' ')}</span>
                      {selected && <span style={{ marginLeft: '4px' }}>✓</span>}
                    </button>
                  );
                })}
              </div>

              {/* Fabbisogni per ogni categoria selezionata */}
              {(Object.keys(MACRO_CATEGORIE_LABELS) as MacroCategoria[]).filter(cat => macroCats[cat]).map(cat => {
                const info = MACRO_CATEGORIE_LABELS[cat];
                const options = FABBISOGNI_OPTIONS[cat];
                const selezionati = fabbisogni[cat];
                return (
                  <div key={cat} style={{ marginBottom: '16px', padding: '12px', border: `1px solid ${info.color}40`, borderRadius: '10px', background: info.bg }}>
                    <div style={{ fontWeight: '700', fontSize: '0.85rem', color: info.color, marginBottom: '10px' }}>
                      {info.label} — Seleziona fabbisogni:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {options.map(opt => {
                        const selected = selezionati.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setFabbisogni(prev => {
                                const current = prev[cat];
                                const nuovi = selected
                                  ? current.filter(v => v !== opt.value)
                                  : [...current, opt.value];
                                return { ...prev, [cat]: nuovi };
                              });
                            }}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: `1px solid ${selected ? info.color : '#d1d5db'}`,
                              background: selected ? info.color : 'white',
                              color: selected ? 'white' : '#374151',
                              fontWeight: selected ? '600' : '400',
                              fontSize: '0.82rem',
                              cursor: 'pointer',
                            }}
                          >
                            {selected ? '✓ ' : '+ '}{opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {selezionati.length === 0 && (
                      <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '6px' }}>
                        Seleziona almeno un fabbisogno per questa categoria
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Riepilogo selezione */}
              {((Object.keys(macroCats) as MacroCategoria[]).some(c => macroCats[c]) || fabbisogni.infermieristico.length + fabbisogni.riabilitativo.length + fabbisogni.medico_specialistiche.length > 0) && (
                <div style={{ marginTop: '12px', padding: '10px', background: '#f0f9ff', borderRadius: '8px', fontSize: '0.85rem' }}>
                  <strong>Riepilogo:</strong>
                  <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                    {macroCats.infermieristico && fabbisogni.infermieristico.length > 0 && (
                      <li>💉 Infermieristico: {fabbisogni.infermieristico.map(f => FABBISOGNI_OPTIONS.infermieristico.find(o => o.value === f)?.label).join(', ')}</li>
                    )}
                    {macroCats.riabilitativo && fabbisogni.riabilitativo.length > 0 && (
                      <li>🏃 Riabilitativo: {fabbisogni.riabilitativo.map(f => FABBISOGNI_OPTIONS.riabilitativo.find(o => o.value === f)?.label).join(', ')}</li>
                    )}
                    {macroCats.medico_specialistiche && fabbisogni.medico_specialistiche.length > 0 && (
                      <li>🩺 Medico/specialistiche: {fabbisogni.medico_specialistiche.map(f => FABBISOGNI_OPTIONS.medico_specialistiche.find(o => o.value === f)?.label).join(', ')}</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Giorni settimana */}
            <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '12px', marginTop: '4px' }}>
              <div style={{ fontWeight: '600', color: 'var(--gray-700)', marginBottom: '10px', fontSize: '0.9rem' }}>
                📅 Giorni di intervento settimanali
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {giorniForm.map((g, idx) => (
                  <div key={g.giorno} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '6px', backgroundColor: g.attivo ? '#eff6ff' : '#f9fafb', border: `1px solid ${g.attivo ? '#bfdbfe' : '#e5e7eb'}` }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', minWidth: '60px', margin: 0, fontWeight: g.attivo ? '600' : '400' }}>
                      <input
                        type="checkbox"
                        checked={g.attivo}
                        onChange={e => {
                          const updated = [...giorniForm];
                          updated[idx] = { ...updated[idx], attivo: e.target.checked };
                          setGiorniForm(updated);
                        }}
                        style={{ width: '16px', height: '16px' }}
                      />
                      {g.label}
                    </label>
                    {g.attivo && activeTab === 'prestazionale' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', margin: 0 }}>
                        Accessi/giorno:
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={g.accessiAlGiorno}
                          onChange={e => {
                            const updated = [...giorniForm];
                            updated[idx] = { ...updated[idx], accessiAlGiorno: parseInt(e.target.value) || 1 };
                            setGiorniForm(updated);
                          }}
                          style={{ width: '60px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #bfdbfe', fontSize: '0.85rem' }}
                        />
                      </label>
                    )}
                    {g.attivo && activeTab === 'assistenziale' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', margin: 0 }}>
                        Minuti/accesso:
                        <input
                          type="number"
                          min="15"
                          step="15"
                          max="480"
                          value={g.minutiPerAccesso}
                          onChange={e => {
                            const updated = [...giorniForm];
                            updated[idx] = { ...updated[idx], minutiPerAccesso: parseInt(e.target.value) || 60 };
                            setGiorniForm(updated);
                          }}
                          style={{ width: '70px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #bfdbfe', fontSize: '0.85rem' }}
                        />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <label>
              Attività / Descrizione *
              <input
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder={
                  activeTab === 'prestazionale'
                    ? 'Es. Prelievo ematico, Medicazione...'
                    : 'Es. Assistenza igienica, Cambio postura...'
                }
                required
              />
            </label>

            {activeTab === 'assistenziale' && (
              <label>
                Durata (minuti)
                <input type="number" min="15" step="15" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 60)} />
              </label>
            )}

            <label>
              Note (opzionale)
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Note aggiuntive..." />
            </label>

            {/* Sezione Compenso */}
            <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '12px', marginTop: '4px' }}>
              <label style={{ fontWeight: '600', color: 'var(--gray-700)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Euro size={16} />
                Compenso operatore
              </label>
              <label>
                Tipo compenso
                <select value={tipoCompenso} onChange={(e) => setTipoCompenso(e.target.value as any)}>
                  <option value="nessuno">Nessuno</option>
                  <option value="orario">Tariffa oraria (€/ora)</option>
                  <option value="fisso">Compenso fisso (€)</option>
                </select>
              </label>
              {tipoCompenso !== 'nessuno' && (
                <label>
                  {tipoCompenso === 'orario' ? 'Tariffa oraria (€/ora)' : 'Compenso fisso (€)'}
                  <input type="number" min="0" step="0.5" value={tariffa} onChange={(e) => setTariffa(parseFloat(e.target.value) || 0)} placeholder="0.00" />
                </label>
              )}
              <label style={{ marginTop: '8px' }}>
                💰 Costo prestazione al paziente (€) — ricavo admin
                <input type="number" min="0" step="0.5" value={costoPrestazione} onChange={(e) => setCostoPrestazione(parseFloat(e.target.value) || 0)} placeholder="0.00" />
              </label>
              {costoPrestazione > 0 && tipoCompenso !== 'nessuno' && tariffa > 0 && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '8px 12px', fontSize: '0.82rem', color: '#166534' }}>
                  📊 Utile stimato: <strong>€{(costoPrestazione - tariffa).toFixed(2)}</strong>
                  <span style={{ color: '#888', marginLeft: '8px' }}>(costo {costoPrestazione}€ − compenso {tariffa}€)</span>
                </div>
              )}
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: 'var(--danger-bg)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '0.92rem' }}>
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <button type="submit">
              <Plus size={16} />
              Aggiungi Incarico
            </button>
          </form>
        </div>}

        {/* List Section */}
        <div className="dashboard-folder">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}>
            <Calendar size={20} />
            {activeTab === 'prestazionale' ? `Incarichi Prestazionali (${filteredWorkplans.length})` : `Incarichi Assistenziali (${filteredWorkplans.length})`}
          </h3>

          {filteredWorkplans.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '32px', color: 'var(--gray-500)' }}>Nessun incarico presente.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '700px', overflowY: 'auto' }}>
              {filteredWorkplans.map((item) => {
                const itemPrestazioni = (item as any).prestazioni as Array<{ tipoPrestazione: string; categoria: string; staff: any; note?: string }> | undefined;
                const hasPrestazioni = itemPrestazioni && itemPrestazioni.length > 0;
                const macroCats = (item as any).macroCategorie as string[] | undefined;
                const hasMacroCats = macroCats && macroCats.length > 0;
                // Colore bordo: prima macro-categoria, o prima categoria prestazioni, o fallback
                let borderColor = '#6b7280';
                if (hasMacroCats && macroCats[0]) {
                  borderColor = MACRO_CATEGORIE_LABELS[macroCats[0]]?.color || '#6b7280';
                } else if (hasPrestazioni) {
                  borderColor = CATEGORIA_LABELS[itemPrestazioni[0].categoria as CatPrestazione]?.color || '#6b7280';
                }
                return (
                  <div key={item._id} style={{ display: 'flex', gap: '12px', padding: '14px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', backgroundColor: 'white', borderLeft: `4px solid ${borderColor}`, opacity: item.status === 'completed' ? 0.75 : 1 }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-md)', backgroundColor: `${borderColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.3rem' }}>
                      🩺
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <strong>{item.patient?.firstName ?? '(eliminato)'} {item.patient?.lastName ?? ''}</strong>
                        <span style={{ fontSize: '0.72rem', padding: '2px 7px', backgroundColor: `${getStatusColor(item.status)}20`, color: getStatusColor(item.status), borderRadius: 'var(--radius-full)', fontWeight: 600 }}>{getStatusLabel(item.status)}</span>
                        {item.tipoCompenso && item.tipoCompenso !== 'nessuno' && (
                          <span style={{ fontSize: '0.72rem', padding: '2px 7px', backgroundColor: '#f0fdf4', color: '#16a34a', borderRadius: 'var(--radius-full)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Euro size={10} />
                            {item.tipoCompenso === 'orario' ? `${item.tariffa}€/h` : `${item.tariffa}€ fisso`}
                            {item.compensoTotale ? ` → ${item.compensoTotale}€` : ''}
                            {item.compensoPagato && ' ✓ Pagato'}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '0 0 6px', fontSize: '0.9rem', color: 'var(--gray-700)', fontWeight: '600' }}>{item.task}</p>

                      {/* Macro-categorie e fabbisogni (nuovo formato) */}
                      {((item as any).macroCategorie?.length > 0 || (item as any).fabbisogni) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '6px' }}>
                          {((item as any).macroCategorie as string[] || []).map((macroCat, midx) => {
                            const fabbs = ((item as any).fabbisogni?.[macroCat as keyof typeof FABBISOGNI_OPTIONS] as string[]) || [];
                            const macroInfo = MACRO_CATEGORIE_LABELS[macroCat];
                            return (
                              <div key={midx} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: macroInfo?.bg || '#f3f4f6', color: macroInfo?.color || '#374151', borderRadius: '10px', fontWeight: '700', border: `1px solid ${macroInfo?.color || '#e5e7eb'}40` }}>
                                  {macroInfo?.label || macroCat}
                                </span>
                                {fabbs.length > 0 && (
                                  <span style={{ fontSize: '0.8rem', color: '#1e3a5f' }}>
                                    {fabbs.map(f => {
                                      const opt = FABBISOGNI_OPTIONS[macroCat as keyof typeof FABBISOGNI_OPTIONS]?.find(o => o.value === f);
                                      return opt?.label || f;
                                    }).join(', ')}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : hasPrestazioni ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '6px' }}>
                          {itemPrestazioni!.map((prest, pidx) => {
                            const catInfo = CATEGORIA_LABELS[prest.categoria as CatPrestazione];
                            const catalogoItem = CATALOGO_PRESTAZIONI.find(c => c.value === prest.tipoPrestazione);
                            const opName = prest.staff ? `${prest.staff.firstName || ''} ${prest.staff.lastName || ''}`.trim() : '—';
                            return (
                              <div key={pidx} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: catInfo?.bg || '#f3f4f6', color: catInfo?.color || '#374151', borderRadius: '10px', fontWeight: '700', border: `1px solid ${catInfo?.color || '#e5e7eb'}40` }}>
                                  {catInfo?.label || prest.categoria}
                                </span>
                                <span style={{ fontSize: '0.82rem', color: '#1e3a5f' }}>{catalogoItem?.label || prest.tipoPrestazione}</span>
                                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>→ 👤 {opName}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p style={{ margin: '0 0 4px', fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                          👤 {item.staff?.firstName} {item.staff?.lastName}
                        </p>
                      )}

                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--gray-500)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <span>📅 {formatDate(item.date)}{item.dataFine ? ` → ${formatDate(item.dataFine)}` : ''}{item.time && ` alle ${item.time}`}</span>
                        {item.duration && <span>⏱️ {item.duration} min</span>}
                      </p>
                      {item.giorniSettimana && item.giorniSettimana.length > 0 && (
                        <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {['Dom','Lun','Mar','Mer','Gio','Ven','Sab'].map((label, idx) => {
                            const g = item.giorniSettimana!.find(x => x.giorno === idx);
                            return g ? (
                              <span key={idx} style={{ fontSize: '0.7rem', padding: '1px 6px', backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: '10px', fontWeight: '600', border: '1px solid #bfdbfe' }}>
                                {label}
                                {item.type === 'prestazionale' && g.accessiAlGiorno > 1 ? ` ×${g.accessiAlGiorno}` : ''}
                                {item.type === 'assistenziale' ? ` ${g.minutiPerAccesso}min` : ''}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                      {item.notes && <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: 'var(--gray-600)', fontStyle: 'italic' }}>{item.notes}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexDirection: 'row', flexWrap: 'wrap', maxWidth: '340px', justifyContent: 'flex-end' }}>
                      {/* Storico accessi + compenso */}
                      <button type="button" onClick={() => apriStorico(item)} style={{ background: '#8b5cf6', padding: '8px 12px', fontSize: '0.8rem', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }} title="Storico accessi e compenso">
                        <ClipboardList size={16} />
                        <span>Storico</span>
                      </button>
                      {/* Cartella clinica PDF */}
                      <button type="button" onClick={() => visualizzaCartellaClinica(item)} style={{ background: '#0d9488', padding: '8px 12px', fontSize: '0.8rem', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }} title="Visualizza/Stampa cartella clinica PDF">
                        <FileText size={16} />
                        <span>Cartella</span>
                      </button>
                      {/* Accesso remoto e copia link */}
                      <button type="button" onClick={() => apriAccesso(item._id)} style={{ background: '#3b82f6', padding: '8px 12px', fontSize: '0.8rem', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }} title="Apri pagina registrazione accessi">
                        <Link2 size={16} />
                        <span>Registra</span>
                      </button>
                      <button type="button" onClick={() => copiaLink(item._id)} style={{ background: copiedId === item._id ? '#10b981' : '#6c757d', padding: '8px 12px', fontSize: '0.8rem', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }} title={copiedId === item._id ? 'Link copiato!' : 'Copia link accesso'}>
                        <Copy size={16} />
                        <span>{copiedId === item._id ? 'Copiato!' : 'Copia'}</span>
                      </button>
                      {item.status === 'pending' && (
                        <button type="button" onClick={() => completeWorkplan(item._id)} style={{ background: 'var(--success)', padding: '8px 12px', fontSize: '0.8rem', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }} title="Termina incarico - Segna come completato">
                          <CheckCircle size={16} />
                          <span>Termina</span>
                        </button>
                      )}
                      {(user?.role === 'admin' || user?.role === 'coordinator') && (
                        <button type="button" onClick={() => archiviaIncarico(item)} style={{ background: '#7c3aed', padding: '8px 12px', fontSize: '0.8rem', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }} title="Archivia cartella clinica">
                          <Archive size={16} />
                          <span>Archivia</span>
                        </button>
                      )}
                      <button type="button" onClick={() => deleteWorkplan(item._id)} style={{ background: 'var(--danger)', padding: '8px 12px', fontSize: '0.8rem', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }} title="Elimina incarico">
                        <Trash2 size={16} />
                        <span>Elimina</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===== MODAL STORICO ACCESSI + COMPENSO ===== */}
      {showAccessiModal && selectedWorkPlan && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', maxWidth: '760px', width: '95%', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            {/* Header modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ClipboardList size={20} color="#8b5cf6" />
                  Storico Accessi & Compenso
                </h3>
                <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                  {selectedWorkPlan.patient?.firstName ?? '(eliminato)'} {selectedWorkPlan.patient?.lastName ?? ''} — {selectedWorkPlan.task}
                </p>
                <p style={{ margin: '2px 0 0', color: '#888', fontSize: '0.82rem' }}>
                  Operatore: {selectedWorkPlan.staff?.firstName} {selectedWorkPlan.staff?.lastName}
                </p>
              </div>
              <button type="button" onClick={() => setShowAccessiModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666', padding: '4px' }}>
                <X size={22} />
              </button>
            </div>

            {loadingAccessi ? (
              <p style={{ textAlign: 'center', color: '#666', padding: '32px' }}>⏳ Caricamento...</p>
            ) : (
              <>
                {/* Riepilogo */}
                {riepilogo && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ padding: '12px', backgroundColor: '#f0f9ff', borderRadius: '8px', textAlign: 'center', border: '1px solid #bae6fd' }}>
                      <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#0284c7' }}>{riepilogo.totaleAccessi}</div>
                      <div style={{ fontSize: '0.78rem', color: '#666' }}>Accessi totali</div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px', textAlign: 'center', border: '1px solid #bbf7d0' }}>
                      <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#16a34a' }}>{riepilogo.accessiCompletati}</div>
                      <div style={{ fontSize: '0.78rem', color: '#666' }}>Completati</div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: '#fefce8', borderRadius: '8px', textAlign: 'center', border: '1px solid #fde68a' }}>
                      <div style={{ fontSize: '1.6rem', fontWeight: '700', color: '#d97706' }}>{riepilogo.oreTotali}h</div>
                      <div style={{ fontSize: '0.78rem', color: '#666' }}>Ore lavorate</div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: riepilogo.compensoPagato ? '#f0fdf4' : '#fdf4ff', borderRadius: '8px', textAlign: 'center', border: `1px solid ${riepilogo.compensoPagato ? '#bbf7d0' : '#e9d5ff'}` }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: '700', color: riepilogo.compensoPagato ? '#16a34a' : '#7c3aed' }}>
                        €{riepilogo.compensoSalvato > 0 ? riepilogo.compensoSalvato : riepilogo.compensoCalcolato}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#666' }}>{riepilogo.compensoPagato ? '✓ Pagato' : 'Compenso'}</div>
                    </div>
                  </div>
                )}

                {/* Sezione Compenso */}
                <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#fdf4ff', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: '#7c3aed' }}>
                      <Euro size={18} />
                      Gestione Compenso
                    </h4>
                    {!editCompenso && (
                      <button type="button" onClick={() => setEditCompenso(true)} style={{ background: '#7c3aed', padding: '6px 14px', fontSize: '0.85rem' }}>
                        Modifica
                      </button>
                    )}
                  </div>

                  {!editCompenso ? (
                    <div>
                      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '0.9rem', marginBottom: '12px' }}>
                        <div>
                          <span style={{ color: '#666' }}>Tipo: </span>
                          <strong>{selectedWorkPlan.tipoCompenso === 'orario' ? 'Tariffa oraria' : selectedWorkPlan.tipoCompenso === 'fisso' ? 'Compenso fisso' : 'Nessuno'}</strong>
                        </div>
                        {selectedWorkPlan.tipoCompenso !== 'nessuno' && (
                          <div>
                            <span style={{ color: '#666' }}>Tariffa: </span>
                            <strong>€{selectedWorkPlan.tariffa}{selectedWorkPlan.tipoCompenso === 'orario' ? '/ora' : ''}</strong>
                          </div>
                        )}
                        {riepilogo && riepilogo.compensoCalcolato > 0 && (
                          <div>
                            <span style={{ color: '#666' }}>Calcolato dagli accessi: </span>
                            <strong style={{ color: '#7c3aed' }}>€{riepilogo.compensoCalcolato}</strong>
                          </div>
                        )}
                        <div>
                          <span style={{ color: '#666' }}>Compenso salvato: </span>
                          <strong style={{ color: '#16a34a' }}>€{selectedWorkPlan.compensoTotale || 0}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#666' }}>Stato pagamento: </span>
                          <strong style={{ color: selectedWorkPlan.compensoPagato ? '#16a34a' : '#dc2626' }}>
                            {selectedWorkPlan.compensoPagato ? '✓ Pagato' : '⏳ Da pagare'}
                          </strong>
                        </div>
                      </div>
                      {/* Pannello finanziario admin */}
                      {(selectedWorkPlan.costoPrestazione || 0) > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginTop: '8px', padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>💰 Costo al paziente</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#166534' }}>€{(selectedWorkPlan.costoPrestazione || 0).toFixed(2)}</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>👤 Compenso operatore</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#7c3aed' }}>€{(selectedWorkPlan.compensoTotale || 0).toFixed(2)}</div>
                          </div>
                          <div style={{ textAlign: 'center', background: riepilogo && riepilogo.utile >= 0 ? '#dcfce7' : '#fee2e2', borderRadius: '6px', padding: '6px' }}>
                            <div style={{ fontSize: '0.72rem', color: riepilogo && riepilogo.utile >= 0 ? '#166534' : '#dc2626', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>📊 Utile</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: riepilogo && riepilogo.utile >= 0 ? '#166534' : '#dc2626' }}>
                              €{riepilogo ? riepilogo.utile.toFixed(2) : ((selectedWorkPlan.costoPrestazione || 0) - (selectedWorkPlan.compensoTotale || 0)).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.88rem' }}>
                          Tipo compenso
                          <select value={formTipoCompenso} onChange={(e) => setFormTipoCompenso(e.target.value as any)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                            <option value="nessuno">Nessuno</option>
                            <option value="orario">Tariffa oraria (€/ora)</option>
                            <option value="fisso">Compenso fisso (€)</option>
                          </select>
                        </label>
                        {formTipoCompenso !== 'nessuno' && (
                          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.88rem' }}>
                            {formTipoCompenso === 'orario' ? 'Tariffa €/ora' : 'Compenso fisso €'}
                            <input type="number" min="0" step="0.5" value={formTariffa} onChange={(e) => setFormTariffa(parseFloat(e.target.value) || 0)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                          </label>
                        )}
                      </div>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.88rem' }}>
                        💰 Costo prestazione al paziente (€) — ricavo admin
                        <input type="number" min="0" step="0.5" value={formCostoPrestazione} onChange={(e) => setFormCostoPrestazione(parseFloat(e.target.value) || 0)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }} placeholder="0.00" />
                      </label>
                      {formCostoPrestazione > 0 && formTipoCompenso !== 'nessuno' && formTariffa > 0 && (
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '8px 12px', fontSize: '0.82rem', color: '#166534' }}>
                          📊 Utile stimato: <strong>€{(formCostoPrestazione - formTariffa).toFixed(2)}</strong>
                        </div>
                      )}
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={formCompensoPagato} onChange={(e) => setFormCompensoPagato(e.target.checked)} />
                        Compenso pagato
                      </label>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => salvaCompenso(false)} style={{ background: '#7c3aed', padding: '8px 16px', fontSize: '0.88rem' }}>
                          💾 Salva
                        </button>
                        {formTipoCompenso === 'orario' && (
                          <button type="button" onClick={() => salvaCompenso(true)} style={{ background: '#16a34a', padding: '8px 16px', fontSize: '0.88rem' }}>
                            🔄 Ricalcola dagli accessi
                          </button>
                        )}
                        <button type="button" onClick={() => setEditCompenso(false)} style={{ background: '#6c757d', padding: '8px 16px', fontSize: '0.88rem' }}>
                          Annulla
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Lista accessi */}
                <div>
                  <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={16} />
                    Registro Accessi ({accessi.length})
                  </h4>

                  {accessi.length === 0 ? (
                    <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                      Nessun accesso registrato per questo incarico.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                      {accessi.map((acc) => (
                        <div key={acc._id} style={{ padding: '12px', borderRadius: '6px', border: `1px solid ${acc.oraUscita ? '#e5e7eb' : '#86efac'}`, backgroundColor: acc.oraUscita ? '#f9fafb' : '#f0fdf4' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '0.9rem' }}>
                                {acc.staffName}
                                <span style={{ fontWeight: '400', color: '#666', marginLeft: '8px', fontSize: '0.82rem' }}>({acc.staffRole})</span>
                              </div>
                              <div style={{ fontSize: '0.85rem', color: '#555', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <span>🟢 Entrata: <strong>{formatOra(acc.oraEntrata)}</strong></span>
                                {acc.oraUscita
                                  ? <span>🔴 Uscita: <strong>{formatOra(acc.oraUscita)}</strong></span>
                                  : <span style={{ color: '#16a34a', fontWeight: '600' }}>● In corso</span>
                                }
                                {acc.oraUscita && (
                                  <span style={{ color: '#7c3aed' }}>⏱️ <strong>{calcolaDurata(acc.oraEntrata, acc.oraUscita)}</strong></span>
                                )}
                              </div>
                              {acc.note && <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '4px', fontStyle: 'italic' }}>📝 {acc.note}</div>}
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#888' }}>
                              <div>✍️ {acc.staffName}</div>
                              <div>({acc.staffRole})</div>
                              <div>{new Date(acc.oraEntrata).toLocaleDateString('it-IT')}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── SEZIONE DIARIO CLINICO ── */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '20px', overflow: 'hidden' }}>
                  <button type="button" onClick={() => setShowDiarioModal(!showDiarioModal)}
                    style={{ width: '100%', background: '#f8fafc', border: 'none', padding: '12px 16px', textAlign: 'left', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', color: '#374151', display: 'flex', justifyContent: 'space-between' }}>
                    <span>📓 Diario clinico ({diarioModal.length} voci)</span>
                    <span>{showDiarioModal ? '▲' : '▼'}</span>
                  </button>
                  {showDiarioModal && (
                    <div style={{ padding: '16px', maxHeight: '400px', overflowY: 'auto' }}>
                      {diarioModal.length === 0 ? (
                        <p style={{ color: '#888', fontStyle: 'italic', margin: 0 }}>Nessuna voce nel diario.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {diarioModal.map((entry: any) => (
                            <div key={entry._id} style={{ padding: '12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                                  📅 {new Date(entry.dataRegistrazione).toLocaleDateString('it-IT')} {new Date(entry.dataRegistrazione).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span style={{ fontSize: '0.8rem', color: '#888' }}>✍️ {entry.staffName}</span>
                                {entry.firmato && (
                                  <span style={{ background: 'rgba(5,150,105,0.1)', color: '#065f46', border: '1px solid #059669', borderRadius: '10px', padding: '1px 8px', fontSize: '0.72rem', fontWeight: '700' }}>✅ Firmato</span>
                                )}
                              </div>
                              <p style={{ margin: '0 0 8px', color: '#374151', fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>{entry.testo}</p>
                              {entry.parametriVitali && Object.values(entry.parametriVitali).some((v: any) => v !== undefined && v !== null) && (
                                <div style={{ background: '#f1f5f9', borderRadius: '6px', padding: '6px 10px', fontSize: '0.8rem', color: '#555', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  {entry.parametriVitali.pressioneSistolica !== undefined && <span>🩸 {entry.parametriVitali.pressioneSistolica}/{entry.parametriVitali.pressioneDiastolica} mmHg</span>}
                                  {entry.parametriVitali.frequenzaCardiaca !== undefined && <span>❤️ {entry.parametriVitali.frequenzaCardiaca} bpm</span>}
                                  {entry.parametriVitali.frequenzaRespiratoria !== undefined && <span>🫁 {entry.parametriVitali.frequenzaRespiratoria} atti/min</span>}
                                  {entry.parametriVitali.temperatura !== undefined && <span>🌡️ {entry.parametriVitali.temperatura}°C</span>}
                                  {entry.parametriVitali.saturazione !== undefined && <span>💨 SpO2 {entry.parametriVitali.saturazione}%</span>}
                                  {entry.parametriVitali.glicemia !== undefined && <span>🍬 {entry.parametriVitali.glicemia} mg/dL</span>}
                                  {entry.parametriVitali.peso !== undefined && <span>⚖️ {entry.parametriVitali.peso} kg</span>}
                                  {entry.parametriVitali.dolore !== undefined && <span>😣 Dolore {entry.parametriVitali.dolore}/10</span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── SEZIONE OBIETTIVI ── */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '12px', overflow: 'hidden' }}>
                  <button type="button" onClick={() => setShowObiettiviModal(!showObiettiviModal)}
                    style={{ width: '100%', background: '#f8fafc', border: 'none', padding: '12px 16px', textAlign: 'left', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', color: '#374151', display: 'flex', justifyContent: 'space-between' }}>
                    <span>🎯 Obiettivi del piano ({obiettiviModal.length})</span>
                    <span>{showObiettiviModal ? '▲' : '▼'}</span>
                  </button>
                  {showObiettiviModal && (
                    <div style={{ padding: '16px' }}>
                      {obiettiviModal.length === 0 ? (
                        <p style={{ color: '#888', fontStyle: 'italic', margin: 0 }}>Nessun obiettivo definito.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {obiettiviModal.map((ob: any) => {
                            const statoColors: Record<string, { bg: string; color: string; label: string }> = {
                              attivo:        { bg: 'rgba(30,77,140,0.08)',  color: '#1e4d8c', label: '🎯 Attivo' },
                              raggiunto:     { bg: 'rgba(5,150,105,0.08)',  color: '#065f46', label: '✅ Raggiunto' },
                              parziale:      { bg: 'rgba(245,158,11,0.08)', color: '#92400e', label: '⚠️ Parziale' },
                              non_raggiunto: { bg: 'rgba(220,38,38,0.08)',  color: '#7f1d1d', label: '❌ Non raggiunto' },
                              rivalutato:    { bg: 'rgba(107,114,128,0.08)',color: '#374151', label: '🔄 Rivalutato' },
                            };
                            const badge = statoColors[ob.stato] || statoColors.attivo;
                            return (
                              <div key={ob._id} style={{ background: badge.bg, border: `1px solid ${badge.color}30`, borderRadius: '6px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ flex: 1 }}>
                                  <p style={{ margin: '0 0 4px', fontWeight: '600', fontSize: '0.88rem', color: '#374151' }}>{ob.descrizione}</p>
                                  <div style={{ fontSize: '0.78rem', color: '#888', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <span>📅 {new Date(ob.dataInizio).toLocaleDateString('it-IT')}</span>
                                    {ob.dataRivalutazione && <span>🔄 Rivalutazione: {new Date(ob.dataRivalutazione).toLocaleDateString('it-IT')}</span>}
                                    {ob.valutazioni?.length > 0 && <span>📋 {ob.valutazioni.length} valutazioni</span>}
                                  </div>
                                </div>
                                <span style={{ color: badge.color, fontWeight: '700', fontSize: '0.8rem', background: badge.bg, border: `1px solid ${badge.color}`, borderRadius: '10px', padding: '2px 8px', whiteSpace: 'nowrap' }}>{badge.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── EXPORT PDF ACCESSI ── */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '12px', overflow: 'hidden' }}>
                  <button type="button" onClick={() => setShowExportModal(!showExportModal)}
                    style={{ width: '100%', background: '#f8fafc', border: 'none', padding: '12px 16px', textAlign: 'left', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', color: '#374151', display: 'flex', justifyContent: 'space-between' }}>
                    <span>📄 Esporta registro accessi (PDF)</span>
                    <span>{showExportModal ? '▲' : '▼'}</span>
                  </button>
                  {showExportModal && (
                    <div style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '8px' }}>
                        <label style={{ flex: 1, minWidth: '130px', fontSize: '0.85rem' }}>
                          Da data
                          <input type="date" value={exportDaData} onChange={e => setExportDaData(e.target.value)} style={{ marginTop: '4px', padding: '7px 10px', border: '1px solid #ced4da', borderRadius: '4px', width: '100%' }} />
                        </label>
                        <label style={{ flex: 1, minWidth: '130px', fontSize: '0.85rem' }}>
                          A data
                          <input type="date" value={exportAData} onChange={e => setExportAData(e.target.value)} style={{ marginTop: '4px', padding: '7px 10px', border: '1px solid #ced4da', borderRadius: '4px', width: '100%' }} />
                        </label>
                        <button type="button" onClick={caricaExportModal} disabled={loadingExportModal}
                          style={{ background: '#1e4d8c', padding: '9px 16px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                          {loadingExportModal ? '⏳' : '🔍 Carica'}
                        </button>
                        {exportDataModal && (
                          <>
                            <button type="button" onClick={visualizzaExportModal}
                              style={{ background: '#3b82f6', padding: '9px 16px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                              👁️ Visualizza PDF
                            </button>
                            <button type="button" onClick={stampaExportModal}
                              style={{ background: '#059669', padding: '9px 16px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                              🖨️ Stampa PDF
                            </button>
                          </>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#888' }}>Lascia vuoto per il mese corrente</p>
                        {exportDataModal && (
                          <div style={{ marginTop: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', fontSize: '0.82rem' }}>
                          <p style={{ margin: '0 0 4px' }}><strong>Periodo:</strong> {exportDataModal.periodo.da} — {exportDataModal.periodo.a}</p>
                          <p style={{ margin: 0 }}><strong>Accessi:</strong> {exportDataModal.riepilogo.totaleAccessi} | <strong>Ore:</strong> {exportDataModal.riepilogo.oreTotali}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer modal */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                  <button type="button" onClick={() => apriAccesso(selectedWorkPlan._id)} style={{ background: '#3b82f6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Link2 size={16} />
                    Apri pagina accesso
                  </button>
                  <button type="button" onClick={() => setShowAccessiModal(false)} style={{ background: '#6c757d' }}>
                    Chiudi
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      </>
      )}
    </section>
  );
}

export default WorkPlan;
