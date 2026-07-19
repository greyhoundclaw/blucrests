import React, { useState, useEffect } from 'react';
import { Send, User, Building2, CreditCard, FileText, Globe, KeyRound, MapPin } from 'lucide-react';

interface TransferSubmitData {
  recipientName: string;
  bankName: string;
  accountNumber: string;
  routingNumber?: string;
  swiftCode?: string;
  country?: string;
  amount: number;
  description: string;
  transferType: 'INTERNAL' | 'EXTERNAL';
}

export default function TransferPage({ 
  onTransferSubmit,
  availableBalance,
  currencySymbol = '$',
  formatUserCurrency
}: { 
  onTransferSubmit: (data: TransferSubmitData) => void;
  availableBalance: number;
  currencySymbol?: string;
  formatUserCurrency?: (amount: number) => string;
}) {
  const [transferType, setTransferType] = useState<'same-bank' | 'external' | 'wire'>('same-bank');
  
  // Form fields
  const [recipientName, setRecipientName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [swiftCode, setSwiftCode] = useState('');
  const [country, setCountry] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  // Lookup state for Same Bank
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [resolvedRecipientName, setResolvedRecipientName] = useState('');

  // Automatically lookup same bank account
  useEffect(() => {
    if (transferType !== 'same-bank') {
      setResolvedRecipientName('');
      setLookupError('');
      return;
    }

    if (!accountNumber || accountNumber.trim().length < 4) {
      setResolvedRecipientName('');
      setLookupError('');
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLookupLoading(true);
      setLookupError('');
      setResolvedRecipientName('');
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`/api/v1/users/lookup?account_number=${encodeURIComponent(accountNumber.trim())}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (res.ok && data.data) {
          setResolvedRecipientName(`${data.data.first_name} ${data.data.last_name}`);
          setLookupError('');
        } else {
          setLookupError('Recipient account not found');
        }
      } catch (err) {
        setLookupError('Recipient account not found');
      } finally {
        setLookupLoading(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [accountNumber, transferType]);

  // Handle Tab Switch
  const handleTabChange = (type: 'same-bank' | 'external' | 'wire') => {
    setTransferType(type);
    // Clear values
    setRecipientName('');
    setBankName('');
    setAccountNumber('');
    setSwiftCode('');
    setCountry('');
    setAmount('');
    setDescription('');
    setResolvedRecipientName('');
    setLookupError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let finalRecipientName = recipientName;
    let finalBankName = bankName;
    let finalDescription = description;
    let finalTransferType: 'INTERNAL' | 'EXTERNAL' = 'EXTERNAL';

    if (transferType === 'same-bank') {
      if (!resolvedRecipientName) {
        setLookupError('Please enter a valid recipient account number.');
        return;
      }
      finalRecipientName = resolvedRecipientName;
      finalBankName = 'Blue Crest Bank';
      finalTransferType = 'INTERNAL';
    } else if (transferType === 'external') {
      finalTransferType = 'EXTERNAL';
    } else if (transferType === 'wire') {
      finalTransferType = 'EXTERNAL';
      // Append SWIFT and Country to the description to make it fully visible to admin
      const wireDetails = `[SWIFT: ${swiftCode.trim().toUpperCase()}, Country: ${country.trim()}]`;
      finalDescription = description ? `${description.trim()} ${wireDetails}` : `Wire Transfer ${wireDetails}`;
    }

    onTransferSubmit({
      recipientName: finalRecipientName || 'Unspecified Recipient',
      bankName: finalBankName || 'External Bank',
      accountNumber: accountNumber.trim(),
      swiftCode: transferType === 'wire' ? swiftCode.trim() : undefined,
      country: transferType === 'wire' ? country.trim() : undefined,
      amount: parseFloat(amount) || 0,
      description: finalDescription || 'Fund Transfer',
      transferType: finalTransferType
    });
    
    // Clear form
    setRecipientName('');
    setBankName('');
    setAccountNumber('');
    setSwiftCode('');
    setCountry('');
    setAmount('');
    setDescription('');
    setResolvedRecipientName('');
    setLookupError('');
  };

  const isSameBank = transferType === 'same-bank';
  const isExternal = transferType === 'external';
  const isWire = transferType === 'wire';

  const isSubmitDisabled = isSameBank && (!resolvedRecipientName || !!lookupError || lookupLoading);

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="bg-white rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-slate-100">
        
        {/* Title and Tabs Header */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-10">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Send className="w-5 h-5 text-[#003399]" />
            Transfer Funds
          </h2>
          
          {/* Three Transfer Tabs */}
          <div className="flex flex-wrap bg-slate-50 p-1 rounded-2xl border border-slate-100 w-full xl:w-auto gap-1">
            <button 
              type="button"
              onClick={() => handleTabChange('same-bank')}
              className={`flex-1 xl:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${isSameBank ? 'bg-white text-[#003399] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Same Bank
            </button>
            <button 
              type="button"
              onClick={() => handleTabChange('external')}
              className={`flex-1 xl:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${isExternal ? 'bg-white text-[#003399] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              External Transfer
            </button>
            <button 
              type="button"
              onClick={() => handleTabChange('wire')}
              className={`flex-1 xl:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${isWire ? 'bg-white text-[#003399] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Wire Transfer
            </button>
          </div>
        </div>

        <form className="space-y-8" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Account Number (All Types) */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                {isSameBank ? 'Recipient Account Number' : 'Account Number / IBAN'}
              </label>
              <div className="relative">
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input 
                  type="text" 
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/[^\w-]/g, ''))}
                  className="w-full h-14 bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-100 rounded-2xl pl-12 pr-4 text-sm font-semibold outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Recipient Bank (External & Wire Only) */}
            {!isSameBank && (
              <div className="space-y-2 animate-fadeIn">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Recipient Bank Name</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <input 
                    type="text" 
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full h-14 bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-100 rounded-2xl pl-12 pr-4 text-sm font-semibold outline-none transition-all"
                    required
                  />
                </div>
              </div>
            )}

            {/* Recipient Account Name / Validation Box */}
            {isSameBank ? (
              <div className="space-y-2 flex flex-col justify-end min-h-[5rem]">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Recipient Name</label>
                <div className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 flex items-center transition-all select-none">
                  {lookupLoading ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <div className="w-4 h-4 border-2 border-[#003399] border-t-transparent rounded-full animate-spin" />
                      Searching member database...
                    </div>
                  ) : resolvedRecipientName ? (
                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-600">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      {resolvedRecipientName}
                    </div>
                  ) : lookupError ? (
                    <div className="text-xs font-bold text-rose-500 italic uppercase tracking-wider">
                      {lookupError}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Recipient Account Holder Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <input 
                    type="text" 
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full h-14 bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-100 rounded-2xl pl-12 pr-4 text-sm font-semibold outline-none transition-all"
                    required
                  />
                </div>
              </div>
            )}

            {/* SWIFT / BIC Code (Wire Only) */}
            {isWire && (
              <div className="space-y-2 animate-fadeIn">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">SWIFT / BIC Code</label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <input 
                    type="text" 
                    value={swiftCode}
                    onChange={(e) => setSwiftCode(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
                    className="w-full h-14 bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-100 rounded-2xl pl-12 pr-4 text-sm font-semibold outline-none transition-all uppercase"
                    required
                  />
                </div>
              </div>
            )}

            {/* Country (Wire Only) */}
            {isWire && (
              <div className="space-y-2 animate-fadeIn">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Recipient Country</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <input 
                    type="text" 
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full h-14 bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-100 rounded-2xl pl-12 pr-4 text-sm font-semibold outline-none transition-all"
                    required
                  />
                </div>
              </div>
            )}

            {/* Amount Field (All Types) */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Amount ({currencySymbol})</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">{currencySymbol}</span>
                <input 
                  type="number" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  step="any"
                  className="w-full h-14 bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-100 rounded-2xl pl-10 pr-4 text-sm font-semibold outline-none transition-all"
                  required
                />
              </div>
            </div>
          </div>

          {/* Description (All Types) */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Description (Optional)</label>
            <div className="relative">
              <FileText className="absolute left-4 top-6 w-5 h-5 text-slate-300" />
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-32 bg-slate-50 border border-slate-100 focus:bg-white focus:border-blue-100 rounded-2xl pl-12 pr-4 py-5 text-sm font-semibold outline-none transition-all resize-none"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 text-center">
            <button 
              type="submit"
              disabled={isSubmitDisabled}
              className={`w-full font-bold py-5 rounded-[1.5rem] transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 transform ${isSubmitDisabled ? 'bg-slate-100 text-slate-400 shadow-none cursor-not-allowed' : 'bg-[#003399] text-white hover:bg-blue-800 shadow-blue-900/10'}`}
            >
              <Send className="w-5 h-5" />
              {isSameBank ? 'Transfer Now' : isExternal ? 'Initiate External Transfer' : 'Initiate Wire Transfer'}
            </button>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-6">
              Total available balance: {formatUserCurrency ? formatUserCurrency(availableBalance) : `${currencySymbol}${availableBalance.toLocaleString()}`}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
