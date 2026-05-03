require('dotenv').config();
const { ensureSchema } = require('../db/schema');
const { saveLeague, saveFixture, saveOdds, markTrackedFixture } = require('../db/fixtures');

async function initializeOddsData() {
  try {
    console.log('🚀 Initializing odds data...');
    
    // Ensure schema exists
    await ensureSchema();
    console.log('✅ Database schema created/verified');
    
    // Sample leagues
    const sampleLeagues = [
      { id: 39, name: 'Premier League', country: 'England', logo: 'https://media.api-sports.io/football/leagues/39.png', season: 2024 },
      { id: 140, name: 'La Liga', country: 'Spain', logo: 'https://media.api-sports.io/football/leagues/140.png', season: 2024 },
      { id: 135, name: 'Serie A', country: 'Italy', logo: 'https://media.api-sports.io/football/leagues/135.png', season: 2024 },
      { id: 78, name: 'Bundesliga', country: 'Germany', logo: 'https://media.api-sports.io/football/leagues/78.png', season: 2024 },
      { id: 61, name: 'Ligue 1', country: 'France', logo: 'https://media.api-sports.io/football/leagues/61.png', season: 2024 },
      { id: 2, name: 'Champions League', country: 'Europe', logo: 'https://media.api-sports.io/football/leagues/2.png', season: 2024 },
      { id: 3, name: 'Europa League', country: 'Europe', logo: 'https://media.api-sports.io/football/leagues/3.png', season: 2024 },
      { id: 848, name: 'Eredivisie', country: 'Netherlands', logo: 'https://media.api-sports.io/football/leagues/848.png', season: 2024 },
      { id: 394, name: 'Primeira Liga', country: 'Portugal', logo: 'https://media.api-sports.io/football/leagues/394.png', season: 2024 },
      { id: 403, name: 'Russian Premier League', country: 'Russia', logo: 'https://media.api-sports.io/football/leagues/403.png', season: 2024 },
      { id: 135, name: 'Serie A', country: 'Italy', logo: 'https://media.api-sports.io/football/leagues/135.png', season: 2024 },
      { id: 71, name: 'Serie B', country: 'Italy', logo: 'https://media.api-sports.io/football/leagues/71.png', season: 2024 },
      { id: 140, name: 'Segunda Division', country: 'Spain', logo: 'https://media.api-sports.io/football/leagues/140.png', season: 2024 },
      { id: 384, name: 'Liga 1', country: 'Romania', logo: 'https://media.api-sports.io/football/leagues/384.png', season: 2024 }
    ];
    
    // Save leagues
    for (const league of sampleLeagues) {
      await saveLeague(league);
    }
    console.log('✅ Sample leagues saved');
    
    // Sample fixtures with odds
    const sampleFixtures = [
      {
        fixture: { id: 1001, date: new Date(Date.now() + 86400000).toISOString(), status: 'NS' },
        league: { id: 39, name: 'Premier League', country: 'England' },
        teams: { home: { name: 'Manchester United' }, away: { name: 'Liverpool' } }
      },
      {
        fixture: { id: 1002, date: new Date(Date.now() + 172800000).toISOString(), status: 'NS' },
        league: { id: 140, name: 'La Liga', country: 'Spain' },
        teams: { home: { name: 'Real Madrid' }, away: { name: 'Barcelona' } }
      },
      {
        fixture: { id: 1003, date: new Date(Date.now() + 259200000).toISOString(), status: 'NS' },
        league: { id: 135, name: 'Serie A', country: 'Italy' },
        teams: { home: { name: 'Juventus' }, away: { name: 'AC Milan' } }
      }
    ];
    
    // Sample odds
    const sampleOdds = {
      1001: { home: '2.10', draw: '3.40', away: '3.20' },
      1002: { home: '1.80', draw: '3.60', away: '4.50' },
      1003: { home: '2.00', draw: '3.30', away: '3.80' }
    };
    
    // Save fixtures and odds
    for (const fixtureData of sampleFixtures) {
      await saveFixture(fixtureData);
      
      const odds = sampleOdds[fixtureData.fixture.id];
      if (odds) {
        await saveOdds(fixtureData.fixture.id, odds);
        await markTrackedFixture(fixtureData.fixture.id, true);
        console.log(`✅ Saved fixture ${fixtureData.fixture.id} with odds`);
      }
    }
    
    console.log('✅ Sample odds data initialized successfully');
    console.log('🎯 Database now contains only fixtures with assigned odds');
    
  } catch (error) {
    console.error('❌ Error initializing odds data:', error);
    process.exit(1);
  }
}

// Run the initialization
if (require.main === module) {
  initializeOddsData()
    .then(() => {
      console.log('🎉 Initialization complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Initialization failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeOddsData };
