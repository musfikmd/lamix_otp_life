const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { syncNumbersToDatabase } = require('./lamixApi');
const settingsManager = require('./settingsManager');

const AUTH_FILE = path.join(__dirname, '..', 'data', 'authenticated_admins.json');

function loadAuthenticatedAdmins() {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      const data = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
      return new Set(data.map(Number));
    }
  } catch (e) {}
  return new Set([6527353468]); // Pre-authorize workspace owner
}

function saveAuthenticatedAdmins(adminSet) {
  try {
    const dir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(AUTH_FILE, JSON.stringify([...adminSet]), 'utf8');
  } catch (e) {}
}

class AdminBot {
  constructor(token, supabase, clientBotInstance, appServiceManager) {
    this.token = token;
    this.supabase = supabase;
    this.clientBot = clientBotInstance;
    this.appServiceManager = appServiceManager;
    this.authenticatedAdmins = loadAuthenticatedAdmins();
    this.adminStates = new Map();
    this.lastUpdateId = 0;
    this.isRunning = false;
  }

  async sendRequest(method, payload) {
    try {
      const res = await axios.post(`https://api.telegram.org/bot${this.token}/${method}`, payload);
      return res.data;
    } catch (err) {
      console.error(`❌ AdminBot ${method} error:`, err.response?.data?.description || err.message);
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

  // Get Admin Reply Keyboard Menu
  getAdminReplyKeyboard() {
    const withdrawEnabled = settingsManager.get('withdraw_enabled');
    return {
      keyboard: [
        [{ text: '📊 System Stats' }, { text: '⏳ Pending Withdrawals' }],
        [{ text: '👥 Client List' }, { text: '📜 Withdrawal History' }],
        [{ text: '📢 Broadcast Message' }, { text: withdrawEnabled ? '🟢 Withdraw: ON' : '🔴 Withdraw: OFF' }],
        [{ text: '🔄 Sync Number Pool' }],
        [{ text: '📱 App Services Manager' }, { text: '🎁 Referral Rewards' }],
        [{ text: '💵 Set Min Withdraw' }, { text: 'ℹ️ Admin Help' }]
      ],
      resize_keyboard: true,
      persistent: true
    };
  }

  // Welcome / Start
  async handleStart(chatId) {
    if (this.authenticatedAdmins.has(Number(chatId))) {
      return this.showDashboard(chatId);
    }
    this.adminStates.set(chatId, { step: 'awaiting_password' });
    await this.sendMessage(
      chatId,
      '🔒 <b>Welcome to Admin Control Bot!</b>\n\n' +
      'Enter the admin password to access the panel:'
    );
  }

  // Show Dashboard
  async showDashboard(chatId) {
    const text =
      `👑 <b>Welcome to Admin Control Panel!</b>\n\n` +
      `✅ <b>Access granted.</b>\n\n` +
      `<i>Use the menu buttons below to manage numbers, services, clients, and withdrawals:</i>`;

    await this.sendMessage(chatId, text, this.getAdminReplyKeyboard());
  }

  // 1. System Stats
  async handleSystemStats(chatId) {
    if (!this.supabase) return;

    const [
      usersRes,
      activeNumbersCount,
      pendingWdCount,
      totalCdrCount,
      approvedWdRes,
      pendingWdRes,
      poolNumbersRes
    ] = await Promise.all([
      this.supabase.from('users').select('balance, total_earnings, total_withdrawn').limit(100000),
      this.supabase.from('assigned_numbers').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      this.supabase.from('withdrawals').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
      this.supabase.from('cdr_logs').select('*', { count: 'exact', head: true }),
      this.supabase.from('withdrawals').select('amount').eq('status', 'APPROVED').limit(100000),
      this.supabase.from('withdrawals').select('amount').eq('status', 'PENDING').limit(100000),
      this.supabase.from('number_pool').select('is_assigned').limit(100000)
    ]);

    const users = usersRes.data || [];
    const totalEarned = users.reduce((acc, u) => acc + (parseFloat(u.total_earnings) || 0), 0);
    const totalPaid = (approvedWdRes.data || []).reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);
    const totalRemaining = users.reduce((acc, u) => acc + (parseFloat(u.balance) || 0), 0);
    const totalPendingAmount = (pendingWdRes.data || []).reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);
    
    const pool = poolNumbersRes.data || [];
    const totalStock = pool.length;
    const availableStock = pool.filter(p => !p.is_assigned).length;

    const withdrawState = settingsManager.get('withdraw_enabled') ? '🟢 ACTIVE (ON)' : '🔴 PAUSED (OFF)';
    const minWd = settingsManager.get('min_withdraw');

    const msg =
      `📊 <b>System Statistics & Overview</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💰 <b>Total Earned:</b> ৳${totalEarned.toFixed(2)} BDT\n` +
      `💵 <b>Total Paid Out:</b> ৳${totalPaid.toFixed(2)} BDT\n` +
      `💳 <b>Remaining Balance:</b> ৳${totalRemaining.toFixed(2)} BDT\n` +
      `⏳ <b>Pending Withdrawals:</b> ${pendingWdCount.count || 0} (৳${totalPendingAmount.toFixed(2)} BDT)\n\n` +
      `👥 <b>Total Clients:</b> ${users.length}\n` +
      `📱 <b>Active Numbers:</b> ${activeNumbersCount.count || 0}\n` +
      `📨 <b>Total OTPs Received:</b> ${totalCdrCount.count || 0}\n` +
      `📦 <b>Number Pool Stock:</b> ${availableStock} / ${totalStock}\n\n` +
      `⚙️ <b>Withdrawal Status:</b> ${withdrawState}\n` +
      `📌 <b>Minimum Withdrawal:</b> ৳${minWd} BDT`;

    await this.sendMessage(chatId, msg, this.getAdminReplyKeyboard());
  }

