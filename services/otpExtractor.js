'use strict';

// =========================================================================
// 🌐 Comprehensive Country Flags, 2-Letter ISO Codes, & Dial Code Mapping
// =========================================================================
const COUNTRY_MAP = {
  // Asia & Southeast Asia
  bangladesh: { flag: '🇧🇩', code: 'BD', dial: '880', name: 'Bangladesh' },
  india: { flag: '🇮🇳', code: 'IN', dial: '91', name: 'India' },
  pakistan: { flag: '🇵🇰', code: 'PK', dial: '92', name: 'Pakistan' },
  indonesia: { flag: '🇮🇩', code: 'ID', dial: '62', name: 'Indonesia' },
  philippines: { flag: '🇵🇭', code: 'PH', dial: '63', name: 'Philippines' },
  vietnam: { flag: '🇻🇳', code: 'VN', dial: '84', name: 'Vietnam' },
  thailand: { flag: '🇹🇭', code: 'TH', dial: '66', name: 'Thailand' },
  malaysia: { flag: '🇲🇾', code: 'MY', dial: '60', name: 'Malaysia' },
  cambodia: { flag: '🇰🇭', code: 'KH', dial: '855', name: 'Cambodia' },
  laos: { flag: '🇱🇦', code: 'LA', dial: '856', name: 'Laos' },
  myanmar: { flag: '🇲🇲', code: 'MM', dial: '95', name: 'Myanmar' },
  nepal: { flag: '🇳🇵', code: 'NP', dial: '977', name: 'Nepal' },
  'sri lanka': { flag: '🇱🇰', code: 'LK', dial: '94', name: 'Sri Lanka' },
  singapore: { flag: '🇸🇬', code: 'SG', dial: '65', name: 'Singapore' },
  japan: { flag: '🇯🇵', code: 'JP', dial: '81', name: 'Japan' },
  'south korea': { flag: '🇰🇷', code: 'KR', dial: '82', name: 'South Korea' },
  china: { flag: '🇨🇳', code: 'CN', dial: '86', name: 'China' },
  'hong kong': { flag: '🇭🇰', code: 'HK', dial: '852', name: 'Hong Kong' },
  taiwan: { flag: '🇹🇼', code: 'TW', dial: '886', name: 'Taiwan' },

  // Middle East
  yemen: { flag: '🇾🇪', code: 'YE', dial: '967', name: 'Yemen' },
  'saudi arabia': { flag: '🇸🇦', code: 'SA', dial: '966', name: 'Saudi Arabia' },
  saudi: { flag: '🇸🇦', code: 'SA', dial: '966', name: 'Saudi Arabia' },
  uae: { flag: '🇦🇪', code: 'AE', dial: '971', name: 'United Arab Emirates' },
  emirates: { flag: '🇦🇪', code: 'AE', dial: '971', name: 'United Arab Emirates' },
  qatar: { flag: '🇶🇦', code: 'QA', dial: '974', name: 'Qatar' },
  kuwait: { flag: '🇰🇼', code: 'KW', dial: '965', name: 'Kuwait' },
  oman: { flag: '🇴🇲', code: 'OM', dial: '968', name: 'Oman' },
  iraq: { flag: '🇮🇶', code: 'IQ', dial: '964', name: 'Iraq' },
  syria: { flag: '🇸🇾', code: 'SY', dial: '963', name: 'Syria' },
  jordan: { flag: '🇯🇴', code: 'JO', dial: '962', name: 'Jordan' },
  lebanon: { flag: '🇱🇧', code: 'LB', dial: '961', name: 'Lebanon' },
  egypt: { flag: '🇪🇬', code: 'EG', dial: '20', name: 'Egypt' },
  turkey: { flag: '🇹🇷', code: 'TR', dial: '90', name: 'Turkey' },
  iran: { flag: '🇮🇷', code: 'IR', dial: '98', name: 'Iran' },
  israel: { flag: '🇮🇱', code: 'IL', dial: '972', name: 'Israel' },

  // Africa
  nigeria: { flag: '🇳🇬', code: 'NG', dial: '234', name: 'Nigeria' },
  kenya: { flag: '🇰🇪', code: 'KE', dial: '254', name: 'Kenya' },
  ethiopia: { flag: '🇪🇹', code: 'ET', dial: '251', name: 'Ethiopia' },
  ghana: { flag: '🇬🇭', code: 'GH', dial: '233', name: 'Ghana' },
  'south africa': { flag: '🇿🇦', code: 'ZA', dial: '27', name: 'South Africa' },
  morocco: { flag: '🇲🇦', code: 'MA', dial: '212', name: 'Morocco' },
  algeria: { flag: '🇩🇿', code: 'DZ', dial: '213', name: 'Algeria' },
  somalia: { flag: '🇸🇴', code: 'SO', dial: '252', name: 'Somalia' },
  cameroon: { flag: '🇨🇲', code: 'CM', dial: '237', name: 'Cameroon' },
  uganda: { flag: '🇺🇬', code: 'UG', dial: '256', name: 'Uganda' },
  tanzania: { flag: '🇹🇿', code: 'TZ', dial: '255', name: 'Tanzania' },
  senegal: { flag: '🇸🇳', code: 'SN', dial: '221', name: 'Senegal' },
  zambia: { flag: '🇿🇲', code: 'ZM', dial: '260', name: 'Zambia' },
  zimbabwe: { flag: '🇿🇼', code: 'ZW', dial: '263', name: 'Zimbabwe' },
  rwanda: { flag: '🇷🇼', code: 'RW', dial: '250', name: 'Rwanda' },

  // Eurasia & Americas
  russia: { flag: '🇷🇺', code: 'RU', dial: '7', name: 'Russia' },
  kazakhstan: { flag: '🇰🇿', code: 'KZ', dial: '7', name: 'Kazakhstan' },
  uzbekistan: { flag: '🇺🇿', code: 'UZ', dial: '998', name: 'Uzbekistan' },
  ukraine: { flag: '🇺🇦', code: 'UA', dial: '380', name: 'Ukraine' },
  georgia: { flag: '🇬🇪', code: 'GE', dial: '995', name: 'Georgia' },
  moldova: { flag: '🇲🇩', code: 'MD', dial: '373', name: 'Moldova' },
  usa: { flag: '🇺🇸', code: 'US', dial: '1', name: 'United States' },
  'united states': { flag: '🇺🇸', code: 'US', dial: '1', name: 'United States' },
  canada: { flag: '🇨🇦', code: 'CA', dial: '1', name: 'Canada' },
  uk: { flag: '🇬🇧', code: 'GB', dial: '44', name: 'United Kingdom' },
  'united kingdom': { flag: '🇬🇧', code: 'GB', dial: '44', name: 'United Kingdom' },
  france: { flag: '🇫🇷', code: 'FR', dial: '33', name: 'France' },
  germany: { flag: '🇩🇪', code: 'DE', dial: '49', name: 'Germany' },
  italy: { flag: '🇮🇹', code: 'IT', dial: '39', name: 'Italy' },
  spain: { flag: '🇪🇸', code: 'ES', dial: '34', name: 'Spain' },
  brazil: { flag: '🇧🇷', code: 'BR', dial: '55', name: 'Brazil' },
  argentina: { flag: '🇦🇷', code: 'AR', dial: '54', name: 'Argentina' },
  colombia: { flag: '🇨🇴', code: 'CO', dial: '57', name: 'Colombia' },
  ecuador: { flag: '🇪🇨', code: 'EC', dial: '593', name: 'Ecuador' },
  venezuela: { flag: '🇻🇪', code: 'VE', dial: '58', name: 'Venezuela' }
};

