'use strict';

const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.LAMIX_BASE_URL || 'https://panel.lamix.org';
const TOKEN = process.env.LAMIX_API_TOKEN || '';
const USD_TO_BDT = parseFloat(process.env.USD_TO_BDT_RATE) || 120;

function normalizePhoneNumber(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\D/g, '');
}

// =========================================================================
// ⏱️ Strict Rate Limiter for Lamix API (Max 40 req/min, 1 req/sec)
// We enforce 1550ms delay between consecutive requests + sliding 60s window
// =========================================================================
class LamixRateLimiter {
  constructor(minDelayMs = 1550, maxPerMinute = 38) {
    this.minDelayMs = minDelayMs;
    this.maxPerMinute = maxPerMinute;
    this.requestTimestamps = [];
    this.lastRequestTime = 0;
  }

  async acquire() {
    while (true) {
      const now = Date.now();

      // 1. Enforce minimum delay between calls
      const timeSinceLast = now - this.lastRequestTime;
      if (timeSinceLast < this.minDelayMs) {
        const wait = this.minDelayMs - timeSinceLast;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      // 2. Clean timestamps older than 60 seconds
      this.requestTimestamps = this.requestTimestamps.filter((t) => now - t < 60000);

      // 3. Enforce sliding minute limit
      if (this.requestTimestamps.length >= this.maxPerMinute) {
        const oldest = this.requestTimestamps[0];
        const waitTime = Math.max(50, 60000 - (now - oldest) + 150);
        console.log(`⏳ [Lamix Rate Limit Guard] 38 requests in 60s reached. Cooling down for ${(waitTime / 1000).toFixed(1)}s...`);
        await new Promise((r) => setTimeout(r, waitTime));
        continue;
      }

      // Acquire slot
      this.lastRequestTime = Date.now();
      this.requestTimestamps.push(this.lastRequestTime);
      break;
    }
  }
}

const rateLimiter = new LamixRateLimiter(1550, 38);

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/json'
  },
  timeout: 20000
});

// Interceptor: acquire slot before sending request
client.interceptors.request.use(async (config) => {
  await rateLimiter.acquire();
  return config;
});

// Interceptor: Auto-retry on 429
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 429) {
      console.warn('⚠️ [Lamix API 429 Rate Limit Hit] Pausing for 5 seconds before retrying request...');
      await new Promise((r) => setTimeout(r, 5000));
      return client.request(error.config);
    }
    return Promise.reject(error);
  }
);

// 1. Fetch Ranges
async function getRanges() {
  try {
    const res = await client.get('/api/v1/ranges');
    return res.data?.ranges || [];
  } catch (err) {
    console.error('❌ Lamix getRanges Error:', err.response?.data || err.message);
    return [];
  }
}

// 2. Fetch Numbers with cursor pagination
async function getNumbers(params = {}) {
  try {
    const query = new URLSearchParams();
    if (params.rangeId) query.append('rangeId', params.rangeId);
    if (params.limit) query.append('limit', params.limit);
    if (params.after) query.append('after', params.after);
    if (params.search) query.append('search', params.search);

    const res = await client.get(`/api/v1/numbers?${query.toString()}`);
    return res.data || { records: [] };
  } catch (err) {
    console.error('❌ Lamix getNumbers Error:', err.response?.data || err.message);
    return { records: [] };
  }
}

// 3. Fetch CDRs (Incoming SMS)
async function getCdrs(params = {}) {
  try {
    const query = new URLSearchParams();
    if (params.limit) query.append('limit', params.limit || 50);
    if (params.from) query.append('from', params.from);
    if (params.number) query.append('number', params.number);

    const res = await client.get(`/api/v1/cdrs?${query.toString()}`);
    return res.data?.records || [];
  } catch (err) {
    console.error('❌ Lamix getCdrs Error:', err.response?.data || err.message);
    return [];
  }
}

// 4. Extract OTP code from SMS text
function extractOtp(content) {
  if (!content) return null;
  const text = String(content).trim();

  // Pattern 1: Pure numbers or dash-separated numbers (e.g. 123456, 242-511, 402738)
  const numMatch = text.match(/\b\d{3}[-\s]?\d{3,4}\b/) || text.match(/\b\d{4,8}\b/);
  if (numMatch) return numMatch[0].replace(/\D/g, '');

  // Pattern 2: Alphanumeric codes (e.g. G-123456, FB-89012)
  const alphaMatch = text.match(/\b[A-Z0-9]{1,4}[-\s]?[A-Z0-9]{3,8}\b/i);
  if (alphaMatch && /[0-9]/.test(alphaMatch[0]) && alphaMatch[0].length <= 12) {
    return alphaMatch[0].trim();
  }

  return null;
}

