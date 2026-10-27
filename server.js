'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const { supabase } = require('./config/supabase');
const { syncNumbersToDatabase, fetchAllSupabaseRows } = require('./services/lamixApi');
const ClientBot = require('./services/clientBot');
const AdminBot = require('./services/adminBot');
const CdrPoller = require('./services/cdrPoller');
const settingsManager = require('./services/settingsManager');

const app = express();
const PORT = process.env.PORT || 3000;
const CLIENT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_BOT_TOKEN = process.env.ADMIN_BOT_TOKEN || '';
const WEBAPP_URL = process.env.WEBAPP_URL || `http://localhost:${PORT}`;

// Middleware
app.use(cors());
app.use(express.json());

const { extractCountryInfo } = require('./services/otpExtractor');

function getCountryFlag(country = '', dialCode = '') {
  return extractCountryInfo(country, dialCode).flag || '🌐';
}

// Telegram WebApp initData validation helper
function validateTelegramInitData(initData, botToken) {
  if (!botToken || !initData) return false;
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) return false;

    urlParams.delete('hash');
    const params = Array.from(urlParams.entries())
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(params).digest('hex');

    return calculatedHash === hash;
  } catch (err) {
    return false;
  }
}

// ==========================================
// 🤖 Initialize Bots & Background Engines
// ==========================================
const AppServiceManager = require('./services/appServiceManager');
const appServiceManager = new AppServiceManager(supabase);

let clientBot = null;
let adminBot = null;
let cdrPoller = null;

if (CLIENT_BOT_TOKEN && ADMIN_BOT_TOKEN) {
  // 1. Admin Bot
  adminBot = new AdminBot(ADMIN_BOT_TOKEN, supabase, null, appServiceManager, WEBAPP_URL);

  // 2. Client Bot (with callback to notify Admin Bot on withdrawal)
  clientBot = new ClientBot(CLIENT_BOT_TOKEN, supabase, WEBAPP_URL, (withdrawalData) => {
    if (adminBot) {
      adminBot.sendWithdrawalAlert(withdrawalData);
    }
  }, appServiceManager);

  // Link clientBot back into adminBot and vice versa
  adminBot.clientBot = clientBot;
  clientBot.adminBot = adminBot;

  // 3. Lamix CDR Poller Loop
  cdrPoller = new CdrPoller(supabase, clientBot);

  // Start polling
  clientBot.startPolling();
  clientBot.setGlobalMenuButton().catch(() => {});
  adminBot.startPolling();
  cdrPoller.start();

  // 🔄 Continuous Initial Sync: keeps syncing until ALL numbers from Lamix API are 100% in DB
  const startContinuousPoolSync = async () => {
    let allSynced = false;
    let attempt = 1;
    while (!allSynced) {
      console.log(`🔄 [Continuous Sync Attempt ${attempt}] Syncing all numbers from Lamix API...`);
      try {
        const result = await syncNumbersToDatabase(supabase);
        if (result && result.success && result.allRangesCompleted) {
          allSynced = true;
          console.log(`🎉 [Continuous Sync SUCCESS] All ${result.totalSynced || 0} numbers from Lamix API are 100% synchronized into database!`);
        } else {
          console.warn(`⚠️ [Continuous Sync] Incomplete sync (got ${result?.totalSynced || 0}/${result?.expectedTotal || '?'}). Retrying in 15 seconds...`);
          await new Promise(r => setTimeout(r, 15000));
        }
      } catch (err) {
        console.error('❌ [Continuous Sync Error]:', err.message, '- retrying in 15s...');
        await new Promise(r => setTimeout(r, 15000));
      }
      attempt++;
    }

    // 🔄 Automatic Periodic Pool Sync & Stock Maintenance — every 5 minutes
    console.log('🔄 [Pool Sync] Scheduled continuous background sync every 5 minutes.');
    setInterval(() => {
      console.log('🔄 [Scheduled 5m Pool Sync] Checking and updating Lamix stock...');
      syncNumbersToDatabase(supabase).catch(err => {
        console.warn('⚠️ [Scheduled Pool Sync Error]:', err.message);
      });
    }, 5 * 60 * 1000);
  };

  startContinuousPoolSync().catch(err => {
    console.error('Fatal startup sync error:', err.message);
  });
} else {
  console.warn('⚠️ Both TELEGRAM_BOT_TOKEN and ADMIN_BOT_TOKEN are required in .env for full bot operation.');
}


