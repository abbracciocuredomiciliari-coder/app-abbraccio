import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/api';
import { Heart, Lock, CheckCircle, AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Le password non coincidono.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/reset-password', { token, newPassword });
      setSuccess(res.data.message);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Errore nel reset. Riprova o richiedi un nuovo link.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <section>
        <div style={{ maxWidth: '440px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid #fca5a5', borderRadius: '10px', padding: '20px', color: '#7f1d1d' }}>
            <AlertCircle size={24} style={{ marginBottom: '8px' }} />
            <p style={{ margin: 0, fontWeight: 600 }}>Link non valido.</p>
            <p style={{ margin: '8px 0 0', fontSize: '0.88rem' }}>Richiedi un nuovo link dalla pagina di login.</p>
          </div>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '16px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
            <ArrowLeft size={14} /> Torna al login
          </Link>
        </div>
      </section>
    );
  }

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
        <h2 style={{ margin: 0, fontSize: '1.75rem' }}>Nuova password</h2>
        <p style={{ color: 'var(--gray-500)', marginTop: '8px' }}>
          Scegli una nuova password sicura per il tuo account.
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
            <div>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>{success}</div>
              <Link to="/" style={{ color: '#059669', fontWeight: 600, textDecoration: 'underline' }}>Vai al login →</Link>
            </div>
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
                <Lock size={16} /> Nuova password
              </span>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 8 caratteri, 1 lettera, 1 numero"
                  required
                  style={{ paddingRight: '40px', width: '100%', boxSizing: 'border-box' }}
                />
                <button type="button" onClick={() => setShowNew(v => !v)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: '2px' }}>
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <label>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={16} /> Conferma password
              </span>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Ripeti la nuova password"
                  required
                  style={{ paddingRight: '40px', width: '100%', boxSizing: 'border-box' }}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: '2px' }}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <span style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>Le password non coincidono</span>
              )}
            </label>

            <button type="submit" disabled={loading || (!!confirmPassword && newPassword !== confirmPassword)} style={{ width: '100%' }}>
              {loading ? (
                <>
                  <span style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Salvataggio...
                </>
              ) : (
                <>
                  <Lock size={18} />
                  Reimposta password
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
