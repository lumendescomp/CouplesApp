// Create data dir on install to avoid runtime errors
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dir = path.join(__dirname, "../data");
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}
