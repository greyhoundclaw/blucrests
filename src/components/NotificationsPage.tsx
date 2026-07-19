import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, ExternalLink, Shield, AlertTriangle, X } from 'lucide-react';
import { apiRequest } from '../lib/api';

type Notification = {
  id: number;
  title: string;
  message: string;
  type: string;
  action_link?: string;
  is_read: number;
  created_at: string;
};

export default function NotificationsPage({ onNavigate, onClose }: { onNavigate?: (tab: string) => void; onClose?: () => void }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setNotifications(await apiRequest<Notification[]>('/api/v1/notifications'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (note: Notification) => {
    if (!note.is_read) {
      await apiRequest(`/api/v1/notifications/${note.id}/read`, { method: 'PATCH' });
      setNotifications(items => items.map(item => item.id === note.id ? { ...item, is_read: 1 } : item));
    }
    if (note.action_link && onNavigate) {
      const target = new URL(note.action_link, window.location.origin);
      window.history.replaceState({}, '', `${target.pathname}${target.search}`);
      onNavigate(target.pathname.replace(/^\//, '') || 'dashboard');
    }
  };

  const markAllRead = async () => {
    await apiRequest('/api/v1/notifications/read-all', { method: 'PATCH' });
    setNotifications(items => items.map(item => ({ ...item, is_read: 1 })));
  };

  return (
    <div className="max-w-4xl mx-auto py-4 md:py-8">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <p className="text-[10px] font-bold text-[#003399] uppercase tracking-[0.2em]">Notification center</p>
          <h2 className="text-2xl font-extrabold text-slate-900 mt-1">Your updates</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={markAllRead} disabled={!notifications.some(note => !note.is_read)}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 disabled:opacity-40 flex items-center gap-2">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
          {onClose && <button onClick={onClose} aria-label="Close notifications" className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-500 flex items-center justify-center"><X className="w-4 h-4" /></button>}
        </div>
      </div>

      {loading && <div className="py-20 text-center text-sm font-semibold text-slate-400">Loading notifications…</div>}
      {error && <div className="p-4 rounded-2xl bg-rose-50 text-rose-600 text-sm font-semibold">{error}</div>}
      {!loading && !error && notifications.length === 0 && (
        <div className="bg-white rounded-[2rem] border border-slate-100 py-20 text-center">
          <Bell className="w-10 h-10 text-slate-300 mx-auto mb-4" />
          <p className="font-bold text-slate-700">You’re all caught up.</p>
          <p className="text-sm text-slate-400 mt-1">New account messages will appear here.</p>
        </div>
      )}
      <div className="space-y-3">
        {notifications.map(note => {
          const warning = ['WARNING', 'SECURITY'].includes(note.type);
          return (
            <button key={note.id} onClick={() => markRead(note)}
              className={`w-full text-left p-5 md:p-6 rounded-[1.75rem] border flex items-start gap-4 transition-all ${
                note.is_read ? 'bg-white border-slate-100' : 'bg-blue-50/60 border-blue-100 shadow-sm'
              }`}>
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                warning ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-[#003399]'
              }`}>
                {note.type === 'SECURITY' ? <Shield className="w-5 h-5" /> :
                  warning ? <AlertTriangle className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    {!note.is_read && <span className="w-2 h-2 rounded-full bg-[#003399]" />}
                    {note.title}
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {new Date(note.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed mt-2">{note.message}</p>
                {note.action_link && <span className="inline-flex items-center gap-1 text-xs font-bold text-[#003399] mt-3">View details <ExternalLink className="w-3 h-3" /></span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
