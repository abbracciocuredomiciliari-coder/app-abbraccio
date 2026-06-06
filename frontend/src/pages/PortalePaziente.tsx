import { FormEvent, useEffect, useState, useMemo } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import {
  Syringe, HeartPulse, Activity, Calendar, Clock, Plus, X,
  CheckCircle, AlertCircle, ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react';

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y: number, m: number) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }
function toISO(d: Date) { return d.toISOString().split('T')[0]; }
const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const GIORNI_SETT = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

const TIPI_SERVIZIO = [
  { value: 'prelievo', label: '💉 Prelievo', color: '#dc2626', bg: '#fee2e2', Icon: Syringe,
    tipi: ['Emocromo completo','Glicemia','Coagulazione (PT/INR/aPTT)','Elettroliti','Funzionalità epatica','Funzionalità renale','Profilo lipidico','Ormoni tiroidei (TSH/fT4)','PCR / VES','Esame urine','Emogasanalisi','Altro'] },
  { value: 'esame_strumentale', label: '🔬 Esame Strumentale', color: '#7c3aed', bg: '#ede9fe', Icon: HeartPulse,
    tipi: ['ECG','Holter ECG','Holter pressorio','Glicemia capillare','EGA','Spirometria','Ecocardiogramma','Polisonnografia','Titolazione CPAP','Altro'] },
  { value: 'prestazione', label: '🏥 Prestazione Infermieristica', color: '#0369a1', bg: '#eff6ff', Icon: Activity,
    tipi: ['Medicazione','Somministrazione farmaci','Misurazione parametri vitali','Cateterismo','Gestione stomia','Prelievo arterioso','Altro'] },
];

const PRIORITA = [
  { value: 'normale', label: 'Normale', color: '#6b7280' },
  { value: 'urgente', label: 'Urgente', color: '#f59e0b' },
  { value: 'molto_urgente', label: 'Molto urgente', color: '#dc2626' },
];

const STATO_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  in_attesa:   { bg: '#fff7ed', color: '#c2410c', label: '⏳ In attesa' },
  in_revisione:{ bg: '#eff6ff', color: '#1d4ed8', label: '🔍 In revisione' },
  confermata:  { bg: '#f0fdf4', color: '#15803d', label: '✅ Confermata' },
  rifiutata:   { bg: '#fef2f2', color: '#dc2626', label: '❌ Rifiutata' },
};

interface Richiesta {
  _id: string; tipoServizio: string; tipoSpecifico?: string;
  pazienteNome: string; pazienteIndirizzo: string;
  dataPreferita: string; orarioPreferito?: string;
  dataAlternativa?: string; orarioAlternativo?: string;
  dataConfermata?: string; orarioConfermato?: string;
  priorita: string; stato: string; noteRichiedente?: string; noteAdmin?: string;
  createdAt: string;
}

