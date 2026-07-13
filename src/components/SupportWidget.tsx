import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Headphones, LoaderCircle, Send, X } from 'lucide-react';
import { apiRequest } from '../lib/api';

type Message = { id: number; sender_role: 'USER' | 'ADMIN'; message: string; created_at: string };

export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<{ messages: Message[] }>('/api/v1/support/conversation');
      setMessages(data.messages || []);
      setError('');
    } catch (err: any) { setError(err.message); }
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
    const timer = window.setInterval(load, 4000);
    return () => window.clearInterval(timer);
  }, [open, load]);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    try {
      setSending(true); setError('');
      await apiRequest('/api/v1/support/messages', { method: 'POST', body: JSON.stringify({ message: text.trim() }) });
      setText(''); await load();
    } catch (err: any) { setError(err.message); } finally { setSending(false); }
  };

  return <>
    {open && <section className="fixed z-[90] bottom-24 right-4 md:right-7 w-[calc(100vw-2rem)] max-w-sm h-[min(600px,calc(100vh-8rem))] bg-white border border-slate-200 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col" aria-label="Customer support chat">
      <header className="bg-[#003399] text-white p-5 flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"><Headphones className="w-5 h-5"/></div><div><h2 className="font-extrabold">Blue Crest Support</h2><p className="text-[10px] text-blue-200">Your conversation is saved securely</p></div></div><button onClick={() => setOpen(false)} aria-label="Close support"><X className="w-5 h-5"/></button></header>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {messages.length === 0 && <div className="text-center py-12"><Headphones className="w-8 h-8 text-blue-200 mx-auto"/><p className="mt-3 text-sm font-bold text-slate-700">How can we help?</p><p className="mt-1 text-xs text-slate-400">Send a message and support will reply here.</p></div>}
        {messages.map(item => <div key={item.id} className={`flex ${item.sender_role === 'USER' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] p-3 rounded-2xl ${item.sender_role === 'USER' ? 'bg-[#003399] text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md'}`}><p className="text-sm whitespace-pre-wrap break-words">{item.message}</p><p className={`text-[8px] mt-1.5 ${item.sender_role === 'USER' ? 'text-blue-200' : 'text-slate-400'}`}>{new Date(item.created_at).toLocaleString()}</p></div></div>)}
        <div ref={bottom}/>
      </div>
      {error && <p className="px-4 py-2 bg-rose-50 text-rose-600 text-xs font-semibold">{error}</p>}
      <form onSubmit={send} className="p-3 border-t border-slate-100 flex gap-2"><textarea value={text} onChange={e => setText(e.target.value)} rows={2} maxLength={4000} placeholder="Type your message…" className="flex-1 resize-none rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300"/><button disabled={sending || !text.trim()} className="w-12 rounded-xl bg-[#003399] text-white flex items-center justify-center disabled:opacity-50">{sending ? <LoaderCircle className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}</button></form>
    </section>}
    <button onClick={() => setOpen(value => !value)} className="fixed z-[89] bottom-5 right-4 md:right-7 w-14 h-14 rounded-full bg-[#003399] text-white shadow-xl shadow-blue-900/30 flex items-center justify-center hover:scale-105 transition-transform" aria-label="Open customer support">{open ? <X className="w-6 h-6"/> : <Headphones className="w-6 h-6"/>}</button>
  </>;
}
