const express = require('express');
const { getUsage } = require('./utils/rateLimiter');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const RUN_WORKER_IN_SERVER = process.env.RUN_WORKER_IN_SERVER !== 'false';

// Middleware
app.use(cors());
app.use(express.json());

// Routes
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

if (RUN_WORKER_IN_SERVER) {
  require('./worker/sync');
  console.log('[Bootstrap] Background odds worker enabled in server process.');
}

app.listen(PORT, () => {
  console.log(`Backend Server running on port ${PORT}`);
});
