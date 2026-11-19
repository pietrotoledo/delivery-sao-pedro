CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);
