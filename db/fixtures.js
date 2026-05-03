const { pool } = require('./pool');

// Save league information
async function saveLeague(leagueData) {
  const query = `
    INSERT INTO leagues (id, name, country, logo, season)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      country = EXCLUDED.country,
      logo = EXCLUDED.logo,
      season = EXCLUDED.season,
      updated_at = NOW()
    RETURNING *
  `;
  
  const values = [
    leagueData.id,
    leagueData.name,
    leagueData.country,
    leagueData.logo || null,
    leagueData.season || null
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0];
}

// Save fixture information
async function saveFixture(fixtureData) {
  const query = `
    INSERT INTO fixtures (id, league_id, home_team, away_team, home_team_logo, away_team_logo, fixture_date, status, venue)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (id) DO UPDATE SET
      league_id = EXCLUDED.league_id,
      home_team = EXCLUDED.home_team,
      away_team = EXCLUDED.away_team,
      home_team_logo = EXCLUDED.home_team_logo,
      away_team_logo = EXCLUDED.away_team_logo,
      fixture_date = EXCLUDED.fixture_date,
      status = EXCLUDED.status,
      venue = EXCLUDED.venue,
      updated_at = NOW()
    RETURNING *
  `;
  
  const values = [
    fixtureData.fixture.id,
    fixtureData.league.id,
    fixtureData.teams.home.name,
    fixtureData.teams.away.name,
    fixtureData.teams.home.logo || null,
    fixtureData.teams.away.logo || null,
    new Date(fixtureData.fixture.date),
    fixtureData.fixture.status || 'NS',
    fixtureData.fixture.venue || null
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0];
}

// Save odds information
async function saveOdds(fixtureId, oddsData, bookmaker = 'default') {
  const query = `
    INSERT INTO odds (fixture_id, bookmaker, home_odds, draw_odds, away_odds)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (fixture_id, bookmaker) DO UPDATE SET
      home_odds = EXCLUDED.home_odds,
      draw_odds = EXCLUDED.draw_odds,
      away_odds = EXCLUDED.away_odds,
      updated_at = NOW()
    RETURNING *
  `;
  
  const values = [
    fixtureId,
    bookmaker,
    oddsData.home ? parseFloat(oddsData.home) : null,
    oddsData.draw ? parseFloat(oddsData.draw) : null,
    oddsData.away ? parseFloat(oddsData.away) : null
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0];
}

// Mark fixture as tracked with odds
async function markTrackedFixture(fixtureId, hasOdds) {
  const query = `
    INSERT INTO tracked_fixtures (fixture_id, has_odds, last_checked)
    VALUES ($1, $2, NOW())
    ON CONFLICT (fixture_id) DO UPDATE SET
      has_odds = EXCLUDED.has_odds,
      last_checked = EXCLUDED.last_checked
    RETURNING *
  `;
  
  const result = await pool.query(query, [fixtureId, hasOdds]);
  return result.rows[0];
}

// Get fixtures with odds only
async function getFixturesWithOdds(limit = 50, offset = 0) {
  const query = `
    SELECT 
      f.id,
      f.fixture_date,
      f.status,
      f.home_team,
      f.away_team,
      f.home_team_logo,
      f.away_team_logo,
      f.venue,
      l.id as league_id,
      l.name as league_name,
      l.country as league_country,
      l.logo as league_logo,
      o.home_odds,
      o.draw_odds,
      o.away_odds
    FROM fixtures f
    JOIN leagues l ON f.league_id = l.id
    JOIN tracked_fixtures tf ON f.id = tf.fixture_id
    LEFT JOIN odds o ON f.id = o.fixture_id
    WHERE tf.has_odds = true
      AND f.fixture_date >= NOW()
      AND f.fixture_date <= NOW() + INTERVAL '7 days'
    ORDER BY f.fixture_date ASC
    LIMIT $1 OFFSET $2
  `;
  
  const result = await pool.query(query, [limit, offset]);
  return result.rows;
}

// Get fixtures grouped by country with odds
async function getFixturesByCountryWithOdds() {
  const query = `
    SELECT 
      l.country,
      l.id as league_id,
      l.name as league_name,
      l.logo as league_logo,
      f.id as fixture_id,
      f.fixture_date,
      f.home_team,
      f.away_team,
      f.home_team_logo,
      f.away_team_logo,
      o.home_odds,
      o.draw_odds,
      o.away_odds
    FROM fixtures f
    JOIN leagues l ON f.league_id = l.id
    JOIN tracked_fixtures tf ON f.id = tf.fixture_id
    LEFT JOIN odds o ON f.id = o.fixture_id
    WHERE tf.has_odds = true
      AND f.fixture_date >= NOW()
      AND f.fixture_date <= NOW() + INTERVAL '7 days'
    ORDER BY l.country, l.name, f.fixture_date
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

// Get all leagues
async function getAllLeagues() {
  const query = `
    SELECT id, name, country, logo, season
    FROM leagues
    ORDER BY country, name
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

// Process fixture with odds - main function to save fixture and mark as tracked
async function processFixtureWithOdds(fixtureData, oddsData) {
  try {
    // Save league first
    await saveLeague(fixtureData.league);
    
    // Save fixture
    const fixture = await saveFixture(fixtureData);
    
    // Save odds if available
    if (oddsData && (oddsData.home || oddsData.draw || oddsData.away)) {
      await saveOdds(fixture.id, oddsData);
      await markTrackedFixture(fixture.id, true);
      return fixture;
    } else {
      // Mark as tracked but without odds
      await markTrackedFixture(fixture.id, false);
      return null; // Return null for fixtures without odds
    }
  } catch (error) {
    console.error('Error processing fixture with odds:', error);
    throw error;
  }
}

module.exports = {
  saveLeague,
  saveFixture,
  saveOdds,
  markTrackedFixture,
  getFixturesWithOdds,
  getFixturesByCountryWithOdds,
  getAllLeagues,
  processFixtureWithOdds
};
