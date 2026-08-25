import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Select } from '../components/common/Input';
import { useRates } from '../contexts/RatesContext';
import api from '../services/api';
import { ArrowDownUp, RefreshCcw, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

export function Exchange() {
  const { rates, convertCurrency, formatAmount, currencyMeta } = useRates();
  const [wallet, setWallet] = useState(null);

  const [fromCurrency, setFromCurrency] = useState('THB');
  const [toCurrency, setToCurrency] = useState('MBC');
  const [amount, setAmount] = useState('100');
  const [loading, setLoading] = useState(false);
  const [swapResult, setSwapResult] = useState(null);
  const [error, setError] = useState(null);

  const fetchWallet = async () => {
    try {
      const resp = await api.get('/wallet/me');
      setWallet(resp.data.wallet);
    } catch (err) {
      console.error('Wallet fetch error:', err);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const currencies = ['THB', 'USD', 'CNY', 'GBP', 'EUR', 'JPY', 'XAU', 'XAG', 'MBC'];

  const handleFlip = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
    setSwapResult(null);
    setError(null);
  };

  const { toAmount: estimatedToAmount, rate: conversionRate } = convertCurrency(
    amount || 0,
    fromCurrency,
    toCurrency
  );

  const availableBalance = wallet?.balances?.[fromCurrency.toLowerCase()] || 0;

  const handleSwap = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSwapResult(null);

    try {
      const resp = await api.post('/wallet/exchange', {
        fromCurrency,
        toCurrency,
        amount: parseFloat(amount),
      });

      setSwapResult(resp.data);
      fetchWallet();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Card glow className="relative">
        <CardHeader
          title="Instant Currency Swap"
          subtitle="Zero-slippage real-time exchange powered by central reserve"
        />

        {error && (
          <div className="p-4 rounded-xl mb-6 text-sm bg-rose-950/80 border border-rose-800 text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {swapResult && (
          <div className="p-4 rounded-xl mb-6 text-sm bg-emerald-950/80 border border-emerald-800 text-emerald-300 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Swap Successful!</p>
              <p className="text-xs text-emerald-400 mt-0.5">
                Swapped {formatAmount(swapResult.fromAmount, swapResult.fromCurrency)} for{' '}
                <span className="font-bold text-white">{formatAmount(swapResult.toAmount, swapResult.toCurrency)}</span>
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSwap} className="space-y-4">
          {/* FROM BOX */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
              <span>You Sell (From)</span>
              <span>Available: {formatAmount(availableBalance, fromCurrency)}</span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="number"
                step="any"
                min="0.00000001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full bg-transparent font-mono text-2xl md:text-3xl font-bold text-white placeholder-slate-600 focus:outline-none"
              />

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setAmount(availableBalance.toString())}
                  className="text-[10px] font-bold uppercase bg-brand-950 border border-brand-800 text-brand-300 px-2.5 py-1.5 rounded-lg hover:bg-brand-900 transition-colors"
                >
                  Max
                </button>

                <select
                  value={fromCurrency}
                  onChange={(e) => setFromCurrency(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white text-sm font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500"
                >
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {currencyMeta[c]?.emoji} {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* FLIP BUTTON */}
          <div className="flex justify-center -my-2 relative z-10">
            <button
              type="button"
              onClick={handleFlip}
              className="p-3 rounded-full bg-slate-900 border border-slate-700 text-brand-400 hover:text-white hover:bg-brand-600 hover:border-brand-500 shadow-xl transition-all duration-200"
            >
              <ArrowDownUp className="w-4 h-4" />
            </button>
          </div>

          {/* TO BOX */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
              <span>You Receive (Estimated)</span>
              <span>Rate: 1 {fromCurrency} ≈ {conversionRate.toFixed(6)} {toCurrency}</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-full font-mono text-2xl md:text-3xl font-bold text-brand-300 truncate">
                {estimatedToAmount.toFixed(currencyMeta[toCurrency]?.decimals || 4)}
              </div>

              <select
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white text-sm font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500 shrink-0"
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {currencyMeta[c]?.emoji} {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* RATE SUMMARY BOX */}
          <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 text-xs space-y-1.5">
            <div className="flex justify-between text-slate-400">
              <span>Exchange Rate</span>
              <span className="text-slate-200 font-mono">1 {fromCurrency} = {conversionRate.toFixed(8)} {toCurrency}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Fee</span>
              <span className="text-emerald-400 font-semibold">0.00% (Zero Fee)</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Route</span>
              <span className="text-slate-300 font-mono">{fromCurrency} → USD → {toCurrency}</span>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-4"
            loading={loading}
            icon={<Sparkles className="w-4 h-4" />}
          >
            Execute Swap
          </Button>
        </form>
      </Card>
    </div>
  );
}
