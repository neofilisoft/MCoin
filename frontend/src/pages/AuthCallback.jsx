import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { Card } from '../components/common/Card';
import { Loader2, AlertCircle } from 'lucide-react';

export function AuthCallback({ onComplete }) {
  const { setAuthSession } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      if (!code) {
        setError('Missing authorization code from OAuth provider.');
        return;
      }

      try {
        const resp = await api.post('/auth/discord/callback', {
          code,
          redirectUri: window.location.origin + '/auth/callback',
        });

        const { user, tokens } = resp.data;
        setAuthSession(user, tokens);
        if (onComplete) onComplete();
      } catch (err) {
        setError(err.response?.data?.error || err.message);
      }
    };

    handleCallback();
  }, [setAuthSession, onComplete]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#090d16]">
      <Card glow className="max-w-sm w-full p-8 text-center space-y-4">
        {error ? (
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-400 mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-white text-base">Authentication Failed</h3>
            <p className="text-xs text-rose-300">{error}</p>
            <button
              onClick={() => (window.location.href = '/')}
              className="mt-4 px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-xl"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <Loader2 className="w-10 h-10 text-brand-400 animate-spin mx-auto" />
            <h3 className="font-bold text-white text-base">Authenticating with Discord...</h3>
            <p className="text-xs text-slate-400">Verifying session and linking your digital vault.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
