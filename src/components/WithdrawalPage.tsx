import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Bitcoin,
  Building2,
  CreditCard,
  Landmark,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  WalletCards
} from 'lucide-react';
import { apiRequest } from '../lib/api';

type Method = 'BANK_TRANSFER' | 'CRYPTO_WALLET' | 'PAYPAL' | 'CARD';

type Destination = {
  id: number;
  method: Method;
  label: string;
  details: Record<string, string>;
  is_preferred: number;
};

type Withdrawal = {
  id: number;
  reference: string;
  amount: number;
  currency: string;
  method: Method;
  status: string;
  created_at: string;
};

const methods: { id: Method; label: string; icon: typeof Landmark }[] = [
  { id: 'BANK_TRANSFER', label: 'Bank transfer', icon: Landmark },
  { id: 'CRYPTO_WALLET', label: 'Crypto wallet', icon: Bitcoin },
  { id: 'PAYPAL', label: 'PayPal', icon: WalletCards },
  { id: 'CARD', label: 'Payment card', icon: CreditCard }
];

const fields: Record<Method, { key: string; label: string; placeholder?: string; required?: boolean }[]> = {
  BANK_TRANSFER: [
    { key: 'account_holder_name', label: 'Account holder name', required: true },
    { key: 'bank_name', label: 'Bank name', required: true },
    { key: 'account_number', label: 'Account number / IBAN', required: true },
    { key: 'routing_number', label: 'Routing / sort code' },
    { key: 'swift_code', label: 'SWIFT / BIC' },
    { key: 'country', label: 'Bank country', required: true }
  ],
  CRYPTO_WALLET: [
    { key: 'asset', label: 'Asset', placeholder: 'USDT, BTC, ETH', required: true },
    { key: 'network', label: 'Network', placeholder: 'TRC20, ERC20', required: true },
    { key: 'wallet_address', label: 'Wallet address', required: true }
  ],
  PAYPAL: [
    { key: 'email', label: 'PayPal email', required: true },
    { key: 'account_name', label: 'Account name' }
  ],
  CARD: [
    { key: 'cardholder_name', label: 'Cardholder name', required: true },
    { key: 'last_four', label: 'Last four digits', placeholder: '1234', required: true },
    {
      key: 'provider_reference',
      label: 'Processor token / reference',
      placeholder: 'Token supplied by an approved payment processor',
      required: true
    }
  ]
};

