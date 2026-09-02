import { FormEvent, useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Syringe, HeartPulse, ClipboardList, Plus, X, ChevronLeft, ChevronRight, Calendar, Clock, User, CheckCircle, Trash2, ChevronDown, ChevronUp, UserCheck, Eye, TestTube2, Bandage, Activity, CalendarDays, Users, Copy, Search, } from 'lucide-react';
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
    return (<div className="tw-bg-white tw-rounded-[12px] tw-border tw-border-[#e2e8f0] tw-p-[16px] tw-mb-[16px]">
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-[12px]">
        <button className="tw-bg-transparent tw-border-0 tw-cursor-pointer tw-py-[4px] tw-px-[8px] tw-text-[#475569]" onClick={onPrev}><ChevronLeft size={18}/></button>
        <span className="tw-font-bold tw-text-[#1e293b]">{MESI[mese]} {anno}</span>
        <button className="tw-bg-transparent tw-border-0 tw-cursor-pointer tw-py-[4px] tw-px-[8px] tw-text-[#475569]" onClick={onNext}><ChevronRight size={18}/></button>
      </div>
      <div className="tw-grid tw-grid-cols-7 tw-gap-[2px] tw-text-center">
        {GIORNI_SETT.map(g => <div className="tw-text-[0.7rem] tw-font-bold tw-text-[#94a3b8] tw-py-[4px] tw-px-[0]" key={g}>{g}</div>)}
        {cells.map((d, i) => {
            if (!d)
                return <div key={i}/>;
            const iso = `${anno}-${String(mese + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const active = iso === sel;
            const cnt = dots.get(iso) || 0;
            return (<button className={`tw-border-0 tw-cursor-pointer tw-rounded-[8px] tw-py-[6px] tw-px-[2px] tw-text-[0.85rem] tw-relative ${active ? 'tw-bg-[#2563eb] tw-text-white tw-font-bold' : 'tw-bg-transparent tw-text-[#1e293b] tw-font-normal'}`} key={i} onClick={() => onDay(iso)}>
              {d}
              {cnt > 0 && <span className={`tw-absolute tw-bottom-[2px] tw-left-1/2 tw-w-[5px] tw-h-[5px] tw-rounded-full tw-block -tw-translate-x-1/2 ${active ? 'tw-bg-white' : 'tw-bg-[#2563eb]'}`}/>}
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
    } | null>(null);
    const [docTipo, setDocTipo] = useState<'preventivo' | 'fattura'>('preventivo');
    const [docSaving, setDocSaving] = useState(false);
    const [docCreato, setDocCreato] = useState<any>(null);
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
    const resetFPiano = () => { setFpTipo('prestazionale'); setFpTask(''); setFpDate(''); setFpFine(''); setFpTime(''); setFpDur(60); setFpOre(1); setFpPaz(''); setFpStaff(''); setFpCats([]); setFpNotes(''); setFpCompenso('nessuno'); setFpTariffa(0); setFpCosto(0); setFpTariffarioSel(''); setFpGiorni(GIORNI_DEFAULT.map(g => ({ ...g }))); setFpMacroCats({ infermieristico: false, riabilitativo: false, medico_specialistiche: false }); setFpFabbisogni({ infermieristico: [], riabilitativo: [], medico_specialistiche: [] }); setFpStaffPerCat({ infermieristico: '', riabilitativo: '', medico_specialistiche: '' }); };
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
                if (!staffId) {
                    setErrPiano(`Seleziona un operatore per ${MACRO_CATEGORIE_LABELS[cat].label}`);
                    return;
                }
                fpFabbisogni[cat].forEach(f => {
                    const opt = FABBISOGNI_OPTIONS[cat].find(o => o.value === f);
                    prestazioni.push({ tipoPrestazione: opt ? opt.label : f, staff: staffId, categoria: catMap[cat] });
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
                    patient: fpPaz, staff: fpStaff || prestazioni[0].staff, task: fpTask,
                    date: fpDate, dataFine: fpFine || undefined, time: fpTime || undefined, duration: fpDur,
                    notes: fpNotes || undefined, giorniSettimana: giorniAttivi.length > 0 ? giorniAttivi : undefined,
                    tipoCompenso: fpCompenso, tariffa: fpCompenso !== 'nessuno' ? fpTariffa : 0, costoPrestazione: fpCosto > 0 ? fpCosto : 0,
                });
                const pazSel = pazienti.find(p => p._id === fpPaz);
                if (fpCosto > 0 && pazSel)
                    setPendingDoc({ patientId: fpPaz, patientNome: `${pazSel.firstName} ${pazSel.lastName}`, task: fpTask, costo: fpCosto, planId: res.data._id });
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
            if (!fpPaz || !fpStaff || !fpDate || !fpTask || fpCats.length === 0) {
                setErrPiano('Compila tutti i campi obbligatori.');
                return;
            }
            setSavingPiano(true);
            try {
                const giorniAttivi = fpGiorni.filter(g => g.attivo).map(g => ({ giorno: g.giorno, accessiAlGiorno: g.accessiAlGiorno, minutiPerAccesso: g.minutiPerAccesso }));
                const res = await api.post('/workplan', { type: fpTipo, categories: fpCats, patient: fpPaz, staff: fpStaff, task: fpTask, date: fpDate, dataFine: fpFine || undefined, time: fpTime || undefined, duration: fpOre * 60, notes: fpNotes || undefined, giorniSettimana: giorniAttivi.length > 0 ? giorniAttivi : undefined, tipoCompenso: fpCompenso, tariffa: fpCompenso !== 'nessuno' ? fpTariffa : 0, costoPrestazione: fpCosto > 0 ? fpCosto : 0 });
                const pazSel = pazienti.find(p => p._id === fpPaz);
                if (fpCosto > 0 && pazSel)
                    setPendingDoc({ patientId: fpPaz, patientNome: `${pazSel.firstName} ${pazSel.lastName}`, task: fpTask, costo: fpCosto, planId: res.data._id });
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
                prestazioni: [{ descrizione: pendingDoc.task, quantita: 1, prezzoUnitario: pendingDoc.costo }],
            });
            setDocCreato(res.data);
        }
        catch (err: any) {
            alert(err.response?.data?.message || 'Errore nella generazione del documento');
        }
        setDocSaving(false);
    };
    const stampaDocumento = (doc: any) => {
        const dataStr = new Date(doc.data).toLocaleDateString('it-IT');
        const righe = doc.prestazioni.map((p: any) => `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${p.descrizione}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center">${p.quantita}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">€${p.prezzoUnitario.toFixed(2)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700">€${p.importo.toFixed(2)}</td></tr>`).join('');
        const titolo = doc.tipo === 'preventivo' ? 'PREVENTIVO' : 'FATTURA';
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titolo} ${doc.numero}</title><style>body{font-family:Arial;margin:32px;color:#1e293b}h1{color:#1e4d8c;font-size:22px;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#1e4d8c;color:white;padding:8px;text-align:left}.header{border-bottom:3px solid #1e4d8c;padding-bottom:14px;margin-bottom:20px;display:flex;justify-content:space-between}.totale{margin-top:20px;text-align:right;font-size:1.3rem;font-weight:800;color:#166534}</style></head><body><div class="header"><div><h1>🏥 Abbraccio Cure Domiciliari</h1><div>${titolo} n. ${doc.numero}</div><div style="color:#666">Data: ${dataStr}</div></div><div style="text-align:right"><strong>Paziente:</strong><br/>${doc.patient?.firstName || ''} ${doc.patient?.lastName || ''}<br/>${doc.patient?.codiceFiscale ? 'CF: ' + doc.patient.codiceFiscale : ''}<br/>${doc.patient?.address || ''}</div></div><table><thead><tr><th>Prestazione</th><th style="text-align:center">Qtà</th><th style="text-align:right">Prezzo unit.</th><th style="text-align:right">Importo</th></tr></thead><tbody>${righe}</tbody></table><div class="totale">TOTALE: €${doc.totale.toFixed(2)}</div>${doc.note ? `<div style="margin-top:16px;color:#666">${doc.note}</div>` : ''}</body></html>`;
        const win = window.open('', '_blank');
        if (!win) {
            alert('Impossibile aprire la finestra di stampa.');
            return;
        }
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 400);
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
        return <section><p className="tw-text-[#6b7280] tw-p-[40px] tw-text-center">⏳ Caricamento...</p></section>;
    const subTabClass = "tw-py-[7px] tw-px-[16px] tw-rounded-[7px] tw-border-0 tw-cursor-pointer tw-font-semibold tw-text-[0.82rem] tw-flex tw-items-center tw-gap-[6px]";
    return (<section className="fade-in">
      {/* Header */}
      <div className="tw-flex tw-justify-between tw-items-center tw-mb-[20px] tw-flex-wrap tw-gap-[12px]">
        <h1 className={`tw-m-[0] tw-flex tw-items-center tw-gap-[10px] ${mainTab === 'prelievi' ? 'tw-text-[#0369a1]' : mainTab === 'esami' ? 'tw-text-[#7c3aed]' : 'tw-text-[#059669]'}`}>
          <Calendar size={26}/> Centro Prenotazioni — Privato
        </h1>
      </div>

      {/* Tab bar principale */}
      <div className="tw-flex tw-gap-[4px] tw-mb-[24px] tw-bg-[#f1f5f9] tw-rounded-[12px] tw-p-[4px] tw-w-fit">
        {(['prelievi', 'esami', 'piani'] as const).map(t => (<button className={`tw-py-[10px] tw-px-[20px] tw-rounded-[8px] tw-border-0 tw-cursor-pointer tw-font-semibold tw-text-[0.875rem] ${mainTab === t ? (t === 'prelievi' ? 'tw-bg-[#0369a1] tw-text-white' : t === 'esami' ? 'tw-bg-[#7c3aed] tw-text-white' : 'tw-bg-[#059669] tw-text-white') : 'tw-bg-transparent tw-text-[#475569]'}`} key={t} onClick={() => setMainTab(t)}>
            {t === 'prelievi' ? '💉 Prelievi' : t === 'esami' ? '🏥 Esami Strumentali' : '📋 Piani Lavorativi'}
          </button>))}
      </div>

      {/* ══ TAB PRELIEVI ══════════════════════════════════════════════════════ */}
      {mainTab === 'prelievi' && (<div>
          <div className="tw-flex tw-gap-[4px] tw-mb-[16px] tw-bg-[#f8fafc] tw-rounded-[10px] tw-p-[4px] tw-w-fit tw-border tw-border-[#e2e8f0]">
            <button className={`${subTabClass} ${subPrel === 'prenotazioni' ? 'tw-bg-[#0369a1] tw-text-white' : 'tw-bg-transparent tw-text-[#64748b]'}`} onClick={() => setSubPrel('prenotazioni')}><ClipboardList size={14}/>Prenotazioni</button>
            <button className={`${subTabClass} ${subPrel === 'assegnazione' ? 'tw-bg-[#0369a1] tw-text-white' : 'tw-bg-transparent tw-text-[#64748b]'}`} onClick={() => setSubPrel('assegnazione')}><UserCheck size={14}/>Assegnazione</button>
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
                {puoGestire && <button className="tw-w-full tw-bg-[#0369a1] tw-text-white tw-border-0 tw-rounded-[10px] tw-p-[12px] tw-cursor-pointer tw-font-bold tw-flex tw-items-center tw-justify-center tw-gap-[8px]" onClick={() => { setFP(f => ({ ...f, dataPrelievo: prelGiorno })); setShowFP(true); }}><Plus size={16}/> Nuovo Prelievo</button>}
              </div>
              <div>
                <h3 className="tw-text-[#0369a1] tw-mb-[12px] tw-mt-[0]">
                  {new Date(prelGiorno + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  <span className="tw-ml-[8px] tw-bg-[#dbeafe] tw-text-[#1d4ed8] tw-rounded-[20px] tw-py-[2px] tw-px-[10px] tw-text-[0.8rem]">{prelSel.length}</span>
                </h3>
                {prelSel.length === 0
                    ? <div className="tw-bg-white tw-rounded-[12px] tw-border tw-border-[#e2e8f0] tw-p-[32px] tw-text-center tw-text-[#94a3b8]">Nessun prelievo</div>
                    : <div className="tw-flex tw-flex-col tw-gap-[10px]">
                    {prelSel.map(p => (<div className={`tw-bg-white tw-rounded-[10px] tw-overflow-hidden tw-border tw-border-[#bfdbfe] ${p.status === 'eseguito' ? 'tw-border-l-4 tw-border-l-[#059669]' : 'tw-border-l-4 tw-border-l-[#0369a1]'}`} key={p._id}>
                        <button className="tw-w-full tw-bg-transparent tw-border-0 tw-cursor-pointer tw-py-[12px] tw-px-[14px] tw-text-left tw-flex tw-justify-between tw-items-center" type="button" onClick={() => setAperto(aperto === p._id ? null : p._id)}>
                          <div>
                            <div className="tw-font-bold tw-text-[0.9rem]"><User className="tw-inline tw-mr-[4px]" size={13}/>{p.patient?.firstName} {p.patient?.lastName}{p.orario && <span className="tw-ml-[8px] tw-text-[#64748b] tw-font-normal tw-text-[0.82rem]"><Clock className="tw-inline" size={11}/> {p.orario}</span>}</div>
                            <div className="tw-text-[0.8rem] tw-text-[#64748b]">💉 {p.tipoPrelievo} <span className={`tw-ml-[6px] tw-py-[1px] tw-px-[8px] tw-rounded-[10px] tw-text-[0.72rem] tw-font-bold ${p.status === 'eseguito' ? 'tw-bg-[#dcfce7] tw-text-[#059669]' : 'tw-bg-[#dbeafe] tw-text-[#1d4ed8]'}`}>{p.status === 'eseguito' ? '✅ Eseguito' : '🔵 Pianificato'}</span></div>
                          </div>
                          <div className="tw-flex tw-gap-[6px]">
                            {puoGestire && <button className="tw-bg-[#fef2f2] tw-border tw-border-[#fecaca] tw-rounded-[6px] tw-py-[4px] tw-px-[8px] tw-cursor-pointer tw-text-[#dc2626]" onClick={e => { e.stopPropagation(); eliminaPrelievo(p._id); }}><Trash2 size={13}/></button>}
                            {aperto === p._id ? <ChevronUp className="tw-text-[#94a3b8]" size={15}/> : <ChevronDown className="tw-text-[#94a3b8]" size={15}/>}
                          </div>
                        </button>
                        {aperto === p._id && (<div className="tw-border-t tw-border-t-[#f1f5f9] tw-py-[10px] tw-px-[14px] tw-bg-[#f8fafc] tw-text-[0.84rem]">
                            {p.staff?.firstName && <p className="tw-mt-[0] tw-mx-[0] tw-mb-[4px]">👤 {p.staff.firstName} {p.staff.lastName}</p>}
                            {p.note && <p className="tw-m-[0] tw-text-[#475569]">📝 {p.note}</p>}
                          </div>)}
                      </div>))}
                  </div>}
              </div>
            </div>)}

          {subPrel === 'assegnazione' && (<div className="tw-grid tw-grid-cols-[300px_1fr] tw-gap-[20px] tw-items-start">
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
                <h3 className="tw-text-[#0369a1] tw-mb-[12px] tw-mt-[0]">Assegnazione — {new Date(assGiornoP + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</h3>
                {msgP && <div className="tw-bg-[#f0fdf4] tw-border tw-border-[#bbf7d0] tw-rounded-[8px] tw-py-[10px] tw-px-[14px] tw-mb-[12px] tw-text-[#166534] tw-font-semibold">{msgP}</div>}
                <div className="tw-flex tw-gap-[10px] tw-mb-[14px] tw-flex-wrap">
                  <select className="tw-flex-1 tw-min-w-[200px] tw-p-[9px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" value={opP} onChange={e => setOpP(e.target.value)}>
                    <option value="">Seleziona operatore...</option>
                    {staff.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} — {s.role}</option>)}
                  </select>
                  <button className={`tw-py-[9px] tw-px-[18px] tw-bg-[#0369a1] tw-text-white tw-border-0 tw-rounded-[8px] tw-cursor-pointer tw-font-bold ${(selP.size === 0 || !opP) ? 'tw-opacity-50' : 'tw-opacity-100'}`} onClick={assegnaPrelievi} disabled={assP || selP.size === 0 || !opP}>
                    {assP ? '...' : <><UserCheck className="tw-inline tw-mr-[5px]" size={14}/>Assegna ({selP.size})</>}
                  </button>
                </div>
                {prelAss.length === 0
                    ? <div className="tw-bg-white tw-rounded-[12px] tw-border tw-border-[#e2e8f0] tw-p-[24px] tw-text-center tw-text-[#94a3b8]">Nessun prelievo pianificato</div>
                    : <div className="tw-flex tw-flex-col tw-gap-[8px]">
                    {prelAss.map(p => {
                            const s = selP.has(p._id);
                            return (<div className={`tw-rounded-[10px] tw-py-[12px] tw-px-[14px] tw-cursor-pointer tw-flex tw-justify-between tw-items-center ${s ? 'tw-bg-[#eff6ff] tw-border-2 tw-border-[#2563eb]' : 'tw-bg-white tw-border-2 tw-border-[#e2e8f0]'}`} key={p._id} onClick={() => setSelP(prev => { const n = new Set(prev); s ? n.delete(p._id) : n.add(p._id); return n; })}>
                        <div><div className="tw-font-bold tw-text-[0.88rem]">{p.patient?.firstName} {p.patient?.lastName}</div><div className="tw-text-[0.78rem] tw-text-[#64748b]">💉 {p.tipoPrelievo}{p.orario ? ` · ${p.orario}` : ''}</div></div>
                        <div className={`tw-w-[20px] tw-h-[20px] tw-rounded-full tw-flex tw-items-center tw-justify-center ${s ? 'tw-border-2 tw-border-[#2563eb] tw-bg-[#2563eb]' : 'tw-border-2 tw-border-[#d1d5db] tw-bg-transparent'}`}>{s && <CheckCircle size={12} color="white"/>}</div>
                      </div>);
                        })}
                  </div>}
              </div>
            </div>)}
        </div>)}

      {/* ══ TAB ESAMI ══════════════════════════════════════════════════════════ */}
      {mainTab === 'esami' && (<div>
          <div className="tw-flex tw-gap-[4px] tw-mb-[16px] tw-bg-[#f8fafc] tw-rounded-[10px] tw-p-[4px] tw-w-fit tw-border tw-border-[#e2e8f0]">
            <button className={`${subTabClass} ${subE === 'prenotazioni' ? 'tw-bg-[#7c3aed] tw-text-white' : 'tw-bg-transparent tw-text-[#64748b]'}`} onClick={() => setSubE('prenotazioni')}><ClipboardList size={14}/>Prenotazioni</button>
            <button className={`${subTabClass} ${subE === 'assegnazione' ? 'tw-bg-[#7c3aed] tw-text-white' : 'tw-bg-transparent tw-text-[#64748b]'}`} onClick={() => setSubE('assegnazione')}><UserCheck size={14}/>Assegnazione</button>
          </div>

          {subE === 'prenotazioni' && (<div className="tw-grid tw-grid-cols-[minmax(240px,300px)_1fr] tw-gap-[16px] tw-items-start">
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
                {puoGestire && <button className="tw-w-full tw-bg-[#7c3aed] tw-text-white tw-border-0 tw-rounded-[10px] tw-p-[12px] tw-cursor-pointer tw-font-bold tw-flex tw-items-center tw-justify-center tw-gap-[8px]" onClick={() => { setFE(f => ({ ...f, dataEsame: eGiorno })); setShowFE(true); }}><Plus size={16}/> Nuovo Esame</button>}
              </div>
              <div>
                <h3 className="tw-text-[#7c3aed] tw-mb-[12px] tw-mt-[0]">
                  {new Date(eGiorno + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  <span className="tw-ml-[8px] tw-bg-[#ede9fe] tw-text-[#6d28d9] tw-rounded-[20px] tw-py-[2px] tw-px-[10px] tw-text-[0.8rem]">{esamiSel.length}</span>
                </h3>
                {esamiSel.length === 0
                    ? <div className="tw-bg-white tw-rounded-[12px] tw-border tw-border-[#e2e8f0] tw-p-[32px] tw-text-center tw-text-[#94a3b8]">Nessun esame</div>
                    : <div className="tw-flex tw-flex-col tw-gap-[10px]">
                    {esamiSel.map(e => (<div className="tw-bg-white tw-border tw-border-[#e9d5ff] tw-rounded-[10px] tw-overflow-hidden tw-border-l-4 tw-border-l-[#7c3aed]" key={e._id}>
                        <button className="tw-w-full tw-bg-transparent tw-border-0 tw-cursor-pointer tw-py-[12px] tw-px-[14px] tw-text-left tw-flex tw-justify-between tw-items-center" type="button" onClick={() => setApertoE(apertoE === e._id ? null : e._id)}>
                          <div>
                            <div className="tw-font-bold tw-text-[0.9rem]"><User className="tw-inline tw-mr-[4px]" size={13}/>{e.patient?.firstName} {e.patient?.lastName}{e.orario && <span className="tw-ml-[8px] tw-text-[#64748b] tw-font-normal tw-text-[0.82rem]"><Clock className="tw-inline" size={11}/> {e.orario}</span>}</div>
                            <div className="tw-text-[0.8rem] tw-text-[#64748b]">🏥 {e.tipoEsame ? (Array.isArray(e.tipoEsame) ? e.tipoEsame.join(', ') : e.tipoEsame) : 'N/D'} <span className="tw-ml-[6px] tw-py-[1px] tw-px-[8px] tw-rounded-[10px] tw-text-[0.72rem] tw-font-bold tw-bg-[#ede9fe] tw-text-[#6d28d9]">{e.status === 'eseguito' ? '✅ Eseguito' : e.status === 'refertato' ? '📋 Refertato' : '🔵 Pianificato'}</span></div>
                          </div>
                          <div className="tw-flex tw-gap-[6px]">
                            {puoGestire && <button className="tw-bg-[#fef2f2] tw-border tw-border-[#fecaca] tw-rounded-[6px] tw-py-[4px] tw-px-[8px] tw-cursor-pointer tw-text-[#dc2626]" onClick={ev => { ev.stopPropagation(); eliminaEsame(e._id); }}><Trash2 size={13}/></button>}
                            <button className="tw-bg-[#f5f3ff] tw-border tw-border-[#ddd6fe] tw-rounded-[6px] tw-py-[4px] tw-px-[8px] tw-cursor-pointer tw-text-[#7c3aed]" onClick={ev => { ev.stopPropagation(); navigate('/esami-strumentali'); }} title="Gestisci"><Eye size={13}/></button>
                            {apertoE === e._id ? <ChevronUp className="tw-text-[#94a3b8]" size={15}/> : <ChevronDown className="tw-text-[#94a3b8]" size={15}/>}
                          </div>
                        </button>
                        {apertoE === e._id && <div className="tw-border-t tw-border-t-[#f1f5f9] tw-py-[10px] tw-px-[14px] tw-bg-[#faf5ff] tw-text-[0.84rem]">
                          {e.staff?.firstName && <p className="tw-mt-[0] tw-mx-[0] tw-mb-[4px]">👤 {e.staff.firstName} {e.staff.lastName}</p>}
                          {e.note && <p className="tw-m-[0] tw-text-[#475569]">📝 {e.note}</p>}
                        </div>}
                      </div>))}
                  </div>}
              </div>
            </div>)}

          {subE === 'assegnazione' && (<div className="tw-grid tw-grid-cols-[minmax(240px,300px)_1fr] tw-gap-[16px] tw-items-start">
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
                <h3 className="tw-text-[#7c3aed] tw-mb-[12px] tw-mt-[0]">Assegnazione — {new Date(assGiornoE + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</h3>
                {msgE && <div className="tw-bg-[#f0fdf4] tw-border tw-border-[#bbf7d0] tw-rounded-[8px] tw-py-[10px] tw-px-[14px] tw-mb-[12px] tw-text-[#166534] tw-font-semibold">{msgE}</div>}
                <div className="tw-flex tw-gap-[10px] tw-mb-[14px] tw-flex-wrap">
                  <select className="tw-flex-1 tw-min-w-[200px] tw-p-[9px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" value={opE} onChange={e => setOpE(e.target.value)}>
                    <option value="">Seleziona operatore...</option>
                    {staff.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} — {s.role}</option>)}
                  </select>
                  <button className={`tw-py-[9px] tw-px-[18px] tw-bg-[#7c3aed] tw-text-white tw-border-0 tw-rounded-[8px] tw-cursor-pointer tw-font-bold ${(selE.size === 0 || !opE) ? 'tw-opacity-50' : 'tw-opacity-100'}`} onClick={assegnaEsami} disabled={assE || selE.size === 0 || !opE}>
                    {assE ? '...' : <><UserCheck className="tw-inline tw-mr-[5px]" size={14}/>Assegna ({selE.size})</>}
                  </button>
                </div>
                {esamiAss.length === 0
                    ? <div className="tw-bg-white tw-rounded-[12px] tw-border tw-border-[#e2e8f0] tw-p-[24px] tw-text-center tw-text-[#94a3b8]">Nessun esame pianificato</div>
                    : <div className="tw-flex tw-flex-col tw-gap-[8px]">
                    {esamiAss.map(e => {
                            const s = selE.has(e._id);
                            return (<div className={`tw-rounded-[10px] tw-py-[12px] tw-px-[14px] tw-cursor-pointer tw-flex tw-justify-between tw-items-center ${s ? 'tw-bg-[#f5f3ff] tw-border-2 tw-border-[#7c3aed]' : 'tw-bg-white tw-border-2 tw-border-[#e2e8f0]'}`} key={e._id} onClick={() => setSelE(prev => { const n = new Set(prev); s ? n.delete(e._id) : n.add(e._id); return n; })}>
                        <div><div className="tw-font-bold tw-text-[0.88rem]">{e.patient?.firstName} {e.patient?.lastName}</div><div className="tw-text-[0.78rem] tw-text-[#64748b]">🏥 {e.tipoEsame ? (Array.isArray(e.tipoEsame) ? e.tipoEsame.join(', ') : e.tipoEsame) : 'N/D'}{e.orario ? ` · ${e.orario}` : ''}</div></div>
                        <div className={`tw-w-[20px] tw-h-[20px] tw-rounded-full tw-flex tw-items-center tw-justify-center ${s ? 'tw-border-2 tw-border-[#7c3aed] tw-bg-[#7c3aed]' : 'tw-border-2 tw-border-[#d1d5db] tw-bg-transparent'}`}>{s && <CheckCircle size={12} color="white"/>}</div>
                      </div>);
                        })}
                  </div>}
              </div>
            </div>)}
        </div>)}

      {/* ══ TAB PIANI LAVORATIVI ══════════════════════════════════════════════ */}
      {mainTab === 'piani' && (<div>
          {okPiano && <div className="tw-bg-[#f0fdf4] tw-border tw-border-[#bbf7d0] tw-rounded-[8px] tw-py-[10px] tw-px-[16px] tw-mb-[12px] tw-text-[#166534] tw-font-semibold">{okPiano}</div>}
          {errPiano && <div className="tw-bg-[#fef2f2] tw-border tw-border-[#fecaca] tw-rounded-[8px] tw-py-[10px] tw-px-[16px] tw-mb-[12px] tw-text-[#dc2626]">{errPiano}</div>}
          <div className="tw-flex tw-gap-[8px] tw-mb-[14px] tw-flex-wrap tw-items-center tw-justify-between">
            <div className="tw-flex tw-gap-[2px] tw-bg-[#f1f5f9] tw-rounded-[8px] tw-p-[2px]">
              {(['tutti', 'prestazionale', 'assistenziale'] as const).map(val => (<button className={`tw-py-[5px] tw-px-[9px] tw-rounded-[6px] tw-border-0 tw-cursor-pointer tw-font-semibold tw-text-[0.7rem] ${pianoTipo === val ? 'tw-bg-[#059669] tw-text-white' : 'tw-bg-transparent tw-text-[#475569]'}`} key={val} onClick={() => setPianoTipo(val)}>
                  {val === 'tutti' ? 'Tutti' : val === 'prestazionale' ? 'Prestazionali' : 'Assistenziali'}
                </button>))}
            </div>
            <div className="tw-flex tw-gap-[8px] tw-flex-wrap tw-flex-auto tw-justify-end">
              <div className="tw-relative tw-flex-[1_1_120px] tw-max-w-[200px] tw-min-w-[100px]">
                <Search className="tw-absolute tw-left-[8px] tw-top-1/2 -tw-translate-y-1/2 tw-text-[#94a3b8]" size={13}/>
                <input className="tw-pl-[28px] tw-pt-[8px] tw-pr-[8px] tw-pb-[8px] tw-pl-[28px] tw-rounded-[8px] tw-border tw-border-[#d1d5db] tw-text-[0.8rem] tw-w-full tw-box-border" value={searchP} onChange={e => setSearchP(e.target.value)} placeholder="Cerca..."/>
              </div>
              {puoGestire && <button className="tw-bg-[#059669] tw-text-white tw-py-[8px] tw-px-[12px] tw-rounded-[8px] tw-border-0 tw-cursor-pointer tw-font-bold tw-text-[0.78rem] tw-flex tw-items-center tw-gap-[5px] tw-whitespace-nowrap" onClick={() => setShowFPiano(true)}><Plus size={14}/> Nuovo</button>}
            </div>
          </div>
          {pianiFiltrati.length === 0
                ? <div className="tw-bg-white tw-rounded-[12px] tw-border tw-border-[#e2e8f0] tw-p-[40px] tw-text-center tw-text-[#94a3b8]">Nessun incarico {pianoTipo}</div>
                : <div className="tw-flex tw-flex-col tw-gap-[10px]">
              {pianiFiltrati.map(w => {
                        const allCats = [...PREST_CATS, ...ASSIST_CATS];
                        const labels = (w.categories || []).map(c => allCats.find(x => x.value === c)?.label || c);
                        return (<div className={`tw-bg-white tw-border tw-border-[#e2e8f0] tw-rounded-[10px] tw-py-[12px] tw-px-[14px] tw-flex tw-justify-between tw-items-start tw-gap-[8px] tw-flex-wrap ${w.status === 'completed' ? 'tw-border-l-4 tw-border-l-[#059669]' : 'tw-border-l-4 tw-border-l-[#10b981]'}`} key={w._id}>
                    <div className="tw-flex-1 tw-min-w-[0]">
                      <div className="tw-font-bold tw-text-[0.88rem] tw-text-[#0f172a] tw-mb-[3px] tw-break-words">
                        {w.patient?.firstName ?? '(paziente eliminato)'} {w.patient?.lastName ?? ''}
                        <span className={`tw-ml-[5px] tw-py-[1px] tw-px-[6px] tw-rounded-[10px] tw-text-[0.62rem] tw-font-bold ${w.type === 'prestazionale' ? 'tw-bg-[#dbeafe] tw-text-[#1d4ed8]' : 'tw-bg-[#fce7f3] tw-text-[#be185d]'}`}>{w.type === 'prestazionale' ? 'PREST' : 'ASS'}</span>
                        <span className={`tw-ml-[4px] tw-py-[1px] tw-px-[6px] tw-rounded-[10px] tw-text-[0.62rem] tw-font-bold tw-text-[#059669] ${w.status === 'completed' ? 'tw-bg-[#dcfce7]' : 'tw-bg-[#d1fae5]'}`}>{w.status === 'completed' ? '✅' : '🟢'}</span>
                      </div>
                      <div className="tw-text-[0.78rem] tw-text-[#475569]">👤 {w.staff?.firstName} {w.staff?.lastName} — {w.staff?.role}</div>
                      <div className="tw-text-[0.76rem] tw-text-[#64748b] tw-break-words">📋 {w.task}{labels.length > 0 && <span className="tw-text-[#94a3b8]"> · {labels.join(', ')}</span>}</div>
                      <div className="tw-text-[0.72rem] tw-text-[#94a3b8] tw-mt-[3px]"><Calendar className="tw-inline tw-mr-[3px]" size={10}/>{new Date(w.date).toLocaleDateString('it-IT')}{w.dataFine && ` → ${new Date(w.dataFine).toLocaleDateString('it-IT')}`}</div>
                    </div>
                    <div className="tw-flex tw-gap-[4px] tw-flex-shrink-0 tw-flex-wrap">
                      <button className="tw-bg-[#f0fdf4] tw-border tw-border-[#bbf7d0] tw-rounded-[6px] tw-py-[5px] tw-px-[8px] tw-cursor-pointer tw-text-[#059669] tw-text-[0.72rem] tw-flex tw-items-center tw-gap-[3px]" onClick={() => navigate('/workplan')}><Eye size={12}/> Dettaglio</button>
                      <button className="tw-bg-[#f0f9ff] tw-border tw-border-[#bae6fd] tw-rounded-[6px] tw-py-[5px] tw-px-[8px] tw-cursor-pointer tw-text-[#0369a1] tw-text-[0.72rem] tw-flex tw-items-center tw-gap-[3px]" onClick={() => copiaLink(w._id)}>{copiedId === w._id ? <CheckCircle size={12}/> : <Copy size={12}/>}</button>
                      {puoGestire && <button className="tw-bg-[#fef2f2] tw-border tw-border-[#fecaca] tw-rounded-[6px] tw-py-[5px] tw-px-[8px] tw-cursor-pointer tw-text-[#dc2626]" onClick={() => eliminaPiano(w._id)}><Trash2 size={12}/></button>}
                    </div>
                  </div>);
                    })}
            </div>}
        </div>)}

      {/* ══ MODAL NUOVO PRELIEVO ══════════════════════════════════════════════ */}
      {showFP && puoGestire && (<div className="modal-overlay tw-fixed tw-top-0 tw-left-0 tw-right-0 tw-bottom-0 tw-bg-[rgba(0,0,0,0.5)] tw-flex tw-items-start tw-justify-center tw-z-[1000] tw-py-[40px] tw-px-[16px] tw-overflow-y-auto" onClick={() => setShowFP(false)}>
          <div className="modal-content tw-max-w-[500px] tw-w-full tw-bg-white tw-rounded-[12px] tw-p-[20px] tw-max-h-[calc(100vh_-_80px)] tw-overflow-y-auto tw-box-border" onClick={e => e.stopPropagation()}>
            <div className="tw-flex tw-justify-between tw-items-center tw-mb-[20px]">
              <h3 className="tw-m-[0] tw-text-[#0369a1] tw-flex tw-items-center tw-gap-[8px]"><Syringe size={20}/>Nuovo Prelievo</h3>
              <button className="tw-bg-transparent tw-border-0 tw-cursor-pointer" onClick={() => setShowFP(false)}><X size={20}/></button>
            </div>
            <div className="tw-grid tw-gap-[14px]">
              <label className="tw-font-semibold tw-text-[0.875rem]">Paziente *<select className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" value={fP.patient} onChange={e => setFP(f => ({ ...f, patient: e.target.value }))}><option value="">Seleziona...</option>{pazienti.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}</select></label>
              <label className="tw-font-semibold tw-text-[0.875rem]">Operatore<select className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" value={fP.staff} onChange={e => setFP(f => ({ ...f, staff: e.target.value }))}><option value="">Da assegnare...</option>{staff.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} — {s.role}</option>)}</select></label>
              <div className="tw-grid tw-grid-cols-2 tw-gap-[12px]">
                <label className="tw-font-semibold tw-text-[0.875rem]">Data *<input className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" type="date" value={fP.dataPrelievo} onChange={e => setFP(f => ({ ...f, dataPrelievo: e.target.value }))}/></label>
                <label className="tw-font-semibold tw-text-[0.875rem]">Orario<input className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" type="time" value={fP.orario} onChange={e => setFP(f => ({ ...f, orario: e.target.value }))}/></label>
              </div>
              <label className="tw-font-semibold tw-text-[0.875rem]">Tipo prelievo *<select className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" value={fP.tipoPrelievo} onChange={e => setFP(f => ({ ...f, tipoPrelievo: e.target.value }))}><option value="">Seleziona...</option>{TIPI_PRELIEVO.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
              <label className="tw-font-semibold tw-text-[0.875rem]">Note<textarea className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db] tw-resize-y" value={fP.note} onChange={e => setFP(f => ({ ...f, note: e.target.value }))} rows={2}/></label>
            </div>
            <div className="tw-flex tw-gap-[10px] tw-mt-[20px] tw-justify-end">
              <button className="tw-py-[10px] tw-px-[18px] tw-rounded-[8px] tw-border tw-border-[#d1d5db] tw-bg-white tw-cursor-pointer" onClick={() => setShowFP(false)}>Annulla</button>
              <button className={`tw-py-[10px] tw-px-[20px] tw-rounded-[8px] tw-bg-[#0369a1] tw-text-white tw-border-0 tw-cursor-pointer tw-font-bold tw-flex tw-items-center tw-gap-[8px] ${(!fP.patient || !fP.tipoPrelievo) ? 'tw-opacity-60' : 'tw-opacity-100'}`} onClick={creaPrelievo} disabled={savingP || !fP.patient || !fP.tipoPrelievo}>{savingP ? '...' : <><CheckCircle size={16}/>Salva</>}</button>
            </div>
          </div>
        </div>)}

      {/* ══ MODAL NUOVO ESAME ════════════════════════════════════════════════ */}
      {showFE && puoGestire && (<div className="modal-overlay tw-fixed tw-top-0 tw-left-0 tw-right-0 tw-bottom-0 tw-bg-[rgba(0,0,0,0.5)] tw-flex tw-items-start tw-justify-center tw-z-[1000] tw-py-[40px] tw-px-[16px] tw-overflow-y-auto" onClick={() => setShowFE(false)}>
          <div className="modal-content tw-max-w-[500px] tw-w-full tw-bg-white tw-rounded-[12px] tw-p-[20px] tw-max-h-[calc(100vh_-_80px)] tw-overflow-y-auto tw-box-border" onClick={e => e.stopPropagation()}>
            <div className="tw-flex tw-justify-between tw-items-center tw-mb-[20px]">
              <h3 className="tw-m-[0] tw-text-[#7c3aed] tw-flex tw-items-center tw-gap-[8px]"><HeartPulse size={20}/>Nuovo Esame Strumentale</h3>
              <button className="tw-bg-transparent tw-border-0 tw-cursor-pointer" onClick={() => setShowFE(false)}><X size={20}/></button>
            </div>
            <div className="tw-grid tw-gap-[14px]">
              <label className="tw-font-semibold tw-text-[0.875rem]">Paziente *<select className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" value={fE.patient} onChange={e => setFE(f => ({ ...f, patient: e.target.value }))}><option value="">Seleziona...</option>{pazienti.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}</select></label>
              <label className="tw-font-semibold tw-text-[0.875rem]">Operatore<select className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" value={fE.staff} onChange={e => setFE(f => ({ ...f, staff: e.target.value }))}><option value="">Da assegnare...</option>{staff.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} — {s.role}</option>)}</select></label>
              <div className="tw-grid tw-grid-cols-2 tw-gap-[12px]">
                <label className="tw-font-semibold tw-text-[0.875rem]">Data *<input className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" type="date" value={fE.dataEsame} onChange={e => setFE(f => ({ ...f, dataEsame: e.target.value }))}/></label>
                <label className="tw-font-semibold tw-text-[0.875rem]">Orario<input className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" type="time" value={fE.orario} onChange={e => setFE(f => ({ ...f, orario: e.target.value }))}/></label>
              </div>
              <label className="tw-font-semibold tw-text-[0.875rem]">Tipo esame *<select className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" value={fE.tipoEsame} onChange={e => setFE(f => ({ ...f, tipoEsame: e.target.value }))}><option value="">Seleziona...</option>{TIPI_ESAME.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
              <label className="tw-font-semibold tw-text-[0.875rem]">Note<textarea className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db] tw-resize-y" value={fE.note} onChange={e => setFE(f => ({ ...f, note: e.target.value }))} rows={2}/></label>
            </div>
            <div className="tw-flex tw-gap-[10px] tw-mt-[20px] tw-justify-end">
              <button className="tw-py-[10px] tw-px-[18px] tw-rounded-[8px] tw-border tw-border-[#d1d5db] tw-bg-white tw-cursor-pointer" onClick={() => setShowFE(false)}>Annulla</button>
              <button className={`tw-py-[10px] tw-px-[20px] tw-rounded-[8px] tw-bg-[#7c3aed] tw-text-white tw-border-0 tw-cursor-pointer tw-font-bold tw-flex tw-items-center tw-gap-[8px] ${(!fE.patient || !fE.tipoEsame) ? 'tw-opacity-60' : 'tw-opacity-100'}`} onClick={creaEsame} disabled={savingE || !fE.patient || !fE.tipoEsame}>{savingE ? '...' : <><CheckCircle size={16}/>Salva</>}</button>
            </div>
          </div>
        </div>)}

      {/* ══ MODAL NUOVO INCARICO ══════════════════════════════════════════════ */}
      {showFPiano && puoGestire && (<div className="piano-fullscreen tw-fixed tw-top-0 tw-left-0 tw-right-0 tw-bottom-0 tw-bg-white tw-z-[1000] tw-overflow-y-auto">
          <div className="piano-fullscreen-inner tw-max-w-[1200px] tw-w-full tw-my-[0] tw-mx-[auto] tw-p-[24px] tw-min-h-screen tw-box-border">
            <div className="tw-flex tw-justify-between tw-items-center tw-mb-[20px]">
              <h3 className="tw-m-[0] tw-text-[#059669] tw-flex tw-items-center tw-gap-[8px]"><ClipboardList size={20}/>Nuovo Incarico</h3>
              <button className="tw-bg-transparent tw-border-0 tw-cursor-pointer" onClick={() => setShowFPiano(false)}><X size={20}/></button>
            </div>
            <form onSubmit={creaPiano}>
              <div className="tw-grid tw-gap-[14px]">
                {/* Tipo */}
                <div className="tw-flex tw-gap-[4px] tw-bg-[#f1f5f9] tw-rounded-[8px] tw-p-[4px]">
                  {(['prestazionale', 'assistenziale'] as const).map(t => (<button className={`tw-flex-1 tw-p-[6px] tw-rounded-[6px] tw-border-0 tw-cursor-pointer tw-font-semibold tw-text-[0.72rem] ${fpTipo === t ? 'tw-bg-[#059669] tw-text-white' : 'tw-bg-transparent tw-text-[#475569]'}`} key={t} type="button" onClick={() => { setFpTipo(t); setFpCats([]); setFpMacroCats({ infermieristico: false, riabilitativo: false, medico_specialistiche: false }); setFpFabbisogni({ infermieristico: [], riabilitativo: [], medico_specialistiche: [] }); setFpStaffPerCat({ infermieristico: '', riabilitativo: '', medico_specialistiche: '' }); }}>
                      {t === 'prestazionale' ? '🩺 Prestaz.' : '🤝 Assist.'}
                    </button>))}
                </div>
                {/* Macro-categorie e fabbisogni — Prestazionale */}
                {fpTipo === 'prestazionale' && (<div className="tw-border-t tw-border-t-[#e5e7eb] tw-pt-[12px] tw-mt-[4px]">
                    <div className="tw-font-bold tw-text-[0.85rem] tw-text-[#1e4d8c] tw-mb-[8px]">🩺 Categorie assistenziali * (seleziona una o più)</div>
                    <div className="tw-flex tw-gap-[8px] tw-flex-wrap tw-mb-[12px]">
                      {(Object.keys(MACRO_CATEGORIE_LABELS) as (keyof typeof MACRO_CATEGORIE_LABELS)[]).map(cat => {
                    const info = MACRO_CATEGORIE_LABELS[cat];
                    const selected = fpMacroCats[cat];
                    return (<button className={`tw-flex-[1_1_30%] tw-min-w-[120px] tw-py-[10px] tw-px-[12px] tw-rounded-[8px] tw-text-[0.82rem] tw-cursor-pointer tw-flex tw-items-center tw-justify-center tw-gap-[4px] ${selected ? `tw-border-2 ${MACRO_BORDER[cat]} ${MACRO_BG[cat]} ${MACRO_TEXT[cat]} tw-font-bold` : 'tw-border-2 tw-border-[#e5e7eb] tw-bg-white tw-text-[#374151] tw-font-medium'}`} key={cat} type="button" onClick={() => { setFpMacroCats(prev => ({ ...prev, [cat]: !prev[cat] })); if (fpMacroCats[cat])
                        setFpFabbisogni(prev => ({ ...prev, [cat]: [] })); }}>
                            <span className="tw-text-[1rem]">{info.label.split(' ')[0]}</span>
                            <span>{info.label.split(' ').slice(1).join(' ')}</span>
                            {selected && <span className="tw-ml-[2px]">✓</span>}
                          </button>);
                })}
                    </div>
                    {(Object.keys(MACRO_CATEGORIE_LABELS) as (keyof typeof MACRO_CATEGORIE_LABELS)[]).filter(cat => fpMacroCats[cat]).map(cat => {
                    const info = MACRO_CATEGORIE_LABELS[cat];
                    const options = FABBISOGNI_OPTIONS[cat];
                    const selezionati = fpFabbisogni[cat];
                    return (<div className={`tw-mb-[12px] tw-p-[10px] tw-rounded-[8px] tw-border ${MACRO_BORDER[cat]} ${MACRO_BG[cat]}`} key={cat}>
                          <div className={`tw-font-bold tw-text-[0.8rem] tw-mb-[8px] ${MACRO_TEXT[cat]}`}>{info.label} — Seleziona fabbisogni:</div>
                          <div className="tw-flex tw-flex-wrap tw-gap-[5px]">
                            {options.map(opt => {
                            const sel = selezionati.includes(opt.value);
                            return (<button className={`tw-py-[5px] tw-px-[10px] tw-rounded-[5px] tw-text-[0.78rem] tw-cursor-pointer ${sel ? `tw-border ${MACRO_BORDER[cat]} ${MACRO_SOLID[cat]} tw-text-white tw-font-semibold` : 'tw-border tw-border-[#d1d5db] tw-bg-white tw-text-[#374151] tw-font-normal'}`} key={opt.value} type="button" onClick={() => setFpFabbisogni(prev => { const cur = prev[cat]; const nuovi = sel ? cur.filter(v => v !== opt.value) : [...cur, opt.value]; return { ...prev, [cat]: nuovi }; })}>
                                  {sel ? '✓ ' : '+ '}{opt.label}
                                </button>);
                        })}
                          </div>
                          {selezionati.length === 0 && <div className="tw-text-[0.75rem] tw-text-[#9ca3af] tw-mt-[4px]">Seleziona almeno un fabbisogno</div>}
                        </div>);
                })}
                    {((Object.keys(fpMacroCats) as (keyof typeof fpMacroCats)[]).some(c => fpMacroCats[c])) && (<div className="tw-mt-[8px] tw-p-[8px] tw-bg-[#f0f9ff] tw-rounded-[6px] tw-text-[0.8rem]">
                        <strong>Riepilogo:</strong>
                        <ul className="tw-mt-[4px] tw-mx-[0] tw-mb-[0] tw-pl-[16px]">
                          {fpMacroCats.infermieristico && fpFabbisogni.infermieristico.length > 0 && <li>💉 Infermieristico: {fpFabbisogni.infermieristico.map(f => FABBISOGNI_OPTIONS.infermieristico.find(o => o.value === f)?.label).join(', ')}</li>}
                          {fpMacroCats.riabilitativo && fpFabbisogni.riabilitativo.length > 0 && <li>🏃 Riabilitativo: {fpFabbisogni.riabilitativo.map(f => FABBISOGNI_OPTIONS.riabilitativo.find(o => o.value === f)?.label).join(', ')}</li>}
                          {fpMacroCats.medico_specialistiche && fpFabbisogni.medico_specialistiche.length > 0 && <li>🩺 Medico/specialistiche: {fpFabbisogni.medico_specialistiche.map(f => FABBISOGNI_OPTIONS.medico_specialistiche.find(o => o.value === f)?.label).join(', ')}</li>}
                        </ul>
                      </div>)}
                    {(Object.keys(fpMacroCats) as (keyof typeof fpMacroCats)[]).filter(c => fpMacroCats[c]).length > 0 && (<div className="tw-border-t tw-border-t-[#e5e7eb] tw-pt-[12px] tw-mt-[12px]">
                        <div className="tw-font-bold tw-text-[0.85rem] tw-text-[#1e4d8c] tw-mb-[8px]">👤 Operatori per categoria</div>
                        {(Object.keys(fpMacroCats) as (keyof typeof fpMacroCats)[]).filter(c => fpMacroCats[c]).map(cat => {
                        const info = MACRO_CATEGORIE_LABELS[cat];
                        return (<div className="tw-mb-[10px]" key={cat}>
                              <label className={`tw-font-semibold tw-text-[0.8rem] ${MACRO_TEXT[cat]}`}>{info.label} — Operatore
                                <select className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" value={fpStaffPerCat[cat]} onChange={e => setFpStaffPerCat(prev => ({ ...prev, [cat]: e.target.value }))}>
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
                    <label className="tw-font-semibold tw-text-[0.875rem] tw-block tw-mb-[8px]">Categorie *</label>
                    <div className="tw-flex tw-gap-[6px] tw-flex-wrap">
                      {ASSIST_CATS.map(cat => {
                    const sel = fpCats.includes(cat.value);
                    return <button className={`tw-py-[6px] tw-px-[10px] tw-rounded-[6px] tw-cursor-pointer tw-font-semibold tw-text-[0.74rem] tw-flex tw-items-center tw-gap-[4px] ${sel ? `tw-border-2 ${ASSIST_CLASSES[cat.value]}` : 'tw-border-2 tw-border-[#d1d5db] tw-bg-white tw-text-[#374151]'}`} key={cat.value} type="button" onClick={() => setFpCats(prev => sel ? prev.filter(c => c !== cat.value) : [...prev, cat.value])}><cat.Icon size={12}/>{cat.label}</button>;
                })}
                    </div>
                  </div>)}
                <label className="tw-font-semibold tw-text-[0.875rem]">Paziente *<select className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" value={fpPaz} onChange={e => setFpPaz(e.target.value)}><option value="">Seleziona...</option>{pazienti.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}</select></label>
                <label className="tw-font-semibold tw-text-[0.875rem]">Operatore {fpTipo === 'assistenziale' ? '*' : ''}<select className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" value={fpStaff} onChange={e => setFpStaff(e.target.value)}><option value="">Seleziona...</option>{staff.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} — {s.role}</option>)}</select></label>
                {fpTipo === 'prestazionale' && (<label className="tw-font-semibold tw-text-[0.875rem]">Prestazione dal tariffario
                    <select className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" value={fpTariffarioSel} onChange={e => {
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
                <label className="tw-font-semibold tw-text-[0.875rem]">Attività *<input className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" value={fpTask} onChange={e => setFpTask(e.target.value)} placeholder="Es. Assistenza domiciliare..."/></label>
                <label className="tw-font-semibold tw-text-[0.875rem]">Costo prestazione al paziente (€)
                  <input className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" type="number" min={0} step={0.5} value={fpCosto} onChange={e => setFpCosto(Number(e.target.value))} placeholder="0.00"/>
                  <span className="tw-text-[0.75rem] tw-text-[#94a3b8] tw-font-normal">Precompilato dal tariffario, modificabile liberamente</span>
                </label>
                <div className={`tw-grid tw-gap-[12px] ${fpTipo === 'assistenziale' ? 'tw-grid-cols-4' : 'tw-grid-cols-3'}`}>
                  <label className="tw-font-semibold tw-text-[0.875rem]">Data inizio *<input className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" type="date" value={fpDate} onChange={e => setFpDate(e.target.value)}/></label>
                  <label className="tw-font-semibold tw-text-[0.875rem]">Data fine<input className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" type="date" value={fpFine} onChange={e => setFpFine(e.target.value)}/></label>
                  <label className="tw-font-semibold tw-text-[0.875rem]">Orario<input className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" type="time" value={fpTime} onChange={e => setFpTime(e.target.value)}/></label>
                  {fpTipo === 'assistenziale' && <label className="tw-font-semibold tw-text-[0.875rem]">N. ore *<input className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" type="number" min={0.5} step={0.5} value={fpOre} onChange={e => setFpOre(Math.max(0.5, Number(e.target.value)))}/></label>}
                </div>
                {/* Giorni settimana */}
                <div>
                  <label className="tw-font-semibold tw-text-[0.875rem] tw-block tw-mb-[8px]">Giorni ricorrenti</label>
                  <div className="tw-flex tw-gap-[6px] tw-flex-wrap">
                    {fpGiorni.map((g, i) => (<button className={`tw-py-[6px] tw-px-[10px] tw-rounded-[8px] tw-cursor-pointer tw-font-semibold tw-text-[0.8rem] ${g.attivo ? 'tw-border-2 tw-border-[#059669] tw-bg-[#dcfce7] tw-text-[#059669]' : 'tw-border-2 tw-border-[#d1d5db] tw-bg-white tw-text-[#374151]'}`} key={g.giorno} type="button" onClick={() => setFpGiorni(prev => prev.map((x, j) => j === i ? { ...x, attivo: !x.attivo } : x))}>{g.label}</button>))}
                  </div>
                </div>
                {/* Compenso */}
                <div className="tw-grid tw-grid-cols-2 tw-gap-[12px]">
                  <label className="tw-font-semibold tw-text-[0.875rem]">Tipo compenso<select className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" value={fpCompenso} onChange={e => setFpCompenso(e.target.value as any)}><option value="nessuno">Nessuno</option><option value="orario">Orario (€/h)</option><option value="fisso">Fisso (€/accesso)</option></select></label>
                  {fpCompenso !== 'nessuno' && <label className="tw-font-semibold tw-text-[0.875rem]">Tariffa (€)<input className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db]" type="number" value={fpTariffa} onChange={e => setFpTariffa(Number(e.target.value))} min={0} step={0.5}/></label>}
                </div>
                <label className="tw-font-semibold tw-text-[0.875rem]">Note<textarea className="tw-block tw-w-full tw-mt-[4px] tw-p-[10px] tw-rounded-[8px] tw-border tw-border-[#d1d5db] tw-resize-y" value={fpNotes} onChange={e => setFpNotes(e.target.value)} rows={2}/></label>
              </div>
              <div className="tw-flex tw-gap-[10px] tw-mt-[20px] tw-justify-end">
                <button className="tw-py-[10px] tw-px-[18px] tw-rounded-[8px] tw-border tw-border-[#d1d5db] tw-bg-white tw-cursor-pointer" type="button" onClick={() => setShowFPiano(false)}>Annulla</button>
                <button className="tw-py-[10px] tw-px-[20px] tw-rounded-[8px] tw-bg-[#059669] tw-text-white tw-border-0 tw-cursor-pointer tw-font-bold tw-flex tw-items-center tw-gap-[8px]" type="submit" disabled={savingPiano}>{savingPiano ? '...' : <><CheckCircle size={16}/>Crea Incarico</>}</button>
              </div>
            </form>
          </div>
        </div>)}

      {/* ══ MODAL GENERAZIONE PREVENTIVO/FATTURA ═══════════════════════════════ */}
      {pendingDoc && (<div className="modal-overlay tw-fixed tw-top-0 tw-left-0 tw-right-0 tw-bottom-0 tw-bg-[rgba(0,0,0,0.5)] tw-flex tw-items-start tw-justify-center tw-z-[1100] tw-py-[40px] tw-px-[16px] tw-overflow-y-auto" onClick={() => { setPendingDoc(null); setDocCreato(null); }}>
          <div className="modal-content tw-max-w-[440px] tw-w-full tw-bg-white tw-rounded-[12px] tw-p-[24px] tw-max-h-[calc(100vh_-_80px)] tw-overflow-y-auto tw-box-border" onClick={e => e.stopPropagation()}>
            {!docCreato ? (<>
                <h3 className="tw-mt-[0] tw-mx-[0] tw-mb-[6px] tw-text-[#166534]">💶 Prezzo accettato dal paziente</h3>
                <p className="tw-mt-[0] tw-mx-[0] tw-mb-[16px] tw-text-[#64748b] tw-text-[0.88rem]">
                  Genera un documento per <strong>{pendingDoc.patientNome}</strong>: {pendingDoc.task} — <strong>€{pendingDoc.costo.toFixed(2)}</strong>
                </p>
                <div className="tw-flex tw-gap-[4px] tw-bg-[#f1f5f9] tw-rounded-[8px] tw-p-[4px] tw-mb-[18px]">
                  {(['preventivo', 'fattura'] as const).map(t => (<button className={`tw-flex-1 tw-p-[10px] tw-rounded-[6px] tw-border-0 tw-cursor-pointer tw-font-bold tw-text-[0.85rem] ${docTipo === t ? 'tw-bg-[#166534] tw-text-white' : 'tw-bg-transparent tw-text-[#475569]'}`} key={t} type="button" onClick={() => setDocTipo(t)}>
                      {t === 'preventivo' ? '📄 Preventivo' : '🧾 Fattura'}
                    </button>))}
                </div>
                <div className="tw-flex tw-gap-[10px] tw-justify-end">
                  <button className="tw-py-[10px] tw-px-[16px] tw-rounded-[8px] tw-border tw-border-[#d1d5db] tw-bg-white tw-cursor-pointer" onClick={() => setPendingDoc(null)}>Non ora</button>
                  <button className="tw-py-[10px] tw-px-[18px] tw-rounded-[8px] tw-bg-[#166534] tw-text-white tw-border-0 tw-cursor-pointer tw-font-bold" onClick={generaDocumentoFatturazione} disabled={docSaving}>
                    {docSaving ? '...' : `Genera ${docTipo}`}
                  </button>
                </div>
              </>) : (<>
                <h3 className="tw-mt-[0] tw-mx-[0] tw-mb-[6px] tw-text-[#166534]">✅ Documento generato</h3>
                <p className="tw-mt-[0] tw-mx-[0] tw-mb-[16px] tw-text-[#64748b] tw-text-[0.88rem]">
                  {docCreato.tipo === 'preventivo' ? 'Preventivo' : 'Fattura'} n. <strong>{docCreato.numero}</strong> — Totale €{docCreato.totale.toFixed(2)}<br />
                  Il documento è archiviato in <strong>Fatturazione</strong> ed è pronto per essere scaricato e consegnato al paziente.
                </p>
                <div className="tw-flex tw-gap-[10px] tw-justify-end">
                  <button className="tw-py-[10px] tw-px-[16px] tw-rounded-[8px] tw-border tw-border-[#d1d5db] tw-bg-white tw-cursor-pointer" onClick={() => { setPendingDoc(null); setDocCreato(null); }}>Chiudi</button>
                  <button className="tw-py-[10px] tw-px-[18px] tw-rounded-[8px] tw-bg-[#166534] tw-text-white tw-border-0 tw-cursor-pointer tw-font-bold" onClick={() => stampaDocumento(docCreato)}>🖨️ Scarica / Stampa</button>
                </div>
              </>)}
          </div>
        </div>)}
    </section>);
}
