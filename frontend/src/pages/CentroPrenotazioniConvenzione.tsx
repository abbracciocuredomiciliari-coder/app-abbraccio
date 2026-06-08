import { FormEvent, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import {
  Syringe, HeartPulse, ClipboardList, Plus, X, ChevronLeft, ChevronRight,
  Calendar, Clock, User, CheckCircle, Trash2, ChevronDown, ChevronUp,
  UserCheck, Eye, TestTube2, Bandage, Activity, CalendarDays, Users, Copy, Search, Building2,
} from 'lucide-react';

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
const GIORNI_DEFAULT = [
  { key: 'lun', label: 'L' }, { key: 'mar', label: 'M' }, { key: 'mer', label: 'M' },
  { key: 'gio', label: 'G' }, { key: 'ven', label: 'V' }, { key: 'sab', label: 'S' }, { key: 'dom', label: 'D' },
];
const RUOLI_PRIVILEGIATI = ['admin', 'coordinator', 'direttore'];

interface Paziente { _id: string; firstName: string; lastName: string; modalita?: string; convenzione?: string; }
interface StaffMember { _id: string; firstName: string; lastName: string; role: string; }
interface Prelievo { _id: string; patient: { _id: string; firstName: string; lastName: string } | null; staff: { _id: string; firstName: string; lastName: string } | null; tipoPrelievo: string[]; dataPrelievo: string; orario?: string; note?: string; status: string; }
interface EsameItem { _id: string; patient: { _id: string; firstName: string; lastName: string } | null; staff: { _id: string; firstName: string; lastName: string } | null; tipoEsame: string[]; dataEsame: string; orario?: string; note?: string; status: string; }
interface WorkPlanItem { _id: string; task: string; type: 'prestazionale' | 'assistenziale'; patient: { _id: string; firstName: string; lastName: string } | null; staff: { _id: string; firstName: string; lastName: string } | null; status: string; dataInizio?: string; dataFine?: string; note?: string; categoriePrestazionali?: string[]; categorieAssistenziali?: string[]; createdAt: string; }
type MainTab = 'prelievi' | 'esami' | 'piani';
type SubTab = 'prenotazioni' | 'assegnazione';

function CalendarioMese({ year, month, onPrev, onNext, selectedDate, onSelectDate, daysWithDots }: { year: number; month: number; onPrev: () => void; onNext: () => void; selectedDate: string; onSelectDate: (d: string) => void; daysWithDots: Set<string>; }) {
  const days = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const todayStr = toISO(new Date());
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button onClick={onPrev} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px' }}><ChevronLeft size={18} /></button>
        <span style={{ fontWeight: '700', fontSize: '1rem', color: '#1e3a5f' }}>{MESI[month]} {year}</span>
        <button onClick={onNext} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px' }}><ChevronRight size={18} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px', textAlign: 'center' }}>
        {GIORNI_SETT.map(g => <div key={g} style={{ fontSize: '0.7rem', fontWeight: '700', color: '#9ca3af', padding: '4px 0' }}>{g}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={`e-${i}`} />;
          const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const isSel = iso === selectedDate;
          const isToday = iso === todayStr;
          const hasDot = daysWithDots.has(iso);
          return (
            <div key={iso} onClick={() => onSelectDate(iso)} style={{ padding: '6px 2px', borderRadius: '8px', cursor: 'pointer', position: 'relative', background: isSel ? '#1e3a5f' : isToday ? '#eff6ff' : 'transparent', color: isSel ? 'white' : isToday ? '#1e40af' : '#374151', fontWeight: isSel || isToday ? '700' : '400', fontSize: '0.85rem' }}>
              {d}
              {hasDot && <span style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', width: '4px', height: '4px', borderRadius: '50%', background: isSel ? 'white' : '#0284c7' }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CentroPrenotazioniConvenzione() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEdit = RUOLI_PRIVILEGIATI.includes(user?.role || '');
  const today = toISO(new Date());

  const [mainTab, setMainTab] = useState<MainTab>('prelievi');
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(today);
  const [prelieviSubTab, setPrelieviSubTab] = useState<SubTab>('prenotazioni');
  const [esamiSubTab, setEsamiSubTab] = useState<SubTab>('prenotazioni');

  const [pazienti, setPazienti] = useState<Paziente[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [prelievi, setPrelievi] = useState<Prelievo[]>([]);
  const [prelieviLoading, setPrelieviLoading] = useState(false);
  const [esami, setEsami] = useState<EsameItem[]>([]);
  const [esamiLoading, setEsamiLoading] = useState(false);
  const [piani, setPiani] = useState<WorkPlanItem[]>([]);
  const [pianiLoading, setPianiLoading] = useState(false);
  const [pianiType, setPianiType] = useState<'prestazionale' | 'assistenziale'>('prestazionale');
  const [pianiSearch, setPianiSearch] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedId, setCopiedId] = useState('');

  const [showFormPrelievo, setShowFormPrelievo] = useState(false);
  const [fpPaziente, setFpPaziente] = useState('');
  const [fpStaff, setFpStaff] = useState('');
  const [fpTipi, setFpTipi] = useState<string[]>([]);
  const [fpData, setFpData] = useState(today);
  const [fpOrario, setFpOrario] = useState('');
  const [fpNote, setFpNote] = useState('');
  const [fpLoading, setFpLoading] = useState(false);

  const [showFormEsame, setShowFormEsame] = useState(false);
  const [fePaziente, setFePaziente] = useState('');
  const [feStaff, setFeStaff] = useState('');
  const [feTipi, setFeTipi] = useState<string[]>([]);
  const [feData, setFeData] = useState(today);
  const [feOrario, setFeOrario] = useState('');
  const [feNote, setFeNote] = useState('');
  const [feLoading, setFeLoading] = useState(false);

  const [showFormPiano, setShowFormPiano] = useState(false);
  const [wpTask, setWpTask] = useState('');
  const [wpType, setWpType] = useState<'prestazionale' | 'assistenziale'>('prestazionale');
  const [wpPaziente, setWpPaziente] = useState('');
  const [wpStaff, setWpStaff] = useState('');
  const [wpDataInizio, setWpDataInizio] = useState(today);
  const [wpDataFine, setWpDataFine] = useState('');
  const [wpNote, setWpNote] = useState('');
  const [wpPrestCats, setWpPrestCats] = useState<string[]>([]);
  const [wpAssistCats, setWpAssistCats] = useState<string[]>([]);
  const [wpGiorni, setWpGiorni] = useState<string[]>(['lun','mar','mer','gio','ven']);
  const [wpLoading, setWpLoading] = useState(false);

  const [prelieviSelezionati, setPrelieviSelezionati] = useState<Set<string>>(new Set());
  const [operatoreAssPrelievo, setOperatoreAssPrelievo] = useState('');
  const [assPrelievoLoading, setAssPrelievoLoading] = useState(false);
  const [esamiSelezionati, setEsamiSelezionati] = useState<Set<string>>(new Set());
  const [operatoreAssEsame, setOperatoreAssEsame] = useState('');
  const [assEsameLoading, setAssEsameLoading] = useState(false);

  useEffect(() => { loadPazientiStaff(); }, []);
  useEffect(() => { if (mainTab === 'prelievi') loadPrelievi(); }, [mainTab, calYear, calMonth]);
  useEffect(() => { if (mainTab === 'esami') loadEsami(); }, [mainTab, calYear, calMonth]);
  useEffect(() => { if (mainTab === 'piani') loadPiani(); }, [mainTab]);

  const loadPazientiStaff = async () => {
    try {
      const [pRes, sRes] = await Promise.all([api.get('/patients'), api.get('/staff')]);
      setPazienti(pRes.data.filter((p: Paziente) => p.modalita === 'convenzione' || p.convenzione));
      setStaff(sRes.data);
    } catch { /* silent */ }
  };

  const loadPrelievi = async () => {
    setPrelieviLoading(true);
    try { const r = await api.get(`/prelievi?year=${calYear}&month=${calMonth + 1}`); setPrelievi(r.data); }
    catch { setPrelievi([]); } finally { setPrelieviLoading(false); }
  };

  const loadEsami = async () => {
    setEsamiLoading(true);
    try { const r = await api.get('/esami-strumentali'); setEsami(r.data); }
    catch { setEsami([]); } finally { setEsamiLoading(false); }
  };

  const loadPiani = async () => {
    setPianiLoading(true);
    try { const r = await api.get('/workplan'); setPiani(r.data.filter((p: WorkPlanItem) => p.status !== 'archiviato')); }
    catch { setPiani([]); } finally { setPianiLoading(false); }
  };

  const handleCreaPrelievo = async (e: FormEvent) => {
    e.preventDefault();
    if (!fpPaziente || fpTipi.length === 0 || !fpData) { setError('Paziente, tipo e data obbligatori'); return; }
    setFpLoading(true);
    try {
      await api.post('/prelievi', { patient: fpPaziente, staff: fpStaff || undefined, tipoPrelievo: fpTipi, dataPrelievo: fpData, orario: fpOrario || undefined, note: fpNote || undefined });
      setSuccess('Prelievo creato'); setShowFormPrelievo(false);
      setFpPaziente(''); setFpStaff(''); setFpTipi([]); setFpOrario(''); setFpNote('');
      loadPrelievi();
    } catch (err: any) { setError(err.response?.data?.message || 'Errore'); }
    finally { setFpLoading(false); }
  };

  const handleEliminaPrelievo = async (id: string) => {
    if (!window.confirm('Eliminare?')) return;
    try { await api.delete(`/prelievi/${id}`); setSuccess('Eliminato'); loadPrelievi(); }
    catch (err: any) { setError(err.response?.data?.message || 'Errore'); }
  };

  const handleAssegnaPrelievi = async () => {
    if (!operatoreAssPrelievo || prelieviSelezionati.size === 0) { setError('Seleziona operatore e prelievi'); return; }
    setAssPrelievoLoading(true);
    try {
      await Promise.all([...prelieviSelezionati].map(id => api.patch(`/prelievi/${id}`, { staff: operatoreAssPrelievo })));
      setSuccess(`${prelieviSelezionati.size} prelievi assegnati`);
      setPrelieviSelezionati(new Set()); setOperatoreAssPrelievo(''); loadPrelievi();
    } catch (err: any) { setError(err.response?.data?.message || 'Errore'); }
    finally { setAssPrelievoLoading(false); }
  };

  const handleCreaEsame = async (e: FormEvent) => {
    e.preventDefault();
    if (!fePaziente || feTipi.length === 0 || !feData) { setError('Paziente, tipo e data obbligatori'); return; }
    setFeLoading(true);
    try {
      await api.post('/esami-strumentali', { patient: fePaziente, staff: feStaff || undefined, tipiEsame: feTipi, dataEsame: feData, orario: feOrario || undefined, note: feNote || undefined });
      setSuccess('Esame creato'); setShowFormEsame(false);
      setFePaziente(''); setFeStaff(''); setFeTipi([]); setFeOrario(''); setFeNote('');
      loadEsami();
    } catch (err: any) { setError(err.response?.data?.message || 'Errore'); }
    finally { setFeLoading(false); }
  };

  const handleEliminaEsame = async (id: string) => {
    if (!window.confirm('Eliminare?')) return;
    try { await api.delete(`/esami-strumentali/${id}`); setSuccess('Eliminato'); loadEsami(); }
    catch (err: any) { setError(err.response?.data?.message || 'Errore'); }
  };

  const handleAssegnaEsami = async () => {
    if (!operatoreAssEsame || esamiSelezionati.size === 0) { setError('Seleziona operatore e esami'); return; }
    setAssEsameLoading(true);
    try {
      await Promise.all([...esamiSelezionati].map(id => api.patch(`/esami-strumentali/${id}`, { staff: operatoreAssEsame })));
      setSuccess(`${esamiSelezionati.size} esami assegnati`);
      setEsamiSelezionati(new Set()); setOperatoreAssEsame(''); loadEsami();
    } catch (err: any) { setError(err.response?.data?.message || 'Errore'); }
    finally { setAssEsameLoading(false); }
  };

  const handleCreaPiano = async (e: FormEvent) => {
    e.preventDefault();
    if (!wpTask || !wpPaziente) { setError('Descrizione e paziente obbligatori'); return; }
    setWpLoading(true);
    try {
      await api.post('/workplan', { task: wpTask, type: wpType, patient: wpPaziente, staff: wpStaff || undefined, dataInizio: wpDataInizio, dataFine: wpDataFine || undefined, note: wpNote || undefined, categoriePrestazionali: wpPrestCats, categorieAssistenziali: wpAssistCats, giorni: wpGiorni });
      setSuccess('Piano creato'); setShowFormPiano(false);
      setWpTask(''); setWpPaziente(''); setWpStaff(''); setWpDataFine(''); setWpNote('');
      setWpPrestCats([]); setWpAssistCats([]); setWpGiorni(['lun','mar','mer','gio','ven']);
      loadPiani();
    } catch (err: any) { setError(err.response?.data?.message || 'Errore'); }
    finally { setWpLoading(false); }
  };

  const handleEliminaPiano = async (id: string) => {
    if (!window.confirm('Eliminare?')) return;
    try { await api.delete(`/workplan/${id}`); setSuccess('Eliminato'); loadPiani(); }
    catch (err: any) { setError(err.response?.data?.message || 'Errore'); }
  };

  const copiaLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/registrazione-accesso/${id}`);
    setCopiedId(id); setTimeout(() => setCopiedId(''), 2000);
  };

  const prelieviDelGiorno = useMemo(() => prelievi.filter(p => p.dataPrelievo?.startsWith(selectedDate)), [prelievi, selectedDate]);
  const esamiDelGiorno = useMemo(() => esami.filter(e => e.dataEsame?.startsWith(selectedDate)), [esami, selectedDate]);
  const daysWithPrelievi = useMemo(() => new Set(prelievi.map(p => p.dataPrelievo?.split('T')[0]).filter(Boolean) as string[]), [prelievi]);
  const daysWithEsami = useMemo(() => new Set(esami.map(e => e.dataEsame?.split('T')[0]).filter(Boolean) as string[]), [esami]);
  const filteredPiani = useMemo(() => piani.filter(p => p.type === pianiType && (!pianiSearch || `${p.patient?.firstName} ${p.patient?.lastName} ${p.task}`.toLowerCase().includes(pianiSearch.toLowerCase()))), [piani, pianiType, pianiSearch]);

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); };

  const iStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box' };
  const lStyle: React.CSSProperties = { display: 'block', fontWeight: '600', color: '#374151', marginBottom: '4px', fontSize: '0.9rem' };
  const toggleTipo = (arr: string[], val: string, set: (v: string[]) => void) => set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  const toggleCat = (arr: string[], val: string, set: (v: string[]) => void) => set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <Building2 size={28} color="#0284c7" />
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#1e3a5f' }}>Centro Prenotazioni — Convenzione SIAT</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>Gestione prelievi, esami e piani per pazienti in convenzione</p>
        </div>
      </div>

      {error && <div style={{ background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>⚠️ {error}<button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>✕</button></div>}
      {success && <div style={{ background: '#dcfce7', border: '1px solid #22c55e', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', color: '#15803d', display: 'flex', alignItems: 'center', gap: '8px' }}>✅ {success}<button onClick={() => setSuccess('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#15803d' }}>✕</button></div>}

      {/* Tab principale */}
      <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '12px', padding: '4px', marginBottom: '20px' }}>
        {([
          { key: 'prelievi', label: 'Prelievi', Icon: Syringe, color: '#dc2626' },
          { key: 'esami', label: 'Esami Strumentali', Icon: HeartPulse, color: '#7c3aed' },
          { key: 'piani', label: 'Piani Lavorativi', Icon: ClipboardList, color: '#0369a1' },
        ] as const).map(({ key, label, Icon, color }) => (
          <button key={key} onClick={() => setMainTab(key)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: mainTab === key ? 'white' : 'transparent', color: mainTab === key ? color : '#6b7280', boxShadow: mainTab === key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
            <Icon size={16} />{label}
          </button>
        ))}
      </div>

      {/* ══ TAB PRELIEVI ══ */}
      {mainTab === 'prelievi' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {(['prenotazioni','assegnazione'] as SubTab[]).map(t => (
              <button key={t} onClick={() => setPrelieviSubTab(t)} style={{ padding: '8px 18px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem', background: prelieviSubTab === t ? '#dc2626' : '#f3f4f6', color: prelieviSubTab === t ? 'white' : '#374151' }}>
                {t === 'prenotazioni' ? '📅 Prenotazioni' : '👤 Assegnazione'}
              </button>
            ))}
            {canEdit && <button onClick={() => setShowFormPrelievo(true)} style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: '20px', background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={16} />Nuovo Prelievo</button>}
          </div>
          {prelieviSubTab === 'prenotazioni' && (
            <>
              <CalendarioMese year={calYear} month={calMonth} onPrev={prevMonth} onNext={nextMonth} selectedDate={selectedDate} onSelectDate={setSelectedDate} daysWithDots={daysWithPrelievi} />
              <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#374151' }}><Calendar size={16} style={{ display: 'inline', marginRight: '6px' }} />{new Date(selectedDate + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}<span style={{ marginLeft: '8px', background: '#fee2e2', color: '#dc2626', borderRadius: '12px', padding: '2px 8px', fontSize: '0.8rem', fontWeight: '700' }}>{prelieviDelGiorno.length}</span></h3>
                {prelieviLoading ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>Caricamento…</p> : prelieviDelGiorno.length === 0 ? <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>Nessun prelievo per questo giorno</p> :
                  prelieviDelGiorno.map(p => (
                    <div key={p._id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '8px', background: '#f9fafb', marginBottom: '8px', border: '1px solid #f3f4f6' }}>
                      <Syringe size={18} color="#dc2626" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{p.patient ? `${p.patient.firstName} ${p.patient.lastName}` : '—'}</div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{p.tipoPrelievo ? (Array.isArray(p.tipoPrelievo) ? p.tipoPrelievo.join(', ') : p.tipoPrelievo) : 'N/D'}{p.orario ? ` · ${p.orario}` : ''}</div>
                        {p.staff && <div style={{ fontSize: '0.78rem', color: '#0369a1' }}>👤 {p.staff.firstName} {p.staff.lastName}</div>}
                      </div>
                      <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700', background: p.status === 'eseguito' ? '#dcfce7' : '#fff7ed', color: p.status === 'eseguito' ? '#15803d' : '#9a3412' }}>{p.status}</span>
                      {canEdit && <button onClick={() => handleEliminaPrelievo(p._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}><Trash2 size={16} /></button>}
                    </div>
                  ))}
              </div>
            </>
          )}
          {prelieviSubTab === 'assegnazione' && canEdit && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1rem', color: '#374151' }}>Assegna operatore a più prelievi</h3>
              <div style={{ marginBottom: '14px' }}><label style={lStyle}>Operatore</label><select value={operatoreAssPrelievo} onChange={e => setOperatoreAssPrelievo(e.target.value)} style={iStyle}><option value="">— Seleziona operatore —</option>{staff.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} ({s.role})</option>)}</select></div>
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {prelievi.filter(p => !p.staff).length === 0 ? <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>Tutti i prelievi sono già assegnati</p> :
                  prelievi.filter(p => !p.staff).map(p => (
                    <label key={p._id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: prelieviSelezionati.has(p._id) ? '#fef2f2' : '#f9fafb', marginBottom: '6px', cursor: 'pointer', border: `1px solid ${prelieviSelezionati.has(p._id) ? '#fca5a5' : '#f3f4f6'}` }}>
                      <input type="checkbox" checked={prelieviSelezionati.has(p._id)} onChange={e => { const s = new Set(prelieviSelezionati); e.target.checked ? s.add(p._id) : s.delete(p._id); setPrelieviSelezionati(s); }} />
                      <div style={{ flex: 1 }}><div style={{ fontWeight: '600', fontSize: '0.88rem' }}>{p.patient ? `${p.patient.firstName} ${p.patient.lastName}` : '—'}</div><div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{p.dataPrelievo?.split('T')[0]}{p.orario ? ` · ${p.orario}` : ''} · {p.tipoPrelievo ? (Array.isArray(p.tipoPrelievo) ? p.tipoPrelievo.join(', ') : p.tipoPrelievo) : 'N/D'}</div></div>
                    </label>
                  ))}
              </div>
              {prelieviSelezionati.size > 0 && <button onClick={handleAssegnaPrelievi} disabled={assPrelievoLoading} style={{ marginTop: '12px', width: '100%', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', padding: '12px', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: assPrelievoLoading ? 0.7 : 1 }}><UserCheck size={18} />Assegna {prelieviSelezionati.size} prelievi</button>}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB ESAMI ══ */}
      {mainTab === 'esami' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {(['prenotazioni','assegnazione'] as SubTab[]).map(t => (
              <button key={t} onClick={() => setEsamiSubTab(t)} style={{ padding: '8px 18px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem', background: esamiSubTab === t ? '#7c3aed' : '#f3f4f6', color: esamiSubTab === t ? 'white' : '#374151' }}>
                {t === 'prenotazioni' ? '📅 Prenotazioni' : '👤 Assegnazione'}
              </button>
            ))}
            {canEdit && <button onClick={() => setShowFormEsame(true)} style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: '20px', background: '#7c3aed', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={16} />Nuovo Esame</button>}
          </div>
          {esamiSubTab === 'prenotazioni' && (
            <>
              <CalendarioMese year={calYear} month={calMonth} onPrev={prevMonth} onNext={nextMonth} selectedDate={selectedDate} onSelectDate={setSelectedDate} daysWithDots={daysWithEsami} />
              <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#374151' }}><HeartPulse size={16} style={{ display: 'inline', marginRight: '6px' }} />{new Date(selectedDate + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}<span style={{ marginLeft: '8px', background: '#ede9fe', color: '#7c3aed', borderRadius: '12px', padding: '2px 8px', fontSize: '0.8rem', fontWeight: '700' }}>{esamiDelGiorno.length}</span></h3>
                {esamiLoading ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>Caricamento…</p> : esamiDelGiorno.length === 0 ? <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>Nessun esame per questo giorno</p> :
                  esamiDelGiorno.map(e => (
                    <div key={e._id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '8px', background: '#f9fafb', marginBottom: '8px', border: '1px solid #f3f4f6' }}>
                      <HeartPulse size={18} color="#7c3aed" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{e.patient ? `${e.patient.firstName} ${e.patient.lastName}` : '—'}</div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{e.tipoEsame ? (Array.isArray(e.tipoEsame) ? e.tipoEsame.join(', ') : e.tipoEsame) : 'N/D'}{e.orario ? ` · ${e.orario}` : ''}</div>
                        {e.staff && <div style={{ fontSize: '0.78rem', color: '#7c3aed' }}>👤 {e.staff.firstName} {e.staff.lastName}</div>}
                      </div>
                      <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700', background: e.status === 'eseguito' ? '#dcfce7' : '#ede9fe', color: e.status === 'eseguito' ? '#15803d' : '#7c3aed' }}>{e.status}</span>
                      {canEdit && <button onClick={() => handleEliminaEsame(e._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}><Trash2 size={16} /></button>}
                    </div>
                  ))}
              </div>
            </>
          )}
          {esamiSubTab === 'assegnazione' && canEdit && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '1rem', color: '#374151' }}>Assegna operatore a più esami</h3>
              <div style={{ marginBottom: '14px' }}><label style={lStyle}>Operatore</label><select value={operatoreAssEsame} onChange={e => setOperatoreAssEsame(e.target.value)} style={iStyle}><option value="">— Seleziona operatore —</option>{staff.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} ({s.role})</option>)}</select></div>
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {esami.filter(e => !e.staff).length === 0 ? <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>Tutti gli esami sono già assegnati</p> :
                  esami.filter(e => !e.staff).map(e => (
                    <label key={e._id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: esamiSelezionati.has(e._id) ? '#f5f3ff' : '#f9fafb', marginBottom: '6px', cursor: 'pointer', border: `1px solid ${esamiSelezionati.has(e._id) ? '#c4b5fd' : '#f3f4f6'}` }}>
                      <input type="checkbox" checked={esamiSelezionati.has(e._id)} onChange={ev => { const s = new Set(esamiSelezionati); ev.target.checked ? s.add(e._id) : s.delete(e._id); setEsamiSelezionati(s); }} />
                      <div style={{ flex: 1 }}><div style={{ fontWeight: '600', fontSize: '0.88rem' }}>{e.patient ? `${e.patient.firstName} ${e.patient.lastName}` : '—'}</div><div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{e.dataEsame?.split('T')[0]}{e.orario ? ` · ${e.orario}` : ''} · {e.tipoEsame ? (Array.isArray(e.tipoEsame) ? e.tipoEsame.join(', ') : e.tipoEsame) : 'N/D'}</div></div>
                    </label>
                  ))}
              </div>
              {esamiSelezionati.size > 0 && <button onClick={handleAssegnaEsami} disabled={assEsameLoading} style={{ marginTop: '12px', width: '100%', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', padding: '12px', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: assEsameLoading ? 0.7 : 1 }}><UserCheck size={18} />Assegna {esamiSelezionati.size} esami</button>}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB PIANI ══ */}
      {mainTab === 'piani' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => setPianiType('prestazionale')} style={{ padding: '8px 18px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem', background: pianiType === 'prestazionale' ? '#0369a1' : '#f3f4f6', color: pianiType === 'prestazionale' ? 'white' : '#374151' }}>🏥 Prestazionale</button>
            <button onClick={() => setPianiType('assistenziale')} style={{ padding: '8px 18px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem', background: pianiType === 'assistenziale' ? '#0369a1' : '#f3f4f6', color: pianiType === 'assistenziale' ? 'white' : '#374151' }}>🤝 Assistenziale</button>
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input value={pianiSearch} onChange={e => setPianiSearch(e.target.value)} placeholder="Cerca paziente o attività…" style={{ ...iStyle, paddingLeft: '32px' }} />
            </div>
            {canEdit && <button onClick={() => setShowFormPiano(true)} style={{ padding: '8px 16px', borderRadius: '20px', background: '#0369a1', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={16} />Nuovo Piano</button>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pianiLoading ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>Caricamento…</p> : filteredPiani.length === 0 ? <p style={{ color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>Nessun piano trovato</p> :
              filteredPiani.map(p => (
                <div key={p._id} style={{ background: 'white', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <ClipboardList size={20} color="#0369a1" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.task}</div>
                    <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>{p.patient ? `${p.patient.firstName} ${p.patient.lastName}` : '—'}{p.dataInizio ? ` · dal ${new Date(p.dataInizio).toLocaleDateString('it-IT')}` : ''}</div>
                    {p.staff && <div style={{ fontSize: '0.78rem', color: '#0369a1' }}>👤 {p.staff.firstName} {p.staff.lastName}</div>}
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700', flexShrink: 0, background: p.status === 'attivo' ? '#dcfce7' : p.status === 'completato' ? '#dbeafe' : '#f3f4f6', color: p.status === 'attivo' ? '#15803d' : p.status === 'completato' ? '#1d4ed8' : '#374151' }}>{p.status}</span>
                  <button onClick={() => navigate(`/workplan`)} title="Dettaglio" style={{ background: '#f3f4f6', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#374151', flexShrink: 0 }}><Eye size={15} />Dettaglio</button>
                  <button onClick={() => copiaLink(p._id)} title="Copia link accesso" style={{ background: copiedId === p._id ? '#dcfce7' : '#f3f4f6', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: copiedId === p._id ? '#15803d' : '#374151', flexShrink: 0 }}><Copy size={15} />{copiedId === p._id ? 'Copiato!' : 'Link'}</button>
                  {canEdit && <button onClick={() => handleEliminaPiano(p._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px', flexShrink: 0 }}><Trash2 size={16} /></button>}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ══ MODAL FORM PRELIEVO ══ */}
      {showFormPrelievo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#1e3a5f', display: 'flex', alignItems: 'center', gap: '8px' }}><Syringe size={20} color="#dc2626" />Nuovo Prelievo</h2>
              <button onClick={() => setShowFormPrelievo(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={22} /></button>
            </div>
            <form onSubmit={handleCreaPrelievo} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div><label style={lStyle}>Paziente *</label><select value={fpPaziente} onChange={e => setFpPaziente(e.target.value)} required style={iStyle}><option value="">— Seleziona paziente convenzione —</option>{pazienti.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}</select></div>
              <div><label style={lStyle}>Operatore</label><select value={fpStaff} onChange={e => setFpStaff(e.target.value)} style={iStyle}><option value="">— Non assegnato —</option>{staff.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} ({s.role})</option>)}</select></div>
              <div><label style={lStyle}>Tipo prelievo *</label><div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>{TIPI_PRELIEVO.map(t => <button key={t} type="button" onClick={() => toggleTipo(fpTipi, t, setFpTipi)} style={{ padding: '4px 10px', borderRadius: '12px', border: `1.5px solid ${fpTipi.includes(t) ? '#dc2626' : '#d1d5db'}`, background: fpTipi.includes(t) ? '#fee2e2' : 'white', color: fpTipi.includes(t) ? '#dc2626' : '#374151', fontWeight: fpTipi.includes(t) ? '700' : '400', fontSize: '0.82rem', cursor: 'pointer' }}>{t}</button>)}</div></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={lStyle}>Data *</label><input type="date" value={fpData} onChange={e => setFpData(e.target.value)} required style={iStyle} /></div>
                <div><label style={lStyle}>Orario</label><input type="time" value={fpOrario} onChange={e => setFpOrario(e.target.value)} style={iStyle} /></div>
              </div>
              <div><label style={lStyle}>Note</label><textarea value={fpNote} onChange={e => setFpNote(e.target.value)} rows={2} style={{ ...iStyle, resize: 'vertical' }} /></div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setShowFormPrelievo(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontWeight: '600', color: '#374151' }}>Annulla</button>
                <button type="submit" disabled={fpLoading} style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer', fontWeight: '700', opacity: fpLoading ? 0.7 : 1 }}>{fpLoading ? 'Salvataggio…' : 'Crea Prelievo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL FORM ESAME ══ */}
      {showFormEsame && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#1e3a5f', display: 'flex', alignItems: 'center', gap: '8px' }}><HeartPulse size={20} color="#7c3aed" />Nuovo Esame Strumentale</h2>
              <button onClick={() => setShowFormEsame(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={22} /></button>
            </div>
            <form onSubmit={handleCreaEsame} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div><label style={lStyle}>Paziente *</label><select value={fePaziente} onChange={e => setFePaziente(e.target.value)} required style={iStyle}><option value="">— Seleziona paziente convenzione —</option>{pazienti.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}</select></div>
              <div><label style={lStyle}>Operatore</label><select value={feStaff} onChange={e => setFeStaff(e.target.value)} style={iStyle}><option value="">— Non assegnato —</option>{staff.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} ({s.role})</option>)}</select></div>
              <div><label style={lStyle}>Tipo esame *</label><div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>{TIPI_ESAME.map(t => <button key={t} type="button" onClick={() => toggleTipo(feTipi, t, setFeTipi)} style={{ padding: '4px 10px', borderRadius: '12px', border: `1.5px solid ${feTipi.includes(t) ? '#7c3aed' : '#d1d5db'}`, background: feTipi.includes(t) ? '#ede9fe' : 'white', color: feTipi.includes(t) ? '#7c3aed' : '#374151', fontWeight: feTipi.includes(t) ? '700' : '400', fontSize: '0.82rem', cursor: 'pointer' }}>{t}</button>)}</div></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={lStyle}>Data *</label><input type="date" value={feData} onChange={e => setFeData(e.target.value)} required style={iStyle} /></div>
                <div><label style={lStyle}>Orario</label><input type="time" value={feOrario} onChange={e => setFeOrario(e.target.value)} style={iStyle} /></div>
              </div>
              <div><label style={lStyle}>Note</label><textarea value={feNote} onChange={e => setFeNote(e.target.value)} rows={2} style={{ ...iStyle, resize: 'vertical' }} /></div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setShowFormEsame(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontWeight: '600', color: '#374151' }}>Annulla</button>
                <button type="submit" disabled={feLoading} style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer', fontWeight: '700', opacity: feLoading ? 0.7 : 1 }}>{feLoading ? 'Salvataggio…' : 'Crea Esame'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL FORM PIANO ══ */}
      {showFormPiano && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#1e3a5f', display: 'flex', alignItems: 'center', gap: '8px' }}><ClipboardList size={20} color="#0369a1" />Nuovo Piano Lavorativo</h2>
              <button onClick={() => setShowFormPiano(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={22} /></button>
            </div>
            <form onSubmit={handleCreaPiano} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div><label style={lStyle}>Tipo *</label><div style={{ display: 'flex', gap: '8px' }}><button type="button" onClick={() => setWpType('prestazionale')} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `2px solid ${wpType === 'prestazionale' ? '#0369a1' : '#d1d5db'}`, background: wpType === 'prestazionale' ? '#eff6ff' : 'white', color: wpType === 'prestazionale' ? '#0369a1' : '#374151', fontWeight: '600', cursor: 'pointer' }}>🏥 Prestazionale</button><button type="button" onClick={() => setWpType('assistenziale')} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `2px solid ${wpType === 'assistenziale' ? '#0369a1' : '#d1d5db'}`, background: wpType === 'assistenziale' ? '#eff6ff' : 'white', color: wpType === 'assistenziale' ? '#0369a1' : '#374151', fontWeight: '600', cursor: 'pointer' }}>🤝 Assistenziale</button></div></div>
              <div><label style={lStyle}>Descrizione attività *</label><textarea value={wpTask} onChange={e => setWpTask(e.target.value)} required rows={2} placeholder="Es. Medicazione avanzata + misurazione parametri" style={{ ...iStyle, resize: 'vertical' }} /></div>
              <div><label style={lStyle}>Paziente convenzione *</label><select value={wpPaziente} onChange={e => setWpPaziente(e.target.value)} required style={iStyle}><option value="">— Seleziona paziente —</option>{pazienti.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}</select></div>
              <div><label style={lStyle}>Operatore</label><select value={wpStaff} onChange={e => setWpStaff(e.target.value)} style={iStyle}><option value="">— Non assegnato —</option>{staff.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} ({s.role})</option>)}</select></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={lStyle}>Data inizio</label><input type="date" value={wpDataInizio} onChange={e => setWpDataInizio(e.target.value)} style={iStyle} /></div>
                <div><label style={lStyle}>Data fine</label><input type="date" value={wpDataFine} onChange={e => setWpDataFine(e.target.value)} style={iStyle} /></div>
              </div>
              {wpType === 'prestazionale' && <div><label style={lStyle}>Categorie</label><div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{PREST_CATS.map(c => <button key={c.value} type="button" onClick={() => toggleCat(wpPrestCats, c.value, setWpPrestCats)} style={{ padding: '5px 12px', borderRadius: '12px', border: `1.5px solid ${wpPrestCats.includes(c.value) ? c.color : '#d1d5db'}`, background: wpPrestCats.includes(c.value) ? c.color + '22' : 'white', color: wpPrestCats.includes(c.value) ? c.color : '#374151', fontWeight: wpPrestCats.includes(c.value) ? '700' : '400', fontSize: '0.82rem', cursor: 'pointer' }}>{c.label}</button>)}</div></div>}
              {wpType === 'assistenziale' && <div><label style={lStyle}>Categorie</label><div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{ASSIST_CATS.map(c => <button key={c.value} type="button" onClick={() => toggleCat(wpAssistCats, c.value, setWpAssistCats)} style={{ padding: '5px 12px', borderRadius: '12px', border: `1.5px solid ${wpAssistCats.includes(c.value) ? c.color : '#d1d5db'}`, background: wpAssistCats.includes(c.value) ? c.color + '22' : 'white', color: wpAssistCats.includes(c.value) ? c.color : '#374151', fontWeight: wpAssistCats.includes(c.value) ? '700' : '400', fontSize: '0.82rem', cursor: 'pointer' }}>{c.label}</button>)}</div></div>}
              <div><label style={lStyle}>Giorni ricorrenti</label><div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{GIORNI_DEFAULT.map(g => <button key={g.key} type="button" onClick={() => toggleCat(wpGiorni, g.key, setWpGiorni)} style={{ width: '36px', height: '36px', borderRadius: '50%', border: `2px solid ${wpGiorni.includes(g.key) ? '#0369a1' : '#d1d5db'}`, background: wpGiorni.includes(g.key) ? '#0369a1' : 'white', color: wpGiorni.includes(g.key) ? 'white' : '#374151', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}>{g.label}</button>)}</div></div>
              <div><label style={lStyle}>Note</label><textarea value={wpNote} onChange={e => setWpNote(e.target.value)} rows={2} style={{ ...iStyle, resize: 'vertical' }} /></div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setShowFormPiano(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontWeight: '600', color: '#374151' }}>Annulla</button>
                <button type="submit" disabled={wpLoading} style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', background: '#0369a1', color: 'white', cursor: 'pointer', fontWeight: '700', opacity: wpLoading ? 0.7 : 1 }}>{wpLoading ? 'Salvataggio…' : 'Crea Piano'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
