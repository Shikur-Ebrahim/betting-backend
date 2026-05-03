/**
 * Set a user as admin by phone (e.g. 251904174741) or full synthetic email.
 * Usage: node scripts/setAdmin.js 2519XXXXXXXX
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../db/pool');

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node scripts/setAdmin.js <phoneOrEmail>');
    process.exit(1);
  }

  const email = arg.includes('@') ? arg.toLowerCase() : `251${arg.replace(/^0/, '')}@gmail.com`;

  const { rowCount } = await pool.query(
    `UPDATE users SET role = 'admin', updated_at = NOW() WHERE LOWER(email) = $1`,
    [email]
  );

  if (rowCount === 0) {
    console.error('No user found for', email);
    process.exit(1);
  }
  console.log('Updated user to admin:', email);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
