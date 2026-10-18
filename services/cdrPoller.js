'use strict';

const { getCdrs, extractOtp, USD_TO_BDT } = require('./lamixApi');
const feedService = require('./feedService');

function normalizePhoneNumber(value) {
  if (value === null || value === undefined) return '';
  const digits = String(value).replace(/\D/g, '');
  return digits || '';
}

function buildPhoneVariants(value) {
  const digits = normalizePhoneNumber(value);
  const variants = new Set();
  if (!digits) return [];

  variants.add(digits);
  variants.add(`+${digits}`);
  if (digits.startsWith('0')) variants.add(digits.slice(1));
  if (digits.startsWith('00')) variants.add(digits.slice(2));

  return [...variants].filter(Boolean);
}

class CdrPoller {
  constructor(supabase, clientBotInstance) {
    this.supabase = supabase;
    this.clientBot = clientBotInstance;
    this.isRunning = false;
    this.isPolling = false;
    this.assignedCache = new Map();
    this.isFirstRun = true;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('⚡ [CDR Poller] Started — checking Lamix CDRs every 10 seconds...');
    this.pollLoop();
  }

  stop() {
    this.isRunning = false;
  }

  async pollLoop() {
    while (this.isRunning) {
      if (!this.isPolling) {
        this.isPolling = true;
        try {
          await this.checkCdrs();
        } catch (err) {
          console.error('❌ [CDR Poller Error]:', err.message);
        } finally {
          this.isPolling = false;
        }
      }
      // Poll every 10 seconds
      await new Promise((r) => setTimeout(r, 10000));
    }
  }