function CalendarioMese({ year, month, onPrev, onNext, selectedDate, onSelectDate, daysWithDots }: {
  year: number; month: number; onPrev: () => void; onNext: () => void;
  selectedDate: string; onSelectDate: (d: string) => void; daysWithDots: Set<string>;
}) {
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
          if (!d) return <div key={`e${i}`} />;
          const iso = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const isSel = iso === selectedDate; const isToday = iso === todayStr; const hasDot = daysWithDots.has(iso);
          const isPast = iso < todayStr;
          return (
            <div key={iso} onClick={() => !isPast && onSelectDate(iso)}
              style={{ padding: '6px 2px', borderRadius: '8px', cursor: isPast ? 'default' : 'pointer', position: 'relative',
                background: isSel ? '#1e3a5f' : isToday ? '#eff6ff' : 'transparent',
                color: isSel ? 'white' : isPast ? '#d1d5db' : isToday ? '#1e40af' : '#374151',
                fontWeight: isSel || isToday ? '700' : '400', fontSize: '0.85rem' }}>
              {d}
              {hasDot && <span style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', width: '4px', height: '4px', borderRadius: '50%', background: isSel ? 'white' : '#0284c7' }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PortalePaziente() {
  const { user } = useAuth();
  const today = toISO(new Date());

  const [tab, setTab] = useState<'nuova' | 'mie'>('nuova');
  const [richieste, setRichieste] = useState<Richiesta[]>([]);
  const [loadingRichieste, setLoadingRichieste] = useState(false);

  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState('');

  const [tipoServizio, setTipoServizio] = useState('');
  const [tipoSpecifico, setTipoSpecifico] = useState('');
  const [orarioPref, setOrarioPref] = useState('');
  const [dataAlt, setDataAlt] = useState('');
  const [orarioAlt, setOrarioAlt] = useState('');
  const [priorita, setPriorita] = useState('normale');
  const [note, setNote] = useState('');
  const [pazienteNome, setPazienteNome] = useState(user?.name || '');
  const [pazienteIndirizzo, setPazienteIndirizzo] = useState('');
  const [pazienteTelefono, setPazienteTelefono] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { if (tab === 'mie') loadRichieste(); }, [tab]);

  const loadRichieste = async () => {
    setLoadingRichieste(true);
    try { const r = await api.get('/richieste-prenotazioni/mie'); setRichieste(r.data); }
    catch { setRichieste([]); } finally { setLoadingRichieste(false); }
  };

  const tipoInfo = TIPI_SERVIZIO.find(t => t.value === tipoServizio);
  const daysWithDots = useMemo(() => {
    const s = new Set<string>();
    richieste.forEach(r => { if (r.dataPreferita) s.add(r.dataPreferita.split('T')[0]); });
    return s;
  }, [richieste]);

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); } else setCalMonth(m => m-1); };
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); } else setCalMonth(m => m+1); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tipoServizio || !selectedDate || !pazienteNome || !pazienteIndirizzo) {
      setError('Compilare: tipo servizio, data, nome e indirizzo'); return;
    }
    setSending(true); setError('');
    try {
      await api.post('/richieste-prenotazioni', {
        pazienteNome, pazienteIndirizzo, pazienteTelefono,
        tipoServizio, tipoSpecifico: tipoSpecifico || undefined,
        dataPreferita: selectedDate, orarioPreferito: orarioPref || undefined,
        dataAlternativa: dataAlt || undefined, orarioAlternativo: orarioAlt || undefined,
        priorita, noteRichiedente: note || undefined,
      });
      setSuccess('Richiesta inviata! Riceverai una conferma via email quando verrà elaborata.');
      setTipoServizio(''); setTipoSpecifico(''); setSelectedDate(''); setOrarioPref('');
      setDataAlt(''); setOrarioAlt(''); setNote(''); setPriorita('normale');
    } catch (err: any) { setError(err.response?.data?.message || 'Errore invio richiesta'); }
    finally { setSending(false); }
  };

  const iStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box' };

  return (
    <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.4rem', color: '#1e3a5f' }}>🏥 Portale Prenotazioni</h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>Benvenuto/a <strong>{user?.name}</strong> — prenota un servizio a domicilio</p>
      </div>

      {error && <div style={{ background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>⚠️ {error}<button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>✕</button></div>}
      {success && <div style={{ background: '#dcfce7', border: '1px solid #22c55e', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px', color: '#15803d' }}>✅ {success}<button onClick={() => setSuccess('')} style={{ marginLeft: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#15803d', float: 'right' }}>✕</button></div>}

      <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '12px', padding: '4px', marginBottom: '20px' }}>
        <button onClick={() => setTab('nuova')} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', background: tab === 'nuova' ? 'white' : 'transparent', color: tab === 'nuova' ? '#1e3a5f' : '#6b7280', boxShadow: tab === 'nuova' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Plus size={16} /> Nuova Prenotazione
        </button>
        <button onClick={() => setTab('mie')} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', background: tab === 'mie' ? 'white' : 'transparent', color: tab === 'mie' ? '#1e3a5f' : '#6b7280', boxShadow: tab === 'mie' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Calendar size={16} /> Le mie Prenotazioni
        </button>
      </div>

      {tab === 'nuova' && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Tipo servizio */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#374151' }}>1. Tipo di servizio *</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {TIPI_SERVIZIO.map(t => (
                <button key={t.value} type="button" onClick={() => { setTipoServizio(t.value); setTipoSpecifico(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', border: `2px solid ${tipoServizio === t.value ? t.color : '#e5e7eb'}`, background: tipoServizio === t.value ? t.bg : 'white', cursor: 'pointer', textAlign: 'left' }}>
                  <t.Icon size={20} color={t.color} />
                  <span style={{ fontWeight: tipoServizio === t.value ? '700' : '500', color: tipoServizio === t.value ? t.color : '#374151', fontSize: '0.95rem' }}>{t.label}</span>
                  {tipoServizio === t.value && <CheckCircle size={18} color={t.color} style={{ marginLeft: 'auto' }} />}
                </button>
              ))}
            </div>
            {tipoInfo && (
              <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '6px', fontSize: '0.9rem' }}>Specifica il tipo</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {tipoInfo.tipi.map(t => (
                    <button key={t} type="button" onClick={() => setTipoSpecifico(t)}
                      style={{ padding: '4px 12px', borderRadius: '12px', border: `1.5px solid ${tipoSpecifico === t ? tipoInfo.color : '#d1d5db'}`, background: tipoSpecifico === t ? tipoInfo.bg : 'white', color: tipoSpecifico === t ? tipoInfo.color : '#374151', fontWeight: tipoSpecifico === t ? '700' : '400', fontSize: '0.82rem', cursor: 'pointer' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Calendario selezione data */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#374151' }}>2. Data preferita *</h3>
            <CalendarioMese year={calYear} month={calMonth} onPrev={prevMonth} onNext={nextMonth}
              selectedDate={selectedDate} onSelectDate={setSelectedDate} daysWithDots={new Set()} />
            {selectedDate ? (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 14px', color: '#1d4ed8', fontWeight: '600', fontSize: '0.9rem' }}>
                📅 Data selezionata: {new Date(selectedDate + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            ) : (
              <p style={{ color: '#9ca3af', fontSize: '0.85rem', textAlign: 'center', margin: '8px 0 0' }}>Clicca su un giorno per selezionarlo</p>
            )}
            <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '4px', fontSize: '0.85rem' }}>Orario preferito</label>
                <input type="time" value={orarioPref} onChange={e => setOrarioPref(e.target.value)} style={iStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '4px', fontSize: '0.85rem' }}>Data alternativa</label>
                <input type="date" value={dataAlt} min={today} onChange={e => setDataAlt(e.target.value)} style={iStyle} />
              </div>
            </div>
          </div>

          {/* Dati paziente */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#374151' }}>3. Dati del paziente *</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '4px', fontSize: '0.85rem' }}>Nome completo *</label>
                <input value={pazienteNome} onChange={e => setPazienteNome(e.target.value)} placeholder="Nome e Cognome del paziente" required style={iStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '4px', fontSize: '0.85rem' }}>Indirizzo domicilio *</label>
                <input value={pazienteIndirizzo} onChange={e => setPazienteIndirizzo(e.target.value)} placeholder="Via, numero civico, città" required style={iStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '4px', fontSize: '0.85rem' }}>Telefono di contatto</label>
                <input type="tel" value={pazienteTelefono} onChange={e => setPazienteTelefono(e.target.value)} placeholder="Es. +39 333 123 4567" style={iStyle} />
              </div>
            </div>
          </div>

          {/* Priorità e note */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#374151' }}>4. Priorità e note</h3>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {PRIORITA.map(p => (
                <button key={p.value} type="button" onClick={() => setPriorita(p.value)}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `2px solid ${priorita === p.value ? p.color : '#e5e7eb'}`, background: priorita === p.value ? p.color + '18' : 'white', color: priorita === p.value ? p.color : '#374151', fontWeight: priorita === p.value ? '700' : '400', fontSize: '0.82rem', cursor: 'pointer' }}>
                  {p.label}
                </button>
              ))}
            </div>
            <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '4px', fontSize: '0.85rem' }}>Note aggiuntive</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              placeholder="Informazioni utili (es. accesso al domicilio, allergie, farmaci in corso...)"
              style={{ ...iStyle, resize: 'vertical' }} />
          </div>

          <button type="submit" disabled={sending}
            style={{ width: '100%', padding: '14px', background: '#1e3a5f', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '1rem', cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {sending ? <><RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> Invio in corso...</> : <><Plus size={18} /> Invia Richiesta di Prenotazione</>}
          </button>
        </form>
      )}

      {tab === 'mie' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#374151' }}>Le tue richieste</h3>
            <button onClick={loadRichieste} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#374151' }}>
              <RefreshCw size={14} /> Aggiorna
            </button>
          </div>
          {loadingRichieste ? <p style={{ textAlign: 'center', color: '#9ca3af' }}>Caricamento...</p> :
           richieste.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <Calendar size={40} color="#d1d5db" style={{ marginBottom: '12px' }} />
              <p style={{ color: '#9ca3af', margin: 0 }}>Nessuna richiesta inviata ancora.<br/>Usa "Nuova Prenotazione" per iniziare.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {richieste.map(r => {
                const stato = STATO_COLORS[r.stato] || { bg: '#f9fafb', color: '#374151', label: r.stato };
                const tipoI = TIPI_SERVIZIO.find(t => t.value === r.tipoServizio);
                return (
                  <div key={r._id} style={{ background: 'white', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `4px solid ${tipoI?.color || '#e5e7eb'}` }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          {tipoI && <tipoI.Icon size={18} color={tipoI.color} />}
                          <span style={{ fontWeight: '700', color: '#111', fontSize: '0.95rem' }}>{tipoI?.label || r.tipoServizio}</span>
                          {r.tipoSpecifico && <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>— {r.tipoSpecifico}</span>}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#6b7280', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          <span><Calendar size={12} style={{ display: 'inline', marginRight: '3px' }} />{new Date(r.dataPreferita).toLocaleDateString('it-IT')}{r.orarioPreferito ? ` · ${r.orarioPreferito}` : ''}</span>
                          {r.dataConfermata && <span style={{ color: '#15803d', fontWeight: '600' }}>✅ Confermata: {new Date(r.dataConfermata).toLocaleDateString('it-IT')}{r.orarioConfermato ? ` · ${r.orarioConfermato}` : ''}</span>}
                        </div>
                        {r.noteAdmin && <div style={{ marginTop: '6px', background: r.stato === 'rifiutata' ? '#fef2f2' : '#eff6ff', borderRadius: '6px', padding: '6px 10px', fontSize: '0.82rem', color: r.stato === 'rifiutata' ? '#dc2626' : '#1d4ed8' }}>💬 {r.noteAdmin}</div>}
                      </div>
                      <span style={{ background: stato.bg, color: stato.color, borderRadius: '10px', padding: '4px 10px', fontSize: '0.78rem', fontWeight: '700', flexShrink: 0 }}>{stato.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
