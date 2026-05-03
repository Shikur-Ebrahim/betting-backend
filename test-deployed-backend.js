// Test deployed backend with live API keys
const axios = require('axios');

const BACKEND_URL = 'https://betting-backend-adlh.onrender.com';

async function testDeployedBackend() {
  console.log('🌐 Testing Deployed Backend at:', BACKEND_URL);
  console.log('🔑 Using Live API Keys from .env configuration');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  async function runTest(name, testFn) {
    console.log(`\n🧪 Testing: ${name}`);
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

  try {
    // Test 1: Health Check
    await runTest('Health Check', async () => {
      const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 10000 });
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      return response.data;
    });

    // Test 2: Stats Endpoint
    await runTest('Stats Endpoint', async () => {
      const response = await axios.get(`${BACKEND_URL}/stats`, { timeout: 10000 });
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      return response.data;
    });

    // Test 3: Leagues Endpoint
    await runTest('Leagues API', async () => {
      const response = await axios.get(`${BACKEND_URL}/api/football/leagues`, { timeout: 15000 });
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      if (!response.data.response || !Array.isArray(response.data.response)) {
        throw new Error('Invalid leagues data format');
      }
      return { count: response.data.response.length, leagues: response.data.response.slice(0, 3) };
    });

    // Test 4: Fixtures Endpoint (7-day games)
    await runTest('Fixtures API (7 days)', async () => {
      const response = await axios.get(`${BACKEND_URL}/api/football/fixtures`, { timeout: 15000 });
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      if (!response.data.response || !Array.isArray(response.data.response)) {
        throw new Error('Invalid fixtures data format');
      }
      
      // Check if fixtures have odds attached
      const withOdds = response.data.response.filter(f => f.hasOdds);
      return { 
        total: response.data.response.length, 
        withOdds: withOdds.length,
        sample: response.data.response.slice(0, 2)
      };
    });

    // Test 5: Live Matches Endpoint
    await runTest('Live Matches API', async () => {
      const response = await axios.get(`${BACKEND_URL}/api/football/live-matches`, { timeout: 15000 });
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      if (!response.data.matches || !Array.isArray(response.data.matches)) {
        throw new Error('Invalid live matches data format');
      }
      return { count: response.data.matches.length, sample: response.data.matches.slice(0, 2) };
    });

    // Test 6: Data Bundle Endpoint
    await runTest('Data Bundle API', async () => {
      const response = await axios.get(`${BACKEND_URL}/api/football/data-bundle`, { timeout: 20000 });
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      
      const data = response.data;
      return {
        liveMatches: data.liveMatches?.length || 0,
        fixtures: data.fixtures?.length || 0,
        oddsCount: Object.keys(data.odds || {}).length,
        leagues: data.leagues?.length || 0
      };
    });

    // Test 7: Odds IDs Endpoint
    await runTest('Odds IDs API', async () => {
      const response = await axios.get(`${BACKEND_URL}/api/football/odds-ids`, { timeout: 15000 });
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      if (!response.data.ids || !Array.isArray(response.data.ids)) {
        throw new Error('Invalid odds IDs data format');
      }
      return { count: response.data.ids.length };
    });

    // Test 8: Odds Map Endpoint
    await runTest('Odds Map API', async () => {
      const response = await axios.get(`${BACKEND_URL}/api/football/odds-map`, { timeout: 20000 });
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      if (!response.data.odds || typeof response.data.odds !== 'object') {
        throw new Error('Invalid odds map data format');
      }
      return { count: Object.keys(response.data.odds).length };
    });

    // Test 9: Config Leagues Endpoint
    await runTest('Config Leagues API', async () => {
      const response = await axios.get(`${BACKEND_URL}/api/football/config-leagues`, { timeout: 15000 });
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      if (!response.data.leagues || !Array.isArray(response.data.leagues)) {
        throw new Error('Invalid config leagues data format');
      }
      return { count: response.data.leagues.length };
    });

    // Test 10: Database Operations (Test a specific match if available)
    await runTest('Database Operations', async () => {
      // First get some fixtures to find a test ID
      const fixturesResponse = await axios.get(`${BACKEND_URL}/api/football/fixtures`, { timeout: 15000 });
      if (fixturesResponse.data.response && fixturesResponse.data.response.length > 0) {
        const testId = fixturesResponse.data.response[0].fixture.id;
        
        // Test match detail endpoint
        const matchResponse = await axios.get(`${BACKEND_URL}/api/football/match/${testId}`, { timeout: 15000 });
        if (matchResponse.status !== 200) throw new Error(`Match detail failed: ${matchResponse.status}`);
        
        return {
          testMatchId: testId,
          hasMatch: !!matchResponse.data.match,
          hasOdds: !!matchResponse.data.odds,
          hasStats: !!(matchResponse.data.stats && matchResponse.data.stats.length > 0)
        };
      } else {
        return { message: 'No fixtures available for testing' };
      }
    });

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    results.failed++;
  }

  // Print Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  console.log('\n📋 Detailed Results:');
  results.tests.forEach(test => {
    const icon = test.status === 'PASSED' ? '✅' : '❌';
    console.log(`${icon} ${test.name}: ${test.status}`);
    if (test.error) console.log(`   Error: ${test.error}`);
    if (test.result && typeof test.result === 'object') {
      Object.keys(test.result).forEach(key => {
        if (typeof test.result[key] === 'object') {
          console.log(`   ${key}: ${JSON.stringify(test.result[key])}`);
        } else {
          console.log(`   ${key}: ${test.result[key]}`);
        }
      });
    }
  });

  console.log('\n🎯 Backend Status:');
  if (results.failed === 0) {
    console.log('🟢 ALL TESTS PASSED - Backend is fully operational!');
  } else if (results.failed <= 2) {
    console.log('🟡 MOSTLY WORKING - Minor issues detected');
  } else {
    console.log('🔴 ISSUES DETECTED - Backend needs attention');
  }

  return results;
}

if (require.main === module) {
  testDeployedBackend()
    .then(results => {
      console.log('\n🚀 Test completed!');
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('💥 Fatal error:', error.message);
      process.exit(1);
    });
}

module.exports = { testDeployedBackend };
