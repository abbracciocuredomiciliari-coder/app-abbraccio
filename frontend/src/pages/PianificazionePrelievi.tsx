import { useEffect, useState, useMemo } from 'react';
import api from '../api/api';
import { useModalita } from '../context/ModalitaContext';
import {
  ChevronLeft, ChevronRight, Plus, X, Calendar, Clock, User, Syringe,
  CheckCircle, Trash2, ChevronDown, ChevronUp, FileText, Building2
} from 'lucide-react';

// ─── Interfacce ───────────────────────────────────────────────────────────────
interface Paziente {
  _id: string;
  firstName: string;
  lastName: string;
  tipoGestione?: string;
  siat?: { asl?: string; npi?: string };
}

interface StaffMember {
  _id: string;
  firstName: string;
  lastName: string;
  role: string;
  active: boolean;
}

interface DiariaEntry {
  _id: string;
  autore: string;
  ruoloAutore?: string;
  testo: string;
  data: string;
  firmato: boolean;
  dataFirma?: string;
}

interface Prelievo {
  _id: string;
  patient: Paziente;
  staff: { _id: string; firstName: string; lastName: string; role: string };
  dataPrelievo: string;
  orario?: string;
  tipoPrelievo: string;
  note?: string;
  status: 'pianificato' | 'eseguito' | 'annullato';
  tipoGestione: 'privato' | 'convenzione';
  dataEsecuzione?: string;
  eseguitoDa?: string;
  noteEsecuzione?: string;
  diaria: DiariaEntry[];
  allegati: any[];
}

const TIPI_PRELIEVO = [
  'Emocromo completo', 'Glicemia', 'Coagulazione (PT/INR/aPTT)', 'Elettroliti',
  'Funzionalità epatica', 'Funzionalità renale (creatinina/azoto)', 'Profilo lipidico',
  'Ormoni tiroidei (TSH/fT4)', 'PCR / VES', 'Esame urine', 'Emogasanalisi',
  'Altro (specificare nelle note)',
];

// ─── Helpers calendario ────────────────────────────────────────────────────────
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  // 0=Dom → convertiamo in 0=Lun
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}
function toISODate(d: Date) {
  return d.toISOString().split('T')[0];
}
const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
              'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const GIORNI = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

