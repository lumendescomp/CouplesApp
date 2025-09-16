BEGIN;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS couples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner1_id INTEGER NOT NULL,
  partner2_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (partner1_id) REFERENCES users(id),
  FOREIGN KEY (partner2_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  issuer_user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  used_by_user_id INTEGER,
  created_couple_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (issuer_user_id) REFERENCES users(id),
  FOREIGN KEY (used_by_user_id) REFERENCES users(id),
  FOREIGN KEY (created_couple_id) REFERENCES couples(id)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code);
COMMIT;
