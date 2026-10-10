CREATE TABLE IF NOT EXISTS anime (
 id uuid PRIMARY KEY,
 title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
 original_title text,
 rating integer NOT NULL CHECK (rating BETWEEN 1 AND 10),
 thoughts text NOT NULL DEFAULT '' CHECK (length(thoughts) <= 50000),
 poster_key text,
 poster_source text,
 external_anime_id text UNIQUE,
 release_year integer CHECK (release_year BETWEEN 1900 AND 2200),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS posters (key text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS owner_sessions (token_hash text PRIMARY KEY, credential_version text NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS rate_limits (key text PRIMARY KEY, attempts integer NOT NULL, resets_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS metadata_cache (key text PRIMARY KEY, data jsonb NOT NULL, expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS anime_created_idx ON anime(created_at DESC);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON owner_sessions(expires_at);
ALTER TABLE anime ENABLE ROW LEVEL SECURITY;
ALTER TABLE posters ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata_cache ENABLE ROW LEVEL SECURITY;
-- No public/anon policies. Application uses a server-only privileged database connection.
