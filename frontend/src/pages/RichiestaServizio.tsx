import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Syringe, HeartPulse, Activity, CheckCircle, ChevronLeft, ChevronRight, Send } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y: number, m: number) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }
function toISO(d: Date) { return d.toISOString().split('T')[0]; }
const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const GIORNI_SETT = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

const TIPI_SERVIZIO = [
  { value: 'prelievo', label: 'Prelievo', emoji: '💉', color: '#dc2626', bg: '#fee2e2', Icon: Syringe,
    tipi: ['Emocromo completo','Glicemia','Coagulazione (PT/INR/aPTT)','Elettroliti','Funzionalità epatica','Funzionalità renale','Profilo lipidico','Ormoni tiroidei (TSH/fT4)','PCR / VES','Esame urine','Emogasanalisi','Altro'] },
  { value: 'esame_strumentale', label: 'Esame Strumentale', emoji: '🔬', color: '#7c3aed', bg: '#ede9fe', Icon: HeartPulse,
    tipi: ['ECG','Holter ECG','Holter pressorio','Glicemia capillare','EGA','Spirometria','Ecocardiogramma','Polisonnografia','Titolazione CPAP','Altro'] },
  { value: 'prestazione', label: 'Prestazione Infermieristica', emoji: '🏥', color: '#0369a1', bg: '#eff6ff', Icon: Activity,
    tipi: ['Medicazione','Somministrazione farmaci','Misurazione parametri vitali','Cateterismo','Gestione stomia','Prelievo arterioso','Altro'] },
];

const PRIORITA = [
  { value: 'normale', label: 'Normale', color: '#6b7280' },
  { value: 'urgente', label: 'Urgente ⚡', color: '#f59e0b' },
  { value: 'molto_urgente', label: 'Molto urgente 🔴', color: '#dc2626' },
];

