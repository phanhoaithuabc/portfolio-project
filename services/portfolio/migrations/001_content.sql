CREATE TABLE IF NOT EXISTS portfolio_content (
  id smallint PRIMARY KEY CHECK (id = 1),
  payload jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS portfolio_sessions (
  sid varchar PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS portfolio_sessions_expire ON portfolio_sessions(expire);