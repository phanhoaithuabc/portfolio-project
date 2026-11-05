CREATE TABLE IF NOT EXISTS portfolio_content (
  id smallint PRIMARY KEY CHECK (id = 1),
  payload text NOT NULL CHECK (json_valid(payload)),
  revision integer NOT NULL DEFAULT 0,
  updated_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS portfolio_sessions (
  sid varchar PRIMARY KEY,
  sess text NOT NULL CHECK (json_valid(sess)),
  expire integer NOT NULL
);
CREATE INDEX IF NOT EXISTS portfolio_sessions_expire ON portfolio_sessions(expire);