// 5. Fetch ALL live numbers for a specific range using cursor pagination
async function getAllLiveNumbersForRange(rangeId, onProgress = null) {
  const allRecords = [];
  let nextCursor = null;
  let page = 1;
  const limit = 200; // max batch limit

  while (true) {
    const params = { rangeId, limit };
    if (nextCursor) {
      params.after = nextCursor;
    }

    const data = await getNumbers(params);
    const records = data?.records || [];
    if (!records || records.length === 0) {
      break;
    }

    allRecords.push(...records);
    if (onProgress) {
      onProgress({ rangeId, page, count: allRecords.length });
    }

    if (!data.nextCursor || data.nextCursor === nextCursor) {
      break;
    }
    nextCursor = data.nextCursor;
    page++;
  }

  return allRecords;
}

// Fetch all currently active assigned numbers in database to protect them from overwrite
async function fetchAllAssignedNumbersSet(supabase) {
  const assignedSet = new Set();
  try {
    const { data } = await supabase
      .from('assigned_numbers')
      .select('number')
      .eq('status', 'ACTIVE')
      .gt('expires_at', new Date().toISOString());

    if (data) {
      for (const row of data) {
        if (row.number) {
          assignedSet.add(normalizePhoneNumber(row.number));
          assignedSet.add(row.number);
        }
      }
    }
  } catch (e) {
    console.warn('⚠️ [Assigned Numbers Cache Warning]:', e.message);
  }
  return assignedSet;
}

// Track whether a sync is currently running to avoid overlapping calls
let isSyncRunning = false;

/**
 * 6. Production Sync & Dead Number Purge
 * - Iterates range by range
 * - Respects 40 req/min rate limit
 * - Checks live numbers vs existing stock in DB
 * - Purges dead numbers no longer present in Lamix panel
 * - Upserts active numbers to stock
 */
