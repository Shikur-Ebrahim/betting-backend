const express = require('express');
const { pool } = require('../db/pool');
const { getDocument, listCollection } = require('../db/documents');

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
    const days = Number(req.query.days || 7); // Default to 7 days
    const leagueId = req.query.league ? String(req.query.league) : null;
    const now = Date.now();
    const end = now + Math.max(1, Math.min(days, 14)) * 24 * 60 * 60 * 1000;

    const { rows } = await pool.query(
      `SELECT data FROM app_documents
       WHERE collection_name = 'fixtures'
       ORDER BY (data->'fixture'->>'date') ASC NULLS LAST`
    );

    let fixtures = rows.map((r) => r.data);

    fixtures = fixtures.filter((f) => {
      const t = new Date(f?.fixture?.date || 0).getTime();
      if (!t || t < now || t > end) return false;
      if (leagueId && String(f?.league?.id) !== leagueId) return false;
      return true;
    });

    // Sort fixtures by date
    fixtures.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

    // Include odds information for each fixture if available
    const fixtureIds = fixtures.map(f => String(f.fixture.id));
    
    if (fixtureIds.length > 0) {
      const oddsRows = await pool.query(
        `SELECT document_id, data FROM app_documents 
         WHERE collection_name = 'odds' AND document_id = ANY($1)`,
        [fixtureIds]
      );
      
      const oddsMap = {};
      oddsRows.rows.forEach(row => {
        oddsMap[row.document_id] = row.data;
      });
      
      // Attach odds to each fixture
      fixtures = fixtures.map(fixture => {
        const fixtureId = String(fixture.fixture.id);
        return {
          ...fixture,
          odds: oddsMap[fixtureId] || null,
          hasOdds: !!oddsMap[fixtureId]
        };
      });
    }

    res.json({ response: fixtures });
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
    const { rows } = await pool.query(
      `SELECT data FROM app_documents
       WHERE collection_name = 'fixtures'
       ORDER BY (data->'fixture'->>'date') ASC NULLS LAST
       LIMIT 500`
    );
    res.json({ fixtures: rows.map((r) => r.data) });
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
    const rows = await listCollection('odds');
    const odds = {};
    rows.forEach((r) => {
      odds[r.document_id] = r.data;
    });
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
    const doc = await getDocument('config', 'leagues_list');
    res.json({ leagues: doc?.data?.leagues || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** Combined bundle for home/popular polling */
router.get('/data-bundle', async (_req, res) => {
  try {
    const [liveRows, fixtureRows, oddsRows, leaguesDoc] = await Promise.all([
      pool.query(`SELECT data FROM app_documents WHERE collection_name = 'live_matches'`),
      pool.query(
        `SELECT data FROM app_documents WHERE collection_name = 'fixtures'
         ORDER BY (data->'fixture'->>'date') ASC NULLS LAST LIMIT 500`
      ),
      pool.query(`SELECT document_id FROM app_documents WHERE collection_name = 'odds'`),
      getDocument('config', 'leagues_list'),
    ]);

    const oddsIds = new Set(oddsRows.rows.map((r) => r.document_id));

    const oddsDataRows = await pool.query(
      `SELECT document_id, data FROM app_documents WHERE collection_name = 'odds'`
    );
    const odds = {};
    oddsDataRows.rows.forEach((r) => {
      odds[r.document_id] = r.data;
    });

    // Filter fixtures to 7-day window and attach odds
    const now = Date.now();
    const weekEnd = now + 7 * 24 * 60 * 60 * 1000;
    let fixtures = fixtureRows.rows.map((r) => r.data);
    
    fixtures = fixtures.filter((f) => {
      const t = new Date(f?.fixture?.date || 0).getTime();
      return t && t >= now && t <= weekEnd;
    });

    // Attach odds to fixtures
    fixtures = fixtures.map(fixture => {
      const fixtureId = String(fixture.fixture.id);
      return {
        ...fixture,
        odds: odds[fixtureId] || null,
        hasOdds: !!odds[fixtureId]
      };
    });

    res.json({
      liveMatches: liveRows.rows.map((r) => r.data),
      fixtures,
      odds,
      oddsIds: Array.from(oddsIds),
      leagues: leaguesDoc?.data?.leagues || [],
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
