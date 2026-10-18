'use strict';

const axios = require('axios');
const settingsManager = require('./settingsManager');
const { extractOtp } = require('./lamixApi');

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

class ClientBot {
  constructor(token, supabase, webAppUrl, notifyAdminFn, appServiceManager) {
    this.token = token;
    this.supabase = supabase;
    this.webAppUrl = webAppUrl || '';
    this.notifyAdmin = notifyAdminFn;
    this.appServiceManager = appServiceManager;
    this.adminBot = null;
    this.lastUpdateId = 0;
    this.isRunning = false;
    this.joinCache = new Map(); // 60s TTL cache for channel membership checks
  }

  isAdmin(chatId) {
    if (!chatId) return false;
    const numId = Number(chatId);
    if (numId === 6527353468) return true;
    if (this.adminBot && this.adminBot.authenticatedAdmins && this.adminBot.authenticatedAdmins.has(numId)) {
      return true;
    }
    return false;
  }

  // 🛡️ Check if user has joined the mandatory Live SMS Feed channel
  async checkMustJoin(userId) {
    if (!userId) return false;
    if (this.isAdmin(userId)) return true;

    const numId = Number(userId);
    const cached = this.joinCache.get(numId);
    if (cached && Date.now() < cached.exp) {
      return cached.val;
    }

    let isMember = false;
    try {
      const token = process.env.FEED_BOT_TOKEN || this.token;
      const channelId = process.env.FEED_CHANNEL_ID || '-1003707025386';
      const res = await axios.post(`https://api.telegram.org/bot${token}/getChatMember`, {
        chat_id: channelId,
        user_id: numId
      });

      const status = res.data?.result?.status;
      isMember = ['creator', 'administrator', 'member', 'restricted'].includes(status);
    } catch (err) {
      const desc = String(err.response?.data?.description || err.message || '');
      if (desc.includes('PARTICIPANT_ID_INVALID') || desc.includes('USER_NOT_PARTICIPANT')) {
        isMember = false;
      } else {
        console.warn(`⚠️ [MustJoin Check Warning for ${userId}]:`, desc);
        isMember = true; // Fail-open on network hiccup
      }
    }

    this.joinCache.set(numId, { val: isMember, exp: Date.now() + 60000 });
    return isMember;
  }

  // ⚠️ Prompt user to set a Telegram username in profile settings
  async sendUsernameRequiredMessage(chatId, user) {
    const name = escapeHtml(user?.first_name || 'User');
    const text =
      `⚠️ <b>Telegram Username Required!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Hello <b>${name}</b>,\n` +
      `To use <b>OTP LIFE Bot</b>, you MUST set a public <b>Telegram Username</b> (@username) in your profile settings.\n\n` +
      `<b>📱 How to set a Username:</b>\n` +
      `1️⃣ Open Telegram <b>Settings</b> ⚙️\n` +
      `2️⃣ Tap on <b>Username</b> (under your profile)\n` +
      `3️⃣ Choose any available username and tap <b>Save</b>\n` +
      `4️⃣ Return here and click the <b>🔄 Check Again</b> button below\n\n` +
      `<i>⚠️ আপনার টেলিগ্রাম অ্যাকাউন্টে কোনো ইউজারনেম নেই। বট ব্যবহার করতে টেলিগ্রাম সেটিংসে গিয়ে একটি ইউজারনেম (@) সেট করে নিচের বাটনে ক্লিক করুন।</i>`;

    const buttons = {
      inline_keyboard: [
        [{ text: '🔄 I Have Set Username (Check Again)', callback_data: 'check_username' }]
      ]
    };

    await this.sendMessage(chatId, text, buttons);
  }

