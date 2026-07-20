import React, { useState, useEffect } from 'react';
import { DollarSign, ShieldAlert, Sparkles, Clock, CheckCircle2, ChevronRight, Calculator, AlertCircle } from 'lucide-react';
import { getTranslation, LanguageCode } from '../lib/translations';

interface LoansPageProps {
  user: any;
  onNavigateToTab: (tabId: string) => void;
  lang?: LanguageCode;
  formatUserCurrency?: (amount: number) => string;
}

export interface Loan {
  id: string;
  amount: number;
  purpose: string;
  repaymentMonths: number;
  status: 'PENDING' | 'APPROVED' | 'AWAITING_DISBURSEMENT_FEE' | 'READY_FOR_DISBURSEMENT' | 'DISBURSED' | 'REJECTED';
  fee: number;
  createdDate: string;
}

const MAX_ELIGIBLE_LOAN = 1500;

export default function LoansPage({ user, onNavigateToTab, lang = 'en', formatUserCurrency }: LoansPageProps) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [repaymentMonths, setRepaymentMonths] = useState('12');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const t = (key: string, fallback: string = "") => getTranslation(lang, key, fallback);
  const userKycVerified = user.kycStatus === 'Verified' || user.kycStatus === 'VERIFIED' || user.kyc_status === 'VERIFIED' || user.kyc_status === 'Verified';

  // Fee Calculation helper
  const parsedAmount = Number(amount) || 0;
  const calculatedFee = Number((parsedAmount * 0.05).toFixed(2));
  const estimatedMonthly = Number((parsedAmount * 1.05 / Number(repaymentMonths || 12)).toFixed(2));

  const formatCurrency = formatUserCurrency || ((amt: number) => `$${amt.toLocaleString()}`);

  // Fetch loans on component load
  useEffect(() => {
    fetchLoans();
  }, [user.id]);

  const fetchLoans = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!user.id) return;
      const response = await fetch(`/api/v1/loans/user/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const resData = await response.json();
        const rawLoans = resData.data || resData;
        if (Array.isArray(rawLoans)) {
          const mappedLoans = rawLoans.map((l: any) => ({
            id: l.id.toString(),
            amount: l.requested_amount,
            purpose: l.purpose,
            repaymentMonths: l.repayment_months,
            status: l.status,
            fee: l.escrow_fee !== undefined ? l.escrow_fee : Number((l.requested_amount * 0.05).toFixed(2)),
            createdDate: l.created_at ? l.created_at.split('T')[0] : new Date().toISOString().split('T')[0]
          }));
          setLoans(mappedLoans);
        }
      }
    } catch (err) {
      console.error("Error fetching loans:", err);
    } finally {
      setIsPageLoading(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (parsedAmount <= 0) {
      setErrorMsg('Please enter a valid loan amount greater than 0.');
      return;
    }

    if (parsedAmount > MAX_ELIGIBLE_LOAN) {
      setErrorMsg(`Your current eligible loan amount is ${formatCurrency(MAX_ELIGIBLE_LOAN)}.`);
      return;
    }

    if (!purpose) {
      setErrorMsg('Please specify a purpose for this loan request.');
      return;
    }

    setIsLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/loans', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          requested_amount: parsedAmount,
          purpose,
          repayment_months: Number(repaymentMonths),
          monthly_payment: estimatedMonthly
        })
      });

      setIsLoading(false);
      const data = await response.json();

      if (!response.ok) {
        setErrorMsg(data.error?.message || data.error || 'Failed to submit loan request.');
        return;
      }

      setSuccessMsg('Your loan application was successfully submitted! It is now pending compliance review.');
      setAmount('');
      setPurpose('');
      fetchLoans();
    } catch (err) {
      setIsLoading(false);
      setErrorMsg('Connection error. Please try again.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-3 py-1 text-[10px] font-bold tracking-wider rounded-full bg-amber-50 text-amber-600 border border-amber-100">PENDING AUDIT</span>;
      case 'APPROVED':
        return <span className="px-3 py-1 text-[10px] font-bold tracking-wider rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">LOAN APPROVED</span>;
      case 'AWAITING_DISBURSEMENT_FEE':
        return <span className="px-3 py-1 text-[10px] font-bold tracking-wider rounded-full bg-blue-50 text-[#003399] border border-blue-100 animate-pulse">AWAITING ESCROW FEE</span>;
      case 'READY_FOR_DISBURSEMENT':
        return <span className="px-3 py-1 text-[10px] font-bold tracking-wider rounded-full bg-teal-50 text-teal-600 border border-teal-100">READY</span>;
      case 'DISBURSED':
        return <span className="px-3 py-1 text-[10px] font-bold tracking-wider rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">ACTIVE DISBURSED</span>;
      case 'REJECTED':
        return <span className="px-3 py-1 text-[10px] font-bold tracking-wider rounded-full bg-rose-50 text-rose-600 border border-rose-100">REJECTED</span>;
      default:
        return <span className="px-3 py-1 text-[10px] font-bold tracking-wider rounded-full bg-slate-50 text-slate-500">{status}</span>;
    }
  };

  // If NOT KYC VERIFIED, show beautifully premium warning
  if (!userKycVerified) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-[2.5rem] p-10 text-center shadow-sm border border-slate-50 flex flex-col items-center">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mb-6">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold font-sans text-slate-800 tracking-tight mb-3">Verify Your KYC to Qualify</h2>
          <p className="text-slate-500 text-sm max-w-lg mx-auto font-medium leading-relaxed mb-8">
            Verify your KYC to qualify for a loan of up to {formatCurrency(MAX_ELIGIBLE_LOAN)} with Tier 1 deposits.
          </p>

          <button
            onClick={() => onNavigateToTab('kyc')}
            className="h-14 px-8 bg-[#003399] text-white font-bold rounded-xl flex items-center gap-3 hover:bg-blue-800 transition-all active:scale-[0.98] shadow-lg shadow-blue-900/10"
          >
            Go to Identity Verification
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      {/* Dynamic Header */}
      <div className="bg-gradient-to-br from-[#003399] to-blue-900 rounded-[2.5rem] p-8 md:p-10 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="absolute right-0 bottom-0 top-0 opacity-10 flex items-center justify-center pointer-events-none">
          <DollarSign className="w-80 h-80 text-white" />
        </div>
        <div className="space-y-3 shrink-0 relative z-10 text-center md:text-left">
          <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            KYC Verified · Tier 1 Eligible
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Flexible Asset Financing</h2>
          <p className="text-blue-100/80 text-sm max-w-sm">Drawn capital carries an origination fee of 5.0% and is fully backed by real reserves.</p>
        </div>

        <div className="bg-white/10 border border-white/10 rounded-3xl p-6 text-center shrink-0 backdrop-blur-sm relative z-10 min-w-48">
          <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1">Max Borrow Limit</p>
          <p className="text-3xl font-extrabold">{formatCurrency(MAX_ELIGIBLE_LOAN)}</p>
          <p className="text-[10px] text-blue-200 mt-1 font-bold">5.0% Fixed APR</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Application Form */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-50 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 text-[#003399] rounded-xl flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-lg">Apply For Loan</h3>
          </div>

          {successMsg && (
            <div className="bg-emerald-50 text-emerald-700 text-xs font-bold p-4 rounded-2xl border border-emerald-100 text-center">
              {successMsg}
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-50 text-rose-600 text-xs font-bold p-4 rounded-2xl border border-rose-100 text-center">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleApply} className="space-y-4">
            
            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
                Loan Amount (USD)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                <input 
                  type="number"
                  min="1"
                  max={MAX_ELIGIBLE_LOAN}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Up to 1,500"
                  className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl pl-8 pr-4 text-sm font-semibold outline-none focus:bg-white focus:border-blue-200 transition-all"
                  required
                />
              </div>
            </div>

            {/* Repayment Term */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
                Repayment Term
              </label>
              <select 
                value={repaymentMonths}
                onChange={(e) => setRepaymentMonths(e.target.value)}
                className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-sm font-semibold outline-none focus:bg-white focus:border-blue-200 transition-all cursor-pointer"
              >
                <option value="6">6 Months</option>
                <option value="12">12 Months (1 Year)</option>
                <option value="24">24 Months (2 Years)</option>
                <option value="36">36 Months (3 Years)</option>
                <option value="60">60 Months (5 Years)</option>
              </select>
            </div>

            {/* Loan Purpose */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
                Purpose/Description
              </label>
              <input 
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Real estate expansion, emergency liquidity"
                className="w-full h-12 bg-slate-50 border border-slate-100 rounded-xl px-4 text-sm font-semibold outline-none focus:bg-white focus:border-blue-200 transition-all"
                required
              />
            </div>

            {/* Real-time Calculation Card */}
            {parsedAmount > 0 && (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3 font-semibold">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Origination Fee (5%)</span>
                  <span className="text-slate-800 font-bold">{formatCurrency(calculatedFee)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Estimated Repayment/Mo</span>
                  <span className="text-slate-800 font-bold">{formatCurrency(estimatedMonthly)} / mo</span>
                </div>
                <p className="text-[10px] text-[#003399] font-bold leading-relaxed border-t border-slate-100 pt-2 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Note: A 5% escrow clearance fee is billed on approval before disbursement.
                </p>
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-[#003399] text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-blue-800 transition-all active:scale-[0.98] disabled:opacity-70 shadow-md shadow-blue-900/5"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Submit Loan Application'
              )}
            </button>

          </form>
        </div>

        {/* Repayments Or Status Listing */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-50 flex flex-col justify-between">
          <div className="space-y-6 w-full">
            <h3 className="font-bold text-slate-800 text-lg">My Loans / Applications</h3>

            {isPageLoading ? (
              <div className="py-20 text-center">
                <div className="w-8 h-8 border-4 border-blue-100 border-t-[#003399] rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-400 text-xs font-semibold">Retrieving Loan History...</p>
              </div>
            ) : loans.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-3xl p-6">
                <p className="text-slate-400 text-xs font-semibold">No loans submitted yet.</p>
                <p className="text-[10px] text-slate-400 mt-2">Fill the application on the left to start drawing financing reserves.</p>
              </div>
            ) : (
              <div className="max-h-[320px] overflow-y-auto space-y-4 pr-1">
                {loans.map((loan) => (
                  <div key={loan.id} className="border border-slate-100 rounded-2xl p-4 hover:border-slate-200 transition-all">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-xs font-medium text-slate-400">{loan.id}</span>
                      {getStatusBadge(loan.status)}
                    </div>
                    
                    <div className="flex justify-between items-end">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm mb-0.5">{formatCurrency(loan.amount)}</h4>
                        <p className="text-[11px] text-slate-400 font-semibold max-w-[200px] truncate">{loan.purpose}</p>
                      </div>
                      <div className="text-right text-[11px]">
                        <p className="text-slate-500 font-bold">{loan.repaymentMonths} mo term</p>
                        <p className="text-slate-400 font-semibold">Fee: {formatCurrency(loan.fee)}</p>
                      </div>
                    </div>

                    {/* Escrow Fee Specific Prompt Case */}
                    {loan.status === 'AWAITING_DISBURSEMENT_FEE' && (
                      <div className="mt-3 p-3 bg-blue-50/50 border border-blue-100/60 rounded-xl space-y-1.5 font-sans">
                        <p className="text-[10px] font-bold text-[#003399] uppercase tracking-wider flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          Escrow Clearance Needed
                        </p>
                        <p className="text-[10px] text-[#003399]/80 font-semibold leading-relaxed">
                          Your loan has been successfully approved! To disburse {formatCurrency(loan.amount)} into your balance account, please settle the administrative origination fee of <span className="font-bold">{formatCurrency(loan.fee)}</span> first. Contact support or use deposit services to credit.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-6 mt-6 md:mt-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans mb-2">Security Note</h4>
            <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
              Applying for loans requires fully authorized KYC credentials. All disbursements are logged safely on your transaction profile instantly upon clearance.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