// ─── Componente principale ────────────────────────────────────────────────────
export default function PianificazionePrelievi() {
  const { isConvenzione, modalita } = useModalita();

  const oggi = new Date();
  const [annoCorrente, setAnnoCorrente] = useState(oggi.getFullYear());
  const [meseCorrente, setMeseCorrente] = useState(oggi.getMonth());
  const [giornoSelezionato, setGiornoSelezionato] = useState(toISODate(oggi));

  const [prelievi, setPrelievi] = useState<Prelievo[]>([]);
  const [pazienti, setPazienti] = useState<Paziente[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Form nuovo prelievo
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    patient: '',
    staff: '',
    dataPrelievo: giornoSelezionato,
    orario: '',
    tipoPrelievo: '',
    note: '',
  });
  const [salvando, setSalvando] = useState(false);

  // Dettaglio prelievo aperto
  const [prelievoAperto, setPrelievoAperto] = useState<Prelievo | null>(null);
  const [testoDiaria, setTestoDiaria] = useState('');
  const [salvandoDiaria, setSalvandoDiaria] = useState(false);
  const [diariaEspansa, setDiariaEspansa] = useState(false);

  // ─── Caricamento dati ──────────────────────────────────────────────────────
  const caricaPrelievi = async () => {
    try {
      const res = await api.get('/prelievi', {
        params: { tipoGestione: modalita },
      });
      setPrelievi(res.data);
    } catch { /* noop */ }
  };

  useEffect(() => {
    const caricaTutto = async () => {
      setLoading(true);
      try {
        const [pazRes, staffRes] = await Promise.all([
          api.get('/patients'),
          api.get('/staff', { params: { active: true } }),
        ]);
        const filtrati = pazRes.data.filter((p: Paziente) =>
          isConvenzione ? p.tipoGestione === 'convenzione' : (p.tipoGestione === 'privato' || !p.tipoGestione)
        );
        setPazienti(filtrati);
        setStaff(staffRes.data.filter((s: StaffMember) => s.active));
      } catch { /* noop */ }
      await caricaPrelievi();
      setLoading(false);
    };
    caricaTutto();
  }, [modalita]);

  // ─── Prelievi per giorno (calendario) ─────────────────────────────────────
  const prelieviPerGiorno = useMemo(() => {
    const map = new Map<string, Prelievo[]>();
    prelievi.forEach(p => {
      const k = toISODate(new Date(p.dataPrelievo));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    });
    return map;
  }, [prelievi]);

  const prelieviGiornoSelezionato = useMemo(
    () => (prelieviPerGiorno.get(giornoSelezionato) || []).sort((a, b) => (a.orario || '').localeCompare(b.orario || '')),
    [prelieviPerGiorno, giornoSelezionato]
  );

  // ─── Navigazione calendario ────────────────────────────────────────────────
  const mesePrecedente = () => {
    if (meseCorrente === 0) { setMeseCorrente(11); setAnnoCorrente(a => a - 1); }
    else setMeseCorrente(m => m - 1);
  };
  const meseSuccessivo = () => {
    if (meseCorrente === 11) { setMeseCorrente(0); setAnnoCorrente(a => a + 1); }
    else setMeseCorrente(m => m + 1);
  };

  // ─── Crea prelievo ─────────────────────────────────────────────────────────
  const creaPrelievo = async () => {
    if (!form.patient || !form.staff || !form.tipoPrelievo) return;
    setSalvando(true);
    try {
      await api.post('/prelievi', { ...form });
      setShowForm(false);
      setForm({ patient: '', staff: '', dataPrelievo: giornoSelezionato, orario: '', tipoPrelievo: '', note: '' });
      await caricaPrelievi();
    } catch { /* noop */ }
    setSalvando(false);
  };

  // ─── Elimina prelievo ──────────────────────────────────────────────────────
  const eliminaPrelievo = async (id: string) => {
    if (!confirm('Eliminare questo prelievo?')) return;
    try {
      await api.delete(`/prelievi/${id}`);
      if (prelievoAperto?._id === id) setPrelievoAperto(null);
      await caricaPrelievi();
    } catch { /* noop */ }
  };

  // ─── Aggiungi diaria ───────────────────────────────────────────────────────
  const aggiungiDiaria = async () => {
    if (!prelievoAperto || !testoDiaria.trim()) return;
    setSalvandoDiaria(true);
    try {
      await api.post(`/prelievi/${prelievoAperto._id}/diaria`, { testo: testoDiaria });
      setTestoDiaria('');
      const res = await api.get(`/prelievi/${prelievoAperto._id}`);
      setPrelievoAperto(res.data);
      await caricaPrelievi();
    } catch { /* noop */ }
    setSalvandoDiaria(false);
  };

  // ─── Build celle calendario ────────────────────────────────────────────────
  const numeroCelle = getDaysInMonth(annoCorrente, meseCorrente);
  const primoGiorno = getFirstDayOfMonth(annoCorrente, meseCorrente);
  const celle = Array.from({ length: primoGiorno + numeroCelle }, (_, i) => {
    if (i < primoGiorno) return null;
    return i - primoGiorno + 1;
  });

  // ─── UI ────────────────────────────────────────────────────────────────────
  if (loading) return <section><p>Caricamento...</p></section>;

  const coloreModalita = isConvenzione ? '#0369a1' : '#1e4d8c';
  const badgeModalita = isConvenzione
    ? <span style={{ background: '#eff6ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '6px', padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700 }}><Building2 size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Convenzione SIAT</span>
    : <span style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700 }}>👤 Privati</span>;

  return (
    <section className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px', color: coloreModalita }}>
            <Syringe size={28} />
            Pianificazione Prelievi
          </h1>
          <div style={{ marginTop: '6px' }}>{badgeModalita}</div>
        </div>
        <button
          onClick={() => { setForm(f => ({ ...f, dataPrelievo: giornoSelezionato })); setShowForm(true); }}
          style={{ background: coloreModalita, color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
        >
          <Plus size={18} />Nuovo Prelievo
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>

        {/* ═══ CALENDARIO ════════════════════════════════════════════════════ */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
          {/* Navigazione mese */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <button onClick={mesePrecedente} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}>
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>
              {MESI[meseCorrente]} {annoCorrente}
            </span>
            <button onClick={meseSuccessivo} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}>
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Intestazioni giorni */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
            {GIORNI.map(g => (
              <div key={g} style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', padding: '4px 0' }}>{g}</div>
            ))}
          </div>

          {/* Celle */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {celle.map((giorno, idx) => {
              if (!giorno) return <div key={`empty-${idx}`} />;
              const iso = `${annoCorrente}-${String(meseCorrente + 1).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
              const numPrelievi = prelieviPerGiorno.get(iso)?.length || 0;
              const isOggi = iso === toISODate(new Date());
              const isSelezionato = iso === giornoSelezionato;
              return (
                <button
                  key={iso}
                  onClick={() => setGiornoSelezionato(iso)}
                  style={{
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 4px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    background: isSelezionato ? coloreModalita : isOggi ? '#f1f5f9' : 'transparent',
                    color: isSelezionato ? 'white' : isOggi ? coloreModalita : '#374151',
                    fontWeight: isOggi || isSelezionato ? 700 : 400,
                    position: 'relative',
                    minHeight: '42px',
                  }}
                >
                  <div style={{ fontSize: '0.85rem' }}>{giorno}</div>
                  {numPrelievi > 0 && (
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '50%',
                      background: isSelezionato ? 'rgba(255,255,255,0.35)' : coloreModalita,
                      color: isSelezionato ? 'white' : 'white',
                      fontSize: '0.65rem', fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '2px auto 0',
                    }}>{numPrelievi}</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ LISTA GIORNALIERA ═════════════════════════════════════════════ */}
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#374151', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} style={{ color: coloreModalita }} />
            {new Date(giornoSelezionato + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
            <span style={{ background: '#f1f5f9', borderRadius: '12px', padding: '2px 10px', fontSize: '0.8rem', color: '#64748b' }}>
              {prelieviGiornoSelezionato.length} prelievi
            </span>
          </div>

          {prelieviGiornoSelezionato.length === 0 ? (
            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '32px', textAlign: 'center', border: '1px dashed #cbd5e1' }}>
              <Syringe size={32} style={{ color: '#cbd5e1', marginBottom: '8px' }} />
              <p style={{ color: '#94a3b8', margin: 0 }}>Nessun prelievo pianificato</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {prelieviGiornoSelezionato.map(p => (
                <div key={p._id} style={{
                  background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0',
                  borderLeft: `4px solid ${p.status === 'eseguito' ? '#059669' : p.status === 'annullato' ? '#dc2626' : coloreModalita}`,
                  overflow: 'hidden',
                }}>
                  <div
                    onClick={() => setPrelievoAperto(prelievoAperto?._id === p._id ? null : p)}
                    style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {p.orario && <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}><Clock size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />{p.orario}</span>}
                        {p.patient.firstName} {p.patient.lastName}
                        <span style={{
                          padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700,
                          background: p.status === 'eseguito' ? '#f0fdf4' : p.status === 'annullato' ? '#fef2f2' : '#eff6ff',
                          color: p.status === 'eseguito' ? '#059669' : p.status === 'annullato' ? '#dc2626' : coloreModalita,
                        }}>
                          {p.status === 'eseguito' ? '✅ Eseguito' : p.status === 'annullato' ? '❌ Annullato' : '🔵 Pianificato'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.83rem', color: '#64748b', marginTop: '4px' }}>
                        💉 {p.tipoPrelievo} · 👤 {p.staff.firstName} {p.staff.lastName}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); eliminaPrelievo(p._id); }}
                        style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#dc2626' }}
                      ><Trash2 size={14} /></button>
                      {prelievoAperto?._id === p._id ? <ChevronUp size={16} style={{ color: '#94a3b8' }} /> : <ChevronDown size={16} style={{ color: '#94a3b8' }} />}
                    </div>
                  </div>

                  {/* Dettaglio espanso */}
                  {prelievoAperto?._id === p._id && (
                    <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px' }}>
                      {p.note && <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '12px' }}>📝 {p.note}</p>}
                      {p.status === 'eseguito' && (
                        <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '0.85rem', color: '#166534' }}>
                          ✅ Eseguito da <strong>{p.eseguitoDa}</strong> il {new Date(p.dataEsecuzione!).toLocaleDateString('it-IT')}
                          {p.noteEsecuzione && <div style={{ marginTop: '4px', color: '#374151' }}>{p.noteEsecuzione}</div>}
                        </div>
                      )}

                      {/* Diaria */}
                      <div>
                        <button onClick={() => setDiariaEspansa(!diariaEspansa)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 0 8px' }}>
                          <FileText size={16} />
                          Diaria Clinica ({p.diaria.length})
                          {diariaEspansa ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        {diariaEspansa && (
                          <div>
                            {p.diaria.length === 0 && <p style={{ fontSize: '0.83rem', color: '#94a3b8' }}>Nessuna voce</p>}
                            {p.diaria.map(d => (
                              <div key={d._id} style={{ background: '#f8fafc', borderRadius: '6px', padding: '8px 10px', marginBottom: '6px', fontSize: '0.83rem' }}>
                                <div style={{ fontWeight: 600, color: '#374151' }}>{d.autore} · {new Date(d.data).toLocaleString('it-IT')}</div>
                                <div style={{ color: '#475569', marginTop: '2px' }}>{d.testo}</div>
                              </div>
                            ))}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                              <textarea
                                value={testoDiaria}
                                onChange={e => setTestoDiaria(e.target.value)}
                                placeholder="Aggiungi nota clinica..."
                                rows={2}
                                style={{ flex: 1, borderRadius: '6px', border: '1px solid #d1d5db', padding: '8px', fontSize: '0.85rem', resize: 'vertical' }}
                              />
                              <button
                                onClick={aggiungiDiaria}
                                disabled={salvandoDiaria || !testoDiaria.trim()}
                                style={{ background: coloreModalita, color: 'white', border: 'none', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', fontWeight: 600, alignSelf: 'flex-end' }}
                              >
                                {salvandoDiaria ? '...' : 'Salva'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ FORM NUOVO PRELIEVO ════════════════════════════════════════════ */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: coloreModalita }}>
                <Syringe size={20} />Nuovo Prelievo — {isConvenzione ? 'Convenzione SIAT' : 'Privato'}
              </h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gap: '14px' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                Paziente *
                <select
                  value={form.patient}
                  onChange={e => setForm(f => ({ ...f, patient: e.target.value }))}
                  style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                >
                  <option value="">Seleziona paziente...</option>
                  {pazienti.map(p => (
                    <option key={p._id} value={p._id}>{p.firstName} {p.lastName}{p.siat?.asl ? ` — ${p.siat.asl}` : ''}</option>
                  ))}
                </select>
              </label>

              <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                Operatore incaricato *
                <select
                  value={form.staff}
                  onChange={e => setForm(f => ({ ...f, staff: e.target.value }))}
                  style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                >
                  <option value="">Seleziona operatore...</option>
                  {staff.map(s => (
                    <option key={s._id} value={s._id}>{s.firstName} {s.lastName} — {s.role}</option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  Data *
                  <input
                    type="date"
                    value={form.dataPrelievo}
                    onChange={e => setForm(f => ({ ...f, dataPrelievo: e.target.value }))}
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  />
                </label>
                <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  Orario
                  <input
                    type="time"
                    value={form.orario}
                    onChange={e => setForm(f => ({ ...f, orario: e.target.value }))}
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  />
                </label>
              </div>

              <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                Tipo prelievo *
                <select
                  value={form.tipoPrelievo}
                  onChange={e => setForm(f => ({ ...f, tipoPrelievo: e.target.value }))}
                  style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                >
                  <option value="">Seleziona tipo...</option>
                  {TIPI_PRELIEVO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                Note
                <textarea
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  rows={2}
                  placeholder="Istruzioni, preparazione paziente..."
                  style={{ display: 'block', width: '100%', marginTop: '4px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', resize: 'vertical' }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>
                Annulla
              </button>
              <button
                onClick={creaPrelievo}
                disabled={salvando || !form.patient || !form.staff || !form.tipoPrelievo}
                style={{ padding: '10px 20px', borderRadius: '8px', background: coloreModalita, color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {salvando ? '...' : <><CheckCircle size={16} />Salva Prelievo</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
