import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Copy, Check, QrCode, Shield, Bell } from 'lucide-react';

export function Header({ wallet, onOpenQr }) {
  const { user } = useAuth();
  const [copied, setCopied] = React.useState(false);

  const copyAddress = () => {
    if (wallet?.wallet_address) {
      navigator.clipboard.writeText(wallet.wallet_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="h-16 px-8 bg-[#090d16]/80 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between sticky top-0 z-30">
      {/* Wallet Address Chip */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-400">Address:</span>
        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-300">
          <span>{wallet?.wallet_address ? `${wallet.wallet_address.slice(0, 10)}...${wallet.wallet_address.slice(-6)}` : 'Loading...'}</span>
          <button
            onClick={copyAddress}
            title="Copy address"
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          {onOpenQr && (
            <button
              onClick={onOpenQr}
              title="Show QR code"
              className="text-slate-400 hover:text-white transition-colors p-1"
            >
              <QrCode className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right User Actions */}
      <div className="flex items-center gap-4">
        {user?.discord_id ? (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-950/50 border border-indigo-800/50 rounded-full text-indigo-300 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            <span>Discord Linked</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-slate-400 text-xs">
            <span>Standalone Web Account</span>
          </div>
        )}

        <div className="flex items-center gap-2 pl-4 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-brand-600/20 border border-brand-500/40 flex items-center justify-center text-xs font-bold text-brand-300">
            {user?.role === 'admin' ? '👑' : '👤'}
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-white leading-none">{user?.username}</p>
            <p className="text-[10px] text-brand-400 capitalize">{user?.role || 'user'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
