import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const RatesContext = createContext(null);

const DEFAULT_METAS = {
  THB: { symbol: '฿', name: 'Thai Baht', emoji: '🇹🇭', decimals: 2 },
  USD: { symbol: '$', name: 'US Dollar', emoji: '🇺🇸', decimals: 2 },
  CNY: { symbol: '¥', name: 'Chinese Yuan', emoji: '🇨🇳', decimals: 2 },
  GBP: { symbol: '£', name: 'British Pound', emoji: '🇬🇧', decimals: 2 },
  EUR: { symbol: '€', name: 'Euro', emoji: '🇪🇺', decimals: 2 },
  JPY: { symbol: '¥', name: 'Japanese Yen', emoji: '🇯🇵', decimals: 0 },
  XAU: { symbol: 'XAU', name: 'Gold (Troy Oz)', emoji: '🥇', decimals: 6 },
  XAG: { symbol: 'XAG', name: 'Silver (Troy Oz)', emoji: '🥈', decimals: 4 },
  MBC: { symbol: 'MBC', name: 'Miyabi Coin', emoji: '💎', decimals: 4 },
};

export function RatesProvider({ children }) {
  const [ratesData, setRatesData] = useState({
    rates: { THB: 35.0, USD: 1.0, CNY: 7.3, GBP: 0.79, EUR: 0.92, JPY: 149.0, XAU: 1 / 3300, XAG: 1 / 33, MBC: 1.0 },
    currencies: [],
    loading: true,
  });

  const fetchRates = useCallback(async () => {
    try {
      const resp = await api.get('/rates');
      setRatesData({
        rates: resp.data.rates,
        currencies: resp.data.currencies || [],
        loading: false,
      });
    } catch (err) {
      console.warn('Failed to fetch live rates, using fallback:', err.message);
      setRatesData((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchRates();
    const interval = setInterval(fetchRates, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, [fetchRates]);

  const convertCurrency = useCallback(
    (amount, from, to) => {
      const amt = parseFloat(amount);
      if (isNaN(amt) || amt <= 0) return { toAmount: 0, rate: 0 };

      const fromUpper = (from || 'USD').toUpperCase();
      const toUpper = (to || 'USD').toUpperCase();
      const rates = ratesData.rates;

      if (fromUpper === toUpper) return { toAmount: amt, rate: 1 };

      const apiFetched = ['THB', 'USD', 'CNY', 'GBP', 'EUR', 'JPY', 'XAU', 'XAG'];

      // Step 1: from -> USD
      let inUsd = 0;
      if (fromUpper === 'USD') {
        inUsd = amt;
      } else if (apiFetched.includes(fromUpper)) {
        inUsd = amt / (rates[fromUpper] || 1);
      } else {
        inUsd = amt * (rates[fromUpper] || 1);
      }

      // Step 2: USD -> to
      let toAmount = 0;
      if (toUpper === 'USD') {
        toAmount = inUsd;
      } else if (apiFetched.includes(toUpper)) {
        toAmount = inUsd * (rates[toUpper] || 1);
      } else {
        toAmount = inUsd / (rates[toUpper] || 1);
      }

      const rate = toAmount / amt;
      return { toAmount, rate };
    },
    [ratesData.rates]
  );

  const getUsdValue = useCallback(
    (currency, amount) => {
      const cur = (currency || 'USD').toUpperCase();
      const amt = parseFloat(amount || 0);
      if (isNaN(amt) || amt === 0) return 0;
      if (cur === 'USD') return amt;

      const rates = ratesData.rates;
      const apiFetched = ['THB', 'USD', 'CNY', 'GBP', 'EUR', 'JPY', 'XAU', 'XAG'];

      if (apiFetched.includes(cur)) {
        return amt / (rates[cur] || 1);
      }
      return amt * (rates[cur] || 1);
    },
    [ratesData.rates]
  );

  const formatAmount = useCallback((amount, currency) => {
    const cur = (currency || 'USD').toUpperCase();
    const meta = DEFAULT_METAS[cur] || { decimals: 2, symbol: cur };
    const num = parseFloat(amount || 0);

    return `${num.toLocaleString('en-US', {
      minimumFractionDigits: meta.decimals,
      maximumFractionDigits: meta.decimals,
    })} ${cur}`;
  }, []);

  return (
    <RatesContext.Provider
      value={{
        rates: ratesData.rates,
        currencies: ratesData.currencies,
        loading: ratesData.loading,
        refreshRates: fetchRates,
        convertCurrency,
        getUsdValue,
        formatAmount,
        currencyMeta: DEFAULT_METAS,
      }}
    >
      {children}
    </RatesContext.Provider>
  );
}

export function useRates() {
  const context = useContext(RatesContext);
  if (!context) {
    throw new Error('useRates must be used within a RatesProvider');
  }
  return context;
}
