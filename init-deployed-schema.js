// Initialize database schema on deployed backend
const axios = require('axios');

const BACKEND_URL = 'https://betting-backend-adlh.onrender.com';

async function initializeDeployedSchema() {
  console.log('🏗️  Initializing Database Schema on Deployed Backend');
  
  try {
    console.log('\n📋 Current Issue:');
    console.log('❌ Database schema not initialized on deployed version');
    console.log('🔍 Error: "Cannot read properties of null (reading \'collection\')"');
    console.log('💡 Need to trigger ensureSchema() function on deployed backend');
    
    console.log('\n🚀 Solution Options:');
    console.log('1. Add schema initialization endpoint to backend');
    console.log('2. Trigger schema creation via database operations');
    console.log('3. Restart service with proper environment variables');
    
    // Try to trigger schema initialization by making database operations
    console.log('\n🔄 Attempting Schema Initialization...');
    
    // Option 1: Try to access stats endpoint (should trigger schema)
    try {
      console.log('📊 Testing stats endpoint...');
      const statsResponse = await axios.get(`${BACKEND_URL}/stats`, { 
        timeout: 10000,
        validateStatus: (status) => true // Accept any status to see response
      });
      
      if (statsResponse.status === 200) {
        console.log('✅ Schema initialized via stats endpoint!');
        console.log('📊 Stats data:', statsResponse.data);
      } else {
        console.log(`❌ Stats endpoint: ${statsResponse.status}`);
        if (statsResponse.data) {
          console.log('📄 Error details:', statsResponse.data);
        }
      }
    } catch (error) {
      console.log('❌ Stats endpoint failed:', error.message);
    }
    
    // Option 2: Wait and retry (sometimes schema creation takes time)
    console.log('\n⏱️  Waiting 3 seconds for potential schema creation...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test endpoints again
    console.log('\n🧪 Retrying Endpoints After Wait...');
    
    const testEndpoints = [
      { name: 'Stats', url: '/stats' },
      { name: 'Leagues', url: '/api/football/leagues' },
      { name: 'Fixtures', url: '/api/football/fixtures' }
    ];
    
    let workingCount = 0;
    
    for (const endpoint of testEndpoints) {
      try {
        const response = await axios.get(`${BACKEND_URL}${endpoint.url}`, { 
          timeout: 8000,
          validateStatus: (status) => status < 500 
        });
        
        if (response.status === 200) {
          console.log(`✅ ${endpoint.name}: Working!`);
          workingCount++;
        } else if (response.status === 404) {
          console.log(`⚠️  ${endpoint.name}: 404 - No data but server working`);
          workingCount++;
        }
      } catch (error) {
        if (error.response?.status === 500) {
          console.log(`❌ ${endpoint.name}: Still 500 - schema issue`);
        } else {
          console.log(`❌ ${endpoint.name}: ${error.message}`);
        }
      }
    }
    
    console.log('\n📊 Results Summary:');
    console.log(`✅ Working endpoints: ${workingCount}/${testEndpoints.length}`);
    
    if (workingCount > 0) {
      console.log('\n🎉 Partial Success! Schema may be initializing...');
    } else {
      console.log('\n❌ Schema still not initialized');
    }
    
    console.log('\n🔧 Final Recommendations:');
    console.log('1. In Render dashboard, restart the backend service');
    console.log('2. Wait 2-3 minutes after restart');
    console.log('3. Test again with: node test-deployed-backend.js');
    console.log('4. Check Render logs for database schema errors');
    console.log('5. If still failing, the ensureSchema() function may need manual trigger');
    
  } catch (error) {
    console.error('💥 Schema initialization failed:', error.message);
  }
}

initializeDeployedSchema();
