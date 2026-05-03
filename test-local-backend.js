// Test local backend with full configuration
require('dotenv').config();

// Set environment variables for local testing
process.env.DATABASE_URL = 'postgresql://betting_udlw_user:9xVjD0u68n53ZxNnu1F5fHGaLBaPXSY6@dpg-d7rdg1m7r5hc739anheg-a.oregon-postgres.render.com/betting_udlw';
process.env.DATABASE_SSL = 'true';
process.env.PORT = '3004';
process.env.RUN_WORKER_IN_SERVER = 'false';
process.env.JWT_SECRET = 'betting_jwt_secret_2026_secure_key_for_production_use_change_in_deployment';
process.env.API_FOOTBALL_KEY = 'f76292e2e65556801c802093a417ece5';
process.env.LIVE_ODDS_BATCH_SIZE = '15';
process.env.PREMATCH_ODDS_WINDOW_HOURS = '168';

const { spawn } = require('child_process');
const axios = require('axios');

async function testLocalBackend() {
  console.log('🏠 Testing Local Backend with Full Configuration...');
  console.log('🔑 Using Live API Keys and Database');
  
  try {
    // Start local server
    console.log('🚀 Starting local backend server...');
    const server = spawn('node', ['server.js'], {
      stdio: 'pipe',
      env: { ...process.env }
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const baseURL = 'http://localhost:3004';
    console.log('🌐 Testing at:', baseURL);

    const results = {
      passed: 0,
      failed: 0,
      tests: []
    };

    async function runTest(name, testFn) {
      console.log(`\n🧪 ${name}`);
      try {
        const result = await testFn();
        console.log(`✅ ${name}: PASSED`);
        results.passed++;
        results.tests.push({ name, status: 'PASSED', result });
        return result;
      } catch (error) {
        console.log(`❌ ${name}: FAILED - ${error.message}`);
        results.failed++;
        results.tests.push({ name, status: 'FAILED', error: error.message });
        return null;
      }
    }

    // Test database connection
    await runTest('Database Connection', async () => {
      const response = await axios.get(`${baseURL}/stats`, { timeout: 10000 });
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      return response.data;
    });

    // Test API-Football integration
    await runTest('API-Football Integration', async () => {
      const response = await axios.get(`${baseURL}/api/football/leagues`, { timeout: 15000 });
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      if (!response.data.response || !Array.isArray(response.data.response)) {
        throw new Error('Invalid leagues data');
      }
      return { count: response.data.response.length, sample: response.data.response.slice(0, 2) };
    });

    // Test fixtures with odds
    await runTest('Fixtures with Odds (7 days)', async () => {
      const response = await axios.get(`${baseURL}/api/football/fixtures`, { timeout: 15000 });
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      
      const fixtures = response.data.response || [];
      const withOdds = fixtures.filter(f => f.hasOdds);
      
      return { 
        total: fixtures.length, 
        withOdds: withOdds.length,
        sample: fixtures.slice(0, 2)
      };
    });

    // Test live matches
    await runTest('Live Matches', async () => {
      const response = await axios.get(`${baseURL}/api/football/live-matches`, { timeout: 15000 });
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      return { count: response.data.matches?.length || 0 };
    });

    // Test data bundle
    await runTest('Data Bundle', async () => {
      const response = await axios.get(`${baseURL}/api/football/data-bundle`, { timeout: 20000 });
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      
      return {
        liveMatches: response.data.liveMatches?.length || 0,
        fixtures: response.data.fixtures?.length || 0,
        oddsCount: Object.keys(response.data.odds || {}).length,
        leagues: response.data.leagues?.length || 0
      };
    });

    // Test odds endpoints
    await runTest('Odds Endpoints', async () => {
      const oddsIds = await axios.get(`${baseURL}/api/football/odds-ids`, { timeout: 10000 });
      const oddsMap = await axios.get(`${baseURL}/api/football/odds-map`, { timeout: 15000 });
      
      return {
        oddsIds: oddsIds.data.ids?.length || 0,
        oddsMap: Object.keys(oddsMap.data.odds || {}).length
      };
    });

    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('📊 LOCAL BACKEND TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

    // Stop server
    server.kill();
    console.log('\n🛑 Local server stopped');

    if (results.failed === 0) {
      console.log('\n🎉 LOCAL BACKEND IS FULLY FUNCTIONAL!');
      console.log('✅ Database: Connected');
      console.log('✅ API-Football: Working');
      console.log('✅ All endpoints: Functional');
      
      console.log('\n🔧 DEPLOYED BACKEND FIXES NEEDED:');
      console.log('1. Go to Render dashboard → Environment');
      console.log('2. Add these environment variables:');
      console.log('   DATABASE_URL=postgresql://betting_udlw_user:9xVjD0u68n53ZxNnu1F5fHGaLBaPXSY6@dpg-d7rdg1m7r5hc739anheg-a.oregon-postgres.render.com/betting_udlw');
      console.log('   DATABASE_SSL=true');
      console.log('   API_FOOTBALL_KEY=f76292e2e65556801c802093a417ece5');
      console.log('   JWT_SECRET=betting_jwt_secret_2026_secure_key_for_production_use_change_in_deployment');
      console.log('   LIVE_ODDS_BATCH_SIZE=15');
      console.log('   PREMATCH_ODDS_WINDOW_HOURS=168');
      console.log('3. Restart the service');
      console.log('4. Test again with the deployed backend');
    }

    return results;

  } catch (error) {
    console.error('💥 Local backend test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  testLocalBackend();
}

module.exports = { testLocalBackend };
