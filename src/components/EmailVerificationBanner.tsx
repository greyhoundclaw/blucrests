import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2, Mail, ShieldAlert } from 'lucide-react';

interface EmailVerificationBannerProps {
  user: any;
  onVerified: () => void;
}

export default function EmailVerificationBanner({ user, onVerified }: EmailVerificationBannerProps) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setCode('');
    setMessage('');
    setError('');
  }, [user?.email]);

  const request = async (path: string, payload?: Record<string, string>) => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload || {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error?.message || data?.message || 'Unable to confirm email');
    }
    return data;
  };

  const resend = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await request('/api/v1/auth/email-verification/send');
      setMessage(`A new confirmation code was sent to ${user.email}. If it is not in your inbox, check your Spam or Junk folder.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the complete 6-digit confirmation code.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await request('/api/v1/auth/email-verification/verify', { code });
      setMessage('Email address confirmed successfully.');
      onVerified();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verified = Number(user?.email_verified) === 1 || user?.email_verified === true;
  if (verified) {
    return (
      <div className="max-w-7xl mx-auto mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700">
        <CheckCircle2 className="h-4 w-4" /> Email verified
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-900">Email verification pending</h2>
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-800">Pending</span>
            </div>
            <p className="mt-1 text-xs text-slate-600">Enter the code sent to <strong>{user.email}</strong>, or request a new one.</p>
            <p className="mt-1 text-[11px] font-bold text-amber-800">Cannot find the email? Please check your Spam or Junk folder and mark Blue Crest as a trusted sender.</p>
          </div>
        </div>

        <form onSubmit={verify} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="Six-digit email confirmation code"
            placeholder="6-digit code"
            className="h-11 w-full rounded-xl border border-amber-200 bg-white px-4 text-center text-sm font-extrabold tracking-[0.25em] outline-none focus:border-blue-500 sm:w-44"
          />
          <button disabled={busy} className="h-11 rounded-xl bg-[#003399] px-5 text-xs font-bold text-white disabled:opacity-60">
            {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Confirm email'}
          </button>
          <button type="button" onClick={resend} disabled={busy} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 text-xs font-bold text-amber-800 disabled:opacity-60">
            <Mail className="h-4 w-4" /> Resend code
          </button>
        </form>
      </div>
      {(message || error) && <p className={`mt-3 text-xs font-bold ${error ? 'text-rose-600' : 'text-emerald-700'}`}>{error || message}</p>}
    </div>
  );
}