// ==========================================
// 📡 REST API Endpoints (Connected to Supabase)
// ==========================================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'OTP LIFE - Fullstack Telegram Mini App & Multi-Bot Platform',
    supabaseConnected: !!supabase
  });
});

// Get User Profile from Supabase
app.post('/api/auth/telegram', async (req, res) => {
  const { initData, user: rawUser } = req.body;

  let tgId = rawUser?.id;
  if (!tgId && initData) {
    try {
      const parsed = JSON.parse(new URLSearchParams(initData).get('user') || '{}');
      if (parsed.id) tgId = parsed.id;
    } catch (e) {}
  }
  if (!tgId) tgId = 123456789;

  if (!supabase) {
    return res.json({ success: true, user: { telegram_id: tgId, balance: 0.00 } });
  }

  let { data: user } = await supabase.from('users').select('*').eq('telegram_id', tgId).maybeSingle();

  if (!user) {
    const newUser = {
      telegram_id: tgId,
      username: rawUser?.username || `user_${tgId}`,
      first_name: rawUser?.first_name || 'User',
      balance: 0.00,
      total_earnings: 0.00,
      total_withdrawn: 0.00,
      total_sms: 0
    };
    const { data: created } = await supabase.from('users').insert(newUser).select().single();
    user = created;
  }

  res.json({ success: true, user });
});

