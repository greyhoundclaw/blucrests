import { ArrowDownLeft, ArrowUpRight, Download, FileDown, FileText } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { cn } from '../lib/utils';

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const receiptShell = (title: string, rows: Array<[string, unknown]>) => `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>body{font-family:Arial;color:#0f172a;padding:48px;max-width:720px;margin:auto}.brand{color:#003399}table{width:100%;border-collapse:collapse;margin-top:32px}td{padding:14px;border-bottom:1px solid #e2e8f0}td:first-child{color:#64748b;width:36%}h1{margin-bottom:4px}.footer{margin-top:40px;color:#64748b;font-size:12px}@media print{body{padding:20px}}</style></head>
  <body><h1 class="brand">Blue Crest Premium Banking</h1><h2>Transaction receipt</h2><table>${rows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join('')}</table>
  <p class="footer">This electronic receipt reflects the transaction record held by Blue Crest Premium Banking.</p></body></html>`;

export default function TransactionHistory({ transactions, formatCurrency }: { transactions: any[]; formatCurrency: (amount: number) => string }) {
  const buildReceipt = async (transaction: any) => {
    const transferId = String(transaction.reference || '').match(/^TXN-TRF-(\d+)-/)?.[1];
    let receiptNumber = transaction.reference || transaction.id;
    let rows: Array<[string, unknown]>;

    if (transferId) {
      const receipt = await apiRequest<any>(`/api/v1/transfers/${transferId}/receipt`);
      if (receipt.status !== 'COMPLETED') throw new Error('Receipts are available after a transfer is completed');
      receiptNumber = receipt.receipt_number;
      rows = [
        ['Reference', receipt.receipt_number],
        ['Date and time', new Date(receipt.created_at).toLocaleString()],
        ['Amount', `${receipt.currency} ${Number(receipt.amount).toFixed(2)}`],
        ['Recipient', receipt.recipient_name],
        ['Destination', `${receipt.recipient_bank || 'Blue Crest'} · ${receipt.recipient_account_number}`],
        ['Payment method', receipt.transfer_type],
        ['Status', receipt.status]
      ];
    } else {
      const source = [transaction.originName, transaction.originBank].filter(Boolean).join(' — ');
      rows = [
        ['Reference', receiptNumber],
        ['Date and time', `${transaction.date} ${transaction.time}`],
        ['Transaction type', String(transaction.type).toUpperCase()],
        ['Amount', formatCurrency(transaction.amount)],
        ...(source ? [['From', source] as [string, unknown]] : []),
        ...(transaction.originAccountNumber ? [['Originating account', transaction.originAccountNumber] as [string, unknown]] : []),
        ['Description', transaction.name],
        ['Status', transaction.status]
      ];
    }

    return { receiptNumber, html: receiptShell(receiptNumber, rows) };
  };

  const downloadReceipt = async (transaction: any) => {
    const { receiptNumber, html } = await buildReceipt(transaction);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${receiptNumber}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const openPdfReceipt = async (transaction: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) throw new Error('Please allow pop-ups to create a PDF receipt');

    try {
      printWindow.document.write('<p style="font-family:Arial;padding:32px">Preparing your PDF receipt…</p>');
      const { html } = await buildReceipt(transaction);
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      window.setTimeout(() => printWindow.print(), 300);
    } catch (error) {
      printWindow.close();
      throw error;
    }
  };

  return <div className="rounded-[1.75rem] border border-slate-100 bg-white p-4 shadow-sm sm:p-6 md:rounded-[2.5rem] md:p-10">
    <div className="mb-6 px-1 md:mb-8">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#003399]">Payments</p>
      <h2 className="mt-1 text-xl font-extrabold text-slate-900 md:text-2xl">Transaction history</h2>
      <p className="mt-1 text-[11px] font-medium text-slate-400">Credits in green, debits in red.</p>
    </div>

    <div className="space-y-3">
      {transactions.length === 0 && <div className="py-16 text-center text-slate-400"><FileText className="mx-auto mb-3 h-9 w-9" /><p className="text-sm font-semibold">No transactions yet.</p></div>}
      {transactions.map(transaction => {
        const isCredit = String(transaction.type).toLowerCase() === 'credit';
        const isCompleted = String(transaction.status).toLowerCase() === 'completed';
        const DirectionIcon = isCredit ? ArrowDownLeft : ArrowUpRight;

        return <article key={transaction.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.035)] transition-colors hover:border-slate-200 md:flex md:items-center md:gap-4">
          <div className="flex min-w-0 items-start gap-3 md:flex-1 md:items-center">
            <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}>
              <DirectionIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3 md:block">
                <p className="truncate text-sm font-bold text-slate-800">{transaction.name}</p>
                <p className={cn('shrink-0 text-sm font-extrabold md:hidden', isCredit ? 'text-emerald-600' : 'text-rose-600')}>{isCredit ? '+' : '-'}{formatCurrency(transaction.amount)}</p>
              </div>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400 md:text-[10px]">{transaction.date} · {transaction.time} <span className="hidden sm:inline">· {transaction.id}</span></p>
              {transaction.originName && <p className="mt-1 truncate text-[10px] font-semibold text-[#003399]">From {transaction.originName}{transaction.originBank ? ` · ${transaction.originBank}` : ''}{transaction.originAccountNumber ? ` · ${transaction.originAccountNumber}` : ''}</p>}
              {transaction.performedBy && <p className="mt-1 text-[10px] font-semibold text-[#003399]">Joint account activity by {transaction.performedBy}</p>}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 md:mt-0 md:block md:border-0 md:pt-0 md:text-right">
            <span className={cn('rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider md:block md:bg-transparent md:p-0', isCompleted ? 'bg-emerald-50 text-emerald-700 md:text-slate-400' : 'bg-amber-50 text-amber-700 md:text-slate-400')}>{transaction.status}</span>
            <p className={cn('hidden font-extrabold md:mt-1 md:block', isCredit ? 'text-emerald-600' : 'text-rose-600')}>{isCredit ? '+' : '-'}{formatCurrency(transaction.amount)}</p>
          </div>

          {isCompleted && <div className="mt-3 grid grid-cols-2 gap-2 md:mt-0 md:flex md:shrink-0">
            <button onClick={() => downloadReceipt(transaction).catch(error => alert(error.message))} className="flex items-center justify-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wide text-[#003399] transition-colors hover:bg-blue-100" title="Download receipt">
              <Download className="h-4 w-4" /><span>Download</span>
            </button>
            <button onClick={() => openPdfReceipt(transaction).catch(error => alert(error.message))} className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-wide text-white transition-colors hover:bg-slate-800" title="Save receipt as PDF">
              <FileDown className="h-4 w-4" /><span>PDF</span>
            </button>
          </div>}
        </article>;
      })}
    </div>
  </div>;
}
