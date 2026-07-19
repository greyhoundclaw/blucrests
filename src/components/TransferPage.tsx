import React, { useEffect, useState } from 'react';
import { Building2, CreditCard, FileText, Send, User } from 'lucide-react';

interface TransferSubmitData {
  recipientName: string;
  bankName: string;
  accountNumber: string;
  amount: number;
  description: string;
  transferType: 'INTERNAL' | 'EXTERNAL';
}

interface TransferPageProps {
  onTransferSubmit: (data: TransferSubmitData) => void;
  availableBalance: number;
  currencySymbol?: string;
  formatUserCurrency?: (amount: number) => string;
}

export default function TransferPage({ onTransferSubmit, availableBalance, currencySymbol = '$', formatUserCurrency }: TransferPageProps) {
  const [recipientName, setRecipientName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupComplete, setLookupComplete] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [resolvedRecipientName, setResolvedRecipientName] = useState('');

  useEffect(() => {
    const normalizedAccount = accountNumber.trim();
    setResolvedRecipientName('');
    setLookupComplete(false);
    setLookupError('');

    if (normalizedAccount.length < 4) return;

    const delayDebounce = setTimeout(async () => {
      setLookupLoading(true);
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`/api/v1/users/lookup?account_number=${encodeURIComponent(normalizedAccount)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = await response.json();

        if (response.ok && result.data) {
          setResolvedRecipientName(`${result.data.first_name} ${result.data.last_name}`.trim());
          setRecipientName('');
          setBankName('');
        } else if (response.status !== 404) {
          setLookupError('We could not verify this account. Please try again.');
        }
      } catch {
        setLookupError('We could not verify this account. Please try again.');
      } finally {
        setLookupLoading(false);
        setLookupComplete(true);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [accountNumber]);

  const isInternal = Boolean(resolvedRecipientName);
  const showRecipientDetails = lookupComplete && !lookupLoading && !lookupError;
  const isSubmitDisabled = lookupLoading || !lookupComplete || Boolean(lookupError);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitDisabled) return;

    onTransferSubmit({
      recipientName: isInternal ? resolvedRecipientName : recipientName.trim(),
      bankName: isInternal ? 'Blue Crest Bank' : bankName.trim(),
      accountNumber: accountNumber.trim(),
      amount: Number.parseFloat(amount) || 0,
      description: description.trim() || 'Bank Transfer',
      transferType: isInternal ? 'INTERNAL' : 'EXTERNAL'
    });

    setRecipientName('');
    setBankName('');
    setAccountNumber('');
    setAmount('');
    setDescription('');
    setResolvedRecipientName('');
    setLookupComplete(false);
    setLookupError('');
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="bg-white rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-slate-100">
        <div className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Send className="w-5 h-5 text-[#003399]" /> Bank Transfer
          </h2>
          <p className="mt-2 text-sm text-slate-500">Send money to a Blue Crest account or any other bank.</p>
        </div>

        <form className="space-y-8" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Account Number</label>
              <div className="relative">
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input type="text" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value.replace(/[^\w-]/g, ''))} minLength={4} required className="w-full h-14 bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-100 rounded-2xl pl-12 pr-4 text-sm font-semibold outline-none transition-all" />
              </div>
              {lookupLoading && <p className="text-xs font-semibold text-slate-400 ml-1">Checking account…</p>}
              {lookupError && <p className="text-xs font-semibold text-rose-500 ml-1">{lookupError}</p>}
            </div>

            {showRecipientDetails && isInternal && (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Account Name</label>
                  <div className="h-14 bg-emerald-50 border border-emerald-100 rounded-2xl px-5 flex items-center gap-3 text-sm font-bold text-emerald-700"><User className="w-5 h-5" />{resolvedRecipientName}</div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Bank Name</label>
                  <div className="h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 flex items-center gap-3 text-sm font-bold text-slate-700"><Building2 className="w-5 h-5 text-slate-400" />Blue Crest Bank</div>
                </div>
              </>
            )}

            {showRecipientDetails && !isInternal && (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Account Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input type="text" value={recipientName} onChange={(event) => setRecipientName(event.target.value)} required className="w-full h-14 bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-100 rounded-2xl pl-12 pr-4 text-sm font-semibold outline-none transition-all" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Bank Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input type="text" value={bankName} onChange={(event) => setBankName(event.target.value)} required className="w-full h-14 bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-100 rounded-2xl pl-12 pr-4 text-sm font-semibold outline-none transition-all" />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Amount ({currencySymbol})</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">{currencySymbol}</span>
                <input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} min="0.01" step="any" required className="w-full h-14 bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-100 rounded-2xl pl-10 pr-4 text-sm font-semibold outline-none transition-all" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Description (Optional)</label>
            <div className="relative">
              <FileText className="absolute left-4 top-6 w-5 h-5 text-slate-300" />
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="w-full h-32 bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-100 rounded-2xl pl-12 pr-4 py-5 text-sm font-semibold outline-none transition-all resize-none" />
            </div>
          </div>

          <div className="pt-4 text-center">
            <button type="submit" disabled={isSubmitDisabled} className={`w-full font-bold py-5 rounded-[1.5rem] transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 transform ${isSubmitDisabled ? 'bg-slate-100 text-slate-400 shadow-none cursor-not-allowed' : 'bg-[#003399] text-white hover:bg-blue-800 shadow-blue-900/10'}`}>
              <Send className="w-5 h-5" /> Continue Transfer
            </button>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-6">Total available balance: {formatUserCurrency ? formatUserCurrency(availableBalance) : `${currencySymbol}${availableBalance.toLocaleString()}`}</p>
          </div>
        </form>
      </div>
    </div>
  );
}
