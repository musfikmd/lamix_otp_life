'use strict';

/**
 * scripts/recalc_user_balances.js
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Safe audit and balance / SMS counter recalculation utility.
 * Bypasses PostgREST 1,000-row limit using .limit(500000) so that high-volume
 * users with 10,000 to 100,000+ SMS records never get capped.
 *
 * Usage:
 *   node scripts/recalc_user_balances.js              (Recalculates all users)
 *   node scripts/recalc_user_balances.js <telegramId> (Recalculates one user)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

require('dotenv').config();
const { supabase } = require('../config/supabase');

async function recalcUser(tgId) {
  // 1. Fetch ALL transactions for this user (up to 500,000)
  const { data: allTxns, error: txnErr } = await supabase
    .from('transactions')
    .select('amount, type, created_at')
    .eq('telegram_id', tgId)
    .in('type', ['EARNING', 'BONUS'])
    .limit(500000);

  if (txnErr) {
    console.error(`❌ [Recalc Error] Failed to fetch transactions for user ${tgId}:`, txnErr.message);
    return false;
  }

  const txns = allTxns || [];
  const totalEarned = parseFloat(txns.reduce((s, t) => s + Number(t.amount || 0), 0).toFixed(2));
  const totalSms = txns.filter(t => t.type === 'EARNING').length;

  // 2. Fetch withdrawals for this user (up to 100,000)
  const { data: withdrawals, error: wdErr } = await supabase
    .from('withdrawals')
    .select('amount, status')
    .eq('telegram_id', tgId)
    .limit(100000);

  if (wdErr) {
    console.error(`❌ [Recalc Error] Failed to fetch withdrawals for user ${tgId}:`, wdErr.message);
    return false;
  }

  const wds = withdrawals || [];
  const totalWithdrawn = parseFloat(
    wds.filter(w => w.status === 'APPROVED').reduce((s, w) => s + Number(w.amount || 0), 0).toFixed(2)
  );
  const pendingWithdrawal = parseFloat(
    wds.filter(w => w.status === 'PENDING').reduce((s, w) => s + Number(w.amount || 0), 0).toFixed(2)
  );

  const calculatedBalance = parseFloat(Math.max(0, totalEarned - totalWithdrawn - pendingWithdrawal).toFixed(2));

  // 3. Current user record
  const { data: currentUser } = await supabase
    .from('users')
    .select('balance, total_earnings, total_sms, total_withdrawn, pending_withdrawal')
    .eq('telegram_id', tgId)
    .maybeSingle();

  console.log(`\n👤 User Telegram ID: ${tgId}`);
  console.log(`   Transactions Analyzed: ${txns.length} (SMS: ${totalSms})`);
  console.log(`   Current in DB:  Bal: ৳${currentUser?.balance ?? 0} | Earned: ৳${currentUser?.total_earnings ?? 0} | SMS: ${currentUser?.total_sms ?? 0}`);
  console.log(`   Recalculated:   Bal: ৳${calculatedBalance} | Earned: ৳${totalEarned} | SMS: ${totalSms} | Withdrawn: ৳${totalWithdrawn} | Pending: ৳${pendingWithdrawal}`);

  // 4. Update user record in DB
  const { error: updErr } = await supabase
    .from('users')
    .update({
      balance: calculatedBalance,
      total_earnings: totalEarned,
      total_sms: totalSms,
      total_withdrawn: totalWithdrawn,
      pending_withdrawal: pendingWithdrawal,
      updated_at: new Date().toISOString()
    })
    .eq('telegram_id', tgId);

  if (updErr) {
    console.error(`   ❌ Update failed: ${updErr.message}`);
    return false;
  }

  console.log(`   ✅ Successfully synchronized user ${tgId}.`);
  return true;
}

async function main() {
  if (!supabase) {
    console.error('❌ Supabase client is not configured.');
    process.exit(1);
  }

  const argTgId = process.argv[2];

  if (argTgId) {
    console.log(`🎯 Recalculating balance and SMS count for single user: ${argTgId}`);
    await recalcUser(Number(argTgId));
  } else {
    console.log('🔄 Fetching all users from database (limit 100,000)...');
    const { data: users, error } = await supabase
      .from('users')
      .select('telegram_id')
      .limit(100000);

    if (error) {
      console.error('❌ Error fetching users:', error.message);
      process.exit(1);
    }

    if (!users || users.length === 0) {
      console.log('ℹ️ No users registered in database.');
      process.exit(0);
    }

    console.log(`📊 Found ${users.length} user(s). Processing audit...`);
    let synced = 0;
    for (const u of users) {
      const ok = await recalcUser(u.telegram_id);
      if (ok) synced++;
    }
    console.log(`\n🎉 Recalculation complete. ${synced}/${users.length} users verified and updated.`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
