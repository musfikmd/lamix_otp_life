import React, { useState, useEffect } from 'react';
import { useTelegram } from '../context/TelegramContext';
import { 
  RefreshCw, 
  Plus, 
  Layers, 
  Check, 
  X, 
  Globe, 
  Clock, 
  MessageSquare,
  Trash2,
  Link2,
  Unlink,
  ChevronRight,
  Lock,
  Key,
  LogOut,
  Eye,
  EyeOff
} from 'lucide-react';

export const AdminDashboardView = () => {
  const { triggerHaptic } = useTelegram();
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return typeof window !== 'undefined' && sessionStorage.getItem('admin_authenticated') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [activeSubTab, setActiveSubTab] = useState('services');
  const [stats, setStats] = useState({
    pendingWithdrawals: 0,
    poolCount: 0,
    servicesCount: 0,
    totalCdrCount: 0
  });
  const [services, setServices] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [availableRanges, setAvailableRanges] = useState([]);

  // Modals state
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceIcon, setNewServiceIcon] = useState('📱');

  const [selectedService, setSelectedService] = useState(null);
  const [showLinkRangeForm, setShowLinkRangeForm] = useState(false);
  const [selectedRangeId, setSelectedRangeId] = useState('');
  const [linkRateBdt, setLinkRateBdt] = useState('0.80');
  const [linkCountryName, setLinkCountryName] = useState('');

  const [showQuickLinkModal, setShowQuickLinkModal] = useState(false);
  const [quickLinkServiceId, setQuickLinkServiceId] = useState('');

  const [isSyncing, setIsSyncing] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  // Adsterra & Ads Settings
  const [adsSettings, setAdsSettings] = useState({
    popup_enabled: true,
    adsterra_direct_link: '',
    popup_title: '🔥 Join Official Telegram Channel!',
    popup_desc: 'Get live number restock alerts, special high-paying OTP rates & 24/7 priority admin support.',
    popup_image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    popup_cta_text: '🚀 Join Channel Now',
    popup_cta_link: 'https://t.me/OTP_LIFE_bot',
    popup_countdown: 3,
    banner_enabled: true,
    adsterra_banner_key_320x50: '',
    banner_title: '💎 Official VIP Community',
    banner_desc: 'Highest BDT rate per SMS with instant payout approval!',
    banner_cta_text: 'Join Now',
    banner_cta_link: 'https://t.me/OTP_LIFE_bot',
    cpm_views_enabled: true,
    cpm_script_src: '',
    bot_ad_enabled: true,
    bot_ad_text: 'Join @OTP_LIFE_bot for live updates & bonuses!',
    bot_ad_button_text: '📢 Join Official Channel',
    bot_ad_button_url: 'https://t.me/OTP_LIFE_bot'
  });
  const [isSavingAds, setIsSavingAds] = useState(false);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleSaveAds = async (e) => {
    e?.preventDefault?.();
    triggerHaptic('heavy');
    setIsSavingAds(true);
    try {
      const res = await fetch('/api/admin/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adsSettings)
      });
      const data = await res.json();
      setIsSavingAds(false);
      if (data?.success) {
        showToast('✅ Adsterra & Ads settings saved successfully!');
        if (data.ads) setAdsSettings(data.ads);
      } else {
        showToast('❌ Failed: ' + (data?.error || 'Unknown error'));
      }
    } catch (err) {
      setIsSavingAds(false);
      showToast('❌ Server error saving ads');
    }
  };

  const fetchOverview = async () => {
    try {
      const res = await fetch('/api/admin/overview');
      const data = await res.json();
      if (data?.success) {
        if (data.stats) setStats(data.stats);
        if (data.withdrawals) setWithdrawals(data.withdrawals);
        if (data.services) setServices(data.services);
        if (data.mappings) setMappings(data.mappings);
        if (data.ads) setAdsSettings((prev) => ({ ...prev, ...data.ads }));

        if (selectedService) {
          const updatedSelected = (data.services || []).find((s) => s.id === selectedService.id);
          if (updatedSelected) setSelectedService(updatedSelected);
        }
      }
    } catch (e) {
      console.error('Error fetching admin overview:', e);
    }
  };

  const fetchAvailableRanges = async () => {
    try {
      const res = await fetch('/api/admin/available-ranges');
      const data = await res.json();
      if (data?.success && Array.isArray(data.ranges)) {
        setAvailableRanges(data.ranges);
        if (data.ranges.length > 0 && !selectedRangeId) {
          setSelectedRangeId(data.ranges[0].range_id);
          setLinkCountryName(data.ranges[0].country || 'Global');
          setLinkRateBdt(String(data.ranges[0].default_rate || '1.50'));
        }
      }
    } catch (e) {
      console.error('Error fetching available ranges:', e);
    }
  };

  const handleVerifyPassword = async (e) => {
    e?.preventDefault?.();
    if (!passwordInput.trim()) {
      setAuthError('Please enter the admin password');
      return;
    }
    setIsVerifying(true);
    setAuthError('');
    try {
      const res = await fetch('/api/admin/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput.trim() })
      });
      const data = await res.json();
      setIsVerifying(false);
      if (data?.success) {
        sessionStorage.setItem('admin_authenticated', 'true');
        setIsAuthenticated(true);
        triggerHaptic('success');
      } else {
        triggerHaptic('error');
        setAuthError(data?.error || 'Incorrect admin password');
      }
    } catch (err) {
      setIsVerifying(false);
      setAuthError('Network error, please try again');
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchOverview();
      fetchAvailableRanges();
    }
  }, [isAuthenticated]);

  // 1. Approve Withdrawal
  const handleApproveWithdrawal = async (id) => {
    triggerHaptic('success');
    try {
      const res = await fetch('/api/admin/withdrawals/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        setWithdrawals((prev) => prev.map((w) => (w.id === id ? { ...w, status: 'APPROVED' } : w)));
        showToast('Withdrawal approved successfully!');
        fetchOverview();
      } else {
        showToast(data.error || 'Failed to approve withdrawal.');
      }
    } catch (e) {
      showToast('Server connection error.');
    }
  };

  // 2. Reject Withdrawal
  const handleRejectWithdrawal = async (id) => {
    triggerHaptic('error');
    try {
      const res = await fetch('/api/admin/withdrawals/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, reason: 'Admin rejected' })
      });
      const data = await res.json();
      if (data.success) {
        setWithdrawals((prev) => prev.map((w) => (w.id === id ? { ...w, status: 'REJECTED' } : w)));
        showToast('Withdrawal rejected and balance refunded to user.');
        fetchOverview();
      } else {
        showToast(data.error || 'Failed to reject withdrawal.');
      }
    } catch (e) {
      showToast('Server connection error.');
    }
  };

  // 3. Create New App Service
  const handleAddService = async (e) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;
    triggerHaptic('medium');
    setIsActionLoading(true);

    try {
      const res = await fetch('/api/admin/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newServiceName.trim(),
          icon: newServiceIcon || '📱'
        })
      });
      const data = await res.json();
      setIsActionLoading(false);

      if (data.success) {
        setNewServiceName('');
        setShowAddServiceModal(false);
        showToast(`Service "${data.service.name}" created successfully!`);
        fetchOverview();
      } else {
        showToast(data.error || 'Failed to create service.');
      }
    } catch (err) {
      setIsActionLoading(false);
      showToast('Server error creating service.');
    }
  };

  // 4. Delete App Service
  const handleDeleteService = async (serviceId) => {
    if (!window.confirm('Are you sure you want to delete this service? All linked ranges will be removed.')) {
      return;
    }
    triggerHaptic('error');
    setIsActionLoading(true);

    try {
      const res = await fetch('/api/admin/services/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId })
      });
      const data = await res.json();
      setIsActionLoading(false);

      if (data.success) {
        setSelectedService(null);
        showToast('Service deleted successfully.');
        fetchOverview();
      } else {
        showToast(data.error || 'Failed to delete service.');
      }
    } catch (err) {
      setIsActionLoading(false);
      showToast('Server error.');
    }
  };

  // 5. Link Range to Service
  const handleLinkRangeSubmit = async (e, targetServiceId) => {
    e?.preventDefault?.();
    const serviceId = targetServiceId || selectedService?.id;
    if (!serviceId || !selectedRangeId) {
      showToast('Please select a range.');
      return;
    }

    const rangeObj = availableRanges.find((r) => r.range_id === selectedRangeId);
    triggerHaptic('heavy');
    setIsActionLoading(true);

    try {
      const res = await fetch('/api/admin/link-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          rangeId: selectedRangeId,
          rangeName: rangeObj?.range_name || 'Global Range',
          displayName: linkCountryName.trim() || rangeObj?.country || 'Global',
          rateBdt: parseFloat(linkRateBdt) || 0.80,
          prefix: rangeObj?.prefix || '213',
          country: linkCountryName.trim() || rangeObj?.country || 'Global'
        })
      });
      const data = await res.json();
      setIsActionLoading(false);

      if (data.success) {
        setShowLinkRangeForm(false);
        setShowQuickLinkModal(false);
        showToast('Range linked successfully!');
        fetchOverview();
      } else {
        showToast(data.error || 'Failed to link range.');
      }
    } catch (err) {
      setIsActionLoading(false);
      showToast('Server error linking range.');
    }
  };

  // 6. Unlink Range
  const handleUnlinkRange = async (mappingId) => {
    triggerHaptic('medium');
    try {
      const res = await fetch('/api/admin/unlink-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappingId })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Range unlinked successfully.');
        fetchOverview();
      } else {
        showToast(data.error || 'Failed to unlink range.');
      }
    } catch (err) {
      showToast('Server error.');
    }
  };

  // 7. Sync Numbers from Lamix Pool
  const handleSyncNumbers = async () => {
    triggerHaptic('heavy');
    setIsSyncing(true);
    try {
      const res = await fetch('/api/admin/sync-numbers', { method: 'POST' });
      const data = await res.json();
      setIsSyncing(false);
      if (data.success) {
        showToast(`Synced ${data.synced || 0} numbers successfully!`);
        fetchOverview();
        fetchAvailableRanges();
      } else {
        showToast(data.error || 'Failed to sync numbers.');
      }
    } catch (e) {
      setIsSyncing(false);
      showToast('Sync request error.');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="w-full max-w-sm p-6 rounded-3xl bg-[#FFFFFF] border border-[#EBE3D8] shadow-xl text-center">
          <div className="w-16 h-16 rounded-3xl bg-[#5C3824]/10 border border-[#5C3824]/20 flex items-center justify-center mx-auto mb-4 text-[#5C3824]">
            <Lock className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-black text-[#5C3824] mb-1">
            Admin Panel Locked
          </h2>
          <p className="text-xs text-[#826A5C] mb-6">
            Enter the admin password to access control center
          </p>

          <form onSubmit={handleVerifyPassword} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setAuthError('');
                }}
                placeholder="Admin Password..."
                className="w-full px-4 py-3 pr-10 rounded-2xl bg-[#FAF7F2] border border-[#EBE3D8] text-sm text-[#5C3824] font-medium placeholder-[#A8988D] focus:outline-none focus:border-[#5C3824]"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#826A5C] hover:text-[#5C3824]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {authError && (
              <p className="text-xs font-bold text-rose-600 bg-rose-50 py-1.5 px-3 rounded-xl border border-rose-200">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3 rounded-2xl bg-[#5C3824] hover:bg-[#4A2E1F] active:scale-[0.98] text-white font-bold text-sm shadow-md shadow-[#5C3824]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Key className="w-4 h-4" />
              <span>{isVerifying ? 'Verifying...' : 'Unlock Admin Panel'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.href = '/';
              }}
              className="w-full py-2.5 rounded-2xl bg-transparent hover:bg-[#FAF7F2] text-xs font-bold text-[#826A5C] transition-colors"
            >
              ← Back to Client App
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 pt-2 px-4 space-y-4">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-14 left-4 right-4 z-50 flex justify-center animate-slide-down">
          <div className="px-4 py-2 rounded-2xl bg-[#3B2215] border border-[#784A33] text-white text-xs font-semibold shadow-2xl backdrop-blur-xl">
            {toastMsg}
          </div>
        </div>
      )}

      {/* Admin Top Header Badge */}
      <div className="flex items-center justify-between p-4 rounded-3xl bg-gradient-to-r from-[#4A2E1F] via-[#5C3824] to-[#784A33] border border-[#6E442D] text-white shadow-md shadow-[#4A2E1F]/15">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-amber-300 font-bold">
            👑
          </div>
          <div>
            <h2 className="text-sm font-black text-white flex items-center gap-1.5 leading-none">
              <span>Admin Control Center</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/20 text-amber-300 font-mono">
                ADMIN
              </span>
            </h2>
            <p className="text-[11px] text-[#E8D7CC] mt-0.5">
              OTP LIFE — Super Admin Panel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncNumbers}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 active:scale-95 text-xs font-bold text-white flex items-center gap-1.5 border border-white/25 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Pool'}</span>
          </button>
          <button
            onClick={() => {
              sessionStorage.removeItem('admin_authenticated');
              setIsAuthenticated(false);
              triggerHaptic('medium');
            }}
            title="Lock / Logout"
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3.5 rounded-3xl bg-[#FFFFFF] border border-[#EBE3D8] shadow-sm">
          <div className="flex items-center justify-between text-[#826A5C]">
            <span className="text-[11px] font-bold">Pending Withdrawals</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-black text-[#5C3824] font-mono mt-1">
            {stats.pendingWithdrawals}
          </div>
        </div>

        <div className="p-3.5 rounded-3xl bg-[#FFFFFF] border border-[#EBE3D8] shadow-sm">
          <div className="flex items-center justify-between text-[#826A5C]">
            <span className="text-[11px] font-bold">Total Pool Stock</span>
            <Globe className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-[#2D6A4F] font-mono mt-1">
            {stats.poolCount}
          </div>
        </div>

        <div className="p-3.5 rounded-3xl bg-[#FFFFFF] border border-[#EBE3D8] shadow-sm">
          <div className="flex items-center justify-between text-[#826A5C]">
            <span className="text-[11px] font-bold">App Services</span>
            <Layers className="w-3.5 h-3.5 text-[#5C3824]" />
          </div>
          <div className="text-xl font-black text-[#26160F] font-mono mt-1">
            {stats.servicesCount}
          </div>
        </div>

        <div className="p-3.5 rounded-3xl bg-[#FFFFFF] border border-[#EBE3D8] shadow-sm">
          <div className="flex items-center justify-between text-[#826A5C]">
            <span className="text-[11px] font-bold">Processed OTPs</span>
            <MessageSquare className="w-3.5 h-3.5 text-[#784A33]" />
          </div>
          <div className="text-xl font-black text-[#784A33] font-mono mt-1">
            {stats.totalCdrCount}
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[#FFFFFF] rounded-2xl border border-[#EBE3D8] shadow-sm">
        <button
          onClick={() => {
            triggerHaptic('selection');
            setActiveSubTab('withdrawals');
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'withdrawals'
              ? 'bg-[#5C3824] text-white shadow-md shadow-[#5C3824]/20'
              : 'text-[#826A5C] hover:text-[#26160F]'
          }`}
        >
          Withdrawals ({withdrawals.filter(w => w.status === 'PENDING').length})
        </button>

        <button
          onClick={() => {
            triggerHaptic('selection');
            setActiveSubTab('services');
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'services'
              ? 'bg-[#5C3824] text-white shadow-md shadow-[#5C3824]/20'
              : 'text-[#826A5C] hover:text-[#26160F]'
          }`}
        >
          App Services ({services.length})
        </button>

        <button
          onClick={() => {
            triggerHaptic('selection');
            setActiveSubTab('mapping');
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'mapping'
              ? 'bg-[#5C3824] text-white shadow-md shadow-[#5C3824]/20'
              : 'text-[#826A5C] hover:text-[#26160F]'
          }`}
        >
          Range Mapping ({mappings.length})
        </button>

        <button
          onClick={() => {
            triggerHaptic('selection');
            setActiveSubTab('ads');
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'ads'
              ? 'bg-[#5C3824] text-white shadow-md shadow-[#5C3824]/20'
              : 'text-[#826A5C] hover:text-[#26160F]'
          }`}
        >
          📢 Adsterra & Ads
        </button>
      </div>

      {/* 1. Pending Withdrawals Tab */}
      {activeSubTab === 'withdrawals' && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#4A2E1F] uppercase tracking-wider">
            Withdrawal Requests
          </h3>

          {withdrawals.length === 0 ? (
            <div className="p-8 text-center text-[#826A5C] bg-[#FFFFFF] rounded-3xl border border-dashed border-[#EBE3D8]">
              No pending withdrawals.
            </div>
          ) : (
            withdrawals.map((wd) => {
              const isPending = wd.status === 'PENDING';
              const isApproved = wd.status === 'APPROVED';

              return (
                <div
                  key={wd.id}
                  className="p-4 rounded-3xl bg-[#FFFFFF] border border-[#EBE3D8] shadow-sm"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#F0E8DE]">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-[#26160F]">
                          @{wd.username}
                        </span>
                        <span className="text-[10px] text-[#826A5C] font-mono">
                          ({wd.userId})
                        </span>
                      </div>
                      <span className="text-[10px] text-[#A8988C]">
                        {wd.time}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-black text-[#5C3824] font-mono">
                        ৳{wd.amount}
                      </span>
                      <span className="text-[10px] text-[#826A5C] block">
                        BDT
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 p-2 rounded-xl bg-[#FAF7F2] border border-[#EBE3D8] flex items-center justify-between text-xs">
                    <span className="text-[#826A5C] font-semibold">Payment Account:</span>
                    <span className="font-bold text-[#5C3824] font-mono">
                      {wd.method} • {wd.wallet}
                    </span>
                  </div>

                  {isPending ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleApproveWithdrawal(wd.id)}
                        className="py-2.5 px-3 rounded-xl bg-[#2D6A4F] hover:bg-[#1E4D38] active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-md shadow-[#2D6A4F]/20 transition-all"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve (Paid)</span>
                      </button>

                      <button
                        onClick={() => handleRejectWithdrawal(wd.id)}
                        className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 active:scale-95 font-bold text-xs flex items-center justify-center gap-1 border border-rose-200 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject & Refund</span>
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2.5 text-center py-1.5 rounded-xl bg-[#FAF7F2] text-xs font-bold font-mono">
                      {isApproved ? (
                        <span className="text-emerald-700">✅ APPROVED (Paid)</span>
                      ) : (
                        <span className="text-rose-700">❌ REJECTED (Refunded)</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 2. Services Management Tab */}
      {activeSubTab === 'services' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#4A2E1F] uppercase tracking-wider">
                App Services ({services.length})
              </h3>
              <p className="text-[10px] text-[#826A5C]">
                Tap any service to manage ranges, rates, or delete
              </p>
            </div>
            <button
              onClick={() => {
                triggerHaptic('medium');
                setShowAddServiceModal(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[#5C3824] hover:bg-[#4A2E1F] active:scale-95 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-[#5C3824]/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Service</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {services.map((srv) => {
              const srvRanges = mappings.filter((m) => m.serviceId === srv.id);
              const totalStock = srvRanges.reduce((sum, m) => sum + (m.allocated || 0), 0);

              return (
                <div
                  key={srv.id}
                  onClick={() => {
                    triggerHaptic('medium');
                    setSelectedService(srv);
                    setShowLinkRangeForm(false);
                    if (availableRanges.length > 0) {
                      setSelectedRangeId(availableRanges[0].range_id);
                      setLinkCountryName(availableRanges[0].country || 'Global');
                      setLinkRateBdt(String(availableRanges[0].default_rate || '0.80'));
                    }
                  }}
                  className="p-3.5 rounded-3xl bg-[#FFFFFF] border border-[#EBE3D8] hover:border-[#8D5B4C] active:scale-95 cursor-pointer shadow-sm flex items-center justify-between gap-2 transition-all hover:shadow-md"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span className="text-2xl p-2 rounded-2xl bg-[#FAF7F2] border border-[#EBE3D8] shrink-0">
                      {srv.icon}
                    </span>
                    <div className="truncate">
                      <h4 className="font-bold text-xs text-[#26160F] leading-tight truncate">
                        {srv.name}
                      </h4>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-emerald-700 font-semibold">
                          ● {srvRanges.length} {srvRanges.length === 1 ? 'Country' : 'Countries'}
                        </span>
                        <span className="text-[10px] text-[#826A5C] font-mono">
                          ({totalStock})
                        </span>
                      </div>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-[#C48B5E] shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Range Mapping Tab */}
      {activeSubTab === 'mapping' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#4A2E1F] uppercase tracking-wider">
              Service & Range Mappings ({mappings.length})
            </h3>

            <button
              onClick={() => {
                triggerHaptic('medium');
                if (services.length > 0) setQuickLinkServiceId(services[0].id);
                if (availableRanges.length > 0) {
                  setSelectedRangeId(availableRanges[0].range_id);
                  setLinkCountryName(availableRanges[0].country || 'Global');
                  setLinkRateBdt(String(availableRanges[0].default_rate || '0.80'));
                }
                setShowQuickLinkModal(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-[#5C3824] hover:bg-[#4A2E1F] active:scale-95 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-[#5C3824]/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Link Range</span>
            </button>
          </div>

          {mappings.length === 0 ? (
            <div className="p-8 text-center text-[#826A5C] bg-[#FFFFFF] rounded-3xl border border-dashed border-[#EBE3D8]">
              No range mappings found. Tap the button above to link ranges.
            </div>
          ) : (
            <div className="space-y-2.5">
              {mappings.map((m) => (
                <div
                  key={m.id}
                  className="p-3.5 rounded-3xl bg-[#FFFFFF] border border-[#EBE3D8] shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-[#FAF7F2] text-[#5C3824] border border-[#EBE3D8] flex items-center gap-1">
                        <span>{m.serviceIcon || '📱'}</span>
                        <span>{m.serviceName}</span>
                      </span>
                      <span className="text-xs font-bold text-[#26160F] flex items-center gap-1">
                        <span>{m.flag}</span>
                        <span>{m.country || m.displayName}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-[#2D6A4F] font-mono">
                        ৳{Number(m.rateBdt || 0).toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleUnlinkRange(m.id)}
                        className="p-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                        title="Unlink Range"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#826A5C] pt-2 border-t border-[#F0E8DE]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] bg-[#FAF7F2] px-1.5 py-0.5 rounded border border-[#EBE3D8]">
                        +{m.prefix}
                      </span>
                      <span className="truncate max-w-[150px]">{m.rangeName}</span>
                    </div>
                    <span className="text-[#2D6A4F] font-bold">
                      ● {m.allocated} in stock
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Adsterra & Ads Management Tab */}
      {activeSubTab === 'ads' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-gradient-to-r from-[#3B2215] to-[#5C3824] text-white border border-[#784A33]/40 shadow-sm space-y-1">
            <h3 className="text-sm font-black flex items-center gap-2 text-amber-300">
              <span>💰 Adsterra Monetization & Ads Center</span>
            </h3>
            <p className="text-xs text-[#E8D7CC] leading-relaxed">
              Configure Adsterra Direct Link (Smartlink) and Banners to earn Dollars ($) from Telegram Mini App & Client Bot traffic.
            </p>
          </div>

          {/* Section 1: Adsterra Direct Link (High Revenue) */}
          <div className="p-4 rounded-3xl bg-white border border-[#EBE3D8] shadow-sm space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#F0E8DE]">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                🔗
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#26160F]">
                  Adsterra Direct Link (Smartlink)
                </h4>
                <p className="text-[10px] text-[#826A5C]">
                  Highest CPM format. Opens when user clicks startup popup CTA or banner.
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#4A2E1F] block mb-1">
                Adsterra Direct Link URL:
              </label>
              <input
                type="url"
                value={adsSettings.adsterra_direct_link || ''}
                onChange={(e) => setAdsSettings({ ...adsSettings, adsterra_direct_link: e.target.value })}
                placeholder="https://www.profitablecpmrate.com/xxxxxxxxx..."
                className="w-full bg-[#FAF7F2] border border-[#EBE3D8] rounded-xl px-3 py-2 text-xs text-[#26160F] font-mono focus:outline-none focus:border-[#5C3824]"
              />
              <span className="text-[10px] text-[#826A5C] mt-1 block">
                💡 Paste your Smartlink from Adsterra dashboard (Left Menu 🔗 Direct Links).
              </span>
            </div>
          </div>

          {/* Section 1.5: Pay-Per-View CPM Monetization (Social Bar / Popunder Script) */}
          <div className="p-4 rounded-3xl bg-white border border-[#EBE3D8] shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F0E8DE]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                  👁️
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#26160F]">
                    Pay-Per-View CPM Ads (Social Bar / Popunder)
                  </h4>
                  <p className="text-[10px] text-[#826A5C]">
                    Earn purely on views (CPM) without requiring users to click any link!
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setAdsSettings({ ...adsSettings, cpm_views_enabled: !adsSettings.cpm_views_enabled });
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  adsSettings.cpm_views_enabled !== false
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-stone-200 text-stone-600'
                }`}
              >
                {adsSettings.cpm_views_enabled !== false ? '🟢 ON' : '🔴 OFF'}
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-[#4A2E1F] block mb-1">
                Adsterra Social Bar / Popunder Script URL or Tag:
              </label>
              <textarea
                rows="2"
                value={adsSettings.cpm_script_src || ''}
                onChange={(e) => setAdsSettings({ ...adsSettings, cpm_script_src: e.target.value })}
                placeholder="//pl234567.highperformanceformat.com/xx/yy/invoke.js or <script src='...'></script>"
                className="w-full bg-[#FAF7F2] border border-[#EBE3D8] rounded-xl px-3 py-2 text-xs text-[#26160F] font-mono focus:outline-none focus:border-[#5C3824]"
              />
              <span className="text-[10px] text-[#826A5C] mt-1 block">
                💡 Paste your Adsterra <b>Social Bar</b> or <b>Popunder</b> script from the Websites tab. This script runs in the background on every app open, generating pure CPM revenue per view!
              </span>
            </div>
          </div>

          {/* Section 2: Startup Interstitial Popup Ad */}
          <div className="p-4 rounded-3xl bg-white border border-[#EBE3D8] shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F0E8DE]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                  🚀
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#26160F]">
                    Startup Popup Ad (Every Open)
                  </h4>
                  <p className="text-[10px] text-[#826A5C]">
                    Shows an interstitial popup modal every time user opens the Mini App.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setAdsSettings({ ...adsSettings, popup_enabled: !adsSettings.popup_enabled });
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  adsSettings.popup_enabled
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-stone-200 text-stone-600'
                }`}
              >
                {adsSettings.popup_enabled ? '🟢 ON' : '🔴 OFF'}
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] font-bold text-[#4A2E1F] block mb-1">
                  Ad Headline Title:
                </label>
                <input
                  type="text"
                  value={adsSettings.popup_title || ''}
                  onChange={(e) => setAdsSettings({ ...adsSettings, popup_title: e.target.value })}
                  placeholder="e.g. 🔥 Join Official Telegram Channel!"
                  className="w-full bg-[#FAF7F2] border border-[#EBE3D8] rounded-xl px-3 py-1.5 text-xs text-[#26160F] focus:outline-none focus:border-[#5C3824]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#4A2E1F] block mb-1">
                  Ad Description / Subtitle:
                </label>
                <textarea
                  rows="2"
                  value={adsSettings.popup_desc || ''}
                  onChange={(e) => setAdsSettings({ ...adsSettings, popup_desc: e.target.value })}
                  placeholder="Ad description text..."
                  className="w-full bg-[#FAF7F2] border border-[#EBE3D8] rounded-xl px-3 py-1.5 text-xs text-[#26160F] focus:outline-none focus:border-[#5C3824]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-[#4A2E1F] block mb-1">
                    Banner Image URL:
                  </label>
                  <input
                    type="url"
                    value={adsSettings.popup_image || ''}
                    onChange={(e) => setAdsSettings({ ...adsSettings, popup_image: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-[#FAF7F2] border border-[#EBE3D8] rounded-xl px-3 py-1.5 text-xs text-[#26160F] font-mono focus:outline-none focus:border-[#5C3824]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#4A2E1F] block mb-1">
                    CTA Button Text:
                  </label>
                  <input
                    type="text"
                    value={adsSettings.popup_cta_text || ''}
                    onChange={(e) => setAdsSettings({ ...adsSettings, popup_cta_text: e.target.value })}
                    placeholder="🚀 Claim Offer"
                    className="w-full bg-[#FAF7F2] border border-[#EBE3D8] rounded-xl px-3 py-1.5 text-xs text-[#26160F] focus:outline-none focus:border-[#5C3824]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#4A2E1F] block mb-1">
                  Skip Countdown Timer (seconds):
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={adsSettings.popup_countdown ?? 3}
                  onChange={(e) => setAdsSettings({ ...adsSettings, popup_countdown: parseInt(e.target.value) || 0 })}
                  className="w-24 bg-[#FAF7F2] border border-[#EBE3D8] rounded-xl px-3 py-1.5 text-xs text-[#26160F] font-mono focus:outline-none focus:border-[#5C3824]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: In-Page Banner Ads */}
          <div className="p-4 rounded-3xl bg-white border border-[#EBE3D8] shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F0E8DE]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                  🖼️
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#26160F]">
                    Page Banner Ads (Services / Inbox / Wallet)
                  </h4>
                  <p className="text-[10px] text-[#826A5C]">
                    Displayed dynamically inside app pages.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setAdsSettings({ ...adsSettings, banner_enabled: !adsSettings.banner_enabled });
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  adsSettings.banner_enabled
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-stone-200 text-stone-600'
                }`}
              >
                {adsSettings.banner_enabled ? '🟢 ON' : '🔴 OFF'}
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] font-bold text-[#4A2E1F] block mb-1">
                  Adsterra 320x50 Banner Unit Key:
                </label>
                <input
                  type="text"
                  value={adsSettings.adsterra_banner_key_320x50 || ''}
                  onChange={(e) => setAdsSettings({ ...adsSettings, adsterra_banner_key_320x50: e.target.value.trim() })}
                  placeholder="e.g. 7f8b92c4a1e5..."
                  className="w-full bg-[#FAF7F2] border border-[#EBE3D8] rounded-xl px-3 py-1.5 text-xs text-[#26160F] font-mono focus:outline-none focus:border-[#5C3824]"
                />
                <span className="text-[10px] text-[#826A5C] mt-1 block">
                  💡 If left empty, a clickable Smartlink / Partner banner card will be displayed instead.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-[#4A2E1F] block mb-1">
                    Banner Title:
                  </label>
                  <input
                    type="text"
                    value={adsSettings.banner_title || ''}
                    onChange={(e) => setAdsSettings({ ...adsSettings, banner_title: e.target.value })}
                    placeholder="e.g. 💎 VIP Community"
                    className="w-full bg-[#FAF7F2] border border-[#EBE3D8] rounded-xl px-3 py-1.5 text-xs text-[#26160F] focus:outline-none focus:border-[#5C3824]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#4A2E1F] block mb-1">
                    Button Text:
                  </label>
                  <input
                    type="text"
                    value={adsSettings.banner_cta_text || ''}
                    onChange={(e) => setAdsSettings({ ...adsSettings, banner_cta_text: e.target.value })}
                    placeholder="Join VIP"
                    className="w-full bg-[#FAF7F2] border border-[#EBE3D8] rounded-xl px-3 py-1.5 text-xs text-[#26160F] focus:outline-none focus:border-[#5C3824]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Client Bot Messages Ad */}
          <div className="p-4 rounded-3xl bg-white border border-[#EBE3D8] shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F0E8DE]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                  🤖
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#26160F]">
                    Client Telegram Bot Message Ads
                  </h4>
                  <p className="text-[10px] text-[#826A5C]">
                    Appends sponsor text & inline button to /start and live OTP alerts.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setAdsSettings({ ...adsSettings, bot_ad_enabled: !adsSettings.bot_ad_enabled });
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  adsSettings.bot_ad_enabled
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-stone-200 text-stone-600'
                }`}
              >
                {adsSettings.bot_ad_enabled ? '🟢 ON' : '🔴 OFF'}
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] font-bold text-[#4A2E1F] block mb-1">
                  Bot Sponsor Message Text:
                </label>
                <input
                  type="text"
                  value={adsSettings.bot_ad_text || ''}
                  onChange={(e) => setAdsSettings({ ...adsSettings, bot_ad_text: e.target.value })}
                  placeholder="e.g. Join @OTP_LIFE_bot for live bonuses!"
                  className="w-full bg-[#FAF7F2] border border-[#EBE3D8] rounded-xl px-3 py-1.5 text-xs text-[#26160F] focus:outline-none focus:border-[#5C3824]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-[#4A2E1F] block mb-1">
                    Button Text:
                  </label>
                  <input
                    type="text"
                    value={adsSettings.bot_ad_button_text || ''}
                    onChange={(e) => setAdsSettings({ ...adsSettings, bot_ad_button_text: e.target.value })}
                    placeholder="📢 Official Channel"
                    className="w-full bg-[#FAF7F2] border border-[#EBE3D8] rounded-xl px-3 py-1.5 text-xs text-[#26160F] focus:outline-none focus:border-[#5C3824]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#4A2E1F] block mb-1">
                    Button URL (Direct Link / Channel):
                  </label>
                  <input
                    type="url"
                    value={adsSettings.bot_ad_button_url || ''}
                    onChange={(e) => setAdsSettings({ ...adsSettings, bot_ad_button_url: e.target.value })}
                    placeholder="https://t.me/..."
                    className="w-full bg-[#FAF7F2] border border-[#EBE3D8] rounded-xl px-3 py-1.5 text-xs text-[#26160F] font-mono focus:outline-none focus:border-[#5C3824]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveAds}
            disabled={isSavingAds}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#2D6A4F] to-[#1B4332] hover:brightness-110 active:scale-98 text-white font-extrabold text-sm shadow-xl shadow-[#2D6A4F]/20 transition-all flex items-center justify-center gap-2 border border-emerald-400/30"
          >
            <span>{isSavingAds ? 'Saving Changes...' : '💾 Save All Adsterra & Ad Settings'}</span>
          </button>
        </div>
      )}

      {/* Modal 1: Add New App Service */}
      {showAddServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-[#FFFFFF] border border-[#EBE3D8] rounded-3xl p-5 shadow-2xl space-y-4 animate-slide-up">
            <div className="flex items-center justify-between pb-2 border-b border-[#F0E8DE]">
              <h3 className="font-bold text-sm text-[#26160F] flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-[#5C3824]" />
                <span>Add New App Service</span>
              </h3>
              <button
                onClick={() => setShowAddServiceModal(false)}
                className="w-7 h-7 rounded-full bg-[#FAF7F2] text-[#826A5C] hover:text-[#26160F] flex items-center justify-center border border-[#EBE3D8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddService} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#4A2E1F] block mb-1.5">
                  Choose Icon / Emoji:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['📱', '💬', '✈️', '👥', '📞', '🟡', '🎵', '🔍', '🛒', '🤝', '👙', '😎', '🎮', '💎'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        setNewServiceIcon(emoji);
                      }}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-lg border transition-all ${
                        newServiceIcon === emoji ? 'bg-[#5C3824] text-white border-[#5C3824] shadow-md shadow-[#5C3824]/20' : 'bg-[#FAF7F2] border-[#EBE3D8]'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#4A2E1F] block mb-1">
                  Service Name:
                </label>
                <input
                  type="text"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="e.g. WhatsApp Pro, Imo VIP"
                  required
                  className="w-full bg-[#FAF7F2] border border-[#EBE3D8] rounded-xl px-3 py-2 text-sm text-[#26160F] focus:outline-none focus:border-[#5C3824]"
                />
              </div>

              <button
                type="submit"
                disabled={isActionLoading}
                className="w-full py-2.5 rounded-xl bg-[#5C3824] hover:bg-[#4A2E1F] active:scale-95 text-white font-bold text-xs shadow-md shadow-[#5C3824]/20 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isActionLoading ? 'Saving...' : 'Save Service'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Service Details & Range Management Modal */}
      {selectedService && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#FFFFFF] border-t sm:border border-[#EBE3D8] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4 animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#F0E8DE]">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-2 rounded-2xl bg-[#FAF7F2] border border-[#EBE3D8]">
                  {selectedService.icon}
                </span>
                <div>
                  <h3 className="font-bold text-base text-[#26160F] leading-tight">
                    {selectedService.name}
                  </h3>
                  <span className="text-[10px] text-[#826A5C] font-mono">
                    ID: {selectedService.id}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedService(null)}
                className="w-8 h-8 rounded-full bg-[#FAF7F2] text-[#826A5C] hover:text-[#26160F] flex items-center justify-center border border-[#EBE3D8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Currently Linked Ranges */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-[#4A2E1F] uppercase tracking-wider">
                  Linked Countries & Ranges
                </label>
                <span className="text-[11px] text-[#2D6A4F] font-bold">
                  {mappings.filter((m) => m.serviceId === selectedService.id).length} Linked
                </span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {mappings.filter((m) => m.serviceId === selectedService.id).length === 0 ? (
                  <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EBE3D8] text-center text-xs text-[#826A5C]">
                    No countries or ranges linked to this service yet. Link one below.
                  </div>
                ) : (
                  mappings
                    .filter((m) => m.serviceId === selectedService.id)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#EBE3D8] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl">{item.flag}</span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-[#26160F]">
                                {item.country || item.displayName}
                              </span>
                              <span className="text-[10px] text-[#826A5C] font-mono">
                                +{item.prefix}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-[#826A5C]">
                              <span>Rate: ৳{Number(item.rateBdt).toFixed(2)}/SMS</span>
                              <span className="text-[#2D6A4F] font-semibold">
                                ● {item.allocated} in stock
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleUnlinkRange(item.id)}
                          className="px-2 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold border border-rose-200 transition-colors flex items-center gap-1"
                          title="Unlink Range"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                          <span>Unlink</span>
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Link Range Toggle / Form */}
            {!showLinkRangeForm ? (
              <button
                onClick={() => {
                  triggerHaptic('medium');
                  setShowLinkRangeForm(true);
                }}
                className="w-full py-2.5 rounded-2xl bg-[#FAF7F2] hover:bg-[#F2ECE4] border border-[#EBE3D8] text-xs font-bold text-[#5C3824] flex items-center justify-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Link Number Pool Range</span>
              </button>
            ) : (
              <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#5C3824]/30 space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#EBE3D8]">
                  <span className="text-xs font-bold text-[#5C3824] flex items-center gap-1">
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Link Range Form</span>
                  </span>
                  <button
                    onClick={() => setShowLinkRangeForm(false)}
                    className="text-[10px] text-[#826A5C] hover:text-[#26160F]"
                  >
                    Close
                  </button>
                </div>

                {/* Range Selector */}
                <div>
                  <label className="text-[11px] font-bold text-[#4A2E1F] block mb-1">
                    Available Number Pool Range:
                  </label>
                  <select
                    value={selectedRangeId}
                    onChange={(e) => {
                      setSelectedRangeId(e.target.value);
                      const r = availableRanges.find((x) => x.range_id === e.target.value);
                      if (r) {
                        setLinkCountryName(r.country || 'Global');
                        setLinkRateBdt(String(r.default_rate || '0.80'));
                      }
                    }}
                    className="w-full bg-white border border-[#EBE3D8] rounded-xl px-2.5 py-2 text-xs text-[#26160F] focus:outline-none focus:border-[#5C3824]"
                  >
                    {availableRanges.map((r) => (
                      <option key={r.range_id} value={r.range_id}>
                        {r.range_name} ({r.country}) — Stock: {r.available_stock} (+{r.prefix})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Price in BDT */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-[#4A2E1F] block mb-1">
                      Rate per OTP (৳ BDT):
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={linkRateBdt}
                      onChange={(e) => setLinkRateBdt(e.target.value)}
                      placeholder="0.80"
                      className="w-full bg-white border border-[#EBE3D8] rounded-xl px-2.5 py-1.5 text-xs text-[#26160F] font-mono focus:outline-none focus:border-[#5C3824]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#4A2E1F] block mb-1">
                      Display Country / Name:
                    </label>
                    <input
                      type="text"
                      value={linkCountryName}
                      onChange={(e) => setLinkCountryName(e.target.value)}
                      placeholder="e.g. PHILIPPINES 🇵🇭"
                      className="w-full bg-white border border-[#EBE3D8] rounded-xl px-2.5 py-1.5 text-xs text-[#26160F] focus:outline-none focus:border-[#5C3824]"
                    />
                  </div>
                </div>

                <button
                  onClick={(e) => handleLinkRangeSubmit(e, selectedService.id)}
                  disabled={isActionLoading}
                  className="w-full py-2.5 rounded-xl bg-[#5C3824] hover:bg-[#4A2E1F] active:scale-95 text-white font-bold text-xs shadow-md shadow-[#5C3824]/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>{isActionLoading ? 'Linking...' : 'Confirm Link Range'}</span>
                </button>
              </div>
            )}

            {/* Danger Zone: Delete Service */}
            <div className="pt-3 border-t border-[#F0E8DE] flex items-center justify-between">
              <span className="text-[11px] text-[#826A5C]">
                Deleting this service removes all its mappings.
              </span>
              <button
                onClick={() => handleDeleteService(selectedService.id)}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Service</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Quick Link Range Modal (From Range Mapping Tab) */}
      {showQuickLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-[#FFFFFF] border border-[#EBE3D8] rounded-3xl p-5 shadow-2xl space-y-4 animate-slide-up">
            <div className="flex items-center justify-between pb-2 border-b border-[#F0E8DE]">
              <h3 className="font-bold text-sm text-[#26160F] flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-[#5C3824]" />
                <span>Link Range to Service</span>
              </h3>
              <button
                onClick={() => setShowQuickLinkModal(false)}
                className="w-7 h-7 rounded-full bg-[#FAF7F2] text-[#826A5C] hover:text-[#26160F] flex items-center justify-center border border-[#EBE3D8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#4A2E1F] block mb-1">
                  Select App Service:
                </label>
                <select
                  value={quickLinkServiceId}
                  onChange={(e) => setQuickLinkServiceId(e.target.value)}
                  className="w-full bg-[#FAF7F2] border border-[#EBE3D8] rounded-xl px-2.5 py-2 text-xs text-[#26160F] focus:outline-none focus:border-[#5C3824]"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.icon} {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#4A2E1F] block mb-1">
                  Available Number Pool Range:
                </label>
                <select
                  value={selectedRangeId}
                  onChange={(e) => {
                    setSelectedRangeId(e.target.value);
                    const r = availableRanges.find((x) => x.range_id === e.target.value);
                    if (r) {
                      setLinkCountryName(r.country || 'Global');
                      setLinkRateBdt(String(r.default_rate || '0.80'));
                    }
                  }}
                  className="w-full bg-[#FAF7F2] border border-[#EBE3D8] rounded-xl px-2.5 py-2 text-xs text-[#26160F] focus:outline-none focus:border-[#5C3824]"
                >
                  {availableRanges.map((r) => (
                    <option key={r.range_id} value={r.range_id}>
                      {r.range_name} ({r.country}) — Stock: {r.available_stock}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#4A2E1F] block mb-1">
                    Rate (৳ BDT):
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={linkRateBdt}
                    onChange={(e) => setLinkRateBdt(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#EBE3D8] rounded-xl px-2.5 py-1.5 text-xs text-[#26160F] font-mono focus:outline-none focus:border-[#5C3824]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#4A2E1F] block mb-1">
                    Display Country:
                  </label>
                  <input
                    type="text"
                    value={linkCountryName}
                    onChange={(e) => setLinkCountryName(e.target.value)}
                    placeholder="e.g. PHILIPPINES"
                    className="w-full bg-[#FAF7F2] border border-[#EBE3D8] rounded-xl px-2.5 py-1.5 text-xs text-[#26160F] focus:outline-none focus:border-[#5C3824]"
                  />
                </div>
              </div>

              <button
                onClick={(e) => handleLinkRangeSubmit(e, quickLinkServiceId)}
                disabled={isActionLoading}
                className="w-full py-2.5 rounded-xl bg-[#5C3824] hover:bg-[#4A2E1F] active:scale-95 text-white font-bold text-xs shadow-md shadow-[#5C3824]/20 transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isActionLoading ? 'Linking...' : 'Complete Mapping'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
