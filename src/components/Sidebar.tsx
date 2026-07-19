import { useState } from 'react';
import { 
  LayoutDashboard, 
  User, 
  FileText, 
  TrendingUp, 
  Send, 
  History, 
  CreditCard, 
  Shield, 
  Key,
  LogOut,
  Menu, 
  X,
  RotateCcw,
  ShieldCheck,
  Landmark,
  Bell
  ,WalletCards,
  Users,
  MessageCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getTranslation, LanguageCode } from '../lib/translations';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onLogout: () => void;
  lang?: LanguageCode;
  user: any;
}

const MENU_ITEMS = [
  { section: 'MENU', items: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'details', label: 'Account Details', icon: User },
    { id: 'summary', label: 'Account Summary', icon: FileText },
    { id: 'joint-accounts', label: 'Joint Accounts', icon: Users },
    { id: 'stocks', label: 'Stocks & Trading', icon: TrendingUp },
  ]},
  { section: 'FUND TRANSFER', items: [
    { id: 'deposit', label: 'Deposit', icon: WalletCards },
    { id: 'local-transfer', label: 'Transfer', icon: Send },
    { id: 'history', label: 'Transfer History', icon: History },
  ]},
  { section: 'CREDITS & SECURE', items: [
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'support', label: 'Help & Support', icon: MessageCircle },
    { id: 'kyc', label: 'Verify Identity (KYC)', icon: ShieldCheck },
    { id: 'loans', label: 'Apply For Loan', icon: Landmark },
    { id: 'atm', label: 'Apply For Debit Card', icon: CreditCard },
    { id: 'pin', label: 'Security PIN', icon: Shield },
  ]}
];

const labelKeyMap: Record<string, string> = {
  dashboard: 'dashboard',
  details: 'accountDetails',
  summary: 'accountSummary',
  'joint-accounts': 'jointAccounts',
  stocks: 'stocksTrading',
  'local-transfer': 'transfer',
  history: 'transferHistory',
  atm: 'atmCard',
  kyc: 'verifyIdentity',
  loans: 'applyLoan',
  pin: 'securityPin',
  notifications: 'notifications',
  support: 'support',
  deposit: 'deposit',
  admin: 'adminBackoffice'
};

export default function Sidebar({ activeTab, setActiveTab, isOpen, setIsOpen, onLogout, lang = 'en', user }: SidebarProps) {
  const [resetState, setResetState] = useState<'idle' | 'resetting' | 'success' | 'failed'>('idle');

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'Admin';

  // Construct dynamic menu items
  const dynamicMenuItems = MENU_ITEMS.map(section => {
    if (section.section === 'CREDITS & SECURE' && isAdmin) {
      // Add Admin Backoffice tab to CREDITS & SECURE section for admin users
      return {
        ...section,
        items: [
          ...section.items,
          { id: 'admin', label: 'Admin Backoffice', icon: Key }
        ]
      };
    }
    return section;
  });

  const t = (key: string, fb: string = "") => getTranslation(lang, key, fb);

  const handleResetDatabase = async () => {
    if (resetState === 'resetting') return;
    if (!window.confirm("Are you sure you want to reset all bank data? This will restore balances and transactions across ALL devices.")) return;
    
    setResetState('resetting');
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) {
        setResetState('success');
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setResetState('failed');
        setTimeout(() => setResetState('idle'), 3000);
      }
    } catch (err) {
      console.error(err);
      setResetState('failed');
      setTimeout(() => setResetState('idle'), 3000);
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={cn(
          "fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsOpen(false)}
      />

      <aside className={cn(
        "bg-white border-r border-slate-200 flex flex-col h-screen fixed left-0 top-0 z-50 transition-transform duration-300 transform lg:translate-x-0 w-64 shadow-2xl lg:shadow-none",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
      <div className="p-8 flex items-center gap-3">
        <div className="w-10 h-10 bg-[#003399] rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
          <Shield className="w-6 h-6" />
        </div>
        <div className="flex flex-col animate-fade-in">
          <span className="text-lg font-bold tracking-tight text-slate-900 leading-none">
            {t('brand', 'Blue Crest')}
          </span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">{t('tagline', 'International')}</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 custom-scrollbar overflow-y-auto">
        {dynamicMenuItems.map((section) => (
          <div key={section.section} className="mb-6">
            <h3 className="px-4 text-[10px] font-bold text-slate-400 tracking-[0.15em] mb-4 uppercase">
              {section.section}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const labelKey = labelKeyMap[item.id] || item.id;
                const translatedLabel = t(labelKey, item.label);
                
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-left",
                      activeTab === item.id 
                        ? "bg-[#003399] text-white shadow-md shadow-blue-900/10 font-bold" 
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-semibold"
                    )}
                  >
                    <item.icon className={cn(
                      "w-5 h-5 shrink-0",
                      activeTab === item.id ? "text-white" : "text-slate-400 group-hover:text-slate-600"
                    )} />
                    <span className="text-sm truncate">{translatedLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 mt-auto space-y-4 shrink-0">
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50 transition-all font-bold text-sm"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span>{t('logout', 'Log Out')}</span>
        </button>
      </div>
    </aside>
    </>
  );
}
