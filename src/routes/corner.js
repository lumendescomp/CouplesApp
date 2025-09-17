import { Router } from "express";
import { getDb } from "../db.js";

const router = Router();

function getCoupleForUser(db, userId) {
  return db
    .prepare("SELECT * FROM couples WHERE partner1_id = ? OR partner2_id = ?")
    .get(userId, userId);
}

router.get("/", (req, res) => {
  const db = getDb();
  const meId = req.session.user.id;
  const cpl = getCoupleForUser(db, meId);
  if (!cpl) return res.redirect("/invite");
  const items = db
    .prepare(
      "SELECT id, item_key, x, y, z, rotation, scale, layer, tilt_x, tilt_y, flip_x, flip_y, color FROM couple_items WHERE couple_id = ? ORDER BY id"
    )
    .all(cpl.id);
  res.render("corner/index", { couple: cpl, items });
});

router.post("/items", (req, res) => {
  const db = getDb();
  const meId = req.session.user.id;
  const cpl = getCoupleForUser(db, meId);
  if (!cpl) return res.status(400).send("not paired");
  const {
    item_key,
    x = 50,
    y = 50,
    z = 0,
    rotation = 0,
    scale = 1.0,
  } = req.body || {};
  if (!item_key) return res.status(400).send("item_key required");
  const stmt = db.prepare(
    "INSERT INTO couple_items (couple_id, item_key, x, y, z, rotation, scale, layer, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const info = stmt.run(
    cpl.id,
    String(item_key),
    Number(x),
    Number(y),
    Number(z),
    Number(rotation),
    Number(scale) || 1.0,
    0,
    null
  );
  const row = db
    .prepare(
      "SELECT id, item_key, x, y, z, rotation, scale, layer, tilt_x, tilt_y, flip_x, flip_y, color FROM couple_items WHERE id = ?"
    )
    .get(info.lastInsertRowid);
  if (req.get("hx-request")) {
    return res.render("corner/_item", { item: row, layout: false });
  }
  res.redirect("/corner");
});

router.post("/items/:id/delete", (req, res) => {
  const db = getDb();
  const meId = req.session.user.id;
  const cpl = getCoupleForUser(db, meId);
  if (!cpl) return res.status(400).send("not paired");
  const id = Number(req.params.id);
  const row = db
    .prepare("SELECT id FROM couple_items WHERE id = ? AND couple_id = ?")
    .get(id, cpl.id);
  if (!row) return res.status(404).send("not found");
  db.prepare("DELETE FROM couple_items WHERE id = ?").run(id);
  if (req.get("hx-request")) {
    res.set("HX-Trigger", "itemRemoved");
    return res.send("");
  }
  res.redirect("/corner");
});

