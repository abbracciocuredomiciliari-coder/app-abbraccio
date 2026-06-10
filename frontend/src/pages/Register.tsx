import { FormEvent, useState, useCallback, lazy, Suspense, useRef } from 'react';
import api from '../api/api';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import FirmaCanvas from '../components/FirmaCanvas';
import { Upload, FileText, CheckCircle, ArrowRight, ArrowLeft, User, MapPin, FileSignature, Paperclip } from 'lucide-react';

const MappaZona = lazy(() => import('../components/MappaZona'));

// Figure professionali dal menu Personale
const figurePerCategoria: Record<string, { label: string; ruoli: string[] }> = {
  infermieristico: {
    label: 'Personale Infermieristico',
    ruoli: ['Infermiere', 'Infermiere pediatrico', 'Infermiere di comunità'],
  },
  oss: {
    label: 'Personale OSS',
    ruoli: ['OSS - Operatore Socio Sanitario'],
  },
  riabilitativo: {
    label: 'Personale Riabilitativo',
    ruoli: ['Fisioterapista', 'Neuropsicomotricista', 'Logopedista', 'Terapista occupazionale'],
  },
  medico: {
    label: 'Medico',
    ruoli: ['Medico rianimatore', 'Broncopneumologo', 'Psicologo', 'Neurologo', 'Geriatra'],
  },
  coordinamento: {
    label: 'Coordinamento',
    ruoli: ['Coordinatore infermieristico', 'Coordinatore medico', 'Coordinatore fisioterapico', 'Assistente sociale'],
  },
  direzione: {
    label: 'Direttore Sanitario',
    ruoli: ['Direttore sanitario'],
  },
};

type Step = 'anagrafica' | 'zona' | 'tipo-collab' | 'contratto' | 'documenti' | 'riepilogo';

