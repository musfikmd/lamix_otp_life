import React, { useState, useMemo } from 'react';
import { useTelegram } from '../context/TelegramContext';
import { 
  Copy, 
  Check, 
  Clock, 
  Trash2, 
  MessageSquare,
  Phone,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers
} from 'lucide-react';
import { BannerAd } from './BannerAd';

export const InboxView = ({ 
  activeNumbers = [], 
  smsMessages = [], 
  onReleaseNumber,
  onGoToServices,
  ads = null
}) => {
  const { triggerHaptic } = useTelegram();
  const [copiedKey, setCopiedKey] = useState(null);
  const [stripPrefix, setStripPrefix] = useState(false);
  const [selectedService, setSelectedService] = useState('all');
  const [collapsedServices, setCollapsedServices] = useState({});
  const [activeTab, setActiveTab] = useState(
    activeNumbers.length > 0 ? 'numbers' : (smsMessages.length > 0 ? 'otps' : 'numbers')
  );

  // Group active numbers by service name & compute statistics
  const serviceGroups = useMemo(() => {
    const map = new Map();

    for (const item of activeNumbers) {
      const rawName = (item.serviceName || 'General Service').trim();
      const iconMatch = rawName.match(/[\p{Emoji}\u200d]+/u);
      const icon = item.serviceIcon || (iconMatch ? iconMatch[0] : '📱');
      const cleanName = rawName.replace(/[\p{Emoji}\u200d]+/u, '').trim() || rawName;
      const groupKey = rawName.toLowerCase();

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          key: groupKey,
          name: cleanName,
          rawName: rawName,
          icon: icon,
          numbers: [],
          totalNumbers: 0,
          avgRate: item.payoutRate || 0.80
        });
      }

      const g = map.get(groupKey);
      g.numbers.push(item);
      g.totalNumbers++;
      if (item.payoutRate) {
        g.avgRate = item.payoutRate;
      }
    }

    return Array.from(map.values());
  }, [activeNumbers]);

  // Filter groups if a specific service filter is active
  const filteredGroups = useMemo(() => {
    if (selectedService === 'all') return serviceGroups;
    return serviceGroups.filter(g => g.key === selectedService);
  }, [serviceGroups, selectedService]);

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

  // Copy all numbers in a service separated by newline
  const handleCopyAll = (numbers, groupKey) => {
    triggerHaptic('success');
    const textToCopy = numbers
      .map((item) => {
        const displayNum = stripPrefix ? (item.localNumber || item.number) : item.number;
        return `+${String(displayNum).replace(/^\+/, '')}`;
      })
      .join('\n');
    handleCopy(textToCopy, `all_${groupKey}`);
  };

  const toggleCollapse = (groupKey) => {
    triggerHaptic('selection');
    setCollapsedServices((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
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

      {/* 1. Active Numbers (Service-Wise Grouped) */}
      {activeTab === 'numbers' && (
        <div className="space-y-3.5">
          {/* Header Row: Title & Local/Dial Code Switch */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#5C3824]" />
              <h2 className="text-xs font-black text-[#4A2E1F] uppercase tracking-wider">
                Services & Numbers
              </h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#5C3824]/10 text-[#5C3824]">
                {activeNumbers.length} Total
              </span>
            </div>

            {/* Prefix toggle */}
            <button
              onClick={() => {
                triggerHaptic('selection');
                setStripPrefix(!stripPrefix);
              }}
              className="text-[11px] font-semibold text-[#826A5C] hover:text-[#4A2E1F] transition-colors flex items-center gap-1 bg-[#FAF7F2] px-2 py-1 rounded-lg border border-[#EBE3D8]"
            >
              <span>{stripPrefix ? '✓ Local Number' : 'With Dial Code'}</span>
            </button>
          </div>

          {/* Quick Service Filter Chips (when more than 1 service exists) */}
          {serviceGroups.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <button
                onClick={() => {
                  triggerHaptic('selection');
                  setSelectedService('all');
                }}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedService === 'all'
                    ? 'bg-[#5C3824] text-white shadow-xs'
                    : 'bg-[#FAF7F2] text-[#826A5C] border border-[#EBE3D8] hover:border-[#5C3824]'
                }`}
              >
                <span>✨ All Services</span>
                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                  selectedService === 'all' ? 'bg-white/25 text-white' : 'bg-[#5C3824]/10 text-[#5C3824]'
                }`}>
                  {activeNumbers.length}
                </span>
              </button>

              {serviceGroups.map((group) => {
                const isSelected = selectedService === group.key;
                return (
                  <button
                    key={group.key}
                    onClick={() => {
                      triggerHaptic('selection');
                      setSelectedService(group.key);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#5C3824] text-white shadow-xs'
                        : 'bg-[#FAF7F2] text-[#826A5C] border border-[#EBE3D8] hover:border-[#5C3824]'
                    }`}
                  >
                    <span>{group.icon}</span>
                    <span>{group.name}</span>
                    <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-[#5C3824]/10 text-[#5C3824]'
                    }`}>
                      {group.numbers.length}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {activeNumbers.length === 0 ? (
            <div className="p-7 rounded-3xl bg-[#FFFFFF] border border-[#EBE3D8] text-center shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-[#FAF7F2] border border-[#EBE3D8] flex items-center justify-center mx-auto text-3xl mb-3 shadow-xs">
                📱
              </div>
              <h3 className="font-extrabold text-base text-[#26160F]">
                No Active Numbers
              </h3>
              <p className="text-xs text-[#826A5C] mt-1.5 max-w-xs mx-auto leading-relaxed">
                You haven't claimed any virtual numbers yet. Go to the Services tab to claim numbers for Shopee, Telegram, WhatsApp, or any platform.
              </p>
              {onGoToServices && (
                <button
                  onClick={() => {
                    triggerHaptic('medium');
                    onGoToServices();
                  }}
                  className="mt-4 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#4A2E1F] to-[#5C3824] text-white text-xs font-bold shadow-md shadow-[#5C3824]/20 active:scale-95 transition-all inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Claim a Service Number</span>
                </button>
              )}
            </div>
          ) : (
            /* Service-Wise Grouped Container */
            <div className="space-y-3.5">
              {filteredGroups.map((group) => {
                const isCollapsed = Boolean(collapsedServices[group.key]);

                return (
                  <div
                    key={group.key}
                    className="rounded-3xl bg-[#FFFFFF] border border-[#EBE3D8] shadow-sm overflow-hidden transition-all"
                  >
                    {/* Service Group Header */}
                    <div 
                      onClick={() => toggleCollapse(group.key)}
                      className="p-3.5 bg-gradient-to-r from-[#FAF7F2] via-[#FAF7F2] to-[#FFFFFF] border-b border-[#F0E8DE] flex items-center justify-between cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-white border border-[#EBE3D8] flex items-center justify-center text-xl shadow-xs shrink-0">
                          {group.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-sm text-[#26160F] leading-tight">
                              {group.name}
                            </h3>
                            <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-[#5C3824] text-white shadow-xs">
                              {group.numbers.length} {group.numbers.length === 1 ? 'Number' : 'Numbers'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#826A5C]">
                            <span className="font-mono text-[#2D6A4F] font-black">
                              ৳{Number(group.avgRate).toFixed(2)}/SMS
                            </span>
                            <span>•</span>
                            <span className="text-[10px]">
                              {isCollapsed ? 'Tap to expand' : 'Tap to collapse'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {/* Quick Copy All Numbers in this Service */}
                        <button
                          onClick={() => handleCopyAll(group.numbers, group.key)}
                          className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#FAF7F2] active:scale-95 border border-[#EBE3D8] text-[11px] font-bold text-[#5C3824] flex items-center gap-1 shadow-xs transition-all"
                          title="Copy all numbers for this service"
                        >
                          {copiedKey === `all_${group.key}` ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">Copied All</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-[#5C3824]" />
                              <span>Copy All ({group.numbers.length})</span>
                            </>
                          )}
                        </button>

                        {/* Expand / Collapse Chevron */}
                        <button
                          onClick={() => toggleCollapse(group.key)}
                          className="w-8 h-8 rounded-xl bg-white border border-[#EBE3D8] flex items-center justify-center text-[#826A5C] hover:text-[#26160F] transition-all"
                        >
                          {isCollapsed ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Numbers List for this Service */}
                    {!isCollapsed && (
                      <div className="p-3 space-y-2.5 bg-[#FAF7F2]/40">
                        {group.numbers.map((item) => {
                          const displayNum = stripPrefix ? (item.localNumber || item.number) : item.number;

                          return (
                            <div
                              key={item.id}
                              className="p-3.5 rounded-2xl bg-white border border-[#EBE3D8] shadow-xs hover:border-[#D5C6B6] transition-all"
                            >
                              {/* Country & Remaining Time */}
                              <div className="flex items-center justify-between pb-2 border-b border-[#F5EFE7]">
                                <div className="flex items-center gap-2">
                                  <span className="text-base">{item.flag || '🌍'}</span>
                                  <span className="text-xs font-bold text-[#4A2E1F]">
                                    {item.country || 'Global'}
                                  </span>
                                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#FAF7F2] text-[#826A5C] border border-[#EBE3D8]">
                                    {item.dialCode || '+'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 text-[#B87333] font-mono text-[11px] font-bold">
                                  <Clock className="w-3 h-3" />
                                  <span>{getRemainingMinutes(item.expiresAt)}</span>
                                </div>
                              </div>

                              {/* Number & Copy / Trash Actions */}
                              <div className="mt-2.5 flex items-center justify-between gap-2 bg-[#FAF7F2] p-2.5 rounded-xl border border-[#EBE3D8]">
                                <div className="min-w-0">
                                  <span className="text-[9px] text-[#826A5C] uppercase block font-bold tracking-wider">
                                    {stripPrefix ? 'Local Number' : 'International Number'}
                                  </span>
                                  <div className="text-sm font-black text-[#26160F] font-mono tracking-wider mt-0.5 truncate">
                                    +{String(displayNum).replace(/^\+/, '')}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => handleCopy(`+${String(displayNum).replace(/^\+/, '')}`, `num_${item.id}`)}
                                    className="px-3 py-1.5 rounded-xl bg-[#5C3824] hover:bg-[#4A2E1F] active:scale-95 text-xs font-bold text-white flex items-center gap-1.5 shadow-sm shadow-[#5C3824]/20 transition-all"
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
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Footer: Live Pulse & Payout Rate */}
                              <div className="mt-2 flex items-center justify-between text-[11px]">
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
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. Live SMS & OTP Inbox */}
      {activeTab === 'otps' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#5C3824]" />
              <h2 className="text-xs font-black text-[#4A2E1F] uppercase tracking-wider">
                Incoming OTP Inbox
              </h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#2D6A4F]/10 text-[#2D6A4F]">
                {smsMessages.length} Messages
              </span>
            </div>
          </div>

          {smsMessages.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white border border-dashed border-[#EBE3D8] text-center">
              <MessageSquare className="w-8 h-8 text-[#B0A298] mx-auto mb-2" />
              <p className="text-xs text-[#826A5C]">No SMS or OTP messages received yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {smsMessages.map((sms) => {
                const sName = sms.serviceName || sms.cli || 'SMS';
                const iconMatch = sName.match(/[\p{Emoji}\u200d]+/u);
                const icon = iconMatch ? iconMatch[0] : '📱';

                return (
                  <div
                    key={sms.id}
                    className="p-4 rounded-3xl bg-[#FFFFFF] border border-[#EBE3D8] shadow-sm relative overflow-hidden"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-[#F0E8DE]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#FAF7F2] text-[#5C3824] border border-[#EBE3D8] flex items-center gap-1">
                          <span>{icon}</span>
                          <span>{sName}</span>
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
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
