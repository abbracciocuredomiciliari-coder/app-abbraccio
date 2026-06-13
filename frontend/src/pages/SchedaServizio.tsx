import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import FirmaCanvas from '../components/FirmaCanvas';
import {
  FileText, CheckCircle, Send, ChevronDown, Loader2,
  User, Calendar, Activity, CreditCard, Clock
} from 'lucide-react';

type FrequenzaPrestazione = 'singola' | 'multipla' | 'continuata';
type MetodoPagamento = 'contanti' | 'carta_credito' | 'bonifico' | 'altro';
type FrequenzaPagamento = 'giornaliera' | 'settimanale' | 'ogni_10_giorni' | 'mensile';

interface SchedaMia {
  _id: string;
  nomeCognomePaziente: string;
  tipoPrestazione: string;
  stato: string;
  createdAt: string;
}

const TIPI_PRESTAZIONE = [
  'Assistenza infermieristica domiciliare',
  'Medicazione e gestione ferite',
  'Somministrazione terapia farmacologica',
  'Misurazione parametri vitali',
  'Assistenza alla persona (igiene, mobilizzazione)',
  'Fisioterapia domiciliare',
  'Prelievo ematico',
  'Esame strumentale (ECG, Holter, ecc.)',
  'Cateterismo vescicale',
  'Gestione stomia',
  'Piano assistenziale continuato',
  'Altro',
];

const STATO_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  inviata:   { label: '⏳ Inviata — in attesa di conferma', bg: '#fff7ed', color: '#c2410c' },
  accettata: { label: '✅ Accettata dall\'amministrazione', bg: '#f0fdf4', color: '#15803d' },
  archiviata:{ label: '📁 Archiviata nella documentazione', bg: '#eff6ff', color: '#1d4ed8' },
  rifiutata: { label: '❌ Non accettata', bg: '#fef2f2', color: '#dc2626' },
};