  // 2. Pending Withdrawals
  async handlePendingWithdrawals(chatId) {
    if (!this.supabase) return;

    const { data: list } = await this.supabase
      .from('withdrawals')
      .select('*')
      .eq('status', 'PENDING')
      .order('requested_at', { ascending: false })
      .limit(10);

    if (!list || list.length === 0) {
      return this.sendMessage(chatId, '✅ There are currently no pending withdrawals.', this.getAdminReplyKeyboard());
    }

    await this.sendMessage(chatId, `📋 <b>Pending Withdrawals (${list.length}):</b>`);

    for (const wd of list) {
      const card =
        `💳 <b>Withdrawal Request #${wd.id}</b>\n` +
        `👤 User ID: <code>${wd.telegram_id}</code>\n` +
        `💰 Amount: <b>৳${wd.amount} BDT</b>\n` +
        `🏦 Method & Account: <b>${wd.method} (${wd.wallet_address})</b>\n` +
        `🕒 Requested: ${new Date(wd.requested_at).toLocaleString()}`;

      const buttons = {
        inline_keyboard: [
          [
            { text: '✅ Approve (Paid)', callback_data: `wd_app_${wd.id}` },
            { text: '❌ Reject (Refund)', callback_data: `wd_rej_${wd.id}` }
          ]
        ]
      };

      await this.sendMessage(chatId, card, buttons);
    }
  }

  // 3. Client List
  async handleClientList(chatId) {
    if (!this.supabase) return;

    const { data: clients } = await this.supabase
      .from('users')
      .select('telegram_id, username, first_name, balance, total_earnings, total_sms')
      .order('total_earnings', { ascending: false })
      .limit(15);

    if (!clients || clients.length === 0) {
      return this.sendMessage(chatId, '👥 No clients registered yet.', this.getAdminReplyKeyboard());
    }

    let text = `👥 <b>Top Clients (${clients.length}):</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    clients.forEach((c, idx) => {
      text += `${idx + 1}. <b>${c.first_name || 'User'}</b> (@${c.username || 'N/A'})\n` +
              `   ID: <code>${c.telegram_id}</code> | Balance: <b>৳${c.balance}</b> | OTPs: <b>${c.total_sms}</b>\n\n`;
    });

    await this.sendMessage(chatId, text, this.getAdminReplyKeyboard());
  }

  // 4. Withdrawal History
  async handleWithdrawalHistory(chatId) {
    if (!this.supabase) return;

    const { data: history } = await this.supabase
      .from('withdrawals')
      .select('*')
      .neq('status', 'PENDING')
      .order('processed_at', { ascending: false })
      .limit(10);

    if (!history || history.length === 0) {
      return this.sendMessage(chatId, '📜 No processed withdrawal history yet.', this.getAdminReplyKeyboard());
    }

    let text = `📜 <b>Recent Processed Withdrawals:</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    history.forEach((w) => {
      const icon = w.status === 'APPROVED' ? '✅' : '❌';
      text += `${icon} <b>#${w.id}</b> — <b>৳${w.amount} BDT</b> (${w.method})\n` +
              `   User: <code>${w.telegram_id}</code> | ${w.wallet_address}\n` +
              `   Status: <b>${w.status}</b> (${new Date(w.processed_at || w.requested_at).toLocaleTimeString()})\n\n`;
    });

    await this.sendMessage(chatId, text, this.getAdminReplyKeyboard());
  }

