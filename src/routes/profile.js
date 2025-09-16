import { Router } from "express";
import csrf from "csurf";
import multer from "multer";
import path from "path";
import fs from "fs";
import { getDb } from "../db.js";

const router = Router();
const csrfProtection = csrf();

const uploadDir = path.resolve(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `u${req.session.user.id}_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const ok = [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(
      path.extname(file.originalname).toLowerCase()
    );
    cb(ok ? null : new Error("Formato inválido"), ok);
  },
});

router.get("/", (req, res) => {
  const db = getDb();
  const me = db
    .prepare(
      "SELECT id, email, display_name, avatar_path FROM users WHERE id = ?"
    )
    .get(req.session.user.id);
  res.render("profile/index", { me });
});

// Importante: aplicar csurf só depois do multer para multipart
router.post("/", upload.single("avatar"), csrfProtection, (req, res) => {
  const db = getDb();
  const displayName = (req.body.display_name || "")
    .toString()
    .trim()
    .slice(0, 60);
  let avatarPath = null;
  if (req.file) {
    avatarPath = `/public/uploads/${req.file.filename}`;
  }
  if (displayName) {
    db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(
      displayName,
      req.session.user.id
    );
  }
  if (avatarPath) {
    db.prepare("UPDATE users SET avatar_path = ? WHERE id = ?").run(
      avatarPath,
      req.session.user.id
    );
  }

  // HX redirect para evitar problemas de render parcial
  if (req.get("HX-Request")) {
    res.set("HX-Redirect", "/profile");
    return res.status(204).send();
  }
  res.redirect("/profile");
});

export default router;
