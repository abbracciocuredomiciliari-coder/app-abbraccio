import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Heart, Mail, Lock, LogIn, AlertCircle } from 'lucide-react';

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      login(response.data.token, response.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError('Credenziali non valide. Riprova.');
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
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--danger)',
              fontSize: '0.92rem',
            }}
          >
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <label>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Mail size={16} />
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="inserisci la tua email"
            required
          />
        </label>

        <label>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lock size={16} />
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
          />
        </label>

        <button type="submit" disabled={loading} style={{ width: '100%' }}>
          {loading ? (
            <>
              <span style={{
                width: '18px',
                height: '18px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              Accesso in corso...
            </>
          ) : (
            <>
              <LogIn size={18} />
              Accedi
            </>
          )}
        </button>

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