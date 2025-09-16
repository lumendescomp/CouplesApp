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

  return db;
}
