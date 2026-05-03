const cron = require('node-cron');
const crypto = require('crypto');
const { upsertDocument, getDocument, mergeDocumentData, listCollection } = require('../db/documents');
const footballApi = require('../services/footballApi');
const { queue } = require('../utils/rateLimiter');

const hashCache = new Map();
let liveCursor = 0;

const LEAGUES = [2, 3, 39, 140, 135, 78, 61, 94, 88, 848];
const LIVE_ODDS_BATCH_SIZE = Number(process.env.LIVE_ODDS_BATCH_SIZE || 15);
const PREMATCH_ODDS_WINDOW_HOURS = Number(process.env.PREMATCH_ODDS_WINDOW_HOURS || 168);

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

async function smartUpdate(collection, docId, data) {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    console.log(`[SmartUpdate] Skipped ${collection}/${docId} - Data is empty or null.`);
    return false;
  }

  const currentHash = getHash(data);
  const cacheKey = `${collection}:${docId}`;

  if (hashCache.get(cacheKey) === currentHash) {
    return false;
  }

  try {
    await upsertDocument(collection, docId.toString(), {
      ...data,
      _updatedAt: new Date().toISOString(),
    });

    hashCache.set(cacheKey, currentHash);
    console.log(`[SmartUpdate] Updated ${collection}/${docId}`);
    return true;
  } catch (error) {
    console.error(`[SmartUpdate] Error updating ${collection}/${docId}:`, error.message);
    return false;
  }
}

async function mergeLeagueTeams(leagueId, match) {
  const home = match?.teams?.home;
  const away = match?.teams?.away;
  const venueName = match?.fixture?.venue?.name || '';

  const existing = await getDocument('league_teams', leagueId);
  const prevTeams = (existing?.data && existing.data.teams) || {};

  const next = { ...prevTeams };
  if (home?.id) {
    next[String(home.id)] = {
      team: { id: home.id, name: home.name, logo: home.logo },
      venue: { name: venueName },
    };
  }
  if (away?.id) {
    next[String(away.id)] = {
      team: { id: away.id, name: away.name, logo: away.logo },
      venue: { name: venueName },
    };
  }

  await upsertDocument('league_teams', leagueId, {
    updatedAt: new Date().toISOString(),
    teams: next,
  });
}

async function writeMatchWithLeagueIndex(match) {
  const fixtureId = String(match.fixture.id);
  const leagueId = String(match.league?.id || 'unknown');
  const payload = normalizeMatch(match);

  await Promise.all([smartUpdate('fixtures', fixtureId, payload), mergeLeagueTeams(leagueId, match)]);
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
    updatedAt: new Date().toISOString(),
  };

  const changed = await smartUpdate('odds', id, data);
  if (!changed) return false;

  await mergeDocumentData('fixtures', id, {
    hasOdds: true,
    oddsUpdatedAt: data.updatedAt,
  });

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

    await upsertDocument('worker_state', 'live', {
      activeFixtureIds: liveIds,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Sync] Live Matches failed:', error.message);
  }
}