function Calendario({ year, month, onPrev, onNext, selectedDate, onSelectDate }: {
  year: number; month: number; onPrev: () => void; onNext: () => void;
  selectedDate: string; onSelectDate: (d: string) => void;
}) {
  const days = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const todayStr = toISO(new Date());
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  return (
    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <button type="button" onClick={onPrev} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', fontSize: '1.1rem' }}><ChevronLeft size={18} /></button>
        <span style={{ fontWeight: '700', fontSize: '0.95rem', color: '#1e3a5f' }}>{MESI[month]} {year}</span>
        <button type="button" onClick={onNext} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', fontSize: '1.1rem' }}><ChevronRight size={18} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px', textAlign: 'center' }}>
        {GIORNI_SETT.map(g => <div key={g} style={{ fontSize: '0.68rem', fontWeight: '700', color: '#9ca3af', padding: '3px 0' }}>{g}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const iso = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const isSel = iso === selectedDate;
          const isToday = iso === todayStr;
          const isPast = iso < todayStr;
          return (
            <div key={iso} onClick={() => !isPast && onSelectDate(iso)}
              style={{ padding: '6px 2px', borderRadius: '7px', cursor: isPast ? 'default' : 'pointer',
                background: isSel ? '#1e3a5f' : isToday ? '#dbeafe' : 'transparent',
                color: isSel ? 'white' : isPast ? '#d1d5db' : isToday ? '#1e40af' : '#374151',
                fontWeight: isSel || isToday ? '700' : '400', fontSize: '0.85rem' }}>
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RichiestaServizio() {
  const today = toISO(new Date());
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [inviata, setInviata] = useState(false);

  // Step 1 — tipo servizio
  const [tipoServizio, setTipoServizio] = useState('');
  const [tipoSpecifico, setTipoSpecifico] = useState('');

  // Step 2 — data e dati paziente
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState('');
  const [orarioPref, setOrarioPref] = useState('');
  const [dataAlt, setDataAlt] = useState('');
  const [pazienteNome, setPazienteNome] = useState('');
  const [pazienteIndirizzo, setPazienteIndirizzo] = useState('');
  const [pazienteTelefono, setPazienteTelefono] = useState('');
  const [priorita, setPriorita] = useState('normale');
  const [note, setNote] = useState('');

  // Step 3 — dati richiedente
  const [richiedenteNome, setRichiedenteNome] = useState('');
  const [richiedenteEmail, setRichiedenteEmail] = useState('');
  const [richiedenteTelefono, setRichiedenteTelefono] = useState('');

  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const tipoInfo = TIPI_SERVIZIO.find(t => t.value === tipoServizio);
  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); } else setCalMonth(m => m-1); };
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); } else setCalMonth(m => m+1); };

  const iStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box', marginTop: '4px' };
  const labelStyle: React.CSSProperties = { display: 'block', fontWeight: '600', color: '#374151', fontSize: '0.88rem' };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!richiedenteNome) { setError('Inserire il proprio nome'); return; }
    setSending(true); setError('');
    try {
      await axios.post(`${API_BASE}/richieste-prenotazioni/pubblica`, {
        richiedenteNome, richiedenteEmail, richiedenteTelefono,
        pazienteNome, pazienteIndirizzo, pazienteTelefono,
        tipoServizio, tipoSpecifico: tipoSpecifico || undefined,
        dataPreferita: selectedDate, orarioPreferito: orarioPref || undefined,
        dataAlternativa: dataAlt || undefined,
        priorita, noteRichiedente: note || undefined,
      });
      setInviata(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore durante l\'invio. Riprova.');
    } finally { setSending(false); }
  };

  if (inviata) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: 'white', borderRadius: '20px', padding: '48px 36px', maxWidth: '480px', width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          <div style={{ width: '72px', height: '72px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle size={40} color="#15803d" />
          </div>
          <h2 style={{ margin: '0 0 12px', color: '#15803d', fontSize: '1.4rem' }}>Richiesta inviata!</h2>
          <p style={{ color: '#6b7280', lineHeight: 1.6, margin: '0 0 24px' }}>
            La tua richiesta è stata ricevuta. Il nostro staff la elaborerà al più presto e ti contatteremo per confermare l'appuntamento.
          </p>
          <Link to="/login" style={{ display: 'inline-block', background: '#1e3a5f', color: 'white', padding: '12px 28px', borderRadius: '10px', textDecoration: 'none', fontWeight: '700' }}>
            Torna alla pagina iniziale
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)', padding: '30px 16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '2.2rem', marginBottom: '6px' }}>🏥</div>
          <h1 style={{ margin: '0 0 6px', color: 'white', fontSize: '1.6rem', fontWeight: '800' }}>Abbracciare — Cure Domiciliari</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: '0.95rem' }}>Richiesta di servizio a domicilio</p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
          {[1,2,3].map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.9rem',
                background: step >= s ? 'white' : 'rgba(255,255,255,0.2)',
                color: step >= s ? '#1e3a5f' : 'rgba(255,255,255,0.5)' }}>
                {step > s ? '✓' : s}
              </div>
              {s < 3 && <div style={{ width: '40px', height: '2px', background: step > s ? 'white' : 'rgba(255,255,255,0.25)', borderRadius: '1px' }} />}
            </div>
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '28px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>

          {/* ── STEP 1: Tipo servizio ── */}
          {step === 1 && (
            <div>
              <h2 style={{ margin: '0 0 6px', color: '#1e3a5f', fontSize: '1.2rem' }}>Che servizio ti serve?</h2>
              <p style={{ margin: '0 0 20px', color: '#6b7280', fontSize: '0.88rem' }}>Seleziona il tipo di prestazione richiesta</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {TIPI_SERVIZIO.map(t => (
                  <button key={t.value} type="button" onClick={() => { setTipoServizio(t.value); setTipoSpecifico(''); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '10px', border: `2px solid ${tipoServizio === t.value ? t.color : '#e5e7eb'}`, background: tipoServizio === t.value ? t.bg : 'white', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontSize: '1.5rem' }}>{t.emoji}</span>
                    <span style={{ fontWeight: tipoServizio === t.value ? '700' : '500', color: tipoServizio === t.value ? t.color : '#374151', fontSize: '1rem' }}>{t.label}</span>
                    {tipoServizio === t.value && <CheckCircle size={20} color={t.color} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                  </button>
                ))}
              </div>

              {tipoInfo && (
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ ...labelStyle, marginBottom: '8px' }}>Specifica (opzionale)</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {tipoInfo.tipi.map(t => (
                      <button key={t} type="button" onClick={() => setTipoSpecifico(tipoSpecifico === t ? '' : t)}
                        style={{ padding: '5px 12px', borderRadius: '12px', border: `1.5px solid ${tipoSpecifico === t ? tipoInfo.color : '#d1d5db'}`, background: tipoSpecifico === t ? tipoInfo.bg : 'white', color: tipoSpecifico === t ? tipoInfo.color : '#374151', fontWeight: tipoSpecifico === t ? '700' : '400', fontSize: '0.82rem', cursor: 'pointer' }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button type="button" disabled={!tipoServizio} onClick={() => setStep(2)}
                style={{ width: '100%', padding: '13px', background: tipoServizio ? '#1e3a5f' : '#e5e7eb', color: tipoServizio ? 'white' : '#9ca3af', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '1rem', cursor: tipoServizio ? 'pointer' : 'not-allowed' }}>
                Avanti →
              </button>
            </div>
          )}

          {/* ── STEP 2: Data e dati paziente ── */}
          {step === 2 && (
            <div>
              <h2 style={{ margin: '0 0 6px', color: '#1e3a5f', fontSize: '1.2rem' }}>Quando e per chi?</h2>
              <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: '0.88rem' }}>Scegli la data preferita e inserisci i dati del paziente</p>

              <div style={{ marginBottom: '16px' }}>
                <p style={{ ...labelStyle, marginBottom: '8px' }}>Data preferita *</p>
                <Calendario year={calYear} month={calMonth} onPrev={prevMonth} onNext={nextMonth}
                  selectedDate={selectedDate} onSelectDate={setSelectedDate} />
                {selectedDate ? (
                  <div style={{ marginTop: '8px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '8px 12px', color: '#1d4ed8', fontWeight: '600', fontSize: '0.88rem' }}>
                    📅 {new Date(selectedDate + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                ) : (
                  <p style={{ color: '#9ca3af', fontSize: '0.82rem', textAlign: 'center', margin: '6px 0 0' }}>Clicca su un giorno per selezionarlo</p>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Orario preferito</label>
                  <input type="time" value={orarioPref} onChange={e => setOrarioPref(e.target.value)} style={iStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Data alternativa</label>
                  <input type="date" value={dataAlt} min={today} onChange={e => setDataAlt(e.target.value)} style={iStyle} />
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Nome del paziente *</label>
                  <input value={pazienteNome} onChange={e => setPazienteNome(e.target.value)} placeholder="Nome e Cognome" required style={iStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Indirizzo domicilio *</label>
                  <input value={pazienteIndirizzo} onChange={e => setPazienteIndirizzo(e.target.value)} placeholder="Via, numero, città" required style={iStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Telefono paziente</label>
                  <input type="tel" value={pazienteTelefono} onChange={e => setPazienteTelefono(e.target.value)} placeholder="Es. 333 123 4567" style={iStyle} />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ ...labelStyle, marginBottom: '8px' }}>Priorità</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {PRIORITA.map(p => (
                    <button key={p.value} type="button" onClick={() => setPriorita(p.value)}
                      style={{ flex: 1, padding: '8px 4px', borderRadius: '8px', border: `2px solid ${priorita === p.value ? p.color : '#e5e7eb'}`, background: priorita === p.value ? p.color + '18' : 'white', color: priorita === p.value ? p.color : '#6b7280', fontWeight: priorita === p.value ? '700' : '400', fontSize: '0.78rem', cursor: 'pointer' }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Note aggiuntive</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  placeholder="Allergie, farmaci in corso, accesso al domicilio..."
                  style={{ ...iStyle, resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setStep(1)}
                  style={{ flex: 1, padding: '13px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer' }}>
                  ← Indietro
                </button>
                <button type="button" disabled={!selectedDate || !pazienteNome || !pazienteIndirizzo} onClick={() => setStep(3)}
                  style={{ flex: 2, padding: '13px', background: (selectedDate && pazienteNome && pazienteIndirizzo) ? '#1e3a5f' : '#e5e7eb', color: (selectedDate && pazienteNome && pazienteIndirizzo) ? 'white' : '#9ca3af', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '1rem', cursor: (selectedDate && pazienteNome && pazienteIndirizzo) ? 'pointer' : 'not-allowed' }}>
                  Avanti →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Dati richiedente + invio ── */}
          {step === 3 && (
            <form onSubmit={handleSubmit}>
              <h2 style={{ margin: '0 0 6px', color: '#1e3a5f', fontSize: '1.2rem' }}>I tuoi dati</h2>
              <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: '0.88rem' }}>Chi sta effettuando la richiesta? (paziente stesso o familiare/caregiver)</p>

              {/* Riepilogo */}
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 14px', marginBottom: '18px', fontSize: '0.85rem', color: '#374151', lineHeight: 1.7 }}>
                <strong>Riepilogo richiesta:</strong><br />
                {tipoInfo?.emoji} <strong>{tipoInfo?.label}</strong>{tipoSpecifico ? ` — ${tipoSpecifico}` : ''}<br />
                📅 {new Date(selectedDate + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{orarioPref ? ` · ${orarioPref}` : ''}<br />
                👤 {pazienteNome} — 📍 {pazienteIndirizzo}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                <div>
                  <label style={labelStyle}>Il tuo nome e cognome *</label>
                  <input value={richiedenteNome} onChange={e => setRichiedenteNome(e.target.value)} placeholder="Chi sta facendo la richiesta" required style={iStyle} />
                </div>
                <div>
                  <label style={labelStyle}>La tua email (per ricevere conferma)</label>
                  <input type="email" value={richiedenteEmail} onChange={e => setRichiedenteEmail(e.target.value)} placeholder="email@esempio.it" style={iStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Il tuo telefono</label>
                  <input type="tel" value={richiedenteTelefono} onChange={e => setRichiedenteTelefono(e.target.value)} placeholder="Es. 333 123 4567" style={iStyle} />
                </div>
              </div>

              {error && <div style={{ background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', color: '#dc2626', fontSize: '0.88rem' }}>⚠️ {error}</div>}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setStep(2)}
                  style={{ flex: 1, padding: '13px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer' }}>
                  ← Indietro
                </button>
                <button type="submit" disabled={sending}
                  style={{ flex: 2, padding: '13px', background: sending ? '#9ca3af' : '#1e3a5f', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '1rem', cursor: sending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Send size={18} />
                  {sending ? 'Invio...' : 'Invia Richiesta'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', marginTop: '20px' }}>
          Sei un operatore?{' '}
          <Link to="/login" style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '600' }}>Accedi →</Link>
        </p>
      </div>
    </div>
  );
}
