import React from 'react';
import { useTelegram } from '../context/TelegramContext';
import { LayoutGrid, Inbox, Wallet, Users } from 'lucide-react';

export const BottomNav = ({ activeTab, setActiveTab, activeNumbersCount, smsCount = 0 }) => {
  const { triggerHaptic } = useTelegram();

  const tabs = [
    {
      id: 'services',
      label: 'Services',
      icon: LayoutGrid,
    },
    {
      id: 'inbox',
      label: 'Numbers & OTP',
      icon: Inbox,
      badge: activeNumbersCount > 0 ? activeNumbersCount : null,
      smsBadge: smsCount > 0 ? smsCount : null,
    },
    {
      id: 'wallet',
      label: 'Wallet',
      icon: Wallet,
    },
    {
      id: 'referral',
      label: 'Referrals',
      icon: Users,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-safe pt-2 bg-[#FAF7F2]/95 backdrop-blur-2xl border-t border-[#EBE3D8] shadow-lg shadow-[#4A2E1F]/5">
      <div className="max-w-md mx-auto grid grid-cols-4 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => {
                triggerHaptic('selection');
                setActiveTab(tab.id);
              }}
              className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 ${
                isActive
                  ? 'text-[#4A2E1F] bg-[#4A2E1F]/10 font-bold'
                  : 'text-[#826A5C] hover:text-[#4A2E1F] active:scale-95'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.5]' : 'stroke-2'}`} />
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-600 text-[10px] font-bold text-white flex items-center justify-center shadow-md animate-pulse">
                    {tab.badge}
                  </span>
                )}
                {tab.smsBadge && !tab.badge && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-[10px] font-bold text-white flex items-center justify-center shadow-md animate-pulse">
                    {tab.smsBadge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-1 tracking-tight truncate ${isActive ? 'font-bold text-[#4A2E1F]' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
