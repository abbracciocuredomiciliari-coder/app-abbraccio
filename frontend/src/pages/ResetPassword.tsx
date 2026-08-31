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
        <div className="tw-max-w-md tw-mx-auto tw-text-center">
          <div className="tw-bg-red-600/[0.07] tw-border tw-border-red-300 tw-rounded-[10px] tw-p-5 tw-text-red-900">
            <AlertCircle size={24} className="tw-mb-2" />
            <p className="tw-m-0 tw-font-semibold">Link non valido.</p>
            <p className="tw-mt-2 tw-mb-0 tw-text-[0.88rem]">Richiedi un nuovo link dalla pagina di login.</p>
          </div>
          <Link to="/" className="tw-inline-flex tw-items-center tw-gap-1 tw-mt-4 tw-text-brand tw-no-underline tw-font-medium">
            <ArrowLeft size={14} /> Torna al login
          </Link>
        </div>
      </section>
    );
  }

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
        <h2 className="tw-m-0 tw-text-[1.75rem]">Nuova password</h2>
        <p className="tw-text-slate-500 tw-mt-2">
          Scegli una nuova password sicura per il tuo account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="login-form tw-max-w-md tw-mx-auto">
        {success && (
          <div className="tw-flex tw-items-start tw-gap-2.5 tw-px-4 tw-py-3.5 tw-bg-green-600/[0.08] tw-border tw-border-green-300 tw-rounded-md tw-text-green-700 tw-text-[0.92rem]">
            <CheckCircle size={20} className="tw-flex-shrink-0 tw-mt-px" />
            <div>
              <div className="tw-font-bold tw-mb-1">{success}</div>
              <Link to="/" className="tw-text-green-600 tw-font-semibold tw-underline">Vai al login →</Link>
            </div>
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
                <Lock size={16} /> Nuova password
              </span>
              <div className="tw-relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 8 caratteri, 1 lettera, 1 numero"
                  required
                  className="tw-pr-10 tw-w-full"
                />
                <button type="button" onClick={() => setShowNew(v => !v)}
                  className="tw-absolute tw-right-2.5 tw-top-1/2 tw--translate-y-1/2 tw-bg-transparent tw-border-0 tw-cursor-pointer tw-text-slate-400 tw-p-0.5">
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <label>
              <span className="tw-inline-flex tw-items-center tw-gap-1.5">
                <Lock size={16} /> Conferma password
              </span>
              <div className="tw-relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Ripeti la nuova password"
                  required
                  className="tw-pr-10 tw-w-full"
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="tw-absolute tw-right-2.5 tw-top-1/2 tw--translate-y-1/2 tw-bg-transparent tw-border-0 tw-cursor-pointer tw-text-slate-400 tw-p-0.5">
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <span className="tw-text-red-600 tw-text-[0.78rem] tw-mt-1 tw-block">Le password non coincidono</span>
              )}
            </label>

            <button type="submit" disabled={loading || (!!confirmPassword && newPassword !== confirmPassword)} className="tw-w-full">
              {loading ? (
                <>
                  <span className="tw-w-[18px] tw-h-[18px] tw-border-2 tw-border-white/30 tw-border-t-white tw-rounded-full tw-animate-spin" />
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

        <p className="tw-text-center tw-text-[0.88rem] tw-text-slate-500 tw-m-0">
          <Link to="/" className="tw-inline-flex tw-items-center tw-gap-1 tw-text-brand tw-no-underline tw-font-medium">
            <ArrowLeft size={14} /> Torna al login
          </Link>
        </p>
      </form>
    </section>
  );
}
