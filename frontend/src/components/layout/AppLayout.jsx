import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { RateTicker } from './RateTicker';
import { Modal } from '../common/Modal';
import api from '../../services/api';

export function AppLayout({ children, currentTab, setCurrentTab }) {
  const [wallet, setWallet] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);

  const fetchWallet = async () => {
    try {
      const resp = await api.get('/wallet/me');
      setWallet(resp.data.wallet);
    } catch (err) {
      console.error('Failed to fetch wallet:', err);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, [currentTab]);

  return (
    <div className="flex h-screen bg-[#090d16] overflow-hidden">
      {/* Sidebar */}
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Real-time Rate Ticker */}
        <RateTicker />

        {/* Top Header */}
        <Header wallet={wallet} onOpenQr={() => setShowQrModal(true)} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>

      {/* Wallet QR Modal */}
      <Modal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        title="Your Wallet Address"
        maxWidth="max-w-sm"
      >
        <div className="text-center">
          <div className="bg-white p-4 rounded-2xl inline-block shadow-xl my-3">
            {wallet?.qr_code_url ? (
              <img src={wallet.qr_code_url} alt="Wallet Address QR" className="w-48 h-48 mx-auto" />
            ) : (
              <div className="w-48 h-48 bg-slate-200 flex items-center justify-center text-slate-500 font-mono text-xs">
                Generating QR...
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2 font-mono break-all bg-slate-900/90 p-3 rounded-xl border border-slate-800">
            {wallet?.wallet_address}
          </p>
          <p className="text-[11px] text-slate-500 mt-3">
            Share this QR code or address to receive funds from any MCoin user or external wallet.
          </p>
        </div>
      </Modal>
    </div>
  );
}
