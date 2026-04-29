const { db } = require('../firebase/admin');

const LEAGUES = [
  { id: 2, name: 'UEFA Champions League', logo: 'https://media.api-sports.io/football/leagues/2.png', country: 'World', type: 'Cup' },
  { id: 39, name: 'Premier League', logo: 'https://media.api-sports.io/football/leagues/39.png', country: 'England', type: 'League' },
  { id: 140, name: 'La Liga', logo: 'https://media.api-sports.io/football/leagues/140.png', country: 'Spain', type: 'League' },
  { id: 135, name: 'Serie A', logo: 'https://media.api-sports.io/football/leagues/135.png', country: 'Italy', type: 'League' },
  { id: 78, name: 'Bundesliga', logo: 'https://media.api-sports.io/football/leagues/78.png', country: 'Germany', type: 'League' },
  { id: 61, name: 'Ligue 1', logo: 'https://media.api-sports.io/football/leagues/61.png', country: 'France', type: 'League' },
  { id: 3, name: 'UEFA Europa League', logo: 'https://media.api-sports.io/football/leagues/3.png', country: 'World', type: 'Cup' },
  { id: 848, name: 'UEFA Europa Conference League', logo: 'https://media.api-sports.io/football/leagues/848.png', country: 'World', type: 'Cup' }
];

const DEPOSIT_METHODS = [
  { id: 'cbe', bankName: 'Commercial Bank of Ethiopia', type: 'bank', accountNumber: '1000123456789', accountName: 'Tipico Betting PLC', minDeposit: 500, logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/8b/Commercial_Bank_of_Ethiopia_logo.png/220px-Commercial_Bank_of_Ethiopia_logo.png' },
  { id: 'telebirr', bankName: 'Telebirr', type: 'wallet', phoneNumber: '0912345678', name: 'Tipico Betting PLC', minDeposit: 100, logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Telebirr_logo.png/220px-Telebirr_logo.png' }
];

async function initialize() {
  console.log('--- Initializing Firestore Configuration ---');
  
  try {
    // 1. Sidebar Leagues
    await db.collection('config').doc('leagues_list').set({ leagues: LEAGUES });
    console.log('[Init] Sidebar leagues created.');

    // 2. Deposit Methods
    await db.collection('config').doc('deposit_methods').set({ methods: DEPOSIT_METHODS });
    console.log('[Init] Deposit methods created.');

    // 3. System Config
    await db.collection('config').doc('system').set({
      maintenance: false,
      minWithdrawal: 100,
      maxWithdrawal: 50000,
      currency: 'ETB'
    });
    console.log('[Init] System settings created.');

    console.log('--- Firestore Initialization Complete ---');
    process.exit(0);
  } catch (error) {
    console.error('[Init] Failed:', error);
    process.exit(1);
  }
}

initialize();
