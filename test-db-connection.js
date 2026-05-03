const { pool } = require('./db/pool');
const { ensureSchema } = require('./db/schema');

async function testDatabaseConnection() {
  console.log('🔍 Testing Render PostgreSQL Database Connection...');
  
  try {
    // Test basic connection
    console.log('📡 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Database connection successful!');
    
    // Test query
    const result = await client.query('SELECT version()');
    console.log('📊 PostgreSQL Version:', result.rows[0].version.split(',')[0]);
    
    // Test schema creation
    console.log('🏗️  Creating database schema...');
    await ensureSchema();
    console.log('✅ Database schema created/verified successfully!');
    
    // Test tables
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    const tablesResult = await client.query(tablesQuery);
    console.log('📋 Database Tables:', tablesResult.rows.map(row => row.table_name));
    
    // Test app_documents table structure
    const docsQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'app_documents' 
      ORDER BY ordinal_position
    `;
    const docsResult = await client.query(docsQuery);
    console.log('📄 App Documents Table Structure:');
    docsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    // Test a simple insert/delete
    console.log('🧪 Testing document operations...');
    await client.query(`
      INSERT INTO app_documents (collection_name, document_id, data)
      VALUES ('test', 'connection_test', '{"test": true, "timestamp": NOW()}')
      ON CONFLICT (collection_name, document_id) DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = NOW()
    `);
    
    const testResult = await client.query(`
      SELECT data FROM app_documents 
      WHERE collection_name = 'test' AND document_id = 'connection_test'
    `);
    
    if (testResult.rows.length > 0) {
      console.log('✅ Document insert/retrieve successful!');
      console.log('📄 Test data:', testResult.rows[0].data);
    }
    
    // Clean up test data
    await client.query(`
      DELETE FROM app_documents 
      WHERE collection_name = 'test' AND document_id = 'connection_test'
    `);
    console.log('🧹 Test data cleaned up');
    
    client.release();
    console.log('🎉 All database tests passed! Ready for production.');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('🔧 Check your DATABASE_URL and SSL settings');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  testDatabaseConnection();
}

module.exports = { testDatabaseConnection };
