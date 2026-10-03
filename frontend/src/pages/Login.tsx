import { FormEvent, useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Heart, Mail, Lock, LogIn, AlertCircle, Clock, UserRound, Building2, Check } from 'lucide-react';
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
  const [workspace, setWorkspace] = useState<'privato' | 'convenzione'>(
    () => (localStorage.getItem('modalita') as 'privato' | 'convenzione') || 'privato'
  );

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
      const response = await api.post('/auth/login', { email, password, workspace });
      clearTimeout(wakeUpTimer);
      const loggedUser = response.data.user;
      localStorage.setItem('modalita', workspace);
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
      <div className="tw-text-center tw-mb-8">
        <div
          className="tw-w-16 tw-h-16 tw-mx-auto tw-mb-4 tw-rounded-2xl tw-flex tw-items-center tw-justify-center"
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            boxShadow: '0 12px 24px rgba(79, 70, 229, 0.3)',
          }}
        >
          <Heart size={32} color="white" />
        </div>
        <h2 className="tw-m-0 tw-text-[1.75rem]">Benvenuto su App Abbraccio</h2>
        <p className="tw-text-slate-500 tw-mt-2">
          Accedi per gestire la tua struttura sanitaria
        </p>
      </div>

      <div className="tw-max-w-md tw-mx-auto tw-mb-5">
        <p className="tw-text-center tw-text-[0.82rem] tw-font-semibold tw-text-slate-500 tw-mb-2.5 tw-uppercase tw-tracking-wide">
          Seleziona l'area di lavoro
        </p>
        <div className="tw-grid tw-grid-cols-2 tw-gap-3">
          <button
            type="button"
            onClick={() => setWorkspace('privato')}
            aria-pressed={workspace === 'privato'}
            className="tw-relative tw-rounded-2xl tw-p-4 tw-flex tw-flex-col tw-items-center tw-gap-1.5 tw-transition-all tw-duration-200 tw-border-2"
            style={{
              background: workspace === 'privato' ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 55%, #38bdf8 100%)' : '#fff',
              borderColor: workspace === 'privato' ? 'transparent' : '#e2e8f0',
              color: workspace === 'privato' ? '#fff' : '#64748b',
              boxShadow: workspace === 'privato' ? '0 10px 24px rgba(79, 70, 229, 0.35)' : 'none',
              transform: workspace === 'privato' ? 'scale(1.02)' : 'scale(1)',
              cursor: 'pointer',
            }}
          >
            <UserRound size={30} />
            <span className="tw-font-bold tw-text-[0.95rem]">Gestione Privata</span>
            <span className="tw-text-[0.72rem] tw-opacity-80">Pazienti privati</span>
            {workspace === 'privato' && (
              <span className="tw-absolute tw-top-2 tw-right-2 tw-bg-white/25 tw-rounded-full tw-p-0.5"><Check size={14} /></span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setWorkspace('convenzione')}
            aria-pressed={workspace === 'convenzione'}
            className="tw-relative tw-rounded-2xl tw-p-4 tw-flex tw-flex-col tw-items-center tw-gap-1.5 tw-transition-all tw-duration-200 tw-border-2"
            style={{
              background: workspace === 'convenzione' ? 'linear-gradient(135deg, #0f766e 0%, #0d9488 55%, #2dd4bf 100%)' : '#fff',
              borderColor: workspace === 'convenzione' ? 'transparent' : '#e2e8f0',
              color: workspace === 'convenzione' ? '#fff' : '#64748b',
              boxShadow: workspace === 'convenzione' ? '0 10px 24px rgba(13, 148, 136, 0.35)' : 'none',
              transform: workspace === 'convenzione' ? 'scale(1.02)' : 'scale(1)',
              cursor: 'pointer',
            }}
          >
            <Building2 size={30} />
            <span className="tw-font-bold tw-text-[0.95rem]">Convenzione SIAT</span>
            <span className="tw-text-[0.72rem] tw-opacity-80">Pazienti in convenzione</span>
            {workspace === 'convenzione' && (
              <span className="tw-absolute tw-top-2 tw-right-2 tw-bg-white/25 tw-rounded-full tw-p-0.5"><Check size={14} /></span>
            )}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="login-form tw-max-w-md tw-mx-auto">
        {sessionExpiredMsg && (
          <Alert type="warning" onClose={() => setSessionExpiredMsg('')} className="tw-mb-4">
            {sessionExpiredMsg}
          </Alert>
        )}

        {error && (
          <Alert type="error" onClose={() => setError('')} className="tw-mb-4">
            {error}
          </Alert>
        )}

        {isWakingUp && !error && (
          <Alert type="warning" className="tw-mb-4">
            Il server si sta avviando, attendi qualche secondo…
          </Alert>
        )}

        <Input
          label={
            <span className="tw-inline-flex tw-items-center tw-gap-1.5">
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
            <span className="tw-flex tw-items-center tw-justify-between">
              <span className="tw-inline-flex tw-items-center tw-gap-1.5">
                <Lock size={16} />
                Password
              </span>
              <Link to="/forgot-password" className="tw-text-[0.82rem] tw-text-brand tw-no-underline tw-font-medium">
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
          className="tw-w-full"
        >
          {isWakingUp ? 'Avvio server in corso…' : `Accedi — ${workspace === 'convenzione' ? 'Convenzione SIAT' : 'Gestione Privata'}`}
        </Button>

        <p className="tw-text-center tw-text-[0.88rem] tw-text-slate-500 tw-my-0 tw-mb-2.5">
          Operatore?{' '}
          <a href="/register" className="tw-text-brand tw-no-underline tw-font-medium">
            Registrati
          </a>
        </p>
      </form>
    </section>
  );
}

export default Login;
