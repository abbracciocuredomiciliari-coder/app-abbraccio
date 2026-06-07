import { FormEvent, useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Heart, Mail, Lock, LogIn, AlertCircle, Clock } from 'lucide-react';
import { Alert } from '../components/ui/Alert';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [isWakingUp, setIsWakingUp] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('sessionExpired') === '1') {
      setSessionExpiredMsg('La tua sessione è scaduta. Effettua nuovamente il login.');
      window.history.replaceState({}, '', '/');
    }
    // Sveglia il server Render al caricamento della pagina login
    const serverURL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api')
      .replace(/\/api$/, '');
    fetch(`${serverURL}/api/health`).catch(() => {});
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSessionExpiredMsg('');
    setIsWakingUp(false);
    setLoading(true);

    // Dopo 5 secondi senza risposta, avvisa che il server si sta svegliando
    const wakeUpTimer = setTimeout(() => {
      setIsWakingUp(true);
    }, 5000);

    try {
      const response = await api.post('/auth/login', { email, password });
      clearTimeout(wakeUpTimer);
      const loggedUser = response.data.user;
      login(response.data.token, loggedUser);
      // Redirect in base al ruolo
      const ruoliPrivilegiati = ['admin', 'coordinator', 'direttore'];
      if (ruoliPrivilegiati.includes(loggedUser.role)) {
        navigate('/dashboard');
      } else {
        navigate('/portale-operatore');
      }
    } catch (err) {
      clearTimeout(wakeUpTimer);
      setIsWakingUp(false);

      if (axios.isAxiosError(err)) {
        if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
          setError('Il server sta impiegando troppo tempo a rispondere. Riprova tra qualche secondo.');
        } else if (!err.response) {
          // Nessuna risposta dal server (rete assente o server irraggiungibile)
          setError('Impossibile raggiungere il server. Controlla la connessione e riprova.');
        } else if (err.response.status === 401) {
          setError('Credenziali non valide. Controlla email e password.');
        } else if (err.response.status === 403) {
          // Account pending o rejected — mostra il messaggio del server
          setError(err.response.data?.message || 'Accesso non autorizzato.');
        } else if (err.response.status >= 500) {
          setError('Errore del server. Riprova tra qualche istante.');
        } else {
          setError(err.response.data?.message || 'Errore durante il login. Riprova.');
        }
      } else {
        setError('Errore imprevisto. Riprova.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 24px rgba(79, 70, 229, 0.3)',
          }}
        >
          <Heart size={32} color="white" />
        </div>
        <h2 style={{ margin: 0, fontSize: '1.75rem' }}>Benvenuto su App Abbraccio</h2>
        <p style={{ color: 'var(--gray-500)', marginTop: '8px' }}>
          Accedi per gestire la tua struttura sanitaria
        </p>
      </div>

      <form onSubmit={handleSubmit} className="login-form" style={{ maxWidth: '440px', margin: '0 auto' }}>
        {sessionExpiredMsg && (
          <Alert type="warning" onClose={() => setSessionExpiredMsg('')} style={{ marginBottom: '16px' }}>
            {sessionExpiredMsg}
          </Alert>
        )}

        {error && (
          <Alert type="error" onClose={() => setError('')} style={{ marginBottom: '16px' }}>
            {error}
          </Alert>
        )}

        {isWakingUp && !error && (
          <Alert type="warning" style={{ marginBottom: '16px' }}>
            Il server si sta avviando, attendi qualche secondo…
          </Alert>
        )}

        <Input
          label={
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={16} />
              Email
            </span>
          }
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="inserisci la tua email"
          required
        />

        <Input
          label={
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={16} />
                Password
              </span>
              <Link to="/forgot-password" style={{ fontSize: '0.82rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                Password dimenticata?
              </Link>
            </span>
          }
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        <Button
          type="submit"
          variant="primary"
          loading={loading}
          icon={<LogIn size={18} />}
          style={{ width: '100%' }}
        >
          {isWakingUp ? 'Avvio server in corso…' : 'Accedi'}
        </Button>

        <p style={{ textAlign: 'center', fontSize: '0.88rem', color: 'var(--gray-500)', margin: 0 }}>
          Non hai un account?{' '}
          <a
            href="/register"
            style={{
              color: 'var(--primary)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Registrati
          </a>
        </p>
      </form>
    </section>
  );
}

export default Login;
