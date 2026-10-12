import React from 'react';
import { useTelegram } from '../context/TelegramContext';
import { ChevronRight, Headphones } from 'lucide-react';

export const Header = ({ onOpenWallet }) => {
  const { user, triggerHaptic } = useTelegram();

  return (
    <header className="sticky top-0 z-30 px-4 pt-3 pb-3 bg-[#FAF7F2]/95 backdrop-blur-xl border-b border-[#EBE3D8]">
      <div className="flex items-center justify-between gap-2">
        {/* User Info */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#5C3824] via-[#8D5B4C] to-[#C48B5E] p-[2px] shadow-md shadow-[#5C3824]/20">
              {user?.photo_url ? (
                <img
                  src={user.photo_url}
                  alt={user.first_name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-[#EFE8DE] flex items-center justify-center font-bold text-[#5C3824] text-xs">
                  {user?.first_name?.charAt(0) || 'U'}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-bold text-xs text-[#26160F] tracking-tight leading-none truncate max-w-[100px]">
                {user?.first_name || 'User'}
              </h2>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-600/10 text-emerald-700 border border-emerald-600/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                Online
              </span>
            </div>
            <p className="text-[10px] text-[#7A6355] font-mono mt-0.5 truncate max-w-[100px]">
              @{user?.username || 'user'}
            </p>
          </div>
        </div>

        {/* Right buttons: Support & Balance */}
        <div className="flex items-center gap-1.5">
          <a
            href="https://t.me/prosmssupport"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => triggerHaptic('light')}
            className="w-8 h-8 rounded-xl bg-white border border-[#EBE3D8] text-[#5C3824] hover:bg-[#FAF7F2] active:scale-95 flex items-center justify-center shadow-sm transition-all"
            title="Support"
          >
            <Headphones className="w-4 h-4" />
          </a>

          <button
            onClick={() => {
              triggerHaptic('light');
              onOpenWallet();
            }}
            className="flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-2xl bg-gradient-to-r from-[#4A2E1F] to-[#5C3824] border border-[#6E442D] shadow-md shadow-[#4A2E1F]/20 hover:from-[#3D2518] hover:to-[#4E2E1D] active:scale-95 transition-all text-left group"
          >
            <div>
              <span className="text-[9px] text-[#E8D7CC] font-medium block leading-none">
                Balance
              </span>
              <div className="flex items-baseline gap-0.5 mt-0.5">
                <span className="text-sm font-black text-white tracking-tight leading-none font-mono">
                  ৳{Number(user?.balance || 0).toFixed(2)}
                </span>
              </div>
            </div>
            <div className="w-5 h-5 rounded-lg bg-white/15 text-white flex items-center justify-center group-hover:bg-white/25 transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