// Comprehensive User Live Data (Active Numbers, Live OTPs, Withdrawals, Referrals)
app.get('/api/user-data', async (req, res) => {
  const tgId = req.query.telegram_id;
  if (!tgId) return res.status(400).json({ error: 'telegram_id is required' });

  if (!supabase) {
    return res.json({
      success: true,
      user: { telegram_id: tgId, balance: 0, total_earnings: 0, total_withdrawn: 0, total_sms: 0 },
      activeNumbers: [],
      smsMessages: [],
      withdrawals: [],
      referralStats: { count: 0, active: 0, bonus: 0 }
    });
  }

  const nowIso = new Date().toISOString();
  const [userRes, activeNumbersRes, cdrRes, txnRes, wdRes, refRes] = await Promise.all([
    supabase.from('users').select('*').eq('telegram_id', tgId).maybeSingle(),
    supabase.from('assigned_numbers').select('*').eq('telegram_id', tgId).eq('status', 'ACTIVE').gt('expires_at', nowIso).order('assigned_at', { ascending: false }).limit(100000),
    supabase.from('cdr_logs').select('*').eq('telegram_id', tgId).order('cdr_time', { ascending: false }).limit(1000),
    supabase.from('transactions').select('*').eq('telegram_id', tgId).eq('type', 'EARNING').order('created_at', { ascending: false }).limit(1000),
    supabase.from('withdrawals').select('*').eq('telegram_id', tgId).order('requested_at', { ascending: false }).limit(50),
    supabase.from('referrals').select('*').eq('referrer_id', tgId).limit(100000)
  ]);

  const referrals = refRes.data || [];
  const activeReferrals = referrals.filter(r => r.is_eligible || (r.total_otp_received || 0) > 0).length;

  // Build combined deduplicated incoming OTP inbox for this user
  const { extractOtp } = require('./services/lamixApi');
  const seenMsgKeys = new Set();
  const combinedSms = [];

  const cleanKey = (num, text) => {
    const n = String(num || '').replace(/\D/g, '');
    const t = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
    return `${n}:::${t}`;
  };

  for (const c of (cdrRes.data || [])) {
    const key = cleanKey(c.number, c.content);
    if (!seenMsgKeys.has(key)) {
      seenMsgKeys.add(key);
      combinedSms.push({
        id: `cdr_${c.id}`,
        number: c.number,
        serviceName: c.range_name || c.cli || 'SMS',
        cli: c.cli,
        code: c.extracted_otp,
        text: c.content,
        earned: Number(c.payout_bdt) || 0,
        receivedAt: c.cdr_time || c.created_at
      });
    }
  }

  for (const t of (txnRes.data || [])) {
    const key = cleanKey(t.number, t.sms_text);
    if (!seenMsgKeys.has(key)) {
      seenMsgKeys.add(key);
      combinedSms.push({
        id: `txn_${t.id}`,
        number: t.number,
        serviceName: t.range_name || t.cli || 'SMS',
        cli: t.cli,
        code: extractOtp(t.sms_text),
        text: t.sms_text,
        earned: Number(t.amount) || 0,
        receivedAt: t.created_at
      });
    }
  }

  // Sort newest first
  combinedSms.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));

  // Compute daily OTP count for today (Bangladesh Time UTC+6)
  const now = new Date();
  const bdTime = new Date(now.getTime() + (6 * 60 * 60 * 1000));
  const todayStartUtc = new Date(Date.UTC(bdTime.getUTCFullYear(), bdTime.getUTCMonth(), bdTime.getUTCDate(), -6, 0, 0, 0));
  const todayStartTime = todayStartUtc.getTime();

  const todaySmsList = combinedSms.filter(s => {
    const t = new Date(s.receivedAt).getTime();
    return !isNaN(t) && t >= todayStartTime;
  });
  const dailyOtpCount = Math.min(1000, todaySmsList.length);

  // Match service icons from app_services
  const appServices = await appServiceManager.getAppServices();
  const serviceIconMap = {};
  for (const s of (appServices || [])) {
    if (s.name) serviceIconMap[s.name.toLowerCase().trim()] = s.icon || '📱';
    if (s.id) serviceIconMap[s.id.toLowerCase().trim()] = s.icon || '📱';
  }

  res.json({
    success: true,
    user: userRes.data || { telegram_id: tgId, balance: 0, total_earnings: 0, total_withdrawn: 0, total_sms: 0 },
    activeNumbers: (activeNumbersRes.data || []).map(a => {
      const sName = a.range_name || 'SMS Service';
      const cleanKey = sName.toLowerCase().trim();
      const iconMatch = sName.match(/[\p{Emoji}\u200d]+/u);
      const icon = iconMatch ? iconMatch[0] : (serviceIconMap[cleanKey] || '📱');
      return {
        id: String(a.id),
        serviceId: a.range_id || 'service',
        serviceName: sName,
        serviceIcon: icon,
        country: a.country || 'Global',
        flag: getCountryFlag(a.country, a.dial_code),
        dialCode: a.dial_code || '+213',
        number: a.number,
        localNumber: a.local_number || a.number,
        payoutRate: Number(a.payout_bdt) || 0.80,
        assignedAt: a.assigned_at,
        expiresAt: a.expires_at,
        status: a.status
      };
    }),
    dailyOtpCount,
    dailyLimit: 1000,
    smsMessages: combinedSms.slice(0, 1000),
    withdrawals: (wdRes.data || []).map(w => ({
      id: String(w.id),
      amount: Number(w.amount),
      method: w.method,
      walletAddress: w.wallet_address,
      status: w.status,
      date: new Date(w.requested_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
    })),
    referralStats: {
      count: referrals.length,
      active: activeReferrals,
      bonus: activeReferrals * 10
    },
    withdrawEnabled: Boolean(settingsManager.get('withdraw_enabled')),
    minWithdraw: Number(settingsManager.get('min_withdraw') || 20)
  });
});

