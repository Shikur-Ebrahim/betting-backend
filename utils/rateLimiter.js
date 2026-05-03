const PQueue = require('p-queue').default;
const { pool } = require('../db/pool');

const queue = new PQueue({ interval: 7000, intervalCap: 6, concurrency: 1 });

const MAX_DAILY_REQUESTS = 75000;
const HARD_STOP_THRESHOLD = 74000;

async function getUsage() {
  const dateStr = new Date().toISOString().split('T')[0];
  const { rows } = await pool.query(`SELECT * FROM sync_stats WHERE date_str = $1`, [dateStr]);

  if (!rows[0]) {
    const initialData = {
      requests: 0,
      errorCount: 0,
      lastSyncTime: null,
      date: dateStr,
    };
    await pool.query(
      `INSERT INTO sync_stats (date_str, requests, error_count)
       VALUES ($1, 0, 0)
       ON CONFLICT (date_str) DO NOTHING`,
      [dateStr]
    );
    return initialData;
  }

  const d = rows[0];
  return {
    requests: d.requests,
    errorCount: d.error_count,
    lastSyncTime: d.last_sync_time,
    date: dateStr,
  };
}

async function incrementUsage() {
  const dateStr = new Date().toISOString().split('T')[0];
  await pool.query(
    `INSERT INTO sync_stats (date_str, requests, error_count)
     VALUES ($1, 1, 0)
     ON CONFLICT (date_str) DO UPDATE SET
       requests = sync_stats.requests + 1`,
    [dateStr]
  );
}

async function logError(errorMsg) {
  const dateStr = new Date().toISOString().split('T')[0];
  await pool.query(
    `INSERT INTO sync_stats (date_str, requests, error_count, last_error, last_error_time)
     VALUES ($1, 0, 1, $2, NOW())
     ON CONFLICT (date_str) DO UPDATE SET
       error_count = sync_stats.error_count + 1,
       last_error = EXCLUDED.last_error,
       last_error_time = EXCLUDED.last_error_time`,
    [dateStr, errorMsg]
  );
}

async function updateLastSync() {
  const dateStr = new Date().toISOString().split('T')[0];
  await pool.query(
    `INSERT INTO sync_stats (date_str, requests, error_count, last_sync_time)
     VALUES ($1, 0, 0, NOW())
     ON CONFLICT (date_str) DO UPDATE SET last_sync_time = NOW()`,
    [dateStr]
  );
}

async function canMakeRequest() {
  const usage = await getUsage();
  if (usage.requests >= HARD_STOP_THRESHOLD || usage.requests >= MAX_DAILY_REQUESTS) {
    console.warn(`[RateLimiter] Hard stop reached: ${usage.requests} requests today.`);
    return false;
  }
  return true;
}

async function enqueueApiCall(task) {
  if (!(await canMakeRequest())) {
    throw new Error('API Daily Limit Reached');
  }

  return queue.add(async () => {
    try {
      await incrementUsage();
      const result = await task();
      await updateLastSync();
      return result;
    } catch (error) {
      await logError(error.message);
      throw error;
    }
  });
}

module.exports = {
  enqueueApiCall,
  getUsage,
  canMakeRequest,
  queue,
};
