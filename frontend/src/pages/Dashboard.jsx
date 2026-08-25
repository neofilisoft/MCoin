import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { useRates } from '../contexts/RatesContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCcw,
  ShieldCheck,
  TrendingUp,
  History,
  Coins,
} from 'lucide-react';

export function Dashboard({ onNavigate }) {
  const { user } = useAuth();
  const { rates, getUsdValue, formatAmount, currencyMeta } = useRates();
  const [wallet, setWallet] = useState(null);
  const [recentTx, setRecentTx] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [walletResp, txResp] = await Promise.all([
        api.get('/wallet/me'),
        api.get('/wallet/history?pageSize=5'),
      ]);
      setWallet(walletResp.data.wallet);
      setRecentTx(txResp.data.rows || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const currencies = ['THB', 'USD', 'CNY', 'GBP', 'EUR', 'JPY', 'XAU', 'XAG', 'MBC'];

  // Calculate total portfolio net worth in USD
  const totalNetWorthUsd = wallet
    ? currencies.reduce((sum, cur) => {
        const balance = parseFloat(wallet.balances?.[cur.toLowerCase()] || 0);
        return sum + getUsdValue(cur, balance);
      }, 0)
    : 0;

  const totalNetWorthThb = totalNetWorthUsd * (rates.THB || 35.0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome & Net Worth Hero */}
      <div className="relative rounded-3xl overflow-hidden glass-panel-glow p-8 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-brand-950/40 border border-brand-500/20">
        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none text-9xl">💎</div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-brand-400">Total Net Worth</span>
              <Badge variant="primary">9 Currencies</Badge>
            </div>
            <div className="flex items-baseline gap-3">
              <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight font-mono">
                ${totalNetWorthUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              <span className="text-sm font-semibold text-slate-400 font-mono">
                ≈ ฿{totalNetWorthThb.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Welcome back, <span className="text-white font-semibold">{user?.display_name || user?.username}</span>! Your centralized vault is active.
            </p>
          </div>

          {/* Quick Shortcuts */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              icon={<ArrowUpRight className="w-4 h-4" />}
              onClick={() => onNavigate('transfers')}
            >
              Transfer
            </Button>
            <Button
              variant="secondary"
              icon={<RefreshCcw className="w-4 h-4" />}
              onClick={() => onNavigate('exchange')}
            >
              Exchange
            </Button>
            <Button
              variant="secondary"
              icon={<ShieldCheck className="w-4 h-4" />}
              onClick={() => onNavigate('escrow')}
            >
              Escrow
            </Button>
            <Button
              variant="secondary"
              icon={<Coins className="w-4 h-4" />}
              onClick={() => onNavigate('staking')}
            >
              Stake MBC
            </Button>
          </div>
        </div>
      </div>

      {/* Multi-Currency Balances Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Asset Balances</span>
            <span className="text-xs text-slate-400 font-normal">(Fiat, Precious Metals & Crypto)</span>
          </h3>
          <span className="text-xs text-slate-400">Real-time Valuation</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {currencies.map((cur) => {
            const meta = currencyMeta[cur] || { name: cur, emoji: '💰', decimals: 2 };
            const balance = parseFloat(wallet?.balances?.[cur.toLowerCase()] || 0);
            const usdVal = getUsdValue(cur, balance);

            const isGold = cur === 'XAU';
            const isSilver = cur === 'XAG';
            const isMbc = cur === 'MBC';

            let cardGlow = false;
            let tagBadge = null;

            if (isMbc) {
              cardGlow = true;
              tagBadge = <Badge variant="primary">Stakable</Badge>;
            } else if (isGold) {
              tagBadge = <Badge variant="warning">Troy Oz</Badge>;
            } else if (isSilver) {
              tagBadge = <Badge variant="default">Troy Oz</Badge>;
            }

            return (
              <Card key={cur} hover glow={cardGlow} className="relative overflow-hidden group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                      {meta.emoji}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white tracking-tight">{cur}</span>
                        {tagBadge}
                      </div>
                      <span className="text-xs text-slate-400">{meta.name}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-2xl font-bold font-mono text-white tracking-tight group-hover:text-brand-300 transition-colors">
                    {formatAmount(balance, cur)}
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-1">
                    ≈ ${usdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent Transactions Snippet */}
      <Card>
        <CardHeader
          title="Recent Ledger Activity"
          subtitle="Latest transactions processed through your wallet"
          action={
            <Button variant="ghost" size="sm" onClick={() => onNavigate('history')}>
              View All
            </Button>
          }
        />

        {recentTx.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">
            No recent transactions found. Start by depositing or receiving funds!
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {recentTx.map((tx) => {
              const isIncome = ['deposit', 'transfer_in', 'staking_reward', 'escrow_release', 'split_in', 'external_in'].includes(tx.type);
              const date = new Date(tx.created_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div key={tx.id} className="py-3.5 flex items-center justify-between hover:bg-slate-900/30 px-2 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm ${isIncome ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950/70 text-rose-400 border border-rose-800/40'}`}>
                      {isIncome ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white capitalize">{tx.type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-slate-400">
                        {date} {tx.note ? ` - ${tx.note}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`text-sm font-bold font-mono ${isIncome ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {isIncome ? '+' : '-'}{formatAmount(tx.amount, tx.currency)}
                    </p>
                    <p className="text-[10px] font-mono text-slate-500">{tx.txid ? `${tx.txid.slice(0, 10)}...` : ''}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
