import React, { useState } from 'react';
import { Card, CardHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Badge } from '../components/common/Badge';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { Settings as SettingsIcon, Shield, Link2, Unlink, CheckCircle2, AlertCircle } from 'lucide-react';

export function Settings() {
  const { user, updateProfile, refreshUser } = useAuth();

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await updateProfile({ displayName, email });
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectDiscord = async () => {
    try {
      const resp = await api.get('/auth/discord/url');
      window.location.href = resp.data.url;
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleUnlinkDiscord = async () => {
    if (!confirm('Are you sure you want to unlink your Discord account?')) return;

    try {
      await api.post('/auth/unlink-discord');
      refreshUser();
      setMessage({ type: 'success', text: 'Discord account unlinked!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || err.message });
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
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

      {/* Profile Settings */}
      <Card>
        <CardHeader
          title="Account Profile"
          subtitle="Manage your public profile and contact information"
        />

        <form onSubmit={handleUpdateProfile} className="space-y-5 max-w-lg">
          <Input
            label="Username"
            value={user?.username || ''}
            disabled
            helper="Username cannot be changed after registration"
          />

          <Input
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Satoshi"
          />

          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
          />

          <Button type="submit" variant="primary" loading={loading}>
            Save Changes
          </Button>
        </form>
      </Card>

      {/* Discord Connection Settings */}
      <Card>
        <CardHeader
          title="Connected Accounts"
          subtitle="Link your Discord ID to access your centralized wallet seamlessly via Discord bot slash commands"
        />

        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#5865F2]/20 border border-[#5865F2]/40 flex items-center justify-center text-[#5865F2] font-bold text-xl">
              🎮
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">Discord Integration</span>
                {user?.discord_id ? (
                  <Badge variant="success">Connected</Badge>
                ) : (
                  <Badge variant="default">Not Linked</Badge>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {user?.discord_id
                  ? `Linked Discord ID: ${user.discord_id}`
                  : 'Connect Discord to use /wallet, /transfer, and other commands in Discord servers'}
              </p>
            </div>
          </div>

          <div>
            {user?.discord_id ? (
              <Button
                variant="danger"
                size="sm"
                icon={<Unlink className="w-4 h-4" />}
                onClick={handleUnlinkDiscord}
              >
                Unlink Discord
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                className="bg-[#5865F2] hover:bg-[#4752C4] border-[#5865F2]/40"
                icon={<Link2 className="w-4 h-4" />}
                onClick={handleConnectDiscord}
              >
                Connect Discord
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
