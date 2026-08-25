import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input, Select } from '../components/common/Input';
import { Badge } from '../components/common/Badge';
import { useRates } from '../contexts/RatesContext';
import api from '../services/api';
import { Users, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

export function SplitBills() {
  const { formatAmount, currencyMeta } = useRates();
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Split bill form
  const [members, setMembers] = useState(['', '']);
  const [currency, setCurrency] = useState('THB');
  const [totalAmount, setTotalAmount] = useState('');
  const [description, setDescription] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formMessage, setFormMessage] = useState(null);

  const fetchSplits = async () => {
    try {
      const resp = await api.get('/splits');
      setSplits(resp.data.splits || []);
    } catch (err) {
      console.error('Splits error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSplits();
  }, []);

  const handleAddMember = () => {
    if (members.length < 10) {
      setMembers([...members, '']);
    }
  };

  const handleRemoveMember = (idx) => {
    if (members.length > 1) {
      setMembers(members.filter((_, i) => i !== idx));
    }
  };

  const handleMemberChange = (idx, val) => {
    const next = [...members];
    next[idx] = val;
    setMembers(next);
  };

  const handleCreateSplit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormMessage(null);

    const validMembers = members.map((m) => m.trim()).filter((m) => m.length > 0);

    try {
      await api.post('/splits', {
        members: validMembers,
        currency,
        totalAmount: parseFloat(totalAmount),
        description,
      });

      setFormMessage({ type: 'success', text: 'Split bill processed and settled successfully!' });
      setTotalAmount('');
      setDescription('');
      setMembers(['', '']);
      fetchSplits();
    } catch (err) {
      setFormMessage({ type: 'error', text: err.response?.data?.error || err.message });
    } finally {
      setFormLoading(false);
    }
  };

  const currencies = ['THB', 'USD', 'CNY', 'GBP', 'EUR', 'JPY', 'XAU', 'XAG', 'MBC'];
  const validMemberCount = members.filter((m) => m.trim().length > 0).length + 1; // +1 for current user
  const perPersonShare = totalAmount && parseFloat(totalAmount) > 0
    ? (parseFloat(totalAmount) / validMemberCount).toFixed(2)
    : '0.00';

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Split Bills List (2 Cols) */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader
              title="Split Bills Ledger"
              subtitle="Group expenses settled automatically between member wallets"
            />

            {splits.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No split bills found. Create your first group split!
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {splits.map((s) => (
                  <div key={s.id} className="py-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-950/70 border border-indigo-800/50 flex items-center justify-center text-indigo-400">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white font-mono text-base">
                              {formatAmount(s.total_amount, s.currency)}
                            </span>
                            <Badge variant="success">{s.status}</Badge>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Created by: <span className="text-white">@{s.initiator_username || s.initiator_id}</span>
                            {s.description ? ` - ${s.description}` : ''}
                          </p>
                        </div>
                      </div>

                      <span className="text-xs font-mono text-slate-500">
                        {new Date(s.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Create Split Form (1 Col) */}
        <div>
          <Card glow>
            <CardHeader
              title="Create Split Bill"
              subtitle="Split a cost evenly among your friends"
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

            <form onSubmit={handleCreateSplit} className="space-y-4">
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
                  label="Total Amount"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  required
                />
              </div>

              <Input
                label="Description"
                placeholder="e.g. Japanese dinner, AWS bill"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              {/* Members Inputs */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-400">
                  <span>Other Members (You included automatically)</span>
                  <button
                    type="button"
                    onClick={handleAddMember}
                    className="text-brand-400 hover:text-brand-300 flex items-center gap-1 text-[11px]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>

                {members.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder={`@username, email, or address`}
                      value={m}
                      onChange={(e) => handleMemberChange(idx, e.target.value)}
                      required={idx === 0}
                    />
                    {members.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(idx)}
                        className="p-2.5 text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Share Preview Chip */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs flex justify-between items-center font-mono">
                <span className="text-slate-400">Estimated Share (each):</span>
                <span className="font-bold text-brand-300">
                  {perPersonShare} {currency}
                </span>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full"
                loading={formLoading}
                icon={<Users className="w-4 h-4" />}
              >
                Split & Settle
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
