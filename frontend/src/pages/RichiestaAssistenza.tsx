import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, CheckCircle, AlertCircle, ArrowLeft, User, Phone, Mail, MapPin, Calendar, FileText, Stethoscope, Activity, UserPlus } from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function RichiestaAssistenza() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [inviata, setInviata] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  // Dati paziente
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [codiceFiscale, setCodiceFiscale] = useState('');
  const [address, setAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [email, setEmail] = useState('');
  const [assistanceNeeds, setAssistanceNeeds] = useState('');
  const [diagnosi, setDiagnosi] = useState('');
  const [comorbilita, setComorbilita] = useState('');
  const [allergie, setAllergie] = useState('');

  // Dati caregiver/richiedente
  const [caregiverRelazione, setCaregiverRelazione] = useState<'paziente_stesso' | 'figlio' | 'coniuge' | 'parente' | 'amico' | 'professionista' | 'altro'>('paziente_stesso');
  const [caregiverNome, setCaregiverNome] = useState('');
  const [caregiverTelefono, setCaregiverTelefono] = useState('');
  const [caregiverEmail, setCaregiverEmail] = useState('');
  const [noteAggiuntive, setNoteAggiuntive] = useState('');

  const isPazienteStesso = caregiverRelazione === 'paziente_stesso';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validazione step 1
    if (!firstName || !lastName || !birthDate || !address || !assistanceNeeds) {
      setError('Compila tutti i campi obbligatori del paziente');
      return;
    }

    // Validazione step 2
    if (!isPazienteStesso && !caregiverNome) {
      setError('Inserire il nome del caregiver che richiede l\'assistenza');
      return;
    }

    setSending(true);
    try {
      await axios.post(`${API_BASE}/richieste-paziente`, {
        firstName,
        lastName,
        birthDate,
        codiceFiscale,
        address,
        contactPhone,
        email,
        assistanceNeeds,
        diagnosiAmmissione: diagnosi,
        comorbilita,
        allergie,
        noteAggiuntive,
        richiedenteNome: isPazienteStesso ? `${firstName} ${lastName}` : caregiverNome,
        richiedenteRelazione: caregiverRelazione,
        richiedenteEmail: caregiverEmail,
        richiedenteTelefono: caregiverTelefono,
      });
      setInviata(true);
    } catch (err: any) {
      console.error('Errore registrazione:', err);
      const msg = err.response?.data?.message || 'Errore durante la registrazione. Riprova più tardi.';
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  if (inviata) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: 'white', borderRadius: '20px', padding: '48px 36px', maxWidth: '520px', width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          <div style={{ width: '80px', height: '80px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <CheckCircle size={44} color="#16a34a" />
          </div>
          <h2 style={{ margin: '0 0 12px', color: '#16a34a', fontSize: '1.5rem', fontWeight: '800' }}>
            Richiesta registrata!
          </h2>
          <p style={{ color: '#6b7280', lineHeight: 1.7, margin: '0 0 24px', fontSize: '1rem' }}>
            La richiesta di assistenza domiciliare per <strong>{firstName} {lastName}</strong> è stata inviata con successo.
            <br /><br />
            Il nostro staff la valuterà e vi contatterà entro <strong>24-48 ore</strong> per organizzare la prima visita e attivare il piano di assistenza.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#1e3a5f', color: 'white', padding: '12px 24px', borderRadius: '10px', textDecoration: 'none', fontWeight: '700' }}>
              <ArrowLeft size={18} /> Torna alla home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    fontSize: '0.95rem',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontWeight: '600',
    color: '#374151',
    fontSize: '0.9rem',
    marginBottom: '6px',
  };

  const sectionStyle: React.CSSProperties = {
    background: '#f8fafc',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
  };

  const sectionTitleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: '700',
    color: '#1e3a5f',
    fontSize: '1.05rem',
    marginBottom: '16px',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)', padding: '24px 16px' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>🏥</div>
          <h1 style={{ margin: '0 0 6px', color: 'white', fontSize: '1.5rem', fontWeight: '800' }}>
            Richiesta Assistenza Domiciliare
          </h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: '0.95rem' }}>
            Compila il form per richiedere l'assistenza privata
          </p>
        </div>

        {/* Card form */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '28px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>

          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '28px' }}>
            {[1, 2, 3].map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  background: step >= s ? '#1e3a5f' : '#e5e7eb',
                  color: step >= s ? 'white' : '#9ca3af',
                }}>
                  {s}
                </div>
                {s < 3 && <div style={{ width: '40px', height: '3px', background: step > s ? '#1e3a5f' : '#e5e7eb', borderRadius: '2px' }} />}
              </div>
            ))}
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: '#dc2626' }}>
              <AlertCircle size={20} />
              <span style={{ fontSize: '0.9rem' }}>{error}</span>
            </div>
          )}

          <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); setStep((s) => (s + 1) as 1 | 2 | 3); }}>

            {/* STEP 1: Dati Paziente */}
            {step === 1 && (
              <div>
                <div style={sectionStyle}>
                  <div style={sectionTitleStyle}>
                    <User size={20} />
                    Dati del paziente
                  </div>

                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <label>
                        <span style={labelStyle}>Nome *</span>
                        <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} placeholder="Mario" required />
                      </label>
                      <label>
                        <span style={labelStyle}>Cognome *</span>
                        <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} placeholder="Rossi" required />
                      </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <label>
                        <span style={labelStyle}>Data di nascita *</span>
                        <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} style={inputStyle} required />
                      </label>
                      <label>
                        <span style={labelStyle}>Codice Fiscale</span>
                        <input type="text" value={codiceFiscale} onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())} style={inputStyle} placeholder="RSSMRA70A01H501X" maxLength={16} />
                      </label>
                    </div>

                    <label>
                      <span style={labelStyle}>Indirizzo completo *</span>
                      <div style={{ position: 'relative' }}>
                        <MapPin size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} style={{ ...inputStyle, paddingLeft: '40px' }} placeholder="Via Roma 123, 00100 Roma (RM)" required />
                      </div>
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <label>
                        <span style={labelStyle}>Telefono</span>
                        <div style={{ position: 'relative' }}>
                          <Phone size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                          <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} style={{ ...inputStyle, paddingLeft: '40px' }} placeholder="+39 333 1234567" />
                        </div>
                      </label>
                      <label>
                        <span style={labelStyle}>Email</span>
                        <div style={{ position: 'relative' }}>
                          <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inputStyle, paddingLeft: '40px' }} placeholder="email@esempio.it" />
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <div style={sectionStyle}>
                  <div style={sectionTitleStyle}>
                    <Activity size={20} />
                    Esigenze assistenziali
                  </div>
                  <label>
                    <span style={labelStyle}>Descrivi le esigenze di assistenza *</span>
                    <textarea
                      value={assistanceNeeds}
                      onChange={(e) => setAssistanceNeeds(e.target.value)}
                      style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                      placeholder="Es: Paziente anziano con difficoltà motorie necessita assistenza igienica 2 volte al giorno, mobilizzazione, controllo parametri vitali..."
                      required
                    />
                  </label>
                </div>
              </div>
            )}

            {/* STEP 2: Dati Clinici */}
            {step === 2 && (
              <div>
                <div style={sectionStyle}>
                  <div style={sectionTitleStyle}>
                    <Stethoscope size={20} />
                    Informazioni cliniche (facoltative)
                  </div>

                  <div style={{ display: 'grid', gap: '16px' }}>
                    <label>
                      <span style={labelStyle}>Diagnosi principale</span>
                      <input type="text" value={diagnosi} onChange={(e) => setDiagnosi(e.target.value)} style={inputStyle} placeholder="Es: Alzheimer, Ictus, Scompenso cardiaco..." />
                    </label>

                    <label>
                      <span style={labelStyle}>Comorbilità (altre patologie)</span>
                      <input type="text" value={comorbilita} onChange={(e) => setComorbilita(e.target.value)} style={inputStyle} placeholder="Es: Diabete, Ipertensione, BPCO..." />
                    </label>

                    <label>
                      <span style={labelStyle}>Allergie note</span>
                      <input type="text" value={allergie} onChange={(e) => setAllergie(e.target.value)} style={inputStyle} placeholder="Es: Penicillina, Lattice, Nichel..." />
                    </label>
                  </div>
                </div>

                <div style={sectionStyle}>
                  <div style={sectionTitleStyle}>
                    <UserPlus size={20} />
                    Chi richiede l'assistenza?
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <span style={labelStyle}>Relazione con il paziente *</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {[
                        { value: 'paziente_stesso', label: 'Il paziente stesso' },
                        { value: 'figlio', label: 'Figlio/a' },
                        { value: 'coniuge', label: 'Coniuge' },
                        { value: 'parente', label: 'Altro parente' },
                        { value: 'amico', label: 'Amico/a' },
                        { value: 'professionista', label: 'Professionista sanitario' },
                        { value: 'altro', label: 'Altro' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setCaregiverRelazione(opt.value as any)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '20px',
                            border: `2px solid ${caregiverRelazione === opt.value ? '#1e3a5f' : '#e5e7eb'}`,
                            background: caregiverRelazione === opt.value ? '#1e3a5f' : 'white',
                            color: caregiverRelazione === opt.value ? 'white' : '#374151',
                            fontWeight: caregiverRelazione === opt.value ? '700' : '500',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {!isPazienteStesso && (
                    <div style={{ display: 'grid', gap: '16px' }}>
                      <label>
                        <span style={labelStyle}>Nome completo del richiedente *</span>
                        <input type="text" value={caregiverNome} onChange={(e) => setCaregiverNome(e.target.value)} style={inputStyle} placeholder="Es: Giuseppe Rossi" required={!isPazienteStesso} />
                      </label>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <label>
                          <span style={labelStyle}>Telefono del richiedente</span>
                          <input type="tel" value={caregiverTelefono} onChange={(e) => setCaregiverTelefono(e.target.value)} style={inputStyle} placeholder="+39 333 7654321" />
                        </label>
                        <label>
                          <span style={labelStyle}>Email del richiedente</span>
                          <input type="email" value={caregiverEmail} onChange={(e) => setCaregiverEmail(e.target.value)} style={inputStyle} placeholder="caregiver@email.it" />
                        </label>
                      </div>
                    </div>
                  )}

                  {isPazienteStesso && (
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px', color: '#1e40af', fontSize: '0.9rem' }}>
                      ✅ Il paziente richiede direttamente l'assistenza. Useremo i suoi contatti.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 3: Riepilogo e invio */}
            {step === 3 && (
              <div>
                <div style={sectionStyle}>
                  <div style={sectionTitleStyle}>
                    <FileText size={20} />
                    Riepilogo richiesta
                  </div>

                  <div style={{ display: 'grid', gap: '14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '2px' }}>Paziente</div>
                        <div style={{ fontWeight: '600', color: '#1e3a5f' }}>{firstName} {lastName}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '2px' }}>Data nascita</div>
                        <div style={{ fontWeight: '500' }}>{birthDate ? new Date(birthDate).toLocaleDateString('it-IT') : '-'}</div>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '2px' }}>Indirizzo</div>
                      <div style={{ fontWeight: '500' }}>{address}</div>
                    </div>

                    {diagnosi && (
                      <div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '2px' }}>Diagnosi</div>
                        <div style={{ fontWeight: '500' }}>{diagnosi}</div>
                      </div>
                    )}

                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '2px' }}>Richiedente</div>
                      <div style={{ fontWeight: '500' }}>
                        {isPazienteStesso ? 'Il paziente stesso' : caregiverNome} ({caregiverRelazione.replace('_', ' ')})
                      </div>
                    </div>

                    <label>
                      <span style={labelStyle}>Note aggiuntive (facoltativo)</span>
                      <textarea
                        value={noteAggiuntive}
                        onChange={(e) => setNoteAggiuntive(e.target.value)}
                        style={{ ...inputStyle, minHeight: '80px' }}
                        placeholder="Aggiungi qui qualsiasi informazione utile (orari preferiti, accesso casa, contatti secondari...)"
                      />
                    </label>
                  </div>
                </div>

                <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: '10px', padding: '14px', marginBottom: '20px', fontSize: '0.9rem', color: '#854d0e' }}>
                  <strong>📋 Privacy:</strong> Confermando, acconsenti al trattamento dei dati personali del paziente ai sensi del GDPR per le finalità assistenziali. I dati saranno conservati in forma sicura e accessibili solo al personale autorizzato.
                </div>
              </div>
            )}

            {/* Bottoni navigazione */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '8px' }}>
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                  style={{ padding: '12px 24px', borderRadius: '10px', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: '600', cursor: 'pointer', fontSize: '0.95rem' }}
                >
                  ← Indietro
                </button>
              ) : (
                <Link
                  to="/"
                  style={{ padding: '12px 24px', borderRadius: '10px', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: '600', textDecoration: 'none', fontSize: '0.95rem' }}
                >
                  Annulla
                </Link>
              )}

              <button
                type="submit"
                disabled={sending}
                style={{
                  padding: '12px 28px',
                  borderRadius: '10px',
                  border: 'none',
                  background: sending ? '#9ca3af' : '#1e3a5f',
                  color: 'white',
                  fontWeight: '700',
                  cursor: sending ? 'not-allowed' : 'pointer',
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {sending ? 'Invio in corso...' : step === 3 ? '✓ Conferma richiesta' : 'Avanti →'}
              </button>
            </div>
          </form>
        </div>

        {/* Footer info */}
        <div style={{ textAlign: 'center', marginTop: '24px', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
          <p>Per urgenze sanitarie chiamare il <strong>118</strong> o il numero di emergenza locale</p>
          <p style={{ marginTop: '8px' }}>© {new Date().getFullYear()} Abbracciare — Cure Domiciliari</p>
        </div>
      </div>
    </div>
  );
}
