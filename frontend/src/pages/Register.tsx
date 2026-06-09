import { FormEvent, useState, useCallback, lazy, Suspense } from 'react';
import api from '../api/api';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';

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

function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [categoria, setCategoria] = useState('');
  const [professione, setProfessione] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Zona lavorativa
  const [domicilioPartenza, setDomicilioPartenza] = useState('');
  const [raggioAzioneKm, setRaggioAzioneKm] = useState(10);
  const [domicilioCoords, setDomicilioCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geocodingLoading, setGeocodingLoading] = useState(false);
  const [geocodingError, setGeocodingError] = useState('');

  const [telefono, setTelefono] = useState('');

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const payload: any = {
        name,
        email,
        password,
        role: 'caregiver',
        telefono,
        categoria,
        professione,
        domicilioPartenza: domicilioPartenza.trim(),
        raggioAzioneKm,
        ...(domicilioCoords ? { domicilioCoords } : {}),
      };

      const response = await api.post('/auth/register', payload);

      if (response.data.pending) {
        setSuccess(response.data.message);
        setName('');
        setEmail('');
        setPassword('');
        setCategoria('');
        setProfessione('');
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

  return (
    <section>
      <h2>Registrazione Operatore</h2>
      <p style={{ color: 'var(--gray-500)', marginBottom: '20px', fontSize: '0.95rem' }}>
        Compila il modulo per richiedere l'accesso all'app. La tua richiesta sarà valutata dall'amministratore.
      </p>
      <form onSubmit={handleSubmit} className="login-form" style={{ maxWidth: '480px' }}>

        <label>
          Nome completo *
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Es. Mario Rossi"
            required
          />
        </label>
        <label>
          Email *
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Es. mario.rossi@email.it"
            required
          />
        </label>
        <label>
          Telefono
          <input
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="Es. +39 333 123 4567"
          />
        </label>
        <label>
          Password *
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimo 6 caratteri"
            minLength={6}
            required
          />
        </label>

        <label>
          Categoria professionale *
          <select
            value={categoria}
            onChange={(e) => handleCategoriaChange(e.target.value)}
            required
          >
            <option value="">— Seleziona categoria —</option>
            {Object.entries(figurePerCategoria).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </label>

        {categoria && (
          <label>
            Figura professionale *
            <select
              value={professione}
              onChange={(e) => setProfessione(e.target.value)}
              required
            >
              <option value="">— Seleziona figura —</option>
              {figurePerCategoria[categoria].ruoli.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
        )}

        {error && (
          <Alert type="error" onClose={() => setError('')} style={{ marginBottom: '16px' }}>
            {error}
          </Alert>
        )}

        <div style={{ background: 'rgba(30,77,140,0.06)', border: '1px solid rgba(30,77,140,0.2)', borderRadius: '6px', padding: '10px 14px', fontSize: '0.88rem', color: '#1e4d8c', marginBottom: '4px' }}>
          ℹ️ Dopo la registrazione, la tua richiesta sarà inviata all'amministratore per l'approvazione. Potrai accedere solo dopo l'attivazione del tuo account.
        </div>

        {/* ─── Zona lavorativa ─────────────────────────────────── */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '18px', marginTop: '4px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '1rem', color: '#1e3a5f' }}>📍 Zona di lavoro</h3>
          <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: '#6b7280' }}>
            Indica il tuo domicilio di partenza e il raggio entro cui sei disponibile a lavorare.
          </p>
          <label>
            Indirizzo di partenza *
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={domicilioPartenza}
                onChange={e => { setDomicilioPartenza(e.target.value); setDomicilioCoords(null); }}
                placeholder="Es. Via Roma 10, Roma RM"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={geocodifica}
                disabled={geocodingLoading || !domicilioPartenza.trim()}
                style={{ background: '#1e4d8c', color: 'white', border: 'none', borderRadius: '8px', padding: '0 14px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', opacity: geocodingLoading ? 0.7 : 1 }}
              >
                {geocodingLoading ? '...' : '📍 Trova'}
              </button>
            </div>
            {geocodingError && <span style={{ fontSize: '0.82rem', color: '#dc2626' }}>{geocodingError}</span>}
            {domicilioCoords && <span style={{ fontSize: '0.82rem', color: '#059669' }}>✓ Posizione trovata</span>}
          </label>
          <label style={{ marginTop: '12px', display: 'block' }}>
            Raggio di azione: <strong>{raggioAzioneKm} km</strong>
            <input
              type="range" min={1} max={80} step={1}
              value={raggioAzioneKm}
              onChange={e => setRaggioAzioneKm(Number(e.target.value))}
              style={{ width: '100%', marginTop: '6px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#9ca3af' }}>
              <span>1 km</span><span>80 km</span>
            </div>
          </label>
          {domicilioCoords && (
            <div style={{ marginTop: '14px' }}>
              <Suspense fallback={<div style={{ height: 280, background: '#f1f5f9', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Caricamento mappa...</div>}>
                <MappaZona
                  center={domicilioCoords}
                  raggioKm={raggioAzioneKm}
                  altezza={280}
                  readonly
                />
              </Suspense>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '6px', textAlign: 'center' }}>
                Il cerchio blu mostra la tua zona di disponibilità
              </p>
            </div>
          )}
        </div>

        <Button type="submit" loading={loading} variant="primary" style={{ width: '100%' }}>
          {loading ? 'Invio in corso...' : 'Invia richiesta di registrazione'}
        </Button>
      </form>
    </section>
  );
}

export default Register;