// Dial code to Country Info lookup map
const DIAL_CODE_MAP = {};
for (const [key, val] of Object.entries(COUNTRY_MAP)) {
  if (val.dial && !DIAL_CODE_MAP[val.dial]) {
    DIAL_CODE_MAP[val.dial] = val;
  }
}

// =========================================================================
// 🎯 Universal OTP Extractor Engine
// =========================================================================
function extractOtp(content) {
  if (!content) return null;
  const text = String(content).replace(/[\r\n]+/g, ' ').trim();

  // Priority 1: Keyword-bounded OTP extraction (Multilingual & Context-Aware)
  // Matches: "code is 123456", "verification code: 123456", "code: 123-456", "OTP: 1234", etc.
  const keywordRegex = /(?:verification\s*code|verify\s*code|security\s*code|confirmation\s*code|login\s*code|access\s*code|activation\s*code|auth\s*code|otp|passcode|pin|secret|رمز\s*التحقق|رمز\s*التأكيد|كود|код|кода|пароль|código|clave|কোড|ওটিপি)\s*(?:is|:|：|-|=|\.|\s|হলো|هو|de|da)*\s*([A-Z0-9]{1,4}[-\s]?[0-9]{3,8}|[0-9]{4,8})/i;
  const kwMatch = text.match(keywordRegex);
  if (kwMatch && kwMatch[1]) {
    const raw = kwMatch[1].trim();
    if (/^\d{3,4}[-\s]\d{3,4}$/.test(raw)) {
      return raw.replace(/\D/g, '');
    }
    return raw;
  }

  // Priority 2: Standard prefixed alphanumeric codes (e.g. G-123456, FB-12345, TG-12345, WA-123456)
  const prefixMatch = text.match(/\b(G|FB|TG|V|WA|DC|IMO|MS|TK|VK)[-\s]?([0-9]{4,8})\b/i);
  if (prefixMatch) {
    return prefixMatch[0].trim();
  }

  // Priority 3: Explicit Dash-separated numbers (e.g. 123-456, 12-34-56)
  const dashMatch = text.match(/\b\d{3}[-\s]\d{3,4}\b/);
  if (dashMatch) {
    return dashMatch[0].replace(/\D/g, '');
  }

  // Priority 4: Standalone numbers (4 to 8 digits), skipping current/nearby years unless it is the only candidate
  const allNumbers = text.match(/\b\d{4,8}\b/g) || [];
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(String);

  // Filter out year candidates if other valid numbers exist
  const nonYearCandidates = allNumbers.filter(n => !years.includes(n));
  if (nonYearCandidates.length > 0) {
    // Prefer 6-digit (most common), then 5-digit, then 4-digit
    const sixDigit = nonYearCandidates.find(n => n.length === 6);
    if (sixDigit) return sixDigit;
    const fiveDigit = nonYearCandidates.find(n => n.length === 5);
    if (fiveDigit) return fiveDigit;
    const fourDigit = nonYearCandidates.find(n => n.length === 4);
    if (fourDigit) return fourDigit;
    return nonYearCandidates[0];
  }

  if (allNumbers.length > 0) {
    return allNumbers[0];
  }

  return null;
}

