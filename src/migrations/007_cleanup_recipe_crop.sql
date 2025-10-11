-- Migration: Cleanup recipe crop columns (remove unused crop_scale, crop_frame_width, crop_frame_height)
-- Keep only crop_x and crop_y which now store percentages (0-100)
BEGIN;

-- SQLite não suporta DROP COLUMN diretamente, então precisamos recriar a tabela
-- Criar tabela temporária com a estrutura nova
CREATE TABLE recipes_new (
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
  crop_x REAL DEFAULT 50,
  crop_y REAL DEFAULT 50,
  FOREIGN KEY (couple_id) REFERENCES couples(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- Copiar dados existentes (ajustando crop_x e crop_y para percentagens se necessário)
INSERT INTO recipes_new (
  id, couple_id, title, photo_path, reference_link,
  user1_rating, user2_rating, user1_comment, user2_comment,
  created_by_user_id, created_at, updated_at,
  crop_x, crop_y
)
SELECT 
  id, couple_id, title, photo_path, reference_link,
  user1_rating, user2_rating, user1_comment, user2_comment,
  created_by_user_id, created_at, updated_at,
  -- Converter valores antigos para porcentagem se forem muito pequenos (normalized values)
  -- Se crop_x está entre -1 e 1, assumir que é normalizado e converter para 50% (centro)
  -- Caso contrário, manter o valor (já deve estar em porcentagem)
  CASE 
    WHEN crop_x IS NULL THEN 50
    WHEN crop_x >= -1 AND crop_x <= 1 THEN 50
    ELSE crop_x
  END as crop_x,
  CASE 
    WHEN crop_y IS NULL THEN 50
    WHEN crop_y >= -1 AND crop_y <= 1 THEN 50
    ELSE crop_y
  END as crop_y
FROM recipes;

-- Remover tabela antiga
DROP TABLE recipes;

-- Renomear tabela nova
ALTER TABLE recipes_new RENAME TO recipes;

-- Recriar índices
CREATE INDEX IF NOT EXISTS idx_recipes_couple_id ON recipes(couple_id);
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at DESC);

COMMIT;
