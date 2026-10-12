'use strict';

const axios = require('axios');
const settingsManager = require('./settingsManager');
const { extractOtp } = require('./lamixApi');

class ClientBot {
  constructor(token, supabase, webAppUrl, notifyAdminFn, appServiceManager) {
    this.token = token;
    this.supabase = supabase;
    this.webAppUrl = webAppUrl || '';
    this.notifyAdmin = notifyAdminFn;
    this.appServiceManager = appServiceManager;
    this.lastUpdateId = 0;
    this.isRunning = false;
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
    return this.sendRequest('sendMessage', payload);
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
    return this.sendRequest('editMessageText', payload);
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

    await this.supabase.from('users').insert(newUser).catch(() => {});

    if (referrerId && Number(referrerId) !== tgId) {
      await this.supabase.from('referrals').insert({
        referrer_id: Number(referrerId),
        referred_id: tgId
      }).catch(() => {});
    }

    return newUser;
  }

  // 1. /start Handler - NO Reply Keyboard! Clean Mini App Launch
  async handleStart(chatId, tgUser, startPayload = '') {
    let referrerId = null;
    if (startPayload && startPayload.startsWith('ref_')) {
      referrerId = startPayload.replace('ref_', '');
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

    const inlineMarkup = {
      inline_keyboard: [
        [
          { text: '🚀 Open OTP LIFE App', web_app: { url: this.webAppUrl } }
        ]
      ]
    };

    await this.sendMessage(chatId, welcomeText, inlineMarkup);
  }

  // Real-time OTP Alert Triggered by Lamix CDR Poller Loop
  async sendOtpAlert(tgId, number, cli, otp, payoutBdt, content, serviceName = null) {
    const cleanNum = `+${String(number).replace(/^\+/, '')}`;
    const displayOtp = otp && otp !== 'SMS Received' ? otp : null;
    const msg =
      `📨 <b>New SMS Received!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📲 <b>Number:</b> <code>${cleanNum}</code>\n` +
      `📤 <b>From:</b> <b>${cli || 'Unknown'}</b>\n` +
      (serviceName ? `📱 <b>Service:</b> ${serviceName}\n` : '') +
      `💬 <b>Message:</b>\n<code>${content || 'No content'}</code>\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      (displayOtp ? `🔑 <b>OTP Code:</b> <code>${displayOtp}</code>\n` : '') +
      `💵 <b>Earned:</b> <b>+৳${Number(payoutBdt).toFixed(2)} BDT</b>`;

    const buttons = {
      inline_keyboard: [
        ...(displayOtp ? [[{ text: `📋 Copy OTP: ${displayOtp}`, callback_data: `copy_otp_${displayOtp}` }]] : []),
        [{ text: '🚀 Open OTP LIFE App', web_app: { url: this.webAppUrl } }]
      ]
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

    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const payload = parts.length > 1 ? parts[1] : '';
      return this.handleStart(chatId, msg.from, payload);
    }

    // Default response for any other message: prompt Mini App launcher and remove keyboard
    const promptText =
      `⚡ <b>Welcome to OTP LIFE</b>\n\n` +
      `Tap below to launch the Mini App to claim numbers, view SMS & withdraw earnings:`;

    const buttons = {
      inline_keyboard: [
        [{ text: '🚀 Open OTP LIFE App', web_app: { url: this.webAppUrl } }]
      ]
    };

    await this.sendRequest('sendMessage', {
      chat_id: chatId,
      text: promptText,
      parse_mode: 'HTML',
      reply_markup: buttons
    });
  }

  async handleCallback(cb) {
    await this.answerCallback(cb.id);
  }
}

module.exports = ClientBot;
