'use strict';

const axios = require('axios');

// Country Flag & 2-Letter ISO Map (Reference: SMS Hadi production)
const COUNTRY_FLAGS = {
  philippines: '🇵🇭', myanmar: '🇲🇲', bangladesh: '🇧🇩', india: '🇮🇳', pakistan: '🇵🇰',
  indonesia: '🇮🇩', vietnam: '🇻🇳', thailand: '🇹🇭', malaysia: '🇲🇾', cambodia: '🇰🇭',
  laos: '🇱🇦', ethiopia: '🇪🇹', nigeria: '🇳🇬', kenya: '🇰🇪', tanzania: '🇹🇿',
  uganda: '🇺🇬', ghana: '🇬🇭', cameroon: '🇨🇲', senegal: '🇸🇳', morocco: '🇲🇦',
  algeria: '🇩🇿', egypt: '🇪🇬', ukraine: '🇺🇦', georgia: '🇬🇪', moldova: '🇲🇩',
  ecuador: '🇪🇨', venezuela: '🇻🇪', zambia: '🇿🇲', zimbabwe: '🇿🇼', rwanda: '🇷🇼',
  uzbekistan: '🇺🇿', kazakhstan: '🇰🇿', russia: '🇷🇺', turkey: '🇹🇷', default: '🌍'
};

const COUNTRY_2LETTER_CODES = {
  philippines: 'PH', myanmar: 'MM', bangladesh: 'BD', india: 'IN', pakistan: 'PK',
  indonesia: 'ID', vietnam: 'VN', thailand: 'TH', malaysia: 'MY', cambodia: 'KH',
  laos: 'LA', ethiopia: 'ET', nigeria: 'NG', kenya: 'KE', tanzania: 'TZ',
  uganda: 'UG', ghana: 'GH', cameroon: 'CM', senegal: 'SN', morocco: 'MA',
  algeria: 'DZ', egypt: 'EG', ukraine: 'UA', georgia: 'GE', moldova: 'MD',
  ecuador: 'EC', venezuela: 'VE', zambia: 'ZM', zimbabwe: 'ZW', rwanda: 'RW',
  uzbekistan: 'UZ', kazakhstan: 'KZ', russia: 'RU', turkey: 'TR'
};

const PHONE_PREFIX_COUNTRY = {
  '880': 'Bangladesh',
  '91': 'India',
  '92': 'Pakistan',
  '62': 'Indonesia',
  '63': 'Philippines',
  '84': 'Vietnam',
  '66': 'Thailand',
  '60': 'Malaysia',
  '855': 'Cambodia',
  '856': 'Laos',
  '95': 'Myanmar',
  '977': 'Nepal',
  '251': 'Ethiopia',
  '234': 'Nigeria',
  '254': 'Kenya',
  '213': 'Algeria',
  '212': 'Morocco',
  '20': 'Egypt',
  '998': 'Uzbekistan',
  '7': 'Russia',
  '90': 'Turkey',
  '380': 'Ukraine'
};

const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

class FeedService {
  constructor() {
    this.reloadConfig();
    this.sentKeys = new Set();
  }

  reloadConfig() {
    this.botToken = (process.env.FEED_BOT_TOKEN || '8868411204:AAEbuUOoWF0SB4s8k_TpSPWa67ygEqv01uw').trim();
    this.channelId = (process.env.SMS_FEED_CHANNEL_ID || process.env.FEED_CHANNEL_ID || '-1003707025386').trim();
    this.numberBotUrl = (process.env.NUMBER_BOT_URL || 'https://t.me/Pro_SMS_Panel_bot').trim();
    this.mainChannelUrl = (process.env.MAIN_CHANNEL_URL || 'https://t.me/prosmspanel').trim();
  }

  isConfigured() {
    this.reloadConfig();
    return Boolean(this.botToken && this.channelId && this.channelId !== 'off');
  }

  // Exact masking matching SMS Hadi (server.js:72)
  maskPhoneNumber(val) {
    const digits = String(val || '').replace(/\D/g, '');
    if (digits.length <= 6) return digits;
    const head = digits.slice(0, Math.min(5, Math.floor(digits.length / 2) - 1));
    const tail = digits.slice(-4);
    return `${head}****${tail}`;
  }

  // Exact OTP extraction matching SMS Hadi (server.js:332)
  extractOtpCode(smsText) {
    if (!smsText) return null;
    const numMatch = smsText.match(/\b\d{3}[-\s]?\d{3,4}\b/) || smsText.match(/\b\d{3,10}\b/);
    if (numMatch) return numMatch[0].replace(/\D/g, '');

    const alphaMatch = smsText.match(/\b[A-Z0-9]{1,4}[-\s]?[A-Z0-9]{3,8}\b/i);
    if (alphaMatch && /[0-9]/.test(alphaMatch[0]) && alphaMatch[0].length <= 12) {
      return alphaMatch[0].trim();
    }
    return null;
  }

  // Country extraction matching SMS Hadi (numberPool.js:125)
  extractCountry(rangeTitle, sampleNumber = '') {
    const lower = (rangeTitle || '').toLowerCase();
    for (const key of Object.keys(COUNTRY_FLAGS)) {
      if (key !== 'default' && lower.includes(key)) {
        return key.charAt(0).toUpperCase() + key.slice(1);
      }
    }
    const digits = String(sampleNumber || '').replace(/^\+/, '').replace(/\D/g, '');
    if (digits) {
      for (const len of [3, 2, 1]) {
        const prefix = digits.slice(0, len);
        if (PHONE_PREFIX_COUNTRY[prefix]) return PHONE_PREFIX_COUNTRY[prefix];
      }
    }
    const firstWord = (rangeTitle || '').trim().split(/[\s,\-_]+/)[0] || 'Global';
    if (/^\d+$/.test(firstWord) && PHONE_PREFIX_COUNTRY[firstWord]) {
      return PHONE_PREFIX_COUNTRY[firstWord];
    }
    return 'Global';
  }

