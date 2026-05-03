const express = require('express');
const { getUsage } = require('./utils/rateLimiter');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const { ensureSchema } = require('./db/schema');

const app = express();
const PORT = process.env.PORT || 3001;
const RUN_WORKER_IN_SERVER = process.env.RUN_WORKER_IN_SERVER !== 'false';

app.use(cors());
app.use(express.json());


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

const authRoutes = require('./routes/auth').router;
const userRoutes = require('./routes/user');
const depositRoutes = require('./routes/deposit');
const footballRoutes = require('./routes/football');

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/deposit', depositRoutes);
app.use('/api/football', footballRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/stats', async (req, res) => {
  try {
    const stats = await getUsage();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function start() {
  await ensureSchema();
  console.log('[Startup] PostgreSQL schema verified.');

  if (RUN_WORKER_IN_SERVER) {
    const { bootstrapWorker } = require('./worker/sync');
    await bootstrapWorker();
    console.log('[Bootstrap] Background odds worker enabled in server process.');
  }

  app.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
