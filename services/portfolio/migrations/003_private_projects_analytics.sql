CREATE TABLE IF NOT EXISTS portfolio_project_passwords (
  project_id uuid PRIMARY KEY,
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portfolio_analytics_daily (
  day date NOT NULL,
  page_key text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('view', 'outbound', 'contact')),
  referrer_host text NOT NULL DEFAULT '',
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (day, page_key, event_type, referrer_host)
);

CREATE INDEX IF NOT EXISTS portfolio_analytics_daily_day
  ON portfolio_analytics_daily(day DESC);