  // 5. Broadcast Message prompt
  async startBroadcast(chatId) {
    this.adminStates.set(chatId, { step: 'awaiting_broadcast' });
    await this.sendMessage(
      chatId,
      '📢 <b>Broadcast Message:</b>\n\n' +
      'Type the message you want to send to all users, or forward any message:\n\n' +
      '<i>(Type /cancel to cancel)</i>'
    );
  }

  // Perform broadcast
  async performBroadcast(chatId, text) {
    if (!this.supabase || !this.clientBot) {
      return this.sendMessage(chatId, '❌ Broadcast failed: Client bot instance unavailable.');
    }

    const { data: users } = await this.supabase.from('users').select('telegram_id').limit(100000);
    if (!users || users.length === 0) {
      return this.sendMessage(chatId, '⚠️ No users found to broadcast.');
    }

    await this.sendMessage(chatId, `🚀 Sending notification to ${users.length} users...`);

    const notificationMsg =
      `📢 <b>Announcement</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${text}`;

    let sent = 0;
    for (const u of users) {
      try {
        await this.clientBot.sendMessage(u.telegram_id, notificationMsg);
        sent++;
        await new Promise((r) => setTimeout(r, 60)); // Rate limit safety
      } catch (e) {}
    }

    await this.sendMessage(chatId, `✅ <b>Broadcast complete!</b> Delivered to ${sent} users.`, this.getAdminReplyKeyboard());
  }

  // 6. Toggle Withdraw
  async handleToggleWithdraw(chatId) {
    const updated = settingsManager.toggleWithdraw();
    const statusText = updated ? '🟢 ENABLED (ON)' : '🔴 DISABLED (OFF)';
    await this.sendMessage(
      chatId,
      `⚙️ <b>Withdrawal System Status:</b>\n\nCurrent State: <b>${statusText}</b>\n\n` +
      `${updated ? 'Users are now able to submit withdrawals.' : 'Withdrawals are currently paused for users.'}`,
      this.getAdminReplyKeyboard()
    );
  }

