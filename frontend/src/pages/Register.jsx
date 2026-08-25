import React, { useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { UserPlus, AlertCircle } from 'lucide-react';

export function Register({ onSwitchToLogin }) {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await register({
        username,
        email: email || undefined,
        password,
        displayName: displayName || undefined,
      });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscordLogin = async () => {
    try {
      const resp = await api.get('/auth/discord/url');
      window.location.href = resp.data.url;
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#090d16] relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 mx-auto flex items-center justify-center shadow-xl shadow-brand-900/50 text-3xl">
            💎
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Create MCoin Vault
          </h1>
          <p className="text-xs text-slate-400">Open your personal multi-currency bank account</p>
        </div>

        <Card glow className="p-8">
          {error && (
            <div className="p-3.5 rounded-xl mb-6 text-xs bg-rose-950/80 border border-rose-800 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleDiscordLogin}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl font-semibold text-sm text-white bg-[#5865F2] hover:bg-[#4752C4] shadow-lg shadow-[#5865F2]/25 transition-all duration-150 active:scale-[0.98]"
          >
            <span>🎮</span>
            <span>Sign up with Discord</span>
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#0f172a] px-3 text-slate-500 font-semibold">Or fill details</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              placeholder="e.g. Satoshi (letters, numbers, hyphens)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />

            <Input
              label="Display Name (Optional)"
              placeholder="e.g. Satoshi Nakamoto"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />

            <Input
              label="Email (Optional)"
              type="email"
              placeholder="satoshi@mcoin.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              loading={loading}
              icon={<UserPlus className="w-4 h-4" />}
            >
              Open Account
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-brand-400 hover:text-brand-300 font-bold transition-colors"
            >
              Sign In
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
