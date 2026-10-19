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

  // Load assignments from the last 24 hours into memory cache for instant, zero-delay lookups
  async loadActiveAssignments() {
    if (!this.supabase) return;
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await this.supabase
        .from('assigned_numbers')
        .select('*')
        .gte('assigned_at', oneDayAgo)
        .order('assigned_at', { ascending: false })
        .limit(100000);

      if (!error && data) {
        this.assignedCache.clear();
        for (const row of data) {
          const norm = normalizePhoneNumber(row.number);
          if (norm) {
            if (!this.assignedCache.has(norm)) {
              this.assignedCache.set(norm, []);
            }
            this.assignedCache.get(norm).push(row);
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ [CDR Poller] Failed to load assignments cache:', e.message);
    }
  }

  // Robust timestamp-aware matching: finds the exact user who owned the number when the SMS arrived
  async resolveAssignedUser(rawNumber, smsTimestamp = Date.now()) {
    if (!rawNumber) return null;
    const digits = normalizePhoneNumber(rawNumber);
    if (!digits) return null;

    const findBestMatch = (rows) => {
      if (!rows || rows.length === 0) return null;
      // Rows are sorted descending by assigned_at
      for (const row of rows) {
        const assignedTime = new Date(row.assigned_at).getTime();
        const expiresTime = new Date(row.expires_at).getTime();

        // Check if SMS arrived after assignment started (allow 45s clock skew)
        if (smsTimestamp >= (assignedTime - 45000)) {
          // If still ACTIVE, or SMS arrived before expiration
          if (row.status === 'ACTIVE') {
            return row;
          }
          if (!isNaN(expiresTime) && smsTimestamp <= expiresTime) {
            return row;
          }
          // If user clicked release recently (within 24 hours of assignment)
          if (row.status === 'RELEASED' && (smsTimestamp - assignedTime) < (24 * 60 * 60 * 1000)) {
            return row;
          }
        }
      }
      return null;
    };

    // 1. Check in-memory cache directly
    if (this.assignedCache.has(digits)) {
      const match = findBestMatch(this.assignedCache.get(digits));
      if (match) return match;
    }

    // 2. Check variants against in-memory cache
    for (const [cachedNum, rows] of this.assignedCache.entries()) {
      if (cachedNum.endsWith(digits) || digits.endsWith(cachedNum)) {
        if (Math.min(cachedNum.length, digits.length) >= 8) {
          const match = findBestMatch(rows);
          if (match) return match;
        }
      }
    }

    // 3. Fallback direct DB query in case assignment just occurred
    try {
      const variants = buildPhoneVariants(digits);
      const { data: dbRows } = await this.supabase
        .from('assigned_numbers')
        .select('*')
        .in('number', variants)
        .order('assigned_at', { ascending: false })
        .limit(20);

      if (dbRows && dbRows.length > 0) {
        const match = findBestMatch(dbRows);
        if (match) {
          if (!this.assignedCache.has(digits)) {
            this.assignedCache.set(digits, []);
          }
          this.assignedCache.get(digits).unshift(match);
          return match;
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

    // 2. Refresh assignments cache (24 hours history)
    await this.loadActiveAssignments();

    // 3. Fetch CDRs from Lamix Mother API
    const records = await getCdrs({ limit: 100 });
    if (!records || records.length === 0) return;

    // Process from oldest to newest
    const sorted = [...records].sort((a, b) => new Date(a.time) - new Date(b.time));

    // Seed existing CDRs from database cdr_logs on startup so server restart NEVER sends duplicate OTPs to the feed channel!
    if (this.isFirstRun) {
      this.isFirstRun = false;
      try {
        const { data: loggedCdrs } = await this.supabase
          .from('cdr_logs')
          .select('number, extracted_otp, content')
          .order('created_at', { ascending: false })
          .limit(1000);

        if (loggedCdrs && loggedCdrs.length > 0) {
          for (const row of loggedCdrs) {
            const cleanNum = normalizePhoneNumber(row.number);
            const otp = row.extracted_otp || extractOtp(row.content);
            const dedupKey = otp
              ? `${cleanNum}_${otp}`
              : `${cleanNum}_${String(row.content || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 80)}`;
            feedService.sentKeys.add(dedupKey);
          }
          console.log(`🛡️ [Feed Guard] Pre-seeded ${feedService.sentKeys.size} historical OTP keys from DB. Zero duplicates will be sent on restart.`);
        }
      } catch (e) {
        console.warn('⚠️ [CDR Poller] Error seeding sentKeys from DB:', e.message);
      }
    }

    const now = Date.now();

    for (const item of sorted) {
      const cleanNum = normalizePhoneNumber(item.number);
      if (!cleanNum) continue;

      const smsTimestamp = new Date(item.time).getTime();

      // 🛡️ Safety Filter 1: Skip stale historical CDRs older than 60 minutes
      if (!isNaN(smsTimestamp) && (now - smsTimestamp > 60 * 60 * 1000)) {
        continue;
      }

      const cleanContent = (item.content || '').replace(/[\r\n]+/g, ' ').trim();
      const otp = extractOtp(cleanContent);
      const payoutUsd = parseFloat(item.payout) || 0.01;
      const cdrTime = item.time;

      // 📡 1. Post to Live Feed Channel FIRST (public feed should NEVER be blocked by user assignment state)
      const feedSent = await feedService.sendToFeed({
        number: cleanNum,
        cli: item.cli || 'SMS',
        content: cleanContent,
        otp,
        rangeName: item.range || 'SMS Service',
        country: item.country || ''
      }).catch(err => {
        console.warn('⚠️ [Feed Send Warning]:', err.message);
        return false;
      });

      // 350ms spacing between feed messages only if sent (matching SMS Hadi server.js:409)
      if (feedSent) {
        await new Promise(r => setTimeout(r, 350));
      }

      // 👤 2. Find matching user assignment for this SMS at its arrival timestamp
      const assignment = await this.resolveAssignedUser(item.number, smsTimestamp);

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