function Register() {
  // ─── Step wizard ─────────────────────────────────────────
  const [step, setStep] = useState<Step>('anagrafica');

  // ─── Anagrafica ─────────────────────────────────────────
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [categoria, setCategoria] = useState('');
  const [professione, setProfessione] = useState('');
  const [telefono, setTelefono] = useState('');
  const [dataNascita, setDataNascita] = useState('');
  const [luogoNascita, setLuogoNascita] = useState('');
  const [codiceFiscale, setCodiceFiscale] = useState('');
  const [indirizzoResidenza, setIndirizzoResidenza] = useState('');
  const [pec, setPec] = useState('');

  // ─── Zona lavorativa ────────────────────────────────────
  const [domicilioPartenza, setDomicilioPartenza] = useState('');
  const [raggioAzioneKm, setRaggioAzioneKm] = useState(10);
  const [domicilioCoords, setDomicilioCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [geocodingError, setGeocodingError] = useState('');

  // ─── Tipo collaborazione ────────────────────────────────
  const [tipoCollaborazione, setTipoCollaborazione] = useState<'libero-professionista' | 'dipendente' | ''>('');
  const [partitaIva, setPartitaIva] = useState('');
  const [regimeFiscale, setRegimeFiscale] = useState<'forfettario' | 'ordinario' | ''>('');

  // ─── Contratto ──────────────────────────────────────────
  const [firmaContratto, setFirmaContratto] = useState<string | null>(null);
  const [dataFirma, setDataFirma] = useState<string>(new Date().toISOString().split('T')[0]);
  const [luogoFirma, setLuogoFirma] = useState('Roma');
  const [numeroAlbo, setNumeroAlbo] = useState('');
  const [ordineAlbo, setOrdineAlbo] = useState('');

  // ─── Documenti allegati ─────────────────────────────────
  const [assicurazioneFile, setAssicurazioneFile] = useState<File | null>(null);
  const [documentoIdentitaFile, setDocumentoIdentitaFile] = useState<File | null>(null);
  const [attestazioneQualificaFile, setAttestazioneQualificaFile] = useState<File | null>(null);

  // ─── Stati UI ─────────────────────────────────────────────
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const geocodifica = useCallback(async () => {
    if (!domicilioPartenza.trim()) return;
    setGeocodingLoading(true);
    setGeocodingError('');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(domicilioPartenza)}&limit=1&countrycodes=it`,
        { headers: { 'Accept-Language': 'it' } }
      );
      const data = await res.json();
      if (data.length > 0) {
        setDomicilioCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      } else {
        setGeocodingError('Indirizzo non trovato. Prova con un indirizzo più preciso (città, via, numero).');
      }
    } catch {
      setGeocodingError('Errore nella ricerca indirizzo.');
    }
    setGeocodingLoading(false);
  }, [domicilioPartenza]);

  const handleCategoriaChange = (val: string) => {
    setCategoria(val);
    setProfessione('');
  };

  const validaStep = (s: Step): boolean => {
    setError('');
    switch (s) {
      case 'anagrafica':
        if (!name.trim() || !email.trim() || !password || !telefono.trim()) {
          setError('Compila tutti i campi obbligatori (nome, email, password, telefono)');
          return false;
        }
        if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
          setError('La password deve essere di almeno 8 caratteri e contenere almeno una lettera e un numero.');
          return false;
        }
        if (!categoria || !professione) {
          setError('Seleziona categoria e figura professionale');
          return false;
        }
        if (!codiceFiscale.trim()) {
          setError('Inserisci il codice fiscale');
          return false;
        }
        return true;
      case 'zona':
        if (!domicilioPartenza.trim()) {
          setError('Inserisci l\'indirizzo di partenza');
          return false;
        }
        return true;
      case 'tipo-collab':
        if (!tipoCollaborazione) {
          setError('Seleziona il tipo di collaborazione');
          return false;
        }
        if (tipoCollaborazione === 'libero-professionista' && !partitaIva.trim()) {
          setError('Inserisci la partita IVA');
          return false;
        }
        return true;
      case 'contratto':
        if (!firmaContratto) {
          setError('Devi firmare il contratto per proseguire');
          return false;
        }
        if (!dataFirma || !luogoFirma.trim()) {
          setError('Compila data e luogo di firma');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (!validaStep(step)) return;
    const steps: Step[] = ['anagrafica', 'zona', 'tipo-collab', 'contratto', 'riepilogo'];
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) setStep(steps[idx + 1]);
  };

  const prevStep = () => {
    const steps: Step[] = ['anagrafica', 'zona', 'tipo-collab', 'contratto', 'riepilogo'];
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const formData = new FormData();
      // Dati anagrafici
      formData.append('name', name.trim());
      formData.append('email', email.trim());
      formData.append('password', password);
      formData.append('telefono', telefono.trim());
      formData.append('categoria', categoria);
      formData.append('professione', professione);
      formData.append('codiceFiscale', codiceFiscale.trim());
      formData.append('dataNascita', dataNascita);
      formData.append('luogoNascita', luogoNascita.trim());
      formData.append('indirizzoResidenza', indirizzoResidenza.trim());
      formData.append('pec', pec.trim());
      // Zona
      formData.append('domicilioPartenza', domicilioPartenza.trim());
      formData.append('raggioAzioneKm', String(raggioAzioneKm));
      if (domicilioCoords) {
        formData.append('domicilioCoords', JSON.stringify(domicilioCoords));
      }
      // Tipo collaborazione
      formData.append('tipoCollaborazione', tipoCollaborazione);
      formData.append('partitaIva', partitaIva.trim());
      formData.append('regimeFiscale', regimeFiscale);
      // Contratto
      formData.append('firmaContratto', firmaContratto!);
      formData.append('dataFirma', dataFirma);
      formData.append('luogoFirma', luogoFirma.trim());
      formData.append('numeroAlbo', numeroAlbo.trim());
      formData.append('ordineAlbo', ordineAlbo.trim());
      // Documenti
      if (assicurazioneFile) formData.append('assicurazione', assicurazioneFile);
      if (documentoIdentitaFile) formData.append('documentoIdentita', documentoIdentitaFile);
      if (attestazioneQualificaFile) formData.append('attestazioneQualifica', attestazioneQualificaFile);

      const response = await api.post('/auth/register-completo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.pending) {
        setSuccess(response.data.message);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(msg || 'Impossibile registrarsi. Controlla i campi e riprova.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <section>
        <h2>Registrazione</h2>
        <div style={{
          background: 'rgba(5,150,105,0.08)',
          border: '2px solid #059669',
          borderRadius: '10px',
          padding: '28px 24px',
          maxWidth: '480px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>✅</div>
          <h3 style={{ color: '#059669', margin: '0 0 12px' }}>Richiesta inviata con successo!</h3>
          <p style={{ color: '#374151', lineHeight: '1.6', margin: 0 }}>{success}</p>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '16px' }}>
            Puoi chiudere questa pagina. Verrai contattato dall'amministratore.
          </p>
        </div>
      </section>
    );
  }

  const steps: { id: Step; label: string; icon: any }[] = [
    { id: 'anagrafica', label: 'Anagrafica', icon: User },
    { id: 'zona', label: 'Zona lavoro', icon: MapPin },
    { id: 'tipo-collab', label: 'Tipo collab.', icon: FileText },
    { id: 'contratto', label: 'Contratto', icon: FileSignature },
    { id: 'documenti', label: 'Documenti', icon: Paperclip },
    { id: 'riepilogo', label: 'Riepilogo', icon: CheckCircle },
  ];

  return (
    <section>
      <h2>Registrazione Operatore</h2>
      <p style={{ color: 'var(--gray-500)', marginBottom: '20px', fontSize: '0.95rem' }}>
        Compila tutti gli step per richiedere l'accesso. Dovrai firmare il contratto e allegare i documenti richiesti.
      </p>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', overflowX: 'auto' }}>
        {steps.map((s, idx) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isPast = steps.findIndex(x => x.id === step) > idx;
          return (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px',
              background: isActive ? '#1e4d8c' : isPast ? '#dbeafe' : '#f3f4f6',
              color: isActive ? 'white' : isPast ? '#1e4d8c' : '#9ca3af', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap'
            }}>
              <Icon size={14} />
              {s.label}
            </div>
          );
        })}
      </div>

      {error && (
        <Alert type="error" onClose={() => setError('')} style={{ marginBottom: '16px' }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="login-form" style={{ maxWidth: '600px' }}>
        {/* STEP 1: Anagrafica */}
        {step === 'anagrafica' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: '#1e3a5f' }}>👤 Dati anagrafici</h3>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo *" required />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email *" required />
              <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Telefono *" required />
            </div>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (min 8 char, lettera+numero) *" required />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <input value={codiceFiscale} onChange={e => setCodiceFiscale(e.target.value.toUpperCase())} placeholder="Codice Fiscale *" maxLength={16} required />
              <input type="date" value={dataNascita} onChange={e => setDataNascita(e.target.value)} placeholder="Data nascita" />
            </div>
            <input value={luogoNascita} onChange={e => setLuogoNascita(e.target.value)} placeholder="Luogo di nascita" />
            <input value={indirizzoResidenza} onChange={e => setIndirizzoResidenza(e.target.value)} placeholder="Indirizzo di residenza" />
            <input type="email" value={pec} onChange={e => setPec(e.target.value)} placeholder="PEC (es. nome@pec.it)" />
            <select value={categoria} onChange={e => handleCategoriaChange(e.target.value)} required>
              <option value="">— Categoria professionale * —</option>
              {Object.entries(figurePerCategoria).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            {categoria && (
              <select value={professione} onChange={e => setProfessione(e.target.value)} required>
                <option value="">— Figura professionale * —</option>
                {figurePerCategoria[categoria].ruoli.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}
          </div>
        )}

        {/* STEP 2: Zona */}
        {step === 'zona' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: '#1e3a5f' }}>📍 Zona di lavoro</h3>
            <label>Indirizzo di partenza *</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={domicilioPartenza} onChange={e => { setDomicilioPartenza(e.target.value); setDomicilioCoords(null); }} placeholder="Via Roma 10, Roma RM" style={{ flex: 1 }} />
              <button type="button" onClick={geocodifica} disabled={geocodingLoading} style={{ background: '#1e4d8c', color: 'white', border: 'none', borderRadius: '8px', padding: '0 14px', cursor: 'pointer' }}>
                {geocodingLoading ? '...' : '📍 Trova'}
              </button>
            </div>
            {geocodingError && <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>{geocodingError}</span>}
            {domicilioCoords && <span style={{ color: '#059669', fontSize: '0.8rem' }}>✓ Posizione trovata</span>}
            <label>Raggio di azione: {raggioAzioneKm} km</label>
            <input type="range" min={1} max={80} value={raggioAzioneKm} onChange={e => setRaggioAzioneKm(Number(e.target.value))} />
            {domicilioCoords && (
              <Suspense fallback={<div style={{ height: 200, background: '#f1f5f9' }}>Caricamento mappa...</div>}>
                <MappaZona center={domicilioCoords} raggioKm={raggioAzioneKm} altezza={200} readonly />
              </Suspense>
            )}
          </div>
        )}

        {/* STEP 3: Tipo collaborazione */}
        {step === 'tipo-collab' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: '#1e3a5f' }}>💼 Tipo di collaborazione</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setTipoCollaborazione('libero-professionista')} style={{ flex: 1, padding: '16px', borderRadius: '10px', border: `2px solid ${tipoCollaborazione === 'libero-professionista' ? '#1e4d8c' : '#e5e7eb'}`, background: tipoCollaborazione === 'libero-professionista' ? '#eff6ff' : 'white' }}>
                <strong>Libero Professionista</strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#6b7280' }}>Con Partita IVA e iscrizione albo</p>
              </button>
              <button type="button" onClick={() => setTipoCollaborazione('dipendente')} style={{ flex: 1, padding: '16px', borderRadius: '10px', border: `2px solid ${tipoCollaborazione === 'dipendente' ? '#1e4d8c' : '#e5e7eb'}`, background: tipoCollaborazione === 'dipendente' ? '#eff6ff' : 'white' }}>
                <strong>Senza Partita IVA</strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#6b7280' }}>Dipendente o altro rapporto</p>
              </button>
            </div>
            {tipoCollaborazione === 'libero-professionista' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                <input value={partitaIva} onChange={e => setPartitaIva(e.target.value)} placeholder="Partita IVA *" maxLength={11} />
                <select value={regimeFiscale} onChange={e => setRegimeFiscale(e.target.value as any)}>
                  <option value="">Regime fiscale</option>
                  <option value="forfettario">Forfettario</option>
                  <option value="ordinario">Ordinario</option>
                </select>
                <input value={ordineAlbo} onChange={e => setOrdineAlbo(e.target.value)} placeholder="Ordine/Albo professionale (es. Ordine dei Medici di Roma)" />
                <input value={numeroAlbo} onChange={e => setNumeroAlbo(e.target.value)} placeholder="Numero iscrizione albo" />
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Contratto - da completare */}
        {step === 'contratto' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: '#1e3a5f' }}>📝 Firma contratto</h3>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', maxHeight: '300px', overflowY: 'auto', fontSize: '0.8rem' }}>
              <h4 style={{ margin: '0 0 8px', textAlign: 'center' }}>CONTRATTO DI PRESTAZIONE D'OPERA</h4>
              <p><strong>TRA</strong> ABBRACCIO CURE DOMICILIARI S.r.l. (P.IVA 18316251000)</p>
              <p><strong>E</strong> {name || '_________________'}, C.F. {codiceFiscale || '_____________'}{tipoCollaborazione === 'libero-professionista' && `, P.IVA ${partitaIva || '_____________'}`}</p>
              <hr style={{ margin: '8px 0' }} />
              <p><strong>1. Oggetto:</strong> Prestazioni di {professione || '_________________'} in ambito domiciliare in autonomia.</p>
              <p><strong>2. Durata:</strong> 1 anno dalla data di firma, con rinnovo tacito.</p>
              <p><strong>3. Corrispettivo:</strong> Da concordare nel piano lavoro, pagamento 30gg fine mese.</p>
              <p><strong>4. Requisiti:</strong> Iscrizione albo n° {numeroAlbo || '_____________'}, assicurazione RC, Codice Etico.</p>
              <p><strong>5. Privacy:</strong> Impegno riservatezza dati pazienti (GDPR art.28).</p>
              <p><strong>6. Recesso:</strong> 30 giorni preavviso. Risoluzione automatica per inadempimenti gravi.</p>
              <p style={{ marginTop: '12px' }}>Letto e sottoscritto in data _______________ a _______________.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <input type="date" value={dataFirma} onChange={e => setDataFirma(e.target.value)} placeholder="Data firma *" />
              <input value={luogoFirma} onChange={e => setLuogoFirma(e.target.value)} placeholder="Luogo firma *" />
            </div>
            <div style={{ border: '2px dashed #1e4d8c', borderRadius: '8px', padding: '10px' }}>
              <FirmaCanvas
                label="Firma professionista"
                sublabel={`${name || 'Nome Cognome'} - ${new Date().toLocaleDateString('it-IT')}`}
                onFirmaCompleta={setFirmaContratto}
                onCancella={() => setFirmaContratto(null)}
                firmaEsistente={firmaContratto || undefined}
                altezza={140}
              />
            </div>
            {firmaContratto && <div style={{ color: '#059669', fontSize: '0.9rem' }}>✓ Contratto firmato digitalmente</div>}
          </div>
        )}

        {/* STEP 5: Riepilogo */}
        {step === 'riepilogo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: '#1e3a5f' }}>✅ Riepilogo</h3>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '0.9rem' }}>
              <p><strong>Nome:</strong> {name}</p>
              <p><strong>Email:</strong> {email}</p>
              <p><strong>Prof:</strong> {professione}</p>
              <p><strong>Tipo:</strong> {tipoCollaborazione === 'libero-professionista' ? 'Libero Prof.' : 'Dipendente'}{tipoCollaborazione === 'libero-professionista' && ` (P.IVA: ${partitaIva})`}</p>
              <p><strong>Contratto:</strong> {firmaContratto ? '✓ Firmato' : '✗ Non firmato'}</p>
            </div>
            <Button type="submit" loading={loading} variant="primary" style={{ width: '100%' }}>
              {loading ? 'Invio in corso...' : '✓ Invia richiesta registrazione'}
            </Button>
          </div>
        )}

        {/* Navigation buttons */}
        {step !== 'riepilogo' && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            {step !== 'anagrafica' && (
              <Button type="button" onClick={prevStep} variant="secondary" style={{ flex: 1 }}>
                <ArrowLeft size={16} /> Indietro
              </Button>
            )}
            <Button type="button" onClick={nextStep} variant="primary" style={{ flex: 1 }}>
              Avanti <ArrowRight size={16} />
            </Button>
          </div>
        )}
      </form>
    </section>
  );
}

export default Register;
