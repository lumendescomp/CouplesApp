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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (couple_id) REFERENCES couples(id)
    );
    CREATE INDEX IF NOT EXISTS idx_couple_items_couple ON couple_items(couple_id);
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
  } catch (e) {
    console.warn("Migration (couple_items.z) note:", e.message);
  }

  return db;
}
