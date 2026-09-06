import { FormEvent, useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Syringe, HeartPulse, ClipboardList, Plus, X, ChevronLeft, ChevronRight, Calendar, Clock, User, CheckCircle, Trash2, ChevronDown, ChevronUp, UserCheck, Eye, TestTube2, Bandage, Activity, CalendarDays, Users, Copy, Search, Download, Mail } from 'lucide-react';
// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y: number, m: number) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }
function toISO(d: Date) { return d.toISOString().split('T')[0]; }
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const GIORNI_SETT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const TIPI_PRELIEVO = ['Emocromo completo', 'Glicemia', 'Coagulazione (PT/INR/aPTT)', 'Elettroliti', 'Funzionalità epatica', 'Funzionalità renale', 'Profilo lipidico', 'Ormoni tiroidei (TSH/fT4)', 'PCR / VES', 'Esame urine', 'Emogasanalisi', 'Altro'];
const TIPI_ESAME = ['ECG', 'Holter ECG', 'Holter pressorio', 'Glicemia', 'EGA (Emogasanalisi)', 'Polisonnografia', 'Titolazione CPAP', 'Spirometria', 'Ecocardiogramma', 'Altro'];
const PREST_CATS = [
    { value: 'esame_ematico', label: 'Esame Ematico', Icon: TestTube2, color: '#ef4444' },
    { value: 'medicazione', label: 'Medicazione', Icon: Bandage, color: '#f59e0b' },
    { value: 'prestazione_varia', label: 'Prestazione Varia', Icon: Activity, color: '#10b981' },
];
const ASSIST_CATS = [
    { value: 'assistenza_oraria', label: 'Assistenza Oraria', Icon: Clock, color: '#3b82f6' },
    { value: 'variazione_orario', label: 'Variazione Orario', Icon: CalendarDays, color: '#8b5cf6' },
    { value: 'visita_programmata', label: 'Visita Programmata', Icon: Users, color: '#06b6d4' },
];
// ─── Macro-categorie e fabbisogni (come WorkPlan.tsx) ─────────────────────────
type MacroCategoria = 'infermieristico' | 'riabilitativo' | 'medico_specialistiche';
const MACRO_CATEGORIE_LABELS: Record<MacroCategoria, {
    label: string;
    color: string;
    bg: string;
}> = {
    infermieristico: { label: '💉 Infermieristico', color: '#2563eb', bg: '#eff6ff' },
    riabilitativo: { label: '🏃 Riabilitativo', color: '#16a34a', bg: '#f0fdf4' },
    medico_specialistiche: { label: '🩺 Medico e Specialistiche', color: '#7c3aed', bg: '#f5f3ff' },
};
const MACRO_TEXT: Record<MacroCategoria, string> = {
    infermieristico: 'tw-text-[#2563eb]',
    riabilitativo: 'tw-text-[#16a34a]',
    medico_specialistiche: 'tw-text-[#7c3aed]',
};
const MACRO_BG: Record<MacroCategoria, string> = {
    infermieristico: 'tw-bg-[#eff6ff]',
    riabilitativo: 'tw-bg-[#f0fdf4]',
    medico_specialistiche: 'tw-bg-[#f5f3ff]',
};
const MACRO_BORDER: Record<MacroCategoria, string> = {
    infermieristico: 'tw-border-[#2563eb40]',
    riabilitativo: 'tw-border-[#16a34a40]',
    medico_specialistiche: 'tw-border-[#7c3aed40]',
};
const MACRO_SOLID: Record<MacroCategoria, string> = {
    infermieristico: 'tw-bg-[#2563eb]',
    riabilitativo: 'tw-bg-[#16a34a]',
    medico_specialistiche: 'tw-bg-[#7c3aed]',
};
const ASSIST_CLASSES: Record<string, string> = {
    assistenza_oraria: 'tw-border-[#3b82f6] tw-bg-[#3b82f620] tw-text-[#3b82f6]',
    variazione_orario: 'tw-border-[#8b5cf6] tw-bg-[#8b5cf620] tw-text-[#8b5cf6]',
    visita_programmata: 'tw-border-[#06b6d4] tw-bg-[#06b6d420] tw-text-[#06b6d4]',
};
const FABBISOGNI_OPTIONS: Record<MacroCategoria, {
    value: string;
    label: string;
}[]> = {
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
const GIORNI_DEFAULT = [
    { giorno: 1, label: 'Lun', attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 },
    { giorno: 2, label: 'Mar', attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 },
    { giorno: 3, label: 'Mer', attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 },
    { giorno: 4, label: 'Gio', attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 },
    { giorno: 5, label: 'Ven', attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 },
    { giorno: 6, label: 'Sab', attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 },
    { giorno: 0, label: 'Dom', attivo: false, accessiAlGiorno: 1, minutiPerAccesso: 60 },
];
// ─── Interfacce ───────────────────────────────────────────────────────────────
interface Paz {
    _id: string;
    firstName: string;
    lastName: string;
    tipoGestione?: string;
}
interface Staff {
    _id: string;
    firstName: string;
    lastName: string;
    role: string;
    category?: string;
    active: boolean;
}
interface Prelievo {
    _id: string;
    patient: Paz;
    staff: any;
    dataPrelievo: string;
    orario?: string;
    tipoPrelievo: string;
    note?: string;
    status: string;
    noteEsecuzione?: string;
    diaria: any[];
    allegati: any[];
}
interface Esame {
    _id: string;
    tipoEsame: string | string[];
    patient: Paz;
    staff: any;
    dataEsame: string;
    orario?: string;
    note?: string;
    status: string;
    diaria: any[];
    allegati: any[];
}
interface Piano {
    _id: string;
    type: 'prestazionale' | 'assistenziale';
    categories?: string[];
    patient: {
        _id: string;
        firstName: string;
        lastName: string;
    };
    staff: any;
    date: string;
    dataFine?: string;
    time?: string;
    duration?: number;
    task: string;
    notes?: string;
    status: string;
    tipoCompenso?: string;
    tariffa?: number;
    compensoTotale?: number;
    costoPrestazione?: number;
    giorniSettimana?: any[];
}
interface VoceTariffario {
    _id: string;
    categoria: string;
    nome: string;
    prezzo: number;
    unitaMisura?: string;
    note?: string;
    attivo: boolean;
}
const CATEGORIE_TARIFFARIO_LABEL: Record<string, string> = { prestazioni_infermieristiche: '💉 Infermieristiche', assistenza_trasporto: '🚑 Assistenza/Trasporto', radiologia: '🩻 Radiologia', ecografia: '🔊 Ecografie' };
// ─── Mini-Calendario ──────────────────────────────────────────────────────────
function Cal({ anno, mese, sel, onDay, onPrev, onNext, dots }: {
    anno: number;
    mese: number;
    sel: string;
    onDay: (d: string) => void;
    onPrev: () => void;
    onNext: () => void;
    dots: Map<string, number>;
}) {
    const dim = getDaysInMonth(anno, mese);
    const first = getFirstDayOfMonth(anno, mese);
    const cells: (number | null)[] = [];
    for (let i = 0; i < first; i++)
        cells.push(null);
    for (let d = 1; d <= dim; d++)
        cells.push(d);
    while (cells.length % 7 !== 0)
        cells.push(null);
    return (<div className="tw-bg-white tw-rounded-2xl tw-border tw-border-slate-100 tw-shadow-sm tw-p-4 tw-mb-4">
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
        <button className="tw-bg-slate-50 hover:tw-bg-slate-100 tw-border-0 tw-cursor-pointer tw-p-2 tw-rounded-lg tw-text-slate-600 tw-transition-colors" onClick={onPrev}><ChevronLeft size={18}/></button>
        <span className="tw-font-bold tw-text-slate-800 tw-text-sm">{MESI[mese]} {anno}</span>
        <button className="tw-bg-slate-50 hover:tw-bg-slate-100 tw-border-0 tw-cursor-pointer tw-p-2 tw-rounded-lg tw-text-slate-600 tw-transition-colors" onClick={onNext}><ChevronRight size={18}/></button>
      </div>
      <div className="tw-grid tw-grid-cols-7 tw-gap-1 tw-text-center">
        {GIORNI_SETT.map(g => <div className="tw-text-xs tw-font-bold tw-text-slate-400 tw-py-1" key={g}>{g}</div>)}
        {cells.map((d, i) => {
            if (!d)
                return <div key={i}/>;
            const iso = `${anno}-${String(mese + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const active = iso === sel;
            const cnt = dots.get(iso) || 0;
            return (<button className={`tw-border-0 tw-cursor-pointer tw-rounded-lg tw-py-1.5 tw-px-0.5 tw-text-sm tw-relative tw-transition-all ${active ? 'tw-bg-blue-600 tw-text-white tw-font-bold tw-shadow-md' : 'tw-bg-transparent tw-text-slate-800 hover:tw-bg-slate-100 tw-font-normal'}`} key={i} onClick={() => onDay(iso)}>
              {d}
              {cnt > 0 && <span className={`tw-absolute tw-bottom-1 tw-left-1/2 tw-w-1.5 tw-h-1.5 tw-rounded-full tw-block -tw-translate-x-1/2 ${active ? 'tw-bg-white' : 'tw-bg-blue-600'}`}/>}
            </button>);
        })}
      </div>
    </div>);
}
// ─── COMPONENTE PRINCIPALE ────────────────────────────────────────────────────
export default function CentroPrenotazioni() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const autoOpenDone = useRef(false);
    const puoGestire = user && ['admin', 'coordinator'].includes(user.role);
    const oggi = new Date();
    const [mainTab, setMainTab] = useState<'prelievi' | 'esami' | 'piani'>('prelievi');
    const [pazienti, setPazienti] = useState<Paz[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    // ── PRELIEVI state ──────────────────────────────────────────────────────────
    const [prelievi, setPrelievi] = useState<Prelievo[]>([]);
    const [prelAnno, setPrelAnno] = useState(oggi.getFullYear());
    const [prelMese, setPrelMese] = useState(oggi.getMonth());
    const [prelGiorno, setPrelGiorno] = useState(toISO(oggi));
    const [subPrel, setSubPrel] = useState<'prenotazioni' | 'assegnazione'>('prenotazioni');
    const [showFP, setShowFP] = useState(false);
    const [fP, setFP] = useState({ patient: '', staff: '', dataPrelievo: toISO(oggi), orario: '', tipoPrelievo: '', note: '' });
    const [savingP, setSavingP] = useState(false);
    const [aperto, setAperto] = useState<string | null>(null);
    const [selP, setSelP] = useState<Set<string>>(new Set());
    const [opP, setOpP] = useState('');
    const [assP, setAssP] = useState(false);
    const [msgP, setMsgP] = useState('');
    const [assAnnoP, setAssAnnoP] = useState(oggi.getFullYear());
    const [assMeseP, setAssMeseP] = useState(oggi.getMonth());
    const [assGiornoP, setAssGiornoP] = useState(toISO(oggi));
    const loadPrelievi = async () => { try {
        const r = await api.get('/prelievi', { params: { tipoGestione: 'privato' } });
        setPrelievi(r.data);
    }
    catch { /***/ } };
    const creaPrelievo = async () => {
        if (!fP.patient || !fP.tipoPrelievo)
            return;
        setSavingP(true);
        try {
            await api.post('/prelievi', { ...fP, staff: fP.staff || undefined });
            setShowFP(false);
            setFP({ patient: '', staff: '', dataPrelievo: prelGiorno, orario: '', tipoPrelievo: '', note: '' });
            await loadPrelievi();
        }
        catch { /***/ }
        setSavingP(false);
    };
    const eliminaPrelievo = async (id: string) => { if (!confirm('Eliminare?'))
        return; try {
        await api.delete(`/prelievi/${id}`);
        await loadPrelievi();
    }
    catch { /***/ } };
    const assegnaPrelievi = async () => {
        if (!opP || selP.size === 0)
            return;
        setAssP(true);
        try {
            await Promise.all([...selP].map(id => api.put(`/prelievi/${id}`, { staff: opP })));
            setSelP(new Set());
            setOpP('');
            setMsgP(`✅ ${selP.size} assegnato/i`);
            await loadPrelievi();
        }
        catch {
            setMsgP('❌ Errore');
        }
        setAssP(false);
        setTimeout(() => setMsgP(''), 3000);
    };
    const prelPerGiorno = useMemo(() => { const m = new Map<string, Prelievo[]>(); prelievi.forEach(p => { const k = toISO(new Date(p.dataPrelievo)); if (!m.has(k))
        m.set(k, []); m.get(k)!.push(p); }); return m; }, [prelievi]);
    const prelSel = useMemo(() => (prelPerGiorno.get(prelGiorno) || []).sort((a, b) => (a.orario || '').localeCompare(b.orario || '')), [prelPerGiorno, prelGiorno]);
    const prelAss = useMemo(() => (prelPerGiorno.get(assGiornoP) || []).filter(p => p.status === 'pianificato'), [prelPerGiorno, assGiornoP]);
    const dotsPrel = useMemo(() => { const m = new Map<string, number>(); prelPerGiorno.forEach((v, k) => m.set(k, v.length)); return m; }, [prelPerGiorno]);
    // ── ESAMI state ─────────────────────────────────────────────────────────────
    const [esami, setEsami] = useState<Esame[]>([]);
    const [eAnno, setEAnno] = useState(oggi.getFullYear());
    const [eMese, setEMese] = useState(oggi.getMonth());
    const [eGiorno, setEGiorno] = useState(toISO(oggi));
    const [subE, setSubE] = useState<'prenotazioni' | 'assegnazione'>('prenotazioni');
    const [showFE, setShowFE] = useState(false);
    const [fE, setFE] = useState({ patient: '', staff: '', dataEsame: toISO(oggi), orario: '', tipoEsame: '', note: '' });
    const [savingE, setSavingE] = useState(false);
    const [apertoE, setApertoE] = useState<string | null>(null);
    const [selE, setSelE] = useState<Set<string>>(new Set());
    const [opE, setOpE] = useState('');
    const [assE, setAssE] = useState(false);
    const [msgE, setMsgE] = useState('');
    const [assAnnoE, setAssAnnoE] = useState(oggi.getFullYear());
    const [assMeseE, setAssMeseE] = useState(oggi.getMonth());
    const [assGiornoE, setAssGiornoE] = useState(toISO(oggi));
    const loadEsami = async () => { try {
        const r = await api.get('/esami-strumentali', { params: { tipoGestione: 'privato', archiviati: 'false' } });
        setEsami(r.data);
    }
    catch { /***/ } };
    const creaEsame = async () => {
        if (!fE.patient || !fE.tipoEsame)
            return;
        setSavingE(true);
        try {
            await api.post('/esami-strumentali', { ...fE, tipoEsame: [fE.tipoEsame], staff: fE.staff || undefined });
            setShowFE(false);
            setFE({ patient: '', staff: '', dataEsame: eGiorno, orario: '', tipoEsame: '', note: '' });
            await loadEsami();
        }
        catch { /***/ }
        setSavingE(false);
    };
    const eliminaEsame = async (id: string) => { if (!confirm('Eliminare?'))
        return; try {
        await api.delete(`/esami-strumentali/${id}`);
        await loadEsami();
    }
    catch { /***/ } };
    const assegnaEsami = async () => {
        if (!opE || selE.size === 0)
            return;
        setAssE(true);
        try {
            await Promise.all([...selE].map(id => api.patch(`/esami-strumentali/${id}`, { staff: opE })));
            setSelE(new Set());
            setOpE('');
            setMsgE(`✅ ${selE.size} assegnato/i`);
            await loadEsami();
        }
        catch {
            setMsgE('❌ Errore');
        }
        setAssE(false);
        setTimeout(() => setMsgE(''), 3000);
    };
    const esamiPerGiorno = useMemo(() => { const m = new Map<string, Esame[]>(); esami.forEach(e => { const k = toISO(new Date(e.dataEsame)); if (!m.has(k))
        m.set(k, []); m.get(k)!.push(e); }); return m; }, [esami]);
    const esamiSel = useMemo(() => (esamiPerGiorno.get(eGiorno) || []).sort((a, b) => (a.orario || '').localeCompare(b.orario || '')), [esamiPerGiorno, eGiorno]);
    const esamiAss = useMemo(() => (esamiPerGiorno.get(assGiornoE) || []).filter(e => e.status === 'pianificato'), [esamiPerGiorno, assGiornoE]);
    const dotsEsami = useMemo(() => { const m = new Map<string, number>(); esamiPerGiorno.forEach((v, k) => m.set(k, v.length)); return m; }, [esamiPerGiorno]);
    // ── PIANI state ─────────────────────────────────────────────────────────────
    const [piani, setPiani] = useState<Piano[]>([]);
    const [pianoTipo, setPianoTipo] = useState<'tutti' | 'prestazionale' | 'assistenziale'>('tutti');
    const [searchP, setSearchP] = useState('');
    const [showFPiano, setShowFPiano] = useState(false);
    const [savingPiano, setSavingPiano] = useState(false);
    const [errPiano, setErrPiano] = useState('');
    const [okPiano, setOkPiano] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [fpTipo, setFpTipo] = useState<'prestazionale' | 'assistenziale'>('prestazionale');
    const [fpTask, setFpTask] = useState('');
    const [fpDate, setFpDate] = useState('');
    const [fpFine, setFpFine] = useState('');
    const [fpTime, setFpTime] = useState('');
    const [fpDur, setFpDur] = useState(60);
    const [fpOre, setFpOre] = useState(1);
    const [fpPaz, setFpPaz] = useState('');
    const [fpStaff, setFpStaff] = useState('');
    const [fpCats, setFpCats] = useState<string[]>([]);
    // Macro-categorie e fabbisogni (come WorkPlan.tsx)
    const [fpMacroCats, setFpMacroCats] = useState<Record<MacroCategoria, boolean>>({ infermieristico: false, riabilitativo: false, medico_specialistiche: false });
    const [fpFabbisogni, setFpFabbisogni] = useState<Record<MacroCategoria, string[]>>({ infermieristico: [], riabilitativo: [], medico_specialistiche: [] });
    const [fpStaffPerCat, setFpStaffPerCat] = useState<Record<MacroCategoria, string>>({ infermieristico: '', riabilitativo: '', medico_specialistiche: '' });
    const [fpNotes, setFpNotes] = useState('');
    const [fpCompenso, setFpCompenso] = useState<'orario' | 'fisso' | 'nessuno'>('nessuno');
    const [fpTariffa, setFpTariffa] = useState(0);
    const [fpCostoOrario, setFpCostoOrario] = useState(0);
    const [fpCosto, setFpCosto] = useState(0);
    const [fpGiorni, setFpGiorni] = useState(GIORNI_DEFAULT.map(g => ({ ...g })));
    const [tariffario, setTariffario] = useState<VoceTariffario[]>([]);
    const [fpTariffarioSel, setFpTariffarioSel] = useState('');
    const [pendingDoc, setPendingDoc] = useState<{
        patientId: string;
        patientNome: string;
        task: string;
        costo: number;
        planId: string;
        dataPrestazione?: string;
    } | null>(null);
    const [docTipo, setDocTipo] = useState<'preventivo' | 'fattura'>('preventivo');
    const [docSaving, setDocSaving] = useState(false);
    const [docCreato, setDocCreato] = useState<any>(null);
    const [emailDoc, setEmailDoc] = useState<any>(null);
    const [emailDestinatario, setEmailDestinatario] = useState('');
    const [emailNome, setEmailNome] = useState('');
    const [emailSending, setEmailSending] = useState(false);
    const loadTariffario = async () => { try {
        const r = await api.get('/tariffario', { params: { soloAttivi: 'true' } });
        setTariffario(r.data);
    }
    catch { /***/ } };
    const loadPiani = async () => { try {
        const r = await api.get('/workplan');
        setPiani(r.data);
    }
    catch { /***/ } };
    const resetFPiano = () => { setFpTipo('prestazionale'); setFpTask(''); setFpDate(''); setFpFine(''); setFpTime(''); setFpDur(60); setFpOre(1); setFpPaz(''); setFpStaff(''); setFpCats([]); setFpNotes(''); setFpCompenso('nessuno'); setFpTariffa(0); setFpCostoOrario(0); setFpCosto(0); setFpTariffarioSel(''); setFpGiorni(GIORNI_DEFAULT.map(g => ({ ...g }))); setFpMacroCats({ infermieristico: false, riabilitativo: false, medico_specialistiche: false }); setFpFabbisogni({ infermieristico: [], riabilitativo: [], medico_specialistiche: [] }); setFpStaffPerCat({ infermieristico: '', riabilitativo: '', medico_specialistiche: '' }); };

    useEffect(() => {
        if (fpTipo === 'assistenziale' && fpCompenso === 'orario') {
            const giorniAttivi = fpGiorni.filter(g => g.attivo).length;
            const oreTotali = fpOre * giorniAttivi;
            setFpCosto(Math.round(oreTotali * fpCostoOrario * 100) / 100);
        }
    }, [fpTipo, fpCompenso, fpOre, fpGiorni, fpCostoOrario]);

    const creaPiano = async (ev: FormEvent) => {
        ev.preventDefault();
        setErrPiano('');
        setOkPiano('');
        if (fpTipo === 'prestazionale') {
            if (!fpPaz || !fpDate || !fpTask) {
                setErrPiano('Compila paziente, data e attività.');
                return;
            }
            const macroSel = (Object.keys(fpMacroCats) as (keyof typeof fpMacroCats)[]).filter(c => fpMacroCats[c]);
            if (macroSel.length === 0) {
                setErrPiano('Seleziona almeno una categoria prestazionale.');
                return;
            }
            for (const cat of macroSel) {
                if (fpFabbisogni[cat].length === 0) {
                    setErrPiano(`Seleziona almeno un fabbisogno per ${MACRO_CATEGORIE_LABELS[cat].label}`);
                    return;
                }
            }
            const catMap: Record<MacroCategoria, 'infermieristica' | 'riabilitativa' | 'medica'> = { infermieristico: 'infermieristica', riabilitativo: 'riabilitativa', medico_specialistiche: 'medica' };
            const prestazioni: any[] = [];
            for (const cat of macroSel) {
                const staffId = fpStaffPerCat[cat] || fpStaff;
                fpFabbisogni[cat].forEach(f => {
                    const opt = FABBISOGNI_OPTIONS[cat].find(o => o.value === f);
                    prestazioni.push({ tipoPrestazione: opt ? opt.label : f, staff: staffId || undefined, categoria: catMap[cat] });
                });
            }
            setSavingPiano(true);
            try {
                const giorniAttivi = fpGiorni.filter(g => g.attivo).map(g => ({ giorno: g.giorno, accessiAlGiorno: g.accessiAlGiorno, minutiPerAccesso: g.minutiPerAccesso }));
                const allFabbisogniLabels: string[] = [];
                macroSel.forEach(cat => { const labels = fpFabbisogni[cat].map(f => { const opt = FABBISOGNI_OPTIONS[cat].find(o => o.value === f); return opt ? `${MACRO_CATEGORIE_LABELS[cat].label.split(' ')[1]}: ${opt.label}` : f; }); allFabbisogniLabels.push(...labels); });
                const res = await api.post('/workplan', {
                    type: fpTipo,
                    macroCategorie: macroSel,
                    fabbisogni: { infermieristico: fpFabbisogni.infermieristico, riabilitativo: fpFabbisogni.riabilitativo, medico_specialistiche: fpFabbisogni.medico_specialistiche },
                    categories: allFabbisogniLabels,
                    prestazioni,
                    patient: fpPaz, staff: fpStaff || prestazioni[0]?.staff, task: fpTask,
                    date: fpDate, dataFine: fpFine || undefined, time: fpTime || undefined, duration: fpDur,
                    notes: fpNotes || undefined, giorniSettimana: giorniAttivi.length > 0 ? giorniAttivi : undefined,
                    tipoCompenso: fpCompenso, tariffa: fpCompenso !== 'nessuno' ? fpTariffa : 0, costoPrestazione: fpCosto > 0 ? fpCosto : 0,
                });
                try {
                    await api.post('/fatturazione-documenti', {
                        tipo: 'preventivo',
                        patient: fpPaz,
                        riferimentoTipo: 'workplan',
                        riferimentoId: res.data._id,
                        dataPrestazione: fpDate,
                        prestazioni: [{ descrizione: fpTask, quantita: 1, prezzoUnitario: fpCosto }],
                    });
                } catch (e: any) { /* preventivo non bloccante */ }
                await loadPiani();
                resetFPiano();
                setShowFPiano(false);
                setOkPiano('✅ Incarico creato!');
                setTimeout(() => setOkPiano(''), 3000);
            }
            catch (err: any) {
                setErrPiano(err.response?.data?.message || 'Errore');
            }
            setSavingPiano(false);
        }
        else {
            if (!fpPaz || !fpDate || !fpTask || fpCats.length === 0) {
                setErrPiano('Compila tutti i campi obbligatori.');
                return;
            }
            setSavingPiano(true);
            try {
                const giorniAttivi = fpGiorni.filter(g => g.attivo).map(g => ({ giorno: g.giorno, accessiAlGiorno: g.accessiAlGiorno, minutiPerAccesso: g.minutiPerAccesso }));
                const res = await api.post('/workplan', { type: fpTipo, categories: fpCats, patient: fpPaz, staff: fpStaff || undefined, task: fpTask, date: fpDate, dataFine: fpFine || undefined, time: fpTime || undefined, duration: fpOre * 60, notes: fpNotes || undefined, giorniSettimana: giorniAttivi.length > 0 ? giorniAttivi : undefined, tipoCompenso: fpCompenso, tariffa: fpCompenso !== 'nessuno' ? fpTariffa : 0, costoPrestazione: fpCosto > 0 ? fpCosto : 0 });
                try {
                    await api.post('/fatturazione-documenti', {
                        tipo: 'preventivo',
                        patient: fpPaz,
                        riferimentoTipo: 'workplan',
                        riferimentoId: res.data._id,
                        dataPrestazione: fpDate,
                        prestazioni: [{ descrizione: fpTask, quantita: 1, prezzoUnitario: fpCosto }],
                    });
                } catch (e: any) { /* preventivo non bloccante */ }
                await loadPiani();
                resetFPiano();
                setShowFPiano(false);
                setOkPiano('✅ Incarico creato!');
                setTimeout(() => setOkPiano(''), 3000);
            }
            catch (err: any) {
                setErrPiano(err.response?.data?.message || 'Errore');
            }
            setSavingPiano(false);
        }
    };
    // ── Generazione preventivo/fattura al termine della prenotazione ───────────
    const generaDocumentoFatturazione = async () => {
        if (!pendingDoc)
            return;
        setDocSaving(true);
        try {
            const res = await api.post('/fatturazione-documenti', {
                tipo: docTipo,
                patient: pendingDoc.patientId,
                riferimentoTipo: 'workplan',
                riferimentoId: pendingDoc.planId,
                dataPrestazione: pendingDoc.dataPrestazione,
                prestazioni: [{ descrizione: pendingDoc.task, quantita: 1, prezzoUnitario: pendingDoc.costo }],
            });
            setDocCreato(res.data);
        }
        catch (err: any) {
            alert(err.response?.data?.message || 'Errore nella generazione del documento');
        }
        setDocSaving(false);
    };
    const scaricaDocumentoPDF = async (doc: any) => {
        try {
            const res = await api.get(`/fatturazione-documenti/${doc._id}/pdf`, { responseType: 'blob' });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${doc.tipo === 'fattura' ? 'FATTURA' : 'PREVENTIVO'}-${doc.numero}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Errore nel download del PDF');
        }
    };

    const apriInvioEmail = (doc: any) => {
        setEmailDoc(doc);
        setEmailDestinatario(doc.patient?.email || '');
        setEmailNome(`${doc.patient?.firstName || ''} ${doc.patient?.lastName || ''}`.trim());
        setEmailSending(false);
    };

    const chiudiInvioEmail = () => {
        setEmailDoc(null);
        setEmailDestinatario('');
        setEmailNome('');
        setEmailSending(false);
    };

    const inviaDocumentoEmail = async (e: FormEvent) => {
        e.preventDefault();
        if (!emailDoc || !emailDestinatario) return;
        setEmailSending(true);
        try {
            await api.post(`/fatturazione-documenti/${emailDoc._id}/invia-email`, {
                email: emailDestinatario,
                nome: emailNome,
            });
            alert('Documento inviato con successo');
            chiudiInvioEmail();
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Errore nell\'invio dell\'email');
        } finally {
            setEmailSending(false);
        }
    };
    const eliminaPiano = async (id: string) => { if (!confirm('Eliminare?'))
        return; try {
        await api.delete(`/workplan/${id}`);
        await loadPiani();
    }
    catch { /***/ } };
    const copiaLink = async (id: string) => {
        const url = `${window.location.origin}/accesso/${id}`;
        try {
            await navigator.clipboard.writeText(url);
        }
        catch {
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
    const pianiFiltrati = useMemo(() => {
        let list = piani.filter(w => w.status !== 'cancelled');
        if (pianoTipo !== 'tutti')
            list = list.filter(w => w.type === pianoTipo);
        const t = searchP.toLowerCase().trim();
        if (t)
            list = list.filter(w => `${w.patient?.firstName} ${w.patient?.lastName} ${w.staff?.firstName} ${w.staff?.lastName} ${w.task}`.toLowerCase().includes(t));
        return list;
    }, [piani, pianoTipo, searchP]);
    // ─── Caricamento ───────────────────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const [pazRes, staffRes] = await Promise.all([api.get('/patients'), api.get('/staff', { params: { active: true } })]);
                const pazList = (pazRes.data as Paz[]).filter(p => p.tipoGestione === 'privato' || !p.tipoGestione);
                setPazienti(pazList);
                setStaff((staffRes.data as Staff[]).filter(s => s.active));
                // Auto-apertura form piano se arrivati da GestioneRichieste dopo approvazione
                if (!autoOpenDone.current) {
                    const pazienteId = searchParams.get('pazienteId');
                    const apriPiano = searchParams.get('apriPiano');
                    if (pazienteId && apriPiano === 'true') {
                        autoOpenDone.current = true;
                        setFpPaz(pazienteId);
                        setMainTab('piani');
                        setShowFPiano(true);
                        setSearchParams({}, { replace: true });
                    }
                }
            }
            catch { /***/ }
            await Promise.all([loadPrelievi(), loadEsami(), loadPiani(), loadTariffario()]);
            setLoading(false);
        })();
    }, []);
    const COL = { prelievi: '#0369a1', esami: '#7c3aed', piani: '#059669' };
    const colore = COL[mainTab];
    if (loading)
        return (<section className="tw-min-h-screen tw-flex tw-items-center tw-justify-center tw-bg-slate-50">
            <div className="tw-bg-white tw-rounded-2xl tw-shadow-sm tw-border tw-border-slate-100 tw-p-10 tw-text-slate-500 tw-font-medium">⏳ Caricamento...</div>
        </section>);
    const subTabClass = "tw-py-1.5 tw-px-4 tw-rounded-lg tw-border-0 tw-cursor-pointer tw-font-semibold tw-text-sm tw-flex tw-items-center tw-gap-1.5 tw-transition-colors";
    return (<section className="fade-in tw-bg-slate-50 tw-min-h-screen tw-p-4 md:tw-p-6">
      <div className="tw-max-w-7xl tw-mx-auto tw-space-y-6">
      {/* Header */}
      <div className="tw-flex tw-justify-between tw-items-center tw-flex-wrap tw-gap-4 tw-bg-white tw-rounded-2xl tw-shadow-sm tw-border tw-border-slate-100 tw-p-5 md:tw-p-6">
        <div className="tw-flex tw-items-center tw-gap-4">
          <div className={`tw-p-3 tw-rounded-xl tw-text-white tw-shadow-sm ${mainTab === 'prelievi' ? 'tw-bg-sky-600' : mainTab === 'esami' ? 'tw-bg-violet-600' : 'tw-bg-emerald-600'}`}>
            <Calendar size={24}/>
          </div>
          <div>
            <h1 className="tw-m-0 tw-text-xl md:tw-text-2xl tw-font-bold tw-text-slate-900">Centro Prenotazioni</h1>
            <p className="tw-m-0 tw-text-sm tw-text-slate-500">Gestione privata prelievi, esami e piani lavorativi</p>
          </div>
        </div>
      </div>

      {/* Tab bar principale */}
      <div className="tw-flex tw-gap-1 tw-bg-white tw-rounded-2xl tw-shadow-sm tw-border tw-border-slate-100 tw-p-1.5 tw-w-fit">
        {(['prelievi', 'esami', 'piani'] as const).map(t => (<button className={`tw-py-2.5 tw-px-5 tw-rounded-xl tw-border-0 tw-cursor-pointer tw-font-semibold tw-text-sm tw-transition-all tw-duration-200 ${mainTab === t ? (t === 'prelievi' ? 'tw-bg-sky-600 tw-text-white tw-shadow-md' : t === 'esami' ? 'tw-bg-violet-600 tw-text-white tw-shadow-md' : 'tw-bg-emerald-600 tw-text-white tw-shadow-md') : 'tw-bg-transparent tw-text-slate-500 hover:tw-bg-slate-50 hover:tw-text-slate-700'}`} key={t} onClick={() => setMainTab(t)}>
            {t === 'prelievi' ? '💉 Prelievi' : t === 'esami' ? '🏥 Esami Strumentali' : '📋 Piani Lavorativi'}
          </button>))}
      </div>

      {/* ══ TAB PRELIEVI ══════════════════════════════════════════════════════ */}
      {mainTab === 'prelievi' && (<div>
          <div className="tw-flex tw-gap-1 tw-mb-4 tw-bg-white tw-rounded-2xl tw-shadow-sm tw-border tw-border-slate-100 tw-p-1.5 tw-w-fit">
            <button className={`${subTabClass} ${subPrel === 'prenotazioni' ? 'tw-bg-sky-700 tw-text-white tw-shadow-sm' : 'tw-bg-transparent tw-text-slate-500 hover:tw-bg-slate-50'}`} onClick={() => setSubPrel('prenotazioni')}><ClipboardList size={14}/>Prenotazioni</button>
            <button className={`${subTabClass} ${subPrel === 'assegnazione' ? 'tw-bg-sky-700 tw-text-white tw-shadow-sm' : 'tw-bg-transparent tw-text-slate-500 hover:tw-bg-slate-50'}`} onClick={() => setSubPrel('assegnazione')}><UserCheck size={14}/>Assegnazione</button>
          </div>

          {subPrel === 'prenotazioni' && (<div className="tw-grid tw-grid-cols-[300px_1fr] tw-gap-[20px] tw-items-start">
              <div>
                <Cal anno={prelAnno} mese={prelMese} sel={prelGiorno} onDay={setPrelGiorno} onPrev={() => { if (prelMese === 0) {
                setPrelMese(11);
                setPrelAnno(a => a - 1);
            }
            else
                setPrelMese(m => m - 1); }} onNext={() => { if (prelMese === 11) {
                setPrelMese(0);
                setPrelAnno(a => a + 1);
            }
            else
                setPrelMese(m => m + 1); }} dots={dotsPrel}/>
                {puoGestire && <button className="tw-w-full tw-bg-sky-600 hover:tw-bg-sky-700 tw-text-white tw-border-0 tw-rounded-xl tw-py-3 tw-px-4 tw-cursor-pointer tw-font-semibold tw-flex tw-items-center tw-justify-center tw-gap-2 tw-shadow-sm tw-transition-colors" onClick={() => { setFP(f => ({ ...f, dataPrelievo: prelGiorno })); setShowFP(true); }}><Plus size={16}/> Nuovo Prelievo</button>}
              </div>
              <div>
                <h3 className="tw-text-sky-600 tw-mb-3 tw-mt-0">
                  {new Date(prelGiorno + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  <span className="tw-ml-2 tw-bg-blue-50 tw-text-blue-700 tw-rounded-full tw-py-0.5 tw-px-2.5 tw-text-xs tw-font-semibold">{prelSel.length}</span>
                </h3>
                {prelSel.length === 0
                    ? <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-slate-100 tw-shadow-sm tw-p-8 tw-text-center tw-text-slate-400">Nessun prelievo</div>
                    : <div className="tw-flex tw-flex-col tw-gap-2.5">
                    {prelSel.map(p => (<div className={`tw-bg-white tw-rounded-xl tw-overflow-hidden tw-border tw-border-blue-100 tw-shadow-sm hover:tw-shadow-md tw-transition-shadow ${p.status === 'eseguito' ? 'tw-border-l-4 tw-border-l-emerald-500' : 'tw-border-l-4 tw-border-l-sky-600'}`} key={p._id}>
                        <button className="tw-w-full tw-bg-transparent tw-border-0 tw-cursor-pointer tw-py-3 tw-px-3.5 tw-text-left tw-flex tw-justify-between tw-items-center" type="button" onClick={() => setAperto(aperto === p._id ? null : p._id)}>
                          <div>
                            <div className="tw-font-bold tw-text-sm"><User className="tw-inline tw-mr-1" size={14}/>{p.patient?.firstName} {p.patient?.lastName}{p.orario && <span className="tw-ml-2 tw-text-slate-500 tw-font-normal tw-text-xs"><Clock className="tw-inline" size={11}/> {p.orario}</span>}</div>
                            <div className="tw-text-xs tw-text-slate-500">💉 {p.tipoPrelievo} <span className={`tw-ml-1.5 tw-py-px tw-px-2 tw-rounded-full tw-text-[0.65rem] tw-font-bold ${p.status === 'eseguito' ? 'tw-bg-emerald-50 tw-text-emerald-600' : 'tw-bg-blue-50 tw-text-blue-700'}`}>{p.status === 'eseguito' ? '✅ Eseguito' : '🔵 Pianificato'}</span></div>
                          </div>
                          <div className="tw-flex tw-gap-1.5">
                            {puoGestire && <button className="tw-bg-red-50 hover:tw-bg-red-100 tw-border tw-border-red-100 tw-rounded-lg tw-py-1 tw-px-2 tw-cursor-pointer tw-text-red-600 tw-transition-colors" onClick={e => { e.stopPropagation(); eliminaPrelievo(p._id); }}><Trash2 size={14}/></button>}
                            {aperto === p._id ? <ChevronUp className="tw-text-slate-400" size={15}/> : <ChevronDown className="tw-text-slate-400" size={15}/>}
                          </div>
                        </button>
                        {aperto === p._id && (<div className="tw-border-t tw-border-slate-100 tw-py-2.5 tw-px-3.5 tw-bg-slate-50 tw-text-sm">
                            {p.staff?.firstName && <p className="tw-mt-0 tw-mx-0 tw-mb-1">👤 {p.staff.firstName} {p.staff.lastName}</p>}
                            {p.note && <p className="tw-m-0 tw-text-slate-600">📝 {p.note}</p>}
                          </div>)}
                      </div>))}
                  </div>}
              </div>
            </div>)}

          {subPrel === 'assegnazione' && (<div className="tw-grid tw-grid-cols-[300px_1fr] tw-gap-5 tw-items-start">
              <Cal anno={assAnnoP} mese={assMeseP} sel={assGiornoP} onDay={setAssGiornoP} onPrev={() => { if (assMeseP === 0) {
                setAssMeseP(11);
                setAssAnnoP(a => a - 1);
            }
            else
                setAssMeseP(m => m - 1); }} onNext={() => { if (assMeseP === 11) {
                setAssMeseP(0);
                setAssAnnoP(a => a + 1);
            }
            else
                setAssMeseP(m => m + 1); }} dots={dotsPrel}/>
              <div>
                <h3 className="tw-text-sky-600 tw-mb-3 tw-mt-0">Assegnazione — {new Date(assGiornoP + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</h3>
                {msgP && <div className="tw-bg-emerald-50 tw-border tw-border-emerald-100 tw-rounded-lg tw-py-2.5 tw-px-3.5 tw-mb-3 tw-text-green-800 tw-font-semibold">{msgP}</div>}
                <div className="tw-flex tw-gap-2.5 tw-mb-3.5 tw-flex-wrap">
                  <select className="tw-flex-1 tw-min-w-[200px] tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-sky-500/20 focus:tw-border-sky-500" value={opP} onChange={e => setOpP(e.target.value)}>
                    <option value="">Seleziona operatore...</option>
                    {staff.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} — {s.role}</option>)}
                  </select>
                  <button className={`tw-py-2 tw-px-5 tw-bg-sky-600 tw-text-white tw-border-0 tw-rounded-lg tw-cursor-pointer tw-font-semibold tw-flex tw-items-center tw-gap-1.5 tw-shadow-sm tw-transition-colors ${(selP.size === 0 || !opP) ? 'tw-opacity-50' : 'hover:tw-bg-sky-700'}`} onClick={assegnaPrelievi} disabled={assP || selP.size === 0 || !opP}>
                    {assP ? '...' : <><UserCheck size={14}/>Assegna ({selP.size})</>}
                  </button>
                </div>
                {prelAss.length === 0
                    ? <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-slate-100 tw-shadow-sm tw-p-6 tw-text-center tw-text-slate-400">Nessun prelievo pianificato</div>
                    : <div className="tw-flex tw-flex-col tw-gap-2">
                    {prelAss.map(p => {
                            const s = selP.has(p._id);
                            return (<div className={`tw-rounded-xl tw-py-3 tw-px-3.5 tw-cursor-pointer tw-flex tw-justify-between tw-items-center tw-transition-colors ${s ? 'tw-bg-blue-50 tw-border-2 tw-border-blue-600 tw-shadow-sm' : 'tw-bg-white tw-border-2 tw-border-slate-200 hover:tw-bg-slate-50'}`} key={p._id} onClick={() => setSelP(prev => { const n = new Set(prev); s ? n.delete(p._id) : n.add(p._id); return n; })}>
                        <div><div className="tw-font-bold tw-text-sm">{p.patient?.firstName} {p.patient?.lastName}</div><div className="tw-text-xs tw-text-slate-500">💉 {p.tipoPrelievo}{p.orario ? ` · ${p.orario}` : ''}</div></div>
                        <div className={`tw-w-5 tw-h-5 tw-rounded-full tw-flex tw-items-center tw-justify-center ${s ? 'tw-border-2 tw-border-blue-600 tw-bg-blue-600' : 'tw-border-2 tw-border-slate-300 tw-bg-transparent'}`}>{s && <CheckCircle size={12} color="white"/>}</div>
                      </div>);
                        })}
                  </div>}
              </div>
            </div>)}
        </div>)}

      {/* ══ TAB ESAMI ══════════════════════════════════════════════════════════ */}
      {mainTab === 'esami' && (<div>
          <div className="tw-flex tw-gap-1 tw-mb-4 tw-bg-white tw-rounded-2xl tw-shadow-sm tw-border tw-border-slate-100 tw-p-1.5 tw-w-fit">
            <button className={`${subTabClass} ${subE === 'prenotazioni' ? 'tw-bg-violet-600 tw-text-white tw-shadow-sm' : 'tw-bg-transparent tw-text-slate-500 hover:tw-bg-slate-50'}`} onClick={() => setSubE('prenotazioni')}><ClipboardList size={14}/>Prenotazioni</button>
            <button className={`${subTabClass} ${subE === 'assegnazione' ? 'tw-bg-violet-600 tw-text-white tw-shadow-sm' : 'tw-bg-transparent tw-text-slate-500 hover:tw-bg-slate-50'}`} onClick={() => setSubE('assegnazione')}><UserCheck size={14}/>Assegnazione</button>
          </div>

          {subE === 'prenotazioni' && (<div className="tw-grid tw-grid-cols-[minmax(240px,300px)_1fr] tw-gap-4 tw-items-start">
              <div>
                <Cal anno={eAnno} mese={eMese} sel={eGiorno} onDay={setEGiorno} onPrev={() => { if (eMese === 0) {
                setEMese(11);
                setEAnno(a => a - 1);
            }
            else
                setEMese(m => m - 1); }} onNext={() => { if (eMese === 11) {
                setEMese(0);
                setEAnno(a => a + 1);
            }
            else
                setEMese(m => m + 1); }} dots={dotsEsami}/>
                {puoGestire && <button className="tw-w-full tw-bg-violet-600 hover:tw-bg-violet-700 tw-text-white tw-border-0 tw-rounded-xl tw-py-3 tw-px-4 tw-cursor-pointer tw-font-semibold tw-flex tw-items-center tw-justify-center tw-gap-2 tw-shadow-sm tw-transition-colors" onClick={() => { setFE(f => ({ ...f, dataEsame: eGiorno })); setShowFE(true); }}><Plus size={16}/> Nuovo Esame</button>}
              </div>
              <div>
                <h3 className="tw-text-violet-600 tw-mb-3 tw-mt-0">
                  {new Date(eGiorno + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  <span className="tw-ml-2 tw-bg-violet-50 tw-text-violet-700 tw-rounded-full tw-py-0.5 tw-px-2.5 tw-text-xs tw-font-semibold">{esamiSel.length}</span>
                </h3>
                {esamiSel.length === 0
                    ? <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-slate-100 tw-shadow-sm tw-p-8 tw-text-center tw-text-slate-400">Nessun esame</div>
                    : <div className="tw-flex tw-flex-col tw-gap-2.5">
                    {esamiSel.map(e => (<div className="tw-bg-white tw-border tw-border-violet-100 tw-rounded-xl tw-overflow-hidden tw-border-l-4 tw-border-l-violet-600 tw-shadow-sm hover:tw-shadow-md tw-transition-shadow" key={e._id}>
                        <button className="tw-w-full tw-bg-transparent tw-border-0 tw-cursor-pointer tw-py-3 tw-px-3.5 tw-text-left tw-flex tw-justify-between tw-items-center" type="button" onClick={() => setApertoE(apertoE === e._id ? null : e._id)}>
                          <div>
                            <div className="tw-font-bold tw-text-sm"><User className="tw-inline tw-mr-1" size={14}/>{e.patient?.firstName} {e.patient?.lastName}{e.orario && <span className="tw-ml-2 tw-text-slate-500 tw-font-normal tw-text-xs"><Clock className="tw-inline" size={11}/> {e.orario}</span>}</div>
                            <div className="tw-text-xs tw-text-slate-500">🏥 {e.tipoEsame ? (Array.isArray(e.tipoEsame) ? e.tipoEsame.join(', ') : e.tipoEsame) : 'N/D'} <span className="tw-ml-1.5 tw-py-px tw-px-2 tw-rounded-full tw-text-[0.65rem] tw-font-bold tw-bg-violet-50 tw-text-violet-700">{e.status === 'eseguito' ? '✅ Eseguito' : e.status === 'refertato' ? '📋 Refertato' : '🔵 Pianificato'}</span></div>
                          </div>
                          <div className="tw-flex tw-gap-1.5">
                            {puoGestire && <button className="tw-bg-red-50 hover:tw-bg-red-100 tw-border tw-border-red-100 tw-rounded-lg tw-py-1 tw-px-2 tw-cursor-pointer tw-text-red-600 tw-transition-colors" onClick={ev => { ev.stopPropagation(); eliminaEsame(e._id); }}><Trash2 size={14}/></button>}
                            <button className="tw-bg-violet-50 hover:tw-bg-violet-100 tw-border tw-border-violet-200 tw-rounded-lg tw-py-1 tw-px-2 tw-cursor-pointer tw-text-violet-600 tw-transition-colors" onClick={ev => { ev.stopPropagation(); navigate('/esami-strumentali'); }} title="Gestisci"><Eye size={14}/></button>
                            {apertoE === e._id ? <ChevronUp className="tw-text-slate-400" size={15}/> : <ChevronDown className="tw-text-slate-400" size={15}/>}
                          </div>
                        </button>
                        {apertoE === e._id && <div className="tw-border-t tw-border-slate-100 tw-py-2.5 tw-px-3.5 tw-bg-violet-50 tw-text-sm">
                          {e.staff?.firstName && <p className="tw-mt-0 tw-mx-0 tw-mb-1">👤 {e.staff.firstName} {e.staff.lastName}</p>}
                          {e.note && <p className="tw-m-0 tw-text-slate-600">📝 {e.note}</p>}
                        </div>}
                      </div>))}
                  </div>}
              </div>
            </div>)}

          {subE === 'assegnazione' && (<div className="tw-grid tw-grid-cols-[minmax(240px,300px)_1fr] tw-gap-4 tw-items-start">
              <Cal anno={assAnnoE} mese={assMeseE} sel={assGiornoE} onDay={setAssGiornoE} onPrev={() => { if (assMeseE === 0) {
                setAssMeseE(11);
                setAssAnnoE(a => a - 1);
            }
            else
                setAssMeseE(m => m - 1); }} onNext={() => { if (assMeseE === 11) {
                setAssMeseE(0);
                setAssAnnoE(a => a + 1);
            }
            else
                setAssMeseE(m => m + 1); }} dots={dotsEsami}/>
              <div>
                <h3 className="tw-text-violet-600 tw-mb-3 tw-mt-0">Assegnazione — {new Date(assGiornoE + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</h3>
                {msgE && <div className="tw-bg-emerald-50 tw-border tw-border-emerald-100 tw-rounded-lg tw-py-2.5 tw-px-3.5 tw-mb-3 tw-text-green-800 tw-font-semibold">{msgE}</div>}
                <div className="tw-flex tw-gap-2.5 tw-mb-3.5 tw-flex-wrap">
                  <select className="tw-flex-1 tw-min-w-[200px] tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-violet-500/20 focus:tw-border-violet-500" value={opE} onChange={e => setOpE(e.target.value)}>
                    <option value="">Seleziona operatore...</option>
                    {staff.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} — {s.role}</option>)}
                  </select>
                  <button className={`tw-py-2 tw-px-5 tw-bg-violet-600 tw-text-white tw-border-0 tw-rounded-lg tw-cursor-pointer tw-font-semibold tw-flex tw-items-center tw-gap-1.5 tw-shadow-sm tw-transition-colors ${(selE.size === 0 || !opE) ? 'tw-opacity-50' : 'hover:tw-bg-violet-700'}`} onClick={assegnaEsami} disabled={assE || selE.size === 0 || !opE}>
                    {assE ? '...' : <><UserCheck size={14}/>Assegna ({selE.size})</>}
                  </button>
                </div>
                {esamiAss.length === 0
                    ? <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-slate-100 tw-shadow-sm tw-p-6 tw-text-center tw-text-slate-400">Nessun esame pianificato</div>
                    : <div className="tw-flex tw-flex-col tw-gap-2">
                    {esamiAss.map(e => {
                            const s = selE.has(e._id);
                            return (<div className={`tw-rounded-xl tw-py-3 tw-px-3.5 tw-cursor-pointer tw-flex tw-justify-between tw-items-center tw-transition-colors ${s ? 'tw-bg-violet-50 tw-border-2 tw-border-violet-600 tw-shadow-sm' : 'tw-bg-white tw-border-2 tw-border-slate-200 hover:tw-bg-slate-50'}`} key={e._id} onClick={() => setSelE(prev => { const n = new Set(prev); s ? n.delete(e._id) : n.add(e._id); return n; })}>
                        <div><div className="tw-font-bold tw-text-sm">{e.patient?.firstName} {e.patient?.lastName}</div><div className="tw-text-xs tw-text-slate-500">🏥 {e.tipoEsame ? (Array.isArray(e.tipoEsame) ? e.tipoEsame.join(', ') : e.tipoEsame) : 'N/D'}{e.orario ? ` · ${e.orario}` : ''}</div></div>
                        <div className={`tw-w-5 tw-h-5 tw-rounded-full tw-flex tw-items-center tw-justify-center ${s ? 'tw-border-2 tw-border-violet-600 tw-bg-violet-600' : 'tw-border-2 tw-border-slate-300 tw-bg-transparent'}`}>{s && <CheckCircle size={12} color="white"/>}</div>
                      </div>);
                        })}
                  </div>}
              </div>
            </div>)}
        </div>)}

      {/* ══ TAB PIANI LAVORATIVI ══════════════════════════════════════════════ */}
      {mainTab === 'piani' && (<div>
          {okPiano && <div className="tw-bg-emerald-50 tw-border tw-border-emerald-100 tw-rounded-lg tw-py-2.5 tw-px-4 tw-mb-3 tw-text-green-800 tw-font-semibold">{okPiano}</div>}
          {errPiano && <div className="tw-bg-red-50 tw-border tw-border-red-100 tw-rounded-lg tw-py-2.5 tw-px-4 tw-mb-3 tw-text-red-600">{errPiano}</div>}
          <div className="tw-flex tw-gap-4 tw-mb-3.5 tw-flex-wrap tw-items-center tw-justify-between">
            <div className="tw-flex tw-gap-1 tw-bg-white tw-rounded-2xl tw-shadow-sm tw-border tw-border-slate-100 tw-p-1.5">
              {(['tutti', 'prestazionale', 'assistenziale'] as const).map(val => (<button className={`tw-py-1.5 tw-px-2.5 tw-rounded-lg tw-border-0 tw-cursor-pointer tw-font-semibold tw-text-xs tw-transition-colors ${pianoTipo === val ? 'tw-bg-emerald-600 tw-text-white tw-shadow-sm' : 'tw-bg-transparent tw-text-slate-500 hover:tw-bg-slate-50'}`} key={val} onClick={() => setPianoTipo(val)}>
                  {val === 'tutti' ? 'Tutti' : val === 'prestazionale' ? 'Prestazionali' : 'Assistenziali'}
                </button>))}
            </div>
            <div className="tw-flex tw-gap-2 tw-flex-wrap tw-flex-auto tw-justify-end">
              <div className="tw-relative tw-flex-[1_1_120px] tw-max-w-[200px] tw-min-w-[100px]">
                <Search className="tw-absolute tw-left-3 tw-top-1/2 -tw-translate-y-1/2 tw-text-slate-400" size={14}/>
                <input className="tw-pl-9 tw-py-2 tw-pr-3 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-w-full tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-emerald-500/20 focus:tw-border-emerald-500" value={searchP} onChange={e => setSearchP(e.target.value)} placeholder="Cerca..."/>
              </div>
              {puoGestire && <button className="tw-bg-emerald-600 hover:tw-bg-emerald-700 tw-text-white tw-py-2 tw-px-3.5 tw-rounded-lg tw-border-0 tw-cursor-pointer tw-font-semibold tw-text-sm tw-flex tw-items-center tw-gap-1.5 tw-whitespace-nowrap tw-shadow-sm tw-transition-colors" onClick={() => setShowFPiano(true)}><Plus size={14}/> Nuovo</button>}
            </div>
          </div>
          {pianiFiltrati.length === 0
                ? <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-slate-100 tw-shadow-sm tw-p-10 tw-text-center tw-text-slate-400">Nessun incarico {pianoTipo}</div>
                : <div className="tw-flex tw-flex-col tw-gap-2.5">
              {pianiFiltrati.map(w => {
                        const allCats = [...PREST_CATS, ...ASSIST_CATS];
                        const labels = (w.categories || []).map(c => allCats.find(x => x.value === c)?.label || c);
                        return (<div className={`tw-bg-white tw-border tw-border-slate-100 tw-rounded-xl tw-py-3 tw-px-3.5 tw-flex tw-justify-between tw-items-start tw-gap-2 tw-flex-wrap tw-shadow-sm hover:tw-shadow-md tw-transition-shadow ${w.status === 'completed' ? 'tw-border-l-4 tw-border-l-emerald-600' : 'tw-border-l-4 tw-border-l-emerald-500'}`} key={w._id}>
                    <div className="tw-flex-1 tw-min-w-[0]">
                      <div className="tw-font-bold tw-text-sm tw-text-slate-900 tw-mb-1 tw-break-words">
                        {w.patient?.firstName ?? '(paziente eliminato)'} {w.patient?.lastName ?? ''}
                        <span className={`tw-ml-1.5 tw-py-px tw-px-1.5 tw-rounded-full tw-text-[0.55rem] tw-font-bold ${w.type === 'prestazionale' ? 'tw-bg-blue-50 tw-text-blue-700' : 'tw-bg-pink-50 tw-text-pink-700'}`}>{w.type === 'prestazionale' ? 'PREST' : 'ASS'}</span>
                        <span className={`tw-ml-1 tw-py-px tw-px-1.5 tw-rounded-full tw-text-[0.55rem] tw-font-bold tw-text-emerald-700 ${w.status === 'completed' ? 'tw-bg-emerald-50' : 'tw-bg-emerald-100'}`}>{w.status === 'completed' ? '✅' : '🟢'}</span>
                      </div>
                      <div className="tw-text-xs tw-text-slate-600">👤 {w.staff?.firstName} {w.staff?.lastName} — {w.staff?.role}</div>
                      <div className="tw-text-xs tw-text-slate-500 tw-break-words">📋 {w.task}{labels.length > 0 && <span className="tw-text-slate-400"> · {labels.join(', ')}</span>}</div>
                      <div className="tw-text-[0.7rem] tw-text-slate-400 tw-mt-1"><Calendar className="tw-inline tw-mr-1" size={10}/>{new Date(w.date).toLocaleDateString('it-IT')}{w.dataFine && ` → ${new Date(w.dataFine).toLocaleDateString('it-IT')}`}</div>
                    </div>
                    <div className="tw-flex tw-gap-1 tw-flex-shrink-0 tw-flex-wrap">
                      <button className="tw-bg-emerald-50 hover:tw-bg-emerald-100 tw-border tw-border-emerald-100 tw-rounded-lg tw-py-1.5 tw-px-2 tw-cursor-pointer tw-text-emerald-600 tw-text-[0.7rem] tw-flex tw-items-center tw-gap-1 tw-transition-colors" onClick={() => navigate('/workplan')}><Eye size={12}/> Dettaglio</button>
                      <button className="tw-bg-sky-50 hover:tw-bg-sky-100 tw-border tw-border-sky-100 tw-rounded-lg tw-py-1.5 tw-px-2 tw-cursor-pointer tw-text-sky-600 tw-text-[0.7rem] tw-flex tw-items-center tw-gap-1 tw-transition-colors" onClick={() => copiaLink(w._id)}>{copiedId === w._id ? <CheckCircle size={12}/> : <Copy size={12}/>}</button>
                      {puoGestire && <button className="tw-bg-red-50 hover:tw-bg-red-100 tw-border tw-border-red-100 tw-rounded-lg tw-py-1.5 tw-px-2 tw-cursor-pointer tw-text-red-600 tw-transition-colors" onClick={() => eliminaPiano(w._id)}><Trash2 size={12}/></button>}
                    </div>
                  </div>);
                    })}
            </div>}
        </div>)}

      {/* ══ MODAL NUOVO PRELIEVO ══════════════════════════════════════════════ */}
      {showFP && puoGestire && (<div className="modal-overlay tw-fixed tw-inset-0 tw-bg-black/50 tw-backdrop-blur-sm tw-flex tw-items-start tw-justify-center tw-z-[1000] tw-py-10 tw-px-4 tw-overflow-y-auto" onClick={() => setShowFP(false)}>
          <div className="modal-content tw-max-w-[500px] tw-w-full tw-bg-white tw-rounded-2xl tw-p-6 tw-shadow-2xl tw-max-h-[calc(100vh_-_80px)] tw-overflow-y-auto tw-box-border" onClick={e => e.stopPropagation()}>
            <div className="tw-flex tw-justify-between tw-items-center tw-mb-5">
              <h3 className="tw-m-0 tw-text-sky-600 tw-flex tw-items-center tw-gap-2 tw-font-bold tw-text-lg"><Syringe size={20}/>Nuovo Prelievo</h3>
              <button className="tw-bg-transparent tw-border-0 tw-cursor-pointer tw-text-slate-500 hover:tw-text-slate-700 tw-transition-colors" onClick={() => setShowFP(false)}><X size={22}/></button>
            </div>
            <div className="tw-grid tw-gap-3.5">
              <label className="tw-font-semibold tw-text-sm">Paziente *<select className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-sky-500/20 focus:tw-border-sky-500" value={fP.patient} onChange={e => setFP(f => ({ ...f, patient: e.target.value }))}><option value="">Seleziona...</option>{pazienti.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}</select></label>
              <label className="tw-font-semibold tw-text-sm">Operatore<select className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-sky-500/20 focus:tw-border-sky-500" value={fP.staff} onChange={e => setFP(f => ({ ...f, staff: e.target.value }))}><option value="">Da assegnare...</option>{staff.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} — {s.role}</option>)}</select></label>
              <div className="tw-grid tw-grid-cols-2 tw-gap-3">
                <label className="tw-font-semibold tw-text-sm">Data *<input className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-sky-500/20 focus:tw-border-sky-500" type="date" value={fP.dataPrelievo} onChange={e => setFP(f => ({ ...f, dataPrelievo: e.target.value }))}/></label>
                <label className="tw-font-semibold tw-text-sm">Orario<input className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-sky-500/20 focus:tw-border-sky-500" type="time" value={fP.orario} onChange={e => setFP(f => ({ ...f, orario: e.target.value }))}/></label>
              </div>
              <label className="tw-font-semibold tw-text-sm">Tipo prelievo *<select className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-sky-500/20 focus:tw-border-sky-500" value={fP.tipoPrelievo} onChange={e => setFP(f => ({ ...f, tipoPrelievo: e.target.value }))}><option value="">Seleziona...</option>{TIPI_PRELIEVO.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
              <label className="tw-font-semibold tw-text-sm">Note<textarea className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm tw-resize-y focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-sky-500/20 focus:tw-border-sky-500" value={fP.note} onChange={e => setFP(f => ({ ...f, note: e.target.value }))} rows={2}/></label>
            </div>
            <div className="tw-flex tw-gap-2.5 tw-mt-6 tw-justify-end">
              <button className="tw-py-2.5 tw-px-5 tw-rounded-lg tw-border tw-border-slate-200 tw-bg-white tw-cursor-pointer tw-text-slate-700 tw-font-semibold hover:tw-bg-slate-50 tw-transition-colors" onClick={() => setShowFP(false)}>Annulla</button>
              <button className={`tw-py-2.5 tw-px-6 tw-rounded-lg tw-bg-sky-600 tw-text-white tw-border-0 tw-cursor-pointer tw-font-bold tw-flex tw-items-center tw-gap-2 tw-shadow-sm tw-transition-colors ${(!fP.patient || !fP.tipoPrelievo) ? 'tw-opacity-60' : 'hover:tw-bg-sky-700'}`} onClick={creaPrelievo} disabled={savingP || !fP.patient || !fP.tipoPrelievo}>{savingP ? '...' : <><CheckCircle size={16}/>Salva</>}</button>
            </div>
          </div>
        </div>)}

      {/* ══ MODAL NUOVO ESAME ════════════════════════════════════════════════ */}
      {showFE && puoGestire && (<div className="modal-overlay tw-fixed tw-inset-0 tw-bg-black/50 tw-backdrop-blur-sm tw-flex tw-items-start tw-justify-center tw-z-[1000] tw-py-10 tw-px-4 tw-overflow-y-auto" onClick={() => setShowFE(false)}>
          <div className="modal-content tw-max-w-[500px] tw-w-full tw-bg-white tw-rounded-2xl tw-p-6 tw-shadow-2xl tw-max-h-[calc(100vh_-_80px)] tw-overflow-y-auto tw-box-border" onClick={e => e.stopPropagation()}>
            <div className="tw-flex tw-justify-between tw-items-center tw-mb-5">
              <h3 className="tw-m-0 tw-text-violet-600 tw-flex tw-items-center tw-gap-2 tw-font-bold tw-text-lg"><HeartPulse size={20}/>Nuovo Esame Strumentale</h3>
              <button className="tw-bg-transparent tw-border-0 tw-cursor-pointer tw-text-slate-500 hover:tw-text-slate-700 tw-transition-colors" onClick={() => setShowFE(false)}><X size={22}/></button>
            </div>
            <div className="tw-grid tw-gap-3.5">
              <label className="tw-font-semibold tw-text-sm">Paziente *<select className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-violet-500/20 focus:tw-border-violet-500" value={fE.patient} onChange={e => setFE(f => ({ ...f, patient: e.target.value }))}><option value="">Seleziona...</option>{pazienti.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}</select></label>
              <label className="tw-font-semibold tw-text-sm">Operatore<select className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-violet-500/20 focus:tw-border-violet-500" value={fE.staff} onChange={e => setFE(f => ({ ...f, staff: e.target.value }))}><option value="">Da assegnare...</option>{staff.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} — {s.role}</option>)}</select></label>
              <div className="tw-grid tw-grid-cols-2 tw-gap-3">
                <label className="tw-font-semibold tw-text-sm">Data *<input className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-violet-500/20 focus:tw-border-violet-500" type="date" value={fE.dataEsame} onChange={e => setFE(f => ({ ...f, dataEsame: e.target.value }))}/></label>
                <label className="tw-font-semibold tw-text-sm">Orario<input className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-violet-500/20 focus:tw-border-violet-500" type="time" value={fE.orario} onChange={e => setFE(f => ({ ...f, orario: e.target.value }))}/></label>
              </div>
              <label className="tw-font-semibold tw-text-sm">Tipo esame *<select className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-violet-500/20 focus:tw-border-violet-500" value={fE.tipoEsame} onChange={e => setFE(f => ({ ...f, tipoEsame: e.target.value }))}><option value="">Seleziona...</option>{TIPI_ESAME.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
              <label className="tw-font-semibold tw-text-sm">Note<textarea className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm tw-resize-y focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-violet-500/20 focus:tw-border-violet-500" value={fE.note} onChange={e => setFE(f => ({ ...f, note: e.target.value }))} rows={2}/></label>
            </div>
            <div className="tw-flex tw-gap-2.5 tw-mt-6 tw-justify-end">
              <button className="tw-py-2.5 tw-px-5 tw-rounded-lg tw-border tw-border-slate-200 tw-bg-white tw-cursor-pointer tw-text-slate-700 tw-font-semibold hover:tw-bg-slate-50 tw-transition-colors" onClick={() => setShowFE(false)}>Annulla</button>
              <button className={`tw-py-2.5 tw-px-6 tw-rounded-lg tw-bg-violet-600 tw-text-white tw-border-0 tw-cursor-pointer tw-font-bold tw-flex tw-items-center tw-gap-2 tw-shadow-sm tw-transition-colors ${(!fE.patient || !fE.tipoEsame) ? 'tw-opacity-60' : 'hover:tw-bg-violet-700'}`} onClick={creaEsame} disabled={savingE || !fE.patient || !fE.tipoEsame}>{savingE ? '...' : <><CheckCircle size={16}/>Salva</>}</button>
            </div>
          </div>
        </div>)}

      {/* ══ MODAL NUOVO INCARICO ══════════════════════════════════════════════ */}
      {showFPiano && puoGestire && (<div className="piano-fullscreen tw-fixed tw-inset-0 tw-bg-slate-50 tw-z-[1000] tw-overflow-y-auto">
          <div className="piano-fullscreen-inner tw-max-w-[1200px] tw-w-full tw-mx-auto tw-p-6 md:tw-p-8 tw-min-h-screen tw-box-border">
            <div className="tw-flex tw-justify-between tw-items-center tw-mb-6 tw-bg-white tw-rounded-2xl tw-shadow-sm tw-border tw-border-slate-100 tw-p-5">
              <h3 className="tw-m-0 tw-text-emerald-600 tw-flex tw-items-center tw-gap-2 tw-font-bold tw-text-lg"><ClipboardList size={22}/>Nuovo Incarico</h3>
              <button className="tw-bg-transparent tw-border-0 tw-cursor-pointer tw-text-slate-500 hover:tw-text-slate-700 tw-transition-colors" onClick={() => setShowFPiano(false)}><X size={22}/></button>
            </div>
            <form onSubmit={creaPiano}>
              <div className="tw-grid tw-gap-4">
                {/* Tipo */}
                <div className="tw-flex tw-gap-1 tw-bg-white tw-rounded-2xl tw-shadow-sm tw-border tw-border-slate-100 tw-p-1.5">
                  {(['prestazionale', 'assistenziale'] as const).map(t => (<button className={`tw-flex-1 tw-py-2 tw-px-3 tw-rounded-xl tw-border-0 tw-cursor-pointer tw-font-semibold tw-text-sm tw-transition-all ${fpTipo === t ? 'tw-bg-emerald-600 tw-text-white tw-shadow-sm' : 'tw-bg-transparent tw-text-slate-500 hover:tw-bg-slate-50'}`} key={t} type="button" onClick={() => { setFpTipo(t); setFpCats([]); setFpMacroCats({ infermieristico: false, riabilitativo: false, medico_specialistiche: false }); setFpFabbisogni({ infermieristico: [], riabilitativo: [], medico_specialistiche: [] }); setFpStaffPerCat({ infermieristico: '', riabilitativo: '', medico_specialistiche: '' }); }}>
                      {t === 'prestazionale' ? '🩺 Prestazionale' : '🤝 Assistenziale'}
                    </button>))}
                </div>
                {/* Macro-categorie e fabbisogni — Prestazionale */}
                {fpTipo === 'prestazionale' && (<div className="tw-border-t tw-border-slate-200 tw-pt-3 tw-mt-1">
                    <div className="tw-font-bold tw-text-sm tw-text-blue-900 tw-mb-2">🩺 Categorie assistenziali * (seleziona una o più)</div>
                    <div className="tw-flex tw-gap-2 tw-flex-wrap tw-mb-3">
                      {(Object.keys(MACRO_CATEGORIE_LABELS) as (keyof typeof MACRO_CATEGORIE_LABELS)[]).map(cat => {
                    const info = MACRO_CATEGORIE_LABELS[cat];
                    const selected = fpMacroCats[cat];
                    return (<button className={`tw-flex-[1_1_30%] tw-min-w-[120px] tw-py-2.5 tw-px-3 tw-rounded-lg tw-text-sm tw-cursor-pointer tw-flex tw-items-center tw-justify-center tw-gap-1 tw-transition-all ${selected ? `tw-border-2 ${MACRO_BORDER[cat]} ${MACRO_BG[cat]} ${MACRO_TEXT[cat]} tw-font-bold tw-shadow-sm` : 'tw-border-2 tw-border-slate-200 tw-bg-white tw-text-slate-700 tw-font-medium hover:tw-bg-slate-50'}`} key={cat} type="button" onClick={() => { setFpMacroCats(prev => ({ ...prev, [cat]: !prev[cat] })); if (fpMacroCats[cat])
                        setFpFabbisogni(prev => ({ ...prev, [cat]: [] })); }}>
                            <span className="tw-text-base">{info.label.split(' ')[0]}</span>
                            <span>{info.label.split(' ').slice(1).join(' ')}</span>
                            {selected && <span className="tw-ml-0.5">✓</span>}
                          </button>);
                })}
                    </div>
                    {(Object.keys(MACRO_CATEGORIE_LABELS) as (keyof typeof MACRO_CATEGORIE_LABELS)[]).filter(cat => fpMacroCats[cat]).map(cat => {
                    const info = MACRO_CATEGORIE_LABELS[cat];
                    const options = FABBISOGNI_OPTIONS[cat];
                    const selezionati = fpFabbisogni[cat];
                    return (<div className={`tw-mb-3 tw-p-2.5 tw-rounded-lg tw-border ${MACRO_BORDER[cat]} ${MACRO_BG[cat]}`} key={cat}>
                          <div className={`tw-font-bold tw-text-sm tw-mb-2 ${MACRO_TEXT[cat]}`}>{info.label} — Seleziona fabbisogni:</div>
                          <div className="tw-flex tw-flex-wrap tw-gap-1.5">
                            {options.map(opt => {
                            const sel = selezionati.includes(opt.value);
                            return (<button className={`tw-py-1.5 tw-px-2.5 tw-rounded-md tw-text-xs tw-cursor-pointer tw-transition-colors ${sel ? `tw-border ${MACRO_BORDER[cat]} ${MACRO_SOLID[cat]} tw-text-white tw-font-semibold` : 'tw-border tw-border-slate-300 tw-bg-white tw-text-slate-700 tw-font-normal hover:tw-bg-slate-50'}`} key={opt.value} type="button" onClick={() => setFpFabbisogni(prev => { const cur = prev[cat]; const nuovi = sel ? cur.filter(v => v !== opt.value) : [...cur, opt.value]; return { ...prev, [cat]: nuovi }; })}>
                                  {sel ? '✓ ' : '+ '}{opt.label}
                                </button>);
                        })}
                          </div>
                          {selezionati.length === 0 && <div className="tw-text-xs tw-text-slate-400 tw-mt-1">Seleziona almeno un fabbisogno</div>}
                        </div>);
                })}
                    {((Object.keys(fpMacroCats) as (keyof typeof fpMacroCats)[]).some(c => fpMacroCats[c])) && (<div className="tw-mt-2 tw-p-2 tw-bg-sky-50 tw-rounded-md tw-text-sm">
                        <strong>Riepilogo:</strong>
                        <ul className="tw-mt-1 tw-mx-0 tw-mb-0 tw-pl-4">
                          {fpMacroCats.infermieristico && fpFabbisogni.infermieristico.length > 0 && <li>💉 Infermieristico: {fpFabbisogni.infermieristico.map(f => FABBISOGNI_OPTIONS.infermieristico.find(o => o.value === f)?.label).join(', ')}</li>}
                          {fpMacroCats.riabilitativo && fpFabbisogni.riabilitativo.length > 0 && <li>🏃 Riabilitativo: {fpFabbisogni.riabilitativo.map(f => FABBISOGNI_OPTIONS.riabilitativo.find(o => o.value === f)?.label).join(', ')}</li>}
                          {fpMacroCats.medico_specialistiche && fpFabbisogni.medico_specialistiche.length > 0 && <li>🩺 Medico/specialistiche: {fpFabbisogni.medico_specialistiche.map(f => FABBISOGNI_OPTIONS.medico_specialistiche.find(o => o.value === f)?.label).join(', ')}</li>}
                        </ul>
                      </div>)}
                    {(Object.keys(fpMacroCats) as (keyof typeof fpMacroCats)[]).filter(c => fpMacroCats[c]).length > 0 && (<div className="tw-border-t tw-border-slate-200 tw-pt-3 tw-mt-3">
                        <div className="tw-font-bold tw-text-sm tw-text-blue-900 tw-mb-2">👤 Operatori per categoria</div>
                        {(Object.keys(fpMacroCats) as (keyof typeof fpMacroCats)[]).filter(c => fpMacroCats[c]).map(cat => {
                        const info = MACRO_CATEGORIE_LABELS[cat];
                        return (<div className="tw-mb-2.5" key={cat}>
                              <label className={`tw-font-semibold tw-text-sm ${MACRO_TEXT[cat]}`}>{info.label} — Operatore
                                <select className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-emerald-500/20 focus:tw-border-emerald-500" value={fpStaffPerCat[cat]} onChange={e => setFpStaffPerCat(prev => ({ ...prev, [cat]: e.target.value }))}>
                                  <option value="">{fpStaff ? '— Usa operatore principale —' : '— Seleziona —'}</option>
                                  {staff.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} — {s.role}</option>)}
                                </select>
                              </label>
                            </div>);
                    })}
                      </div>)}
                  </div>)}
                {/* Categorie — solo per Assistenziale */}
                {fpTipo === 'assistenziale' && (<div>
                    <label className="tw-font-semibold tw-text-sm tw-block tw-mb-2">Categorie *</label>
                    <div className="tw-flex tw-gap-1.5 tw-flex-wrap">
                      {ASSIST_CATS.map(cat => {
                    const sel = fpCats.includes(cat.value);
                    return <button className={`tw-py-1.5 tw-px-2.5 tw-rounded-lg tw-cursor-pointer tw-font-semibold tw-text-xs tw-flex tw-items-center tw-gap-1 tw-transition-all ${sel ? `tw-border-2 ${ASSIST_CLASSES[cat.value]} tw-shadow-sm` : 'tw-border-2 tw-border-slate-300 tw-bg-white tw-text-slate-700 hover:tw-bg-slate-50'}`} key={cat.value} type="button" onClick={() => setFpCats(prev => sel ? prev.filter(c => c !== cat.value) : [...prev, cat.value])}><cat.Icon size={12}/>{cat.label}</button>;
                })}
                    </div>
                  </div>)}
                <label className="tw-font-semibold tw-text-sm">Paziente *<select className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-emerald-500/20 focus:tw-border-emerald-500" value={fpPaz} onChange={e => setFpPaz(e.target.value)}><option value="">Seleziona...</option>{pazienti.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}</select></label>
                <label className="tw-font-semibold tw-text-sm">Operatore (opzionale)<select className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-emerald-500/20 focus:tw-border-emerald-500" value={fpStaff} onChange={e => setFpStaff(e.target.value)}><option value="">Seleziona...</option>{staff.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} — {s.role}</option>)}</select></label>
                {fpTipo === 'prestazionale' && (<label className="tw-font-semibold tw-text-sm">Prestazione dal tariffario
                    <select className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-emerald-500/20 focus:tw-border-emerald-500" value={fpTariffarioSel} onChange={e => {
                    const id = e.target.value;
                    setFpTariffarioSel(id);
                    const voce = tariffario.find(v => v._id === id);
                    if (voce) {
                        setFpTask(voce.nome);
                        setFpCosto(voce.prezzo);
                    }
                }}>
                      <option value="">— Seleziona dal listino (opzionale) —</option>
                      {(['prestazioni_infermieristiche', 'assistenza_trasporto', 'radiologia', 'ecografia'] as const).map(cat => {
                    const voci = tariffario.filter(v => v.categoria === cat);
                    if (voci.length === 0)
                        return null;
                    return (<optgroup key={cat} label={CATEGORIE_TARIFFARIO_LABEL[cat]}>
                            {voci.map(v => <option key={v._id} value={v._id}>{v.nome} — €{v.prezzo.toFixed(2)}{v.unitaMisura ? ` (${v.unitaMisura})` : ''}</option>)}
                          </optgroup>);
                })}
                    </select>
                  </label>)}
                <label className="tw-font-semibold tw-text-sm">Attività *<input className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-emerald-500/20 focus:tw-border-emerald-500" value={fpTask} onChange={e => setFpTask(e.target.value)} placeholder="Es. Assistenza domiciliare..."/></label>
                {fpTipo === 'assistenziale' && fpCompenso === 'orario' ? (
                  <div className="tw-grid tw-grid-cols-2 tw-gap-3">
                    <label className="tw-font-semibold tw-text-sm">Costo paziente (€/ora)
                      <input className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-emerald-500/20 focus:tw-border-emerald-500" type="number" min={0} step={0.5} value={fpCostoOrario} onChange={e => setFpCostoOrario(Number(e.target.value))} placeholder="0.00"/>
                    </label>
                    <label className="tw-font-semibold tw-text-sm">Totale costo paziente (€)
                      <input className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-slate-100 tw-shadow-sm" type="number" min={0} step={0.01} value={fpCosto} readOnly placeholder="0.00"/>
                      <span className="tw-text-xs tw-text-slate-400 tw-font-normal">{fpOre}h × {fpGiorni.filter(g => g.attivo).length} giorni × €{fpCostoOrario.toFixed(2)}/h</span>
                    </label>
                  </div>
                ) : (
                  <label className="tw-font-semibold tw-text-sm">Costo prestazione al paziente (€)
                    <input className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-emerald-500/20 focus:tw-border-emerald-500" type="number" min={0} step={0.5} value={fpCosto} onChange={e => setFpCosto(Number(e.target.value))} placeholder="0.00"/>
                    <span className="tw-text-xs tw-text-slate-400 tw-font-normal">Precompilato dal tariffario, modificabile liberamente</span>
                  </label>
                )}
                <div className={`tw-grid tw-gap-3 ${fpTipo === 'assistenziale' ? 'tw-grid-cols-4' : 'tw-grid-cols-3'}`}>
                  <label className="tw-font-semibold tw-text-sm">Data inizio *<input className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-emerald-500/20 focus:tw-border-emerald-500" type="date" value={fpDate} onChange={e => setFpDate(e.target.value)}/></label>
                  <label className="tw-font-semibold tw-text-sm">Data fine<input className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-emerald-500/20 focus:tw-border-emerald-500" type="date" value={fpFine} onChange={e => setFpFine(e.target.value)}/></label>
                  <label className="tw-font-semibold tw-text-sm">Orario<input className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-emerald-500/20 focus:tw-border-emerald-500" type="time" value={fpTime} onChange={e => setFpTime(e.target.value)}/></label>
                  {fpTipo === 'assistenziale' && <label className="tw-font-semibold tw-text-sm">N. ore *<input className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-emerald-500/20 focus:tw-border-emerald-500" type="number" min={0.5} step={0.5} value={fpOre} onChange={e => setFpOre(Math.max(0.5, Number(e.target.value)))}/></label>}
                </div>
                {/* Giorni settimana */}
                <div>
                  <label className="tw-font-semibold tw-text-sm tw-block tw-mb-2">Giorni ricorrenti</label>
                  <div className="tw-flex tw-gap-1.5 tw-flex-wrap">
                    {fpGiorni.map((g, i) => (<button className={`tw-py-1.5 tw-px-2.5 tw-rounded-lg tw-cursor-pointer tw-font-semibold tw-text-xs tw-transition-all ${g.attivo ? 'tw-border-2 tw-border-emerald-600 tw-bg-emerald-50 tw-text-emerald-600 tw-shadow-sm' : 'tw-border-2 tw-border-slate-300 tw-bg-white tw-text-slate-700 hover:tw-bg-slate-50'}`} key={g.giorno} type="button" onClick={() => setFpGiorni(prev => prev.map((x, j) => j === i ? { ...x, attivo: !x.attivo } : x))}>{g.label}</button>))}
                  </div>
                </div>
                {/* Compenso */}
                <div className="tw-grid tw-grid-cols-2 tw-gap-3">
                  <label className="tw-font-semibold tw-text-sm">Tipo compenso<select className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-emerald-500/20 focus:tw-border-emerald-500" value={fpCompenso} onChange={e => setFpCompenso(e.target.value as any)}><option value="nessuno">Nessuno</option><option value="orario">Orario (€/h)</option><option value="fisso">Fisso (€/accesso)</option></select></label>
                  {fpCompenso !== 'nessuno' && <label className="tw-font-semibold tw-text-sm">{fpCompenso === 'orario' ? 'Tariffa operatore (€/h)' : 'Tariffa (€)'}<input className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-emerald-500/20 focus:tw-border-emerald-500" type="number" value={fpTariffa} onChange={e => setFpTariffa(Number(e.target.value))} min={0} step={0.5}/></label>}
                </div>
                <label className="tw-font-semibold tw-text-sm">Note<textarea className="tw-block tw-w-full tw-mt-1 tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm tw-bg-white tw-shadow-sm tw-resize-y focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-emerald-500/20 focus:tw-border-emerald-500" value={fpNotes} onChange={e => setFpNotes(e.target.value)} rows={2}/></label>
              </div>
              <div className="tw-flex tw-gap-2.5 tw-mt-6 tw-justify-end">
                <button className="tw-py-2.5 tw-px-5 tw-rounded-lg tw-border tw-border-slate-200 tw-bg-white tw-cursor-pointer tw-text-slate-700 tw-font-semibold hover:tw-bg-slate-50 tw-transition-colors" type="button" onClick={() => setShowFPiano(false)}>Annulla</button>
                <button className="tw-py-2.5 tw-px-6 tw-rounded-lg tw-bg-emerald-600 hover:tw-bg-emerald-700 tw-text-white tw-border-0 tw-cursor-pointer tw-font-bold tw-flex tw-items-center tw-gap-2 tw-shadow-sm tw-transition-colors" type="submit" disabled={savingPiano}>{savingPiano ? '...' : <><CheckCircle size={16}/>Crea Incarico</>}</button>
              </div>
            </form>
          </div>
        </div>)}

      {/* ══ MODAL GENERAZIONE PREVENTIVO/FATTURA ═══════════════════════════════ */}
      {pendingDoc && (<div className="modal-overlay tw-fixed tw-inset-0 tw-bg-black/50 tw-backdrop-blur-sm tw-flex tw-items-start tw-justify-center tw-z-[1100] tw-py-10 tw-px-4 tw-overflow-y-auto" onClick={() => { setPendingDoc(null); setDocCreato(null); }}>
          <div className="modal-content tw-max-w-[440px] tw-w-full tw-bg-white tw-rounded-2xl tw-shadow-2xl tw-p-6 tw-max-h-[calc(100vh_-_80px)] tw-overflow-y-auto tw-box-border" onClick={e => e.stopPropagation()}>
            {!docCreato ? (<>
                <h3 className="tw-mt-0 tw-mx-0 tw-mb-1.5 tw-text-green-800 tw-font-bold tw-text-lg">💶 Prezzo accettato dal paziente</h3>
                <p className="tw-mt-0 tw-mx-0 tw-mb-4 tw-text-slate-500 tw-text-sm">
                  Genera un documento per <strong>{pendingDoc.patientNome}</strong>: {pendingDoc.task} — <strong>€{pendingDoc.costo.toFixed(2)}</strong>
                </p>
                <div className="tw-flex tw-gap-1 tw-bg-slate-100 tw-rounded-xl tw-p-1 tw-mb-5">
                  {(['preventivo', 'fattura'] as const).map(t => (<button className={`tw-flex-1 tw-py-2 tw-rounded-lg tw-border-0 tw-cursor-pointer tw-font-bold tw-text-sm tw-transition-all ${docTipo === t ? 'tw-bg-green-800 tw-text-white tw-shadow-sm' : 'tw-bg-transparent tw-text-slate-600 hover:tw-bg-white'}`} key={t} type="button" onClick={() => setDocTipo(t)}>
                      {t === 'preventivo' ? '📄 Preventivo' : '🧾 Fattura'}
                    </button>))}
                </div>
                <div className="tw-flex tw-gap-2.5 tw-justify-end">
                  <button className="tw-py-2.5 tw-px-4 tw-rounded-lg tw-border tw-border-slate-200 tw-bg-white tw-cursor-pointer tw-text-slate-700 tw-font-semibold hover:tw-bg-slate-50 tw-transition-colors" onClick={() => setPendingDoc(null)}>Non ora</button>
                  <button className="tw-py-2.5 tw-px-5 tw-rounded-lg tw-bg-green-800 hover:tw-bg-green-900 tw-text-white tw-border-0 tw-cursor-pointer tw-font-bold tw-shadow-sm tw-transition-colors" onClick={generaDocumentoFatturazione} disabled={docSaving}>
                    {docSaving ? '...' : `Genera ${docTipo}`}
                  </button>
                </div>
              </>) : (<>
                <h3 className="tw-mt-0 tw-mx-0 tw-mb-1.5 tw-text-green-800 tw-font-bold tw-text-lg">✅ Documento generato</h3>
                <p className="tw-mt-0 tw-mx-0 tw-mb-4 tw-text-slate-500 tw-text-sm">
                  {docCreato.tipo === 'preventivo' ? 'Preventivo' : 'Fattura'} n. <strong>{docCreato.numero}</strong> — Totale €{docCreato.totale.toFixed(2)}<br />
                  Il documento è archiviato in <strong>Fatturazione</strong> ed è pronto per essere scaricato e consegnato al paziente.
                </p>
                <div className="tw-flex tw-gap-2.5 tw-justify-end tw-flex-wrap">
                  <button className="tw-py-2.5 tw-px-4 tw-rounded-lg tw-border tw-border-slate-200 tw-bg-white tw-cursor-pointer tw-text-slate-700 tw-font-semibold hover:tw-bg-slate-50 tw-transition-colors" onClick={() => { setPendingDoc(null); setDocCreato(null); }}>Chiudi</button>
                  <button className="tw-py-2.5 tw-px-5 tw-rounded-lg tw-bg-blue-600 hover:tw-bg-blue-700 tw-text-white tw-border-0 tw-cursor-pointer tw-font-bold tw-shadow-sm tw-transition-colors tw-flex tw-items-center tw-gap-2" onClick={() => scaricaDocumentoPDF(docCreato)}><Download size={16} /> Scarica PDF</button>
                  <button className="tw-py-2.5 tw-px-5 tw-rounded-lg tw-bg-emerald-600 hover:tw-bg-emerald-700 tw-text-white tw-border-0 tw-cursor-pointer tw-font-bold tw-shadow-sm tw-transition-colors tw-flex tw-items-center tw-gap-2" onClick={() => apriInvioEmail(docCreato)}><Mail size={16} /> Invia via email</button>
                </div>
              </>)}
          </div>
        </div>)}

      {/* Modal invio email documento */}
      {emailDoc && (
        <div className="tw-fixed tw-inset-0 tw-bg-black/50 tw-backdrop-blur-sm tw-flex tw-items-start tw-justify-center tw-z-[1200] tw-py-10 tw-px-4" onClick={chiudiInvioEmail}>
          <div className="tw-bg-white tw-rounded-2xl tw-shadow-2xl tw-p-6 tw-w-full tw-max-w-[420px]" onClick={e => e.stopPropagation()}>
            <h3 className="tw-mt-0 tw-mx-0 tw-mb-4 tw-text-green-800 tw-font-bold tw-text-lg">Invia {emailDoc.tipo === 'fattura' ? 'Fattura' : 'Preventivo'} via email</h3>
            <form onSubmit={inviaDocumentoEmail}>
              <div className="tw-mb-4">
                <label className="tw-block tw-text-sm tw-font-semibold tw-mb-1">Email destinatario</label>
                <input type="email" required value={emailDestinatario} onChange={e => setEmailDestinatario(e.target.value)} placeholder="paziente o caregiver" className="tw-w-full tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm" />
              </div>
              <div className="tw-mb-5">
                <label className="tw-block tw-text-sm tw-font-semibold tw-mb-1">Nome destinatario (opzionale)</label>
                <input type="text" value={emailNome} onChange={e => setEmailNome(e.target.value)} className="tw-w-full tw-p-2.5 tw-rounded-lg tw-border tw-border-slate-200 tw-text-sm" />
              </div>
              <div className="tw-flex tw-gap-2.5 tw-justify-end">
                <button type="button" className="tw-py-2.5 tw-px-4 tw-rounded-lg tw-border tw-border-slate-200 tw-bg-white tw-cursor-pointer tw-text-slate-700 tw-font-semibold hover:tw-bg-slate-50" onClick={chiudiInvioEmail}>Annulla</button>
                <button type="submit" disabled={emailSending} className="tw-py-2.5 tw-px-5 tw-rounded-lg tw-bg-emerald-600 hover:tw-bg-emerald-700 tw-text-white tw-border-0 tw-cursor-pointer tw-font-bold">{emailSending ? 'Invio...' : 'Invia'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </section>);
}
