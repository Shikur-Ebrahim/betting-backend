// Diagnose deployed backend issues
const axios = require('axios');

const BACKEND_URL = 'https://betting-backend-adlh.onrender.com';

async function diagnoseBackend() {
  console.log('🔍 Diagnosing Deployed Backend Issues...');
  console.log('🌐 Backend URL:', BACKEND_URL);
  
  try {
    // Test 1: Basic connectivity
    console.log('\n1️⃣ Testing basic connectivity...');
    try {
      const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
      console.log('✅ Basic connectivity: OK');
      console.log('📊 Health response:', response.data);
    } catch (error) {
      console.log('❌ Basic connectivity failed:', error.message);
      return;
    }

    // Test 2: Check if routes exist
    console.log('\n2️⃣ Testing route availability...');
    const routes = [
      '/api/football/leagues',
      '/api/football/fixtures',
      '/api/football/live-matches',
      '/api/football/data-bundle'
    ];

    for (const route of routes) {
      try {
        const response = await axios.get(`${BACKEND_URL}${route}`, { 
          timeout: 5000,
          validateStatus: (status) => status < 500 // Accept 404, 400 etc but not 500
        });
        console.log(`✅ ${route}: ${response.status} - Route exists`);
      } catch (error) {
        if (error.response?.status === 500) {
          console.log(`⚠️  ${route}: 500 - Server error (likely database/API config issue)`);
        } else if (error.response?.status === 404) {
          console.log(`❌ ${route}: 404 - Route not found`);
        } else {
          console.log(`❌ ${route}: ${error.message}`);
        }
      }
    }

    // Test 3: Check if database is connected (try a simple query)
    console.log('\n3️⃣ Testing database connection...');
    try {
      const response = await axios.get(`${BACKEND_URL}/stats`, { timeout: 10000 });
      console.log('✅ Database connection: OK');
      console.log('📊 Stats response:', response.data);
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        console.log('⚠️  Database connection: TIMEOUT (likely database not connected)');
      } else if (error.response?.status === 500) {
        console.log('⚠️  Database connection: SERVER ERROR (database config issue)');
      } else {
        console.log('❌ Database connection failed:', error.message);
      }
    }

    // Test 4: Check API-Football integration
    console.log('\n4️⃣ Testing API-Football integration...');
    try {
      const response = await axios.get(`${BACKEND_URL}/api/football/leagues`, { timeout: 15000 });
      if (response.status === 200 && response.data.response) {
        console.log('✅ API-Football: Working');
        console.log('📊 Leagues found:', response.data.response.length);
      } else {
        console.log('⚠️  API-Football: Unexpected response');
      }
    } catch (error) {
      if (error.response?.status === 500) {
        console.log('⚠️  API-Football: SERVER ERROR (API key or database issue)');
      } else {
        console.log('❌ API-Football failed:', error.message);
      }
    }

    // Test 5: Check worker status
    console.log('\n5️⃣ Testing worker status...');
    try {
      // Try to get worker state from database
      const response = await axios.get(`${BACKEND_URL}/stats`, { timeout: 10000 });
      if (response.data.queueSize !== undefined) {
        console.log('✅ Worker: Active');
        console.log('📊 Queue size:', response.data.queueSize);
      } else {
        console.log('⚠️  Worker: Status unknown');
      }
    } catch (error) {
      console.log('❌ Worker status check failed:', error.message);
    }

  } catch (error) {
    console.error('💥 Diagnosis failed:', error.message);
  }

  console.log('\n🔧 Common Issues and Solutions:');
  console.log('1. Environment Variables: Check if DATABASE_URL and API_FOOTBALL_KEY are set in Render');
  console.log('2. Database Connection: Verify PostgreSQL is accessible from Render');
  console.log('3. API-Football Key: Ensure the API key is valid and has quota');
  console.log('4. Worker Status: Check if worker is running properly');
  console.log('5. Route Configuration: Verify all routes are properly registered');

  console.log('\n📝 Next Steps:');
  console.log('1. Check Render dashboard for environment variables');
  console.log('2. Review Render logs for specific error messages');
  console.log('3. Verify database connectivity from Render');
  console.log('4. Test API-Football key validity');
  console.log('5. Restart the service if needed');
}

if (require.main === module) {
  diagnoseBackend();
}

module.exports = { diagnoseBackend };
