import { BellRing } from 'lucide-react';

export default function NotificationAlert({ count, onView }: { count: number; onView: () => void }) {
  if (!count) return null;
  return <div className="fixed inset-0 z-[100] bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label="New notification">
    <div className="w-full max-w-md rounded-[2rem] bg-white p-7 text-center shadow-2xl border border-blue-100">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#003399] flex items-center justify-center mx-auto mb-5"><BellRing className="w-8 h-8"/></div>
      <p className="text-[10px] font-bold text-[#003399] uppercase tracking-[0.2em]">Action required</p>
      <h2 className="text-2xl font-extrabold text-slate-900 mt-2">You have {count} new notification{count === 1 ? '' : 's'}</h2>
      <p className="text-sm text-slate-500 mt-3">Open your notification center to review and acknowledge your new message{count === 1 ? '' : 's'}.</p>
      <button autoFocus onClick={onView} className="w-full h-12 mt-6 rounded-xl bg-[#003399] text-white text-sm font-bold">View notifications</button>
    </div>
  </div>;
}
