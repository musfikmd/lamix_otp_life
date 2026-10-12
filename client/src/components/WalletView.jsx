import React, { useState, useEffect } from 'react';
import { useTelegram } from '../context/TelegramContext';
import { WITHDRAWAL_METHODS } from '../data/servicesData';
import { 
  Wallet, 
  ArrowUpRight, 
  CreditCard, 
  AlertCircle, 
  CheckCircle2 
} from 'lucide-react';

export const WalletView = ({ onWithdrawSubmit }) => {
  const { user, setUser, triggerHaptic } = useTelegram();
  const [selectedMethod, setSelectedMethod] = useState(WITHDRAWAL_METHODS[0]);
  const [amount, setAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [withdrawals, setWithdrawals] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      setErrorMsg('Please enter a valid amount!');
      triggerHaptic('error');
      return;
    }

    if (withdrawAmount < selectedMethod.min) {
      setErrorMsg(`Minimum withdrawal for ${selectedMethod.name} is ৳${selectedMethod.min} BDT!`);
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

    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          amount: withdrawAmount,
          method: selectedMethod.name,
          walletAddress: walletAddress.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Withdrawal request failed!');
        triggerHaptic('error');
        return;
      }

      triggerHaptic('success');
      const newWd = {
        id: String(data.withdrawal.id),
        amount: withdrawAmount,
        method: selectedMethod.name,
        walletAddress: walletAddress.trim(),
        status: 'PENDING',
        date: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
      };

      setWithdrawals([newWd, ...withdrawals]);
      setSuccessMsg(`৳${withdrawAmount} BDT withdrawal request submitted! Payment will be sent upon admin approval.`);
      setAmount('');
      setWalletAddress('');

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

      {/* Withdrawal Form */}
      <div className="p-5 rounded-3xl bg-[#FFFFFF] border border-[#EBE3D8] shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#F0E8DE]">
          <h3 className="font-bold text-sm text-[#26160F] flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#5C3824]" />
            <span>Request Withdrawal</span>
          </h3>
          <span className="text-xs text-[#826A5C] font-semibold">
            Min ৳{selectedMethod.min}
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

        <form onSubmit={handleWithdraw} className="space-y-4">
          {/* Method selector */}
          <div>
            <label className="text-xs font-bold text-[#4A2E1F] block mb-2 uppercase tracking-wider">
              Select Payout Method
            </label>
            <div className="grid grid-cols-2 gap-2">
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
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'bg-[#FAF7F2] border-[#5C3824] shadow-sm'
                        : 'bg-[#FFFFFF] border-[#EBE3D8] hover:border-[#D5C6B6]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{method.icon}</span>
                      <div>
                        <div className="text-xs font-bold text-[#26160F]">
                          {method.name}
                        </div>
                        <div className="text-[10px] text-[#826A5C]">
                          Min: ৳{method.min}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="text-xs font-bold text-[#4A2E1F] block mb-1 uppercase tracking-wider">
              Amount (৳ BDT)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#826A5C]">
                ৳
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Min ${selectedMethod.min}`}
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
              placeholder="e.g. 017xxxxxxxx or Binance Pay ID"
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
    </div>
  );
};
