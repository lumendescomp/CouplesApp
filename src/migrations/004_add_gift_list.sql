-- Migration: Add gift list feature
-- Tabela para armazenar presentes da lista

CREATE TABLE IF NOT EXISTS gift_list (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  couple_id INTEGER NOT NULL,
  recipient_user_id INTEGER NOT NULL, -- Quem vai receber o presente (user1 ou user2)
  added_by_user_id INTEGER NOT NULL,  -- Quem adicionou o presente
  name TEXT NOT NULL,                 -- Nome do presente
  link TEXT,                          -- Link para o site do presente
  photo_path TEXT,                    -- Caminho da foto
  price REAL,                         -- Valor do presente (opcional)
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gift_list_couple ON gift_list(couple_id);
CREATE INDEX IF NOT EXISTS idx_gift_list_recipient ON gift_list(recipient_user_id);
