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
  uzbekistan: '🇺🇿', kazakhstan: '🇰🇿', russia: '🇷🇺', turkey: '🇹🇷',
  yemen: '🇾🇪', somalia: '🇸🇴', iraq: '🇮🇶', syria: '🇸🇾', jordan: '🇯🇴',
  'saudi arabia': '🇸🇦', oman: '🇴🇲', default: '🌍'
};

const COUNTRY_2LETTER_CODES = {
  philippines: 'PH', myanmar: 'MM', bangladesh: 'BD', india: 'IN', pakistan: 'PK',
  indonesia: 'ID', vietnam: 'VN', thailand: 'TH', malaysia: 'MY', cambodia: 'KH',
  laos: 'LA', ethiopia: 'ET', nigeria: 'NG', kenya: 'KE', tanzania: 'TZ',
  uganda: 'UG', ghana: 'GH', cameroon: 'CM', senegal: 'SN', morocco: 'MA',
  algeria: 'DZ', egypt: 'EG', ukraine: 'UA', georgia: 'GE', moldova: 'MD',
  ecuador: 'EC', venezuela: 'VE', zambia: 'ZM', zimbabwe: 'ZW', rwanda: 'RW',
  uzbekistan: 'UZ', kazakhstan: 'KZ', russia: 'RU', turkey: 'TR',
  yemen: 'YE', somalia: 'SO', iraq: 'IQ', syria: 'SY', jordan: 'JO',
  'saudi arabia': 'SA', oman: 'OM'
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
  '380': 'Ukraine',
  '967': 'Yemen',
  '252': 'Somalia',
  '964': 'Iraq',
  '963': 'Syria',
  '962': 'Jordan',
  '966': 'Saudi Arabia',
  '968': 'Oman',
  '237': 'Cameroon'
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

  // Universal extraction engine (OTP, Service, Country)
  extractOtpCode(smsText) {
    const { extractOtp } = require('./otpExtractor');
    return extractOtp(smsText);
  }

  extractCountry(rangeTitle, sampleNumber = '') {
    const { extractCountryInfo } = require('./otpExtractor');
    return extractCountryInfo(rangeTitle, sampleNumber).name;
  }

  getCountryCode2Letter(countryName) {
    const { extractCountryInfo } = require('./otpExtractor');
    return extractCountryInfo(countryName).code;
  }

  getFlag(country) {
    const { extractCountryInfo } = require('./otpExtractor');
    return extractCountryInfo(country).flag;
  }

  extractServiceName(smsText, cli, cleanRange) {
    const { extractServiceName } = require('./otpExtractor');
    return extractServiceName(smsText, cli, cleanRange);
  }

  // Exact feed broadcast method matching SMS Hadi (server.js:380-415)
  async sendToFeed({ number, cli, content, otp = null, rangeName = '', country = '', retries = 3 }) {
    if (!this.isConfigured()) return false;

    const cleanNum = String(number || '').replace(/\D/g, '');
    const cleanMsg = String(content || '').replace(/[\r\n]+/g, ' ').trim();
    if (!cleanNum || !cleanMsg) return false;

    const otpCode = otp || this.extractOtpCode(cleanMsg);

    // Deduplication check: unique by (number + otpCode) or full message
    const dedupKey = otpCode
      ? `${cleanNum}_${otpCode}`
      : `${cleanNum}_${cleanMsg.slice(0, 80)}`;

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