// Services List with Real Stock from number_pool and AppServiceManager mappings
app.get('/api/services', async (req, res) => {
  const dbServices = await appServiceManager.getAppServices();

  const poolNumbers = supabase
    ? await fetchAllSupabaseRows(() =>
        supabase.from('number_pool').select('range_id, range_name, prefix, country, is_assigned')
      )
    : [];

  const poolCounts = {};
  for (const item of (poolNumbers || [])) {
    if (!item.is_assigned) {
      if (item.range_id) poolCounts[item.range_id] = (poolCounts[item.range_id] || 0) + 1;
      if (item.prefix) {
        const cleanP = String(item.prefix).replace(/\D/g, '');
        poolCounts[cleanP] = (poolCounts[cleanP] || 0) + 1;
      }
      if (item.range_name) {
        poolCounts[item.range_name] = (poolCounts[item.range_name] || 0) + 1;
      }
    }
  }

  const services = [];
  for (const srv of (dbServices || [])) {
    const mappings = await appServiceManager.getRangesForService(srv.id);
    const ranges = mappings.map(m => {
      const cleanPrefix = m.prefix ? String(m.prefix).replace(/\D/g, '') : '';
      const stock = poolCounts[m.range_id] || (cleanPrefix ? poolCounts[cleanPrefix] : 0) || (m.range_name ? poolCounts[m.range_name] : 0) || 0;
      const c = m.country || m.display_name || 'Global';
      const flag = getCountryFlag(c, m.prefix);

      return {
        id: m.id || m.range_id,
        rangeId: m.range_id,
        country: c,
        flag,
        dialCode: m.prefix ? `+${m.prefix}` : '+213',
        rate: Number(m.rate_bdt) || 1.50,
        stock,
        provider: m.range_name || 'Lamix Provider'
      };
    });

    services.push({
      id: srv.id,
      name: srv.name,
      category: srv.category || 'general',
      icon: srv.icon || '📱',
      isPopular: true,
      badge: ranges.length > 0 ? 'Live Stock' : 'No Ranges Linked',
      ranges
    });
  }

  const availableCount = (poolNumbers || []).filter(p => !p.is_assigned).length;
  res.json({ success: true, services, totalAvailableNumbers: availableCount });
});

