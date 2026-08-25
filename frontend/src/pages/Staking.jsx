import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Badge } from '../components/common/Badge';
import { useRates } from '../contexts/RatesContext';
import api from '../services/api';
import { Coins, Flame, TrendingUp, Sparkles, AlertCircle, CheckCircle2, Unlock } from 'lucide-react';

export function Staking() {
  const { formatAmount } = useRates();
  const [stakingData, setStakingData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [stakeAmount, setStakeAmount] = useState('');
  const [stakeLoading, setStakeLoading] = useState(false);
  const [unstakeLoading, setUnstakeLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchStaking = async () => {
    try {
      const resp = await api.get('/staking/info');
      setStakingData(resp.data);
    } catch (err) {
      console.error('Staking fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaking();
    const interval = setInterval(fetchStaking, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleStake = async (e) => {
    e.preventDefault();
    setStakeLoading(true);
    setMessage(null);

    try {
      await api.post('/staking/stake', { amount: parseFloat(stakeAmount) });
      setMessage({ type: 'success', text: `Successfully staked ${stakeAmount} MBC!` });
      setStakeAmount('');
      fetchStaking();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || err.message });
    } finally {
      setStakeLoading(false);
    }
  };

  const handleUnstake = async () => {
    if (!confirm('Are you sure you want to unstake? Your staked MBC and all accrued rewards will be returned to your wallet.')) {
      return;
    }

    setUnstakeLoading(true);
    setMessage(null);

    try {
      const resp = await api.post('/staking/unstake');
      setMessage({
        type: 'success',
        text: `Unstaked! Returned ${resp.data.returnedAmount} MBC + ${resp.data.rewardAmount.toFixed(4)} MBC rewards!`,
      });
      fetchStaking();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || err.message });
    } finally {
      setUnstakeLoading(false);
    }
  };

  const apr = stakingData?.apr || 0.12;
  const position = stakingData?.position;
  const availableMbc = stakingData?.availableMbc || 0;

  // Real-time calculation helpers
  const inputStakeNum = parseFloat(stakeAmount || 0);
  const calcDailyReward = ((inputStakeNum * apr) / 365).toFixed(4);
  const calcMonthlyReward = ((inputStakeNum * apr) / 12).toFixed(4);
  const calcYearlyReward = (inputStakeNum * apr).toFixed(4);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Staking Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden glass-panel-glow p-8 bg-gradient-to-br from-brand-950/60 via-slate-900/80 to-slate-950 border border-brand-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="primary">MBC Vault Protocol</Badge>
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" /> High Yield
              </span>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight">Miyabi Coin (MBC) Staking</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Lock your MBC in the decentralized reserve vault and earn high-yield staking rewards paid daily at 00:00 UTC.
            </p>
          </div>

          <div className="text-right bg-slate-900/80 border border-brand-500/30 px-6 py-4 rounded-2xl shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Current APR</span>
            <div className="text-3xl md:text-4xl font-extrabold text-brand-300 font-mono">
              {(apr * 100).toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center gap-2.5 ${
            message.type === 'success'
              ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
              : 'bg-rose-950/80 border border-rose-800 text-rose-300'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Active Staking Position Card */}
        <div className="md:col-span-2 space-y-6">
          <Card glow={!!position}>
            <CardHeader
              title="Your Staking Position"
              subtitle={position ? 'Active staking vault contract' : 'No active staking position'}
            />

            {position ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[11px] uppercase font-bold text-slate-400">Locked Principal</span>
                    <div className="text-xl font-bold font-mono text-white mt-1">
                      {formatAmount(position.amount, 'MBC')}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[11px] uppercase font-bold text-slate-400">Locked APR</span>
                    <div className="text-xl font-bold font-mono text-brand-300 mt-1">
                      {(parseFloat(position.apr) * 100).toFixed(2)}%
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[11px] uppercase font-bold text-slate-400">Est. Daily Payout</span>
                    <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                      {((parseFloat(position.amount) * parseFloat(position.apr)) / 365).toFixed(4)} MBC
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-brand-950/40 border border-brand-800/40 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400">Accrued Unpaid Reward (estimated):</span>
                    <p className="text-lg font-bold font-mono text-brand-300">
                      {parseFloat(stakingData?.pendingReward || 0).toFixed(6)} MBC
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="md"
                    loading={unstakeLoading}
                    onClick={handleUnstake}
                    icon={<Unlock className="w-4 h-4" />}
                  >
                    Unstake & Collect All
                  </Button>
                </div>
              </div>
            ) : (
              /* Stake Input Form when no active position */
              <form onSubmit={handleStake} className="space-y-4">
                <div>
                  <Input
                    label="Amount to Stake"
                    type="number"
                    step="any"
                    min="0.0001"
                    placeholder="0.00"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    required
                    rightElement={
                      <button
                        type="button"
                        onClick={() => setStakeAmount(availableMbc.toString())}
                        className="text-[10px] font-bold uppercase bg-brand-950 border border-brand-800 text-brand-300 px-2 py-1 rounded hover:bg-brand-900 transition-colors"
                      >
                        Max
                      </button>
                    }
                  />
                  <div className="flex items-center justify-between mt-1 px-1">
                    <span className="text-xs text-slate-400">Available Balance:</span>
                    <span className="text-xs font-mono font-semibold text-brand-300">
                      {formatAmount(availableMbc, 'MBC')}
                    </span>
                  </div>
                </div>

                {/* Yield Estimates */}
                {inputStakeNum > 0 && (
                  <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs">
                    <span className="text-[11px] font-bold uppercase text-slate-400">Estimated Yield Preview:</span>
                    <div className="flex justify-between text-slate-300 font-mono">
                      <span>Daily Reward:</span>
                      <span className="font-bold text-emerald-400">+{calcDailyReward} MBC</span>
                    </div>
                    <div className="flex justify-between text-slate-300 font-mono">
                      <span>Monthly Reward:</span>
                      <span className="font-bold text-emerald-400">+{calcMonthlyReward} MBC</span>
                    </div>
                    <div className="flex justify-between text-slate-300 font-mono">
                      <span>Yearly Reward:</span>
                      <span className="font-bold text-emerald-400">+{calcYearlyReward} MBC</span>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full mt-2"
                  loading={stakeLoading}
                  icon={<Coins className="w-4 h-4" />}
                >
                  Start Staking MBC
                </Button>
              </form>
            )}
          </Card>
        </div>

        {/* Info Column */}
        <div className="space-y-6">
          <Card>
            <h4 className="text-sm font-bold text-white mb-3">How MBC Staking Works</h4>
            <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
              <li>Lock MBC to earn guaranteed staking yield backed by central reserve.</li>
              <li>Daily automated payout at 00:00 UTC.</li>
              <li>Unstake anytime with zero penalty fee.</li>
              <li>APR is locked at the moment of staking.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
