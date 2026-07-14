import { Download, FileText } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { cn } from '../lib/utils';

export default function TransactionHistory({ transactions, formatCurrency }: { transactions: any[]; formatCurrency: (amount: number) => string }) {
  const downloadReceipt = async (transaction: any) => {
    const transferId = String(transaction.reference || '').match(/^TXN-TRF-(\d+)-/)?.[1];
    if (!transferId) throw new Error('This transaction is not linked to a transfer receipt');
    const receipt = await apiRequest<any>(`/api/v1/transfers/${transferId}/receipt`);
    if (receipt.status !== 'COMPLETED') throw new Error('Receipts are available after a transfer is completed');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${receipt.receipt_number}</title>
      <style>body{font-family:Arial;color:#0f172a;padding:48px;max-width:720px;margin:auto}.brand{color:#003399}table{width:100%;border-collapse:collapse;margin-top:32px}td{padding:14px;border-bottom:1px solid #e2e8f0}td:first-child{color:#64748b}h1{margin-bottom:4px}.status{color:#059669;font-weight:bold}.footer{margin-top:40px;color:#64748b;font-size:12px}</style></head>
      <body><h1 class="brand">${receipt.company_name}</h1><p>${receipt.company_tagline}</p><h2>Transfer receipt</h2>
      <table><tr><td>Transaction ID</td><td>${receipt.receipt_number}</td></tr><tr><td>Date and time</td><td>${new Date(receipt.created_at).toLocaleString()}</td></tr>
      <tr><td>Amount</td><td>${receipt.currency} ${Number(receipt.amount).toFixed(2)}</td></tr><tr><td>Recipient</td><td>${receipt.recipient_name}</td></tr>
      <tr><td>Destination</td><td>${receipt.recipient_bank || 'Blue Crest'} · ${receipt.recipient_account_number}</td></tr><tr><td>Payment method</td><td>${receipt.transfer_type}</td></tr>
      <tr><td>Status</td><td class="status">${receipt.status}</td></tr></table><p class="footer">This receipt was generated electronically and reflects the transfer record held by ${receipt.company_name}.</p></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${receipt.receipt_number}.html`; anchor.click();
    URL.revokeObjectURL(url);
  };

  return <div className="bg-white rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-slate-100">
    <div className="mb-8"><p className="text-[10px] font-bold text-[#003399] uppercase tracking-[0.2em]">Payments</p><h2 className="text-2xl font-extrabold text-slate-900 mt-1">Transaction history</h2></div>
    <div className="space-y-3">{transactions.length === 0 && <div className="py-16 text-center text-slate-400"><FileText className="w-9 h-9 mx-auto mb-3" /><p className="text-sm font-semibold">No transactions yet.</p></div>}
      {transactions.map(transaction => <div key={transaction.id} className="p-4 rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1"><p className="text-sm font-bold text-slate-800">{transaction.name}</p><p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{transaction.id} · {transaction.date} {transaction.time}</p>{transaction.performedBy && <p className="text-[10px] text-[#003399] font-semibold mt-1">Performed by {transaction.performedBy}</p>}</div>
        <div className="sm:text-right"><p className={cn('font-extrabold', transaction.type === 'credit' ? 'text-emerald-600' : 'text-slate-900')}>{transaction.type === 'credit' ? '+' : '-'}{formatCurrency(transaction.amount)}</p><p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{transaction.status}</p></div>
        {transaction.status === 'Completed' && transaction.category?.toLowerCase() === 'transfer' && <button onClick={() => downloadReceipt(transaction).catch(error => alert(error.message))} className="p-3 rounded-xl bg-blue-50 text-[#003399]" title="Download receipt"><Download className="w-4 h-4" /></button>}
      </div>)}
    </div>
  </div>;
}