// Claim Real Virtual Number from Pool
app.post('/api/claim-number', async (req, res) => {
  const { userId, serviceId, serviceName, dialCode, rangeId, rateBdt, quantity = 1 } = req.body;
  const tgId = userId || 123456789;

  if (!supabase) {
    return res.status(503).json({ error: 'Database connection is not active.' });
  }

  // 1. Fetch currently active numbers to prevent collision
  const activeAssigned = await fetchAllSupabaseRows(() =>
    supabase
      .from('assigned_numbers')
      .select('number')
      .eq('status', 'ACTIVE')
      .gt('expires_at', new Date().toISOString())
  );

  const activeNumSet = new Set((activeAssigned || []).map(a => String(a.number).replace(/\D/g, '')));

  // 2. Query available candidate numbers from number_pool
  let query = supabase.from('number_pool').select('*').eq('is_assigned', false);
  if (rangeId) {
    query = query.eq('range_id', rangeId);
  } else if (dialCode) {
    query = query.eq('prefix', String(dialCode).replace('+', ''));
  }

  const { data: poolItems, error: poolErr } = await query.limit(20);

  if (poolErr || !poolItems || poolItems.length === 0) {
    return res.status(400).json({ error: 'No numbers currently available for this service. Please try another service or check back soon.' });
  }

  // Filter candidates that are truly free
  const freeItems = poolItems.filter(p => !activeNumSet.has(String(p.number).replace(/\D/g, '')));

  if (freeItems.length === 0) {
    return res.status(400).json({ error: 'All numbers for this service are currently claimed. Please try another range.' });
  }

  // Shuffle candidates to prevent concurrent users from targeting the exact same number
  for (let i = freeItems.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [freeItems[i], freeItems[j]] = [freeItems[j], freeItems[i]];
  }

  const countToClaim = Math.min(Math.max(parseInt(quantity) || 1, 1), 6);
  const targetBatch = freeItems.slice(0, countToClaim);

  // Number reservation duration: 1 day (24 hours)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const assignedList = [];

  for (const poolItem of targetBatch) {
    // Atomic update in number_pool
    const { data: claimedRow } = await supabase
      .from('number_pool')
      .update({ is_assigned: true, assigned_to: tgId, assigned_at: new Date().toISOString() })
      .eq('id', poolItem.id)
      .eq('is_assigned', false)
      .select();

    if (!claimedRow || claimedRow.length === 0) continue;

    const payoutRate = Number(rateBdt) || Number(poolItem.payout_bdt) || 0.80;

    // Insert into assigned_numbers
    const { data: assigned, error: asgErr } = await supabase
      .from('assigned_numbers')
      .insert({
        telegram_id: tgId,
        number: poolItem.number,
        local_number: poolItem.number.replace(new RegExp(`^${poolItem.prefix}`), ''),
        range_id: poolItem.range_id,
        range_name: serviceName || poolItem.range_name || 'SMS Service',
        country: poolItem.country,
        dial_code: `+${poolItem.prefix}`,
        payout_bdt: payoutRate,
        payout_usd: poolItem.payout_usd || 0.01,
        expires_at: expiresAt,
        status: 'ACTIVE'
      })
      .select()
      .single();

    if (assigned) {
      assignedList.push({
        id: String(assigned.id),
        serviceId: serviceId || 'service',
        serviceName: serviceName || assigned.range_name || 'Service',
        country: assigned.country,
        flag: getCountryFlag(assigned.country, assigned.dial_code),
        dialCode: assigned.dial_code,
        number: assigned.number,
        localNumber: assigned.local_number || assigned.number,
        payoutRate: Number(assigned.payout_bdt),
        assignedAt: assigned.assigned_at,
        expiresAt: assigned.expires_at,
        status: assigned.status
      });
    }
  }

  if (assignedList.length === 0) {
    return res.status(500).json({ error: 'Failed to allocate numbers. Please try again.' });
  }

  res.json({
    success: true,
    assigned: assignedList[0],
    assignedNumbers: assignedList
  });
});

// Release Number
app.post('/api/release-number', async (req, res) => {
  const { id, number } = req.body;

  if (supabase) {
    if (id) {
      await supabase.from('assigned_numbers').update({ status: 'RELEASED' }).eq('id', id);
    }
    if (number) {
      const cleanNum = String(number).replace(/\D/g, '');
      await supabase.from('number_pool').update({ is_assigned: false, assigned_to: null, assigned_at: null })
        .or(`number.eq.${cleanNum},number.eq.+${cleanNum}`);
      await supabase.from('assigned_numbers').update({ status: 'RELEASED' })
        .or(`number.eq.${cleanNum},number.eq.+${cleanNum}`)
        .eq('status', 'ACTIVE');
    }
  }

  res.json({ success: true, message: 'Number released successfully.' });
});

