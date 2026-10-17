import React, { useState } from 'react';
import { useTelegram } from '../context/TelegramContext';
import { AdsterraBanner } from './AdsterraBanner';
import { ExternalLink, Sparkles, X } from 'lucide-react';

export const BannerAd = ({ ads = null, slot = 'general' }) => {
  const { triggerHaptic } = useTelegram();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // If ads explicitly disabled
  if (ads && ads.banner_enabled === false) return null;

  const bannerKey = ads?.adsterra_banner_key_320x50 || ads?.adsterra_banner_key || '';
  const directLink = ads?.adsterra_direct_link || ads?.banner_cta_link || 'https://t.me/OTP_LIFE_bot';
  const title = ads?.banner_title || '🔥 Earn More with VIP Rates';
  const desc = ads?.banner_desc || 'High paying OTP allocation with instant auto BDT withdrawal.';
  const ctaText = ads?.banner_cta_text || 'Check Now';

  // If Adsterra direct banner key is configured, render real Adsterra script banner
  if (bannerKey) {
    return (
      <div className="relative w-full my-2">
        <AdsterraBanner adKey={bannerKey} width={320} height={50} />
      </div>
    );
  }

  // Otherwise render an Adsterra Smartlink/Direct Link interactive banner card
  const handleOpenAd = () => {
    triggerHaptic('medium');
    try {
      if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(directLink);
      } else if (window.Telegram?.WebApp?.openTelegramLink && directLink.includes('t.me')) {
        window.Telegram.WebApp.openTelegramLink(directLink);
      } else {
        window.open(directLink, '_blank');
      }
    } catch (e) {
      window.open(directLink, '_blank');
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#3B2215] via-[#4A2E1F] to-[#5C3824] border border-[#784A33]/50 p-3 shadow-md shadow-[#4A2E1F]/15 text-white my-3 animate-fade-in">
      {/* Subtle Glow */}
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-500/15 rounded-full blur-xl pointer-events-none" />

      <div className="relative z-10 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0" onClick={handleOpenAd} role="button">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-amber-300 bg-black/30 px-1.5 py-0.5 rounded border border-amber-400/20 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              <span>SPONSORED</span>
            </span>
          </div>
          <h4 className="text-xs font-bold text-white truncate leading-tight">
            {title}
          </h4>
          <p className="text-[10px] text-[#E8D7CC] truncate mt-0.5">
            {desc}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleOpenAd}
            className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 active:scale-95 text-white text-[11px] font-extrabold shadow-sm transition-all flex items-center gap-1"
          >
            <span>{ctaText}</span>
            <ExternalLink className="w-3 h-3" />
          </button>

          <button
            onClick={() => setDismissed(true)}
            className="w-5 h-5 rounded-full bg-black/20 hover:bg-black/40 text-stone-300 flex items-center justify-center transition-colors"
            title="Dismiss"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
