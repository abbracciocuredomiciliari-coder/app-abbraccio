import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import { Mail, Heart, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setSuccess(res.data.message);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Errore nell\'invio. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{
          width: '64px', height: '64px', margin: '0 auto 16px',
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          borderRadius: '16px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', boxShadow: '0 12px 24px rgba(79,70,229,0.3)',
        }}>
          <Heart size={32} color="white" />
        </div>
        <h2 style={{ margin: 0, fontSize: '1.75rem' }}>Password dimenticata?</h2>
        <p style={{ color: 'var(--gray-500)', marginTop: '8px' }}>
          Inserisci la tua email e ti invieremo un link per reimpostarla.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="login-form" style={{ maxWidth: '440px', margin: '0 auto' }}>
        {success && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            padding: '14px 16px', backgroundColor: 'rgba(5,150,105,0.08)',
            border: '1px solid #6ee7b7', borderRadius: 'var(--radius-md)',
            color: '#065f46', fontSize: '0.92rem',
          }}>
            <CheckCircle size={20} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '12px 16px', backgroundColor: 'var(--danger-bg)',
            border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)',
            color: 'var(--danger)', fontSize: '0.92rem',
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        {!success && (
          <>
            <label>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={16} /> Email
              </span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="la tua email registrata"
                required
              />
            </label>

            <button type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? (
                <>
                  <span style={{
                    width: '18px', height: '18px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white', borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  Invio in corso...
                </>
              ) : (
                <>
                  <Mail size={18} />
                  Invia link di reset
                </>
              )}
            </button>
          </>
        )}

        <p style={{ textAlign: 'center', fontSize: '0.88rem', color: 'var(--gray-500)', margin: 0 }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
            <ArrowLeft size={14} /> Torna al login
          </Link>
        </p>
      </form>
    </section>
  );
}
