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

/**
 * Robust helper to fetch ALL rows from Supabase, overcoming PostgREST's 1000-row limit.
 * Uses pagination with range(from, from + pageSize - 1).
 */
async function fetchAllSupabaseRows(queryFn, pageSize = 1000) {
  const allRows = [];
  let from = 0;
  while (true) {
    try {
      const { data, error } = await queryFn().range(from, from + pageSize - 1);
      if (error) {
        console.error('⚠️ [fetchAllSupabaseRows Error]:', error.message);
        break;
      }
      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    } catch (e) {
      console.error('⚠️ [fetchAllSupabaseRows Exception]:', e.message);
      break;
    }
  }
  return allRows;
}

// =========================================================================
// ⏱️ Strict Sequential Rate Limiter for Lamix API (Max 40 req/min, 1 req/1.5s)
// Uses a Promise queue to prevent concurrent race conditions + sliding 60s window
// =========================================================================
class LamixRateLimiter {
  constructor(minDelayMs = 1500, maxPerMinute = 38) {
    this.minDelayMs = minDelayMs;
    this.maxPerMinute = maxPerMinute;
    this.requestTimestamps = [];
    this.lastRequestTime = 0;
    this.queue = Promise.resolve();
  }

  acquire() {
    this.queue = this.queue.then(() => this._acquireSlot());
    return this.queue;
  }

  async _acquireSlot() {
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
        const waitTime = Math.max(100, 60000 - (now - oldest) + 200);
        console.log(`⏳ [Lamix Rate Limit Guard] 38 reqs in 60s reached. Cooling down ${(waitTime / 1000).toFixed(1)}s...`);
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

const rateLimiter = new LamixRateLimiter(1500, 38);

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/json'
  },
  timeout: 30000
});

// Interceptor: strictly acquire slot sequentially before sending request
client.interceptors.request.use(async (config) => {
  await rateLimiter.acquire();
  return config;
});

// Interceptor: Auto-retry on 429, 5xx server errors, or transient network drops
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config) return Promise.reject(error);

    config.__retryCount = config.__retryCount || 0;
    const maxRetries = 6;

    const status = error.response?.status;
    const isRetryable =
      status === 429 ||
      (status >= 500 && status <= 599) ||
      error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNRESET' ||
      !error.response;

    if (isRetryable && config.__retryCount < maxRetries) {
      config.__retryCount += 1;
      const delay = status === 429
        ? 5000 * config.__retryCount
        : 2500 * config.__retryCount;

      console.warn(`⚠️ [Lamix API Auto-Retry ${config.__retryCount}/${maxRetries}] URL: ${config.url} Status: ${status || error.code}. Waiting ${(delay / 1000).toFixed(1)}s...`);
      await new Promise((r) => setTimeout(r, delay));
      return client.request(config);
    }

    return Promise.reject(error);
  }
);

// 1. Fetch Ranges from Lamix API
async function getRanges() {
  try {
    const res = await client.get('/api/v1/ranges');
    return res.data?.ranges || [];
  } catch (err) {
    console.error('❌ Lamix getRanges Error:', err.response?.data || err.message);
    return [];
  }
}