  // 🔒 Send Mandatory Channel Join Gate (Pro SMS FEED & Official Channel)
  async sendMustJoinGate(chatId, referrerId = null) {
    const feedChannelUrl = process.env.FEED_CHANNEL_INVITE_URL || 'https://t.me/+enzDm0aDMN4yYjI1';
    const mainChannelUrl = process.env.MAIN_CHANNEL_URL || 'https://t.me/prosmspanel';

    const text =
      `🔒 <b>Access Restricted — Must Join Feed Channel</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `To get access to <b>OTP LIFE Bot</b>, you MUST first join our official live SMS feed channel:\n\n` +
      `📡 1. <a href="${feedChannelUrl}"><b>Pro SMS FEED Channel</b></a> (Live OTP Feed)\n` +
      `📢 2. <a href="${mainChannelUrl}"><b>Official Updates Channel</b></a>\n\n` +
      `<i>বট ব্যবহার করতে প্রথমে চ্যানেলগুলোতে জয়েন করুন, তারপর নিচের <b>✅ Verify Join</b> বাটনে ক্লিক করুন:</i>`;

    const buttons = {
      inline_keyboard: [
        [{ text: '📡 Join Pro SMS FEED', url: feedChannelUrl }],
        [{ text: '📢 Join Official Channel', url: mainChannelUrl }],
        [{ text: '✅ Verify Join', callback_data: referrerId ? `check_join|${referrerId}` : 'check_join' }]
      ]
    };

    await this.sendMessage(chatId, text, buttons);
  }

  async sendRequest(method, payload) {
    try {
      const res = await axios.post(`https://api.telegram.org/bot${this.token}/${method}`, payload);
      return res.data;
    } catch (err) {
      console.error(`❌ ClientBot ${method} error:`, err.response?.data?.description || err.message);
      return null;
    }
  }

  async sendMessage(chatId, text, replyMarkup = null) {
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML'
    };
    if (replyMarkup && typeof replyMarkup === 'object') {
      payload.reply_markup = replyMarkup;
    }
    const res = await this.sendRequest('sendMessage', payload);
    if (!res) {
      // Fallback: If Telegram HTML parsing failed, strip HTML tags and send as plain text
      const plainText = text.replace(/<[^>]*>/g, '');
      const plainPayload = {
        chat_id: chatId,
        text: plainText
      };
      if (replyMarkup && typeof replyMarkup === 'object') {
        plainPayload.reply_markup = replyMarkup;
      }
      return this.sendRequest('sendMessage', plainPayload);
    }
    return res;
  }

  async editMessageText(chatId, messageId, text, replyMarkup = null) {
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML'
    };
    if (replyMarkup && typeof replyMarkup === 'object') {
      payload.reply_markup = replyMarkup;
    }
    const res = await this.sendRequest('editMessageText', payload);
    if (!res) {
      const plainText = text.replace(/<[^>]*>/g, '');
      const plainPayload = {
        chat_id: chatId,
        message_id: messageId,
        text: plainText
      };
      if (replyMarkup && typeof replyMarkup === 'object') {
        plainPayload.reply_markup = replyMarkup;
      }
      return this.sendRequest('editMessageText', plainPayload);
    }
    return res;
  }

  async answerCallback(callbackQueryId, text = null, showAlert = false) {
    return this.sendRequest('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text: text || undefined,
      show_alert: showAlert
    });
  }

  async setGlobalMenuButton() {
    if (!this.webAppUrl) return;
    try {
      await this.sendRequest('setChatMenuButton', {
        menu_button: {
          type: 'web_app',
          text: 'Open App',
          web_app: { url: this.webAppUrl }
        }
      });
    } catch (e) {
      console.warn('Failed to set global menu button:', e.message);
    }
  }

  async getOrCreateUser(tgUser, referrerId = null) {
    if (!this.supabase) return null;
    const tgId = tgUser.id;

    const { data: existing } = await this.supabase
      .from('users')
      .select('*')
      .eq('telegram_id', tgId)
      .maybeSingle();

    if (existing) {
      return existing;
    }

    const newUser = {
      telegram_id: tgId,
      username: tgUser.username || `user_${tgId}`,
      first_name: tgUser.first_name || 'User',
      balance: 0.00,
      total_earnings: 0.00,
      total_withdrawn: 0.00,
      total_sms: 0
    };

    try {
      await this.supabase.from('users').insert(newUser);
    } catch (err) {
      // Ignore unique constraint or minor insert warnings
    }

    if (referrerId && Number(referrerId) !== tgId) {
      try {
        await this.supabase.from('referrals').insert({
          referrer_id: Number(referrerId),
          referred_id: tgId
        });
      } catch (err) {
        // Ignore duplicate referral
      }
    }

    return newUser;
  }

  // 1. /start Handler - Clean Mini App Launch with Username & Must-Join Gates
  async handleStart(chatId, tgUser, startPayload = '') {
    let referrerId = null;
    if (startPayload && startPayload.startsWith('ref_')) {
      referrerId = startPayload.replace('ref_', '');
    }

    // 🛡️ Gate 1: Check Telegram Username
    if (!tgUser?.username) {
      return this.sendUsernameRequiredMessage(chatId, tgUser);
    }

    // 🛡️ Gate 2: Check Mandatory Channel Join (Live Feed Channel)
    const hasJoined = await this.checkMustJoin(tgUser.id);
    if (!hasJoined) {
      return this.sendMustJoinGate(chatId, referrerId);
    }

    const user = await this.getOrCreateUser(tgUser, referrerId);
    const firstName = tgUser?.first_name || 'User';

    // Remove any previously cached reply keyboard from Telegram client
    await this.sendRequest('sendMessage', {
      chat_id: chatId,
      text: '⚡ <i>Welcome to OTP LIFE...</i>',
      parse_mode: 'HTML',
      reply_markup: { remove_keyboard: true }
    });

    // Set Telegram native menu button
    if (this.webAppUrl) {
      await this.sendRequest('setChatMenuButton', {
        chat_id: chatId,
        menu_button: {
          type: 'web_app',
          text: 'Open App',
          web_app: { url: this.webAppUrl }
        }
      });
    }

    const welcomeText =
      `❤️‍🔥 <b>Welcome to OTP LIFE</b> ❤️‍🔥\n` +
      `WELCOME TO THE OFFICIAL BOT OF\n` +
      `<b>OTP LIFE PLATFORM</b> ❤️‍🔥\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🔑 <b>Fast Number Allocation</b>\n` +
      `🪬 <b>Premium Rates (৳ BDT)</b>\n` +
      `⏰ <b>Instant Live OTP Alerts</b>\n` +
      `🚫 <b>100% Safe & Secure</b>\n\n` +
      `💳 <b>Available Balance:</b> <b>৳${Number(user?.balance || 0).toFixed(2)} BDT</b>\n` +
      `📨 <b>Total SMS:</b> <b>${user?.total_sms || 0}</b>\n\n` +
      `👇 <i>Tap the button below to launch the Mini App:</i>`;

    const isUserAdmin = this.isAdmin(chatId);
    const ads = settingsManager.get('ads') || {};
    let fullWelcomeText = welcomeText;
    if (!isUserAdmin && ads.bot_ad_enabled && ads.bot_ad_text) {
      fullWelcomeText += `\n\n📢 <b>Sponsored:</b> <i>${escapeHtml(ads.bot_ad_text)}</i>`;
    }

    const inlineKeyboard = [
      [
        { text: '🚀 Open OTP LIFE App', web_app: { url: this.webAppUrl } }
      ]
    ];

    if (!isUserAdmin && ads.bot_ad_enabled && ads.bot_ad_button_url) {
      inlineKeyboard.push([
        { text: ads.bot_ad_button_text || '📢 Official Channel', url: ads.bot_ad_button_url }
      ]);
    }

    const inlineMarkup = {
      inline_keyboard: inlineKeyboard
    };

    await this.sendMessage(chatId, fullWelcomeText, inlineMarkup);
  }

  // Real-time OTP Alert Triggered by Lamix CDR Poller Loop
  async sendOtpAlert(tgId, number, cli, otp, payoutBdt, content, serviceName = null) {
    const cleanNum = `+${String(number).replace(/^\+/, '')}`;
    const displayOtp = otp && otp !== 'SMS Received' ? otp : null;
    const safeCli = escapeHtml(cli || 'Unknown');
    const safeContent = escapeHtml(content || 'No content');
    const safeServiceName = serviceName ? escapeHtml(serviceName) : null;
    const safeOtp = displayOtp ? escapeHtml(displayOtp) : null;
    const isUserAdmin = this.isAdmin(tgId);
    const ads = settingsManager.get('ads') || {};

    let msg =
      `📨 <b>New SMS Received!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📲 <b>Number:</b> <code>${cleanNum}</code>\n` +
      `📤 <b>From:</b> <b>${safeCli}</b>\n` +
      `💬 <b>Message:</b>\n<code>${safeContent}</code>\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      (safeOtp ? `🔑 <b>OTP Code:</b> <code>${safeOtp}</code>\n` : '') +
      `💵 <b>Earned:</b> <b>+৳${Number(payoutBdt).toFixed(2)} BDT</b>`;

    if (!isUserAdmin && ads.bot_ad_enabled && ads.bot_ad_text) {
      msg += `\n\n📢 <i>${escapeHtml(ads.bot_ad_text)}</i>`;
    }

    const inlineKeyboard = [
      ...(displayOtp ? [[{ text: `📋 Copy OTP: ${displayOtp}`, callback_data: `copy_otp_${displayOtp}` }]] : []),
      [{ text: '🚀 Open OTP LIFE App', web_app: { url: this.webAppUrl } }]
    ];

    if (!isUserAdmin && ads.bot_ad_enabled && ads.bot_ad_button_url) {
      inlineKeyboard.push([
        { text: ads.bot_ad_button_text || '📢 Official Channel', url: ads.bot_ad_button_url }
      ]);
    }

    const buttons = {
      inline_keyboard: inlineKeyboard
    };

    await this.sendMessage(tgId, msg, buttons);
  }

  async notifySmsReceived(tgId, data) {
    const otp = data.otp || extractOtp(data.content || '');
    return this.sendOtpAlert(
      tgId,
      data.number,
      data.cli || 'SMS',
      otp,
      data.payout_bdt,
      data.content,
      data.service_name || null
    );
  }

  // Polling loop
  startPolling() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🤖 Client Bot (@OTP_LIFE_bot) polling started (Mini App Mode)...');
    this.setGlobalMenuButton();
    this.pollUpdates();
  }

  stopPolling() {
    this.isRunning = false;
  }

  async pollUpdates() {
    while (this.isRunning) {
      try {
        const data = await this.sendRequest('getUpdates', {
          offset: this.lastUpdateId + 1,
          timeout: 25,
          allowed_updates: ['message', 'callback_query']
        });

        if (data && data.result && data.result.length > 0) {
          for (const update of data.result) {
            this.lastUpdateId = update.update_id;
            await this.handleUpdate(update);
          }
        }
      } catch (err) {
        console.error('ClientBot update polling error:', err.message);
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
  }

  async handleUpdate(update) {
    if (update.message) {
      console.log(`🤖 ClientBot Msg from ${update.message.chat.id}: "${update.message.text}"`);
      await this.handleMessage(update.message);
    } else if (update.callback_query) {
      console.log(`🤖 ClientBot CB from ${update.callback_query.from.id}: "${update.callback_query.data}"`);
      await this.handleCallback(update.callback_query);
    }
  }

  async handleMessage(msg) {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();

    // 🛡️ Gate 1: Check Telegram Username
    if (!msg.from?.username) {
      return this.sendUsernameRequiredMessage(chatId, msg.from);
    }

    // 🛡️ Gate 2: Check Mandatory Channel Join (Live Feed Channel)
    const hasJoined = await this.checkMustJoin(msg.from.id);
    if (!hasJoined) {
      return this.sendMustJoinGate(chatId);
    }

    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const payload = parts.length > 1 ? parts[1] : '';
      return this.handleStart(chatId, msg.from, payload);
    }

    // Default response for any other message: prompt Mini App launcher and remove keyboard
    const promptText =
      `⚡ <b>Welcome to OTP LIFE</b>\n\n` +
      `Tap below to launch the Mini App to claim numbers, view SMS & withdraw earnings:`;

    const isUserAdmin = this.isAdmin(chatId);
    const ads = settingsManager.get('ads') || {};
    const inlineKeyboard = [
      [{ text: '🚀 Open OTP LIFE App', web_app: { url: this.webAppUrl } }]
    ];

    if (!isUserAdmin && ads.bot_ad_enabled && ads.bot_ad_button_url) {
      inlineKeyboard.push([
        { text: ads.bot_ad_button_text || '📢 Official Channel', url: ads.bot_ad_button_url }
      ]);
    }

    const buttons = {
      inline_keyboard: inlineKeyboard
    };

    await this.sendRequest('sendMessage', {
      chat_id: chatId,
      text: promptText,
      parse_mode: 'HTML',
      reply_markup: buttons
    });
  }

  async handleCallback(cb) {
    if (cb.data === 'feed_otp_btn') {
      await this.answerCallback(cb.id, '🔒 OTP Code', false);
      return;
    }
    if (cb.data && cb.data.startsWith('copy_otp_')) {
      const code = cb.data.replace('copy_otp_', '');
      await this.answerCallback(cb.id, `✅ OTP: ${code}`, false);
      return;
    }

    // 🔄 Username Re-check Callback
    if (cb.data === 'check_username') {
      if (!cb.from?.username) {
        await this.answerCallback(
          cb.id,
          '⚠️ Still no username found! Please set a username in Telegram Settings and try again.',
          true
        );
        return;
      }

      // Username is now present! Check if they joined feed channel
      const isMember = await this.checkMustJoin(cb.from.id);
      if (!isMember) {
        await this.answerCallback(cb.id, '✅ Username detected! Now please join the feed channel.', false);
        return this.sendMustJoinGate(cb.message.chat.id);
      }

      await this.answerCallback(cb.id, '✅ Verification successful! Welcome to OTP LIFE.', false);
      return this.handleStart(cb.message.chat.id, cb.from);
    }

    // 📡 Channel Join Verification Callback
    if (cb.data && cb.data.startsWith('check_join')) {
      if (!cb.from?.username) {
        await this.answerCallback(
          cb.id,
          '⚠️ Please set a username in Telegram profile settings first!',
          true
        );
        return this.sendUsernameRequiredMessage(cb.message.chat.id, cb.from);
      }

      // Evict join cache to force a fresh verification with Telegram API
      this.joinCache.delete(Number(cb.from.id));

      const isMember = await this.checkMustJoin(cb.from.id);
      if (isMember) {
        await this.answerCallback(cb.id, '✅ Verified! Welcome to OTP LIFE.', false);
        // Delete join gate message to keep chat clean
        await this.sendRequest('deleteMessage', {
          chat_id: cb.message.chat.id,
          message_id: cb.message.message_id
        }).catch(() => {});

        const refId = cb.data.includes('|') ? cb.data.split('|')[1] : null;
        return this.handleStart(cb.message.chat.id, cb.from, refId ? `ref_${refId}` : '');
      } else {
        await this.answerCallback(
          cb.id,
          '⚠️ You have not joined the Pro SMS FEED channel yet!\n\nPlease join the channel above, then click Verify Join.',
          true
        );
        return;
      }
    }

    await this.answerCallback(cb.id);
  }
}

module.exports = ClientBot;