  getCountryCode2Letter(countryName) {
    const key = (countryName || '').toLowerCase();
    return COUNTRY_2LETTER_CODES[key] || 'GL';
  }

  getFlag(country) {
    const key = (country || '').toLowerCase();
    return COUNTRY_FLAGS[key] || COUNTRY_FLAGS['default'];
  }

  // Exact service name detection matching SMS Hadi (server.js:348)
  extractServiceName(smsText, cli, cleanRange) {
    const text = `${smsText || ''} ${cli || ''}`;
    const lower = text.toLowerCase();

    if (lower.includes('shopee')) return 'Shopee';
    if (lower.includes('facebook') || lower.includes('fb-') || lower.includes('fbcode')) return 'Facebook';
    if (lower.includes('whatsapp')) return 'WhatsApp';
    if (lower.includes('telegram')) return 'Telegram';
    if (lower.includes('tiktok')) return 'TikTok';
    if (lower.includes('google')) return 'Google';
    if (lower.includes('imo')) return 'Imo';
    if (lower.includes('paypal')) return 'PayPal';
    if (lower.includes('discord')) return 'Discord';
    if (lower.includes('apple')) return 'Apple';
    if (lower.includes('hsbc')) return 'HSBC';
    if (lower.includes('biamo')) return 'Biamo';
    if (lower.includes('viber')) return 'Viber';
    if (lower.includes('line')) return 'LINE';
    if (lower.includes('signal')) return 'Signal';
    if (lower.includes('megapari')) return 'Megapari';
    if (lower.includes('atome')) return 'Atome';
    if (lower.includes('binance')) return 'Binance';
    if (lower.includes('bkash')) return 'bKash';
    if (lower.includes('nagad')) return 'Nagad';

    if (cli && /^[A-Za-z0-9_-]{3,15}$/.test(cli.trim()) && !/^\d+$/.test(cli.trim())) {
      const cleanCli = cli.trim();
      if (!/auth|info|verify|notice|msg|sms/i.test(cleanCli)) {
        return cleanCli.charAt(0).toUpperCase() + cleanCli.slice(1).toLowerCase();
      }
    }

    if (cleanRange && cleanRange !== 'SMS Service' && cleanRange !== 'General') {
      const clean = cleanRange.replace(/[\p{Emoji}\u200d]+/gu, '').trim();
      if (clean) return clean;
    }

    return 'OTP';
  }

  // Exact feed broadcast method matching SMS Hadi (server.js:380-415)
  async sendToFeed({ number, cli, content, otp = null, rangeName = '', country = '', retries = 3 }) {
    if (!this.isConfigured()) return false;

    const cleanNum = String(number || '').replace(/\D/g, '');
    const cleanMsg = String(content || '').replace(/[\r\n]+/g, ' ').trim();
    if (!cleanNum || !cleanMsg) return false;

    // Deduplication check
    const dedupKey = `${cleanNum}_${cleanMsg.slice(0, 30)}`;
    if (this.sentKeys.has(dedupKey)) {
      return false;
    }
    this.sentKeys.add(dedupKey);

    if (this.sentKeys.size > 10000) {
      const arr = Array.from(this.sentKeys);
      this.sentKeys = new Set(arr.slice(5000));
    }

    const detectedCountry = country || this.extractCountry(rangeName, cleanNum);
    const flag = this.getFlag(detectedCountry);
    const c2Code = this.getCountryCode2Letter(detectedCountry);
    const otpCode = otp || this.extractOtpCode(cleanMsg);
    const serviceTag = esc(this.extractServiceName(cleanMsg, cli, rangeName));

    // Exact message text matching SMS Hadi screenshot
    const feedMsgText = `${flag} ${c2Code} | 📱 <code>${this.maskPhoneNumber(cleanNum)}</code> | 💬 <b>${serviceTag}</b>\n\n` +
                        `💬 <i>${esc(cleanMsg)}</i>`;

    const otpBtnLabel = otpCode ? `🔒 ${otpCode}` : '📋 New OTP';
    const feedMarkup = {
      inline_keyboard: [
        [{ text: otpBtnLabel, callback_data: 'feed_otp_btn' }],
        [
          { text: '💖 Number bot ↗️', url: this.numberBotUrl },
          { text: '✔️ Main ↗️', url: this.mainChannelUrl }
        ]
      ]
    };

    const payload = {
      chat_id: this.channelId,
      text: feedMsgText,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: feedMarkup
    };

    try {
      const feedApi = `https://api.telegram.org/bot${this.botToken}`;
      const res = await axios.post(`${feedApi}/sendMessage`, payload, { timeout: 10000 });
      return res.data?.ok || false;
    } catch (err) {
      // 429 Rate limit retry matching SMS Hadi (telegramBotService.js:2412)
      if (err.response?.status === 429 && retries > 0) {
        const retryAfterSec = err.response.data?.parameters?.retry_after || 2;
        const delayMs = (retryAfterSec + 1) * 1000;
        await new Promise(r => setTimeout(r, delayMs));
        return this.sendToFeed({ number, cli, content, otp, rangeName, country, retries: retries - 1 });
      }
      console.error('❌ [FeedService Error]:', err.response?.data?.description || err.message);
      return false;
    }
  }
}

module.exports = new FeedService();
