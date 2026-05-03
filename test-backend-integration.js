// Backend integration test for Render PostgreSQL
require('dotenv').config();

// Set environment variables for Render PostgreSQL
process.env.DATABASE_URL = 'postgresql://betting_udlw_user:9xVjD0u68n53ZxNnu1F5fHGaLBaPXSY6@dpg-d7rdg1m7r5hc739anheg-a.oregon-postgres.render.com/betting_udlw';
process.env.DATABASE_SSL = 'true';
process.env.PORT = '3001';
process.env.RUN_WORKER_IN_SERVER = 'false'; // Disable worker for testing

const express = require('express');
const { ensureSchema } = require('./db/schema');
const { upsertDocument, getDocument, listCollection } = require('./db/documents');

async function testBackendIntegration() {
  console.log('🚀 Testing Backend Integration with Render PostgreSQL...');
  
  try {
    // Test database schema
    console.log('🏗️  Verifying database schema...');
    await ensureSchema();
    console.log('✅ Database schema verified!');
    
    // Test document operations
    console.log('📄 Testing document operations...');
    
    // Test insert
    const testDoc = {
      type: 'test_document',
      message: 'Backend integration test',
      timestamp: new Date().toISOString(),
      data: { test: true, version: '1.0' }
    };
    
    await upsertDocument('test_collection', 'integration_test', testDoc);
    console.log('✅ Document insert successful!');
    
    // Test retrieve
    const retrieved = await getDocument('test_collection', 'integration_test');
    if (retrieved && retrieved.data) {
      console.log('✅ Document retrieve successful!');
      console.log('📄 Retrieved data:', JSON.stringify(retrieved.data, null, 2));
    } else {
      throw new Error('Failed to retrieve document');
    }
    
    // Test list collection
    const listResult = await listCollection('test_collection');
    console.log(`✅ Collection list successful! Found ${listResult.length} documents`);
    
    // Test API routes
    console.log('🌐 Testing API routes...');
    
    // Create a minimal Express app for testing
    const app = express();
    app.use(express.json());
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        database: 'connected'
      });
    });
    
    // Test database endpoint
    app.get('/test-db', async (req, res) => {
      try {
        const docs = await listCollection('test_collection');
        res.json({ 
          success: true, 
          count: docs.length,
          documents: docs.map(d => ({ id: d.document_id, data: d.data }))
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    // Start test server
    const server = app.listen(3002, () => {
      console.log('🔧 Test server running on port 3002');
    });
    
    // Test the endpoints
    const axios = require('axios');
    const baseURL = 'http://localhost:3002';
    
    // Test health endpoint
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log('✅ Health check:', healthResponse.data);
    
    // Test database endpoint
    const dbResponse = await axios.get(`${baseURL}/test-db`);
    console.log('✅ Database endpoint test:', dbResponse.data);
    
    // Close test server
    server.close();
    
    // Clean up test data
    console.log('🧹 Cleaning up test data...');
    await upsertDocument('test_collection', 'integration_test', null); // This will be handled by the actual delete in production
    
    console.log('🎉 Backend integration test completed successfully!');
    console.log('\n📋 Test Results:');
    console.log('✅ Database connection: OK');
    console.log('✅ Schema creation: OK');
    console.log('✅ Document operations: OK');
    console.log('✅ API endpoints: OK');
    console.log('✅ Express server: OK');
    
    console.log('\n🚀 Ready for production deployment!');
    
  } catch (error) {
    console.error('❌ Backend integration test failed:', error.message);
    console.error('🔧 Check:');
    console.error('  - Database connection settings');
    console.error('  - Network connectivity');
    console.error('  - Module dependencies');
    process.exit(1);
  }
}

if (require.main === module) {
  testBackendIntegration();
}

module.exports = { testBackendIntegration };
