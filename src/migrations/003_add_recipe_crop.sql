-- Migration: Add crop metadata to recipes
BEGIN;

-- Adicionar colunas para armazenar dados do crop
ALTER TABLE recipes ADD COLUMN crop_x REAL DEFAULT 0;
ALTER TABLE recipes ADD COLUMN crop_y REAL DEFAULT 0;
ALTER TABLE recipes ADD COLUMN crop_scale REAL DEFAULT 1;
ALTER TABLE recipes ADD COLUMN crop_frame_width INTEGER DEFAULT 280;
ALTER TABLE recipes ADD COLUMN crop_frame_height INTEGER DEFAULT 210;

COMMIT;
