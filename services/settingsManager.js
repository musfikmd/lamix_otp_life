'use strict';

const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'settings.json');

const DEFAULT_SETTINGS = {
  admin_password: 'WHALE@123',
  withdraw_enabled: true,
  min_withdraw: 20,
  support_username: 'OTP_LIFE_bot',
  ads: {
    popup_enabled: true,
    adsterra_direct_link: 'https://asiafilm.org/4/5119383ac8d97b3d9c83e75c3ce3e9b3',
    popup_title: '🔥 Claim Daily Bonus & VIP Rates!',
    popup_desc: 'Tap below to activate high-paying OTP rates, daily giveaways & 24/7 priority support.',
    popup_image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    popup_cta_text: '🚀 Claim Bonus Now',
    popup_cta_link: 'https://asiafilm.org/4/5119383ac8d97b3d9c83e75c3ce3e9b3',
    popup_countdown: 3,
    banner_enabled: true,
    banner_title: '💎 Sponsored Offer • High Payout',
    banner_desc: 'Highest BDT payout rates per SMS with instant auto withdrawal!',
    banner_cta_text: 'View Offer',
    banner_cta_link: 'https://asiafilm.org/4/5119383ac8d97b3d9c83e75c3ce3e9b3',
    cpm_views_enabled: false,
    cpm_script_src: '',
    adsterra_socialbar_src: '',
    adsterra_banner_key_320x50: '',
    bot_ad_enabled: false,
    bot_ad_text: 'Join @OTP_LIFE_bot for live updates & bonuses!',
    bot_ad_button_text: '📢 Join Official Channel',
    bot_ad_button_url: 'https://t.me/OTP_LIFE_bot'
  }
};

class SettingsManager {
  constructor() {
    this.settings = this.load();
  }

  load() {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          ads: {
            ...DEFAULT_SETTINGS.ads,
            ...(parsed.ads || {})
          }
        };
      }
    } catch (e) {
      console.error('Error loading settings:', e.message);
    }
    this.save(DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS };
  }

  save(data) {
    try {
      const dir = path.dirname(SETTINGS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
      this.settings = data;
    } catch (e) {
      console.error('Error saving settings:', e.message);
    }
  }

  get(key) {
    return this.settings[key] !== undefined ? this.settings[key] : DEFAULT_SETTINGS[key];
  }

  getAll() {
    return { ...this.settings };
  }

  set(key, value) {
    this.settings[key] = value;
    this.save(this.settings);
    return this.settings[key];
  }

  toggleWithdraw() {
    const current = this.get('withdraw_enabled');
    const updated = !current;
    this.set('withdraw_enabled', updated);
    return updated;
  }
}

const settingsManager = new SettingsManager();
module.exports = settingsManager;
