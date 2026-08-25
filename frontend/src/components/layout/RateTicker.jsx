import React from 'react';
import { useRates } from '../../contexts/RatesContext';
import { TrendingUp, RefreshCw } from 'lucide-react';

export function RateTicker() {
  const { rates, currencyMeta, loading, refreshRates } = useRates();

  const tickerItems = [
    { code: 'THB', display: `1 USD = ${(rates.THB || 35.0).toFixed(2)} THB` },
    { code: 'JPY', display: `1 USD = ${(rates.JPY || 150.0).toFixed(2)} JPY` },
    { code: 'EUR', display: `1 EUR = ${(1 / (rates.EUR || 0.92)).toFixed(4)} USD` },
    { code: 'GBP', display: `1 GBP = ${(1 / (rates.GBP || 0.79)).toFixed(4)} USD` },
    { code: 'CNY', display: `1 USD = ${(rates.CNY || 7.25).toFixed(2)} CNY` },
    { code: 'XAU', display: `1 XAU (Gold) = $${(rates.XAU ? 1 / rates.XAU : 3300).toFixed(2)}/oz` },
    { code: 'XAG', display: `1 XAG (Silver) = $${(rates.XAG ? 1 / rates.XAG : 33).toFixed(2)}/oz` },
    { code: 'MBC', display: `1 MBC = $${(rates.MBC || 1.0).toFixed(4)} USD` },
  ];

  return (
    <div className="bg-slate-950/80 border-b border-slate-800/80 text-xs py-2 px-4 flex items-center justify-between overflow-hidden">
      <div className="flex items-center gap-2 pr-4 border-r border-slate-800 shrink-0">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">Live Spot</span>
      </div>

      <div className="ticker-wrap flex-1 mx-4">
        <div className="ticker-move space-x-8 text-slate-300">
          {[...tickerItems, ...tickerItems].map((item, idx) => {
            const meta = currencyMeta[item.code] || {};
            return (
              <span key={idx} className="inline-flex items-center gap-1.5 font-mono">
                <span>{meta.emoji}</span>
                <span className="font-semibold text-white">{item.code}</span>
                <span className="text-slate-400">{item.display}</span>
              </span>
            );
          })}
        </div>
      </div>

      <button
        onClick={refreshRates}
        title="Refresh rates"
        className="text-slate-500 hover:text-slate-300 transition-colors shrink-0 p-1 rounded"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}
