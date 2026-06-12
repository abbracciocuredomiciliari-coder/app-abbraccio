import { FormEvent, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import {
  Syringe, HeartPulse, ClipboardList, Plus, X, ChevronLeft, ChevronRight,
  Calendar, Clock, User, CheckCircle, Trash2, ChevronDown, ChevronUp,
  UserCheck, Eye, TestTube2, Bandage, Activity, CalendarDays, Users, Copy, Search,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y: number, m: number) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }
function toISO(d: Date) { return d.toISOString().split('T')[0]; }
const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const GIORNI_SETT = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

const TIPI_PRELIEVO = ['Emocromo completo','Glicemia','Coagulazione (PT/INR/aPTT)','Elettroliti','Funzionalità epatica','Funzionalità renale','Profilo lipidico','Ormoni tiroidei (TSH/fT4)','PCR / VES','Esame urine','Emogasanalisi','Altro'];
const TIPI_ESAME = ['ECG','Holter ECG','Holter pressorio','Glicemia','EGA (Emogasanalisi)','Polisonnografia','Titolazione CPAP','Spirometria','Ecocardiogramma','Altro'];
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

const MACRO_CATEGORIE_LABELS: Record<MacroCategoria, { label: string; color: string; bg: string }> = {
  infermieristico: { label: '💉 Infermieristico', color: '#2563eb', bg: '#eff6ff' },
  riabilitativo: { label: '🏃 Riabilitativo', color: '#16a34a', bg: '#f0fdf4' },
  medico_specialistiche: { label: '🩺 Medico e Specialistiche', color: '#7c3aed', bg: '#f5f3ff' },
};

