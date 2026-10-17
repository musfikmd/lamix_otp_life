import React, { useState, useEffect } from 'react';
import { useTelegram } from '../context/TelegramContext';
import { ExternalLink, X, Sparkles, ShieldCheck } from 'lucide-react';

export const AdPopupModal = ({ ads, onClose }) => {
  const { triggerHaptic } = useTelegram();
  const countdownDuration = typeof ads?.popup_countdown === 'number' ? ads.popup_countdown : 3;
  const [countdown, setCountdown] = useState(countdownDuration);
  const [canSkip, setCanSkip] = useState(countdownDuration <= 0);

  useEffect(() => {
    if (countdownDuration <= 0) {
      setCanSkip(true);
      return;
    }
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanSkip(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdownDuration]);

  const handleCtaClick = () => {
    triggerHaptic('heavy');
    const link = ads?.adsterra_direct_link || ads?.popup_cta_link || 'https://t.me/OTP_LIFE_bot';
    try {
      if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(link);
      } else if (window.Telegram?.WebApp?.openTelegramLink && link.includes('t.me')) {
        window.Telegram.WebApp.openTelegramLink(link);
      } else {
        window.open(link, '_blank');
      }
    } catch (e) {
      window.open(link, '_blank');
    }
  };

  const handleSkip = () => {
    if (!canSkip) return;
    triggerHaptic('light');
    onClose();
  };

  if (!ads || ads.popup_enabled === false) {
    return null;
  }

  const title = ads.popup_title || '🔥 Special Announcement';
  const desc = ads.popup_desc || 'Get live number restock alerts, special high-paying OTP rates & 24/7 priority admin support.';
  const image = ads.popup_image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80';
  const ctaText = ads.popup_cta_text || '🚀 Join Channel Now';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm bg-gradient-to-b from-[#2E190E] via-[#3B2215] to-[#26160F] border border-[#784A33]/50 rounded-3xl p-5 shadow-2xl space-y-4 text-white relative overflow-hidden animate-slide-up">
        {/* Glow ambient effect */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-[#784A33]/30 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header bar: Sponsored Badge & Skip/Timer */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[10px] font-black uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Sponsored Ad</span>
          </div>

          <button
            onClick={handleSkip}
            disabled={!canSkip}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 border ${
              canSkip
                ? 'bg-white/20 hover:bg-white/30 text-white border-white/30 active:scale-95 cursor-pointer'
                : 'bg-black/40 text-stone-400 border-white/10 cursor-not-allowed'
            }`}
          >
            {canSkip ? (
              <>
                <span>Skip</span>
                <X className="w-3.5 h-3.5" />
              </>
            ) : (
              <span>Skip in {countdown}s</span>
            )}
          </button>
        </div>

        {/* Ad Image / Banner */}
        <div className="relative z-10 w-full h-36 rounded-2xl overflow-hidden border border-white/10 shadow-lg group">
          <img
            src={image}
            alt="Sponsored Banner"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              e.currentTarget.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-3">
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-black/50 px-2 py-0.5 rounded-md backdrop-blur-sm">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Partner</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 space-y-1.5 text-center">
          <h3 className="text-base font-black text-white leading-snug tracking-tight">
            {title}
          </h3>
          <p className="text-xs text-[#E8D7CC] leading-relaxed px-1">
            {desc}
          </p>
        </div>

        {/* Action Button */}
        <div className="relative z-10 pt-1 space-y-2">
          <button
            onClick={handleCtaClick}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:brightness-110 active:scale-98 text-white font-extrabold text-sm shadow-xl shadow-amber-600/25 transition-all flex items-center justify-center gap-2 border border-amber-400/40"
          >
            <span>{ctaText}</span>
            <ExternalLink className="w-4 h-4" />
          </button>

          {canSkip && (
            <button
              onClick={handleSkip}
              className="w-full py-1.5 text-center text-xs font-medium text-stone-400 hover:text-white transition-colors"
            >
              Continue to OTP LIFE App
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
