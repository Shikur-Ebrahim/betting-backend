const { processFixtureWithOdds, getFixturesWithOdds, getFixturesByCountryWithOdds, getAllLeagues } = require('../db/fixtures');

// Check if fixture has valid odds
function hasValidOdds(oddsData) {
  if (!oddsData) return false;
  
  const hasHome = oddsData.home && oddsData.home !== 'N/A' && oddsData.home !== null;
  const hasDraw = oddsData.draw && oddsData.draw !== 'N/A' && oddsData.draw !== null;
  const hasAway = oddsData.away && oddsData.away !== 'N/A' && oddsData.away !== null;
  
  return hasHome || hasDraw || hasAway;
}

// Extract odds from API response
function extractOddsFromAPI(fixtureData) {
  if (!fixtureData.bookmakers || !Array.isArray(fixtureData.bookmakers)) {
    return null;
  }
  
  // Look for 1x2 odds in any bookmaker
  for (const bookmaker of fixtureData.bookmakers) {
    if (!bookmaker.bets) continue;
    
    for (const bet of bookmaker.bets) {
      if (bet.name === 'Match Winner' || bet.name === '1x2' || bet.id === 1) {
        if (!bet.values || !Array.isArray(bet.values)) continue;
        
        const odds = { home: null, draw: null, away: null };
        
        for (const value of bet.values) {
          if (value.value === 'Home' || value.value === '1') {
            odds.home = value.odd;
          } else if (value.value === 'Draw' || value.value === 'X') {
            odds.draw = value.odd;
          } else if (value.value === 'Away' || value.value === '2') {
            odds.away = value.odd;
          }
        }
        
        if (hasValidOdds(odds)) {
          return odds;
        }
      }
    }
  }
  
  return null;
}

// Process fixtures from API and save only those with odds
async function processFixturesFromAPI(fixturesData) {
  const processedFixtures = [];
  
  for (const fixtureData of fixturesData) {
    try {
      // Extract odds from API data
      const odds = extractOddsFromAPI(fixtureData);
      
      // Only process fixtures with valid odds
      if (hasValidOdds(odds)) {
        // Convert API format to our format
        const ourFixtureFormat = {
          fixture: {
            id: fixtureData.fixture.id,
            date: fixtureData.fixture.date,
            status: fixtureData.fixture.status,
            venue: fixtureData.fixture.venue
          },
          league: fixtureData.league,
          teams: fixtureData.teams
        };
        
        // Save to database
        const savedFixture = await processFixtureWithOdds(ourFixtureFormat, odds);
        if (savedFixture) {
          processedFixtures.push(savedFixture);
        }
      }
    } catch (error) {
      console.error(`Error processing fixture ${fixtureData.fixture?.id}:`, error);
    }
  }
  
  return processedFixtures;
}

// Get fixtures for frontend (only those with odds)
async function getFixturesForFrontend() {
  try {
    const fixtures = await getFixturesWithOdds();
    
    // Convert to frontend format
    const frontendFixtures = fixtures.map(fixture => ({
      fixture: {
        id: fixture.id,
        date: fixture.fixture_date,
        status: fixture.status,
        venue: fixture.venue
      },
      league: {
        id: fixture.league_id,
        name: fixture.league_name,
        country: fixture.league_country,
        logo: fixture.league_logo
      },
      teams: {
        home: {
          name: fixture.home_team,
          logo: fixture.home_team_logo
        },
        away: {
          name: fixture.away_team,
          logo: fixture.away_team_logo
        }
      }
    }));
    
    return frontendFixtures;
  } catch (error) {
    console.error('Error getting fixtures for frontend:', error);
    throw error;
  }
}

// Get fixtures grouped by country for frontend
async function getFixturesByCountryForFrontend() {
  try {
    const fixtures = await getFixturesByCountryWithOdds();
    
    // Group by country
    const groupedByCountry = {};
    
    fixtures.forEach(fixture => {
      const country = fixture.league_country;
      if (!groupedByCountry[country]) {
        groupedByCountry[country] = [];
      }
      
      groupedByCountry[country].push({
        fixture: {
          id: fixture.fixture_id,
          date: fixture.fixture_date,
          status: 'NS',
          venue: null
        },
        league: {
          id: fixture.league_id,
          name: fixture.league_name,
          country: fixture.league_country,
          logo: fixture.league_logo
        },
        teams: {
          home: {
            name: fixture.home_team,
            logo: fixture.home_team_logo
          },
          away: {
            name: fixture.away_team,
            logo: fixture.away_team_logo
          }
        }
      });
    });
    
    return groupedByCountry;
  } catch (error) {
    console.error('Error getting fixtures by country for frontend:', error);
    throw error;
  }
}

// Get odds map for frontend
async function getOddsMapForFrontend() {
  try {
    const fixtures = await getFixturesWithOdds();
    
    const oddsMap = {};
    fixtures.forEach(fixture => {
      if (fixture.home_odds || fixture.draw_odds || fixture.away_odds) {
        oddsMap[fixture.id] = {
          home: fixture.home_odds,
          draw: fixture.draw_odds,
          away: fixture.away_odds
        };
      }
    });
    
    return oddsMap;
  } catch (error) {
    console.error('Error getting odds map for frontend:', error);
    throw error;
  }
}

// Get leagues for frontend
async function getLeaguesForFrontend() {
  try {
    const leagues = await getAllLeagues();
    return leagues;
  } catch (error) {
    console.error('Error getting leagues for frontend:', error);
    throw error;
  }
}

// Sync data from API to database (only fixtures with odds)
async function syncDataFromAPI(apiClient) {
  try {
    console.log('Starting data sync from API...');
    
    // Get fixtures from API
    const fixturesResponse = await apiClient.get('/v3/fixtures', {
      params: {
        league: 'all',
        season: new Date().getFullYear(),
        from: new Date().toISOString().split('T')[0],
        to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }
    });
    
    if (fixturesResponse.data && fixturesResponse.data.response) {
      const processedCount = await processFixturesFromAPI(fixturesResponse.data.response);
      console.log(`Synced ${processedCount.length} fixtures with odds to database`);
      return processedCount;
    }
    
    return 0;
  } catch (error) {
    console.error('Error syncing data from API:', error);
    throw error;
  }
}

module.exports = {
  hasValidOdds,
  extractOddsFromAPI,
  processFixturesFromAPI,
  getFixturesForFrontend,
  getFixturesByCountryForFrontend,
  getOddsMapForFrontend,
  getLeaguesForFrontend,
  syncDataFromAPI
};
