import React from 'react';
import { X, ShieldAlert, LifeBuoy, Send, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h2>
                <button 
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function RestrictedModal({ isOpen, onClose, authorizationHold = false }: { isOpen: boolean; onClose: () => void; authorizationHold?: boolean }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={authorizationHold ? "Transfer Authorization Hold" : "Transfer Restricted"}>
      <div className="flex flex-col items-center text-center gap-6">
        <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-500 mb-2">
          <ShieldAlert className="w-10 h-10" />
        </div>
        
        <div className="space-y-4">
          <p className="text-xs font-bold text-rose-600 uppercase tracking-widest text-[10px]">
            {authorizationHold ? 'Authorization Code Required' : 'Security Lock Active'}
          </p>
          <p className="text-slate-700 leading-relaxed font-bold text-sm">
            {authorizationHold
              ? 'This transfer is on hold. Obtain your Authorization Code from the administrator before continuing.'
              : 'Account has been restricted from making transfers. Additional details should be submitted at the bank or talk to an account officer.'}
          </p>
          <p className="text-slate-500 leading-relaxed text-xs">
            {authorizationHold
              ? 'After the administrator assigns the code, it will appear in your notification center. Return to the transfer page and enter that code to proceed.'
              : 'For security, compliance, identity verification, and fraud prevention purposes, outgoing transaction services are restricted. Please consult your relationship officer or find your nearest branch.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full mt-4">
          <button 
            onClick={onClose}
            className="flex-1 bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 transition-all uppercase tracking-wider text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function TransferSuccessModal({ 
  isOpen, 
  onClose, 
  amount, 
  recipientName, 
  bankName, 
  accountNumber,
  formatUserCurrency
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  amount: number; 
  recipientName: string; 
  bankName: string; 
  accountNumber: string; 
  formatUserCurrency?: (amount: number) => string;
}) {
  const displayAmount = formatUserCurrency 
    ? formatUserCurrency(amount) 
    : `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transfer Pending">
      <div className="flex flex-col items-center text-center gap-6">
        <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-500 mb-2 animate-pulse">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-[10px]">Processing Transfer</p>
          <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {displayAmount}
          </p>
        </div>

        <div className="w-full bg-slate-50 rounded-2xl p-6 text-left space-y-4 border border-slate-100">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Recipient Name</span>
            <span className="font-bold text-slate-800">{recipientName}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Bank Name</span>
            <span className="font-bold text-slate-800">{bankName}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Account Number</span>
            <span className="font-bold text-slate-800">{accountNumber}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Status</span>
            <span className="px-2.5 py-1 bg-amber-50 text-amber-600 font-bold rounded-full uppercase tracking-widest text-[9px]">
              Pending
            </span>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full bg-[#003399] text-white font-bold py-4 rounded-2xl hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/10 uppercase tracking-wider text-xs"
        >
          Done
        </button>
      </div>
    </Modal>
  );
}

export function TransferCodeModal({
  isOpen,
  onClose,
  onVerify,
  amount,
  userPin,
  formatUserCurrency
}: {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (pin: string) => Promise<void>;
  amount: number;
  userPin?: string;
  formatUserCurrency?: (amount: number) => string;
}) {
  const [enteredPin, setEnteredPin] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const displayAmount = formatUserCurrency 
    ? formatUserCurrency(amount) 
    : `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onVerify(enteredPin);
      setEnteredPin('');
    } catch (err: any) {
      setError(err.message || 'Invalid Transaction PIN. Authorizer mismatch.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : onClose} title="Transfer Authorization">
      <form onSubmit={handleVerify} className="space-y-6">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-[#003399] mb-1">
            <svg className="w-8 h-8 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">Confirm & Authorize</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              Enter the secure transfer PIN to confirm the payment of <strong className="text-slate-900">{displayAmount}</strong>.
            </p>
          </div>

          <div className="text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100 px-4 py-2 rounded-full uppercase tracking-widest flex items-center gap-2 mt-1 select-none">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Status: Pending PIN Authorization
          </div>

          {loading ? (
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="w-10 h-10 border-4 border-[#003399] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Verifying Transfer Code...</p>
            </div>
          ) : (
            <div className="w-full max-w-xs py-4 space-y-2">
              <input
                type="password"
                maxLength={8}
                value={enteredPin}
                onChange={(e) => {
                  setError('');
                  setEnteredPin(e.target.value.replace(/\D/g, ''));
                }}
                placeholder="••••"
                className="w-full h-12 text-center bg-slate-50 border border-slate-100 rounded-xl text-xl font-bold focus:bg-white focus:border-blue-200 outline-none transition-all font-mono tracking-widest"
                required
                autoFocus
              />
            </div>
          )}

          {error && (
            <p className="text-xs font-bold text-rose-500 text-center bg-rose-50 py-3 px-6 rounded-lg border border-rose-100 italic w-full">
              {error}
            </p>
          )}

          {!loading && (
            <button
              type="submit"
              className="w-full bg-[#003399] text-white font-bold py-4 rounded-2xl hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/10 uppercase tracking-wider text-xs"
            >
              Verify & Complete Transfer
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

export function TransferVerificationModal({
  isOpen,
  onClose,
  onVerified
}: {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (token: string) => void;
}) {
  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [noCode, setNoCode] = React.useState(false);

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true); setError(''); setNoCode(false);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/transfer-verification/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code })
      });
      const payload = await response.json();
      if (!response.ok) {
        const message = payload?.error?.message || 'Transfer verification failed';
        setNoCode(message.includes('No Transfer Verification Code'));
        throw new Error(message);
      }
      setCode('');
      onVerified(payload.data.verification_token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return <Modal isOpen={isOpen} onClose={loading ? () => {} : onClose} title="Transfer Verification Required">
    <form onSubmit={verify} className="space-y-5">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#003399] flex items-center justify-center mx-auto">
        <ShieldCheck className="w-8 h-8" />
      </div>
      <p className="text-sm text-slate-500 text-center leading-relaxed">
        Before this transfer can be processed, enter the Transfer Verification Code assigned to your account.
      </p>
      <div><label className="form-label">Transfer Verification Code</label>
        <input type="password" inputMode="numeric" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          minLength={6} maxLength={12} required autoFocus className="field-control text-center tracking-[0.35em] text-lg" placeholder="••••••••" /></div>
      {error && <div className="p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold text-center">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={onClose} disabled={loading} className="py-3 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold">Cancel</button>
        <button disabled={loading} className="py-3 rounded-xl bg-[#003399] text-white text-xs font-bold">{loading ? 'Verifying…' : 'Verify Code'}</button>
      </div>
      {noCode && <a href="mailto:support@bluecrest.example?subject=Transfer verification code support"
        className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center gap-2">
        <LifeBuoy className="w-4 h-4" /> Contact Support
      </a>}
    </form>
  </Modal>;
}

