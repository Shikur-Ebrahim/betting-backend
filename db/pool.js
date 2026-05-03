const { Pool } = require('pg');

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('CRITICAL: DATABASE_URL is missing in environment variables.');
  }
  const useSsl = process.env.DATABASE_SSL === 'true' || process.env.DATABASE_SSL === '1';
  return new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
  });
}

const pool = createPool();

module.exports = { pool, createPool };
