const { db } = require('../firebase/admin');
const PQueue = require('p-queue').default;

// 75,000/day ~= 0.868 req/s. Keep a safety margin with ~0.857 req/s.
const queue = new PQueue({ interval: 7000, intervalCap: 6, concurrency: 1 });

const MAX_DAILY_REQUESTS = 75000;
const HARD_STOP_THRESHOLD = 74000;

async function getUsage() {
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const docRef = db.collection('sync_stats').doc(dateStr);
  const doc = await docRef.get();

  if (!doc.exists) {
    // Daily Reset Logic: Initialize new day
    const initialData = {
      requests: 0,
      errorCount: 0,
      lastSyncTime: null,
      date: dateStr
    };
    await docRef.set(initialData);
    return initialData;
  }

  return doc.data();
}

async function incrementUsage() {
  const dateStr = new Date().toISOString().split('T')[0];
  const docRef = db.collection('sync_stats').doc(dateStr);
  
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    const newRequests = (doc.data()?.requests || 0) + 1;
    transaction.update(docRef, { requests: newRequests });
  });
}

async function logError(errorMsg) {
  const dateStr = new Date().toISOString().split('T')[0];
  const docRef = db.collection('sync_stats').doc(dateStr);
  
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    const newErrors = (doc.data()?.errorCount || 0) + 1;
    transaction.update(docRef, { 
      errorCount: newErrors,
      lastError: errorMsg,
      lastErrorTime: new Date().toISOString()
    });
  });
}

async function updateLastSync() {
  const dateStr = new Date().toISOString().split('T')[0];
  const docRef = db.collection('sync_stats').doc(dateStr);
  await docRef.update({ lastSyncTime: new Date().toISOString() });
}

async function canMakeRequest() {
  const usage = await getUsage();
  if (usage.requests >= HARD_STOP_THRESHOLD || usage.requests >= MAX_DAILY_REQUESTS) {
    console.warn(`[RateLimiter] Hard stop reached: ${usage.requests} requests today.`);
    return false;
  }
  return true;
}

/**
 * Execute a task through the global queue with rate limiting and usage tracking.
 */
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
  queue
};
