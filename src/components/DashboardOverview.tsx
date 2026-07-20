import { 
  Send, 
  History, 
  FileText, 
  Shield, 
  TrendingUp, 
  CreditCard, 
  User, 
  LogOut,
  Eye,
  TrendingDown,
  ChevronRight,
  MoreVertical
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { USER_DATA, TRANSACTIONS, STOCKS, ACTIVITY_DATA } from '@/src/constants';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

type MarketSnapshot = {
  targetCurrency: string;
  usdRate: number;
  bitcoinUsd: number;
  bitcoinChange24h: number | null;
  updatedAt: string;
};

const QUICK_ACTIONS = [
  { id: 'transfer', label: 'Transfer', icon: Send, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { id: 'history', label: 'History', icon: History, color: 'text-slate-500', bg: 'bg-slate-50' },
  { id: 'statement', label: 'Cards', icon: CreditCard, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { id: 'security', label: 'Account', icon: User, color: 'text-slate-500', bg: 'bg-slate-50' },
];

export default function DashboardOverview({ 
  onActionClick,
  balance = USER_DATA.balance,
  transactions = TRANSACTIONS,
  user,
  formatUserCurrency
}: { 
  onActionClick: (id: string) => void;
  balance?: number;
  transactions?: any[];
  user?: any;
  formatUserCurrency?: (amount: number) => string;
}) {
  const activeUser = user || USER_DATA;
  const accountState = String(activeUser.status || 'ACTIVE').toUpperCase();
  const transferFlow = String(activeUser.transfer_flow || activeUser.transferFlow || 'ACTIVE').toUpperCase();
  const restricted = accountState !== 'ACTIVE' || ['RESTRICTED', 'AUTHORIZATION_HOLD'].includes(transferFlow);
  const accountType = String(activeUser.account_type || activeUser.accountType || 'CHECKING').replaceAll('_', ' ');
  const checkingBalance = Number(balance || 0);
  const savingsBalance = Number(activeUser.savings_balance ?? activeUser.savingsBalance ?? 0);
  const [currentLoanAmount, setCurrentLoanAmount] = useState(0);
  const preferredCurrency = (
    activeUser.preferred_currency ||
    activeUser.preferredCurrency ||
    'USD'
  ).toUpperCase();
  const marketCurrency = preferredCurrency === 'USD' ? 'EUR' : preferredCurrency;
  const [marketSnapshot, setMarketSnapshot] = useState<MarketSnapshot | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const formatCurrency = formatUserCurrency || ((amt: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amt);
  });

  useEffect(() => {
    if (!activeUser?.id) return;
    const token = localStorage.getItem('auth_token');

    fetch(`/api/v1/loans/user/${activeUser.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(payload => {
        const loans = Array.isArray(payload.data) ? payload.data : [];
        const activeTotal = loans
          .filter((loan: any) => loan.status === 'DISBURSED')
          .reduce((sum: number, loan: any) => sum + Number(loan.requested_amount || 0), 0);
        setCurrentLoanAmount(activeTotal);
      })
      .catch(() => setCurrentLoanAmount(0));
  }, [activeUser?.id]);

  useEffect(() => {
    const cacheKey = `bluecrest_market_${marketCurrency}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        setMarketSnapshot(JSON.parse(cached));
      } catch {
        localStorage.removeItem(cacheKey);
      }
    }

    const loadMarketSnapshot = () => {
      fetch(`/api/v1/market?currency=${encodeURIComponent(marketCurrency)}`)
        .then(response => response.ok ? response.json() : Promise.reject())
        .then(payload => {
          const snapshot = payload.data as MarketSnapshot;
          setMarketSnapshot(snapshot);
          localStorage.setItem(cacheKey, JSON.stringify(snapshot));
        })
        .catch(() => {
          // Keep the last successful snapshot when a provider is temporarily unavailable.
        })
        .finally(() => setMarketLoading(false));
    };

    loadMarketSnapshot();
    const refreshTimer = window.setInterval(loadMarketSnapshot, 5 * 60 * 1000);

    return () => window.clearInterval(refreshTimer);
  }, [marketCurrency]);

  const forexLabel = preferredCurrency === 'USD'
    ? `${marketCurrency} / USD`
    : `USD / ${marketCurrency}`;
  const forexValue = marketSnapshot
    ? preferredCurrency === 'USD'
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 4
        }).format(1 / marketSnapshot.usdRate)
      : new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: marketCurrency,
          maximumFractionDigits: 4
        }).format(marketSnapshot.usdRate)
    : marketLoading ? 'Updating…' : 'Unavailable';
  const bitcoinValue = marketSnapshot
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(marketSnapshot.bitcoinUsd)
    : marketLoading ? 'Updating…' : 'Unavailable';

  return (
    <div className="space-y-8 pb-12">
      {/* Top Row: Balance & Card */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Balance Card */}
        <div className="flex-1 bg-[#003399] rounded-[2.5rem] border border-white/10 shadow-2xl p-6 md:p-10 flex flex-col justify-between text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="relative z-10">
            <p className="text-[10px] md:text-sm text-blue-200/60 mb-2 font-bold uppercase tracking-widest">Total Balance</p>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tighter">
              {formatCurrency(checkingBalance + savingsBalance)}
            </h2>
            <div className="mt-6 grid max-w-xl grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-[9px] font-bold uppercase tracking-widest text-blue-200/70">Checking</p>
                <p className="mt-1 text-lg font-extrabold tracking-tight">{formatCurrency(checkingBalance)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-[9px] font-bold uppercase tracking-widest text-blue-200/70">Savings</p>
                <p className="mt-1 text-lg font-extrabold tracking-tight">{formatCurrency(savingsBalance)}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest">{accountType} Account</span>
              <span className="text-[10px] font-semibold tracking-[0.14em] text-blue-100">Account •••• {String(activeUser.account_number || activeUser.accountNumber || '').slice(-4)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-10 gap-y-6 mt-10 md:mt-16 relative z-10">
            <div>
              <p className="text-[9px] md:text-[10px] text-blue-200/50 uppercase tracking-widest font-bold mb-1">{forexLabel}</p>
              <p className="text-base md:text-xl font-bold text-emerald-400">{forexValue}</p>
              <p className="mt-1 text-[8px] font-semibold uppercase tracking-wider text-blue-200/40">
                {preferredCurrency === 'USD' ? `1 ${marketCurrency}` : '1 US dollar'}
              </p>
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] text-blue-200/50 uppercase tracking-widest font-bold mb-1">Bitcoin / USD</p>
              <p className="text-base md:text-xl font-bold text-amber-300">{bitcoinValue}</p>
              <p className={cn(
                "mt-1 text-[8px] font-semibold uppercase tracking-wider",
                marketSnapshot?.bitcoinChange24h == null
                  ? "text-blue-200/40"
                  : marketSnapshot.bitcoinChange24h >= 0
                    ? "text-emerald-300"
                    : "text-rose-300"
              )}>
                {marketSnapshot?.bitcoinChange24h == null
                  ? 'Live market price'
                  : `${marketSnapshot.bitcoinChange24h >= 0 ? '+' : ''}${marketSnapshot.bitcoinChange24h.toFixed(2)}% today`}
              </p>
            </div>
            <div className="hidden sm:block">
              <p className="text-[9px] md:text-[10px] text-blue-200/50 uppercase tracking-widest font-bold mb-1">Account Status</p>
              <p className={`text-base md:text-xl font-bold ${restricted ? 'text-rose-300' : 'text-emerald-300'}`}>{restricted ? 'Restricted' : 'Active'}</p>
              <p className="mt-1 text-[8px] font-semibold uppercase tracking-wider text-blue-200/50">{accountType} account</p>
            </div>
          </div>
        </div>
        
        {/* Loan position */}
        <div className="lg:w-96 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
          <div className="relative overflow-hidden rounded-[2rem] bg-white border border-slate-100 p-6 shadow-sm">
            <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-blue-50" />
            <div className="relative">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Current Loan Amount</p>
              <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">{formatCurrency(currentLoanAmount)}</p>
              <p className="mt-2 text-[10px] font-semibold text-slate-400">Total capital currently disbursed</p>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white shadow-xl shadow-emerald-900/10">
            <div className="absolute -right-10 -bottom-12 w-36 h-36 rounded-full bg-white/10" />
            <div className="relative">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100">Eligible Loan Amount</p>
              <p className="mt-3 text-3xl font-extrabold tracking-tight">{formatCurrency(1500)}</p>
              <button
                onClick={() => onActionClick('loans')}
                className="mt-3 text-[10px] font-bold uppercase tracking-widest text-white/90 hover:text-white"
              >
                Apply for financing →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Chart Section */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-5 md:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Financial Performance</h3>
            <p className="text-xs font-bold text-slate-900">Income vs. Spending Overview</p>
          </div>
          <div className="flex bg-slate-50 p-1 rounded-xl w-full sm:w-auto">
             <button className="flex-1 sm:flex-none px-4 py-1.5 bg-white shadow-sm rounded-lg text-[10px] font-bold text-slate-600 uppercase tracking-wider">Weekly</button>
             <button className="flex-1 sm:flex-none px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monthly</button>
          </div>
        </div>
        <div className="h-[250px] md:h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={ACTIVITY_DATA}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#003399" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#003399" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', fontSize: '10px', fontWeight: 'bold' }}
                cursor={{ stroke: '#003399', strokeWidth: 2 }}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#003399" 
                fillOpacity={1} 
                fill="url(#colorValue)" 
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Recent Transactions Table */}
        <div className="xl:col-span-3 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden min-h-[450px]">
          <div className="px-6 md:px-8 py-6 flex items-center justify-between border-b border-slate-50">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Transaction History</h3>
            <button 
              onClick={() => onActionClick('history')}
              className="text-[#003399] text-[10px] font-bold uppercase tracking-widest hover:underline"
            >
              Statement
            </button>
          </div>
          <div className="px-5 md:px-8 py-2 overflow-y-auto flex-1 custom-scrollbar">
            <div className="divide-y divide-slate-50">
              {transactions.slice(0, 8).map((trx) => (
                <div key={trx.id} className="py-4 md:py-5 flex items-center justify-between group">
                  <div className="flex items-center space-x-3 md:space-x-4">
                    <div className={cn(
                      "w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shadow-sm shrink-0",
                      trx.type === 'credit' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"
                    )}>
                      {trx.type === 'credit' ? <TrendingUp className="w-4 h-4 md:w-5 md:h-5" /> : <TrendingDown className="w-4 h-4 md:w-5 md:h-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 group-hover:text-[#003399] transition-colors truncate text-sm">{trx.name}</p>
                      <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-tight truncate">{trx.category} • {trx.date}</p>
                      {trx.originName && <p className="text-[9px] text-[#003399] font-semibold mt-0.5 truncate">From {trx.originName}{trx.originBank ? ` · ${trx.originBank}` : ''}{trx.originAccountNumber ? ` · ${trx.originAccountNumber}` : ''}</p>}
                      {trx.performedBy && <p className="text-[9px] text-[#003399] font-semibold mt-0.5 truncate">Joint account activity by {trx.performedBy}</p>}
                    </div>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className={cn("font-bold text-sm", trx.type === 'debit' ? "text-rose-500" : "text-emerald-500")}>
                      {trx.type === 'debit' ? '-' : '+'}{formatCurrency(trx.amount)}
                    </p>
                    <p className="text-[8px] md:text-[9px] font-bold text-slate-300 uppercase tracking-widest">{trx.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions & Transfer */}
        <div className="xl:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { id: 'transfer', label: 'Bank Transfer', icon: Send, color: 'bg-indigo-50 text-[#003399]' },
              { id: 'history', label: 'History', icon: History, color: 'bg-emerald-50 text-emerald-600' },
              { id: 'card', label: 'Security', icon: Shield, color: 'bg-rose-50 text-rose-500' },
            ].map((action) => (
              <button 
                key={action.id}
                onClick={() => onActionClick(action.id)}
                className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-4 group"
              >
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110", action.color)}>
                  <action.icon className="w-7 h-7" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{action.label}</span>
              </button>
            ))}
          </div>

          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl shadow-slate-900/10 flex flex-col justify-between h-auto">
             <div>
               <div className="flex justify-between items-center mb-6">
                 <h3 className="text-sm font-bold uppercase tracking-widest opacity-50">Quick Pay</h3>
                 <TrendingUp className="w-5 h-5 text-emerald-400" />
               </div>
               <div className="space-y-4">
                 <p className="text-3xl font-bold tracking-tight">Investment Growth</p>
                 <p className="text-xs text-slate-400 leading-relaxed">Your portfolio is currently performing <span className="text-emerald-400">12.5% better</span> than last month.</p>
               </div>
             </div>
             <button 
               onClick={() => onActionClick('stocks')}
               className="mt-8 w-full bg-brand-gradient py-4 rounded-xl font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-all active:scale-95"
             >
               Go to Portal
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
