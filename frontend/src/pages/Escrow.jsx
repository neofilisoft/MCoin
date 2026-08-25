import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input, Select } from '../components/common/Input';
import { Badge } from '../components/common/Badge';
import { useRates } from '../contexts/RatesContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { ShieldCheck, Check, X, Ban, Clock, Lock, AlertCircle } from 'lucide-react';

export function Escrow() {
  const { user } = useAuth();
  const { formatAmount, currencyMeta } = useRates();
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create Escrow form state
  const [recipient, setRecipient] = useState('');
  const [currency, setCurrency] = useState('MBC');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('5');
  const [formLoading, setFormLoading] = useState(false);
  const [formMessage, setFormMessage] = useState(null);

  const fetchEscrows = async () => {
    try {
      const resp = await api.get('/escrows');
      setEscrows(resp.data.escrows || []);
    } catch (err) {
      console.error('Escrows fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEscrows();
    const interval = setInterval(fetchEscrows, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormMessage(null);

    try {
      const durationMs = parseInt(durationMinutes, 10) * 60 * 1000;
      await api.post('/escrows', {
        recipient,
        currency,
        amount: parseFloat(amount),
        note,
        durationMs,
      });

      setFormMessage({ type: 'success', text: 'Escrow created! Funds have been securely locked.' });
      setRecipient('');
      setAmount('');
      setNote('');
      fetchEscrows();
    } catch (err) {
      setFormMessage({ type: 'error', text: err.response?.data?.error || err.message });
    } finally {
      setFormLoading(false);
    }
  };

  const handleAccept = async (id) => {
    try {
      await api.post(`/escrows/${id}/accept`);
      fetchEscrows();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/escrows/${id}/reject`);
      fetchEscrows();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleCancel = async (id) => {
    try {
      await api.post(`/escrows/${id}/cancel`);
      fetchEscrows();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const currencies = ['THB', 'USD', 'CNY', 'GBP', 'EUR', 'JPY', 'XAU', 'XAG', 'MBC'];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Escrow List (2 Cols) */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader
              title="Escrow Contracts"
              subtitle="Secure smart contracts with automated timeout refunds"
            />

            {escrows.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No active or historical escrow contracts found.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {escrows.map((escrow) => {
                  const isPending = escrow.status === 'pending';
                  const isReceiver =
                    escrow.receiver_user_id === user?.id || escrow.receiver_id === user?.discord_id;
                  const isSender =
                    escrow.sender_user_id === user?.id || escrow.sender_id === user?.discord_id;

                  const expiresDate = new Date(escrow.expires_at);
                  const isExpired = new Date() > expiresDate;

                  return (
                    <div key={escrow.id} className="py-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-brand-950/70 border border-brand-800/50 flex items-center justify-center text-brand-400">
                            <Lock className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-base font-mono">
                                {formatAmount(escrow.amount, escrow.currency)}
                              </span>
                              <Badge
                                variant={
                                  escrow.status === 'completed'
                                    ? 'success'
                                    : escrow.status === 'cancelled'
                                    ? 'danger'
                                    : escrow.status === 'timeout'
                                    ? 'default'
                                    : 'warning'
                                }
                              >
                                {escrow.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {isSender ? (
                                <>To: <span className="text-white font-semibold">@{escrow.receiver_username || escrow.receiver_id}</span></>
                              ) : (
                                <>From: <span className="text-white font-semibold">@{escrow.sender_username || escrow.sender_id}</span></>
                              )}
                              {escrow.note ? ` - ${escrow.note}` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                          {isPending && isReceiver && !isExpired && (
                            <>
                              <Button
                                size="sm"
                                variant="success"
                                icon={<Check className="w-3.5 h-3.5" />}
                                onClick={() => handleAccept(escrow.id)}
                              >
                                Accept & Receive
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                icon={<X className="w-3.5 h-3.5" />}
                                onClick={() => handleReject(escrow.id)}
                              >
                                Reject
                              </Button>
                            </>
                          )}

                          {isPending && isSender && !isExpired && (
                            <Button
                              size="sm"
                              variant="outline"
                              icon={<Ban className="w-3.5 h-3.5" />}
                              onClick={() => handleCancel(escrow.id)}
                            >
                              Cancel & Refund
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Expiry timer info */}
                      {isPending && (
                        <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>Auto-refunds if unaccepted by: {expiresDate.toLocaleTimeString()}</span>
                          </span>
                          <span className="font-mono text-slate-300">Contract #{escrow.id}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Create Escrow Form (1 Col) */}
        <div>
          <Card glow>
            <CardHeader
              title="Lock New Escrow"
              subtitle="Hold funds safely in escrow until the other party accepts"
            />

            {formMessage && (
              <div
                className={`p-3 rounded-xl mb-4 text-xs ${
                  formMessage.type === 'success'
                    ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/80 border border-rose-800 text-rose-300'
                }`}
              >
                {formMessage.text}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <Input
                label="Receiver"
                placeholder="@username, email, or mc... address"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {currencies.map((c) => (
                    <option key={c} value={c} className="bg-slate-900 text-white">
                      {currencyMeta[c]?.emoji} {c}
                    </option>
                  ))}
                </Select>

                <Input
                  label="Amount"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <Select
                label="Expiration Timeout"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              >
                <option value="5" className="bg-slate-900 text-white">5 Minutes</option>
                <option value="15" className="bg-slate-900 text-white">15 Minutes</option>
                <option value="60" className="bg-slate-900 text-white">1 Hour</option>
                <option value="1440" className="bg-slate-900 text-white">24 Hours</option>
              </Select>

              <Input
                label="Note / Terms"
                placeholder="e.g. Graphic design delivery"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full mt-2"
                loading={formLoading}
                icon={<ShieldCheck className="w-4 h-4" />}
              >
                Lock Escrow
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
