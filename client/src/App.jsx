import React, { useState, useEffect } from 'react';
import { TelegramProvider, useTelegram } from './context/TelegramContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { ServicesView } from './components/ServicesView';
import { InboxView } from './components/InboxView';
import { WalletView } from './components/WalletView';
import { ReferralView } from './components/ReferralView';
import { ClaimServiceModal } from './components/ClaimServiceModal';
import { AdminDashboardView } from './components/AdminDashboardView';
import { CheckCircle2, AlertCircle } from 'lucide-react';


function MainApp() {
  const { user, setUser, triggerHaptic } = useTelegram();
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [activeTab, setActiveTab] = useState('services');
  const [selectedService, setSelectedService] = useState(null);
  const [activeNumbers, setActiveNumbers] = useState([]);
  const [smsMessages, setSmsMessages] = useState([]);
  const [toast, setToast] = useState(null);

  // Check if opened with ?admin=true
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('admin') === 'true') {
        setIsAdminMode(true);
      }
    }
  }, []);

  // Fetch live user data (Active Numbers, CDR Messages, Balance)
  const refreshUserData = () => {
    if (!user?.id) return;
    fetch(`/api/user-data?telegram_id=${user.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          if (data.activeNumbers) setActiveNumbers(data.activeNumbers);
          if (data.smsMessages) setSmsMessages(data.smsMessages);
          if (data.user) {
            setUser((prev) => ({
              ...prev,
              balance: parseFloat(data.user.balance) || 0.00,
              total_earnings: parseFloat(data.user.total_earnings) || 0.00,
              total_withdrawn: parseFloat(data.user.total_withdrawn) || 0.00,
              total_sms: parseInt(data.user.total_sms) || 0,
              referral_count: data.referralStats?.count || 0,
              active_referrals: data.referralStats?.active || 0,
              referral_earnings: data.referralStats?.bonus || 0
            }));
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshUserData();
    const interval = setInterval(refreshUserData, 8000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Claim real number from Supabase & Lamix pool
  const handleClaimNumber = async ({ service, range, quantity = 1 }) => {
    try {
      const res = await fetch('/api/claim-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          serviceId: service.id,
          serviceName: service.name,
          rangeId: range?.rangeId || range?.id,
          dialCode: range?.dialCode,
          rateBdt: range?.rate,
          quantity: quantity || 1
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Failed to claim number.', 'error');
        return;
      }

      const assignedList = data.assignedNumbers || (data.assigned ? [data.assigned] : []);
      if (assignedList.length > 0) {
        setActiveNumbers((prev) => [...assignedList, ...prev]);
        showToast(
          `${service.name} (${range?.country || 'Virtual'}) ${assignedList.length > 1 ? `${assignedList.length} numbers` : 'number'} successfully assigned!`,
          'success'
        );
      }
      setActiveTab('inbox');
    } catch (err) {
      showToast('Server connection error.', 'error');
    }
  };

  // Release number handler
  const handleReleaseNumber = async (id) => {
    const item = activeNumbers.find((n) => n.id === id);
    try {
      await fetch('/api/release-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, number: item?.number })
      });
      setActiveNumbers((prev) => prev.filter((n) => n.id !== id));
      showToast('Number released successfully.', 'info');
    } catch (err) {
      setActiveNumbers((prev) => prev.filter((n) => n.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#26160F] flex flex-col max-w-md mx-auto shadow-2xl relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-16 left-4 right-4 z-50 flex justify-center animate-slide-down">
          <div className="px-4 py-2.5 rounded-2xl bg-[#3B2215] border border-[#784A33]/40 text-[#FAF7F2] text-xs font-semibold shadow-2xl flex items-center gap-2 backdrop-blur-xl">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}



      {isAdminMode ? (
        /* Admin Mini App View */
        <main className="flex-1 overflow-y-auto">
          <AdminDashboardView />
        </main>
      ) : (
        /* Regular User Mini App View */
        <>
          <Header onOpenWallet={() => setActiveTab('wallet')} />

          <main className="flex-1 overflow-y-auto">
            {activeTab === 'services' && (
              <ServicesView onSelectService={(s) => setSelectedService(s)} />
            )}

            {activeTab === 'inbox' && (
              <InboxView
                activeNumbers={activeNumbers}
                smsMessages={smsMessages}
                onReleaseNumber={handleReleaseNumber}
              />
            )}

            {activeTab === 'wallet' && (
              <WalletView
                onWithdrawSubmit={(wd) => {
                  setUser((prev) => ({
                    ...prev,
                    balance: Math.max(0, prev.balance - wd.amount),
                    total_withdrawn: prev.total_withdrawn + wd.amount
                  }));
                }}
              />
            )}

            {activeTab === 'referral' && <ReferralView />}
          </main>

          {selectedService && (
            <ClaimServiceModal
              service={selectedService}
              onClose={() => setSelectedService(null)}
              onClaimNumber={handleClaimNumber}
            />
          )}

          <BottomNav
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            activeNumbersCount={activeNumbers.length}
          />
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <TelegramProvider>
      <MainApp />
    </TelegramProvider>
  );
}
