const axios = require('axios');
const { enqueueApiCall } = require('../utils/rateLimiter');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const HOST = process.env.API_FOOTBALL_HOST || "v3.football.api-sports.io";
const API_KEY = process.env.API_FOOTBALL_KEY;

if (!API_KEY) {
  throw new Error("CRITICAL: API_FOOTBALL_KEY is missing in environment variables.");
}

/**
 * Base fetcher with retries and validation.
 */
async function fetchFromApi(endpoint, retries = 3) {
  if (!API_KEY) throw new Error("API Key missing");

  const execute = async () => {
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
        // Only throw if we expect data and got nothing. 
        // For some endpoints, empty might be valid, but here we treat it as "no update"
        console.warn(`[API] Empty response from ${endpoint}`);
        return null;
      }

      return data.response;
    } catch (error) {
      if (retries > 0) {
        const delay = 2000 * (4 - retries); // Exponential backoff
        console.log(`[API] Fetch failed for ${endpoint}. Retrying in ${delay}ms... (${retries} left)`);
        await new Promise(r => setTimeout(r, delay));
        return execute();
      }
      throw error;
    }
  };

  // Wrap in global queue
  return enqueueApiCall(execute);
}

module.exports = {
  getLiveMatches: () => fetchFromApi('/fixtures?live=all'),
  getUpcomingMatches: (leagueId, season) => fetchFromApi(`/fixtures?league=${leagueId}&season=${season}&next=50`),
  getOdds: (fixtureId) => fetchFromApi(`/odds?fixture=${fixtureId}`),
  getFixturesByDate: (date) => fetchFromApi(`/fixtures?date=${date}`),
  fetchFromApi
};
