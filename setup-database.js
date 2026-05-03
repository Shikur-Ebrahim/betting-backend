// Database setup script for Render PostgreSQL
require('dotenv').config();

// Set environment variables for Render PostgreSQL before loading modules
process.env.DATABASE_URL = 'postgresql://betting_udlw_user:9xVjD0u68n53ZxNnu1F5fHGaLBaPXSY6@dpg-d7rdg1m7r5hc739anheg-a.oregon-postgres.render.com/betting_udlw';
process.env.DATABASE_SSL = 'true';

const { pool } = require('./db/pool');
const { ensureSchema } = require('./db/schema');

async function setupDatabase() {
  console.log('🔧 Setting up Render PostgreSQL Database...');
  
  // Set environment variables for Render PostgreSQL
  process.env.DATABASE_URL = 'postgresql://betting_udlw_user:9xVjD0u68n53ZxNnu1F5fHGaLBaPXSY6@dpg-d7rdg1m7r5hc739anheg-a.oregon-postgres.render.com/betting_udlw';
  process.env.DATABASE_SSL = 'true';
  
  console.log('📡 Database URL:', process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':***@')); // Hide password
  console.log('🔒 SSL Enabled:', process.env.DATABASE_SSL);
  
  try {
    // Test connection
    console.log('🔍 Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Database connection successful!');
    
    // Get PostgreSQL version
    const versionResult = await client.query('SELECT version()');
    console.log('📊 PostgreSQL Version:', versionResult.rows[0].version.split(',')[0]);
    
    // Create schema
    console.log('🏗️  Creating database schema...');
    await ensureSchema();
    console.log('✅ Database schema created/verified!');
    
    // List tables
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    const tablesResult = await client.query(tablesQuery);
    console.log('📋 Database Tables:', tablesResult.rows.map(row => row.table_name));
    
    // Test document operations
    console.log('🧪 Testing document operations...');
    await client.query(`
      INSERT INTO app_documents (collection_name, document_id, data)
      VALUES ('test', 'setup_test', $1)
      ON CONFLICT (collection_name, document_id) DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = NOW()
    `, [JSON.stringify({ test: true, timestamp: new Date().toISOString() })]);
    
    const testResult = await client.query(`
      SELECT data FROM app_documents 
      WHERE collection_name = 'test' AND document_id = 'setup_test'
    `);
    
    if (testResult.rows.length > 0) {
      console.log('✅ Document operations successful!');
      console.log('📄 Test data:', JSON.stringify(testResult.rows[0].data, null, 2));
    }
    
    // Clean up
    await client.query(`
      DELETE FROM app_documents 
      WHERE collection_name = 'test' AND document_id = 'setup_test'
    `);
    
    client.release();
    console.log('🎉 Database setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Copy these values to your .env file:');
    console.log('   DATABASE_URL=postgresql://betting_udlw_user:9xVjD0u68n53ZxNnu1F5fHGaLBaPXSY6@dpg-d7rdg1m7r5hc739anheg-a.oregon-postgres.render.com/betting_udlw');
    console.log('   DATABASE_SSL=true');
    console.log('2. Add your API_FOOTBALL_KEY and JWT_SECRET');
    console.log('3. Start the backend server: npm start');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('🔧 Troubleshooting:');
    console.error('  - Check database URL and credentials');
    console.error('  - Verify network connectivity');
    console.error('  - Ensure Render PostgreSQL is running');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };
