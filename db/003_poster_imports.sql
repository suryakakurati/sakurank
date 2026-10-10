CREATE TABLE IF NOT EXISTS poster_imports (
 external_anime_id text PRIMARY KEY CHECK (external_anime_id ~ '^kitsu:[0-9]{1,12}$'),
 poster_key text NOT NULL REFERENCES posters(key),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE poster_imports ENABLE ROW LEVEL SECURITY;