export default function WithdrawalPage({
  balance,
  formatCurrency
}: {
  balance: number;
  formatCurrency: (amount: number) => string;
}) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [method, setMethod] = useState<Method>('BANK_TRANSFER');
  const [details, setDetails] = useState<Record<string, string>>({});
  const [label, setLabel] = useState('');
  const [preferred, setPreferred] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDestinationForm, setShowDestinationForm] = useState(false);

  const load = useCallback(async () => {
    const [saved, requests] = await Promise.all([
      apiRequest<Destination[]>('/api/v1/withdrawal-destinations'),
      apiRequest<Withdrawal[]>('/api/v1/withdrawals')
    ]);
    setDestinations(saved);
    setWithdrawals(requests);
    const preferredDestination = saved.find(item => item.is_preferred) || saved[0];
    if (preferredDestination) setSelectedId(String(preferredDestination.id));
  }, []);

  useEffect(() => {
    load().catch(error => setMessage(error.message));
  }, [load]);

  const selected = useMemo(
    () => destinations.find(item => String(item.id) === selectedId),
    [destinations, selectedId]
  );

  // Progressive enhancement: these are conventional POST forms with named
  // controls. React intercepts them only to attach the existing Bearer session.
  const saveDestination = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await apiRequest('/api/v1/withdrawal-destinations', {
        method: 'POST',
        body: JSON.stringify({
          method,
          label,
          details,
          is_preferred: preferred
        })
      });
      setDetails({});
      setLabel('');
      setPreferred(false);
      setShowDestinationForm(false);
      setMessage('Withdrawal destination saved.');
      await load();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const submitWithdrawal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await apiRequest('/api/v1/withdrawals', {
        method: 'POST',
        body: JSON.stringify({
          destination_id: Number(selectedId),
          amount: Number(amount),
          note
        })
      });
      setAmount('');
      setNote('');
      setMessage('Withdrawal request submitted for administrative review.');
      await load();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const removeDestination = async (id: number) => {
    await apiRequest(`/api/v1/withdrawal-destinations/${id}`, { method: 'DELETE' });
    await load();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-4 md:py-8">
      <section className="bg-slate-900 text-white rounded-[2.5rem] p-7 md:p-10 flex flex-col md:flex-row justify-between gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-blue-300 font-bold">Company payout center</p>
          <h2 className="text-3xl font-extrabold mt-2">Withdraw your funds</h2>
          <p className="text-slate-400 text-sm mt-2">Save an approved destination and submit a trackable payout request.</p>
        </div>
        <div className="bg-white/10 rounded-2xl px-6 py-4 self-start">
          <p className="text-[10px] uppercase text-slate-400 font-bold">Available balance</p>
          <p className="text-xl font-extrabold mt-1">{formatCurrency(balance)}</p>
        </div>
      </section>

      {message && (
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 text-[#003399] text-sm font-bold">
          {message}
        </div>
      )}

      <div className="grid lg:grid-cols-[1.1fr_.9fr] gap-6">
        <section className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-extrabold text-slate-900">Saved payout destinations</h3>
              <p className="text-xs text-slate-400 mt-1">Choose where an approved payout should be delivered.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowDestinationForm(value => !value)}
              className="p-3 rounded-xl bg-[#003399] text-white"
              aria-label="Add withdrawal destination"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {showDestinationForm && (
            <form
              method="post"
              action="/api/v1/withdrawal-destinations"
              acceptCharset="UTF-8"
              onSubmit={saveDestination}
              className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-4 mb-5"
            >
              <input type="hidden" name="method" value={method} />
              <input type="hidden" name="is_preferred" value={preferred ? '1' : '0'} />

              <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <p>Passwords, full card numbers, CVVs and card PINs are never requested or transmitted.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {methods.map(item => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      setMethod(item.id);
                      setDetails({});
                    }}
                    className={`p-3 rounded-xl text-[10px] font-bold ${
                      method === item.id ? 'bg-[#003399] text-white' : 'bg-white text-slate-500'
                    }`}
                  >
                    <item.icon className="w-4 h-4 mx-auto mb-1" />
                    {item.label}
                  </button>
                ))}
              </div>

              <div>
                <label htmlFor="destination-label" className="form-label">Destination label</label>
                <input
                  id="destination-label"
                  name="label"
                  value={label}
                  onChange={event => setLabel(event.target.value)}
                  required
                  placeholder="Main business account"
                  className="field-control"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {fields[method].map(field => (
                  <div key={field.key}>
                    <label htmlFor={`destination-${field.key}`} className="form-label">{field.label}</label>
                    <input
                      id={`destination-${field.key}`}
                      name={`details[${field.key}]`}
                      value={details[field.key] || ''}
                      onChange={event => setDetails(current => ({
                        ...current,
                        [field.key]: event.target.value
                      }))}
                      required={field.required}
                      placeholder={field.placeholder}
                      inputMode={field.key === 'last_four' ? 'numeric' : undefined}
                      maxLength={field.key === 'last_four' ? 4 : undefined}
                      className="field-control"
                    />
                  </div>
                ))}
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <input
                  name="preferred"
                  type="checkbox"
                  checked={preferred}
                  onChange={event => setPreferred(event.target.checked)}
                />
                Make preferred destination
              </label>

              <button disabled={loading} className="w-full py-3 rounded-xl bg-slate-900 text-white text-xs font-bold">
                {loading ? 'Saving…' : 'Save destination'}
              </button>
            </form>
          )}

          {destinations.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-100 py-12 text-center">
              <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-600 mt-3">No destinations saved</p>
            </div>
          ) : (
            <div className="space-y-3">
              {destinations.map(item => (
                <label
                  key={item.id}
                  className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer ${
                    selectedId === String(item.id) ? 'border-blue-300 bg-blue-50/50' : 'border-slate-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="selected_destination"
                    value={item.id}
                    checked={selectedId === String(item.id)}
                    onChange={event => setSelectedId(event.target.value)}
                  />
                  <Building2 className="w-5 h-5 text-[#003399]" />
                  <div className="flex-1">
                    <p className="font-bold text-sm text-slate-800 flex items-center gap-2">
                      {item.label}
                      {item.is_preferred ? <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> : null}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                      {item.method.replaceAll('_', ' ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDestination(item.id)}
                    className="p-2 text-rose-400"
                    aria-label={`Delete ${item.label}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </label>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-6">
          <form
            method="post"
            action="/api/v1/withdrawals"
            acceptCharset="UTF-8"
            onSubmit={submitWithdrawal}
            className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm space-y-5"
          >
            <h3 className="font-extrabold text-slate-900">New withdrawal request</h3>
            <input type="hidden" name="destination_id" value={selectedId} />

            <div>
              <label className="form-label">Destination</label>
              <div className="p-4 rounded-2xl bg-slate-50 text-sm font-bold text-slate-700">
                {selected?.label || 'Add a destination first'}
              </div>
            </div>

            <div>
              <label htmlFor="withdrawal-amount" className="form-label">Amount</label>
              <input
                id="withdrawal-amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                max={balance}
                value={amount}
                onChange={event => setAmount(event.target.value)}
                required
                className="field-control"
                placeholder="0.00"
              />
            </div>

            <div>
              <label htmlFor="withdrawal-note" className="form-label">Payment note</label>
              <textarea
                id="withdrawal-note"
                name="note"
                value={note}
                onChange={event => setNote(event.target.value)}
                rows={3}
                className="field-control"
                placeholder="Optional reference for the payout team"
              />
            </div>

            <button
              disabled={loading || !selectedId}
              className="w-full py-4 rounded-2xl bg-[#003399] disabled:bg-slate-200 text-white font-bold text-sm"
            >
              {loading ? 'Submitting…' : 'Submit withdrawal request'}
            </button>
          </form>

          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-xs leading-relaxed text-amber-800">
              Submitting this form creates a payout request. It does not automatically move money through PayPal,
              a bank, card network or blockchain until an approved provider integration processes it.
            </p>
          </div>

          <section className="bg-white rounded-[2rem] p-6 border border-slate-100">
            <h3 className="font-extrabold text-slate-900 mb-4">Recent requests</h3>
            <div className="space-y-3">
              {withdrawals.slice(0, 6).map(item => (
                <div key={item.id} className="flex justify-between gap-3 py-3 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-xs font-mono font-bold text-slate-500">{item.reference}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{new Date(item.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-extrabold">{item.currency} {Number(item.amount).toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-[#003399] uppercase mt-1">{item.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
