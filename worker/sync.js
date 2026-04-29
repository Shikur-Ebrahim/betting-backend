const cron = require('node-cron');
const crypto = require('crypto');
const { db, admin } = require('../firebase/admin');
const footballApi = require('../services/footballApi');
const { queue } = require('../utils/rateLimiter');

// Cache to store hashes of last-written data to prevent redundant Firestore writes
const hashCache = new Map();
let liveCursor = 0;

const LEAGUES = [2, 3, 39, 140, 135, 78, 61, 94, 88, 848];
const LIVE_ODDS_BATCH_SIZE = Number(process.env.LIVE_ODDS_BATCH_SIZE || 8);
const PREMATCH_ODDS_WINDOW_HOURS = Number(process.env.PREMATCH_ODDS_WINDOW_HOURS || 72);

function getHash(data) {
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
}

function getSeason() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 6 ? currentYear : currentYear - 1;
}

function normalizeMatch(match) {
  return {
    ...match,
    _lastSyncedAt: new Date().toISOString(),
  };
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

async function writeMatchWithLeagueIndex(match) {
  const fixtureId = String(match.fixture.id);
  const leagueId = String(match.league?.id || 'unknown');
  const payload = normalizeMatch(match);
  const home = match?.teams?.home;
  const away = match?.teams?.away;

  await Promise.all([
    smartUpdate('fixtures', fixtureId, payload),
    smartUpdate(`leagues/${leagueId}/matches`, fixtureId, payload),
  ]);

  const teamsPayload = {
    updatedAt: new Date().toISOString(),
    teams: {
      ...(home?.id ? {
        [String(home.id)]: {
          team: { id: home.id, name: home.name, logo: home.logo },
          venue: { name: match?.fixture?.venue?.name || '' }
        }
      } : {}),
      ...(away?.id ? {
        [String(away.id)]: {
          team: { id: away.id, name: away.name, logo: away.logo },
          venue: { name: match?.fixture?.venue?.name || '' }
        }
      } : {})
    }
  };

  await db.collection('league_teams').doc(leagueId).set(teamsPayload, { merge: true });
}

async function writeOdds(fixtureId, oddsPayload, mode = 'unknown') {
  if (!Array.isArray(oddsPayload) || oddsPayload.length === 0) {
    return false;
  }

  const id = String(fixtureId);
  const data = {
    fixtureId: id,
    mode,
    bookmakers: oddsPayload,
    odds: oddsPayload,
    updatedAt: new Date().toISOString()
  };

  const changed = await smartUpdate('odds', id, data);
  if (!changed) return false;

  await db.collection('fixtures').doc(id).set({
    hasOdds: true,
    oddsUpdatedAt: data.updatedAt
  }, { merge: true });

  return true;
}

function pickBookmakersFromOddsResponse(oddsResponse) {
  if (!Array.isArray(oddsResponse) || oddsResponse.length === 0) return null;
  for (const row of oddsResponse) {
    if (Array.isArray(row?.bookmakers) && row.bookmakers.length > 0) {
      return row.bookmakers;
    }
  }
  return null;
}

/**
 * SYNC: Live matches and core fixture state (Every 20 seconds)
 */
async function syncLiveMatches() {
  console.log('[Sync] Starting Live Matches Sync...');
  try {
    const matches = await footballApi.getLiveMatches();
    if (!matches) return;

    const liveIds = [];
    for (const match of matches) {
      const fixtureId = String(match.fixture.id);
      liveIds.push(fixtureId);
      await smartUpdate('live_matches', fixtureId, normalizeMatch(match));
      await writeMatchWithLeagueIndex(match);
    }

    await db.collection('worker_state').doc('live').set({
      activeFixtureIds: liveIds,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.error('[Sync] Live Matches failed:', error.message);
  }
}

/**
 * SYNC: Prematch fixtures in batches (Every 10 minutes)
 */
async function syncUpcoming() {
  const season = getSeason();
  const discoveredLeagues = new Map();
  console.log(`[Sync] Starting Upcoming Matches Sync for Season ${season}...`);
  for (const leagueId of LEAGUES) {
    try {
      const matches = await footballApi.getUpcomingMatches(leagueId, season);
      if (!matches) continue;

      for (const match of matches) {
        const lid = String(match?.league?.id || leagueId);
        if (!discoveredLeagues.has(lid)) {
          discoveredLeagues.set(lid, {
            id: Number(match?.league?.id || leagueId),
            name: match?.league?.name || `League ${leagueId}`,
            country: match?.league?.country || 'Unknown',
            logo: match?.league?.logo || '',
            type: match?.league?.type || 'League'
          });
        }

        await writeMatchWithLeagueIndex(match);

        // Pre-load prematch odds for near-term fixtures
        const matchTime = new Date(match.fixture.date).getTime();
        const diff = matchTime - Date.now();
        if (diff > 0 && diff < PREMATCH_ODDS_WINDOW_HOURS * 60 * 60 * 1000) {
          const odds = await footballApi.getOdds(match.fixture.id);
          const bookmakers = pickBookmakersFromOddsResponse(odds);
          if (bookmakers) {
            await writeOdds(match.fixture.id, bookmakers, 'prematch');
          }
        }
      }
    } catch (error) {
      console.error(`[Sync] Upcoming failed for league ${leagueId}:`, error.message);
    }
  }

  if (discoveredLeagues.size > 0) {
    await db.collection('config').doc('leagues_list').set({
      leagues: Array.from(discoveredLeagues.values())
    }, { merge: true });
  }
}

/**
 * SYNC: Live odds, rotated to avoid spikes (Every 20 seconds)
 */
async function syncLiveOdds() {
  console.log('[Sync] Starting Live Odds Sync...');
  try {
    const snapshot = await db.collection('live_matches').get();
    const liveIds = snapshot.docs.map(doc => doc.id);
    if (liveIds.length === 0) return;

    const batch = [];
    for (let i = 0; i < Math.min(liveIds.length, LIVE_ODDS_BATCH_SIZE); i += 1) {
      const idx = (liveCursor + i) % liveIds.length;
      batch.push(liveIds[idx]);
    }
    liveCursor = (liveCursor + LIVE_ODDS_BATCH_SIZE) % liveIds.length;

    for (const id of batch) {
      const odds = await footballApi.getOdds(id);
      const bookmakers = pickBookmakersFromOddsResponse(odds);
      if (bookmakers) {
        await writeOdds(id, bookmakers, 'live');
      }
    }
  } catch (error) {
    console.error('[Sync] Live odds failed:', error.message);
  }
}

/**
 * SYNC: Prematch odds refresh for near kickoff matches (Every 10 minutes)
 */
async function syncPrematchOdds() {
  console.log('[Sync] Starting Prematch Odds Sync...');
  try {
    const now = Date.now();
    const inWindow = now + PREMATCH_ODDS_WINDOW_HOURS * 60 * 60 * 1000;
    const snapshot = await db.collection('fixtures').get();

    for (const doc of snapshot.docs) {
      const fixture = doc.data();
      const kickoff = new Date(fixture?.fixture?.date || 0).getTime();
      const status = fixture?.fixture?.status?.short;
      if (!kickoff || kickoff < now || kickoff > inWindow) continue;
      if (status === 'LIVE' || status === '1H' || status === '2H') continue;

      const lastOdds = fixture?.oddsUpdatedAt ? new Date(fixture.oddsUpdatedAt).getTime() : 0;
      if (lastOdds && now - lastOdds < 5 * 60 * 1000) continue;

      const odds = await footballApi.getOdds(doc.id);
      const bookmakers = pickBookmakersFromOddsResponse(odds);
      if (bookmakers) {
        await writeOdds(doc.id, bookmakers, 'prematch');
      }
    }
  } catch (error) {
    console.error('[Sync] Prematch odds failed:', error.message);
  }
}

async function markWorkerHeartbeat() {
  await db.collection('worker_state').doc('heartbeat').set({
    at: admin.firestore.FieldValue.serverTimestamp(),
    queueSize: queue.size,
    queuePending: queue.pending
  }, { merge: true });
}

// --- SCHEDULING ---

// Every 20 seconds
cron.schedule('*/20 * * * * *', async () => {
  await syncLiveMatches();
  await syncLiveOdds();
  await markWorkerHeartbeat();
});

// Every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  await syncUpcoming();
  await syncPrematchOdds();
  await markWorkerHeartbeat();
});

console.log('--- Worker Started 24/7 ---');
console.log('Schedulers initialized: Live+Odds (20s), Upcoming+Prematch (10m)');

// Initial run
syncLiveMatches();
syncUpcoming();
syncLiveOdds();
syncPrematchOdds();
