import React from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  RefreshCcw,
  ShieldCheck,
  Users,
  Coins,
  History,
  Settings,
  LogOut,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function Sidebar({ currentTab, setCurrentTab }) {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'transfers', label: 'Transfers & Requests', icon: <ArrowLeftRight className="w-5 h-5" /> },
    { id: 'exchange', label: 'Exchange (Swap)', icon: <RefreshCcw className="w-5 h-5" /> },
    { id: 'escrow', label: 'Escrow Contracts', icon: <ShieldCheck className="w-5 h-5" /> },
    { id: 'splits', label: 'Split Bills', icon: <Users className="w-5 h-5" /> },
    { id: 'staking', label: 'Staking Vault', icon: <Coins className="w-5 h-5" /> },
    { id: 'history', label: 'Transaction History', icon: <History className="w-5 h-5" /> },
    { id: 'settings', label: 'Account & Security', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <aside className="w-64 bg-[#0c121e] border-r border-slate-800/80 flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800/80 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-900/40 text-xl font-bold">
          💎
        </div>
        <div>
          <h1 className="font-extrabold text-lg text-white tracking-tight leading-none">
            MCoin<span className="text-brand-400">Bank</span>
          </h1>
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">v1.3 Central Bank</span>
        </div>
      </div>

      {/* User Mini Profile */}
      <div className="p-4 mx-3 my-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center text-sm font-bold text-brand-300 shrink-0">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
          ) : (
            (user?.display_name || user?.username || 'U').charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{user?.display_name || user?.username}</p>
          <p className="text-xs text-slate-400 truncate">@{user?.username}</p>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left ${
                isActive
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/40 border border-brand-400/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Logout Footer */}
      <div className="p-4 border-t border-slate-800/80">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 border border-transparent hover:border-rose-900/40 transition-all duration-150 text-left"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
