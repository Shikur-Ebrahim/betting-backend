# Render PostgreSQL Database Integration Guide

## 🗄️ Database Configuration

### Render PostgreSQL Details
- **Host**: `dpg-d7rdg1m7r5hc739anheg-a.oregon-postgres.render.com`
- **Port**: `5432`
- **Database**: `betting_udlw`
- **Username**: `betting_udlw_user`
- **SSL Required**: `true`

### Environment Variables
Create a `.env` file with these values:

```bash
# Database Configuration
DATABASE_URL=postgresql://betting_udlw_user:9xVjD0u68n53ZxNnu1F5fHGaLBaPXSY6@dpg-d7rdg1m7r5hc739anheg-a.oregon-postgres.render.com/betting_udlw
DATABASE_SSL=true

# Server Configuration
PORT=3001
RUN_WORKER_IN_SERVER=true

# API Configuration
API_FOOTBALL_HOST=v3.football.api-sports.io
API_FOOTBALL_KEY=your_api_football_key_here

# JWT Configuration
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Worker Configuration
LIVE_ODDS_BATCH_SIZE=15
PREMATCH_ODDS_WINDOW_HOURS=168
MATCH_ENRICH_BATCH=6
```

## 🚀 Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database
```bash
node setup-database.js
```

### 3. Start the Server
```bash
npm start
```

## 🧪 Testing

### Database Connection Test
```bash
node test-db-connection.js
```

### Backend Integration Test
```bash
node test-backend-integration.js
```

### Full Server Test
```bash
node test-full-server.js
```

## 📊 Database Schema

### Tables Created
- `users` - User accounts and authentication
- `app_documents` - Main document store (JSONB)
- `deposits` - Financial transactions
- `api_cache` - API response caching
- `sync_stats` - Worker synchronization tracking

### Document Collections
- `fixtures` - Pre-match games (7 days)
- `live_matches` - Currently live games
- `odds` - Betting odds
- `league_teams` - Team information
- `match_stats` - Game statistics
- `match_lineups` - Team lineups
- `match_h2h` - Head-to-head history
- `standings` - League tables

## ⚡ API Endpoints

### Football Data
- `GET /api/football/fixtures` - Pre-match games (7 days with odds)
- `GET /api/football/live-matches` - Live games
- `GET /api/football/data-bundle` - Combined data bundle
- `GET /api/football/leagues` - Available leagues
- `GET /api/football/odds/:fixtureId` - Specific odds

### System
- `GET /health` - Health check
- `GET /stats` - Usage statistics

## 🔄 Worker Configuration

### Sync Frequencies (Optimized for 75K API limit)
- **Live updates**: Every 30 seconds
- **Prematch updates**: Every 30 minutes
- **Match enrichment**: Every 15 minutes

### Daily API Usage (~52K requests)
- Live matches: 2,880 requests
- Live odds: 43,200 requests
- Upcoming matches: 480 requests
- Prematch odds: 4,800 requests
- Match enrichment: 576 requests

## 🔧 Troubleshooting

### Common Issues
1. **Database connection failed**
   - Check DATABASE_URL format
   - Verify SSL is enabled
   - Ensure Render PostgreSQL is running

2. **API requests exceeded**
   - Check LIVE_ODDS_BATCH_SIZE setting
   - Verify sync frequencies
   - Monitor API usage

3. **Missing data**
   - Verify API_FOOTBALL_KEY is valid
   - Check worker logs
   - Ensure collections exist

### PostgreSQL Commands
```bash
# Connect to database
PGPASSWORD=9xVjD0u68n53ZxNnu1F5fHGaLBaPXSY6 psql -h dpg-d7rdg1m7r5hc739anheg-a.oregon-postgres.render.com -U betting_udlw_user betting_udlw

# Check tables
\dt

# Check documents
SELECT collection_name, COUNT(*) FROM app_documents GROUP BY collection_name;
```

## 🎯 Production Ready

✅ **Database Integration**: Render PostgreSQL connected  
✅ **Schema Creation**: All tables and indexes created  
✅ **API Endpoints**: All football endpoints working  
✅ **Worker System**: Optimized for 75K API limit  
✅ **Error Handling**: Comprehensive error handling  
✅ **Testing**: Full test suite passed  

The system is now fully integrated with Render PostgreSQL and ready for production deployment!
