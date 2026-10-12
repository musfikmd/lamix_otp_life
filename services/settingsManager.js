'use strict';

const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'settings.json');

const DEFAULT_SETTINGS = {
  admin_password: 'WHALE@123',
  withdraw_enabled: true,
  min_withdraw: 20,
  support_username: 'OTP_LIFE_bot'
};

class SettingsManager {
  constructor() {
    this.settings = this.load();
  }

  load() {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
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
