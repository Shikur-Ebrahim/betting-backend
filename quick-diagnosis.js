// Quick diagnosis of deployed backend
const axios = require('axios');

const BACKEND_URL = 'https://betting-backend-adlh.onrender.com';

async function quickDiagnosis() {
  console.log('🔍 Quick Diagnosis of Deployed Backend');
  
  try {
    // Test health
    const health = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
    console.log('✅ Health:', health.data);
    
    // Test a simple endpoint that should work
    try {
      const response = await axios.get(`${BACKEND_URL}/api/football/leagues`, { 
        timeout: 10000,
        validateStatus: (status) => status < 500 
      });
      console.log('✅ Leagues endpoint:', response.status);
    } catch (error) {
      if (error.response?.status === 500) {
        console.log('❌ Leagues endpoint: 500 - Database/API configuration issue');
      } else if (error.response?.status === 404) {
        console.log('❌ Leagues endpoint: 404 - Route not found');
      } else {
        console.log('❌ Leagues endpoint:', error.message);
      }
    }
    
    console.log('\n🔧 Possible Issues:');
    console.log('1. Environment variables not applied yet');
    console.log('2. Service needs restart after env vars added');
    console.log('3. Database connection issues from Render');
    console.log('4. API-Football key quota exceeded');
    
    console.log('\n📝 Next Steps:');
    console.log('1. Check Render dashboard logs');
    console.log('2. Restart the backend service');
    console.log('3. Wait 2-3 minutes after restart');
    console.log('4. Test again');
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error.message);
  }
}

quickDiagnosis();