// Submit Withdrawal
app.post('/api/withdraw', async (req, res) => {
  const { userId, amount, method, walletAddress } = req.body;
  let withdrawAmount = parseFloat(amount);
  const tgId = userId || 123456789;

  const isBinance = String(method || '').toLowerCase().includes('binance');
  // Auto-convert if user entered in cents/USDT (e.g. 0.16 USDT -> 20 BDT)
  if (isBinance && !isNaN(withdrawAmount) && withdrawAmount > 0 && withdrawAmount < 1) {
    withdrawAmount = Number((withdrawAmount * 125).toFixed(2));
  }

  if (!settingsManager.get('withdraw_enabled')) {
    return res.status(400).json({ error: 'Withdrawals are currently paused.' });
  }

  const minWithdraw = settingsManager.get('min_withdraw') || 20;
  if (isNaN(withdrawAmount) || withdrawAmount < minWithdraw) {
    return res.status(400).json({ error: `Minimum withdrawal is ৳${minWithdraw} BDT${isBinance ? ' (16¢ / $0.16 USDT)' : ''}.` });
  }

  if (!supabase) {
    return res.status(503).json({ error: 'Database connection is not active.' });
  }

  // Check balance
  const { data: user } = await supabase.from('users').select('*').eq('telegram_id', tgId).maybeSingle();
  if (!user || user.balance < withdrawAmount) {
    return res.status(400).json({ error: 'Insufficient balance in your account.' });
  }

  // Deduct user balance
  await supabase
    .from('users')
    .update({
      balance: Number((user.balance - withdrawAmount).toFixed(2)),
      pending_withdrawal: Number(((user.pending_withdrawal || 0) + withdrawAmount).toFixed(2))
    })
    .eq('telegram_id', tgId);

  // Insert withdrawal
  const { data: wd } = await supabase
    .from('withdrawals')
    .insert({
      telegram_id: tgId,
      amount: withdrawAmount,
      method: method || 'Binance Pay ID / USDT',
      wallet_address: walletAddress || 'N/A',
      status: 'PENDING'
    })
    .select()
    .single();

  // Push notification to Admin Bot
  if (adminBot && wd) {
    const usdtVal = (withdrawAmount / 125).toFixed(2);
    const centsVal = (withdrawAmount / 1.25).toFixed(0);
    adminBot.sendWithdrawalAlert({
      id: wd.id,
      telegramId: tgId,
      username: user.username || `user_${tgId}`,
      amount: withdrawAmount,
      method: method,
      walletAddress: walletAddress || 'N/A',
      details: isBinance 
        ? `${method} (${walletAddress}) [≈ $${usdtVal} USDT / ${centsVal}¢]`
        : `${method} (${walletAddress})`
    });
  }

  res.json({ success: true, withdrawal: wd });
});

// Admin Password Verification Endpoint
app.post('/api/admin/verify-password', (req, res) => {
  const { password } = req.body;
  const targetPassword = String(settingsManager.get('admin_password') || 'WHALE@123').trim().toUpperCase();
  if (password && String(password).trim().toUpperCase() === targetPassword) {
    return res.json({ success: true, message: 'Authenticated successfully' });
  }
  return res.status(401).json({ success: false, error: 'Incorrect admin password' });
});

