const { pool } = require('./pool');

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      balance NUMERIC NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'Birr',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users(phone) WHERE phone IS NOT NULL;

    CREATE TABLE IF NOT EXISTS app_documents (
      collection_name TEXT NOT NULL,
      document_id TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (collection_name, document_id)
    );
    CREATE INDEX IF NOT EXISTS idx_app_documents_collection ON app_documents(collection_name);

    CREATE TABLE IF NOT EXISTS deposits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount NUMERIC NOT NULL,
      method_id TEXT,
      proof_url TEXT,
      phone_number TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_deposits_user_status ON deposits(user_id, status);

    CREATE TABLE IF NOT EXISTS api_cache (
      cache_key TEXT PRIMARY KEY,
      endpoint TEXT,
      response JSONB NOT NULL,
      cached_at TIMESTAMPTZ NOT NULL,
      expires_in_ms INT
    );

    CREATE TABLE IF NOT EXISTS sync_stats (
      date_str TEXT PRIMARY KEY,
      requests INT NOT NULL DEFAULT 0,
      error_count INT NOT NULL DEFAULT 0,
      last_sync_time TIMESTAMPTZ,
      last_error TEXT,
      last_error_time TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS leagues (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      country TEXT NOT NULL,
      logo TEXT,
      season INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_leagues_country ON leagues(country);

    CREATE TABLE IF NOT EXISTS fixtures (
      id INTEGER PRIMARY KEY,
      league_id INTEGER NOT NULL REFERENCES leagues(id),
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      home_team_logo TEXT,
      away_team_logo TEXT,
      fixture_date TIMESTAMPTZ NOT NULL,
      status TEXT DEFAULT 'NS',
      venue TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_fixtures_league_date ON fixtures(league_id, fixture_date);
    CREATE INDEX IF NOT EXISTS idx_fixtures_date ON fixtures(fixture_date);

    CREATE TABLE IF NOT EXISTS odds (
      fixture_id INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
      bookmaker TEXT,
      home_odds NUMERIC,
      draw_odds NUMERIC,
      away_odds NUMERIC,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (fixture_id, bookmaker)
    );
    CREATE INDEX IF NOT EXISTS idx_odds_fixture ON odds(fixture_id);

    CREATE TABLE IF NOT EXISTS tracked_fixtures (
      fixture_id INTEGER PRIMARY KEY REFERENCES fixtures(id) ON DELETE CASCADE,
      has_odds BOOLEAN NOT NULL DEFAULT false,
      last_checked TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tracked_fixtures_odds ON tracked_fixtures(has_odds);
  `);
}

module.exports = { ensureSchema };
