import { Router } from "express";
import csrf from "csurf";
import multer from "multer";
import path from "path";
import fs from "fs";
import { getDb } from "../db.js";

const router = Router();
const csrfProtection = csrf();

const uploadDir = path.resolve(process.cwd(), "public", "album-photos");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const coupleId = req.session.user?.coupleId || "unknown";
    cb(null, `couple${coupleId}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB para vídeos
  fileFilter: (req, file, cb) => {
    const imageFormats = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
    const videoFormats = [".mp4", ".webm", ".mov"];
    const ext = path.extname(file.originalname).toLowerCase();
    const ok = [...imageFormats, ...videoFormats].includes(ext);
    cb(ok ? null : new Error("Formato inválido"), ok);
  },
});

function getCoupleForUser(db, userId) {
  return db
    .prepare("SELECT * FROM couples WHERE partner1_id = ? OR partner2_id = ?")
    .get(userId, userId);
}

// Página principal do álbum
router.get("/", (req, res) => {
  const db = getDb();
  const meId = req.session.user.id;
  const cpl = getCoupleForUser(db, meId);

  if (!cpl) return res.redirect("/invite");

  // Buscar fotos da biblioteca
  const photos = db
    .prepare(
      "SELECT id, file_path, media_type, uploaded_at FROM album_photos WHERE couple_id = ? ORDER BY uploaded_at DESC"
    )
    .all(cpl.id);

  // Buscar slots preenchidos (template 1 = coração com 6 slots)
  const slots = db
    .prepare(
      "SELECT slot_number, photo_id, file_path, media_type FROM album_slots LEFT JOIN album_photos ON album_slots.photo_id = album_photos.id WHERE album_slots.couple_id = ? AND album_slots.template_id = 1"
    )
    .all(cpl.id);

  // Criar mapa de slots (1-6)
  const slotMap = {};
  for (let i = 1; i <= 6; i++) {
    const slot = slots.find((s) => s.slot_number === i);
    slotMap[i] = slot
      ? {
          photo_id: slot.photo_id,
          file_path: slot.file_path,
          media_type: slot.media_type || "image",
        }
      : null;
  }

  // Otimização: Adiciona Resource Hints para preload das primeiras 6 fotos
  // Isso permite que o navegador baixe em paralelo (HTTP/2)
  const firstPhotos = photos.slice(0, 6);
  const linkHeaders = firstPhotos
    .map((photo) => `<${photo.file_path}>; rel=preload; as=image`)
    .join(", ");

  if (linkHeaders) {
    res.set("Link", linkHeaders);
  }

  res.render("album/index", { photos, slots: slotMap });
});

// Upload de nova foto
router.post("/upload", upload.single("photo"), (req, res) => {
  const db = getDb();
  const meId = req.session.user.id;
  const cpl = getCoupleForUser(db, meId);

  if (!cpl) return res.status(400).send("not paired");

  // Verificar limite de 20 fotos
  const count = db
    .prepare("SELECT COUNT(*) as total FROM album_photos WHERE couple_id = ?")
    .get(cpl.id).total;

  if (count >= 20) {
    // Deletar arquivo recém-uploadado
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
    }
    if (req.get("HX-Request")) {
      return res
        .status(400)
        .send(
          '<div class="text-red-400 text-sm">Limite de 20 fotos atingido. Delete algumas para adicionar novas.</div>'
        );
    }
    return res.status(400).send("Limite atingido");
  }

  if (!req.file) {
    return res.status(400).send("Nenhum arquivo enviado");
  }

  const filePath = `/public/album-photos/${req.file.filename}`;

  // Detecta o tipo de mídia baseado na extensão
  const ext = path.extname(req.file.filename).toLowerCase();
  const videoFormats = [".mp4", ".webm", ".mov"];
  const mediaType = videoFormats.includes(ext) ? "video" : "image";

  const info = db
    .prepare(
      "INSERT INTO album_photos (couple_id, file_path, media_type) VALUES (?, ?, ?)"
    )
    .run(cpl.id, filePath, mediaType);

  const photo = db
    .prepare(
      "SELECT id, file_path, media_type, uploaded_at FROM album_photos WHERE id = ?"
    )
    .get(info.lastInsertRowid);

  // Sempre retorna o partial (para fetch e HTMX)
  return res.render("album/_photo_item", { photo, layout: false });
});

// Atribuir foto a um slot
router.post("/slot/:slotNumber", async (req, res) => {
  const db = getDb();
  const meId = req.session.user.id;
  const cpl = getCoupleForUser(db, meId);

  if (!cpl) return res.status(400).send("not paired");

  const slotNumber = parseInt(req.params.slotNumber);
  const photoId = parseInt(req.body.photo_id);

  if (slotNumber < 1 || slotNumber > 6) {
    return res.status(400).send("Slot inválido");
  }

  // Verificar se a foto pertence ao casal
  const photo = db
    .prepare("SELECT id FROM album_photos WHERE id = ? AND couple_id = ?")
    .get(photoId, cpl.id);

  if (!photo) {
    return res.status(400).send("Foto não encontrada");
  }

  // Verificar se já existe registro para este slot
  const existing = db
    .prepare(
      "SELECT id FROM album_slots WHERE couple_id = ? AND template_id = 1 AND slot_number = ?"
    )
    .get(cpl.id, slotNumber);

  if (existing) {
    // Atualizar
    db.prepare("UPDATE album_slots SET photo_id = ? WHERE id = ?").run(
      photoId,
      existing.id
    );
  } else {
    // Inserir
    db.prepare(
      "INSERT INTO album_slots (couple_id, template_id, slot_number, photo_id) VALUES (?, 1, ?, ?)"
    ).run(cpl.id, slotNumber, photoId);
  }

  if (req.get("HX-Request")) {
    const updated = db
      .prepare("SELECT file_path, media_type FROM album_photos WHERE id = ?")
      .get(photoId);
    return res.render("album/_slot_filled", {
      slotNumber,
      filePath: updated.file_path,
      mediaType: updated.media_type || "image",
      photoId: photoId,
      layout: false,
    });
  }

  res.json({ ok: true });
});

// Remover foto de um slot
router.delete("/slot/:slotNumber", (req, res) => {
  const db = getDb();
  const meId = req.session.user.id;
  const cpl = getCoupleForUser(db, meId);

  if (!cpl) return res.status(400).send("not paired");

  const slotNumber = parseInt(req.params.slotNumber);

  db.prepare(
    "DELETE FROM album_slots WHERE couple_id = ? AND template_id = 1 AND slot_number = ?"
  ).run(cpl.id, slotNumber);

  if (req.get("HX-Request")) {
    return res.render("album/_slot_empty", { slotNumber, layout: false });
  }

  res.json({ ok: true });
});

// Deletar foto da biblioteca
router.delete("/photo/:photoId", (req, res) => {
  const db = getDb();
  const meId = req.session.user.id;
  const cpl = getCoupleForUser(db, meId);

  if (!cpl) return res.status(400).send("not paired");

  const photoId = parseInt(req.params.photoId);

  const photo = db
    .prepare(
      "SELECT id, file_path FROM album_photos WHERE id = ? AND couple_id = ?"
    )
    .get(photoId, cpl.id);

  if (!photo) return res.status(404).send("Foto não encontrada");

  // Remover dos slots primeiro
  db.prepare("DELETE FROM album_slots WHERE photo_id = ?").run(photoId);

  // Deletar do banco
  db.prepare("DELETE FROM album_photos WHERE id = ?").run(photoId);

  // Deletar arquivo físico
  try {
    const fullPath = path.join(
      process.cwd(),
      photo.file_path.replace(/^\//, "")
    );
    fs.unlinkSync(fullPath);
  } catch (e) {
    console.warn("Erro ao deletar arquivo:", e.message);
  }

  if (req.get("HX-Request")) {
    res.set("HX-Trigger", "photoDeleted");
    return res.send("");
  }

  res.json({ ok: true });
});

export default router;
