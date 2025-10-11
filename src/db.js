import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db;

export function getDb() {
  if (!db) throw new Error("DB not initialized");
  return db;
}

export async function initDb() {
  const dataDir = path.join(__dirname, "../data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "app.sqlite");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  const initSql = fs.readFileSync(
    path.join(__dirname, "./migrations/init.sql"),
    "utf-8"
  );
  db.exec(initSql);

  // Migrações condicionais simples para bases existentes
  try {
    const cols = db.prepare("PRAGMA table_info(users)").all();
    const names = new Set(cols.map((c) => c.name));
    if (!names.has("display_name")) {
      db.exec("ALTER TABLE users ADD COLUMN display_name TEXT");
    }
    if (!names.has("avatar_path")) {
      db.exec("ALTER TABLE users ADD COLUMN avatar_path TEXT");
    }
  } catch (e) {
    console.warn("Migration note:", e.message);
  }

  // Preferências globais do cantinho no registro do casal
  try {
    const cols = db.prepare("PRAGMA table_info(couples)").all();
    const names = new Set(cols.map((c) => c.name));
    if (!names.has("corner_canvas_color")) {
      db.exec("ALTER TABLE couples ADD COLUMN corner_canvas_color INTEGER");
    }
    if (!names.has("corner_floor_color")) {
      db.exec("ALTER TABLE couples ADD COLUMN corner_floor_color INTEGER");
    }
    if (!names.has("corner_wall_color")) {
      db.exec("ALTER TABLE couples ADD COLUMN corner_wall_color INTEGER");
    }
    // Data de início do relacionamento (YYYY-MM-DD)
    if (!names.has("relationship_start_date")) {
      db.exec("ALTER TABLE couples ADD COLUMN relationship_start_date TEXT");
    }
  } catch (e) {
    console.warn("Migration (couples corner colors) note:", e.message);
  }

  // Tabela para itens do "Nosso cantinho"
  db.exec(`
    CREATE TABLE IF NOT EXISTS couple_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      couple_id INTEGER NOT NULL,
      item_key TEXT NOT NULL,
  x INTEGER NOT NULL DEFAULT 50, -- porcentagem 0..100 (aceita decimais nas atualizações)
  y INTEGER NOT NULL DEFAULT 50, -- porcentagem 0..100 (aceita decimais nas atualizações)
      z INTEGER NOT NULL DEFAULT 0,  -- altura (camadas)
  scale REAL NOT NULL DEFAULT 1.0, -- escala do sprite
  layer INTEGER NOT NULL DEFAULT 0, -- ordem manual de sobreposição
      rotation INTEGER NOT NULL DEFAULT 0,
  tilt_x REAL NOT NULL DEFAULT 0, -- inclinação no eixo X (skew Y) em graus
  tilt_y REAL NOT NULL DEFAULT 0, -- inclinação no eixo Y (skew X) em graus
  flip_x INTEGER NOT NULL DEFAULT 0, -- espelhar horizontal
  flip_y INTEGER NOT NULL DEFAULT 0, -- espelhar vertical
  color INTEGER, -- cor opcional (0xRRGGBB) persistida para itens coloríveis
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (couple_id) REFERENCES couples(id)
    );
    CREATE INDEX IF NOT EXISTS idx_couple_items_couple ON couple_items(couple_id);
  `);

  // Tabelas para "Nosso Álbum"
  db.exec(`
    CREATE TABLE IF NOT EXISTS album_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      couple_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (couple_id) REFERENCES couples(id)
    );
    CREATE INDEX IF NOT EXISTS idx_album_photos_couple ON album_photos(couple_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS album_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      couple_id INTEGER NOT NULL,
      template_id INTEGER NOT NULL DEFAULT 1,
      slot_number INTEGER NOT NULL,
      photo_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (couple_id) REFERENCES couples(id),
      FOREIGN KEY (photo_id) REFERENCES album_photos(id),
      UNIQUE(couple_id, template_id, slot_number)
    );
    CREATE INDEX IF NOT EXISTS idx_album_slots_couple ON album_slots(couple_id);
  `);

  // Migração condicional: adiciona colunas z/scale/layer se ausentes
  try {
    const cols = db.prepare("PRAGMA table_info(couple_items)").all();
    const names = new Set(cols.map((c) => c.name));
    if (!names.has("z")) {
      db.exec(
        "ALTER TABLE couple_items ADD COLUMN z INTEGER NOT NULL DEFAULT 0"
      );
    }
    if (!names.has("scale")) {
      db.exec(
        "ALTER TABLE couple_items ADD COLUMN scale REAL NOT NULL DEFAULT 1.0"
      );
    }
    if (!names.has("layer")) {
      db.exec(
        "ALTER TABLE couple_items ADD COLUMN layer INTEGER NOT NULL DEFAULT 0"
      );
    }
    if (!names.has("tilt_x")) {
      db.exec(
        "ALTER TABLE couple_items ADD COLUMN tilt_x REAL NOT NULL DEFAULT 0"
      );
    }
    if (!names.has("tilt_y")) {
      db.exec(
        "ALTER TABLE couple_items ADD COLUMN tilt_y REAL NOT NULL DEFAULT 0"
      );
    }
    if (!names.has("flip_x")) {
      db.exec(
        "ALTER TABLE couple_items ADD COLUMN flip_x INTEGER NOT NULL DEFAULT 0"
      );
    }
    if (!names.has("flip_y")) {
      db.exec(
        "ALTER TABLE couple_items ADD COLUMN flip_y INTEGER NOT NULL DEFAULT 0"
      );
    }
    if (!names.has("color")) {
      db.exec("ALTER TABLE couple_items ADD COLUMN color INTEGER");
    }
    if (!names.has("stretch_x")) {
      db.exec(
        "ALTER TABLE couple_items ADD COLUMN stretch_x REAL NOT NULL DEFAULT 1.0"
      );
    }
    if (!names.has("stretch_y")) {
      db.exec(
        "ALTER TABLE couple_items ADD COLUMN stretch_y REAL NOT NULL DEFAULT 1.0"
      );
    }
  } catch (e) {
    console.warn("Migration (couple_items.z) note:", e.message);
  }

  // Migração: adiciona coluna media_type na tabela album_photos
  try {
    const albumCols = db.prepare("PRAGMA table_info(album_photos)").all();
    const albumNames = new Set(albumCols.map((c) => c.name));
    if (!albumNames.has("media_type")) {
      db.exec(
        "ALTER TABLE album_photos ADD COLUMN media_type TEXT NOT NULL DEFAULT 'image'"
      );
      console.log("✅ Coluna media_type adicionada à tabela album_photos");
    }
  } catch (e) {
    console.warn("Migration (album_photos.media_type) note:", e.message);
  }

  // Tabela para "Nossos Filmes"
  db.exec(`
    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      couple_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      year INTEGER,
      poster_url TEXT,
      rating INTEGER CHECK(rating >= 1 AND rating <= 5),
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'watchlist' CHECK(status IN ('watchlist', 'watched')),
      watched_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (couple_id) REFERENCES couples(id)
    );
    CREATE INDEX IF NOT EXISTS idx_movies_couple ON movies(couple_id);
    CREATE INDEX IF NOT EXISTS idx_movies_status ON movies(status);
  `);

  // Tabela para avaliações individuais dos filmes
  db.exec(`
    CREATE TABLE IF NOT EXISTS movie_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movie_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(movie_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_movie_ratings_movie ON movie_ratings(movie_id);
    CREATE INDEX IF NOT EXISTS idx_movie_ratings_user ON movie_ratings(user_id);
  `);

  // Tabela para "Nossas Receitas"
  db.exec(`
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
  `);

  // Migração condicional: adiciona colunas crop_x e crop_y se ausentes
  try {
    const recipeCols = db.prepare("PRAGMA table_info(recipes)").all();
    const recipeNames = new Set(recipeCols.map((c) => c.name));
    if (!recipeNames.has("crop_x")) {
      db.exec("ALTER TABLE recipes ADD COLUMN crop_x REAL DEFAULT 50");
    }
    if (!recipeNames.has("crop_y")) {
      db.exec("ALTER TABLE recipes ADD COLUMN crop_y REAL DEFAULT 50");
    }
    // Remover colunas antigas se existirem (SQLite não suporta DROP COLUMN diretamente)
    // Essas colunas serão removidas pela migration 007_cleanup_recipe_crop.sql
  } catch (e) {
    console.warn("Migration (recipes crop) note:", e.message);
  }

  return db;
}
