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
      <div className="tw-text-center tw-mb-8">
        <div className="tw-w-16 tw-h-16 tw-mx-auto tw-mb-4 tw-rounded-2xl tw-flex tw-items-center tw-justify-center"
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            boxShadow: '0 12px 24px rgba(79,70,229,0.3)',
          }}>
          <Heart size={32} color="white" />
        </div>
        <h2 className="tw-m-0 tw-text-[1.75rem]">Password dimenticata?</h2>
        <p className="tw-text-slate-500 tw-mt-2">
          Inserisci la tua email e ti invieremo un link per reimpostarla.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="login-form tw-max-w-md tw-mx-auto">
        {success && (
          <div className="tw-flex tw-items-start tw-gap-2.5 tw-px-4 tw-py-3.5 tw-bg-green-600/[0.08] tw-border tw-border-green-300 tw-rounded-md tw-text-green-700 tw-text-[0.92rem]">
            <CheckCircle size={20} className="tw-flex-shrink-0 tw-mt-px" />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="tw-flex tw-items-center tw-gap-2 tw-px-4 tw-py-3 tw-bg-red-600/[0.08] tw-border tw-border-red-600/20 tw-rounded-md tw-text-red-600 tw-text-[0.92rem]">
            <AlertCircle size={18} className="tw-flex-shrink-0" />
            {error}
          </div>
        )}

        {!success && (
          <>
            <label>
              <span className="tw-inline-flex tw-items-center tw-gap-1.5">
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

            <button type="submit" disabled={loading} className="tw-w-full">
              {loading ? (
                <>
                  <span className="tw-w-[18px] tw-h-[18px] tw-border-2 tw-border-white/30 tw-border-t-white tw-rounded-full tw-animate-spin" />
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

        <p className="tw-text-center tw-text-[0.88rem] tw-text-slate-500 tw-m-0">
          <Link to="/" className="tw-inline-flex tw-items-center tw-gap-1 tw-text-brand tw-no-underline tw-font-medium">
            <ArrowLeft size={14} /> Torna al login
          </Link>
        </p>
      </form>
    </section>
  );
}
