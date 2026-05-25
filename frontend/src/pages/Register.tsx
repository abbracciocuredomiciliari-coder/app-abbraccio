import { FormEvent, useState } from 'react';
import api from '../api/api';

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
      const response = await api.post('/auth/register', {
        name,
        email,
        password,
        categoria,
        professione,
        role: 'caregiver',
      });

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
      <h2>Registrazione</h2>
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
          <p className="error-text" style={{ background: 'rgba(220,38,38,0.08)', padding: '10px 14px', borderRadius: '6px', border: '1px solid #dc2626' }}>
            ⚠️ {error}
          </p>
        )}

        <div style={{ background: 'rgba(30,77,140,0.06)', border: '1px solid rgba(30,77,140,0.2)', borderRadius: '6px', padding: '10px 14px', fontSize: '0.88rem', color: '#1e4d8c', marginBottom: '4px' }}>
          ℹ️ Dopo la registrazione, la tua richiesta sarà inviata all'amministratore per l'approvazione. Potrai accedere solo dopo l'attivazione del tuo account.
        </div>

        <button type="submit" disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
          {loading ? '⏳ Invio in corso...' : '📨 Invia richiesta di registrazione'}
        </button>
      </form>
    </section>
  );
}

export default Register;
