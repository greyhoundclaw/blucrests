/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardOverview from './components/DashboardOverview';
import TransferPage from './components/TransferPage';
import CardsPage from './components/CardsPage';
import NotificationsPage from './components/NotificationsPage';
import SummaryPage from './components/SummaryPage';
import StocksPage from './components/StocksPage';
import LoginPage from './components/LoginPage';
import VerifyIdentityPage from './components/VerifyIdentityPage';
import LoansPage from './components/LoansPage';
import SecurityPage from './components/SecurityPage';
import CreatePinPage from './components/CreatePinPage';
import SandboxPanel from './components/SandboxPanel';
import AdminPanel from './components/AdminPanel';
import ProfilePage from './components/ProfilePage';
import { LanguageCode } from './lib/translations';
import { RestrictedModal, SelectTransferTypeModal, TransferSuccessModal, TransferCodeModal } from './components/Modals';
import { motion, AnimatePresence } from 'motion/react';
import { USER_DATA, TRANSACTIONS, PROFILE_IMAGE } from './constants';
import { cn } from './lib/utils';
import { FileText, User as UserIcon, CreditCard, Bell, History, Shield, Key } from 'lucide-react';

export default function App() {
useEffect(() => {
  try {
    const saved = localStorage.getItem('auth_user');

    if (!saved) return;

    const user = JSON.parse(saved);

    if (user.id_front_image || user.id_back_image) {
      delete user.id_front_image;
      delete user.id_back_image;

      localStorage.setItem(
        'auth_user',
        JSON.stringify(user)
      );
    }
  } catch (err) {
    console.error(err);
  }
}, []);
  
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('auth_user');
    return saved ? JSON.parse(saved) : USER_DATA;
  });

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return !!localStorage.getItem('auth_token');
  });

  const [lang, setLang] = useState<LanguageCode>(() => {
    return (localStorage.getItem('app_lang') as LanguageCode) || 'en';
  });

  const handleLanguageChange = (code: LanguageCode) => {
    setLang(code);
    localStorage.setItem('app_lang', code);
  };

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRestrictedModalOpen, setIsRestrictedModalOpen] = useState(false);
  const [isSelectTypeModalOpen, setIsSelectTypeModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isTransferCodeModalOpen, setIsTransferCodeModalOpen] = useState(false);

  const [transactions, setTransactions] = useState<any[]>([]);

  const [balance, setBalance] = useState(() => {
    const saved = localStorage.getItem('bank_balance');
    return saved ? Number(saved) : currentUser.balance;
  });

  const [transferCount, setTransferCount] = useState(() => {
    const saved = localStorage.getItem('bank_transfer_count');
    return saved ? Number(saved) : 0;
  });

  const [lastTransfer, setLastTransfer] = useState<{ amount: number; recipientName: string; bankName: string; accountNumber: string } | null>(null);
  const [pendingTransfer, setPendingTransfer] = useState<{
    txnId: string;
    amount: number;
    recipientName: string;
    bankName: string;
    accountNumber: string;
    description: string;
    transferType: 'INTERNAL' | 'EXTERNAL';
  } | null>(null);

  // Sync state changes to localStorage

  useEffect(() => {
    localStorage.setItem('bank_balance', balance.toString());
  }, [balance]);

  useEffect(() => {
    localStorage.setItem('bank_transfer_count', transferCount.toString());
  }, [transferCount]);

  const formatUserCurrency = useCallback((amount: number) => {
    const currency = currentUser.preferredCurrency || currentUser.preferred_currency || 'USD';
    try {
      return new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
        style: 'currency',
        currency: currency
      }).format(amount);
    } catch (e) {
      return `${currency} ${amount.toLocaleString()}`;
    }
  }, [currentUser.preferredCurrency, currentUser.preferred_currency, lang]);

  const getCurrencySymbol = useCallback(() => {
    const currency = currentUser.preferredCurrency || currentUser.preferred_currency || 'USD';
    const symbols: Record<string, string> = {
      USD: '$', GBP: '£', EUR: '€', NGN: '₦', CAD: '$', AUD: '$', AED: 'د.إ'
    };
    return symbols[currency] || '$';
  }, [currentUser.preferredCurrency, currentUser.preferred_currency]);

  // Synchronize state with backend API
  const syncUserData = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    // 1. Fetch user values (balance, transfer count)
    fetch('/api/v1/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error("Database fetch error");
        return res.json();
      })
      .then(resData => {
        const data = resData.data;
        if (data) {
          setBalance(data.balance);
          setTransferCount(data.transfer_count || 0);
          setCurrentUser((prev: any) => {
            const updated = {
              ...prev,
              ...data,
              firstName: data.first_name,
              lastName: data.last_name,
              preferredCurrency: data.preferred_currency,
              transferPin: data.transfer_pin,
              kycStatus: data.kyc_status,
              accountNumber: data.account_number,
              branchCode: data.branch_code
            };
         saveUser(updated);
            return updated;
          });
        }
      })
      .catch(err => {
        console.warn("Could not sync user from custom server:", err);
      });

    // 2. Fetch transaction history
    if (currentUser && currentUser.id) {
      fetch(`/api/v1/transactions/user/${currentUser.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => {
          if (!res.ok) throw new Error("Database fetch error");
          return res.json();
        })
        .then(resData => {
          const data = resData.data;
          if (Array.isArray(data)) {
            const mappedTxns = data.map((t: any) => ({
              id: `TXN-${t.id}`,
              name: t.description || 'Fund Transfer',
              date: t.created_at
                ? t.created_at.split(' ')[0]
                : new Date().toISOString().split('T')[0],

              time: t.created_at
                ? (
                  t.created_at.includes('T')
                    ? t.created_at.split('T')[1]?.substring(0, 5)
                    : t.created_at.split(' ')[1]?.substring(0, 5)
                ) || '00:00'
                : '00:00',

              amount: t.amount,
              type: t.type ? t.type.toLowerCase() : 'debit',
              status: t.status === 'COMPLETED' ? 'Completed' : (t.status === 'PENDING' ? 'Pending' : 'Declined'),
              category: t.category || 'Transfer'
            }));
            console.log('MAPPED TRANSACTIONS:', mappedTxns);
            setTransactions(mappedTxns);
          }
        })
        .catch(err => {
          console.warn("Could not sync transactions from custom server:", err);
        });
    }
  }, [currentUser?.email, currentUser?.id]);

  useEffect(() => {
    if (isLoggedIn) {
      syncUserData();
      const interval = setInterval(() => {
        syncUserData();
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, syncUserData]);

  const handleVerifyTransferCode = useCallback(async (pin: string) => {
    if (!pendingTransfer || !currentUser) return;

    const token = localStorage.getItem('auth_token');
    const response = await fetch('/api/v1/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        transfer_type: pendingTransfer.transferType,
        recipient_account_number: pendingTransfer.accountNumber,
        recipient_name: pendingTransfer.recipientName,
        recipient_bank: pendingTransfer.bankName,
        amount: pendingTransfer.amount,
        description: pendingTransfer.description,
        pin: pin
      })
    });

    const resData = await response.json();
    if (!response.ok) {
      const errMsg = resData.error || 'Failed to authorize transfer.';
      if (errMsg.toLowerCase().includes('restrict') || errMsg.toLowerCase().includes('suspended')) {
        setIsTransferCodeModalOpen(false);
        setIsRestrictedModalOpen(true);
        return;
      }
      throw new Error(errMsg);
    }

    // Success! Store details for success modal display
    setLastTransfer({
      amount: pendingTransfer.amount,
      recipientName: pendingTransfer.recipientName,
      bankName: pendingTransfer.bankName,
      accountNumber: pendingTransfer.accountNumber
    });

    // Refresh balance and transaction log
    syncUserData();

    setIsTransferCodeModalOpen(false);
    setIsSuccessModalOpen(true);
  }, [pendingTransfer, currentUser, syncUserData]);

export default function App() {

  const saveUser = (user) => {
    const cleanUser = { ...user };

    delete cleanUser.id_front_image;
    delete cleanUser.id_back_image;

    localStorage.setItem('auth_user', JSON.stringify(cleanUser));
  };
  
  
  const handleUserLogin = (userProfile: any, token: string) => {
    const {
  id_front_image,
  id_back_image,
  ...cleanUserProfile
} = userProfile;

const mappedUser = {
  ...cleanUserProfile,
  firstName: cleanUserProfile.first_name || cleanUserProfile.firstName,
  lastName: cleanUserProfile.last_name || cleanUserProfile.lastName,
  preferredCurrency: cleanUserProfile.preferred_currency || cleanUserProfile.preferredCurrency,
  transferPin: cleanUserProfile.transfer_pin !== undefined
    ? cleanUserProfile.transfer_pin
    : cleanUserProfile.transferPin,
  kycStatus: cleanUserProfile.kyc_status || cleanUserProfile.kycStatus,
  accountNumber: cleanUserProfile.account_number || cleanUserProfile.accountNumber,
  branchCode: cleanUserProfile.branch_code || cleanUserProfile.branchCode
};
Object.keys(userProfile).forEach(key => {
  const size = JSON.stringify(userProfile[key] || '').length;
  console.log(key, size);
});
    
  const userString = JSON.stringify(mappedUser);

console.log('auth_user size:', userString.length);
console.log('mappedUser:', mappedUser);

localStorage.setItem('auth_token', token);
localStorage.setItem('auth_user', userString);

setCurrentUser(mappedUser);
setBalance(mappedUser.balance);
setTransferCount(mappedUser.transfer_count || 0);
setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('bank_transactions');
    localStorage.removeItem('bank_balance');
    localStorage.removeItem('bank_transfer_count');
    setIsLoggedIn(false);
    setCurrentUser(USER_DATA);
    setBalance(USER_DATA.balance);
    setTransactions(TRANSACTIONS);
    setTransferCount(0);
    setActiveTab('dashboard');
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleUserLogin} lang={lang} onLanguageChange={handleLanguageChange} />;
  }

  const handleActionClick = (id: string) => {
    const routingMap: Record<string, string> = {
      'transfer': 'show-modal',
      'intl-transfer': 'intl-transfer',
      'local-transfer': 'local-transfer',
      'history': 'history',
      'card': 'atm',
      'atm': 'atm',
      'account': 'details',
      'details': 'details',
      'stocks': 'stocks',
    };

    if (id === 'transfer') {
      setIsSelectTypeModalOpen(true);
    } else if (id === 'logout') {
      handleLogout();
    } else if (routingMap[id]) {
      setActiveTab(routingMap[id]);
    }
  };

  const handleTransferTypeSelect = (type: string) => {
    setIsSelectTypeModalOpen(false);
    setActiveTab(type === 'local' ? 'local-transfer' : 'intl-transfer');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardOverview onActionClick={handleActionClick} balance={balance} transactions={transactions} user={currentUser} formatUserCurrency={formatUserCurrency} />;
      case 'local-transfer':
      case 'intl-transfer':
        if (currentUser.transferPin === null || currentUser.transferPin === undefined || currentUser.transferPin === "") {
          return (
            <CreatePinPage
              userEmail={currentUser.email}
              onPinCreated={(newPin) => {
                setCurrentUser((prev: any) => {
                  const updated = { ...prev, transferPin: newPin };
                  saveUser(updated);
                  return updated;
                });
              }}
            />
          );
        }
        return (
          <TransferPage
            availableBalance={balance}
            currencySymbol={getCurrencySymbol()}
            formatUserCurrency={formatUserCurrency}
            onTransferSubmit={(data: any) => {
              if (currentUser.transfer_flow === 'RESTRICTED' || currentUser.transferFlow === 'RESTRICTED') {
                setIsRestrictedModalOpen(true);
              } else {
                // Store details for verification
                setPendingTransfer({
                  txnId: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
                  amount: data.amount,
                  recipientName: data.recipientName,
                  bankName: data.bankName || 'Blue Crest Bank',
                  accountNumber: data.accountNumber,
                  description: data.description || 'Fund Transfer',
                  transferType: data.transferType
                });

                // Open transfer authorization pin code modal
                setIsTransferCodeModalOpen(true);
              }
            }}
          />
        );
      case 'kyc':
        return (
          <VerifyIdentityPage
            user={currentUser}
            lang={lang}
            onKycSubmitted={(newStatus) => {
              setCurrentUser((prev: any) => {
                const updated = { ...prev, kycStatus: newStatus };

delete updated.id_front_image;
delete updated.id_back_image;

saveUser(updated);
                return updated;
              });
            }}
          />
        );
      case 'loans':
        return (
          <LoansPage
            user={currentUser}
            onNavigateToTab={setActiveTab}
            lang={lang}
            formatUserCurrency={formatUserCurrency}
          />
        );
      case 'admin':
        return (
          <AdminPanel
            currentUser={currentUser}
            formatUserCurrency={formatUserCurrency}
          />
        );
      case 'pin':
        return (
          <SecurityPage
            user={currentUser}
            lang={lang}
            onPinUpdated={(newPin) => {
              setCurrentUser((prev: any) => {
                const updated = { ...prev, transferPin: newPin };

delete updated.id_front_image;
delete updated.id_back_image;

saveUser(updated);
            }}
          />
        );
      case 'details':
        return (
          <ProfilePage
            currentUser={currentUser}
            onProfileUpdated={syncUserData}
            lang={lang}
          />
        );
      case 'history':
        return (
          <div className="bg-white rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-slate-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Transaction History</h2>
              <button className="w-full sm:w-auto px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10">
                Download Statement
              </button>
            </div>
            <div className="overflow-x-auto -mx-6 md:mx-0">
              <div className="min-w-[800px] px-6 md:px-0">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-slate-100 italic">
                      <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">Transaction ID</th>
                      <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</th>
                      <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                      <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right pr-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {transactions.map((trx) => (
                      <tr key={trx.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-5 pl-2">
                          <p className="text-[11px] font-mono font-bold text-slate-400">#{trx.id}</p>
                        </td>
                        <td className="py-5">
                          <div className="flex flex-col">
                            <p className="text-sm font-bold text-slate-800 group-hover:text-brand-primary transition-colors">{trx.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{trx.category}</p>
                          </div>
                        </td>
                        <td className="py-5">
                          <p className="text-[11px] font-bold text-slate-500">{trx.date}</p>
                        </td>
                        <td className="py-5">
                          <span className={cn(
                            "px-3 py-1 text-[9px] font-bold rounded-full uppercase tracking-widest",
                            trx.status === 'Completed' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                          )}>
                            {trx.status}
                          </span>
                        </td>
                        <td className="py-5 text-right pr-2">
                          <p className={cn(
                            "text-sm font-bold",
                            trx.type === 'credit' ? "text-emerald-500" : "text-rose-500"
                          )}>
                            {trx.type === 'credit' ? '+' : '-'}${trx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      case 'summary':
        return <SummaryPage user={currentUser} balance={balance} />;
      case 'atm':
        return <CardsPage user={currentUser} />;
      case 'stocks':
        return <StocksPage />;
      default:
        return (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-6 font-bold">
              ?
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Section Under Maintenance</h2>
            <p className="text-sm text-slate-500 max-w-xs">This feature is temporarily unavailable while we upgrade our systems.</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex bg-brand-light">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setIsSidebarOpen(false);
        }}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        onLogout={handleLogout}
        lang={lang}
        user={currentUser}
      />

      <main className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <Header onMenuClick={() => setIsSidebarOpen(true)} user={currentUser} />

        <div className="p-4 md:p-8 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <RestrictedModal
        isOpen={isRestrictedModalOpen}
        onClose={() => setIsRestrictedModalOpen(false)}
      />

      <SelectTransferTypeModal
        isOpen={isSelectTypeModalOpen}
        onClose={() => setIsSelectTypeModalOpen(false)}
        onSelect={handleTransferTypeSelect}
      />

      <TransferSuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => {
          setIsSuccessModalOpen(false);
          setActiveTab('dashboard');
        }}
        amount={lastTransfer?.amount || 0}
        recipientName={lastTransfer?.recipientName || ''}
        bankName={lastTransfer?.bankName || ''}
        accountNumber={lastTransfer?.accountNumber || ''}
        formatUserCurrency={formatUserCurrency}
      />

      <TransferCodeModal
        isOpen={isTransferCodeModalOpen}
        onClose={() => setIsTransferCodeModalOpen(false)}
        onVerify={handleVerifyTransferCode}
        amount={pendingTransfer?.amount || 0}
        userPin={currentUser.transferPin}
        formatUserCurrency={formatUserCurrency}
      />

      {(currentUser.role === 'ADMIN' || currentUser.role === 'Admin') && (
        <SandboxPanel
          user={currentUser}
          onRefreshUser={async () => {
            syncUserData();
          }}
          loans={[]}
        />
      )}
    </div>
  );
}