async function syncNumbersToDatabase(supabase, targetRangeId = null, onProgress = null) {
  if (!supabase) return { synced: 0, deadPurged: 0 };

  if (isSyncRunning) {
    console.warn('⚠️ [Pool Sync] Sync cycle is already running; skipping overlapping trigger.');
    return { alreadyRunning: true, synced: 0, deadPurged: 0 };
  }

  isSyncRunning = true;
  console.log(`\n🔄 ========================================================`);
  console.log(`🔄 [Lamix Pool Sync & Dead Number Audit] Starting...`);
  if (targetRangeId) console.log(`🎯 Target Range: ${targetRangeId}`);
  console.log(`🔄 ========================================================`);

  let totalLiveSynced = 0;
  let totalDeadPurged = 0;

  try {
    // 1. Fetch available ranges
    const ranges = await getRanges();
    if (!ranges || ranges.length === 0) {
      console.warn('⚠️ [Lamix Sync] No ranges returned from Lamix API.');
      return { synced: 0, deadPurged: 0 };
    }

    const targetRanges = targetRangeId
      ? ranges.filter((r) => r.id === targetRangeId)
      : ranges.filter((r) => r.active);

    console.log(`📋 [Lamix Sync] Processing ${targetRanges.length} active range(s)...`);

    // 2. Load set of currently assigned numbers in DB
    const assignedSet = await fetchAllAssignedNumbersSet(supabase);

    // 3. Process each range one by one
    for (const range of targetRanges) {
      console.log(`\n🌐 [Range Audit] Checking range: "${range.name}" (ID: ${range.id})`);

      // Highest rate for this range
      let highestRateUsd = 0.01;
      if (range.rates && range.rates.length > 0) {
        const validRates = range.rates.map((r) => parseFloat(r.payoutRate) || 0);
        highestRateUsd = Math.max(...validRates) || 0.01;
      }
      const payoutBdt = Number((highestRateUsd * USD_TO_BDT).toFixed(2));

      // Fetch all live numbers currently in panel for this range
      const liveRecords = await getAllLiveNumbersForRange(range.id, (prog) => {
        if (onProgress) onProgress(prog);
      });

      console.log(`📡 [Range Audit] Lamix panel returned ${liveRecords.length} live number(s) for "${range.name}".`);

      const activeNumbersSet = new Set();
      const activeRawSet = new Set();
      for (const item of liveRecords) {
        if (item.status === 'active') {
          activeNumbersSet.add(normalizePhoneNumber(item.number));
          activeRawSet.add(item.number);
        }
      }

      // =========================================================================
      // 🧹 DEAD NUMBER CHECK & PURGE FOR THIS RANGE
      // Find numbers sitting in number_pool for this range that are NO LONGER in panel
      // =========================================================================
      const { data: dbPoolRows, error: poolFetchErr } = await supabase
        .from('number_pool')
        .select('id, number, is_assigned')
        .eq('range_id', range.id)
        .limit(100000);

      if (!poolFetchErr && dbPoolRows && dbPoolRows.length > 0) {
        const deadRows = dbPoolRows.filter(
          (r) => !activeNumbersSet.has(normalizePhoneNumber(r.number)) && !activeRawSet.has(r.number)
        );

        if (deadRows.length > 0) {
          console.log(`⚠️ [Dead Numbers Found] ${deadRows.length} dead number(s) in DB no longer present in Lamix panel for "${range.name}".`);

          // 1. Purge unassigned dead numbers from number_pool
          const deadUnassignedIds = deadRows.filter((r) => !r.is_assigned).map((r) => r.id);
          if (deadUnassignedIds.length > 0) {
            for (let i = 0; i < deadUnassignedIds.length; i += 200) {
              const chunk = deadUnassignedIds.slice(i, i + 200);
              await supabase.from('number_pool').delete().in('id', chunk);
            }
            console.log(`🧹 [Dead Purge] Removed ${deadUnassignedIds.length} dead unassigned numbers from stock.`);
            totalDeadPurged += deadUnassignedIds.length;
          }

          // 2. Purge assigned dead numbers (panel removed them while assigned)
          const deadAssigned = deadRows.filter((r) => r.is_assigned);
          if (deadAssigned.length > 0) {
            const deadAssignedIds = deadAssigned.map((r) => r.id);
            const deadAssignedNumbers = deadAssigned.map((r) => r.number);

            for (let i = 0; i < deadAssignedIds.length; i += 200) {
              const chunk = deadAssignedIds.slice(i, i + 200);
              await supabase.from('number_pool').delete().in('id', chunk);
            }

            // Expire them in assigned_numbers so user does not wait forever on dead number
            for (let i = 0; i < deadAssignedNumbers.length; i += 200) {
              const chunk = deadAssignedNumbers.slice(i, i + 200);
              await supabase.from('assigned_numbers').update({ status: 'EXPIRED' }).in('number', chunk);
            }

            console.log(`🧹 [Dead Purge] Expired & removed ${deadAssigned.length} dead assigned numbers from stock.`);
            totalDeadPurged += deadAssigned.length;
          }
        }
      }

      // =========================================================================
      // 📥 UPSERT REAL/LIVE NUMBERS TO STOCK
      // =========================================================================
      const liveBatches = [];
      for (const item of liveRecords) {
        if (item.status !== 'active') continue;

        const cleanNum = normalizePhoneNumber(item.number);
        const isAssigned = assignedSet.has(cleanNum) || assignedSet.has(item.number);

        liveBatches.push({
          number: item.number,
          range_id: range.id,
          range_name: range.name,
          prefix: range.prefix,
          country: range.name.split(' ')[0] || 'Global',
          payout_usd: parseFloat(item.payoutRate) || highestRateUsd,
          payout_bdt: payoutBdt,
          is_assigned: isAssigned,
          synced_at: new Date().toISOString()
        });
      }

      for (let i = 0; i < liveBatches.length; i += 200) {
        const chunk = liveBatches.slice(i, i + 200);
        const { error: upsertErr } = await supabase
          .from('number_pool')
          .upsert(chunk, { onConflict: 'number', ignoreDuplicates: false });

        if (!upsertErr) {
          totalLiveSynced += chunk.length;
        } else {
          console.warn(`⚠️ [Upsert Chunk Warning]:`, upsertErr.message);
        }
      }

      console.log(`✅ [Range Complete] "${range.name}": ${liveBatches.length} live numbers synced.`);
    }

    console.log(`\n🎉 ========================================================`);
    console.log(`🎉 [Lamix Sync Completed Successfully]`);
    console.log(`📊 Total Live Numbers Synced/Updated: ${totalLiveSynced}`);
    console.log(`🧹 Total Dead Numbers Purged: ${totalDeadPurged}`);
    console.log(`🎉 ========================================================\n`);

    return {
      success: true,
      totalSynced: totalLiveSynced,
      totalDeadPurged,
      rangesCount: targetRanges.length
    };
  } catch (err) {
    console.error('❌ [Lamix Sync Exception]:', err.message);
    return { success: false, error: err.message, totalSynced: totalLiveSynced, totalDeadPurged };
  } finally {
    isSyncRunning = false;
  }
}

module.exports = {
  getRanges,
  getNumbers,
  getCdrs,
  extractOtp,
  getAllLiveNumbersForRange,
  syncNumbersToDatabase,
  USD_TO_BDT
};
