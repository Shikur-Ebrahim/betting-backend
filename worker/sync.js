const cron = require('node-cron');
const crypto = require('crypto');
const { db } = require('../firebase/admin');
const footballApi = require('../services/footballApi');

// Cache to store hashes of last-written data to prevent redundant Firestore writes
const hashCache = new Map();

function getHash(data) {
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
}

/**
 * Update a Firestore document only if the data has changed.
 */
async function smartUpdate(collection, docId, data) {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    console.log(`[SmartUpdate] Skipped ${collection}/${docId} - Data is empty or null.`);
    return false;
  }

  const currentHash = getHash(data);
  const cacheKey = `${collection}:${docId}`;

  if (hashCache.get(cacheKey) === currentHash) {
    // console.log(`[SmartUpdate] No change for ${collection}/${docId}`);
    return false;
  }

  try {
    await db.collection(collection).doc(docId.toString()).set({
      ...data,
      _updatedAt: new Date().toISOString()
    }, { merge: true });
    
    hashCache.set(cacheKey, currentHash);
    console.log(`[SmartUpdate] Updated ${collection}/${docId}`);
    return true;
  } catch (error) {
    console.error(`[SmartUpdate] Error updating ${collection}/${docId}:`, error.message);
    return false;
  }
}

/**
 * SYNC: Live Matches (Every 30 seconds)
 */
async function syncLiveMatches() {
  console.log('[Sync] Starting Live Matches Sync...');
  try {
    const matches = await footballApi.getLiveMatches();
    if (!matches) return;

    for (const match of matches) {
      await smartUpdate('live_matches', match.fixture.id, match);
      // Also update main fixtures collection
      await smartUpdate('fixtures', match.fixture.id, match);
    }
  } catch (error) {
    console.error('[Sync] Live Matches failed:', error.message);
  }
}

/**
 * SYNC: Upcoming Matches (Every 10 minutes)
 */
async function syncUpcoming() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const month = now.getMonth() + 1;
  // If month is before June, we might still be in the previous season for some leagues
  // But for API-Sports, usually '2024' means 2024-2025 season.
  const season = month >= 6 ? currentYear : currentYear - 1;

  // Expanded league list from config (fallback to a wider set)
  const leagues = [2, 3, 39, 140, 135, 78, 61, 94, 88, 848]; 

  console.log(`[Sync] Starting Upcoming Matches Sync for Season ${season}...`);
  for (const leagueId of leagues) {
    try {
      const matches = await footballApi.getUpcomingMatches(leagueId, season);
      if (!matches) continue;

      for (const match of matches) {
        await smartUpdate('fixtures', match.fixture.id, match);
        
        // If match is within next 48 hours, sync odds too
        const matchTime = new Date(match.fixture.date).getTime();
        const diff = matchTime - Date.now();
        if (diff > 0 && diff < 48 * 60 * 60 * 1000) {
           const odds = await footballApi.getOdds(match.fixture.id);
           if (odds && odds.length > 0) {
             await smartUpdate('odds', match.fixture.id, { fixtureId: match.fixture.id, odds: odds[0].bookmakers });
           }
        }
      }
    } catch (error) {
      console.error(`[Sync] Upcoming failed for league ${leagueId}:`, error.message);
    }
  }
}

/**
 * SYNC: Odds (Every 15 minutes)
 * Only for live or soon-to-start matches.
 */
async function syncOdds() {
  console.log('[Sync] Starting Odds Sync...');
  try {
    // Get fixtures that are live or starting soon
    const snapshot = await db.collection('live_matches').get();
    const liveIds = snapshot.docs.map(doc => doc.id);

    // Also get upcoming from fixtures (simplified logic: next 2 hours)
    // For this demo, we'll just sync odds for live matches
    for (const id of liveIds) {
      const odds = await footballApi.getOdds(id);
      if (odds && odds.length > 0) {
        await smartUpdate('odds', id, { fixtureId: id, odds: odds[0].bookmakers });
      }
    }
  } catch (error) {
    console.error('[Sync] Odds failed:', error.message);
  }
}

// --- SCHEDULING ---

// Every 30 seconds
cron.schedule('*/30 * * * * *', syncLiveMatches);

// Every 10 minutes
cron.schedule('*/10 * * * *', syncUpcoming);

// Every 15 minutes
cron.schedule('*/15 * * * *', syncOdds);

console.log('--- Worker Started 24/7 ---');
console.log('Schedulers initialized: Live (30s), Upcoming (10m), Odds (15m)');

// Initial run
syncLiveMatches();
syncUpcoming();
syncOdds();
