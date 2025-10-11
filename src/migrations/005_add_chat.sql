-- Migration: Add chat messages table
-- Description: Create table for couple chat messages with real-time support

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  couple_id INTEGER NOT NULL,
  sender_user_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_chat_couple ON chat_messages(couple_id);
CREATE INDEX idx_chat_created ON chat_messages(created_at);