const FABBISOGNI_OPTIONS: Record<MacroCategoria, { value: string; label: string }[]> = {
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
interface Paz { _id: string; firstName: string; lastName: string; tipoGestione?: string; }
interface Staff { _id: string; firstName: string; lastName: string; role: string; category?: string; active: boolean; }
interface Prelievo { _id: string; patient: Paz; staff: any; dataPrelievo: string; orario?: string; tipoPrelievo: string; note?: string; status: string; noteEsecuzione?: string; diaria: any[]; allegati: any[]; }
interface Esame { _id: string; tipoEsame: string | string[]; patient: Paz; staff: any; dataEsame: string; orario?: string; note?: string; status: string; diaria: any[]; allegati: any[]; }
interface Piano { _id: string; type: 'prestazionale' | 'assistenziale'; categories?: string[]; patient: { _id: string; firstName: string; lastName: string }; staff: any; date: string; dataFine?: string; time?: string; duration?: number; task: string; notes?: string; status: string; tipoCompenso?: string; tariffa?: number; compensoTotale?: number; costoPrestazione?: number; giorniSettimana?: any[]; }

// ─── Mini-Calendario ──────────────────────────────────────────────────────────
function Cal({ anno, mese, sel, onDay, onPrev, onNext, dots }: { anno: number; mese: number; sel: string; onDay: (d: string) => void; onPrev: () => void; onNext: () => void; dots: Map<string, number>; }) {
  const dim = getDaysInMonth(anno, mese);
  const first = getFirstDayOfMonth(anno, mese);
  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button onClick={onPrev} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', color: '#475569' }}><ChevronLeft size={18} /></button>
        <span style={{ fontWeight: 700, color: '#1e293b' }}>{MESI[mese]} {anno}</span>
        <button onClick={onNext} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', color: '#475569' }}><ChevronRight size={18} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px', textAlign: 'center' }}>
        {GIORNI_SETT.map(g => <div key={g} style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', padding: '4px 0' }}>{g}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const iso = `${anno}-${String(mese + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const active = iso === sel;
          const cnt = dots.get(iso) || 0;
          return (
            <button key={i} onClick={() => onDay(iso)} style={{ border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '6px 2px', background: active ? '#2563eb' : 'transparent', color: active ? 'white' : '#1e293b', fontWeight: active ? 700 : 400, fontSize: '0.85rem', position: 'relative' }}>
              {d}
              {cnt > 0 && <span style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', width: '5px', height: '5px', borderRadius: '50%', background: active ? 'white' : '#2563eb', display: 'block' }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPALE ────────────────────────────────────────────────────
export default function CentroPrenotazioni() {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  const loadPrelievi = async () => { try { const r = await api.get('/prelievi', { params: { tipoGestione: 'privato' } }); setPrelievi(r.data); } catch {/***/} };
  const creaPrelievo = async () => {
    if (!fP.patient || !fP.tipoPrelievo) return;
    setSavingP(true);
    try { await api.post('/prelievi', { ...fP, staff: fP.staff || undefined }); setShowFP(false); setFP({ patient: '', staff: '', dataPrelievo: prelGiorno, orario: '', tipoPrelievo: '', note: '' }); await loadPrelievi(); } catch {/***/}
    setSavingP(false);
  };
  const eliminaPrelievo = async (id: string) => { if (!confirm('Eliminare?')) return; try { await api.delete(`/prelievi/${id}`); await loadPrelievi(); } catch {/***/} };
  const assegnaPrelievi = async () => {
    if (!opP || selP.size === 0) return; setAssP(true);
    try { await Promise.all([...selP].map(id => api.put(`/prelievi/${id}`, { staff: opP }))); setSelP(new Set()); setOpP(''); setMsgP(`✅ ${selP.size} assegnato/i`); await loadPrelievi(); } catch { setMsgP('❌ Errore'); }
    setAssP(false); setTimeout(() => setMsgP(''), 3000);
  };
  const prelPerGiorno = useMemo(() => { const m = new Map<string, Prelievo[]>(); prelievi.forEach(p => { const k = toISO(new Date(p.dataPrelievo)); if (!m.has(k)) m.set(k, []); m.get(k)!.push(p); }); return m; }, [prelievi]);
  const prelSel = useMemo(() => (prelPerGiorno.get(prelGiorno) || []).sort((a, b) => (a.orario||'').localeCompare(b.orario||'')), [prelPerGiorno, prelGiorno]);
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

  const loadEsami = async () => { try { const r = await api.get('/esami-strumentali', { params: { tipoGestione: 'privato', archiviati: 'false' } }); setEsami(r.data); } catch {/***/} };
  const creaEsame = async () => {
    if (!fE.patient || !fE.tipoEsame) return; setSavingE(true);
    try { await api.post('/esami-strumentali', { ...fE, tipoEsame: [fE.tipoEsame], staff: fE.staff || undefined }); setShowFE(false); setFE({ patient: '', staff: '', dataEsame: eGiorno, orario: '', tipoEsame: '', note: '' }); await loadEsami(); } catch {/***/}
    setSavingE(false);
  };
  const eliminaEsame = async (id: string) => { if (!confirm('Eliminare?')) return; try { await api.delete(`/esami-strumentali/${id}`); await loadEsami(); } catch {/***/} };
  const assegnaEsami = async () => {
    if (!opE || selE.size === 0) return; setAssE(true);
    try { await Promise.all([...selE].map(id => api.patch(`/esami-strumentali/${id}`, { staff: opE }))); setSelE(new Set()); setOpE(''); setMsgE(`✅ ${selE.size} assegnato/i`); await loadEsami(); } catch { setMsgE('❌ Errore'); }
    setAssE(false); setTimeout(() => setMsgE(''), 3000);
  };
  const esamiPerGiorno = useMemo(() => { const m = new Map<string, Esame[]>(); esami.forEach(e => { const k = toISO(new Date(e.dataEsame)); if (!m.has(k)) m.set(k, []); m.get(k)!.push(e); }); return m; }, [esami]);
  const esamiSel = useMemo(() => (esamiPerGiorno.get(eGiorno) || []).sort((a, b) => (a.orario||'').localeCompare(b.orario||'')), [esamiPerGiorno, eGiorno]);
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
  const [fpPaz, setFpPaz] = useState('');
  const [fpStaff, setFpStaff] = useState('');
  const [fpCats, setFpCats] = useState<string[]>([]);
  // Macro-categorie e fabbisogni (come WorkPlan.tsx)
  const [fpMacroCats, setFpMacroCats] = useState<Record<MacroCategoria, boolean>>({ infermieristico: false, riabilitativo: false, medico_specialistiche: false });
  const [fpFabbisogni, setFpFabbisogni] = useState<Record<MacroCategoria, string[]>>({ infermieristico: [], riabilitativo: [], medico_specialistiche: [] });
  const [fpStaffPerCat, setFpStaffPerCat] = useState<Record<MacroCategoria, string>>({ infermieristico: '', riabilitativo: '', medico_specialistiche: '' });
  const [fpNotes, setFpNotes] = useState('');
  const [fpCompenso, setFpCompenso] = useState<'orario'|'fisso'|'nessuno'>('nessuno');
  const [fpTariffa, setFpTariffa] = useState(0);
  const [fpCosto, setFpCosto] = useState(0);
  const [fpGiorni, setFpGiorni] = useState(GIORNI_DEFAULT.map(g => ({ ...g })));

  const loadPiani = async () => { try { const r = await api.get('/workplan'); setPiani(r.data); } catch {/***/} };
  const resetFPiano = () => { setFpTipo('prestazionale'); setFpTask(''); setFpDate(''); setFpFine(''); setFpTime(''); setFpDur(60); setFpPaz(''); setFpStaff(''); setFpCats([]); setFpNotes(''); setFpCompenso('nessuno'); setFpTariffa(0); setFpCosto(0); setFpGiorni(GIORNI_DEFAULT.map(g => ({ ...g }))); setFpMacroCats({ infermieristico: false, riabilitativo: false, medico_specialistiche: false }); setFpFabbisogni({ infermieristico: [], riabilitativo: [], medico_specialistiche: [] }); setFpStaffPerCat({ infermieristico: '', riabilitativo: '', medico_specialistiche: '' }); };
  const creaPiano = async (ev: FormEvent) => {
    ev.preventDefault(); setErrPiano(''); setOkPiano('');
    if (fpTipo === 'prestazionale') {
      if (!fpPaz || !fpDate || !fpTask) { setErrPiano('Compila paziente, data e attività.'); return; }
      setSavingPiano(true);
      try {
        const giorniAttivi = fpGiorni.filter(g => g.attivo).map(g => ({ giorno: g.giorno, accessiAlGiorno: g.accessiAlGiorno, minutiPerAccesso: g.minutiPerAccesso }));
        await api.post('/workplan', {
          type: fpTipo,
          patient: fpPaz, staff: fpStaff || undefined, task: fpTask,
          date: fpDate, dataFine: fpFine || undefined, time: fpTime || undefined, duration: fpDur,
          notes: fpNotes || undefined, giorniSettimana: giorniAttivi.length > 0 ? giorniAttivi : undefined,
          tipoCompenso: fpCompenso, tariffa: fpCompenso !== 'nessuno' ? fpTariffa : 0, costoPrestazione: fpCosto > 0 ? fpCosto : 0,
        });
        await loadPiani(); resetFPiano(); setShowFPiano(false);
        setOkPiano('✅ Incarico creato!'); setTimeout(() => setOkPiano(''), 3000);
      } catch (err: any) { setErrPiano(err.response?.data?.message || 'Errore'); }
      setSavingPiano(false);
    } else {
      if (!fpPaz || !fpStaff || !fpDate || !fpTask || fpCats.length === 0) { setErrPiano('Compila tutti i campi obbligatori.'); return; }
      setSavingPiano(true);
      try {
        const giorniAttivi = fpGiorni.filter(g => g.attivo).map(g => ({ giorno: g.giorno, accessiAlGiorno: g.accessiAlGiorno, minutiPerAccesso: g.minutiPerAccesso }));
        await api.post('/workplan', { type: fpTipo, categories: fpCats, patient: fpPaz, staff: fpStaff, task: fpTask, date: fpDate, dataFine: fpFine || undefined, time: fpTime || undefined, duration: fpDur, notes: fpNotes || undefined, giorniSettimana: giorniAttivi.length > 0 ? giorniAttivi : undefined, tipoCompenso: fpCompenso, tariffa: fpCompenso !== 'nessuno' ? fpTariffa : 0, costoPrestazione: fpCosto > 0 ? fpCosto : 0 });
        await loadPiani(); resetFPiano(); setShowFPiano(false);
        setOkPiano('✅ Incarico creato!'); setTimeout(() => setOkPiano(''), 3000);
      } catch (err: any) { setErrPiano(err.response?.data?.message || 'Errore'); }
      setSavingPiano(false);
    }
  };
  const eliminaPiano = async (id: string) => { if (!confirm('Eliminare?')) return; try { await api.delete(`/workplan/${id}`); await loadPiani(); } catch {/***/} };
  const copiaLink = async (id: string) => {
    const url = `${window.location.origin}/accesso/${id}`;
    try { await navigator.clipboard.writeText(url); } catch { const el = document.createElement('input'); el.value = url; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); }
    setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
  };
  const pianiFiltrati = useMemo(() => {
    let list = piani.filter(w => w.status !== 'cancelled');
    if (pianoTipo !== 'tutti') list = list.filter(w => w.type === pianoTipo);
    const t = searchP.toLowerCase().trim();
    if (t) list = list.filter(w => `${w.patient?.firstName} ${w.patient?.lastName} ${w.staff?.firstName} ${w.staff?.lastName} ${w.task}`.toLowerCase().includes(t));
    return list;
  }, [piani, pianoTipo, searchP]);

  // ─── Caricamento ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [pazRes, staffRes] = await Promise.all([api.get('/patients'), api.get('/staff', { params: { active: true } })]);
        setPazienti((pazRes.data as Paz[]).filter(p => p.tipoGestione === 'privato' || !p.tipoGestione));
        setStaff((staffRes.data as Staff[]).filter(s => s.active));
      } catch {/***/}
      await Promise.all([loadPrelievi(), loadEsami(), loadPiani()]);
      setLoading(false);
    })();
  }, []);

  const COL = { prelievi: '#0369a1', esami: '#7c3aed', piani: '#059669' };
  const colore = COL[mainTab];

  if (loading) return <section><p style={{ color: '#6b7280', padding: '40px', textAlign: 'center' }}>⏳ Caricamento...</p></section>;

  const subTabStyle = (active: boolean, col: string) => ({ padding: '7px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px', background: active ? col : 'transparent', color: active ? 'white' : '#64748b' } as React.CSSProperties);

  return (
    <section className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: colore }}>
          <Calendar size={26} /> Centro Prenotazioni — Privato
        </h1>
      </div>

      {/* Tab bar principale */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: '#f1f5f9', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
        {(['prelievi', 'esami', 'piani'] as const).map(t => (
          <button key={t} onClick={() => setMainTab(t)} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', background: mainTab === t ? COL[t] : 'transparent', color: mainTab === t ? 'white' : '#475569' }}>
            {t === 'prelievi' ? '💉 Prelievi' : t === 'esami' ? '🏥 Esami Strumentali' : '📋 Piani Lavorativi'}
          </button>
        ))}
      </div>

      {/* ══ TAB PRELIEVI ══════════════════════════════════════════════════════ */}
      {mainTab === 'prelievi' && (
        <div>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#f8fafc', borderRadius: '10px', padding: '4px', width: 'fit-content', border: '1px solid #e2e8f0' }}>
            <button onClick={() => setSubPrel('prenotazioni')} style={subTabStyle(subPrel === 'prenotazioni', '#0369a1')}><ClipboardList size={14} />Prenotazioni</button>
            <button onClick={() => setSubPrel('assegnazione')} style={subTabStyle(subPrel === 'assegnazione', '#0369a1')}><UserCheck size={14} />Assegnazione</button>
          </div>

          {subPrel === 'prenotazioni' && (
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' }}>
              <div>
                <Cal anno={prelAnno} mese={prelMese} sel={prelGiorno} onDay={setPrelGiorno}
                  onPrev={() => { if (prelMese === 0) { setPrelMese(11); setPrelAnno(a => a-1); } else setPrelMese(m => m-1); }}
                  onNext={() => { if (prelMese === 11) { setPrelMese(0); setPrelAnno(a => a+1); } else setPrelMese(m => m+1); }}
                  dots={dotsPrel} />
                {puoGestire && <button onClick={() => { setFP(f => ({ ...f, dataPrelievo: prelGiorno })); setShowFP(true); }} style={{ width: '100%', background: '#0369a1', color: 'white', border: 'none', borderRadius: '10px', padding: '12px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Plus size={16} /> Nuovo Prelievo</button>}
              </div>
              <div>
                <h3 style={{ color: '#0369a1', marginBottom: '12px', marginTop: 0 }}>
                  {new Date(prelGiorno + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  <span style={{ marginLeft: '8px', background: '#dbeafe', color: '#1d4ed8', borderRadius: '20px', padding: '2px 10px', fontSize: '0.8rem' }}>{prelSel.length}</span>
                </h3>
                {prelSel.length === 0
                  ? <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Nessun prelievo</div>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {prelSel.map(p => (
                      <div key={p._id} style={{ background: 'white', border: `1px solid #bfdbfe`, borderLeft: `4px solid ${p.status === 'eseguito' ? '#059669' : '#0369a1'}`, borderRadius: '10px', overflow: 'hidden' }}>
                        <button type="button" onClick={() => setAperto(aperto === p._id ? null : p._id)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 14px', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}><User size={13} style={{ display: 'inline', marginRight: '4px' }} />{p.patient?.firstName} {p.patient?.lastName}{p.orario && <span style={{ marginLeft: '8px', color: '#64748b', fontWeight: 400, fontSize: '0.82rem' }}><Clock size={11} style={{ display: 'inline' }} /> {p.orario}</span>}</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>💉 {p.tipoPrelievo} <span style={{ marginLeft: '6px', padding: '1px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700, background: p.status === 'eseguito' ? '#dcfce7' : '#dbeafe', color: p.status === 'eseguito' ? '#059669' : '#1d4ed8' }}>{p.status === 'eseguito' ? '✅ Eseguito' : '🔵 Pianificato'}</span></div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {puoGestire && <button onClick={e => { e.stopPropagation(); eliminaPrelievo(p._id); }} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#dc2626' }}><Trash2 size={13} /></button>}
                            {aperto === p._id ? <ChevronUp size={15} style={{ color: '#94a3b8' }} /> : <ChevronDown size={15} style={{ color: '#94a3b8' }} />}
                          </div>
                        </button>
                        {aperto === p._id && (
                          <div style={{ borderTop: '1px solid #f1f5f9', padding: '10px 14px', background: '#f8fafc', fontSize: '0.84rem' }}>
                            {p.staff?.firstName && <p style={{ margin: '0 0 4px' }}>👤 {p.staff.firstName} {p.staff.lastName}</p>}
                            {p.note && <p style={{ margin: 0, color: '#475569' }}>📝 {p.note}</p>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                }
              </div>
            </div>
          )}

          {subPrel === 'assegnazione' && (
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' }}>
              <Cal anno={assAnnoP} mese={assMeseP} sel={assGiornoP} onDay={setAssGiornoP}
                onPrev={() => { if (assMeseP === 0) { setAssMeseP(11); setAssAnnoP(a => a-1); } else setAssMeseP(m => m-1); }}
                onNext={() => { if (assMeseP === 11) { setAssMeseP(0); setAssAnnoP(a => a+1); } else setAssMeseP(m => m+1); }}
                dots={dotsPrel} />
              <div>
                <h3 style={{ color: '#0369a1', marginBottom: '12px', marginTop: 0 }}>Assegnazione — {new Date(assGiornoP + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</h3>
                {msgP && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', color: '#166534', fontWeight: 600 }}>{msgP}</div>}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <select value={opP} onChange={e => setOpP(e.target.value)} style={{ flex: 1, minWidth: '200px', padding: '9px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                    <option value="">Seleziona operatore...</option>
                    {staff.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} — {s.role}</option>)}
                  </select>
                  <button onClick={assegnaPrelievi} disabled={assP || selP.size === 0 || !opP} style={{ padding: '9px 18px', background: '#0369a1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, opacity: (selP.size === 0 || !opP) ? 0.5 : 1 }}>
                    {assP ? '...' : <><UserCheck size={14} style={{ display: 'inline', marginRight: '5px' }} />Assegna ({selP.size})</>}
                  </button>
                </div>
                {prelAss.length === 0
                  ? <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Nessun prelievo pianificato</div>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {prelAss.map(p => { const s = selP.has(p._id); return (
                      <div key={p._id} onClick={() => setSelP(prev => { const n = new Set(prev); s ? n.delete(p._id) : n.add(p._id); return n; })} style={{ background: s ? '#eff6ff' : 'white', border: `2px solid ${s ? '#2563eb' : '#e2e8f0'}`, borderRadius: '10px', padding: '12px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div><div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{p.patient?.firstName} {p.patient?.lastName}</div><div style={{ fontSize: '0.78rem', color: '#64748b' }}>💉 {p.tipoPrelievo}{p.orario ? ` · ${p.orario}` : ''}</div></div>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${s ? '#2563eb' : '#d1d5db'}`, background: s ? '#2563eb' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s && <CheckCircle size={12} color="white" />}</div>
                      </div>
                    ); })}
                  </div>
                }
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB ESAMI ══════════════════════════════════════════════════════════ */}
      {mainTab === 'esami' && (
        <div>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#f8fafc', borderRadius: '10px', padding: '4px', width: 'fit-content', border: '1px solid #e2e8f0' }}>
            <button onClick={() => setSubE('prenotazioni')} style={subTabStyle(subE === 'prenotazioni', '#7c3aed')}><ClipboardList size={14} />Prenotazioni</button>
            <button onClick={() => setSubE('assegnazione')} style={subTabStyle(subE === 'assegnazione', '#7c3aed')}><UserCheck size={14} />Assegnazione</button>
          </div>

          {subE === 'prenotazioni' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 300px) 1fr', gap: '16px', alignItems: 'start' }}>
              <div>
                <Cal anno={eAnno} mese={eMese} sel={eGiorno} onDay={setEGiorno}
                  onPrev={() => { if (eMese === 0) { setEMese(11); setEAnno(a => a-1); } else setEMese(m => m-1); }}
                  onNext={() => { if (eMese === 11) { setEMese(0); setEAnno(a => a+1); } else setEMese(m => m+1); }}
                  dots={dotsEsami} />
                {puoGestire && <button onClick={() => { setFE(f => ({ ...f, dataEsame: eGiorno })); setShowFE(true); }} style={{ width: '100%', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '10px', padding: '12px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Plus size={16} /> Nuovo Esame</button>}
              </div>
              <div>
                <h3 style={{ color: '#7c3aed', marginBottom: '12px', marginTop: 0 }}>
                  {new Date(eGiorno + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  <span style={{ marginLeft: '8px', background: '#ede9fe', color: '#6d28d9', borderRadius: '20px', padding: '2px 10px', fontSize: '0.8rem' }}>{esamiSel.length}</span>
                </h3>
                {esamiSel.length === 0
                  ? <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Nessun esame</div>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {esamiSel.map(e => (
                      <div key={e._id} style={{ background: 'white', border: '1px solid #e9d5ff', borderLeft: `4px solid #7c3aed`, borderRadius: '10px', overflow: 'hidden' }}>
                        <button type="button" onClick={() => setApertoE(apertoE === e._id ? null : e._id)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 14px', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}><User size={13} style={{ display: 'inline', marginRight: '4px' }} />{e.patient?.firstName} {e.patient?.lastName}{e.orario && <span style={{ marginLeft: '8px', color: '#64748b', fontWeight: 400, fontSize: '0.82rem' }}><Clock size={11} style={{ display: 'inline' }} /> {e.orario}</span>}</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>🏥 {e.tipoEsame ? (Array.isArray(e.tipoEsame) ? e.tipoEsame.join(', ') : e.tipoEsame) : 'N/D'} <span style={{ marginLeft: '6px', padding: '1px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700, background: '#ede9fe', color: '#6d28d9' }}>{e.status === 'eseguito' ? '✅ Eseguito' : e.status === 'refertato' ? '📋 Refertato' : '🔵 Pianificato'}</span></div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {puoGestire && <button onClick={ev => { ev.stopPropagation(); eliminaEsame(e._id); }} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#dc2626' }}><Trash2 size={13} /></button>}
                            <button onClick={ev => { ev.stopPropagation(); navigate('/esami-strumentali'); }} title="Gestisci" style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#7c3aed' }}><Eye size={13} /></button>
                            {apertoE === e._id ? <ChevronUp size={15} style={{ color: '#94a3b8' }} /> : <ChevronDown size={15} style={{ color: '#94a3b8' }} />}
                          </div>
                        </button>
                        {apertoE === e._id && <div style={{ borderTop: '1px solid #f1f5f9', padding: '10px 14px', background: '#faf5ff', fontSize: '0.84rem' }}>
                          {e.staff?.firstName && <p style={{ margin: '0 0 4px' }}>👤 {e.staff.firstName} {e.staff.lastName}</p>}
                          {e.note && <p style={{ margin: 0, color: '#475569' }}>📝 {e.note}</p>}
                        </div>}
                      </div>
                    ))}
                  </div>
                }
              </div>
            </div>
          )}

          {subE === 'assegnazione' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 300px) 1fr', gap: '16px', alignItems: 'start' }}>
              <Cal anno={assAnnoE} mese={assMeseE} sel={assGiornoE} onDay={setAssGiornoE}
                onPrev={() => { if (assMeseE === 0) { setAssMeseE(11); setAssAnnoE(a => a-1); } else setAssMeseE(m => m-1); }}
                onNext={() => { if (assMeseE === 11) { setAssMeseE(0); setAssAnnoE(a => a+1); } else setAssMeseE(m => m+1); }}
                dots={dotsEsami} />
              <div>
                <h3 style={{ color: '#7c3aed', marginBottom: '12px', marginTop: 0 }}>Assegnazione — {new Date(assGiornoE + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</h3>
                {msgE && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', color: '#166534', fontWeight: 600 }}>{msgE}</div>}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <select value={opE} onChange={e => setOpE(e.target.value)} style={{ flex: 1, minWidth: '200px', padding: '9px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                    <option value="">Seleziona operatore...</option>
                    {staff.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} — {s.role}</option>)}
                  </select>
                  <button onClick={assegnaEsami} disabled={assE || selE.size === 0 || !opE} style={{ padding: '9px 18px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, opacity: (selE.size === 0 || !opE) ? 0.5 : 1 }}>
                    {assE ? '...' : <><UserCheck size={14} style={{ display: 'inline', marginRight: '5px' }} />Assegna ({selE.size})</>}
                  </button>
                </div>
                {esamiAss.length === 0
                  ? <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Nessun esame pianificato</div>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {esamiAss.map(e => { const s = selE.has(e._id); return (
                      <div key={e._id} onClick={() => setSelE(prev => { const n = new Set(prev); s ? n.delete(e._id) : n.add(e._id); return n; })} style={{ background: s ? '#f5f3ff' : 'white', border: `2px solid ${s ? '#7c3aed' : '#e2e8f0'}`, borderRadius: '10px', padding: '12px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div><div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{e.patient?.firstName} {e.patient?.lastName}</div><div style={{ fontSize: '0.78rem', color: '#64748b' }}>🏥 {e.tipoEsame ? (Array.isArray(e.tipoEsame) ? e.tipoEsame.join(', ') : e.tipoEsame) : 'N/D'}{e.orario ? ` · ${e.orario}` : ''}</div></div>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${s ? '#7c3aed' : '#d1d5db'}`, background: s ? '#7c3aed' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s && <CheckCircle size={12} color="white" />}</div>
                      </div>
                    ); })}
                  </div>
                }
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB PIANI LAVORATIVI ══════════════════════════════════════════════ */}
      {mainTab === 'piani' && (
        <div>
          {okPiano && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 16px', marginBottom: '12px', color: '#166534', fontWeight: 600 }}>{okPiano}</div>}
          {errPiano && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 16px', marginBottom: '12px', color: '#dc2626' }}>{errPiano}</div>}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '2px', background: '#f1f5f9', borderRadius: '8px', padding: '2px' }}>
              {([['tutti', 'Tutti'], ['prestazionale', '🩺 Prest.'], ['assistenziale', '🤝 Ass.']] as const).map(([val, lbl]) => (
                <button key={val} onClick={() => setPianoTipo(val as any)} style={{ padding: '5px 9px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.7rem', background: pianoTipo === val ? '#059669' : 'transparent', color: pianoTipo === val ? 'white' : '#475569' }}>
                  {lbl}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-end' }}>
              <div style={{ position: 'relative', flex: '1 1 120px', maxWidth: '200px', minWidth: '100px' }}>
                <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input value={searchP} onChange={e => setSearchP(e.target.value)} placeholder="Cerca..." style={{ paddingLeft: '28px', padding: '8px 8px 8px 28px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.8rem', width: '100%', boxSizing: 'border-box' }} />
              </div>
              {puoGestire && <button onClick={() => setShowFPiano(true)} style={{ background: '#059669', color: 'white', padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}><Plus size={14} /> Nuovo</button>}
            </div>
          </div>
          {pianiFiltrati.length === 0
            ? <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Nessun incarico {pianoTipo}</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pianiFiltrati.map(w => {
                const allCats = [...PREST_CATS, ...ASSIST_CATS];
                const labels = (w.categories || []).map(c => allCats.find(x => x.value === c)?.label || c);
                return (
                  <div key={w._id} style={{ background: 'white', border: '1px solid #e2e8f0', borderLeft: `4px solid ${w.status === 'completed' ? '#059669' : '#10b981'}`, borderRadius: '10px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 0', minWidth: '0' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: '3px', wordBreak: 'break-word' }}>
                        {w.patient?.firstName ?? '(paziente eliminato)'} {w.patient?.lastName ?? ''}
                        <span style={{ marginLeft: '5px', padding: '1px 6px', borderRadius: '10px', fontSize: '0.62rem', fontWeight: 700, background: w.type === 'prestazionale' ? '#dbeafe' : '#fce7f3', color: w.type === 'prestazionale' ? '#1d4ed8' : '#be185d' }}>{w.type === 'prestazionale' ? 'PREST' : 'ASS'}</span>
                        <span style={{ marginLeft: '4px', padding: '1px 6px', borderRadius: '10px', fontSize: '0.62rem', fontWeight: 700, background: w.status === 'completed' ? '#dcfce7' : '#d1fae5', color: '#059669' }}>{w.status === 'completed' ? '✅' : '🟢'}</span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#475569' }}>👤 {w.staff?.firstName} {w.staff?.lastName} — {w.staff?.role}</div>
                      <div style={{ fontSize: '0.76rem', color: '#64748b', wordBreak: 'break-word' }}>📋 {w.task}{labels.length > 0 && <span style={{ color: '#94a3b8' }}> · {labels.join(', ')}</span>}</div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '3px' }}><Calendar size={10} style={{ display: 'inline', marginRight: '3px' }} />{new Date(w.date).toLocaleDateString('it-IT')}{w.dataFine && ` → ${new Date(w.dataFine).toLocaleDateString('it-IT')}`}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0, flexWrap: 'wrap' }}>
                      <button onClick={() => navigate('/workplan')} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#059669', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px' }}><Eye size={12} /> Dettaglio</button>
                      <button onClick={() => copiaLink(w._id)} style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#0369a1', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px' }}>{copiedId === w._id ? <CheckCircle size={12} /> : <Copy size={12} />}</button>
                      {puoGestire && <button onClick={() => eliminaPiano(w._id)} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#dc2626' }}><Trash2 size={12} /></button>}
                    </div>
                  </div>
                );
              })}
            </div>
          }
        </div>
      )}

      {/* ══ MODAL NUOVO PRELIEVO ══════════════════════════════════════════════ */}
      {showFP && puoGestire && (
        <div className="modal-overlay" onClick={() => setShowFP(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '100%', backgroundColor: 'white', borderRadius: '12px', padding: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '8px' }}><Syringe size={20} />Nuovo Prelievo</h3>
              <button onClick={() => setShowFP(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gap: '14px' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Paziente *<select value={fP.patient} onChange={e => setFP(f => ({ ...f, patient: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}><option value="">Seleziona...</option>{pazienti.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}</select></label>
              <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Operatore<select value={fP.staff} onChange={e => setFP(f => ({ ...f, staff: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}><option value="">Da assegnare...</option>{staff.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} — {s.role}</option>)}</select></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Data *<input type="date" value={fP.dataPrelievo} onChange={e => setFP(f => ({ ...f, dataPrelievo: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} /></label>
                <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Orario<input type="time" value={fP.orario} onChange={e => setFP(f => ({ ...f, orario: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} /></label>
              </div>
              <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Tipo prelievo *<select value={fP.tipoPrelievo} onChange={e => setFP(f => ({ ...f, tipoPrelievo: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}><option value="">Seleziona...</option>{TIPI_PRELIEVO.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
              <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Note<textarea value={fP.note} onChange={e => setFP(f => ({ ...f, note: e.target.value }))} rows={2} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', resize: 'vertical' }} /></label>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowFP(false)} style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>Annulla</button>
              <button onClick={creaPrelievo} disabled={savingP || !fP.patient || !fP.tipoPrelievo} style={{ padding: '10px 20px', borderRadius: '8px', background: '#0369a1', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', opacity: (!fP.patient || !fP.tipoPrelievo) ? 0.6 : 1 }}>{savingP ? '...' : <><CheckCircle size={16} />Salva</>}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL NUOVO ESAME ════════════════════════════════════════════════ */}
      {showFE && puoGestire && (
        <div className="modal-overlay" onClick={() => setShowFE(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '100%', backgroundColor: 'white', borderRadius: '12px', padding: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '8px' }}><HeartPulse size={20} />Nuovo Esame Strumentale</h3>
              <button onClick={() => setShowFE(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gap: '14px' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Paziente *<select value={fE.patient} onChange={e => setFE(f => ({ ...f, patient: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}><option value="">Seleziona...</option>{pazienti.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}</select></label>
              <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Operatore<select value={fE.staff} onChange={e => setFE(f => ({ ...f, staff: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}><option value="">Da assegnare...</option>{staff.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} — {s.role}</option>)}</select></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Data *<input type="date" value={fE.dataEsame} onChange={e => setFE(f => ({ ...f, dataEsame: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} /></label>
                <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Orario<input type="time" value={fE.orario} onChange={e => setFE(f => ({ ...f, orario: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} /></label>
              </div>
              <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Tipo esame *<select value={fE.tipoEsame} onChange={e => setFE(f => ({ ...f, tipoEsame: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}><option value="">Seleziona...</option>{TIPI_ESAME.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
              <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Note<textarea value={fE.note} onChange={e => setFE(f => ({ ...f, note: e.target.value }))} rows={2} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', resize: 'vertical' }} /></label>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowFE(false)} style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>Annulla</button>
              <button onClick={creaEsame} disabled={savingE || !fE.patient || !fE.tipoEsame} style={{ padding: '10px 20px', borderRadius: '8px', background: '#7c3aed', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', opacity: (!fE.patient || !fE.tipoEsame) ? 0.6 : 1 }}>{savingE ? '...' : <><CheckCircle size={16} />Salva</>}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL NUOVO INCARICO ══════════════════════════════════════════════ */}
      {showFPiano && puoGestire && (
        <div className="modal-overlay" onClick={() => setShowFPiano(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '620px', width: '100%', backgroundColor: 'white', borderRadius: '12px', padding: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#059669', display: 'flex', alignItems: 'center', gap: '8px' }}><ClipboardList size={20} />Nuovo Incarico</h3>
              <button onClick={() => setShowFPiano(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={creaPiano}>
              <div style={{ display: 'grid', gap: '14px' }}>
                {/* Tipo */}
                <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '8px', padding: '4px' }}>
                  {(['prestazionale', 'assistenziale'] as const).map(t => (
                    <button key={t} type="button" onClick={() => { setFpTipo(t); setFpCats([]); setFpMacroCats({ infermieristico: false, riabilitativo: false, medico_specialistiche: false }); setFpFabbisogni({ infermieristico: [], riabilitativo: [], medico_specialistiche: [] }); setFpStaffPerCat({ infermieristico: '', riabilitativo: '', medico_specialistiche: '' }); }} style={{ flex: 1, padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.72rem', background: fpTipo === t ? '#059669' : 'transparent', color: fpTipo === t ? 'white' : '#475569' }}>
                      {t === 'prestazionale' ? '🩺 Prestaz.' : '🤝 Assist.'}
                    </button>
                  ))}
                </div>
                {/* Categorie — solo per Assistenziale */}
                {fpTipo === 'assistenziale' && (
                  <div>
                    <label style={{ fontWeight: 600, fontSize: '0.875rem', display: 'block', marginBottom: '8px' }}>Categorie *</label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {ASSIST_CATS.map(cat => {
                        const sel = fpCats.includes(cat.value);
                        return <button key={cat.value} type="button" onClick={() => setFpCats(prev => sel ? prev.filter(c => c !== cat.value) : [...prev, cat.value])} style={{ padding: '6px 10px', borderRadius: '6px', border: `2px solid ${sel ? cat.color : '#d1d5db'}`, background: sel ? cat.color + '20' : 'white', color: sel ? cat.color : '#374151', cursor: 'pointer', fontWeight: 600, fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '4px' }}><cat.Icon size={12} />{cat.label}</button>;
                      })}
                    </div>
                  </div>
                )}
                <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Paziente *<select value={fpPaz} onChange={e => setFpPaz(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}><option value="">Seleziona...</option>{pazienti.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}</select></label>
                <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Operatore {fpTipo === 'assistenziale' ? '*' : ''}<select value={fpStaff} onChange={e => setFpStaff(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}><option value="">Seleziona...</option>{staff.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} — {s.role}</option>)}</select></label>
                <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Attività *<input value={fpTask} onChange={e => setFpTask(e.target.value)} placeholder="Es. Assistenza domiciliare..." style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} /></label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Data inizio *<input type="date" value={fpDate} onChange={e => setFpDate(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} /></label>
                  <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Data fine<input type="date" value={fpFine} onChange={e => setFpFine(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} /></label>
                  <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Orario<input type="time" value={fpTime} onChange={e => setFpTime(e.target.value)} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} /></label>
                </div>
                {/* Giorni settimana */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.875rem', display: 'block', marginBottom: '8px' }}>Giorni ricorrenti</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {fpGiorni.map((g, i) => (
                      <button key={g.giorno} type="button" onClick={() => setFpGiorni(prev => prev.map((x, j) => j === i ? { ...x, attivo: !x.attivo } : x))} style={{ padding: '6px 10px', borderRadius: '8px', border: `2px solid ${g.attivo ? '#059669' : '#d1d5db'}`, background: g.attivo ? '#dcfce7' : 'white', color: g.attivo ? '#059669' : '#374151', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>{g.label}</button>
                    ))}
                  </div>
                </div>
                {/* Compenso */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Tipo compenso<select value={fpCompenso} onChange={e => setFpCompenso(e.target.value as any)} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}><option value="nessuno">Nessuno</option><option value="orario">Orario (€/h)</option><option value="fisso">Fisso (€/accesso)</option></select></label>
                  {fpCompenso !== 'nessuno' && <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Tariffa (€)<input type="number" value={fpTariffa} onChange={e => setFpTariffa(Number(e.target.value))} min={0} step={0.5} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} /></label>}
                </div>
                <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Note<textarea value={fpNotes} onChange={e => setFpNotes(e.target.value)} rows={2} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', resize: 'vertical' }} /></label>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowFPiano(false)} style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>Annulla</button>
                <button type="submit" disabled={savingPiano} style={{ padding: '10px 20px', borderRadius: '8px', background: '#059669', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>{savingPiano ? '...' : <><CheckCircle size={16} />Crea Incarico</>}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
