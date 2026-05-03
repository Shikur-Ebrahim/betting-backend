// Fix deployed database schema issue
const axios = require('axios');

const BACKEND_URL = 'https://betting-backend-adlh.onrender.com';

async function fixDeployedDatabase() {
  console.log('🔧 Fixing Deployed Database Schema Issue');
  
  try {
    // The error "Cannot read properties of null (reading 'collection')" 
    // suggests the database schema isn't properly initialized
    
    console.log('\n📋 Issue Analysis:');
    console.log('❌ Error: "Cannot read properties of null (reading \'collection\')"');
    console.log('🔍 Cause: Database schema not initialized on deployed version');
    console.log('💡 Solution: Initialize database schema on deployed backend');
    
    console.log('\n🚀 Attempting to initialize database schema...');
    
    // Try to trigger schema initialization by hitting an endpoint that uses it
    // This should trigger the ensureSchema() function in server.js
    
    try {
      // Test stats endpoint - this should trigger database initialization
      console.log('🔄 Testing stats endpoint (triggers schema init)...');
      const statsResponse = await axios.get(`${BACKEND_URL}/stats`, { 
        timeout: 15000,
        validateStatus: (status) => status < 500 
      });
      
      if (statsResponse.status === 200) {
        console.log('✅ Stats endpoint working - database initialized!');
        console.log('📊 Stats data:', statsResponse.data);
      }
      
    } catch (error) {
      if (error.response?.status === 500) {
        console.log('❌ Stats endpoint still failing - schema not initialized');
      }
    }
    
    // Test other endpoints after potential schema fix
    console.log('\n🧪 Testing endpoints after schema fix attempt...');
    
    const endpoints = [
      { name: 'Leagues', url: '/api/football/leagues' },
      { name: 'Fixtures', url: '/api/football/fixtures' },
      { name: 'Live Matches', url: '/api/football/live-matches' },
      { name: 'Data Bundle', url: '/api/football/data-bundle' }
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${BACKEND_URL}${endpoint.url}`, { 
          timeout: 10000,
          validateStatus: (status) => status < 500 
        });
        
        if (response.status === 200) {
          console.log(`✅ ${endpoint.name}: Working`);
        } else if (response.status === 404) {
          console.log(`⚠️  ${endpoint.name}: 404 - No data yet`);
        }
      } catch (error) {
        if (error.response?.status === 500) {
          console.log(`❌ ${endpoint.name}: Still 500 - schema issue persists`);
        } else {
          console.log(`❌ ${endpoint.name}: ${error.message}`);
        }
      }
    }
    
    console.log('\n🔧 Alternative Solutions if Still Failing:');
    console.log('1. Manual schema initialization needed');
    console.log('2. Database permissions issue on Render');
    console.log('3. Environment variables still not applied');
    console.log('4. Service restart required after schema init');
    
    console.log('\n📝 Next Steps:');
    console.log('1. If endpoints are now working - great!');
    console.log('2. If still failing, restart the service in Render');
    console.log('3. Check Render logs for database errors');
    console.log('4. Verify database user has proper permissions');
    
  } catch (error) {
    console.error('💥 Fix attempt failed:', error.message);
  }
}

fixDeployedDatabase();
