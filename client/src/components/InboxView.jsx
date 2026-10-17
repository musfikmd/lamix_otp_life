import React, { useState } from 'react';
import { useTelegram } from '../context/TelegramContext';
import { 
  Copy, 
  Check, 
  Clock, 
  Trash2, 
  MessageSquare,
  Phone
} from 'lucide-react';
import { BannerAd } from './BannerAd';

export const InboxView = ({ 
  activeNumbers = [], 
  smsMessages = [], 
  onReleaseNumber,
  ads = null
}) => {
  const { triggerHaptic } = useTelegram();
  const [copiedKey, setCopiedKey] = useState(null);
  const [stripPrefix, setStripPrefix] = useState(false);
  const [activeTab, setActiveTab] = useState(
    activeNumbers.length > 0 ? 'numbers' : (smsMessages.length > 0 ? 'otps' : 'numbers')
  );

  // Robust Copy helper with WebView fallback
  const handleCopy = (text, key) => {
    triggerHaptic('success');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
      } else {
        fallbackCopy(text);
      }
    } catch (e) {
      fallbackCopy(text);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fallbackCopy = (text) => {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    } catch (e) {}
  };

  const getRemainingMinutes = (expiresAt) => {
    if (!expiresAt) return '24h left';
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    if (hours > 0) {
      return `${hours}h ${mins}m left`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs} left`;
  };

  return (
    <div className="pb-24 pt-2 px-4 space-y-4">
      {/* Side-by-side Segmented Tab Switcher */}
      <div className="bg-[#FAF7F2] p-1.5 rounded-2xl border border-[#EBE3D8] flex items-center gap-1.5 shadow-sm">
        <button
          onClick={() => {
            triggerHaptic('selection');
            setActiveTab('numbers');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
            activeTab === 'numbers'
              ? 'bg-gradient-to-r from-[#4A2E1F] to-[#5C3824] text-white shadow-md shadow-[#5C3824]/20 scale-[1.01]'
              : 'text-[#826A5C] hover:text-[#4A2E1F] hover:bg-white/60'
          }`}
        >
          <Phone className="w-3.5 h-3.5" />
          <span>Active Numbers</span>
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
            activeTab === 'numbers' ? 'bg-white/20 text-white' : 'bg-[#5C3824]/10 text-[#5C3824]'
          }`}>
            {activeNumbers.length}
          </span>
        </button>

        <button
          onClick={() => {
            triggerHaptic('selection');
            setActiveTab('otps');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
            activeTab === 'otps'
              ? 'bg-gradient-to-r from-[#4A2E1F] to-[#5C3824] text-white shadow-md shadow-[#5C3824]/20 scale-[1.01]'
              : 'text-[#826A5C] hover:text-[#4A2E1F] hover:bg-white/60'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Received OTPs</span>
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
            activeTab === 'otps' ? 'bg-white/20 text-white' : 'bg-[#2D6A4F]/10 text-[#2D6A4F]'
          }`}>
            {smsMessages.length}
          </span>
        </button>
      </div>

      {/* Monetization / Sponsor Banner Ad */}
      <BannerAd ads={ads} slot="inbox" />

      {/* Active Numbers Section */}
      {activeTab === 'numbers' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#4A2E1F] uppercase tracking-wider">
                Claimed Numbers
              </h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#5C3824]/10 text-[#5C3824]">
                {activeNumbers.length}
              </span>
            </div>

          {/* Prefix toggle */}
          <button
            onClick={() => {
              triggerHaptic('selection');
              setStripPrefix(!stripPrefix);
            }}
            className="text-[11px] font-semibold text-[#826A5C] hover:text-[#4A2E1F] transition-colors flex items-center gap-1"
          >
            <span>{stripPrefix ? '✓ Local Number' : 'With Dial Code'}</span>
          </button>
        </div>

        {activeNumbers.length === 0 ? (
          <div className="p-6 rounded-3xl bg-[#FFFFFF] border border-[#EBE3D8] text-center shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF7F2] border border-[#EBE3D8] flex items-center justify-center mx-auto text-2xl text-[#826A5C] mb-2">
              📱
            </div>
            <h3 className="font-bold text-sm text-[#26160F]">
              No Active Numbers
            </h3>
            <p className="text-xs text-[#826A5C] mt-1 max-w-xs mx-auto">
              Tap the 'Services' tab to claim virtual numbers for WhatsApp, Telegram, or any platform.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeNumbers.map((item) => {
              const displayNum = stripPrefix ? (item.localNumber || item.number) : item.number;

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-3xl bg-[#FFFFFF] border border-[#EBE3D8] shadow-sm relative overflow-hidden"
                >
                  {/* Top info */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-[#F0E8DE]">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{item.flag}</span>
                      <span className="font-bold text-sm text-[#26160F]">
                        {item.serviceName}
                      </span>
                      <span className="text-[10px] text-[#6E442D] px-2 py-0.5 rounded-md bg-[#FAF7F2] font-semibold">
                        {item.country}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[#B87333] font-mono text-xs font-bold">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{getRemainingMinutes(item.expiresAt)}</span>
                    </div>
                  </div>

                  {/* Number Display & Copy Button */}
                  <div className="mt-3 flex items-center justify-between gap-2 bg-[#FAF7F2] p-2.5 rounded-2xl border border-[#EBE3D8]">
                    <div>
                      <span className="text-[10px] text-[#826A5C] uppercase block font-bold">
                        {stripPrefix ? 'Local Number' : 'International Number'}
                      </span>
                      <div className="text-base font-black text-[#26160F] font-mono tracking-wider mt-0.5">
                        +{displayNum.replace(/^\+/, '')}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopy(`+${displayNum.replace(/^\+/, '')}`, `num_${item.id}`)}
                        className="px-3 py-1.5 rounded-xl bg-[#5C3824] hover:bg-[#4A2E1F] active:scale-95 text-xs font-bold text-white flex items-center gap-1.5 shadow-md shadow-[#5C3824]/20 transition-all"
                      >
                        {copiedKey === `num_${item.id}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-300" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          triggerHaptic('error');
                          onReleaseNumber(item.id);
                        }}
                        className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 transition-colors"
                        title="Release / Cancel Number"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Status & Payout Rate */}
                  <div className="mt-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-[#826A5C]">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                      <span>Waiting for SMS...</span>
                    </div>
                    <div className="font-mono text-[#2D6A4F] font-black">
                      Rate: ৳{Number(item.payoutRate).toFixed(2)}/SMS
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Live SMS & OTP Inbox */}
      {activeTab === 'otps' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#5C3824]" />
              <h2 className="text-sm font-bold text-[#4A2E1F] uppercase tracking-wider">
                Incoming OTP Inbox ({smsMessages.length})
              </h2>
            </div>
          </div>

        {smsMessages.length === 0 ? (
          <div className="p-8 rounded-3xl bg-white border border-dashed border-[#EBE3D8] text-center">
            <MessageSquare className="w-8 h-8 text-[#B0A298] mx-auto mb-2" />
            <p className="text-xs text-[#826A5C]">No SMS or OTP messages received yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {smsMessages.map((sms) => (
              <div
                key={sms.id}
                className="p-4 rounded-3xl bg-[#FFFFFF] border border-[#EBE3D8] shadow-sm relative overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-[#F0E8DE]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#FAF7F2] text-[#5C3824] border border-[#EBE3D8]">
                      {sms.serviceName || sms.cli || 'SMS'}
                    </span>
                    <span className="text-xs text-[#826A5C] font-mono">
                      +{String(sms.number).replace(/^\+/, '')}
                    </span>
                  </div>

                  <div className="text-xs font-black text-[#2D6A4F] font-mono">
                    +৳{Number(sms.earned).toFixed(2)} Earned
                  </div>
                </div>

                {/* Message Text */}
                <p className="text-xs text-[#26160F] mt-2.5 leading-relaxed font-sans select-all">
                  {sms.text}
                </p>

                {/* Extracted OTP Badge */}
                {sms.code && (
                  <div className="mt-3 p-2.5 rounded-2xl bg-[#FAF7F2] border border-[#E5D9CB] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#826A5C] uppercase block font-bold">
                        OTP Code
                      </span>
                      <span className="text-xl font-black text-[#5C3824] font-mono tracking-widest">
                        {sms.code}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopy(sms.code, `otp_${sms.id}`)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#2D6A4F] hover:bg-[#1E4D38] active:scale-95 text-xs font-bold text-white flex items-center gap-1.5 shadow-md shadow-[#2D6A4F]/20 transition-all"
                    >
                      {copiedKey === `otp_${sms.id}` ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy OTP</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                <div className="mt-2 text-[10px] text-[#A8988C] text-right font-mono">
                  {new Date(sms.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
};
