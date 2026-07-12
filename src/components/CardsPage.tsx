import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Upload,
  Wifi
} from 'lucide-react';

type CardApplication = {
  id: number;
  card_type: string;
  card_number?: string | null;
  expiry_date?: string | null;
  cardholder_name: string;
  delivery_address: string;
  issuance_fee: number;
  purchase_limit_min: number;
  purchase_limit_max: number;
  shipping_included: number | boolean;
  txn_reference_image?: string | null;
  txn_reference_uploaded_at?: string | null;
  payment_status: string;
  status: string;
  created_at: string;
};

const CARD_PACKAGES = [
  {
    id: 'STANDARD',
    name: 'Blue Crest ATM Card',
    fee: 250,
    limit: 'Up to $50,000',
    shipping: 'Shipping included',
    accent: 'border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-100/70',
    badge: 'bg-[#003399] text-white'
  }
] as const;

const formatUsd = (amount: number) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
}).format(amount);

export default function CardsPage({
  user,
  formatCurrency = (amount: number) => `$${amount.toLocaleString()}`
}: {
  user?: any;
  formatCurrency?: (amount: number) => string;
}) {
  const [cards, setCards] = useState<CardApplication[]>([]);
  const [deliveryAddress, setDeliveryAddress] = useState(user?.address || '');
  const [selectedPackage, setSelectedPackage] = useState('STANDARD');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittingReference, setSubmittingReference] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [bitcoinAddress, setBitcoinAddress] = useState('');
  const [txnReference, setTxnReference] = useState('');
  const [txnReferenceName, setTxnReferenceName] = useState('');
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchCards = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/cards/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Could not load card application');
      setCards(Array.isArray(payload.data) ? payload.data : []);
    } catch (requestError: any) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const applyForCard = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/cards/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          delivery_address: deliveryAddress,
          card_type: selectedPackage
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Card application failed');
      setMessage('Debit card application submitted for admin review.');
      await fetchCards();
    } catch (requestError: any) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const activeApplication = cards.find(card => card.status !== 'REJECTED');
  const releasedCard = cards.find(card => card.status === 'RELEASED');
  const formattedNumber = releasedCard?.card_number
    ? releasedCard.card_number.replace(/(\d{4})(?=\d)/g, '$1 ')
    : '';
  const activePackageName = 'Blue Crest ATM Card';

  useEffect(() => {
    if (activeApplication?.status !== 'AWAITING_PAYMENT') return;

    setPaymentModalOpen(true);
    const token = localStorage.getItem('auth_token');
    fetch('/api/v1/cards/payment-instructions', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(payload => setBitcoinAddress(payload.data?.bitcoin_address || ''))
      .catch(() => setBitcoinAddress(''));
  }, [activeApplication?.id, activeApplication?.status]);

  const handleTxnReference = (file?: File) => {
    setError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Txn Reference must be a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Txn Reference image must be 5 MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setTxnReference(String(reader.result || ''));
      setTxnReferenceName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const submitTxnReference = async () => {
    if (!activeApplication || !txnReference) return;
    setSubmittingReference(true);
    setError('');

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `/api/v1/cards/${activeApplication.id}/txn-reference`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ txn_reference: txnReference })
        }
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Could not submit transaction reference');
      }

      setMessage('Txn Reference submitted. The administrator will verify it for final approval.');
      setPaymentModalOpen(false);
      setTxnReference('');
      setTxnReferenceName('');
      await fetchCards();
    } catch (requestError: any) {
      setError(requestError.message);
    } finally {
      setSubmittingReference(false);
    }
  };

  const statusCopy: Record<string, { title: string; detail: string }> = {
    PENDING: {
      title: 'Application under review',
      detail: `An administrator will review your ${activePackageName} debit card request.`
    },
    AWAITING_PAYMENT: {
      title: 'Card approved — issuance payment required',
      detail: `Your card fee is ${formatUsd(Number(activeApplication?.issuance_fee || 0))}. Follow the Bitcoin transfer instructions and submit your Txn Reference for verification.`
    },
    REFERENCE_SUBMITTED: {
      title: 'Txn Reference submitted',
      detail: 'Your payment image is waiting for administrator verification and final approval.'
    },
    PAYMENT_CONFIRMED: {
      title: 'Payment confirmed',
      detail: 'Your payment has been confirmed. The administrator can now release your card.'
    },
    RELEASED: {
      title: 'Card released',
      detail: 'Your Blue Crest debit card is active in the portal.'
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-4 md:py-8 space-y-8">
      <section className="rounded-[2.5rem] bg-gradient-to-br from-[#003399] via-blue-800 to-indigo-950 p-8 md:p-10 text-white overflow-hidden relative">
        <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-cyan-300/10 blur-2xl" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Blue Crest Debit
          </span>
          <h2 className="mt-5 text-3xl md:text-4xl font-extrabold tracking-tight">A card created only when you’re ready.</h2>
          <p className="mt-3 text-sm text-blue-100/80 leading-relaxed">
            Apply for your debit card, wait for approval, complete the arranged issuance payment, and receive the card after an administrator confirms and releases it.
          </p>
        </div>
      </section>

      {message && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs font-bold text-emerald-700">{message}</div>}
      {error && <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs font-bold text-rose-700">{error}</div>}

      {loading ? (
        <div className="py-20 text-center text-sm font-semibold text-slate-400">Loading card services…</div>
      ) : releasedCard ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="relative aspect-[1.6/1] rounded-[2.5rem] bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950 p-7 md:p-9 text-white shadow-2xl overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_#d4af37_1px,_transparent_1px)] bg-[size:16px_16px]" />
            <div className="relative h-full flex flex-col justify-between">
              <div className="flex justify-between">
                <div>
                  <p className="text-[10px] font-extrabold tracking-[0.25em] text-amber-300">BLUE CREST RESERVE</p>
                  <p className="mt-1 text-[8px] font-bold tracking-widest text-slate-400">{releasedCard.card_type} DEBIT</p>
                </div>
                <p className="italic text-xl font-black">VISA</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-9 w-12 rounded-md bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600" />
                <Wifi className="w-6 h-6 rotate-90 text-white/50" />
              </div>
              <div>
                <p className="font-mono text-lg md:text-2xl tracking-[0.18em]">{formattedNumber}</p>
                <div className="mt-5 flex justify-between">
                  <div>
                    <p className="text-[8px] font-bold tracking-widest text-slate-400">CARD HOLDER</p>
                    <p className="mt-1 text-xs md:text-sm font-bold">{releasedCard.cardholder_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-bold tracking-widest text-slate-400">EXPIRES</p>
                    <p className="mt-1 text-xs md:text-sm font-bold">{releasedCard.expiry_date}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <PackageCheck className="w-7 h-7" />
            </div>
            <h3 className="mt-5 text-xl font-extrabold text-slate-900">Your debit card is released</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">The card was generated after administrative approval and payment confirmation.</p>
            <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
              <p className="font-bold text-slate-700">{activePackageName} package</p>
              <p className="mt-1">
                Purchase limit up to ${Number(releasedCard.purchase_limit_max || 0).toLocaleString()}
              </p>
              <p className="font-bold text-slate-700">Delivery address</p>
              <p className="mt-1">{releasedCard.delivery_address}</p>
            </div>
          </div>
        </div>
      ) : activeApplication ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { label: 'Application', done: true, icon: CreditCard },
            { label: 'Payment confirmation', done: ['PAYMENT_CONFIRMED', 'RELEASED'].includes(activeApplication.status), icon: ShieldCheck },
            { label: 'Card release', done: activeApplication.status === 'RELEASED', icon: PackageCheck }
          ].map(step => (
            <div key={step.label} className={`rounded-3xl border p-6 ${step.done ? 'border-emerald-100 bg-emerald-50/60' : 'border-slate-100 bg-white'}`}>
              <step.icon className={`w-6 h-6 ${step.done ? 'text-emerald-600' : 'text-slate-300'}`} />
              <p className="mt-4 text-sm font-bold text-slate-800">{step.label}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{step.done ? 'Complete' : 'Waiting'}</p>
            </div>
          ))}
          <div className="md:col-span-3 rounded-[2rem] border border-blue-100 bg-blue-50 p-6">
            <div className="flex items-start gap-4">
              <Clock3 className="w-6 h-6 text-[#003399] shrink-0" />
              <div>
                <h3 className="font-extrabold text-slate-900">{statusCopy[activeApplication.status]?.title || activeApplication.status}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{statusCopy[activeApplication.status]?.detail}</p>
                {activeApplication.status === 'AWAITING_PAYMENT' && (
                  <button
                    onClick={() => setPaymentModalOpen(true)}
                    className="mt-4 rounded-xl bg-[#003399] px-4 py-2 text-xs font-bold text-white"
                  >
                    Continue to Bitcoin Payment
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-[#003399] flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900">Apply for a debit card</h3>
                <p className="text-xs text-slate-400">One active application per account</p>
              </div>
            </div>
            <form onSubmit={applyForCard} className="mt-7 space-y-4">
              <fieldset>
                <legend className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Your ATM card
                </legend>
                <div className="mt-3 grid grid-cols-1 gap-3">
                  {CARD_PACKAGES.map(cardPackage => {
                    const selected = selectedPackage === cardPackage.id;

                    return (
                      <label
                        key={cardPackage.id}
                        className={`relative cursor-pointer rounded-2xl border-2 p-4 transition-all ${cardPackage.accent} ${
                          selected ? 'ring-2 ring-[#003399] ring-offset-2' : 'hover:-translate-y-0.5 hover:shadow-md'
                        }`}
                      >
                        <input
                          type="radio"
                          name="cardPackage"
                          value={cardPackage.id}
                          checked={selected}
                          onChange={() => setSelectedPackage(cardPackage.id)}
                          className="sr-only"
                        />
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-widest ${cardPackage.badge}`}>
                          {cardPackage.name}
                        </span>
                        <p className="mt-4 text-2xl font-extrabold text-slate-900">
                          ${cardPackage.fee.toLocaleString()}
                        </p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Card package
                        </p>
                        <div className="mt-4 border-t border-black/5 pt-3">
                          <p className="text-xs font-extrabold text-slate-700">{cardPackage.limit}</p>
                          <p className="mt-1 text-[10px] font-semibold text-slate-500">{cardPackage.shipping}</p>
                        </div>
                        {selected && (
                          <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-[#003399]" />
                        )}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Name on card</label>
              <input
                value={`${user?.first_name || user?.firstName || ''} ${user?.last_name || user?.lastName || ''}`.trim()}
                readOnly
                className="w-full h-12 rounded-xl border border-slate-100 bg-slate-50 px-4 text-sm font-semibold text-slate-600"
              />
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Delivery address</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-4 w-4 h-4 text-slate-300" />
                <textarea
                  value={deliveryAddress}
                  onChange={event => setDeliveryAddress(event.target.value)}
                  required
                  rows={4}
                  className="w-full rounded-xl border border-slate-100 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold outline-none focus:border-blue-200 focus:bg-white"
                  placeholder="Enter the address where the card should be delivered"
                />
              </div>
              <button
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-[#003399] text-white text-sm font-bold hover:bg-blue-800 disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Submit Card Application'}
              </button>
            </form>
          </div>
        </div>
      )}

      {cards.some(card => card.status === 'REJECTED') && !activeApplication && (
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-xs font-semibold text-slate-500">
          <CheckCircle2 className="w-4 h-4" />
          A previous application was rejected. You may submit a new request.
        </div>
      )}

      {paymentModalOpen && activeApplication?.status === 'AWAITING_PAYMENT' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-4"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bitcoin-payment-title"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-[1.5rem] bg-white shadow-2xl sm:rounded-[2rem]"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur md:px-8">
              <div>
                <h2 id="bitcoin-payment-title" className="mt-1 text-xl font-extrabold text-slate-900">
                  Card Approved
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500"
              >
                Close
              </button>
            </div>

            <div className="space-y-7 p-6 text-sm leading-relaxed text-slate-600 md:p-8">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                <p className="font-extrabold text-emerald-800">
                  Your card has been approved and is being prepared for release.
                </p>
                <p className="mt-2 text-sm text-emerald-700">
                  To continue, review the Bitcoin transfer instructions below. If you do not already have a Bitcoin wallet, create one using a trusted provider.
                </p>
              </div>

              <p>
                The amount due for your {activePackageName} card is{' '}
                <strong className="text-slate-900">
                  {formatUsd(Number(activeApplication.issuance_fee || 0))}
                </strong>
                {activeApplication.shipping_included ? ', including shipping.' : ', plus shipping.'}
              </p>

              <section>
                <h3 className="font-extrabold text-slate-900">Bitcoin address</h3>
                <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:flex-row sm:items-center">
                  <input
                    readOnly
                    aria-label="Bitcoin address"
                    value={bitcoinAddress || 'Bitcoin payment address has not been configured.'}
                    className="min-w-0 flex-1 bg-transparent text-xs font-bold text-[#003399] outline-none"
                  />
                  <button
                    type="button"
                    disabled={!bitcoinAddress}
                    onClick={async () => {
                      await navigator.clipboard.writeText(bitcoinAddress);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 2000);
                    }}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#003399] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                  >
                    <Copy className="h-4 w-4" />
                    {copied ? 'Copied!' : 'Copy Address'}
                  </button>
                </div>
                {copied && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 text-xs font-bold text-emerald-600"
                  >
                    Bitcoin address copied successfully.
                  </motion.p>
                )}
              </section>

              <section className="rounded-2xl border border-slate-100 p-5">
                <h3 className="font-extrabold text-slate-900">Bitcoin transfer instructions</h3>
                <p className="mt-2 text-xs">
                  You may acquire and send Bitcoin through services available in your region, including wallet applications, cryptocurrency exchanges, financial services that support Bitcoin transactions, and Bitcoin ATMs where available.
                </p>
                <ol className="mt-4 list-decimal space-y-2 pl-5 text-xs">
                  <li>Obtain Bitcoin from a service of your choice.</li>
                  <li>Copy the Bitcoin address displayed above.</li>
                  <li>Paste it into the recipient field within your wallet or exchange.</li>
                  <li>Verify the address, amount, and all details before confirming.</li>
                  <li>Submit the transaction and wait for network confirmation.</li>
                </ol>
              </section>

              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs text-amber-900">
                <h3 className="font-extrabold">Important notice</h3>
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  <li>Always verify the Bitcoin address before sending.</li>
                  <li>Cryptocurrency transactions may be irreversible once confirmed.</li>
                  <li>Never share your wallet recovery phrase or private keys.</li>
                  <li>Keep your transaction records for reference.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-extrabold text-slate-900">Upload Txn Reference</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Upload a clear image of the receipt or completed transaction. JPEG, PNG, or WebP; maximum 5 MB.
                </p>
                <label className="mt-3 flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-5 hover:border-blue-300">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-[#003399]">
                    <Upload className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-extrabold text-slate-700">
                      {txnReferenceName || 'Choose Txn Reference image'}
                    </span>
                    <span className="mt-1 block text-[10px] text-slate-400">Click to browse your device</span>
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={event => handleTxnReference(event.target.files?.[0])}
                    className="sr-only"
                  />
                </label>
                {txnReference && (
                  <img
                    src={txnReference}
                    alt="Txn Reference preview"
                    className="mt-4 max-h-52 w-full rounded-2xl border border-slate-100 object-contain"
                  />
                )}
              </section>

              <button
                type="button"
                disabled={!bitcoinAddress || !txnReference || submittingReference}
                onClick={submitTxnReference}
                className="w-full rounded-xl bg-emerald-600 px-5 py-4 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingReference ? 'Submitting Txn Reference...' : 'Submit Txn Reference for Final Approval'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
