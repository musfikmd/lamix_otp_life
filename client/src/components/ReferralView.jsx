import React, { useState } from 'react';
import { useTelegram } from '../context/TelegramContext';
import { REFERRAL_MILESTONES } from '../data/servicesData';
import { 
  Gift, 
  Copy, 
  Check, 
  Share2, 
  Award
} from 'lucide-react';

export const ReferralView = () => {
  const { user, triggerHaptic, openTelegramLink } = useTelegram();
  const [copied, setCopied] = useState(false);

  const botUsername = 'OTP_LIFE_bot';
  const refLink = `https://t.me/${botUsername}?start=ref_${user?.id || '123'}`;

  const handleCopyLink = () => {
    triggerHaptic('success');
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareTelegram = () => {
    triggerHaptic('medium');
    const shareText = encodeURIComponent(
      `🔥 OTP LIFE — Earn cash receiving virtual OTPs and SMS online!\n\nJoin now: ${refLink}`
    );
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${shareText}`;
    openTelegramLink(tgUrl);
  };

  return (
    <div className="pb-24 pt-2 px-4 space-y-4">
      {/* Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#4A2E1F] via-[#5C3824] to-[#6E442D] border border-[#6E442D] p-5 shadow-xl shadow-[#4A2E1F]/20 text-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center text-white">
            <Gift className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-[#E8D7CC] uppercase tracking-wider">
            Referrals & Milestone Rewards
          </span>
        </div>

        <h2 className="text-xl font-black text-white mt-2 leading-tight">
          Invite friends & earn up to <span className="text-amber-300">৳10,000+</span> bonus
        </h2>
        <p className="text-xs text-[#E8D7CC] mt-1 leading-relaxed">
          Earn instant commissions directly into your balance for every member who joins using your link.
        </p>

        {/* Stats Grid */}
        <div className="mt-4 pt-3 border-t border-white/15 grid grid-cols-3 gap-2 text-center">
          <div>
            <span className="text-[10px] text-[#E8D7CC] block">Total Invites</span>
            <div className="text-sm font-black text-white font-mono mt-0.5">
              {user?.referral_count || 0}
            </div>
          </div>
          <div className="border-x border-white/15">
            <span className="text-[10px] text-[#E8D7CC] block">Active Users</span>
            <div className="text-sm font-black text-emerald-300 font-mono mt-0.5">
              {user?.active_referrals || 0}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-[#E8D7CC] block">Total Earned</span>
            <div className="text-sm font-black text-amber-300 font-mono mt-0.5">
              ৳{Number(user?.referral_earnings || 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Referral Link Box */}
      <div className="p-4 rounded-3xl bg-[#FFFFFF] border border-[#EBE3D8] shadow-sm space-y-3">
        <label className="text-xs font-bold text-[#4A2E1F] block">
          Your Unique Referral Link:
        </label>
        
        <div className="p-2.5 rounded-2xl bg-[#FAF7F2] border border-[#EBE3D8] flex items-center justify-between gap-2">
          <span className="text-xs text-[#5C3824] font-mono truncate font-semibold">
            {refLink}
          </span>
          <button
            onClick={handleCopyLink}
            className="p-2 rounded-xl bg-[#5C3824] hover:bg-[#4A2E1F] text-white shrink-0 active:scale-95 transition-all shadow-sm"
            title="Copy Link"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={handleCopyLink}
            className="py-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#F2ECE4] border border-[#EBE3D8] text-xs font-bold text-[#5C3824] flex items-center justify-center gap-1.5 transition-all"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          <button
            onClick={handleShareTelegram}
            className="py-2.5 rounded-xl bg-[#5C3824] hover:bg-[#4A2E1F] text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow-md shadow-[#5C3824]/20 transition-all active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span>Share on Telegram</span>
          </button>
        </div>
      </div>

      {/* Milestone Rewards */}
      <div className="p-4 rounded-3xl bg-[#FFFFFF] border border-[#EBE3D8] shadow-sm space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-[#F0E8DE]">
          <Award className="w-4 h-4 text-[#5C3824]" />
          <h3 className="font-bold text-xs text-[#26160F] uppercase tracking-wider">
            Referral Milestones
          </h3>
        </div>

        <div className="space-y-2">
          {REFERRAL_MILESTONES.map((m, idx) => {
            const isUnlocked = (user?.active_referrals || 0) >= m.target;
            return (
              <div
                key={idx}
                className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                  isUnlocked
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-[#FAF7F2] border-[#EBE3D8]'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-[#26160F]">{m.desc}</div>
                  <div className="text-[10px] text-[#826A5C] mt-0.5">
                    Target: {m.target} Active Friends
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-black text-[#5C3824] font-mono">
                    +৳{m.reward.toLocaleString()} BDT
                  </div>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                      isUnlocked ? 'text-emerald-700 bg-emerald-100' : 'text-[#826A5C] bg-white'
                    }`}
                  >
                    {isUnlocked ? 'Unlocked' : 'Locked'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
