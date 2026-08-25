import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input, Select } from '../components/common/Input';
import { Badge } from '../components/common/Badge';
import { useRates } from '../contexts/RatesContext';
import api from '../services/api';
import { ArrowUpRight, ArrowDownLeft, Send, Check, X, Ban, Clock, AlertCircle } from 'lucide-react';

export function Transfers() {
  const { rates, formatAmount, currencyMeta } = useRates();
  const [wallet, setWallet] = useState(null);
  const [activeTab, setActiveTab] = useState('transfer'); // 'transfer', 'requests'

  // Transfer form state
  const [recipient, setRecipient] = useState('');
  const [currency, setCurrency] = useState('MBC');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferMessage, setTransferMessage] = useState(null);

  // Request form state
  const [requestTarget, setRequestTarget] = useState('');
  const [requestCurrency, setRequestCurrency] = useState('MBC');
  const [requestAmount, setRequestAmount] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestMessage, setRequestMessage] = useState(null);

  // User search suggestions
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Requests list
  const [requests, setRequests] = useState([]);
  const [requestFilter, setRequestFilter] = useState('incoming'); // 'incoming', 'outgoing'

  const fetchWallet = async () => {
    try {
      const resp = await api.get('/wallet/me');
      setWallet(resp.data.wallet);
    } catch (err) {
      console.error('Wallet error:', err);
    }
  };

  const fetchRequests = async () => {
    try {
      const resp = await api.get(`/requests?filter=${requestFilter}`);
      setRequests(resp.data.requests || []);
    } catch (err) {
      console.error('Requests error:', err);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  useEffect(() => {
    if (activeTab === 'requests') {
      fetchRequests();
    }
  }, [activeTab, requestFilter]);

  const handleSearchRecipient = async (query) => {
    setRecipient(query);
    if (query.trim().length >= 2) {
      setIsSearching(true);
      try {
        const resp = await api.get(`/wallet/users/search?q=${encodeURIComponent(query.trim())}`);
        setUserSuggestions(resp.data.users || []);
      } catch (err) {
        setUserSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    } else {
      setUserSuggestions([]);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setTransferLoading(true);
    setTransferMessage(null);

    try {
      const resp = await api.post('/wallet/transfer', {
        recipient,
        currency,
        amount: parseFloat(amount),
        note,
      });

      setTransferMessage({ type: 'success', text: `Successfully transferred ${amount} ${currency}!` });
      setAmount('');
      setRecipient('');
      setNote('');
      fetchWallet();
    } catch (err) {
      setTransferMessage({ type: 'error', text: err.response?.data?.error || err.message });
    } finally {
      setTransferLoading(false);
    }
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    setRequestLoading(true);
    setRequestMessage(null);

    try {
      await api.post('/requests', {
        target: requestTarget,
        currency: requestCurrency,
        amount: parseFloat(requestAmount),
        note: requestNote,
      });

      setRequestMessage({ type: 'success', text: `Payment request sent to ${requestTarget}!` });
      setRequestTarget('');
      setRequestAmount('');
      setRequestNote('');
      fetchRequests();
    } catch (err) {
      setRequestMessage({ type: 'error', text: err.response?.data?.error || err.message });
    } finally {
      setRequestLoading(false);
    }
  };

  const handlePayRequest = async (id) => {
    try {
      await api.post(`/requests/${id}/pay`);
      fetchRequests();
      fetchWallet();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleDeclineRequest = async (id) => {
    try {
      await api.post(`/requests/${id}/decline`);
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleCancelRequest = async (id) => {
    try {
      await api.post(`/requests/${id}/cancel`);
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const currencies = ['THB', 'USD', 'CNY', 'GBP', 'EUR', 'JPY', 'XAU', 'XAG', 'MBC'];
  const availableBal = wallet?.balances?.[currency.toLowerCase()] || 0;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Navigation Pill Tabs */}
      <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-fit">
        <button
          onClick={() => setActiveTab('transfer')}
          className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'transfer'
              ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Send P2P Transfer
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'requests'
              ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Payment Requests
        </button>
      </div>

      {activeTab === 'transfer' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Transfer Form */}
          <div className="md:col-span-2">
            <Card glow>
              <CardHeader
                title="Send Payment"
                subtitle="Instantly transfer any fiat, gold, or crypto to another user"
              />

              {transferMessage && (
                <div
                  className={`p-4 rounded-xl mb-6 text-sm flex items-center gap-2.5 ${
                    transferMessage.type === 'success'
                      ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/80 border border-rose-800 text-rose-300'
                  }`}
                >
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{transferMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleTransfer} className="space-y-5">
                <div className="relative">
                  <Input
                    label="Recipient"
                    placeholder="Username, Email, Wallet Address (mc...), or Discord ID"
                    value={recipient}
                    onChange={(e) => handleSearchRecipient(e.target.value)}
                    required
                  />

                  {/* Auto-suggest dropdown */}
                  {userSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-20 overflow-hidden divide-y divide-slate-800">
                      {userSuggestions.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => {
                            setRecipient(u.username);
                            setUserSuggestions([]);
                          }}
                          className="p-3 hover:bg-slate-800/80 cursor-pointer flex items-center justify-between"
                        >
                          <div>
                            <p className="text-sm font-semibold text-white">@{u.username}</p>
                            <p className="text-xs text-slate-400">{u.display_name}</p>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">{u.wallet_address ? `${u.wallet_address.slice(0, 10)}...` : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {currencies.map((cur) => (
                      <option key={cur} value={cur} className="bg-slate-900 text-white">
                        {currencyMeta[cur]?.emoji} {cur} - {currencyMeta[cur]?.name}
                      </option>
                    ))}
                  </Select>

                  <div>
                    <Input
                      label="Amount"
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      rightElement={
                        <button
                          type="button"
                          onClick={() => setAmount(availableBal.toString())}
                          className="text-[10px] font-bold uppercase bg-brand-950 border border-brand-800 text-brand-300 px-2 py-1 rounded hover:bg-brand-900 transition-colors"
                        >
                          Max
                        </button>
                      }
                    />
                    <div className="flex items-center justify-between mt-1 px-1">
                      <span className="text-[11px] text-slate-400">Available:</span>
                      <span className="text-[11px] font-mono font-semibold text-brand-300">
                        {formatAmount(availableBal, currency)}
                      </span>
                    </div>
                  </div>
                </div>

                <Input
                  label="Note / Memo (Optional)"
                  placeholder="e.g. Dinner share, Freelance invoice"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full mt-4"
                  loading={transferLoading}
                  icon={<Send className="w-4 h-4" />}
                >
                  Send Transfer Now
                </Button>
              </form>
            </Card>
          </div>

          {/* Quick Info Column */}
          <div className="space-y-6">
            <Card>
              <h4 className="text-sm font-bold text-white mb-3">Instant Settlement</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Transfers inside MCoin Central Bank are instantaneous and zero-fee. Funds are credited to the recipient immediately with dual audit trail logging.
              </p>
            </Card>

            <Card>
              <h4 className="text-sm font-bold text-white mb-3">Multi-Identifier Support</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                You can send to anyone using their:
              </p>
              <ul className="text-xs text-slate-300 mt-2 space-y-1 list-disc list-inside font-mono">
                <li>@username</li>
                <li>Email address</li>
                <li>mc... Wallet Address</li>
                <li>Discord User ID</li>
              </ul>
            </Card>
          </div>
        </div>
      ) : (
        /* Payment Requests View */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Requests List */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRequestFilter('incoming')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    requestFilter === 'incoming'
                      ? 'bg-slate-800 text-white border border-slate-700'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Incoming Invoices
                </button>
                <button
                  onClick={() => setRequestFilter('outgoing')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    requestFilter === 'outgoing'
                      ? 'bg-slate-800 text-white border border-slate-700'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Outgoing Requests
                </button>
              </div>
            </div>

            <Card>
              {requests.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  No {requestFilter} payment requests found.
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {requests.map((r) => {
                    const isPending = r.status === 'pending';
                    const isIncoming = requestFilter === 'incoming';

                    return (
                      <div key={r.id} className="py-4 flex items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white font-mono">
                              {formatAmount(r.amount, r.currency)}
                            </span>
                            <Badge
                              variant={
                                r.status === 'paid'
                                  ? 'success'
                                  : r.status === 'declined'
                                  ? 'danger'
                                  : r.status === 'cancelled'
                                  ? 'default'
                                  : 'warning'
                              }
                            >
                              {r.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            {isIncoming ? (
                              <>From: <span className="text-white">@{r.requester_username}</span></>
                            ) : (
                              <>To: <span className="text-white">@{r.target_username}</span></>
                            )}
                            {r.note ? ` - ${r.note}` : ''}
                          </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          {isPending && isIncoming && (
                            <>
                              <Button
                                size="sm"
                                variant="success"
                                icon={<Check className="w-3.5 h-3.5" />}
                                onClick={() => handlePayRequest(r.id)}
                              >
                                Pay
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                icon={<X className="w-3.5 h-3.5" />}
                                onClick={() => handleDeclineRequest(r.id)}
                              >
                                Decline
                              </Button>
                            </>
                          )}

                          {isPending && !isIncoming && (
                            <Button
                              size="sm"
                              variant="outline"
                              icon={<Ban className="w-3.5 h-3.5" />}
                              onClick={() => handleCancelRequest(r.id)}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Create Request Sidebar Form */}
          <div>
            <Card>
              <CardHeader
                title="Create Request"
                subtitle="Request funds from another user"
              />

              {requestMessage && (
                <div
                  className={`p-3 rounded-xl mb-4 text-xs ${
                    requestMessage.type === 'success'
                      ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/80 border border-rose-800 text-rose-300'
                  }`}
                >
                  {requestMessage.text}
                </div>
              )}

              <form onSubmit={handleCreateRequest} className="space-y-4">
                <Input
                  label="From User"
                  placeholder="@username or email"
                  value={requestTarget}
                  onChange={(e) => setRequestTarget(e.target.value)}
                  required
                />

                <Select
                  label="Currency"
                  value={requestCurrency}
                  onChange={(e) => setRequestCurrency(e.target.value)}
                >
                  {currencies.map((cur) => (
                    <option key={cur} value={cur} className="bg-slate-900 text-white">
                      {currencyMeta[cur]?.emoji} {cur}
                    </option>
                  ))}
                </Select>

                <Input
                  label="Amount"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value)}
                  required
                />

                <Input
                  label="Note"
                  placeholder="What is this request for?"
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full"
                  loading={requestLoading}
                >
                  Send Request
                </Button>
              </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