  // 7. Sync Number Pool
  async handleSyncPool(chatId) {
    await this.sendMessage(chatId, '🔄 <i>Syncing live numbers & auditing dead numbers from Lamix API, please wait...</i>');
    try {
      const result = await syncNumbersToDatabase(this.supabase);
      const text =
        `✅ <b>Number Pool Sync Complete!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 <b>Live Numbers Synced:</b> <code>${result.totalSynced || result.synced || 0}</code>\n` +
        `🧹 <b>Dead Numbers Purged:</b> <code>${result.totalDeadPurged || 0}</code>\n` +
        `🌐 <b>Ranges Checked:</b> <code>${result.rangesCount || 0}</code>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `<i>Dead numbers removed from panel have been purged from database.</i>`;
      await this.sendMessage(chatId, text, this.getAdminReplyKeyboard());
    } catch (e) {
      await this.sendMessage(chatId, `❌ Sync error: ${e.message}`, this.getAdminReplyKeyboard());
    }
  }

  // 8. App Services Manager
  async handleAppServicesManager(chatId, messageId = null) {
    const services = await this.appServiceManager.getAppServices();

    let text =
      `📱 <b>App Services Manager</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Create services (e.g., SHOPEE 🤝, Discord 👙), link Lamix number pool ranges, and set BDT payout rates per OTP:\n\n`;

    if (services.length === 0) {
      text += `<i>No app services created yet.\nClick "+ Add New App Service" below to create one!</i>\n`;
    } else {
      services.forEach((s, idx) => {
        text += `${idx + 1}. <b>${s.icon || '📱'} ${s.name}</b> (ID: <code>${s.id}</code>)\n`;
      });
    }

    const inlineKeyboard = [];
    services.forEach((s) => {
      inlineKeyboard.push([
        { text: `✏️ Manage ${s.icon || '📱'} ${s.name}`, callback_data: `adm_man_${s.id}` }
      ]);
    });

    inlineKeyboard.push([
      { text: '➕ Add New App Service', callback_data: 'adm_add_srv' }
    ]);
    inlineKeyboard.push([
      { text: '« Back to Admin Menu', callback_data: 'adm_back_menu' }
    ]);

    if (messageId) {
      await this.editMessageText(chatId, messageId, text, { inline_keyboard: inlineKeyboard });
    } else {
      await this.sendMessage(chatId, text, { inline_keyboard: inlineKeyboard });
    }
  }

  // 8.1 Manage Specific Service
  async handleManageSpecificService(chatId, serviceId, messageId = null) {
    const services = await this.appServiceManager.getAppServices();
    const service = services.find(s => s.id === serviceId);

    if (!service) {
      return this.handleAppServicesManager(chatId, messageId);
    }

    const mappings = await this.appServiceManager.getRangesForService(serviceId);
    const poolRanges = await this.appServiceManager.getAvailableRangesFromPool();

    let text =
      `📱 <b>Service: ${service.icon || '📱'} ${service.name}</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>Linked Ranges (${mappings.length}):</b>\n\n`;

    if (mappings.length === 0) {
      text += `<i>No ranges linked to this service yet. Click "🔗 Link Range to this Service" below.</i>\n`;
    } else {
      mappings.forEach((m, idx) => {
        const poolInfo = poolRanges.find(p => p.range_id === m.range_id || p.prefix === m.prefix);
        const stock = poolInfo ? poolInfo.available_stock : 0;
        text += `${idx + 1}. 🌍 <b>${m.country || m.display_name || m.range_name}</b> | ৳${Number(m.rate_bdt).toFixed(2)}/OTP | Stock: <b>${stock}</b>\n`;
      });
    }

    const buttons = [];

    // Unlink buttons
    mappings.forEach((m) => {
      buttons.push([
        { text: `❌ Unlink ${m.country || m.display_name || m.range_name}`, callback_data: `adm_unl_${m.id}` }
      ]);
    });

    buttons.push([
      { text: '🔗 Link Range to this Service', callback_data: `adm_lnk_${serviceId}` }
    ]);
    buttons.push([
      { text: '🗑️ Delete App Service', callback_data: `adm_del_${serviceId}` }
    ]);
    buttons.push([
      { text: '« Back to Services Manager', callback_data: 'adm_all_srv' }
    ]);

    if (messageId) {
      await this.editMessageText(chatId, messageId, text, { inline_keyboard: buttons });
    } else {
      await this.sendMessage(chatId, text, { inline_keyboard: buttons });
    }
  }

  // 8.2 Link Range Step 1: Pick range from pool
  async handlePickRangeForService(chatId, serviceId, messageId = null) {
    const services = await this.appServiceManager.getAppServices();
    const service = services.find(s => s.id === serviceId);
    const serviceName = service ? service.name : 'Service';

    const poolRanges = await this.appServiceManager.getAvailableRangesFromPool();

    if (poolRanges.length === 0) {
      const emptyMsg = '⚠️ No unassigned ranges available in the number pool. Click "🔄 Sync Number Pool" from the menu first.';
      if (messageId) {
        return this.editMessageText(chatId, messageId, emptyMsg, {
          inline_keyboard: [[{ text: '« Back', callback_data: `adm_man_${serviceId}` }]]
        });
      }
      return this.sendMessage(chatId, emptyMsg);
    }

    // Cache ranges and serviceId in admin state
    this.adminStates.set(chatId, {
      serviceId,
      cachedRanges: poolRanges
    });

    let text =
      `🔗 <b>Link Range to ${serviceName}:</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Select a range from the number pool:\n\n`;

    const buttons = poolRanges.map((r, idx) => [
      {
        text: `🌍 ${r.range_name} (${r.country}) [Stock: ${r.available_stock}]`,
        callback_data: `adm_r_${idx}`
      }
    ]);

    buttons.push([{ text: '« Cancel', callback_data: `adm_man_${serviceId}` }]);

    if (messageId) {
      await this.editMessageText(chatId, messageId, text, { inline_keyboard: buttons });
    } else {
      await this.sendMessage(chatId, text, { inline_keyboard: buttons });
    }
  }

  // 9. Referral Rewards
  async handleReferralRewards(chatId) {
    if (!this.supabase) return;

    const { data: refStats } = await this.supabase
      .from('referrals')
      .select('referrer_id')
      .limit(100000);

    const totalReferrals = refStats ? refStats.length : 0;

    const countMap = {};
    (refStats || []).forEach(r => {
      countMap[r.referrer_id] = (countMap[r.referrer_id] || 0) + 1;
    });

    const sorted = Object.entries(countMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
    let topList = '';
    if (sorted.length === 0) {
      topList = '<i>No referral records yet.</i>\n';
    } else {
      const userIds = sorted.map(([id]) => Number(id));
      const { data: users } = await this.supabase
        .from('users')
        .select('telegram_id, username, first_name')
        .in('telegram_id', userIds);

      const userMap = {};
      (users || []).forEach(u => { userMap[u.telegram_id] = u; });

      sorted.forEach(([refId, cnt], idx) => {
        const u = userMap[Number(refId)];
        const name = u?.first_name || u?.username || `ID ${refId}`;
        topList += `${idx + 1}. <b>${name}</b> (<code>${refId}</code>) — <b>${cnt} referrals</b>\n`;
      });
    }

    const minWd = settingsManager.get('min_withdraw');

    const text =
      `🎁 <b>Referral Rewards & Top Referrers</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👥 Total Referrals: <b>${totalReferrals}</b>\n` +
      `💵 Minimum Withdrawal: <b>৳${minWd} BDT</b>\n\n` +
      `🏆 <b>Top Referrers:</b>\n` +
      topList +
      `\n<i>Users invite friends via the Mini App 'Referrals' tab.</i>`;

    await this.sendMessage(chatId, text, this.getAdminReplyKeyboard());
  }

  // 10. Set Min Withdraw
  async handleSetMinWithdraw(chatId) {
    this.adminStates.set(chatId, { step: 'awaiting_min_withdraw' });
    const current = settingsManager.get('min_withdraw');
    await this.sendMessage(
      chatId,
      `💵 <b>Set Minimum Withdrawal Limit:</b>\n\n` +
      `Current Limit: <b>৳${current} BDT</b>\n\n` +
      `Enter new minimum withdrawal amount (e.g., 50):\n` +
      `<i>(Type /cancel to cancel)</i>`
    );
  }

  // 11. Admin Help
  async handleAdminHelp(chatId) {
    const helpUser = settingsManager.get('admin_help_username', 'AdminSupport');
    const text =
      `ℹ️ <b>Admin Control Center & Guide</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `• <b>System Stats:</b> Overview of total earnings, paid amounts, stock & balances.\n` +
      `• <b>Pending Withdrawals:</b> 1-click Approve (Paid) or Reject (Auto Refund).\n` +
      `• <b>Broadcast Message:</b> Send announcements or forward messages to all clients.\n` +
      `• <b>App Services Manager:</b> Create services, link Lamix ranges, set BDT payout rate.\n` +
      `• <b>Withdraw ON/OFF:</b> Toggle withdrawals globally anytime.\n` +
      `• <b>Sync Number Pool:</b> Fetch active number pool from Lamix API.\n\n` +
      `📞 <b>Admin Support Contact:</b> @${helpUser}\n` +
      `🔑 <b>Admin Password:</b> <code>WHALE@123</code>`;

    await this.sendMessage(chatId, text, this.getAdminReplyKeyboard());
  }

  // Instant 1-click notification when user submits withdrawal
  async sendWithdrawalAlert(data) {
    const msg =
      `🚨 <b>New Withdrawal Request!</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 User: @${data.username} (ID: <code>${data.telegramId}</code>)\n` +
      `💰 Amount: <b>৳${data.amount} BDT</b>\n` +
      `🏦 Account: <b>${data.details}</b>\n\n` +
      `<i>Approve or reject below:</i>`;

    const buttons = {
      inline_keyboard: [
        [
          { text: '✅ Approve (Paid)', callback_data: `wd_app_${data.id}` },
          { text: '❌ Reject (Refund)', callback_data: `wd_rej_${data.id}` }
        ]
      ]
    };

    for (const adminId of this.authenticatedAdmins) {
      await this.sendMessage(adminId, msg, buttons);
    }
  }

  // Polling loop
  startPolling() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('👑 Admin Bot (@OTP_LIFE_ADMIN_bot) polling started...');
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
        console.error('AdminBot update polling error:', err.message);
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
  }

