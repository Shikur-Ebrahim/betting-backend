/**
 * Optional seed for config documents (deposit methods, league hints).
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { ensureSchema } = require('../db/schema');
const { mergeDocumentData } = require('../db/documents');
const { pool } = require('../db/pool');

const LEAGUES = [
  { id: 2, name: 'UEFA Champions League', country: 'World', logo: 'https://media.api-sports.io/football/leagues/2.png' },
  { id: 39, name: 'Premier League', country: 'England', logo: 'https://media.api-sports.io/football/leagues/39.png' },
];

const DEPOSIT_METHODS = [
  {
    id: 'cbe',
    bankName: 'Commercial Bank of Ethiopia',
    type: 'bank',
    accountNumber: '1000...',
    accountName: 'Tipico Admin',
    minDeposit: 500,
    logoUrl: '/cbe_logo.png',
  },
  {
    id: 'telebirr',
    bankName: 'Telebirr',
    type: 'wallet',
    phoneNumber: '0911...',
    name: 'Tipico Admin',
    minDeposit: 100,
    logoUrl: '/telebirr_logo.png',
  },
];

async function run() {
  await ensureSchema();
  await mergeDocumentData('config', 'leagues_list', { leagues: LEAGUES });
  await mergeDocumentData('config', 'deposit_methods', { methods: DEPOSIT_METHODS });
  console.log('Config seed complete.');
  await pool.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
