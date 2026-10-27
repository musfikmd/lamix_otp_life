import React, { useState, useEffect } from 'react';
import { useTelegram } from '../context/TelegramContext';
import { WITHDRAWAL_METHODS } from '../data/servicesData';
import { 
  Wallet, 
  ArrowUpRight, 
  CreditCard, 
  AlertCircle, 
  CheckCircle2,
  Sparkles,
  ExternalLink,
  X,
  ShieldCheck
} from 'lucide-react';
import { BannerAd } from './BannerAd';

export const WalletView = ({ onWithdrawSubmit, ads = null }) => {
  const { user, setUser, triggerHaptic } = useTelegram();
  const [selectedMethod, setSelectedMethod] = useState(WITHDRAWAL_METHODS[0]);
  const [amount, setAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [withdrawals, setWithdrawals] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Withdrawal Ad Modal State
  const [pendingWithdrawData, setPendingWithdrawData] = useState(null);
  const [showWithdrawAdModal, setShowWithdrawAdModal] = useState(false);
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);

  // Fetch real user withdrawals
  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/user-data?telegram_id=${user.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.withdrawals) {
          setWithdrawals(data.withdrawals);
        }
      })
      .catch(() => {});
  }, [user?.id]);

  const handleWithdrawInitiate = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    let withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      setErrorMsg('Please enter a valid amount!');
      triggerHaptic('error');
      return;
    }

    // Auto-convert if user entered in cents/USDT (e.g. 0.16 or 0.16 USDT)
    if (selectedMethod.id === 'binance' && withdrawAmount < 1 && withdrawAmount >= 0.10) {
      withdrawAmount = Number((withdrawAmount * 125).toFixed(2));
    }

    if (withdrawAmount < selectedMethod.min) {
      if (selectedMethod.id === 'binance') {
        setErrorMsg('Minimum withdrawal for Binance is ৳20 BDT (16¢ / $0.16 USDT)!');
      } else {
        setErrorMsg(`Minimum withdrawal for ${selectedMethod.name} is ৳${selectedMethod.min} BDT!`);
      }
      triggerHaptic('error');
      return;
    }

    if (withdrawAmount > (user?.balance || 0)) {
      setErrorMsg('Insufficient balance in your account!');
      triggerHaptic('error');
      return;
    }

    if (!walletAddress.trim()) {
      setErrorMsg('Please enter your wallet or account number!');
      triggerHaptic('error');
      return;
    }

    // Save pending details and open the sponsor ad verification modal!
    setPendingWithdrawData({
      withdrawAmount,
      method: selectedMethod.name,
      walletAddress: walletAddress.trim()
    });
    setShowWithdrawAdModal(true);
    triggerHaptic('medium');
  };

  const handleConfirmWithdrawWithAd = async (openAd = true) => {
    if (!pendingWithdrawData) return;
    const { withdrawAmount, method, walletAddress } = pendingWithdrawData;
    setIsSubmittingWithdraw(true);

    if (openAd) {
      triggerHaptic('heavy');
      const directLink = ads?.adsterra_direct_link || ads?.popup_cta_link || 'https://asiafilm.org/4/5119383ac8d97b3d9c83e75c3ce3e9b3';
      try {
        if (window.Telegram?.WebApp?.openLink) {
          window.Telegram.WebApp.openLink(directLink);
        } else if (window.Telegram?.WebApp?.openTelegramLink && directLink.includes('t.me')) {
          window.Telegram.WebApp.openTelegramLink(directLink);
        } else {
          window.open(directLink, '_blank');
        }
      } catch (err) {
        window.open(directLink, '_blank');
      }
    }

    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          amount: withdrawAmount,
          method,
          walletAddress
        })
      });

      const data = await res.json();
      setIsSubmittingWithdraw(false);
      setShowWithdrawAdModal(false);

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Withdrawal request failed!');
        triggerHaptic('error');
        return;
      }

      triggerHaptic('success');
      const newWd = {
        id: String(data.withdrawal.id),
        amount: withdrawAmount,
        method,
        walletAddress,
        status: 'PENDING',
        date: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
      };

      setWithdrawals([newWd, ...withdrawals]);
      setSuccessMsg(`৳${withdrawAmount} BDT withdrawal request submitted! Payment will be sent upon admin approval.`);
      setAmount('');
      setWalletAddress('');
      setPendingWithdrawData(null);

      if (setUser) {
        setUser((prev) => ({
          ...prev,
          balance: Math.max(0, prev.balance - withdrawAmount),
          total_withdrawn: (prev.total_withdrawn || 0) + withdrawAmount
        }));
      }

      if (onWithdrawSubmit) {
        onWithdrawSubmit(newWd);
      }
    } catch (err) {
      setIsSubmittingWithdraw(false);
      setShowWithdrawAdModal(false);
      setErrorMsg('Server connection error. Please try again!');
      triggerHaptic('error');
    }
  };

  return (
    <div className="pb-24 pt-2 px-4 space-y-4">
      {/* Balance Overview Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#4A2E1F] via-[#5C3824] to-[#3B2215] border border-[#6E442D] p-5 shadow-xl shadow-[#4A2E1F]/20 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center text-white">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-[#E8D7CC] uppercase tracking-wider">
              Available Balance
            </span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-white border border-white/20">
            Instant Payout
          </span>
        </div>

        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-3xl font-black text-white font-mono tracking-tight">
            ৳{Number(user?.balance || 0).toFixed(2)}
          </span>
          <span className="text-xs font-bold text-[#E8D7CC]">BDT</span>
        </div>

        {/* 3 Metrics Grid */}
        <div className="mt-4 pt-3 border-t border-white/15 grid grid-cols-3 gap-2 text-center">
          <div>
            <span className="text-[10px] text-[#E8D7CC] block">Total Earned</span>
            <div className="text-xs font-black text-emerald-300 font-mono mt-0.5">
              ৳{Number(user?.total_earnings || 0).toFixed(2)}
            </div>
          </div>
          <div className="border-x border-white/15">
            <span className="text-[10px] text-[#E8D7CC] block">Withdrawn</span>
            <div className="text-xs font-black text-white font-mono mt-0.5">
              ৳{Number(user?.total_withdrawn || 0).toFixed(2)}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-[#E8D7CC] block">Total SMS</span>
            <div className="text-xs font-black text-amber-300 font-mono mt-0.5">
              {user?.total_sms || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Monetization / Sponsor Banner Ad */}
      <BannerAd ads={ads} slot="wallet" />

      {/* Withdrawal Form */}
      <div className="p-5 rounded-3xl bg-[#FFFFFF] border border-[#EBE3D8] shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#F0E8DE]">
          <h3 className="font-bold text-sm text-[#26160F] flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#5C3824]" />
            <span>Request Withdrawal</span>
          </h3>
          <span className="text-xs text-[#826A5C] font-semibold">
            Min ৳{selectedMethod.min} {selectedMethod.id === 'binance' ? '($0.16 / 16¢)' : ''}
          </span>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleWithdrawInitiate} className="space-y-4">
          {/* Method selector */}
          <div>
            <label className="text-xs font-bold text-[#4A2E1F] block mb-2 uppercase tracking-wider">
              Payout Method
            </label>
            <div className="grid grid-cols-1 gap-2">
              {WITHDRAWAL_METHODS.map((method) => {
                const isSelected = selectedMethod.id === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setSelectedMethod(method);
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'bg-[#FAF7F2] border-[#5C3824] shadow-sm'
                        : 'bg-[#FFFFFF] border-[#EBE3D8] hover:border-[#D5C6B6]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{method.icon}</span>
                        <div>
                          <div className="text-sm font-bold text-[#26160F]">
                            {method.name}
                          </div>
                          <div className="text-xs text-[#826A5C]">
                            Min: ৳{method.min} <span className="text-amber-600 font-bold">(16¢ / $0.16 USDT)</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-900 border border-amber-400/30">
                        ⚡ Available
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#4A2E1F] uppercase tracking-wider">
                Amount (৳ BDT)
              </label>
              {selectedMethod.id === 'binance' && (
                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  ৳20 = 16¢ ($0.16 USDT)
                </span>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#826A5C]">
                ৳
              </span>
              <input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={selectedMethod.id === 'binance' ? 'Min 20 (or 16¢)' : `Min ${selectedMethod.min}`}
                className="w-full bg-[#FAF7F2] border border-[#EBE3D8] rounded-2xl pl-8 pr-20 py-2.5 text-sm text-[#26160F] font-mono focus:outline-none focus:border-[#5C3824] transition-colors"
              />
              <button
                type="button"
                onClick={() => setAmount(String(Math.floor(user?.balance || 0)))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#5C3824] px-2 py-1 rounded-lg bg-[#5C3824]/10 hover:bg-[#5C3824]/20"
              >
                Max All
              </button>
            </div>

            {/* Quick Chips */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {selectedMethod.id === 'binance' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setAmount('20');
                    }}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-xl transition-all ${
                      amount === '20'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-[#FAF7F2] border border-[#EBE3D8] text-[#5C3824] hover:bg-[#F3EFEA]'
                    }`}
                  >
                    ⚡ ৳20 (16¢)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setAmount('50');
                    }}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-xl transition-all ${
                      amount === '50'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-[#FAF7F2] border border-[#EBE3D8] text-[#5C3824] hover:bg-[#F3EFEA]'
                    }`}
                  >
                    ৳50 (40¢)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setAmount('100');
                    }}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-xl transition-all ${
                      amount === '100'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-[#FAF7F2] border border-[#EBE3D8] text-[#5C3824] hover:bg-[#F3EFEA]'
                    }`}
                  >
                    ৳100 (80¢)
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setAmount(String(selectedMethod.min));
                    }}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-[#FAF7F2] border border-[#EBE3D8] text-[#5C3824] hover:bg-[#F3EFEA]"
                  >
                    Min: ৳{selectedMethod.min}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setAmount('50');
                    }}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-[#FAF7F2] border border-[#EBE3D8] text-[#5C3824] hover:bg-[#F3EFEA]"
                  >
                    ৳50
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setAmount('100');
                    }}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-[#FAF7F2] border border-[#EBE3D8] text-[#5C3824] hover:bg-[#F3EFEA]"
                  >
                    ৳100
                  </button>
                </>
              )}
            </div>

            {/* Binance USDT Conversion Details Card */}
            {selectedMethod.id === 'binance' && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-center justify-between text-xs text-amber-900">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">🟡</span>
                  <div>
                    <span className="font-bold text-[11px] block text-amber-950">Binance Pay USDT Equivalent:</span>
                    <span className="font-mono font-black text-amber-800 text-xs">
                      {amount && Number(amount) > 0
                        ? `≈ $${(Number(amount) >= 1 ? Number(amount) / 125 : Number(amount)).toFixed(2)} USDT (${(Number(amount) >= 1 ? Number(amount) / 1.25 : Number(amount) * 100).toFixed(0)}¢)`
                        : '≈ $0.16 USDT (16 Cent) for ৳20'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-amber-700/80 block">Binance Rate:</span>
                  <span className="text-[10px] font-mono font-bold text-amber-900">1 USDT ≈ ৳125 BDT</span>
                </div>
              </div>
            )}
          </div>

          {/* Account Address / Number input */}
          <div>
            <label className="text-xs font-bold text-[#4A2E1F] block mb-1 uppercase tracking-wider">
              {selectedMethod.name} Account / Number
            </label>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder={selectedMethod.id === 'binance' ? 'e.g. Binance Pay ID (e.g. 123456789)' : 'e.g. 017xxxxxxxx'}
              className="w-full bg-[#FAF7F2] border border-[#EBE3D8] rounded-2xl px-3.5 py-2.5 text-sm text-[#26160F] font-mono focus:outline-none focus:border-[#5C3824] transition-colors"
            />
          </div>

          {/* Submit button */}
          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#4A2E1F] via-[#5C3824] to-[#784A33] hover:from-[#3D2518] hover:to-[#6E442D] active:scale-[0.98] text-white font-bold text-sm shadow-lg shadow-[#4A2E1F]/20 flex items-center justify-center gap-2 transition-all"
          >
            <span>Submit Withdrawal</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Withdrawal History */}
      <div>
        <h3 className="text-xs font-bold text-[#4A2E1F] uppercase tracking-wider mb-2.5">
          Recent Withdrawals ({withdrawals.length})
        </h3>

        {withdrawals.length === 0 ? (
          <div className="p-6 rounded-3xl bg-[#FFFFFF] border border-dashed border-[#EBE3D8] text-center text-xs text-[#826A5C]">
            No withdrawal history found.
          </div>
        ) : (
          <div className="space-y-2">
            {withdrawals.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-2xl bg-[#FFFFFF] border border-[#EBE3D8] flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-[#26160F] flex items-center gap-1.5">
                    <span>{item.method}</span>
                    <span className="font-mono text-[#826A5C]">({item.walletAddress})</span>
                  </div>
                  <span className="text-[10px] text-[#A8988C]">{item.date}</span>
                </div>

                <div className="text-right">
                  <div className="font-mono font-black text-[#5C3824]">
                    ৳{Number(item.amount).toFixed(2)}
                  </div>
                  {String(item.method).toLowerCase().includes('binance') && (
                    <div className="text-[10px] font-mono text-amber-700 font-bold">
                      ≈ ${(Number(item.amount) / 125).toFixed(2)} USDT ({(Number(item.amount) / 1.25).toFixed(0)}¢)
                    </div>
                  )}
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      item.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {item.status === 'APPROVED' ? 'PAID' : item.status === 'REJECTED' ? 'REFUNDED' : 'PENDING'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Withdrawal Sponsor Ad Verification Modal */}
      {showWithdrawAdModal && pendingWithdrawData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm bg-gradient-to-b from-[#2E190E] via-[#3B2215] to-[#26160F] border border-[#784A33]/50 rounded-3xl p-5 shadow-2xl space-y-4 text-white relative overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Withdrawal Sponsor Verification</span>
              </div>
              <button
                onClick={() => setShowWithdrawAdModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 text-stone-300 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-center py-1">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-300 flex items-center justify-center mx-auto text-xl">
                💳
              </div>
              <h3 className="text-base font-black text-white">
                Confirm ৳{pendingWithdrawData.withdrawAmount} BDT Payout
              </h3>
              {pendingWithdrawData.method.toLowerCase().includes('binance') && (
                <div className="inline-block text-xs text-amber-300 font-bold bg-amber-400/15 px-2.5 py-1 rounded-full border border-amber-400/30">
                  ≈ ${(pendingWithdrawData.withdrawAmount / 125).toFixed(2)} USDT ({(pendingWithdrawData.withdrawAmount / 1.25).toFixed(0)}¢)
                </div>
              )}
              <p className="text-xs text-[#E8D7CC] leading-relaxed">
                To process your withdrawal to <b>{pendingWithdrawData.method}</b> with <b>0% fee</b>, please view this sponsored partner offer to verify your request.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-stone-400 block">Payout Account:</span>
                <span className="font-mono font-bold text-amber-300">{pendingWithdrawData.walletAddress}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-stone-400 block">Amount:</span>
                <span className="font-mono font-bold text-emerald-400">৳{pendingWithdrawData.withdrawAmount} BDT</span>
                {pendingWithdrawData.method.toLowerCase().includes('binance') && (
                  <span className="text-[10px] font-mono font-bold text-amber-300 block">
                    ≈ ${(pendingWithdrawData.withdrawAmount / 125).toFixed(2)} USDT ({(pendingWithdrawData.withdrawAmount / 1.25).toFixed(0)}¢)
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => handleConfirmWithdrawWithAd(true)}
                disabled={isSubmittingWithdraw}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:brightness-110 active:scale-98 text-white font-extrabold text-xs shadow-xl shadow-amber-600/25 transition-all flex items-center justify-center gap-2 border border-amber-400/40"
              >
                <span>{isSubmittingWithdraw ? 'Processing Withdrawal...' : '🚀 View Sponsor & Submit Payout'}</span>
                <ExternalLink className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleConfirmWithdrawWithAd(false)}
                disabled={isSubmittingWithdraw}
                className="w-full py-1 text-center text-[11px] text-stone-400 hover:text-white transition-colors"
              >
                Submit without offer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
