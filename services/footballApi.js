const axios = require('axios');
const { enqueueApiCall } = require('../utils/rateLimiter');
const { pool } = require('../db/pool');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const HOST = process.env.API_FOOTBALL_HOST || 'v3.football.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY;
const API_CACHE_COLLECTION = process.env.API_CACHE_COLLECTION || 'api_cache';

const inFlightRequests = new Map();

if (!API_KEY) {
  throw new Error('CRITICAL: API_FOOTBALL_KEY is missing in environment variables.');
}

function getCacheTtlMs(endpoint) {
  if (endpoint.includes('/fixtures?live=')) return 10 * 1000;
  if (endpoint.includes('/odds?fixture=')) return 20 * 1000;
  if (endpoint.includes('/fixtures?league=')) return 10 * 60 * 1000;
  if (endpoint.includes('/fixtures?date=')) return 5 * 60 * 1000;
  if (endpoint.includes('/fixtures/statistics')) return 3 * 60 * 1000;
  if (endpoint.includes('/fixtures/lineups')) return 10 * 60 * 1000;
  if (endpoint.includes('/fixtures/headtohead')) return 6 * 60 * 60 * 1000;
  if (endpoint.includes('/standings?')) return 45 * 60 * 1000;
  return 2 * 60 * 1000;
}

function buildCacheKey(endpoint) {
  return endpoint.replace(/[/?&=]/g, '_');
}

async function getCachedResponse(endpoint) {
  const key = buildCacheKey(endpoint);
  const { rows } = await pool.query(
    `SELECT response, cached_at, expires_in_ms FROM api_cache WHERE cache_key = $1`,
    [key]
  );
  const row = rows[0];
  if (!row?.response || !row.cached_at) return null;

  const ttl = row.expires_in_ms || getCacheTtlMs(endpoint);
  const ageMs = Date.now() - new Date(row.cached_at).getTime();
  if (ageMs > ttl) return null;

  return row.response;
}

async function setCachedResponse(endpoint, responseData) {
  if (!responseData) return;
  const key = buildCacheKey(endpoint);
  const ttl = getCacheTtlMs(endpoint);
  await pool.query(
    `INSERT INTO api_cache (cache_key, endpoint, response, cached_at, expires_in_ms)
     VALUES ($1, $2, $3::jsonb, NOW(), $4)
     ON CONFLICT (cache_key) DO UPDATE SET
       endpoint = EXCLUDED.endpoint,
       response = EXCLUDED.response,
       cached_at = NOW(),
       expires_in_ms = EXCLUDED.expires_in_ms`,
    [key, endpoint, JSON.stringify(responseData), ttl]
  );
}

/**
 * Base fetcher with retries and validation.
 */
async function fetchFromApi(endpoint, retries = 3) {
  if (!API_KEY) throw new Error('API Key missing');
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
          headers: { 'x-apisports-key': API_KEY },
          timeout: 15000,
        });

        const data = response.data;

        if (data.errors && Object.keys(data.errors).length > 0) {
          throw new Error(`API Provider Error: ${JSON.stringify(data.errors)}`);
        }

        if (!data.response || (Array.isArray(data.response) && data.response.length === 0)) {
          console.warn(`[API] Empty response from ${endpoint}`);
          return null;
        }

        await setCachedResponse(endpoint, data.response);
        return data.response;
      } catch (error) {
        if (attemptsLeft > 0) {
          const delay = 2000 * (4 - attemptsLeft);
          console.log(`[API] Fetch failed for ${endpoint}. Retrying in ${delay}ms... (${attemptsLeft} left)`);
          await new Promise((r) => setTimeout(r, delay));
          return execute(attemptsLeft - 1);
        }
        throw error;
      }
    };

    return enqueueApiCall(() => execute(retries));
  })().finally(() => {
    inFlightRequests.delete(dedupeKey);
  });

  inFlightRequests.set(dedupeKey, requestPromise);
  return requestPromise;
}

module.exports = {
  getLiveMatches: () => fetchFromApi('/fixtures?live=all'),
  getUpcomingMatches: (leagueId, season, limit = 50) =>
    fetchFromApi(`/fixtures?league=${leagueId}&season=${season}&next=${limit}`),
  getOdds: (fixtureId) => fetchFromApi(`/odds?fixture=${fixtureId}`),
  getFixturesByDate: (date) => fetchFromApi(`/fixtures?date=${date}`),
  getFixtureStatistics: (fixtureId) =>
    fetchFromApi(`/fixtures/statistics?fixture=${fixtureId}`),
  getFixtureLineups: (fixtureId) =>
    fetchFromApi(`/fixtures/lineups?fixture=${fixtureId}`),
  getHeadToHead: (homeTeamId, awayTeamId) =>
    fetchFromApi(`/fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}`),
  getStandings: (leagueId, season) =>
    fetchFromApi(`/standings?league=${leagueId}&season=${season}`),
  fetchFromApi,
};
