import { useCallback, useEffect, useState } from 'react';
import { KeyRound, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { apiRequest } from '../lib/api';

export default function AdminSecurity({ users }: { users: any[] }) {
  const [codes, setCodes] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [userId, setUserId] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [message, setMessage] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [codeRows, attemptRows] = await Promise.all([
      apiRequest<any[]>('/api/v1/admin/transfer-verification/codes'),
      apiRequest<any[]>('/api/v1/admin/transfer-verification/attempts')
    ]);
    setCodes(codeRows); setAttempts(attemptRows);
  }, []);
  useEffect(() => { load().catch(error => setMessage(error.message)); }, [load]);

  const assign = async () => {
    setBusy(true); setMessage('');
    try {
      const result = await apiRequest<any>('/api/v1/admin/transfer-verification/codes', {
        method: 'POST', body: JSON.stringify({ user_id: Number(userId), code: customCode || undefined })
      });
      setMessage(`Cross Border Insurance Code ${result.code} assigned and delivered to the user's notifications. The transfer hold is now lifted.`);
      setCustomCode(''); await load();
    } catch (error: any) { setMessage(error.message); } finally { setBusy(false); }
  };

  const resetPassword = async () => {
    setBusy(true); setMessage('');
    try {
      const result = await apiRequest<any>(`/api/v1/admin/users/${userId}/reset-password`, {
        method: 'POST', body: JSON.stringify({ temporary_password: temporaryPassword || undefined, force_change: true })
      });
      setMessage(`Temporary password created: ${result.temporary_password}. The user must change it at next login.`);
      setTemporaryPassword('');
    } catch (error: any) { setMessage(error.message); } finally { setBusy(false); }
  };

  return <div className="space-y-6">
    {message && <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 text-[#003399] text-sm font-bold">{message}</div>}
    <div className="grid xl:grid-cols-2 gap-6">
      <div className="bg-white rounded-[2rem] p-6 border border-slate-100 space-y-4">
        <h3 className="font-extrabold flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[#003399]" /> Cross Border Insurance Codes</h3>
        <select value={userId} onChange={e => setUserId(e.target.value)} className="field-control"><option value="">Select user</option>{users.filter(user => user.role !== 'ADMIN').map(user => <option key={user.id} value={user.id}>{user.first_name} {user.last_name} · {user.email}</option>)}</select>
        <input value={customCode} onChange={e => setCustomCode(e.target.value.replace(/\D/g, ''))} minLength={6} maxLength={12} className="field-control" placeholder="Optional custom 6–12 digit code" />
        <button disabled={busy || !userId} onClick={assign} className="w-full py-3 rounded-xl bg-[#003399] text-white text-xs font-bold">{busy ? 'Working…' : 'Assign code & lift hold'}</button>
        <p className="text-[10px] text-slate-400">The full code is sent to the selected user's notification center. Stored codes remain hashed.</p>
      </div>
      <div className="bg-white rounded-[2rem] p-6 border border-slate-100 space-y-4">
        <h3 className="font-extrabold flex items-center gap-2"><KeyRound className="w-5 h-5 text-[#003399]" /> Password assistance</h3>
        <select value={userId} onChange={e => setUserId(e.target.value)} className="field-control"><option value="">Select user</option>{users.filter(user => user.role !== 'ADMIN').map(user => <option key={user.id} value={user.id}>{user.first_name} {user.last_name} · {user.email}</option>)}</select>
        <input type="password" value={temporaryPassword} onChange={e => setTemporaryPassword(e.target.value)} className="field-control" placeholder="Optional temporary password" />
        <button disabled={busy || !userId} onClick={resetPassword} className="w-full py-3 rounded-xl bg-slate-900 text-white text-xs font-bold">Reset password & force change</button>
        <p className="text-[10px] text-slate-400">Existing passwords remain hashed and are never visible to administrators.</p>
      </div>
    </div>
    <div className="bg-white rounded-[2rem] p-6 border border-slate-100">
      <div className="flex justify-between mb-4"><h3 className="font-extrabold">Assigned codes</h3><button onClick={load}><RefreshCw className="w-4 h-4" /></button></div>
      <div className="space-y-2">{codes.map(code => <div key={code.id} className="p-3 rounded-xl border border-slate-100 flex items-center gap-3 text-xs"><div className="flex-1"><p className="font-bold">{code.first_name} {code.last_name}</p><p className="text-slate-400 mt-1">{code.email} · ending {code.code_last_four}</p></div><button onClick={async () => setHistory(await apiRequest<any[]>(`/api/v1/admin/transfer-verification/codes/${code.id}/transfers`))} className="text-[10px] font-bold text-[#003399]">Transfers</button><span className={`font-bold ${code.status === 'ACTIVE' ? 'text-emerald-600' : 'text-slate-400'}`}>{code.status}</span>{code.status === 'ACTIVE' && <button onClick={async () => { await apiRequest(`/api/v1/admin/transfer-verification/codes/${code.id}`, { method: 'DELETE' }); await load(); }} className="p-2 text-rose-500"><Trash2 className="w-4 h-4" /></button>}</div>)}</div>
      {history.length > 0 && <div className="mt-4 p-4 rounded-xl bg-slate-50"><p className="text-xs font-bold mb-2">Transfers associated with selected code</p>{history.map(transfer => <p key={transfer.id} className="text-[10px] text-slate-500 py-1">#{transfer.id} · {transfer.currency} {transfer.amount} · {transfer.status}</p>)}</div>}
    </div>
    <div className="bg-white rounded-[2rem] p-6 border border-slate-100">
      <h3 className="font-extrabold mb-4">Recent verification attempts</h3>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="text-slate-400 uppercase"><th className="py-2">User</th><th>Code</th><th>Result</th><th>Date</th></tr></thead><tbody>{attempts.slice(0, 50).map(item => <tr key={item.id} className="border-t border-slate-50"><td className="py-3">{item.first_name} {item.last_name}</td><td>••••{item.code_last_four || '—'}</td><td className={item.success ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>{item.success ? 'Verified' : 'Failed'}</td><td>{new Date(item.created_at).toLocaleString()}</td></tr>)}</tbody></table></div>
    </div>
  </div>;
}
