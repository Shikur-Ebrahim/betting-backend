const express = require('express');
const { db } = require('../firebase/admin');

const router = express.Router();

router.get('/leagues', async (_req, res) => {
  try {
    const snap = await db.collection('config').doc('leagues_list').get();
    const leagues = snap.exists ? (snap.data().leagues || []) : [];
    const response = leagues.map((league) => ({
      league: {
        id: league.id,
        name: league.name,
        logo: league.logo,
        type: league.type || 'League'
      },
      country: {
        name: league.country || 'Unknown',
        flag: league.flag || league.logo
      }
    }));
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/fixtures', async (req, res) => {
  try {
    const days = Number(req.query.days || 1);
    const leagueId = req.query.league ? String(req.query.league) : null;
    const now = Date.now();
    const end = now + Math.max(1, Math.min(days, 14)) * 24 * 60 * 60 * 1000;

    const snap = await db.collection('fixtures').get();
    let fixtures = snap.docs.map((d) => d.data());

    fixtures = fixtures.filter((f) => {
      const t = new Date(f?.fixture?.date || 0).getTime();
      if (!t || t < now || t > end) return false;
      if (leagueId && String(f?.league?.id) !== leagueId) return false;
      return true;
    });

    fixtures.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
    res.json({ response: fixtures });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/teams', async (req, res) => {
  try {
    const leagueId = String(req.query.league || '');
    if (!leagueId) return res.status(400).json({ error: 'league query param is required' });

    const snap = await db.collection('league_teams').doc(leagueId).get();
    const data = snap.exists ? (snap.data().teams || {}) : {};
    const response = Object.values(data);
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
