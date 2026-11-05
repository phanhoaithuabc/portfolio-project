CREATE TABLE IF NOT EXISTS portfolio_content_versions (
  revision integer PRIMARY KEY,
  payload text NOT NULL CHECK (json_valid(payload)),
  created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS portfolio_contact_messages (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL DEFAULT '',
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
  created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS portfolio_contact_messages_created_at
  ON portfolio_contact_messages (created_at DESC);