// =========================================================================
// 🏷️ Universal Service Detection (Covers 50+ Popular Global Services)
// =========================================================================
function extractServiceName(smsText, cli, cleanRange = '') {
  const combined = `${smsText || ''} ${cli || ''} ${cleanRange || ''}`.toLowerCase();

  // 1. Social & Messaging
  if (combined.includes('botim')) return 'BOTIM';
  if (combined.includes('whatsapp')) return 'WhatsApp';
  if (combined.includes('telegram')) return 'Telegram';
  if (combined.includes('facebook') || combined.includes('fb-') || combined.includes('fbcode')) return 'Facebook';
  if (combined.includes('instagram')) return 'Instagram';
  if (combined.includes('tiktok')) return 'TikTok';
  if (combined.includes('snapchat')) return 'Snapchat';
  if (combined.includes('twitter') || combined.includes(' x ') || combined.includes('x.com')) return 'X (Twitter)';
  if (combined.includes('discord')) return 'Discord';
  if (combined.includes('imo')) return 'Imo';
  if (combined.includes('viber')) return 'Viber';
  if (combined.includes('line')) return 'LINE';
  if (combined.includes('signal')) return 'Signal';
  if (combined.includes('wechat')) return 'WeChat';
  if (combined.includes('skype')) return 'Skype';
  if (combined.includes('linkedin')) return 'LinkedIn';
  if (combined.includes('reddit')) return 'Reddit';
  if (combined.includes('tinder')) return 'Tinder';
  if (combined.includes('bumble')) return 'Bumble';
  if (combined.includes('badoo')) return 'Badoo';

  // 2. Betting, Casino & Gaming
  if (combined.includes('paripesa')) return 'Paripesa';
  if (combined.includes('rolsbet') || combined.includes('mala bet')) return 'RolsBet';
  if (combined.includes('1xbet')) return '1xBet';
  if (combined.includes('melbet')) return 'Melbet';
  if (combined.includes('bet365')) return 'Bet365';
  if (combined.includes('linebet')) return 'Linebet';
  if (combined.includes('mostbet')) return 'Mostbet';
  if (combined.includes('betway')) return 'Betway';
  if (combined.includes('biamo')) return 'Biamo';
  if (combined.includes('stake')) return 'Stake';
  if (combined.includes('pinup') || combined.includes('pin-up')) return 'PinUp';
  if (combined.includes('megapari')) return 'Megapari';
  if (combined.includes('1win')) return '1win';
  if (combined.includes('bc.game') || combined.includes('bcgame')) return 'BC.Game';
  if (combined.includes('betfair')) return 'Betfair';

  // 3. Fintech, Banking & Crypto
  if (combined.includes('bkash')) return 'bKash';
  if (combined.includes('nagad')) return 'Nagad';
  if (combined.includes('rocket')) return 'Rocket';
  if (combined.includes('binance')) return 'Binance';
  if (combined.includes('bybit')) return 'Bybit';
  if (combined.includes('okx')) return 'OKX';
  if (combined.includes('coinbase')) return 'Coinbase';
  if (combined.includes('kucoin')) return 'KuCoin';
  if (combined.includes('paypal')) return 'PayPal';
  if (combined.includes('stripe')) return 'Stripe';
  if (combined.includes('wise')) return 'Wise';
  if (combined.includes('payoneer')) return 'Payoneer';
  if (combined.includes('atome')) return 'Atome';
  if (combined.includes('cashapp')) return 'CashApp';
  if (combined.includes('trust wallet') || combined.includes('trustwallet')) return 'Trust Wallet';
  if (combined.includes('hsbc')) return 'HSBC';

  // 4. Tech, Cloud & Entertainment
  if (combined.includes('google') || combined.includes('gmail') || combined.includes('g-')) return 'Google';
  if (combined.includes('apple') || combined.includes('icloud') || combined.includes('appleid')) return 'Apple';
  if (combined.includes('microsoft') || combined.includes('outlook') || combined.includes('live.com')) return 'Microsoft';
  if (combined.includes('amazon') || combined.includes('aws')) return 'Amazon';
  if (combined.includes('netflix')) return 'Netflix';
  if (combined.includes('mydisney') || combined.includes('disney')) return 'MyDisney';
  if (combined.includes('spotify')) return 'Spotify';
  if (combined.includes('steam')) return 'Steam';
  if (combined.includes('openai') || combined.includes('chatgpt')) return 'OpenAI';
  if (combined.includes('github')) return 'GitHub';
  if (combined.includes('yahoo')) return 'Yahoo';
  if (combined.includes('twitch')) return 'Twitch';

  // 5. E-Commerce & Ride Hailing
  if (combined.includes('shopee')) return 'Shopee';
  if (combined.includes('lazada')) return 'Lazada';
  if (combined.includes('daraz')) return 'Daraz';
  if (combined.includes('aliexpress') || combined.includes('alibaba')) return 'AliExpress';
  if (combined.includes('ebay')) return 'eBay';
  if (combined.includes('uber')) return 'Uber';
  if (combined.includes('grab')) return 'Grab';
  if (combined.includes('foodpanda')) return 'Foodpanda';
  if (combined.includes('pathao')) return 'Pathao';

  // 6. CLI fallback if alphanumeric sender
  if (cli && /^[A-Za-z0-9_-]{3,15}$/.test(cli.trim()) && !/^\d+$/.test(cli.trim())) {
    const cleanCli = cli.trim();
    if (!/auth|info|verify|notice|msg|sms/i.test(cleanCli)) {
      return cleanCli.charAt(0).toUpperCase() + cleanCli.slice(1);
    }
  }

  // 7. Range name fallback
  if (cleanRange && cleanRange !== 'SMS Service' && cleanRange !== 'General') {
    const clean = cleanRange.replace(/[\p{Emoji}\u200d]+/gu, '').trim();
    if (clean && clean.length <= 25) return clean;
  }

  return 'OTP';
}

