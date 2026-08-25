import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Select } from '../components/common/Input';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { useRates } from '../contexts/RatesContext';
import api from '../services/api';
import {
  History as HistoryIcon,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCcw,
  ShieldCheck,
  Coins,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';

export function History() {
  const { formatAmount } = useRates();
  const [historyData, setHistoryData] = useState({ rows: [], total: 0, page: 1, totalPages: 1 });
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '15',
      });
      if (currencyFilter) params.append('currency', currencyFilter);
      if (typeFilter) params.append('type', typeFilter);

      const resp = await api.get(`/wallet/history?${params.toString()}`);
      setHistoryData(resp.data);
    } catch (err) {
      console.error('History fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [page, currencyFilter, typeFilter]);

  const currencies = ['', 'THB', 'USD', 'CNY', 'GBP', 'EUR', 'JPY', 'XAU', 'XAG', 'MBC'];
  const types = [
    { label: 'All Types', value: '' },
    { label: 'Transfers In', value: 'transfer_in' },
    { label: 'Transfers Out', value: 'transfer_out' },
    { label: 'Currency Exchanges', value: 'exchange' },
    { label: 'Staking Rewards', value: 'staking_reward' },
    { label: 'Escrow Locks', value: 'escrow_lock' },
    { label: 'Escrow Releases', value: 'escrow_release' },
    { label: 'Split Bill Payments', value: 'split_out' },
    { label: 'Deposits', value: 'deposit' },
    { label: 'Withdrawals', value: 'withdraw' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <HistoryIcon className="w-5 h-5 text-brand-400" />
              <span>Transaction Audit Ledger</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Immutable double-entry transaction records with cryptographic TXIDs
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <Select
              value={currencyFilter}
              onChange={(e) => {
                setCurrencyFilter(e.target.value);
                setPage(1);
              }}
              className="py-1.5 text-xs"
            >
              <option value="" className="bg-slate-900">All Currencies</option>
              {currencies.filter(Boolean).map((c) => (
                <option key={c} value={c} className="bg-slate-900">{c}</option>
              ))}
            </Select>

            <Select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="py-1.5 text-xs"
            >
              {types.map((t) => (
                <option key={t.value} value={t.value} className="bg-slate-900">{t.label}</option>
              ))}
            </Select>
          </div>
        </div>

        {/* Transactions Table */}
        {loading ? (
          <div className="text-center py-16 text-slate-500 font-mono text-sm">
            Loading ledger records...
          </div>
        ) : historyData.rows.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm">
            No transactions found matching the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Counterpart / Memo</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {historyData.rows.map((tx) => {
                  const isIncome = ['deposit', 'transfer_in', 'staking_reward', 'escrow_release', 'split_in', 'external_in'].includes(tx.type);
                  const date = new Date(tx.created_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={tx.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-300">{date}</td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={
                            isIncome
                              ? 'success'
                              : tx.type === 'exchange'
                              ? 'primary'
                              : tx.type.includes('escrow')
                              ? 'warning'
                              : 'default'
                          }
                        >
                          {tx.type.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-300">
                        {tx.counterpart_username && (
                          <span className="text-white font-semibold">@{tx.counterpart_username} </span>
                        )}
                        {tx.note && <span className="text-slate-400">{tx.note}</span>}
                        {!tx.counterpart_username && !tx.note && <span className="text-slate-500">-</span>}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold">
                        <span className={isIncome ? 'text-emerald-400' : 'text-slate-100'}>
                          {isIncome ? '+' : '-'}{formatAmount(tx.amount, tx.currency)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setSelectedTx(tx)}
                          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                          title="View receipt"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {historyData.totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800">
            <span className="text-xs text-slate-400">
              Page <span className="text-white font-semibold">{historyData.page}</span> of{' '}
              <span className="text-white font-semibold">{historyData.totalPages}</span> ({historyData.total} total)
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                icon={<ChevronLeft className="w-4 h-4" />}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= historyData.totalPages}
                onClick={() => setPage((p) => p + 1)}
                icon={<ChevronRight className="w-4 h-4" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Transaction Detail Modal */}
      <Modal
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        title="Transaction Receipt"
      >
        {selectedTx && (
          <div className="space-y-4 text-sm">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
              <span className="text-xs uppercase font-bold text-slate-400">{selectedTx.type.replace(/_/g, ' ')}</span>
              <p className="text-2xl font-bold font-mono text-white mt-1">
                {formatAmount(selectedTx.amount, selectedTx.currency)}
              </p>
            </div>

            <div className="space-y-2.5 text-xs divide-y divide-slate-800">
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Transaction ID (TXID)</span>
                <span className="font-mono text-white text-[11px] break-all text-right max-w-[200px]">{selectedTx.txid}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Timestamp</span>
                <span className="text-white font-mono">{new Date(selectedTx.created_at).toLocaleString()}</span>
              </div>
              {selectedTx.counterpart_username && (
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Counterpart</span>
                  <span className="text-white font-semibold">@{selectedTx.counterpart_username}</span>
                </div>
              )}
              {selectedTx.from_currency && (
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Exchanged From</span>
                  <span className="text-white font-mono">{selectedTx.from_amount} {selectedTx.from_currency}</span>
                </div>
              )}
              {selectedTx.rate && (
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Execution Rate</span>
                  <span className="text-white font-mono">{parseFloat(selectedTx.rate).toFixed(8)}</span>
                </div>
              )}
              {selectedTx.note && (
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400">Note / Memo</span>
                  <span className="text-white">{selectedTx.note}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
