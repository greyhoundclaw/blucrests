import { FormEvent, useState } from 'react';
import { Bitcoin, Copy, Gift, ImagePlus, LoaderCircle, X } from 'lucide-react';
import { apiRequest } from '../lib/api';

type Method = 'GIFTCARD' | 'BITCOIN';
const BITCOIN_ADDRESS = 'bc1qdxsym4k0rfne6cd0pn6233llkh5sy4fhj7p44l';

const readImage = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error('Could not read the selected image.'));
  reader.readAsDataURL(file);
});

export default function DepositPage({ formatCurrency, targetAccountId, targetAccountLabel, compact = false, onSubmitted }: { formatCurrency?: (amount: number) => string; targetAccountId?: number; targetAccountLabel?: string; compact?: boolean; onSubmitted?: () => void }) {
  const [method, setMethod] = useState<Method>('GIFTCARD');
  const [amount, setAmount] = useState('');
  const [cardName, setCardName] = useState('');
  const [images, setImages] = useState<{ name: string; data: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const addImages = async (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files);
    if (selected.some(file => !file.type.startsWith('image/'))) {
      setMessage('Only image files can be uploaded.');
      return;
    }
    if (selected.some(file => file.size > 3 * 1024 * 1024)) {
      setMessage('Each image must be smaller than 3 MB.');
      return;
    }
    const encoded = await Promise.all(selected.map(async file => ({ name: file.name, data: await readImage(file) })));
    setImages(current => [...current, ...encoded]);
    setMessage('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return setMessage('Enter a valid deposit amount.');
    if (method === 'GIFTCARD' && !cardName.trim()) return setMessage('Enter the card name.');
    if (images.length === 0) return setMessage(method === 'BITCOIN' ? 'Upload your Bitcoin payment receipt.' : 'Add at least one gift card image.');
    try {
      setBusy(true);
      setMessage('');
      await apiRequest('/api/v1/deposits', {
        method: 'POST',
        body: JSON.stringify({ method, amount: numericAmount, card_name: cardName.trim(), bitcoin_address: method === 'BITCOIN' ? BITCOIN_ADDRESS : '', images, ...(targetAccountId ? { account_id: targetAccountId } : {}) })
      });
      setMessage(`Your ${formatCurrency ? formatCurrency(numericAmount) : numericAmount} deposit request${targetAccountLabel ? ` to ${targetAccountLabel}` : ''} was submitted for review.`);
      setAmount(''); setCardName(''); setImages([]);
      onSubmitted?.();
    } catch (error: any) {
      setMessage(error.message || 'Could not submit the deposit.');
    } finally { setBusy(false); }
  };

  return <div className={compact ? '' : 'max-w-3xl mx-auto py-4 md:py-8'}>
    {!compact && <><p className="text-[10px] font-bold text-[#003399] uppercase tracking-[0.2em]">Fund your account</p><h2 className="text-2xl font-extrabold text-slate-900 mt-1 mb-7">Deposit</h2></>}
    {targetAccountLabel && <div className="mb-4 rounded-2xl bg-blue-50 border border-blue-100 p-3 text-xs font-bold text-[#003399]">Deposit destination: {targetAccountLabel}</div>}
    <div className="grid grid-cols-2 gap-3 mb-6">
      {([{ id: 'GIFTCARD', label: 'Gift card', icon: Gift }, { id: 'BITCOIN', label: 'Bitcoin address', icon: Bitcoin }] as const).map(option => <button key={option.id} onClick={() => { setMethod(option.id); setMessage(''); }} className={`p-5 rounded-2xl border text-left flex items-center gap-3 ${method === option.id ? 'bg-blue-50 border-blue-200 text-[#003399]' : 'bg-white border-slate-100 text-slate-600'}`}><option.icon className="w-5 h-5"/><span className="text-sm font-bold">{option.label}</span></button>)}
    </div>
    <form onSubmit={submit} className={`bg-white rounded-[2rem] border border-slate-100 ${compact ? 'p-4 md:p-5' : 'p-6 md:p-8'} space-y-5`}>
      <label className="block"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</span><input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="field-control mt-2" placeholder="0.00" /></label>
      {method === 'GIFTCARD' ? <>
        <label className="block"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Name of card</span><input value={cardName} onChange={e => setCardName(e.target.value)} className="field-control mt-2" placeholder="e.g. Apple, Amazon, Steam" /></label>
      </> : <div><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Send Bitcoin to this address</span><div className="mt-2 rounded-xl bg-slate-50 border border-slate-100 p-4 flex items-center gap-3"><code className="text-xs sm:text-sm font-bold text-slate-700 break-all flex-1">{BITCOIN_ADDRESS}</code><button type="button" title="Copy Bitcoin address" onClick={() => { navigator.clipboard?.writeText(BITCOIN_ADDRESS); setMessage('Bitcoin address copied.'); }} className="w-10 h-10 shrink-0 rounded-lg bg-[#003399] text-white flex items-center justify-center"><Copy className="w-4 h-4"/></button></div><p className="mt-2 text-xs text-amber-600 font-semibold">Send only Bitcoin (BTC) to this address, then upload the payment receipt below.</p></div>}
      <div><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{method === 'BITCOIN' ? 'Payment receipt' : 'Card images'}</span><label className="mt-2 min-h-28 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer text-slate-500 hover:border-blue-300"><ImagePlus className="w-6 h-6 mb-2"/><span className="text-xs font-bold">{method === 'BITCOIN' ? 'Upload receipt image' : 'Add one or more images'}</span><input type="file" accept="image/*" multiple className="hidden" onChange={e => addImages(e.target.files)} /></label>
        {images.length > 0 && <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-3">{images.map((image, index) => <div key={`${image.name}-${index}`} className="relative aspect-square"><img src={image.data} alt={image.name} className="w-full h-full rounded-xl object-cover"/><button type="button" onClick={() => setImages(items => items.filter((_, i) => i !== index))} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center"><X className="w-3 h-3"/></button></div>)}</div>}
      </div>
      {message && <div className="p-4 rounded-xl bg-blue-50 text-[#003399] text-sm font-semibold">{message}</div>}
      <button disabled={busy} className="w-full h-12 rounded-xl bg-[#003399] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60">{busy && <LoaderCircle className="w-4 h-4 animate-spin"/>}{busy ? 'Submitting…' : 'Submit deposit request'}</button>
    </form>
  </div>;
}
