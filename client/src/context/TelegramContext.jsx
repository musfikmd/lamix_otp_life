import React, { createContext, useContext, useEffect, useState } from 'react';

const TelegramContext = createContext(null);

export const TelegramProvider = ({ children }) => {
  const [tg, setTg] = useState(null);
  const [user, setUser] = useState({
    id: 0,
    first_name: 'Loading...',
    username: '',
    balance: 0.00,
    total_earnings: 0.00,
    total_withdrawn: 0.00,
    total_sms: 0,
    is_premium: false
  });
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    let currentTgUser = null;
    let initDataString = '';

    if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
      const webApp = window.Telegram.WebApp;
      setTg(webApp);
      webApp.ready();
      webApp.expand();

      if (webApp.initDataUnsafe && webApp.initDataUnsafe.user) {
        setIsTelegram(true);
        currentTgUser = webApp.initDataUnsafe.user;
        initDataString = webApp.initData || '';
      }

      try {
        webApp.setHeaderColor?.('#FAF7F2');
        webApp.setBackgroundColor?.('#FAF7F2');
      } catch (e) {
        console.error(e);
      }
    }

    // Fetch real profile from backend / Supabase
    fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: initDataString,
        user: currentTgUser || { id: 1001, first_name: 'User', username: 'user' }
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.user) {
          setUser({
            id: data.user.telegram_id,
            first_name: currentTgUser?.first_name || data.user.first_name || 'User',
            last_name: currentTgUser?.last_name || '',
            username: currentTgUser?.username || data.user.username || '',
            photo_url: currentTgUser?.photo_url || null,
            balance: parseFloat(data.user.balance) || 0.00,
            total_earnings: parseFloat(data.user.total_earnings) || 0.00,
            total_withdrawn: parseFloat(data.user.total_withdrawn) || 0.00,
            total_sms: parseInt(data.user.total_sms) || 0,
            is_premium: !!currentTgUser?.is_premium
          });
        }
      })
      .catch((err) => {
        console.error('Failed to sync user with backend:', err);
      });
  }, []);

  const triggerHaptic = (style = 'medium') => {
    try {
      if (tg && tg.HapticFeedback) {
        if (style === 'selection') {
          tg.HapticFeedback.selectionChanged();
        } else if (['light', 'medium', 'heavy', 'rigid', 'soft'].includes(style)) {
          tg.HapticFeedback.impactOccurred(style);
        } else if (['error', 'success', 'warning'].includes(style)) {
          tg.HapticFeedback.notificationOccurred(style);
        }
      }
    } catch (e) {
      console.warn('Haptic feedback error:', e);
    }
  };

  const closeApp = () => {
    if (tg) tg.close();
  };

  const openTelegramLink = (url) => {
    if (tg && tg.openTelegramLink) {
      tg.openTelegramLink(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <TelegramContext.Provider
      value={{
        tg,
        user,
        setUser,
        isTelegram,
        triggerHaptic,
        closeApp,
        openTelegramLink
      }}
    >
      {children}
    </TelegramContext.Provider>
  );
};

export const useTelegram = () => useContext(TelegramContext);