// 2. Fetch Numbers with cursor pagination (limit up to 500)
async function getNumbers(params = {}) {
  const query = new URLSearchParams();
  if (params.rangeId) query.append('rangeId', params.rangeId);
  query.append('limit', params.limit || 500);
  if (params.after) query.append('after', params.after);
  if (params.search) query.append('search', params.search);

  const res = await client.get(`/api/v1/numbers?${query.toString()}`);
  return res.data || { records: [] };
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

// 4. Universal OTP extraction engine
const { extractOtp } = require('./otpExtractor');

/**
 * 5. Fetch ALL live numbers for a specific range using cursor pagination.
 * Robust retry per page: will never abort prematurely on network glitch.
 */
async function getAllLiveNumbersForRange(rangeId, expectedCount = 0, onProgress = null) {
  const allRecords = [];
  let nextCursor = null;
  let page = 1;
  const limit = 500; // max batch supported by Lamix API

  while (true) {
    const params = { rangeId, limit };
    if (nextCursor) {
      params.after = nextCursor;
    }

    let data;
    let pageRetries = 0;
    while (true) {
      try {
        data = await getNumbers(params);
        break;
      } catch (err) {
        pageRetries++;
        console.error(`❌ [Lamix Range ${rangeId}] Page ${page} fetch error (attempt ${pageRetries}/6):`, err.message);
        if (pageRetries >= 6) {
          throw new Error(`Failed to fetch numbers for range ${rangeId} at page ${page} after 6 retries: ${err.message}`);
        }
        await new Promise((r) => setTimeout(r, 3000 * pageRetries));
      }
    }

    const records = data?.records || [];
    if (!records || records.length === 0) {
      break;
    }

    allRecords.push(...records);
    if (onProgress) {
      onProgress({ rangeId, page, count: allRecords.length, expected: expectedCount });
    }

    if (!data.nextCursor || data.nextCursor === nextCursor) {
      break;
    }
    nextCursor = data.nextCursor;
    page++;
  }

  return allRecords;
}

// Fetch all currently active assigned numbers in database using pagination
async function fetchAllAssignedNumbersSet(supabase) {
  const assignedSet = new Set();
  try {
    const nowIso = new Date().toISOString();
    const rows = await fetchAllSupabaseRows(() =>
      supabase
        .from('assigned_numbers')
        .select('number')
        .eq('status', 'ACTIVE')
        .gt('expires_at', nowIso)
    );

    for (const row of rows) {
      if (row.number) {
        assignedSet.add(normalizePhoneNumber(row.number));
        assignedSet.add(row.number);
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
 * 6. Production Sync & Dead Number Audit (Continuous & Complete)
 * - Fetches active ranges from Lamix API
 * - Loops across ranges until ALL expected numbers from the API are fetched
 * - Never purges dead numbers unless range fetch was 100% verified complete
 * - Respects 40 req/min rate limit with sequential queueing
 * - Uses Supabase pagination to audit entire number_pool (>1000 rows)
 */
async function syncNumbersToDatabase(supabase, targetRangeId = null, onProgress = null) {
  if (!supabase) return { synced: 0, deadPurged: 0, totalSynced: 0 };

  if (isSyncRunning) {
    console.warn('⚠️ [Pool Sync] Sync cycle is already running; skipping overlapping trigger.');
    return { alreadyRunning: true, synced: 0, totalSynced: 0, deadPurged: 0 };
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
      return { synced: 0, totalSynced: 0, deadPurged: 0, success: false };
    }

    const targetRanges = targetRangeId
      ? ranges.filter((r) => r.id === targetRangeId)
      : ranges.filter((r) => r.active);

    const totalExpectedNumbers = targetRanges.reduce((sum, r) => sum + (Number(r.numbers) || 0), 0);
    console.log(`📋 [Lamix Sync] Processing ${targetRanges.length} active range(s) | Expected Total Numbers: ${totalExpectedNumbers}`);

    // 2. Load set of currently active assigned numbers in DB
    const assignedSet = await fetchAllAssignedNumbersSet(supabase);

    // 2.5. 🧹 PURGE OBSOLETE / DEAD RANGES (Ranges in DB no longer present in Lamix account)
    // Uses fetchAllSupabaseRows to inspect all rows, avoiding the 1000 row limit
    if (!targetRangeId) {
      const activeRangeIds = new Set(targetRanges.map((r) => r.id));
      const allDbPoolRows = await fetchAllSupabaseRows(() =>
        supabase.from('number_pool').select('id, number, range_id, range_name, is_assigned')
      );

      if (allDbPoolRows && allDbPoolRows.length > 0) {
        const deadRangeRows = allDbPoolRows.filter(
          (r) => !r.range_id || !activeRangeIds.has(r.range_id)
        );

        if (deadRangeRows.length > 0) {
          console.log(`⚠️ [Dead Ranges Audit] Found ${deadRangeRows.length} number(s) belonging to obsolete/removed ranges.`);

          // Purge unassigned dead range numbers
          const unassignedDeadIds = deadRangeRows.filter((r) => !r.is_assigned).map((r) => r.id);
          for (let i = 0; i < unassignedDeadIds.length; i += 200) {
            const chunk = unassignedDeadIds.slice(i, i + 200);
            await supabase.from('number_pool').delete().in('id', chunk);
          }

          // Purge assigned dead range numbers & expire in assigned_numbers
          const assignedDead = deadRangeRows.filter((r) => r.is_assigned);
          if (assignedDead.length > 0) {
            const assignedDeadIds = assignedDead.map((r) => r.id);
            const assignedDeadNumbers = assignedDead.map((r) => r.number);
            for (let i = 0; i < assignedDeadIds.length; i += 200) {
              const chunk = assignedDeadIds.slice(i, i + 200);
              await supabase.from('number_pool').delete().in('id', chunk);
            }
            for (let i = 0; i < assignedDeadNumbers.length; i += 200) {
              const chunk = assignedDeadNumbers.slice(i, i + 200);
              await supabase.from('assigned_numbers').update({ status: 'EXPIRED' }).in('number', chunk);
            }
          }

          totalDeadPurged += deadRangeRows.length;
          console.log(`🧹 [Dead Ranges Purged] Successfully purged ${deadRangeRows.length} dead number(s) from obsolete ranges.`);
        }
      }
    }

    // 3. Continuous Sync Loop: Retries until all ranges and all numbers are 100% fetched
    const completedRanges = new Set();
    const maxPasses = 5;
    let pass = 1;

    while (completedRanges.size < targetRanges.length && pass <= maxPasses) {
      if (pass > 1) {
        console.log(`\n🔁 [Lamix Sync Pass ${pass}/${maxPasses}] Retrying ${targetRanges.length - completedRanges.size} pending range(s)...`);
      }

      for (const range of targetRanges) {
        if (completedRanges.has(range.id)) continue;

        const expectedCount = Number(range.numbers) || 0;
        console.log(`\n🌐 [Range Audit] Checking range: "${range.name}" (ID: ${range.id}, Expected: ${expectedCount})`);

        // Highest rate for this range
        let highestRateUsd = 0.01;
        if (range.rates && range.rates.length > 0) {
          const validRates = range.rates.map((r) => parseFloat(r.payoutRate) || 0);
          highestRateUsd = Math.max(...validRates) || 0.01;
        }
        const payoutBdt = Number((highestRateUsd * USD_TO_BDT).toFixed(2));

        try {
          // Fetch all live numbers currently in panel for this range
          const liveRecords = await getAllLiveNumbersForRange(range.id, expectedCount, (prog) => {
            if (onProgress) onProgress(prog);
          });

          console.log(`📡 [Range Audit] Lamix panel returned ${liveRecords.length}/${expectedCount} live number(s) for "${range.name}".`);

          // If expectedCount is set and we got less than expected, warn and retry in next pass
          if (expectedCount > 0 && liveRecords.length < expectedCount) {
            console.warn(`⚠️ [Incomplete Range Fetch] "${range.name}" got ${liveRecords.length} but expected ${expectedCount}. Will retry this range in next pass.`);
            // Do NOT purge dead numbers if fetch is incomplete!
            continue;
          }

          const activeNumbersSet = new Set();
          const activeRawSet = new Set();
          for (const item of liveRecords) {
            if (item.status === 'active') {
              activeNumbersSet.add(normalizePhoneNumber(item.number));
              activeRawSet.add(item.number);
            }
          }

          // =========================================================================
          // 🧹 DEAD NUMBER CHECK & PURGE FOR THIS RANGE (Only after 100% verified fetch)
          // =========================================================================
          const dbPoolRows = await fetchAllSupabaseRows(() =>
            supabase
              .from('number_pool')
              .select('id, number, is_assigned')
              .eq('range_id', range.id)
          );

          if (dbPoolRows && dbPoolRows.length > 0) {
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

          completedRanges.add(range.id);
          console.log(`✅ [Range Complete] "${range.name}": ${liveBatches.length} live numbers synced.`);
        } catch (rangeErr) {
          console.error(`⚠️ [Range Sync Error] "${range.name}":`, rangeErr.message);
        }
      }

      if (completedRanges.size < targetRanges.length) {
        pass++;
        if (pass <= maxPasses) {
          console.log(`⏳ [Cooldown] Waiting 5 seconds before retrying remaining ranges...`);
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    }

    const allRangesCompleted = completedRanges.size === targetRanges.length;

    console.log(`\n🎉 ========================================================`);
    console.log(`🎉 [Lamix Sync Completed] Status: ${allRangesCompleted ? '100% COMPLETE' : 'PARTIAL'}`);
    console.log(`📊 Ranges Completed: ${completedRanges.size}/${targetRanges.length}`);
    console.log(`📊 Total Live Numbers Synced/Updated: ${totalLiveSynced} / Expected: ${totalExpectedNumbers}`);
    console.log(`🧹 Total Dead Numbers Purged: ${totalDeadPurged}`);
    console.log(`🎉 ========================================================\n`);

    return {
      success: allRangesCompleted,
      allRangesCompleted,
      totalSynced: totalLiveSynced,
      synced: totalLiveSynced,
      totalDeadPurged,
      rangesCount: targetRanges.length,
      completedRangesCount: completedRanges.size,
      expectedTotal: totalExpectedNumbers
    };
  } catch (err) {
    console.error('❌ [Lamix Sync Exception]:', err.message);
    return { success: false, error: err.message, totalSynced: totalLiveSynced, synced: totalLiveSynced, totalDeadPurged };
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
  fetchAllSupabaseRows,
  normalizePhoneNumber,
  USD_TO_BDT
};
