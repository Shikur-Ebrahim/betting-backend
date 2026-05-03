// Add schema initialization endpoint to backend
const fs = require('fs');
const path = require('path');

async function addSchemaEndpoint() {
  console.log('🔧 Adding Schema Initialization Endpoint to Backend');
  
  try {
    // Read the current server.js file
    const serverPath = path.join(__dirname, 'server.js');
    let serverContent = fs.readFileSync(serverPath, 'utf8');
    
    // Check if schema endpoint already exists
    if (serverContent.includes('/init-schema')) {
      console.log('✅ Schema endpoint already exists');
      return;
    }
    
    // Add schema initialization endpoint before the existing routes
    const schemaEndpoint = `
// Schema initialization endpoint
app.get('/init-schema', async (req, res) => {
  try {
    console.log('[Schema] Initializing database schema...');
    await ensureSchema();
    console.log('[Schema] Database schema initialized successfully!');
    res.json({ 
      success: true, 
      message: 'Database schema initialized successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Schema] Initialization failed:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

`;
    
    // Insert the schema endpoint after the app.use configurations but before the routes
    const insertPoint = serverContent.indexOf('const authRoutes = require(\'./routes/auth\').router;');
    if (insertPoint !== -1) {
      serverContent = serverContent.slice(0, insertPoint) + schemaEndpoint + serverContent.slice(insertPoint);
    }
    
    // Write the updated server.js
    fs.writeFileSync(serverPath, serverContent);
    console.log('✅ Schema initialization endpoint added to server.js');
    
    console.log('\n📝 Next Steps:');
    console.log('1. Deploy this updated backend to Render');
    console.log('2. Visit: https://betting-backend-adlh.onrender.com/init-schema');
    console.log('3. This will initialize the database schema');
    console.log('4. Then test the endpoints again');
    
    console.log('\n🚀 Alternative: Manual Schema Creation');
    console.log('If you can\'t redeploy immediately, you can:');
    console.log('1. Go to Render dashboard');
    console.log('2. Add a new file or modify existing code');
    console.log('3. Redeploy to trigger schema initialization');
    
  } catch (error) {
    console.error('❌ Failed to add schema endpoint:', error.message);
  }
}

addSchemaEndpoint();