// Admin Overview API (Real counts, real pending withdrawals from Supabase)
app.get('/api/admin/overview', async (req, res) => {
  if (!supabase) {
    return res.json({
      success: true,
      stats: { pendingWithdrawals: 0, poolCount: 0, servicesCount: 0, totalCdrCount: 0 },
      withdrawals: [],
      services: [],
      mappings: []
    });
  }

  const [wdRes, poolRes, poolNumbers, srvRes, cdrRes] = await Promise.all([
    supabase.from('withdrawals').select('*').eq('status', 'PENDING').order('requested_at', { ascending: false }).limit(100000),
    supabase.from('number_pool').select('*', { count: 'exact', head: true }),
    fetchAllSupabaseRows(() => supabase.from('number_pool').select('range_id, prefix, is_assigned')),
    supabase.from('app_services').select('*').order('display_order', { ascending: true }).limit(100000),
    supabase.from('cdr_logs').select('*', { count: 'exact', head: true })
  ]);

  const poolCounts = {};
  for (const item of (poolNumbers || [])) {
    if (!item.is_assigned) {
      if (item.range_id) poolCounts[item.range_id] = (poolCounts[item.range_id] || 0) + 1;
      if (item.prefix) {
        const cleanP = String(item.prefix).replace(/\D/g, '');
        poolCounts[cleanP] = (poolCounts[cleanP] || 0) + 1;
      }
    }
  }

  const srvList = (srvRes.data && srvRes.data.length > 0) ? srvRes.data : await appServiceManager.getAppServices();
  const srvMap = new Map();
  for (const s of srvList) {
    srvMap.set(s.id, s);
  }

  let rawMappings = [];
  try {
    const mappingsPath = path.join(__dirname, 'data', 'service_mappings.json');
    if (require('fs').existsSync(mappingsPath)) {
      rawMappings = JSON.parse(require('fs').readFileSync(mappingsPath, 'utf8'));
    }
  } catch (e) {}

  const enrichedMappings = rawMappings.map(m => {
    const srv = srvMap.get(m.app_service_id);
    const countryName = m.country || m.display_name || 'Global';
    const stock = poolCounts[m.range_id] || poolCounts[m.prefix] || 0;
    return {
      id: m.id,
      serviceId: m.app_service_id,
      serviceName: srv ? srv.name : m.app_service_id,
      serviceIcon: srv ? srv.icon : '📱',
      rangeId: m.range_id,
      rangeName: m.range_name || 'Provider Range',
      nickname: m.range_name || 'Provider Range',
      displayName: m.display_name || countryName,
      country: countryName,
      flag: getCountryFlag(countryName, m.prefix),
      rateBdt: Number(m.rate_bdt) || 1.50,
      allocated: stock,
      prefix: m.prefix
    };
  });

  const enrichedServices = srvList.map(s => {
    const srvMappings = enrichedMappings.filter(m => m.serviceId === s.id);
    const totalStock = srvMappings.reduce((sum, m) => sum + (m.allocated || 0), 0);
    return {
      id: s.id,
      name: s.name,
      icon: s.icon,
      category: s.category || 'general',
      linkedRangesCount: srvMappings.length,
      totalStock,
      ranges: srvMappings
    };
  });

  res.json({
    success: true,
    stats: {
      pendingWithdrawals: wdRes.data?.length || 0,
      poolCount: poolRes.count || 0,
      servicesCount: srvList.length,
      totalCdrCount: cdrRes.count || 0
    },
    withdrawals: (wdRes.data || []).map(w => ({
      id: String(w.id),
      userId: String(w.telegram_id),
      username: `user_${w.telegram_id}`,
      amount: Number(w.amount),
      method: w.method,
      wallet: w.wallet_address,
      status: w.status,
      time: new Date(w.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    })),
    services: enrichedServices,
    mappings: enrichedMappings,
    ads: settingsManager.get('ads')
  });
});

// Public Get Ad Settings for Mini App & Telegram Client
app.get('/api/ads', (req, res) => {
  const ads = settingsManager.get('ads') || {};
  res.json({ success: true, ads });
});

// Admin Update Ad Settings
app.post('/api/admin/ads', async (req, res) => {
  const newAds = req.body;
  if (!newAds || typeof newAds !== 'object') {
    return res.status(400).json({ error: 'Invalid ads payload' });
  }
  try {
    const current = settingsManager.get('ads') || {};
    const updated = { ...current, ...newAds };
    settingsManager.set('ads', updated);
    res.json({ success: true, ads: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Get Available Ranges from Lamix Pool
app.get('/api/admin/available-ranges', async (req, res) => {
  try {
    const ranges = await appServiceManager.getAvailableRangesFromPool();
    res.json({ success: true, ranges });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Create App Service
app.post('/api/admin/services', async (req, res) => {
  const { name, icon } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Service name is required.' });
  }
  try {
    const created = await appServiceManager.createAppService({ name, icon });
    res.json({ success: true, service: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Delete App Service
app.post('/api/admin/services/delete', async (req, res) => {
  const { serviceId } = req.body;
  if (!serviceId) return res.status(400).json({ error: 'serviceId is required.' });
  try {
    await appServiceManager.deleteAppService(serviceId);
    res.json({ success: true, message: 'Service deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Link Range to Service
app.post('/api/admin/link-range', async (req, res) => {
  const { serviceId, rangeId, rangeName, displayName, rateBdt, prefix, country } = req.body;
  if (!serviceId || !rangeId) {
    return res.status(400).json({ error: 'serviceId and rangeId are required.' });
  }
  try {
    const mapping = await appServiceManager.linkRangeToService({
      serviceId,
      rangeId,
      rangeName,
      displayName: displayName || country,
      rateBdt: parseFloat(rateBdt) || 1.50,
      prefix: String(prefix || '213').replace('+', ''),
      country: displayName || country || 'Global'
    });
    res.json({ success: true, mapping });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Unlink Range
app.post('/api/admin/unlink-range', async (req, res) => {
  const { mappingId } = req.body;
  if (!mappingId) return res.status(400).json({ error: 'mappingId is required.' });
  try {
    await appServiceManager.unlinkRangeFromService(mappingId);
    res.json({ success: true, message: 'Range unlinked successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Approve Withdrawal
app.post('/api/admin/withdrawals/approve', async (req, res) => {
  const { id } = req.body;
  if (!supabase || !id) return res.status(400).json({ error: 'Missing ID' });

  const { data: wd } = await supabase.from('withdrawals').select('*').eq('id', id).single();
  if (!wd) return res.status(404).json({ error: 'Withdrawal not found' });

  await supabase.from('withdrawals').update({ status: 'APPROVED', processed_at: new Date().toISOString() }).eq('id', id);
  if (clientBot) {
    clientBot.sendMessage(
      wd.telegram_id,
      `✅ <b>Withdrawal Approved!</b>\n\nYour <b>৳${wd.amount} BDT</b> payout (${wd.method}) has been sent successfully.`
    ).catch(() => {});
  }

  res.json({ success: true, message: 'Withdrawal approved' });
});

// Admin Reject Withdrawal
app.post('/api/admin/withdrawals/reject', async (req, res) => {
  const { id, reason } = req.body;
  if (!supabase || !id) return res.status(400).json({ error: 'Missing ID' });

  const { data: wd } = await supabase.from('withdrawals').select('*').eq('id', id).single();
  if (!wd) return res.status(404).json({ error: 'Withdrawal not found' });

  // Refund balance
  const { data: user } = await supabase.from('users').select('balance').eq('telegram_id', wd.telegram_id).single();
  if (user) {
    await supabase.from('users').update({
      balance: Number((user.balance + Number(wd.amount)).toFixed(2))
    }).eq('telegram_id', wd.telegram_id);
  }

  await supabase.from('withdrawals').update({
    status: 'REJECTED',
    reject_reason: reason || 'Admin rejected',
    processed_at: new Date().toISOString()
  }).eq('id', id);

  if (clientBot) {
    clientBot.sendMessage(
      wd.telegram_id,
      `❌ <b>Withdrawal Rejected!</b>\n\nYour <b>৳${wd.amount} BDT</b> withdrawal was rejected, and the full amount has been refunded to your balance.`
    ).catch(() => {});
  }

  res.json({ success: true, message: 'Withdrawal rejected and refunded' });
});

// Admin Sync Numbers from Lamix (Supports optional rangeId for single-range audit)
app.post('/api/admin/sync-numbers', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'No database connection' });
  try {
    const { rangeId } = req.body || {};
    const result = await syncNumbersToDatabase(supabase, rangeId || null);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend in production
const clientDistPath = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDistPath));

app.use((req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 OTP LIFE - Production Mini App & Bot Server`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🔗 WebApp Target: ${WEBAPP_URL}`);
  console.log(`🤖 Client Bot: @OTP_LIFE_bot`);
  console.log(`👑 Admin Bot:  @OTP_LIFE_ADMIN_bot`);
  console.log(`🗄️ Database:   Supabase Connected`);
  console.log(`⚡ SMS Engine: Lamix Live CDR Poller Active`);
  const feedService = require('./services/feedService');
  if (feedService.isConfigured()) {
    console.log(`📡 Live Feed:  Active -> ${feedService.channelId}`);
  } else {
    console.log(`📡 Live Feed:  Standby (Set FEED_CHANNEL_ID in .env)`);
  }
  console.log(`===============================================`);
});
