// Detailed error analysis for deployed backend
const axios = require('axios');

const BACKEND_URL = 'https://betting-backend-adlh.onrender.com';

async function detailedErrorCheck() {
  console.log('🔍 Detailed Error Analysis - Deployed Backend');
  
  try {
    // Test 1: Check if basic server is working
    console.log('\n1️⃣ Basic Server Test:');
    const health = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
    console.log('✅ Health check:', health.data);
    
    // Test 2: Try to get error details from leagues endpoint
    console.log('\n2️⃣ Leagues Endpoint Error Details:');
    try {
      const response = await axios.get(`${BACKEND_URL}/api/football/leagues`, { 
        timeout: 10000,
        validateStatus: (status) => status <= 500 // Accept 500 to see error
      });
      
      if (response.status === 500) {
        console.log('❌ 500 Error detected');
        console.log('📄 Response data:', response.data);
        console.log('📄 Response headers:', response.headers);
      }
    } catch (error) {
      if (error.response?.status === 500) {
        console.log('❌ 500 Error - Server issue');
        console.log('📄 Error response:', error.response.data);
        console.log('📄 Error headers:', error.response.headers);
      } else {
        console.log('❌ Other error:', error.message);
      }
    }
    
    // Test 3: Check if routes are registered
    console.log('\n3️⃣ Route Registration Test:');
    const testRoutes = [
      '/api/football/leagues',
      '/api/football/fixtures',
      '/api/football/live-matches',
      '/api/football/data-bundle',
      '/stats'
    ];
    
    for (const route of testRoutes) {
      try {
        const response = await axios.get(`${BACKEND_URL}${route}`, { 
          timeout: 3000,
          validateStatus: (status) => status < 500 
        });
        console.log(`✅ ${route}: ${response.status} - Route exists`);
      } catch (error) {
        if (error.response?.status === 500) {
          console.log(`⚠️  ${route}: 500 - Route exists but server error`);
        } else if (error.response?.status === 404) {
          console.log(`❌ ${route}: 404 - Route not found`);
        } else if (error.code === 'ECONNABORTED') {
          console.log(`⏱️  ${route}: Timeout - Server hanging`);
        } else {
          console.log(`❌ ${route}: ${error.message}`);
        }
      }
    }
    
    // Test 4: Environment variable check
    console.log('\n4️⃣ Environment Variable Diagnosis:');
    console.log('🔑 Expected variables:');
    console.log('   - DATABASE_URL (PostgreSQL connection)');
    console.log('   - DATABASE_SSL=true');
    console.log('   - API_FOOTBALL_KEY (Live API key)');
    console.log('   - JWT_SECRET (Authentication)');
    console.log('   - LIVE_ODDS_BATCH_SIZE=15');
    console.log('   - PREMATCH_ODDS_WINDOW_HOURS=168');
    
    console.log('\n🔧 Most Likely Issues:');
    console.log('1. Environment variables not properly saved in Render');
    console.log('2. Service needs manual restart after env var changes');
    console.log('3. Database connection blocked by Render network');
    console.log('4. API-Football key quota exceeded or invalid');
    
    console.log('\n📝 Immediate Actions:');
    console.log('1. Go to Render dashboard → Backend service');
    console.log('2. Check "Environment" tab - verify ALL variables are present');
    console.log('3. Click "Manual Deploy" → "Deploy Latest Commit"');
    console.log('4. Wait 3-5 minutes for full restart');
    console.log('5. Check "Logs" tab for specific error messages');
    
  } catch (error) {
    console.error('💥 Analysis failed:', error.message);
  }
}

detailedErrorCheck();