async function syncUpcoming() {
  const season = getSeason();
  const discoveredLeagues = new Map();
  console.log(`[Sync] Starting Upcoming Matches Sync for Season ${season}...`);
  for (const leagueId of LEAGUES) {
    try {
      const matches = await footballApi.getUpcomingMatches(leagueId, season, 100);
      if (!matches) continue;

      for (const match of matches) {
        const lid = String(match?.league?.id || leagueId);
        if (!discoveredLeagues.has(lid)) {
          discoveredLeagues.set(lid, {
            id: Number(match?.league?.id || leagueId),
            name: match?.league?.name || `League ${leagueId}`,
            country: match?.league?.country || 'Unknown',
            logo: match?.league?.logo || '',
            type: match?.league?.type || 'League',
          });
        }

        await writeMatchWithLeagueIndex(match);

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
    await mergeDocumentData('config', 'leagues_list', {
      leagues: Array.from(discoveredLeagues.values()),
    });
  }
}

async function syncLiveOdds() {
  console.log('[Sync] Starting Live Odds Sync...');
  try {
    const rows = await listCollection('live_matches');
    const liveIds = rows.map((r) => r.document_id);
    if (liveIds.length === 0) return;

    // Use rotating cursor to process different live games each cycle
    const batchSize = Math.min(liveIds.length, LIVE_ODDS_BATCH_SIZE);
    const batch = [];
    
    for (let i = 0; i < batchSize && i < liveIds.length; i++) {
      const idx = (liveCursor + i) % liveIds.length;
      batch.push(liveIds[idx]);
    }
    
    // Move cursor for next cycle
    liveCursor = (liveCursor + batchSize) % liveIds.length;
    
    console.log(`[Sync] Processing odds for ${batch.length}/${liveIds.length} live matches (cursor: ${liveCursor})`);
    
    // Process batch in parallel
    await Promise.all(batch.map(async (id) => {
      try {
        const odds = await footballApi.getOdds(id);
        const bookmakers = pickBookmakersFromOddsResponse(odds);
        if (bookmakers) {
          await writeOdds(id, bookmakers, 'live');
        }
      } catch (error) {
        console.warn(`[Sync] Failed odds for live match ${id}:`, error.message);
      }
    }));
    
    console.log(`[Sync] Completed odds update for ${batch.length} live matches`);
  } catch (error) {
    console.error('[Sync] Live odds failed:', error.message);
  }
}

async function syncPrematchOdds() {
  console.log('[Sync] Starting Prematch Odds Sync...');
  try {
    const now = Date.now();
    const inWindow = now + PREMATCH_ODDS_WINDOW_HOURS * 60 * 60 * 1000;
    const rows = await listCollection('fixtures');

    for (const row of rows) {
      const fixture = row.data;
      const kickoff = new Date(fixture?.fixture?.date || 0).getTime();
      const status = fixture?.fixture?.status?.short;
      if (!kickoff || kickoff < now || kickoff > inWindow) continue;
      if (status === 'LIVE' || status === '1H' || status === '2H') continue;

      const lastOdds = fixture?.oddsUpdatedAt ? new Date(fixture.oddsUpdatedAt).getTime() : 0;
      if (lastOdds && now - lastOdds < 3 * 60 * 1000) continue;

      const odds = await footballApi.getOdds(row.document_id);
      const bookmakers = pickBookmakersFromOddsResponse(odds);
      if (bookmakers) {
        await writeOdds(row.document_id, bookmakers, 'prematch');
      }
    }
  } catch (error) {
    console.error('[Sync] Prematch odds failed:', error.message);
  }
}

async function markWorkerHeartbeat() {
  await upsertDocument('worker_state', 'heartbeat', {
    at: new Date().toISOString(),
    queueSize: queue.size,
    queuePending: queue.pending,
  });
}

/** --- Match detail enrichment (stats / lineups / H2H / standings → DB). API-Football is server-only. --- */

function flattenStandingsRows(apiStandingsResponse) {
  const groups = apiStandingsResponse?.[0]?.league?.standings;
  if (!Array.isArray(groups)) return [];
  const out = [];
  for (const block of groups) {
    if (Array.isArray(block)) out.push(...block);
  }
  return out;
}

async function collectEnrichmentCandidates() {
  const now = Date.now();
  const past = now - 8 * 60 * 60 * 1000;
  const future = now + 7 * 24 * 60 * 60 * 1000;
  const map = new Map();

  const liveRows = await listCollection('live_matches');
  for (const row of liveRows) {
    if (row.data) map.set(row.document_id, row.data);
  }

  const fixRows = await listCollection('fixtures');
  for (const row of fixRows) {
    const t = new Date(row.data?.fixture?.date || 0).getTime();
    if (t >= past && t <= future && row.data) {
      map.set(row.document_id, row.data);
    }
  }

  return Array.from(map.entries()).map(([id, payload]) => ({ id, payload }));
}

const standingsCooldownMs = 45 * 60 * 1000;
const standingsLastFetched = new Map();

async function maybeRefreshStandings(leagueId, season) {
  if (leagueId == null || season == null) return;
  const key = `${leagueId}_${season}`;
  const last = standingsLastFetched.get(key) || 0;
  if (Date.now() - last < standingsCooldownMs) return;
  try {
    const st = await footballApi.getStandings(leagueId, season);
    const rows = flattenStandingsRows(st);
    if (rows.length > 0) {
      await upsertDocument('standings', key, {
        response: rows,
        updatedAt: new Date().toISOString(),
      });
      standingsLastFetched.set(key, Date.now());
      console.log(`[Enrich] standings ${key} (${rows.length} rows)`);
    }
  } catch (e) {
    console.warn('[Enrich] standings', key, e.message);
  }
}

async function enrichFixtureDetail(fixtureId, payload) {
  const fid = String(fixtureId);
  const homeId = payload?.teams?.home?.id;
  const awayId = payload?.teams?.away?.id;
  const leagueId = payload?.league?.id;
  const season = payload?.league?.season ?? getSeason();

  await maybeRefreshStandings(leagueId, season);

  if (homeId && awayId) {
    try {
      const h2h = await footballApi.getHeadToHead(homeId, awayId);
      if (Array.isArray(h2h) && h2h.length > 0) {
        await upsertDocument('match_h2h', fid, {
          response: h2h,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('[Enrich] h2h', fid, e.message);
    }
  }

  try {
    const stats = await footballApi.getFixtureStatistics(fid);
    if (Array.isArray(stats) && stats.length > 0) {
      await upsertDocument('match_stats', fid, {
        response: stats,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn('[Enrich] stats', fid, e.message);
  }

  try {
    const lineups = await footballApi.getFixtureLineups(fid);
    if (Array.isArray(lineups) && lineups.length > 0) {
      await upsertDocument('match_lineups', fid, {
        response: lineups,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn('[Enrich] lineups', fid, e.message);
  }
}

let enrichCursor = 0;
const ENRICH_BATCH = Number(process.env.MATCH_ENRICH_BATCH || 6);

async function syncMatchEnrichment() {
  try {
    const candidates = await collectEnrichmentCandidates();
    if (candidates.length === 0) return;

    const slice = [];
    for (let i = 0; i < ENRICH_BATCH; i += 1) {
      const idx = (enrichCursor + i) % candidates.length;
      slice.push(candidates[idx]);
    }
    enrichCursor = (enrichCursor + ENRICH_BATCH) % Math.max(candidates.length, 1);

    for (const { id, payload } of slice) {
      await enrichFixtureDetail(id, payload);
    }
  } catch (e) {
    console.error('[Enrich] batch failed:', e.message);
  }
}

function registerSchedulers() {
  cron.schedule('*/30 * * * * *', async () => {
    await syncLiveMatches();
    await syncLiveOdds();
    await markWorkerHeartbeat();
  });

  cron.schedule('*/30 * * * *', async () => {
    await syncUpcoming();
    await syncPrematchOdds();
    await markWorkerHeartbeat();
  });

  cron.schedule('*/15 * * * *', async () => {
    await syncMatchEnrichment();
  });

  console.log('--- Worker Started 24/7 ---');
  console.log(
    'Schedulers: Live+Odds (30s), Upcoming+Prematch (30m), Match-detail→DB (15m)'
  );

  syncLiveMatches();
  syncUpcoming();
  syncLiveOdds();
  syncPrematchOdds();
  syncMatchEnrichment();
}

const { ensureSchema } = require('../db/schema');

function bootstrapWorker() {
  registerSchedulers();
}

if (require.main === module) {
  ensureSchema()
    .then(() => {
      bootstrapWorker();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { bootstrapWorker };
