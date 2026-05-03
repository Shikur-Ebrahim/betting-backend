const express = require('express');
const { pool } = require('../db/pool');
const { getDocument, listCollection } = require('../db/documents');
const { 
  getFixturesForFrontend, 
  getFixturesByCountryForFrontend, 
  getOddsMapForFrontend, 
  getLeaguesForFrontend 
} = require('../services/oddsService');

const router = express.Router();

router.get('/leagues', async (_req, res) => {
  try {
    const doc = await getDocument('config', 'leagues_list');
    const leagues = doc?.data?.leagues || [];
    const response = leagues.map((league) => ({
      league: {
        id: league.id,
        name: league.name,
        logo: league.logo,
        type: league.type || 'League',
      },
      country: {
        name: league.country || 'Unknown',
        flag: league.flag || league.logo,
      },
    }));
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/fixtures', async (req, res) => {
  try {
    const fixtures = await getFixturesForFrontend();
    
    // Filter by league if specified
    const leagueId = req.query.league ? String(req.query.league) : null;
    let filteredFixtures = fixtures;
    
    if (leagueId) {
      filteredFixtures = fixtures.filter(f => String(f.league.id) === leagueId);
    }

    res.json({ response: filteredFixtures });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/teams', async (req, res) => {
  try {
    const leagueId = String(req.query.league || '');
    if (!leagueId) return res.status(400).json({ error: 'league query param is required' });

    const doc = await getDocument('league_teams', leagueId);
    const data = doc?.data?.teams || {};
    const response = Object.values(data);
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Polling: all live match payloads */
router.get('/live-matches', async (_req, res) => {
  try {
    const rows = await listCollection('live_matches');
    const matches = rows.map((r) => r.data);
    res.json({ matches });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Polling: fixtures ordered like Firestore query */
router.get('/fixtures-all', async (_req, res) => {
  try {
    const fixtures = await getFixturesForFrontend();
    res.json({ fixtures });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Odds document ids (fixtures that have an odds row) */
router.get('/odds-ids', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT document_id FROM app_documents WHERE collection_name = 'odds'`
    );
    res.json({ ids: rows.map((r) => r.document_id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Map fixtureId -> full odds document */
router.get('/odds-map', async (_req, res) => {
  try {
    const odds = await getOddsMapForFrontend();
    res.json({ odds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Single odds doc */
router.get('/odds/:fixtureId', async (req, res) => {
  try {
    const doc = await getDocument('odds', req.params.fixtureId);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Config leagues_list raw */
router.get('/config-leagues', async (_req, res) => {
  try {
    const leagues = await getLeaguesForFrontend();
    res.json({ leagues });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Combined bundle for home/popular polling */
router.get('/data-bundle', async (_req, res) => {
  try {
    // Get data from odds service (only fixtures with odds)
    const [fixtures, odds, leagues] = await Promise.all([
      getFixturesForFrontend(),
      getOddsMapForFrontend(),
      getLeaguesForFrontend()
    ]);

    // Get live matches from old system for now
    const liveRows = await pool.query(`SELECT data FROM app_documents WHERE collection_name = 'live_matches'`);

    res.json({
      liveMatches: liveRows.rows.map((r) => r.data),
      fixtures,
      odds,
      oddsIds: Object.keys(odds),
      leagues,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Match detail page — all fields served from DB (filled by backend worker from API-Football) */
router.get('/match/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const live = await getDocument('live_matches', id);
    const fix = await getDocument('fixtures', id);
    const odds = await getDocument('odds', id);
    const stats = await getDocument('match_stats', id);
    const lineups = await getDocument('match_lineups', id);
    const h2h = await getDocument('match_h2h', id);

    const match = live?.data || fix?.data || null;
    const leagueId = match?.league?.id;
    const season = match?.league?.season;
    let standings = [];
    if (leagueId != null && season != null) {
      const stDoc = await getDocument('standings', `${leagueId}_${season}`);
      standings = stDoc?.data?.response || [];
    }

    res.json({
      match,
      odds: odds?.data || null,
      stats: stats?.data?.response || [],
      lineups: lineups?.data?.response || [],
      h2h: h2h?.data?.response || [],
      standings,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