// =========================================================================
// 🌍 Universal Country Detection (Flag, 2-Letter Code, Country Name)
// =========================================================================
function extractCountryInfo(rangeTitle = '', sampleNumber = '') {
  const lower = (rangeTitle || '').toLowerCase();

  // 1. Match country name directly in range title
  for (const [key, val] of Object.entries(COUNTRY_MAP)) {
    if (lower.includes(key)) {
      return val;
    }
  }

  // 2. Match international dial code prefix from sample number
  const digits = String(sampleNumber || '').replace(/^\+/, '').replace(/\D/g, '');
  if (digits) {
    for (const len of [4, 3, 2, 1]) {
      const prefix = digits.slice(0, len);
      if (DIAL_CODE_MAP[prefix]) {
        return DIAL_CODE_MAP[prefix];
      }
    }
  }

  // 3. Match numeric first word in range title
  const firstWord = (rangeTitle || '').trim().split(/[\s,\-_]+/)[0] || '';
  if (/^\d+$/.test(firstWord) && DIAL_CODE_MAP[firstWord]) {
    return DIAL_CODE_MAP[firstWord];
  }

  // Default fallback
  return { flag: '🌍', code: 'GL', dial: '', name: 'Global' };
}

module.exports = {
  extractOtp,
  extractServiceName,
  extractCountryInfo,
  COUNTRY_MAP,
  DIAL_CODE_MAP
};