  // Load active assigned numbers into memory cache for fast, zero-delay lookups
  async loadActiveAssignments() {
    if (!this.supabase) return;
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await this.supabase
        .from('assigned_numbers')
        .select('*')
        .eq('status', 'ACTIVE')
        .gt('expires_at', nowIso)
        .limit(100000);

      if (!error && data) {
        this.assignedCache.clear();
        for (const row of data) {
          const norm = normalizePhoneNumber(row.number);
          if (norm) {
            this.assignedCache.set(norm, row);
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ [CDR Poller] Failed to load active assignments cache:', e.message);
    }
  }

  // Robust multi-variant matching to find the exact user who owns this number
  async resolveAssignedUser(rawNumber) {
    if (!rawNumber) return null;
    const digits = normalizePhoneNumber(rawNumber);
    if (!digits) return null;

    // 1. Check in-memory cache directly
    if (this.assignedCache.has(digits)) {
      return this.assignedCache.get(digits);
    }

    // 2. Check variants against in-memory cache
    for (const [cachedNum, row] of this.assignedCache.entries()) {
      const variants = buildPhoneVariants(cachedNum);
      if (variants.includes(digits) || cachedNum.endsWith(digits) || digits.endsWith(cachedNum)) {
        if (Math.min(cachedNum.length, digits.length) >= 8) {
          return row;
        }
      }
    }

    // 3. Fallback direct DB query in case assignment just occurred (up to 1 lac limit)
    try {
      const nowIso = new Date().toISOString();
      const { data: dbRows } = await this.supabase
        .from('assigned_numbers')
        .select('*')
        .eq('status', 'ACTIVE')
        .gt('expires_at', nowIso)
        .order('assigned_at', { ascending: false })
        .limit(100000);

      if (dbRows && dbRows.length > 0) {
        for (const row of dbRows) {
          const rowDigits = normalizePhoneNumber(row.number);
          if (rowDigits === digits || rowDigits.endsWith(digits) || digits.endsWith(rowDigits)) {
            if (Math.min(rowDigits.length, digits.length) >= 8) {
              this.assignedCache.set(rowDigits, row);
              return row;
            }
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ [CDR Poller] resolveAssignedUser DB fallback warning:', e.message);
    }

    return null;
  }

  // Periodic cleanup of expired numbers (releases them back to pool)
  async cleanupExpiredNumbers() {
    if (!this.supabase) return;
    try {
      const nowIso = new Date().toISOString();
      const { data: expired, error } = await this.supabase
        .from('assigned_numbers')
        .select('id, number')
        .eq('status', 'ACTIVE')
        .lt('expires_at', nowIso)
        .limit(100000);

      if (error || !expired || expired.length === 0) return;

      for (const item of expired) {
        await this.supabase
          .from('assigned_numbers')
          .update({ status: 'EXPIRED' })
          .eq('id', item.id);

        const cleanDigits = normalizePhoneNumber(item.number);
        await this.supabase
          .from('number_pool')
          .update({ is_assigned: false, assigned_to: null, assigned_at: null })
          .or(`number.eq.${cleanDigits},number.eq.+${cleanDigits}`);

        console.log(`🧹 [Auto-Cleanup] Number +${cleanDigits} expired and released back to pool.`);
      }
    } catch (e) {
      console.warn('⚠️ [Auto-Cleanup Warning]:', e.message);
    }
  }

  async checkCdrs() {
    if (!this.supabase) return;

    // 1. Run expired cleanup
    await this.cleanupExpiredNumbers();

    // 2. Refresh active assignments cache
    await this.loadActiveAssignments();

    // 3. Fetch CDRs from Lamix Mother API
    const records = await getCdrs({ limit: 100 });
    if (!records || records.length === 0) return;

    // Process from oldest to newest
    const sorted = [...records].sort((a, b) => new Date(a.time) - new Date(b.time));

    // Seed existing historical CDRs on first run so we don't blast the feed channel with 100 old SMS on restart
    if (this.isFirstRun) {
      this.isFirstRun = false;
      for (const item of sorted) {
        const cleanNum = normalizePhoneNumber(item.number);
        const cleanContent = (item.content || '').replace(/[\r\n]+/g, ' ').trim();
        feedService.sentKeys.add(`${cleanNum}_${cleanContent.slice(0, 30)}`);
      }
    }

    for (const item of sorted) {
      const cleanNum = normalizePhoneNumber(item.number);
      if (!cleanNum) continue;

      const cleanContent = (item.content || '').replace(/[\r\n]+/g, ' ').trim();
      const otp = extractOtp(cleanContent);
      const payoutUsd = parseFloat(item.payout) || 0.01;
      const cdrTime = item.time;

      // Find matching user assignment
      const assignment = await this.resolveAssignedUser(item.number);

      // 📡 Post to Live Feed Channel (Matches Pro SMS FEED style from screenshot)
      const feedSent = await feedService.sendToFeed({
        number: cleanNum,
        cli: item.cli || 'SMS',
        content: cleanContent,
        otp,
        rangeName: assignment?.range_name || item.range || 'SMS Service',
        country: assignment?.country || item.country || ''
      }).catch(err => {
        console.warn('⚠️ [Feed Send Warning]:', err.message);
        return false;
      });

      // 350ms spacing between feed messages only if sent (matching SMS Hadi server.js:409)
      if (feedSent) {
        await new Promise(r => setTimeout(r, 350));
      }

      if (assignment && assignment.telegram_id) {
        const tgId = assignment.telegram_id;
        const payoutBdt = Number(assignment.payout_bdt) || Number((payoutUsd * USD_TO_BDT).toFixed(2));
        const serviceName = assignment.range_name || item.range || 'SMS Service';

        // 🛡️ DEDUP CHECK in transactions table (Exact match on user + number + message text)
        const { data: existingTxn } = await this.supabase
          .from('transactions')
          .select('id')
          .eq('telegram_id', tgId)
          .eq('number', cleanNum)
          .eq('sms_text', cleanContent)
          .eq('type', 'EARNING')
          .limit(1);

        if (existingTxn && existingTxn.length > 0) {
          // Already recorded and credited for this user
          continue;
        }

        console.log(`\n🎉 ========================================================`);
        console.log(`🎉 [OTP MATCHED FOR USER ${tgId}]`);
        console.log(`📱 Number: +${cleanNum} | Service: ${serviceName}`);
        console.log(`🔑 OTP Code: ${otp || 'N/A'}`);
        console.log(`💵 Earned: +৳${payoutBdt.toFixed(2)} BDT | From: ${item.cli || 'SMS'}`);
        console.log(`💬 Message: ${cleanContent}`);
        console.log(`🎉 ========================================================\n`);

        // 1. Record Ledger Transaction
        const { error: txnErr } = await this.supabase
          .from('transactions')
          .insert({
            telegram_id: tgId,
            type: 'EARNING',
            amount: payoutBdt,
            number: cleanNum,
            cli: item.cli || 'SMS',
            sms_text: cleanContent,
            range_name: serviceName
          });

        if (txnErr) {
          console.error(`❌ [Transaction Insert Error]: ${txnErr.message}`);
        }

        // 2. Insert or Update cdr_logs for this user
        const { data: existingCdr } = await this.supabase
          .from('cdr_logs')
          .select('id')
          .eq('number', cleanNum)
          .eq('content', item.content)
          .limit(1);

        if (existingCdr && existingCdr.length > 0) {
          await this.supabase
            .from('cdr_logs')
            .update({
              telegram_id: tgId,
              is_credited: true,
              payout_bdt: payoutBdt,
              extracted_otp: otp
            })
            .eq('id', existingCdr[0].id);
        } else {
          await this.supabase
            .from('cdr_logs')
            .insert({
              cdr_time: cdrTime,
              number: cleanNum,
              cli: item.cli || 'SMS',
              content: item.content,
              extracted_otp: otp,
              range_name: serviceName,
              currency: item.currency || 'USD',
              payout_usd: payoutUsd,
              payout_bdt: payoutBdt,
              telegram_id: tgId,
              is_credited: true
            });
        }

        // 3. Atomically Update User Balance & Stats
        const { data: user } = await this.supabase
          .from('users')
          .select('balance, total_earnings, total_sms')
          .eq('telegram_id', tgId)
          .single();

        if (user) {
          const newBalance = Number((parseFloat(user.balance || 0) + payoutBdt).toFixed(2));
          const newEarnings = Number((parseFloat(user.total_earnings || 0) + payoutBdt).toFixed(2));
          const newTotalSms = (parseInt(user.total_sms || 0)) + 1;

          await this.supabase
            .from('users')
            .update({
              balance: newBalance,
              total_earnings: newEarnings,
              total_sms: newTotalSms,
              updated_at: new Date().toISOString()
            })
            .eq('telegram_id', tgId);

          console.log(`💰 [User Account Updated] User: ${tgId} | Bal: ৳${newBalance} | SMS Count: ${newTotalSms}`);
        }

        // 4. Update Referral Stats if user was referred
        await this._updateReferralStats(tgId).catch(() => {});

        // 5. Send Realtime Notification to User via Telegram ClientBot
        if (this.clientBot) {
          await this.clientBot.notifySmsReceived(tgId, {
            number: cleanNum,
            cli: item.cli || 'SMS',
            content: item.content,
            otp,
            payout_bdt: payoutBdt,
            service_name: serviceName
          }).catch((err) => {
            console.warn(`⚠️ [ClientBot Alert Warning]:`, err.message);
          });
        }
      } else {
        // Unassigned SMS: Ensure record exists in cdr_logs (with telegram_id = null)
        const { data: existingCdr } = await this.supabase
          .from('cdr_logs')
          .select('id')
          .eq('number', cleanNum)
          .eq('content', item.content)
          .limit(1);

        if (!existingCdr || existingCdr.length === 0) {
          await this.supabase
            .from('cdr_logs')
            .insert({
              cdr_time: cdrTime,
              number: cleanNum,
              cli: item.cli || 'SMS',
              content: item.content,
              extracted_otp: otp,
              range_name: item.range || 'General',
              currency: item.currency || 'USD',
              payout_usd: payoutUsd,
              payout_bdt: Number((payoutUsd * USD_TO_BDT).toFixed(2)),
              telegram_id: null,
              is_credited: false
            });
        }
      }
    }
  }

  // Update referral eligibility when a referred user earns an OTP
  async _updateReferralStats(tgId) {
    if (!this.supabase) return;
    try {
      const { data: ref } = await this.supabase
        .from('referrals')
        .select('id, total_otp_received')
        .eq('referred_id', tgId)
        .maybeSingle();

      if (ref) {
        const newCount = (ref.total_otp_received || 0) + 1;
        await this.supabase
          .from('referrals')
          .update({
            total_otp_received: newCount,
            is_eligible: newCount >= 1
          })
          .eq('id', ref.id);
      }
    } catch (e) {
      console.warn('⚠️ [Referral Update Warning]:', e.message);
    }
  }
}

module.exports = CdrPoller;
