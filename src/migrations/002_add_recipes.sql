-- Migration: Add recipes table
BEGIN;

CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  couple_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  photo_path TEXT,
  reference_link TEXT,
  user1_rating INTEGER CHECK(user1_rating >= 1 AND user1_rating <= 5),
  user2_rating INTEGER CHECK(user2_rating >= 1 AND user2_rating <= 5),
  user1_comment TEXT,
  user2_comment TEXT,
  created_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_recipes_couple_id ON recipes(couple_id);
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at DESC);

COMMIT;