  async handleUpdate(update) {
    if (update.message) {
      console.log(`👑 AdminBot Msg from ${update.message.chat.id}: "${update.message.text}"`);
      await this.handleMessage(update.message);
    } else if (update.callback_query) {
      console.log(`👑 AdminBot CB from ${update.callback_query.from.id}: "${update.callback_query.data}"`);
      await this.handleCallback(update.callback_query);
    }
  }

  async handleMessage(msg) {
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();

    // Check cancellation
    if (text === '/cancel') {
      this.adminStates.delete(chatId);
      return this.sendMessage(chatId, '❌ Operation cancelled.', this.getAdminReplyKeyboard());
    }

    // 1. /start or /menu Command
    if (text === '/start' || text.startsWith('/start') || text === '/menu' || text.toLowerCase() === 'menu') {
      return this.handleStart(chatId);
    }

    // 2. Password Check if not authenticated
    if (!this.authenticatedAdmins.has(Number(chatId))) {
      const targetPassword = settingsManager.get('admin_password');

      if (text.trim().toUpperCase() === targetPassword.trim().toUpperCase()) {
        this.authenticatedAdmins.add(Number(chatId));
        saveAuthenticatedAdmins(this.authenticatedAdmins);
        this.adminStates.delete(chatId);
        return this.showDashboard(chatId);
      } else {
        return this.sendMessage(
          chatId,
          '❌ <b>Incorrect Password!</b>\n\nPlease enter the correct admin password (e.g. <code>WHALE@123</code>):'
        );
      }
    }

    // Direct Forwarded Message Detection
    const isForwarded = Boolean(msg.forward_date || msg.forward_origin || msg.forward_from || msg.forward_from_chat);
    if (isForwarded && (msg.text || msg.caption)) {
      const forwardContent = (msg.text || msg.caption).trim();
      this.adminStates.set(chatId, { step: 'confirm_forward_broadcast', content: forwardContent });
      return this.sendMessage(
        chatId,
        `📢 <b>Forwarded Message Detected!</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
        `<i>"${forwardContent}"</i>\n\n` +
        `Do you want to broadcast this message to <b>all clients</b>?`,
        {
          inline_keyboard: [
            [
              { text: '🚀 Yes, Broadcast to All', callback_data: 'adm_confirm_broadcast' },
              { text: '❌ Cancel', callback_data: 'adm_cancel_broadcast' }
            ]
          ]
        }
      );
    }

    // Check conversational states
    const state = this.adminStates.get(chatId);

    if (state) {
      // A. Awaiting Broadcast Message
      if (state.step === 'awaiting_broadcast') {
        const broadcastText = (msg.text || msg.caption || text).trim();
        this.adminStates.delete(chatId);
        return this.performBroadcast(chatId, broadcastText);
      }

      // B. Awaiting Min Withdraw Amount
      if (state.step === 'awaiting_min_withdraw') {
        const val = parseFloat(text);
        if (isNaN(val) || val < 1) {
          return this.sendMessage(chatId, '❌ Enter a valid number (e.g. 50):');
        }
        settingsManager.set('min_withdraw', val);
        this.adminStates.delete(chatId);
        return this.sendMessage(
          chatId,
          `✅ <b>Minimum withdrawal limit set to ৳${val} BDT!</b>`,
          this.getAdminReplyKeyboard()
        );
      }

      // C. Awaiting New App Service Name
      if (state.step === 'awaiting_new_service_name') {
        if (!text) {
          return this.sendMessage(chatId, '❌ Enter the service name (e.g. SHOPEE 🤝):');
        }
        this.adminStates.delete(chatId);

        const iconMatch = text.match(/[\p{Emoji}\u200d]+/u);
        const icon = iconMatch ? iconMatch[0] : '📱';
        const cleanName = text.replace(/[\p{Emoji}\u200d]+/u, '').trim() || text;

        const created = await this.appServiceManager.createAppService({
          name: cleanName,
          icon
        });

        await this.sendMessage(
          chatId,
          `✅ <b>New App Service "${created.icon} ${created.name}" created successfully!</b>`
        );
        return this.handleManageSpecificService(chatId, created.id);
      }

      // D. Awaiting Range Payout Rate (Step 1)
      if (state.step === 'awaiting_range_price') {
        const rateVal = parseFloat(text);
        if (isNaN(rateVal) || rateVal <= 0) {
          return this.sendMessage(chatId, '❌ Enter a valid payout rate (e.g. 0.80 or 1.50):');
        }

        const { serviceId, range } = state;
        this.adminStates.set(chatId, {
          step: 'awaiting_range_name',
          serviceId,
          range,
          rateBdt: rateVal
        });

        return this.sendMessage(
          chatId,
          `🏷️ <b>Step 2: Set Display Name / Country for this Range</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
          `What name should be shown to clients in the Mini App for this range?\n\n` +
          `Example: <code>PHILIPPINES 🇵🇭</code> or <code>Algeria 🇩🇿</code>\n\n` +
          `👉 Type <code>default</code> to use default name <b>"${range.country}"</b>:`
        );
      }

      // E. Awaiting Range Display Name (Step 2)
      if (state.step === 'awaiting_range_name') {
        const { serviceId, range, rateBdt } = state;
        this.adminStates.delete(chatId);

        const customName = (text.toLowerCase() === 'default' || !text)
          ? range.country
          : text.trim();

        await this.appServiceManager.linkRangeToService({
          serviceId,
          rangeId: range.range_id,
          rangeName: range.range_name,
          displayName: customName,
          rateBdt,
          prefix: range.prefix,
          country: customName
        });

        await this.sendMessage(
          chatId,
          `✅ <b>Range linked successfully!</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
          `🌍 Display Name: <b>${customName}</b>\n` +
          `💰 Rate: <b>৳${rateBdt.toFixed(2)}/OTP</b>\n` +
          `📦 Stock: <b>${range.available_stock}</b>\n\n` +
          `<i>This range is now available in the Mini App.</i>`
        );

        return this.handleManageSpecificService(chatId, serviceId);
      }
    }

    // Main Menu Commands & Button Clicks
    if (text === '/start') {
      return this.handleStart(chatId);
    }
    if (text === '/menu') {
      return this.showDashboard(chatId);
    }
    if (text === '📊 System Stats') {
      return this.handleSystemStats(chatId);
    }
    if (text === '⏳ Pending Withdrawals') {
      return this.handlePendingWithdrawals(chatId);
    }
    if (text === '👥 Client List') {
      return this.handleClientList(chatId);
    }
    if (text === '📜 Withdrawal History') {
      return this.handleWithdrawalHistory(chatId);
    }
    if (text === '📢 Broadcast Message') {
      return this.startBroadcast(chatId);
    }
    if (text.includes('Withdraw: ON') || text.includes('Withdraw: OFF')) {
      return this.handleToggleWithdraw(chatId);
    }
    if (text === '🔄 Sync Number Pool') {
      return this.handleSyncPool(chatId);
    }
    if (text === '📱 App Services Manager') {
      return this.handleAppServicesManager(chatId);
    }
    if (text === '🎁 Referral Rewards') {
      return this.handleReferralRewards(chatId);
    }
    if (text === '💵 Set Min Withdraw') {
      return this.handleSetMinWithdraw(chatId);
    }
    if (text === 'ℹ️ Admin Help') {
      return this.handleAdminHelp(chatId);
    }

    // Default fallback
    return this.showDashboard(chatId);
  }

  async handleCallback(cb) {
    const chatId = cb.message.chat.id;
    const messageId = cb.message.message_id;
    const data = cb.data;

    // Check admin auth
    if (!this.authenticatedAdmins.has(chatId)) {
      await this.answerCallback(cb.id, 'Please authenticate with password first.', true);
      return this.handleStart(chatId);
    }

    await this.answerCallback(cb.id);

    // Broadcast Confirmation Callbacks
    if (data === 'adm_confirm_broadcast') {
      const state = this.adminStates.get(chatId);
      const content = state?.content;
      this.adminStates.delete(chatId);
      if (content) {
        await this.editMessageText(chatId, messageId, '🚀 Broadcast sending started...');
        return this.performBroadcast(chatId, content);
      }
      return this.sendMessage(chatId, '⚠️ Broadcast content not found.', this.getAdminReplyKeyboard());
    }

    if (data === 'adm_cancel_broadcast') {
      this.adminStates.delete(chatId);
      await this.editMessageText(chatId, messageId, '❌ Broadcast cancelled.');
      return this.sendMessage(chatId, 'Operation cancelled.', this.getAdminReplyKeyboard());
    }

    // 1. Approve Withdrawal
    if (data.startsWith('wd_app_')) {
      const id = data.replace('wd_app_', '');
      const { data: wd } = await this.supabase.from('withdrawals').select('*').eq('id', id).maybeSingle();

      if (!wd || wd.status !== 'PENDING') {
        return this.editMessageText(chatId, messageId, '⚠️ This withdrawal has already been processed.');
      }

      await this.supabase.from('withdrawals').update({ status: 'APPROVED', processed_at: new Date().toISOString() }).eq('id', id);

      // Notify User
      if (this.clientBot) {
        this.clientBot.sendMessage(
          wd.telegram_id,
          `✅ <b>Withdrawal Approved!</b>\n\n` +
          `Your <b>৳${wd.amount} BDT</b> payout (${wd.method} • ${wd.wallet_address}) has been sent successfully.\nThank you!`
        ).catch(() => {});
      }

      return this.editMessageText(chatId, messageId, `✅ <b>Withdrawal #${id} (৳${wd.amount}) approved successfully!</b>`);
    }

    // 2. Reject Withdrawal
    if (data.startsWith('wd_rej_')) {
      const id = data.replace('wd_rej_', '');
      const { data: wd } = await this.supabase.from('withdrawals').select('*').eq('id', id).maybeSingle();

      if (!wd || wd.status !== 'PENDING') {
        return this.editMessageText(chatId, messageId, '⚠️ This withdrawal has already been processed.');
      }

      // Refund user balance
      const { data: user } = await this.supabase.from('users').select('balance').eq('telegram_id', wd.telegram_id).maybeSingle();
      if (user) {
        await this.supabase.from('users').update({
          balance: Number((user.balance + Number(wd.amount)).toFixed(2))
        }).eq('telegram_id', wd.telegram_id);
      }

      await this.supabase.from('withdrawals').update({ status: 'REJECTED', processed_at: new Date().toISOString() }).eq('id', id);

      // Notify User
      if (this.clientBot) {
        this.clientBot.sendMessage(
          wd.telegram_id,
          `❌ <b>Withdrawal Rejected!</b>\n\n` +
          `Your <b>৳${wd.amount} BDT</b> withdrawal was rejected, and the full amount has been refunded to your balance.`
        ).catch(() => {});
      }

      return this.editMessageText(chatId, messageId, `❌ <b>Withdrawal #${id} rejected and balance refunded.</b>`);
    }

    // 3. App Services Manager Callbacks
    if (data === 'adm_goto_services' || data === 'adm_back_menu' || data === 'adm_all_srv') {
      return this.handleAppServicesManager(chatId, messageId);
    }

    if (data === 'adm_add_srv' || data === 'adm_add_new_service') {
      this.adminStates.set(chatId, { step: 'awaiting_new_service_name' });
      return this.sendMessage(
        chatId,
        '📝 <b>Enter the name and icon for the new service:</b>\n\n' +
        'Example:\n<code>SHOPEE 🤝</code>\nor\n<code>Discord 👙</code>\n\n' +
        '<i>(Type /cancel to cancel)</i>'
      );
    }

    // Manage Service: adm_man_<serviceId>
    if (data.startsWith('adm_man_')) {
      const serviceId = data.replace('adm_man_', '');
      return this.handleManageSpecificService(chatId, serviceId, messageId);
    }

    // Link Range button clicked: adm_lnk_<serviceId>
    if (data.startsWith('adm_lnk_')) {
      const serviceId = data.replace('adm_lnk_', '');
      return this.handlePickRangeForService(chatId, serviceId, messageId);
    }

    // Picked range by index: adm_r_<idx>
    if (data.startsWith('adm_r_')) {
      const idx = parseInt(data.replace('adm_r_', ''));
      const state = this.adminStates.get(chatId);
      const serviceId = state?.serviceId;
      const range = state?.cachedRanges?.[idx];

      if (!range || !serviceId) {
        return this.sendMessage(chatId, '⚠️ Range info not found. Please try again: /menu');
      }

      this.adminStates.set(chatId, {
        step: 'awaiting_range_price',
        serviceId,
        range
      });

      return this.sendMessage(
        chatId,
        `💰 <b>Step 1: Set Payout Rate (Price BDT per OTP)</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Selected Range: <b>${range.range_name} (${range.country})</b>\n` +
        `Current Stock: <b>${range.available_stock} numbers</b>\n\n` +
        `How much will clients earn per OTP?\n` +
        `<i>(e.g.: <code>0.80</code> or <code>1.50</code> or <code>2.00</code>)</i>\n\n` +
        `<i>(Type /cancel to cancel)</i>`
      );
    }

    // Unlink Range: adm_unl_<mappingId>
    if (data.startsWith('adm_unl_')) {
      const mappingId = data.replace('adm_unl_', '');
      const state = this.adminStates.get(chatId);
      await this.appServiceManager.unlinkRangeFromService(mappingId);
      await this.sendMessage(chatId, '✅ Range unlinked successfully.');
      if (state?.serviceId) {
        return this.handleManageSpecificService(chatId, state.serviceId);
      }
      return this.handleAppServicesManager(chatId, messageId);
    }

    // Delete App Service: adm_del_<serviceId>
    if (data.startsWith('adm_del_')) {
      const serviceId = data.replace('adm_del_', '');
      await this.appServiceManager.deleteAppService(serviceId);
      await this.sendMessage(chatId, '🗑️ Service deleted successfully.');
      return this.handleAppServicesManager(chatId, messageId);
    }
  }
}

module.exports = AdminBot;
