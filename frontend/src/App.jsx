import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RatesProvider } from './contexts/RatesContext';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { Transfers } from './pages/Transfers';
import { Exchange } from './pages/Exchange';
import { Escrow } from './pages/Escrow';
import { SplitBills } from './pages/SplitBills';
import { Staking } from './pages/Staking';
import { History } from './pages/History';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { AuthCallback } from './pages/AuthCallback';
import { Loader2 } from 'lucide-react';

function MainApp() {
  const { user, loading, isAuthenticated } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [authView, setAuthView] = useState('login'); // 'login', 'register'

  // Handle Discord OAuth Callback URL
  if (window.location.pathname.includes('/auth/callback') || window.location.search.includes('code=')) {
    return (
      <AuthCallback
        onComplete={() => {
          window.history.replaceState({}, document.title, '/');
          setCurrentTab('dashboard');
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Connecting to MCoin Central Bank...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authView === 'register') {
      return <Register onSwitchToLogin={() => setAuthView('login')} />;
    }
    return <Login onSwitchToRegister={() => setAuthView('register')} />;
  }

  return (
    <RatesProvider>
      <AppLayout currentTab={currentTab} setCurrentTab={setCurrentTab}>
        {currentTab === 'dashboard' && <Dashboard onNavigate={setCurrentTab} />}
        {currentTab === 'transfers' && <Transfers />}
        {currentTab === 'exchange' && <Exchange />}
        {currentTab === 'escrow' && <Escrow />}
        {currentTab === 'splits' && <SplitBills />}
        {currentTab === 'staking' && <Staking />}
        {currentTab === 'history' && <History />}
        {currentTab === 'settings' && <Settings />}
      </AppLayout>
    </RatesProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
