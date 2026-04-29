const axios = require('axios');
const { enqueueApiCall } = require('../utils/rateLimiter');
const { db, admin } = require('../firebase/admin');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const HOST = process.env.API_FOOTBALL_HOST || "v3.football.api-sports.io";
const API_KEY = process.env.API_FOOTBALL_KEY;
const API_CACHE_COLLECTION = process.env.API_CACHE_COLLECTION || 'api_cache';

const inFlightRequests = new Map();

if (!API_KEY) {
  throw new Error("CRITICAL: API_FOOTBALL_KEY is missing in environment variables.");
}

function getCacheTtlMs(endpoint) {
  if (endpoint.includes('/fixtures?live=')) return 10 * 1000;
  if (endpoint.includes('/odds?fixture=')) return 20 * 1000;
  if (endpoint.includes('/fixtures?league=')) return 10 * 60 * 1000;
  if (endpoint.includes('/fixtures?date=')) return 5 * 60 * 1000;
  return 2 * 60 * 1000;
}

function buildCacheKey(endpoint) {
  return endpoint.replace(/[/?&=]/g, '_');
}

async function getCachedResponse(endpoint) {
  if (!db) return null;
  const key = buildCacheKey(endpoint);
  const snap = await db.collection(API_CACHE_COLLECTION).doc(key).get();
  if (!snap.exists) return null;

  const data = snap.data();
  if (!data || !data.response || !data.cachedAt) return null;

  const ageMs = Date.now() - new Date(data.cachedAt).getTime();
  if (ageMs > getCacheTtlMs(endpoint)) return null;

  return data.response;
}

async function setCachedResponse(endpoint, responseData) {
  if (!db || !responseData) return;
  const key = buildCacheKey(endpoint);
  await db.collection(API_CACHE_COLLECTION).doc(key).set({
    endpoint,
    response: responseData,
    cachedAt: new Date().toISOString(),
    expiresInMs: getCacheTtlMs(endpoint),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

/**
 * Base fetcher with retries and validation.
 */
async function fetchFromApi(endpoint, retries = 3) {
  if (!API_KEY) throw new Error("API Key missing");
  const dedupeKey = endpoint;

  if (inFlightRequests.has(dedupeKey)) {
    return inFlightRequests.get(dedupeKey);
  }

  const requestPromise = (async () => {
    const cached = await getCachedResponse(endpoint);
    if (cached) {
      return cached;
    }

    const execute = async (attemptsLeft) => {
      try {
        const response = await axios.get(`https://${HOST}${endpoint}`, {
          headers: { "x-apisports-key": API_KEY },
          timeout: 15000 // 15s timeout
        });

        const data = response.data;

        // Fallback Protection: Check for internal API errors or empty results
        if (data.errors && Object.keys(data.errors).length > 0) {
          throw new Error(`API Provider Error: ${JSON.stringify(data.errors)}`);
        }

        if (!data.response || (Array.isArray(data.response) && data.response.length === 0)) {
          // Empty can be valid for some endpoints; return null so worker keeps last good odds.
          console.warn(`[API] Empty response from ${endpoint}`);
          return null;
        }

        await setCachedResponse(endpoint, data.response);
        return data.response;
      } catch (error) {
        if (attemptsLeft > 0) {
          const delay = 2000 * (4 - attemptsLeft); // Exponential backoff
          console.log(`[API] Fetch failed for ${endpoint}. Retrying in ${delay}ms... (${attemptsLeft} left)`);
          await new Promise(r => setTimeout(r, delay));
          return execute(attemptsLeft - 1);
        }
        throw error;
      }
    };

    // Wrap in global queue
    return enqueueApiCall(() => execute(retries));
  })().finally(() => {
    inFlightRequests.delete(dedupeKey);
  });

  inFlightRequests.set(dedupeKey, requestPromise);
  return requestPromise;
}

module.exports = {
  getLiveMatches: () => fetchFromApi('/fixtures?live=all'),
  getUpcomingMatches: (leagueId, season) => fetchFromApi(`/fixtures?league=${leagueId}&season=${season}&next=50`),
  getOdds: (fixtureId) => fetchFromApi(`/odds?fixture=${fixtureId}`),
  getFixturesByDate: (date) => fetchFromApi(`/fixtures?date=${date}`),
  fetchFromApi
};