// Preferências de cores globais do cantinho (por casal)
router.post("/colors", (req, res) => {
  const db = getDb();
  const meId = req.session.user.id;
  const cpl = getCoupleForUser(db, meId);
  if (!cpl) return res.status(400).send("not paired");
  const payload = req.body || {};
  const parseColor = (v) => {
    if (v == null) return null;
    if (typeof v === "string") {
      const s = v.trim();
      const h = s.startsWith("#") ? s.slice(1) : s;
      const n = parseInt(h, 16);
      return Number.isFinite(n) ? n : null;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const canvas = parseColor(payload.canvas);
  const floor = parseColor(payload.floor);
  const wall = parseColor(payload.wall);
  const upd = db.prepare(
    "UPDATE couples SET corner_canvas_color = COALESCE(?, corner_canvas_color), corner_floor_color = COALESCE(?, corner_floor_color), corner_wall_color = COALESCE(?, corner_wall_color) WHERE id = ?"
  );
  upd.run(canvas, floor, wall, cpl.id);
  const updated = getCoupleForUser(db, meId);
  res.json({
    ok: true,
    colors: {
      canvas: updated.corner_canvas_color,
      floor: updated.corner_floor_color,
      wall: updated.corner_wall_color,
    },
  });
});

// mover/girar item (nudge): recebe dx, dy e drot (inteiros), clamped 0..100 e rotação 0..359
router.post("/items/:id/nudge", (req, res) => {
  const db = getDb();
  const meId = req.session.user.id;
  const cpl = getCoupleForUser(db, meId);
  if (!cpl) return res.status(400).send("not paired");

  const id = Number(req.params.id);
  const current = db
    .prepare(
      "SELECT id, item_key, x, y, z, rotation, scale, layer, tilt_x, tilt_y, flip_x, flip_y, color FROM couple_items WHERE id = ? AND couple_id = ?"
    )
    .get(id, cpl.id);
  if (!current) return res.status(404).send("not found");

  const dx = Number(req.body.dx || 0) || 0;
  const dy = Number(req.body.dy || 0) || 0;
  const drot = Number(req.body.drot || 0) || 0;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const normRot = (r) => ((r % 360) + 360) % 360;

  const nx = clamp(Number(current.x) + Number(dx), 0, 100);
  const ny = clamp(Number(current.y) + Number(dy), 0, 100);
  const nr = normRot(Math.round(current.rotation + drot));

  db.prepare(
    "UPDATE couple_items SET x = ?, y = ?, rotation = ? WHERE id = ?"
  ).run(nx, ny, nr, id);

  const updated = db
    .prepare(
      "SELECT id, item_key, x, y, z, rotation, scale, layer, tilt_x, tilt_y, flip_x, flip_y, color FROM couple_items WHERE id = ?"
    )
    .get(id);

  if (req.get("hx-request")) {
    return res.render("corner/_item", { item: updated, layout: false });
  }
  res.redirect("/corner");
});

// subir/descer item (altura z)
router.post("/items/:id/height", (req, res) => {
  const db = getDb();
  const meId = req.session.user.id;
  const cpl = getCoupleForUser(db, meId);
  if (!cpl) return res.status(400).send("not paired");
  const id = Number(req.params.id);
  const current = db
    .prepare(
      "SELECT id, item_key, x, y, z, rotation, scale, layer, tilt_x, tilt_y, flip_x, flip_y FROM couple_items WHERE id = ? AND couple_id = ?"
    )
    .get(id, cpl.id);
  if (!current) return res.status(404).send("not found");
  const dz = Number(req.body.dz || 0) || 0;
  const nz = Math.max(0, Math.min(20, current.z + dz));
  db.prepare("UPDATE couple_items SET z = ? WHERE id = ?").run(nz, id);
  const updated = db
    .prepare(
      "SELECT id, item_key, x, y, z, rotation, scale, layer, tilt_x, tilt_y, flip_x, flip_y, color FROM couple_items WHERE id = ?"
    )
    .get(id);
  if (req.get("hx-request")) {
    return res.render("corner/_item", { item: updated, layout: false });
  }
  res.redirect("/corner");
});

// Atualiza posição absoluta (x,y em %)
router.post("/items/:id/position", (req, res) => {
  const db = getDb();
  const meId = req.session.user.id;
  const cpl = getCoupleForUser(db, meId);
  if (!cpl) return res.status(400).send("not paired");
  const id = Number(req.params.id);
  const row = db
    .prepare("SELECT id FROM couple_items WHERE id = ? AND couple_id = ?")
    .get(id, cpl.id);
  if (!row) return res.status(404).send("not found");
  const x = Math.max(0, Math.min(100, Number(req.body.x || 0)));
  const y = Math.max(0, Math.min(100, Number(req.body.y || 0)));
  db.prepare("UPDATE couple_items SET x = ?, y = ? WHERE id = ?").run(x, y, id);
  const updated = db
    .prepare(
      "SELECT id, item_key, x, y, z, rotation, scale, layer, tilt_x, tilt_y, flip_x, flip_y, color FROM couple_items WHERE id = ?"
    )
    .get(id);
  if (req.get("hx-request")) {
    return res.render("corner/_item", { item: updated, layout: false });
  }
  // Caso fetch padrão, ainda devolvemos o partial
  return res.render("corner/_item", { item: updated, layout: false });
});

// escala absoluta (set) 0.25..2.0
router.post("/items/:id/scale", (req, res) => {
  const db = getDb();
  const meId = req.session.user.id;
  const cpl = getCoupleForUser(db, meId);
  if (!cpl) return res.status(400).send("not paired");
  const id = Number(req.params.id);
  const row = db
    .prepare("SELECT id FROM couple_items WHERE id = ? AND couple_id = ?")
    .get(id, cpl.id);
  if (!row) return res.status(404).send("not found");
  const raw = Number(req.body.scale);
  const scl = Math.max(0.25, Math.min(2.0, isFinite(raw) ? raw : 1.0));
  db.prepare("UPDATE couple_items SET scale = ? WHERE id = ?").run(scl, id);
  const updated = db
    .prepare(
      "SELECT id, item_key, x, y, z, rotation, scale, layer, tilt_x, tilt_y, flip_x, flip_y, color FROM couple_items WHERE id = ?"
    )
    .get(id);
  if (req.get("hx-request")) {
    return res.render("corner/_item", { item: updated, layout: false });
  }
  res.render("corner/_item", { item: updated, layout: false });
});

// Ajuste de camada absoluta (definir layer)
router.post("/items/:id/layer", (req, res) => {
  const db = getDb();
  const meId = req.session.user.id;
  const cpl = getCoupleForUser(db, meId);
  if (!cpl) return res.status(400).send("not paired");
  const id = Number(req.params.id);
  const row = db
    .prepare("SELECT id FROM couple_items WHERE id = ? AND couple_id = ?")
    .get(id, cpl.id);
  if (!row) return res.status(404).send("not found");
  const raw = Number(req.body.layer);
  const layer = Math.max(-1000, Math.min(1000, isFinite(raw) ? raw : 0));
  db.prepare("UPDATE couple_items SET layer = ? WHERE id = ?").run(layer, id);
  const updated = db
    .prepare(
      "SELECT id, item_key, x, y, z, rotation, scale, layer, tilt_x, tilt_y, flip_x, flip_y, color FROM couple_items WHERE id = ?"
    )
    .get(id);
  if (req.get("hx-request")) {
    return res.render("corner/_item", { item: updated, layout: false });
  }
  res.render("corner/_item", { item: updated, layout: false });
});

// Trazer para frente (+1) / enviar para trás (-1)
router.post("/items/:id/stack", (req, res) => {
  const db = getDb();
  const meId = req.session.user.id;
  const cpl = getCoupleForUser(db, meId);
  if (!cpl) return res.status(400).send("not paired");
  const id = Number(req.params.id);
  const row = db
    .prepare(
      "SELECT id, layer FROM couple_items WHERE id = ? AND couple_id = ?"
    )
    .get(id, cpl.id);
  if (!row) return res.status(404).send("not found");
  const dir = Math.sign(Number(req.body.dir) || 0) || 0; // -1, 0, 1
  const next = row.layer + dir;
  db.prepare("UPDATE couple_items SET layer = ? WHERE id = ?").run(next, id);
  const updated = db
    .prepare(
      "SELECT id, item_key, x, y, z, rotation, scale, layer, tilt_x, tilt_y, flip_x, flip_y, color FROM couple_items WHERE id = ?"
    )
    .get(id);
  if (req.get("hx-request")) {
    return res.render("corner/_item", { item: updated, layout: false });
  }
  res.render("corner/_item", { item: updated, layout: false });
});

// inclinação (tilt/skew) absoluta
router.post("/items/:id/tilt", (req, res) => {
  const db = getDb();
  const meId = req.session.user.id;
  const cpl = getCoupleForUser(db, meId);
  if (!cpl) return res.status(400).send("not paired");
  const id = Number(req.params.id);
  const row = db
    .prepare("SELECT id FROM couple_items WHERE id = ? AND couple_id = ?")
    .get(id, cpl.id);
  if (!row) return res.status(404).send("not found");
  const tx = Number(req.body.tilt_x);
  const ty = Number(req.body.tilt_y);
  const clamp = (v) => Math.max(-60, Math.min(60, isFinite(v) ? v : 0));
  const tilt_x = clamp(tx);
  const tilt_y = clamp(ty);
  db.prepare("UPDATE couple_items SET tilt_x = ?, tilt_y = ? WHERE id = ?").run(
    tilt_x,
    tilt_y,
    id
  );
  const updated = db
    .prepare(
      "SELECT id, item_key, x, y, z, rotation, scale, layer, tilt_x, tilt_y, flip_x, flip_y, color FROM couple_items WHERE id = ?"
    )
    .get(id);
  return res.render("corner/_item", { item: updated, layout: false });
});

// flip (espelhar) absoluto
router.post("/items/:id/flip", (req, res) => {
  const db = getDb();
  const meId = req.session.user.id;
  const cpl = getCoupleForUser(db, meId);
  if (!cpl) return res.status(400).send("not paired");
  const id = Number(req.params.id);
  const row = db
    .prepare("SELECT id FROM couple_items WHERE id = ? AND couple_id = ?")
    .get(id, cpl.id);
  if (!row) return res.status(404).send("not found");
  const fx = Number(req.body.flip_x) ? 1 : 0;
  const fy = Number(req.body.flip_y) ? 1 : 0;
  db.prepare("UPDATE couple_items SET flip_x = ?, flip_y = ? WHERE id = ?").run(
    fx,
    fy,
    id
  );
  const updated = db
    .prepare(
      "SELECT id, item_key, x, y, z, rotation, scale, layer, tilt_x, tilt_y, flip_x, flip_y, color FROM couple_items WHERE id = ?"
    )
    .get(id);
  return res.render("corner/_item", { item: updated, layout: false });
});

// atualizar cor (parede/piso)
router.post("/items/:id/color", (req, res) => {
  const db = getDb();
  const meId = req.session.user.id;
  const cpl = getCoupleForUser(db, meId);
  if (!cpl) return res.status(400).send("not paired");
  const id = Number(req.params.id);
  const row = db
    .prepare("SELECT id FROM couple_items WHERE id = ? AND couple_id = ?")
    .get(id, cpl.id);
  if (!row) return res.status(404).send("not found");
  let color = req.body && req.body.color;
  // aceitar tanto string hex (#RRGGBB) quanto inteiro
  if (typeof color === "string") {
    const s = color.trim();
    const h = s.startsWith("#") ? s.slice(1) : s;
    color = parseInt(h, 16);
  }
  color = Number(color);
  if (!Number.isFinite(color)) color = null; // limpar cor se inválido
  db.prepare("UPDATE couple_items SET color = ? WHERE id = ?").run(color, id);
  const updated = db
    .prepare(
      "SELECT id, item_key, x, y, z, rotation, scale, layer, tilt_x, tilt_y, flip_x, flip_y, color FROM couple_items WHERE id = ?"
    )
    .get(id);
  return res.render("corner/_item", { item: updated, layout: false });
});

export default router;