export default function SchedaServizio() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [nomeCognomePaziente, setNomeCognomePaziente] = useState('');
  const [dataNascita, setDataNascita] = useState('');
  const [tipoPrestazione, setTipoPrestazione] = useState('');
  const [tipoPrestazioneAltro, setTipoPrestazioneAltro] = useState('');
  const [frequenzaPrestazione, setFrequenzaPrestazione] = useState<FrequenzaPrestazione>('singola');
  const [giorniContinuata, setGiorniContinuata] = useState('');
  const [operatoreIncaricato, setOperatoreIncaricato] = useState('');
  const [costoPrestazione, setCostoPrestazione] = useState('');
  const [ivaPercentuale, setIvaPercentuale] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState<MetodoPagamento>('contanti');
  const [frequenzaPagamento, setFrequenzaPagamento] = useState<FrequenzaPagamento>('mensile');
  const [pagamentoEffettuato, setPagamentoEffettuato] = useState(false);
  const [ruoloFirmatario, setRuoloFirmatario] = useState<'paziente' | 'caregiver'>('paziente');
  const [nomeFirmatario, setNomeFirmatario] = useState('');
  const [firma, setFirma] = useState('');

  // UI state
  const [step, setStep] = useState<'form' | 'firma' | 'inviata'>('form');
  const [saving, setSaving] = useState(false);
  const [errore, setErrore] = useState('');
  const [schedeInviate, setSchedeInviate] = useState<SchedaMia[]>([]);
  const [loadingSchede, setLoadingSchede] = useState(true);

  useEffect(() => {
    caricaSchede();
  }, []);

  const caricaSchede = async () => {
    try {
      const res = await api.get('/scheda-servizio/mie');
      setSchedeInviate(res.data);
    } catch {/***/}
    setLoadingSchede(false);
  };

  const tipoFinale = tipoPrestazione === 'Altro' ? tipoPrestazioneAltro.trim() : tipoPrestazione;

  const validaForm = () => {
    if (!nomeCognomePaziente.trim()) return 'Inserire nome e cognome del paziente';
    if (!dataNascita.trim()) return 'Inserire la data di nascita';
    if (!tipoFinale) return 'Selezionare o specificare il tipo di prestazione';
    if (!costoPrestazione || isNaN(Number(costoPrestazione))) return 'Inserire un costo valido';
    if (!nomeFirmatario.trim()) return 'Inserire il nome del firmatario';
    if (!firma) return 'La firma è obbligatoria';
    return '';
  };

  const inviaScheda = async () => {
    const err = validaForm();
    if (err) { setErrore(err); return; }
    setSaving(true); setErrore('');
    try {
      await api.post('/scheda-servizio', {
        nomeCognomePaziente: nomeCognomePaziente.trim(),
        dataNascita: dataNascita.trim(),
        tipoPrestazione: tipoFinale,
        frequenzaPrestazione,
        giorniContinuata: frequenzaPrestazione === 'continuata' && giorniContinuata ? Number(giorniContinuata) : undefined,
        operatoreIncaricato: operatoreIncaricato.trim() || undefined,
        costoPrestazione: Number(costoPrestazione),
        ivaPercentuale: ivaPercentuale ? Number(ivaPercentuale) : 0,
        metodoPagamento,
        frequenzaPagamento,
        pagamentoEffettuato,
        firmaBase64: firma,
        nomeFirmatario: nomeFirmatario.trim(),
        ruoloFirmatario,
      });
      setStep('inviata');
      await caricaSchede();
    } catch (e: any) {
      setErrore(e?.response?.data?.message || 'Errore durante l\'invio');
    }
    setSaving(false);
  };

  const sectionStyle = {
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    marginBottom: '20px',
    overflow: 'hidden' as const,
  };
  const sectionHeaderStyle = (color: string) => ({
    background: color,
    color: 'white',
    padding: '10px 16px',
    fontWeight: 700 as const,
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  });
  const sectionBodyStyle = { padding: '16px' };
  const labelStyle = { display: 'block' as const, fontWeight: 600 as const, fontSize: '0.85rem', color: '#374151', marginBottom: '6px' };
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box' as const };
  const checkboxRow = (label: string, checked: boolean, onChange: () => void) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px 12px', borderRadius: '8px', border: `2px solid ${checked ? '#2563eb' : '#e2e8f0'}`, background: checked ? '#eff6ff' : 'white', fontWeight: 600, fontSize: '0.9rem', color: checked ? '#1d4ed8' : '#374151', userSelect: 'none' }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ display: 'none' }} />
      <span style={{ width: '20px', height: '20px', borderRadius: '4px', border: `2px solid ${checked ? '#2563eb' : '#d1d5db'}`, background: checked ? '#2563eb' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {checked && <CheckCircle size={14} color="white" />}
      </span>
      {label}
    </label>
  );

  // ─── STEP INVIATA ───────────────────────────────────────────────────────────
  if (step === 'inviata') {
    return (
      <section className="fade-in" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <CheckCircle size={64} color="#16a34a" style={{ marginBottom: '16px' }} />
          <h2 style={{ color: '#1e3a5f', fontSize: '1.5rem', marginBottom: '8px' }}>Scheda Inviata!</h2>
          <p style={{ color: '#6b7280', marginBottom: '8px' }}>
            La scheda è stata inviata all'amministrazione che la verificherà e archivierà nella tua documentazione.
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '32px' }}>
            Riceverai conferma non appena elaborata.
          </p>
          <button
            onClick={() => { setStep('form'); setFirma(''); setNomeCognomePaziente(''); setDataNascita(''); setTipoPrestazione(''); setCostoPrestazione(''); setNomeFirmatario(''); }}
            style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', padding: '14px 32px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}
          >
            Compila nuova scheda
          </button>
        </div>

        {schedeInviate.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ color: '#1e3a5f', fontWeight: 700, marginBottom: '12px' }}>Le tue schede inviate</h3>
            {schedeInviate.map(s => {
              const cfg = STATO_CONFIG[s.stato] || { label: s.stato, bg: '#f3f4f6', color: '#374151' };
              return (
                <div key={s._id} style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', marginBottom: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>{s.nomeCognomePaziente}</div>
                    <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: '2px' }}>{s.tipoPrestazione} — {new Date(s.createdAt).toLocaleDateString('it-IT')}</div>
                  </div>
                  <span style={{ background: cfg.bg, color: cfg.color, borderRadius: '20px', padding: '4px 12px', fontSize: '0.78rem', fontWeight: 700 }}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  // ─── STEP FIRMA ─────────────────────────────────────────────────────────────
  if (step === 'firma') {
    return (
      <section className="fade-in" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle('#1e4d8c')}>
            <FileText size={16} /> Firma del Paziente o Caregiver
          </div>
          <div style={sectionBodyStyle}>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '20px' }}>
              Prima di inviare la scheda, il paziente o il caregiver deve firmare per accettare i termini della prestazione.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Chi firma?</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {(['paziente', 'caregiver'] as const).map(r => (
                  <button key={r} onClick={() => setRuoloFirmatario(r)}
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
                      background: ruoloFirmatario === r ? '#1e3a5f' : '#f3f4f6',
                      color: ruoloFirmatario === r ? 'white' : '#374151',
                      border: `2px solid ${ruoloFirmatario === r ? '#1e3a5f' : '#d1d5db'}` }}>
                    {r === 'paziente' ? '🧑‍🦳 Paziente' : '👨‍👩‍👧 Caregiver'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Nome del firmatario *</label>
              <input style={inputStyle} type="text" value={nomeFirmatario} onChange={e => setNomeFirmatario(e.target.value)}
                placeholder={ruoloFirmatario === 'paziente' ? nomeCognomePaziente || 'Nome e cognome del paziente' : 'Nome e cognome del caregiver'} />
            </div>

            <FirmaCanvas
              label={`✍️ Firma del ${ruoloFirmatario === 'paziente' ? 'Paziente' : 'Caregiver'}`}
              sublabel="Firmare per accettare i termini della prestazione"
              onFirmaCompleta={f => setFirma(f)}
              onCancella={() => setFirma('')}
              altezza={180}
            />

            {errore && (
              <div style={{ background: '#fef2f2', border: '1px solid #ef4444', borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '0.88rem', marginBottom: '16px' }}>
                {errore}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => { setStep('form'); setErrore(''); }}
                style={{ flex: 1, background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '10px', padding: '14px', cursor: 'pointer', fontWeight: 700 }}>
                ← Indietro
              </button>
              <button onClick={inviaScheda} disabled={saving || !firma || !nomeFirmatario.trim()}
                style={{ flex: 2, background: saving || !firma || !nomeFirmatario.trim() ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', borderRadius: '10px', padding: '14px', cursor: saving || !firma || !nomeFirmatario.trim() ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {saving ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={18} />}
                {saving ? 'Invio in corso...' : 'Invia Scheda'}
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ─── STEP FORM ──────────────────────────────────────────────────────────────
  return (
    <section className="fade-in" style={{ maxWidth: '700px', margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e3a5f', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <FileText size={24} color="#2563eb" />
          Scheda Servizi Assistenza Domiciliare
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
          Compila e firma per accettare la prestazione — la scheda sarà inviata all'amministrazione
        </p>
      </div>

      {/* Schede già inviate (collapsible) */}
      {!loadingSchede && schedeInviate.length > 0 && (
        <div style={{ ...sectionStyle, marginBottom: '24px' }}>
          <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 700, color: '#475569', fontSize: '0.88rem' }}>
            📋 Schede già inviate ({schedeInviate.length})
          </div>
          {schedeInviate.slice(0, 3).map(s => {
            const cfg = STATO_CONFIG[s.stato] || { label: s.stato, bg: '#f3f4f6', color: '#374151' };
            return (
              <div key={s._id} style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>{s.nomeCognomePaziente}</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.82rem', marginLeft: '8px' }}>{new Date(s.createdAt).toLocaleDateString('it-IT')}</span>
                </div>
                <span style={{ background: cfg.bg, color: cfg.color, borderRadius: '20px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700 }}>{cfg.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* SEZIONE 1 — Dati Paziente */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle('#1e4d8c')}>
          <User size={15} /> 1. Dati del Paziente
        </div>
        <div style={sectionBodyStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Nome e Cognome *</label>
              <input style={inputStyle} type="text" value={nomeCognomePaziente} onChange={e => setNomeCognomePaziente(e.target.value)} placeholder="Es. Mario Rossi" />
            </div>
            <div>
              <label style={labelStyle}>Data di nascita *</label>
              <input style={inputStyle} type="date" value={dataNascita} onChange={e => setDataNascita(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* SEZIONE 2 — Dettagli Prestazione */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle('#0369a1')}>
          <Activity size={15} /> 2. Dettagli della Prestazione
        </div>
        <div style={sectionBodyStyle}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Tipo di prestazione richiesta *</label>
            <div style={{ position: 'relative' }}>
              <select style={{ ...inputStyle, appearance: 'none', paddingRight: '36px', cursor: 'pointer' }}
                value={tipoPrestazione} onChange={e => setTipoPrestazione(e.target.value)}>
                <option value="">— Seleziona —</option>
                {TIPI_PRESTAZIONE.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
            </div>
            {tipoPrestazione === 'Altro' && (
              <input style={{ ...inputStyle, marginTop: '10px' }} type="text" value={tipoPrestazioneAltro}
                onChange={e => setTipoPrestazioneAltro(e.target.value)} placeholder="Specificare la prestazione..." />
            )}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Frequenza della prestazione *</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {([['singola', '☐ Singola'], ['multipla', '☐ Multipla'], ['continuata', '☐ Continuata']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setFrequenzaPrestazione(v)}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: `2px solid ${frequenzaPrestazione === v ? '#2563eb' : '#d1d5db'}`,
                    background: frequenzaPrestazione === v ? '#eff6ff' : 'white', color: frequenzaPrestazione === v ? '#1d4ed8' : '#374151',
                    fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                  {l.replace('☐ ', frequenzaPrestazione === v ? '☑ ' : '☐ ')}
                </button>
              ))}
            </div>
            {frequenzaPrestazione === 'continuata' && (
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>per giorni</label>
                <input style={{ ...inputStyle, maxWidth: '100px' }} type="number" min="1" value={giorniContinuata}
                  onChange={e => setGiorniContinuata(e.target.value)} placeholder="N°" />
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Operatore incaricato</label>
            <input style={inputStyle} type="text" value={operatoreIncaricato} onChange={e => setOperatoreIncaricato(e.target.value)} placeholder="Nome operatore (opzionale)" />
          </div>
        </div>
      </div>

      {/* SEZIONE 3 — Tariffa e Pagamento */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle('#059669')}>
          <CreditCard size={15} /> 3. Tariffa e Pagamento
        </div>
        <div style={sectionBodyStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Costo della prestazione (€) *</label>
              <input style={inputStyle} type="number" min="0" step="0.01" value={costoPrestazione}
                onChange={e => setCostoPrestazione(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <label style={labelStyle}>IVA (%)</label>
              <input style={inputStyle} type="number" min="0" max="100" value={ivaPercentuale}
                onChange={e => setIvaPercentuale(e.target.value)} placeholder="Es. 22" />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Metodo di pagamento *</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {([
                ['contanti', '☐ Contanti'],
                ['carta_credito', '☐ Carta di Credito'],
                ['bonifico', '☐ Bonifico'],
                ['altro', '☐ Altro'],
              ] as const).map(([v, l]) => (
                <button key={v} onClick={() => setMetodoPagamento(v)}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: `2px solid ${metodoPagamento === v ? '#059669' : '#d1d5db'}`,
                    background: metodoPagamento === v ? '#f0fdf4' : 'white', color: metodoPagamento === v ? '#15803d' : '#374151',
                    fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                  {l.replace('☐ ', metodoPagamento === v ? '☑ ' : '☐ ')}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Frequenza pagamento *</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {([
                ['giornaliera', '☐ Giornaliera'],
                ['settimanale', '☐ Settimanale'],
                ['ogni_10_giorni', '☐ Ogni 10 giorni'],
                ['mensile', '☐ Mensile'],
              ] as const).map(([v, l]) => (
                <button key={v} onClick={() => setFrequenzaPagamento(v)}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: `2px solid ${frequenzaPagamento === v ? '#059669' : '#d1d5db'}`,
                    background: frequenzaPagamento === v ? '#f0fdf4' : 'white', color: frequenzaPagamento === v ? '#15803d' : '#374151',
                    fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                  {l.replace('☐ ', frequenzaPagamento === v ? '☑ ' : '☐ ')}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            {checkboxRow('Pagamento effettuato', pagamentoEffettuato, () => setPagamentoEffettuato(!pagamentoEffettuato))}
          </div>

          <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem', color: '#475569', border: '1px solid #e2e8f0' }}>
            Intestato a: <strong>Abbraccio Cure Domiciliari</strong>
          </div>
        </div>
      </div>

      {errore && (
        <div style={{ background: '#fef2f2', border: '1px solid #ef4444', borderRadius: '8px', padding: '12px 16px', color: '#dc2626', fontSize: '0.9rem', marginBottom: '16px' }}>
          ⚠️ {errore}
        </div>
      )}

      <button
        onClick={() => {
          const err = (() => {
            if (!nomeCognomePaziente.trim()) return 'Inserire nome e cognome del paziente';
            if (!dataNascita.trim()) return 'Inserire la data di nascita';
            if (!tipoFinale) return 'Selezionare o specificare il tipo di prestazione';
            if (!costoPrestazione || isNaN(Number(costoPrestazione))) return 'Inserire un costo valido';
            return '';
          })();
          if (err) { setErrore(err); return; }
          setErrore(''); setStep('firma');
        }}
        style={{ width: '100%', background: '#1e4d8c', color: 'white', border: 'none', borderRadius: '12px', padding: '16px', cursor: 'pointer', fontWeight: 700, fontSize: '1.05rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
      >
        <FileText size={20} /> Continua — Firma e Invia
      </button>
    </section>
  );
}
