import { Router } from "express";
import { getDb } from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const code = (req.query.code || "").toString().toUpperCase();
  res.render("join/index", { code });
});

router.post("/", (req, res) => {
  let { code } = req.body;
  code = (code || "").toUpperCase().trim();
  const db = getDb();
  const meId = req.session.user.id;

  // Checks
  const myCouple = db
    .prepare("SELECT id FROM couples WHERE partner1_id = ? OR partner2_id = ?")
    .get(meId, meId);
  if (myCouple)
    return res
      .status(400)
      .send('<div class="text-red-600">Você já está em um casal.</div>');

  const invite = db.prepare("SELECT * FROM invites WHERE code = ?").get(code);
  if (!invite)
    return res
      .status(400)
      .send('<div class="text-red-600">Código inválido.</div>');
  if (invite.used_at)
    return res
      .status(400)
      .send('<div class="text-red-600">Código já utilizado.</div>');
  const now = db.prepare("SELECT datetime('now') as now").get().now;
  if (new Date(invite.expires_at) <= new Date(now))
    return res
      .status(400)
      .send('<div class="text-red-600">Código expirado.</div>');
  if (invite.issuer_user_id === meId)
    return res
      .status(400)
      .send(
        '<div class="text-red-600">Você não pode usar o próprio código.</div>'
      );

  // Check issuer not already paired
  const issuerCouple = db
    .prepare("SELECT * FROM couples WHERE partner1_id = ? OR partner2_id = ?")
    .get(invite.issuer_user_id, invite.issuer_user_id);
  if (issuerCouple && issuerCouple.partner1_id && issuerCouple.partner2_id) {
    return res
      .status(400)
      .send(
        '<div class="text-red-600">Convite inválido: emissor já está pareado.</div>'
      );
  }

  // Transaction
  const tx = db.transaction(() => {
    // Create or complete couple
    let coupleId = issuerCouple?.id;
    if (!coupleId) {
      const info = db
        .prepare("INSERT INTO couples (partner1_id, partner2_id) VALUES (?, ?)")
        .run(invite.issuer_user_id, meId);
      coupleId = info.lastInsertRowid;
    } else {
      // Determine which partner is null
      const cpl = db
        .prepare("SELECT * FROM couples WHERE id = ?")
        .get(coupleId);
      if (!cpl.partner2_id && cpl.partner1_id !== meId) {
        db.prepare("UPDATE couples SET partner2_id = ? WHERE id = ?").run(
          meId,
          coupleId
        );
      } else if (!cpl.partner1_id && cpl.partner2_id !== meId) {
        db.prepare("UPDATE couples SET partner1_id = ? WHERE id = ?").run(
          meId,
          coupleId
        );
      } else {
        throw new Error("Casal já completo");
      }
    }

    db.prepare(
      'UPDATE invites SET used_at = datetime("now"), used_by_user_id = ?, created_couple_id = ? WHERE id = ?'
    ).run(meId, coupleId, invite.id);

    return coupleId;
  });

  try {
    const coupleId = tx();
    // Update session
    req.session.user.coupleId = coupleId;
    res.set("HX-Redirect", "/couple");
    return res.send("");
  } catch (e) {
    console.error(e);
    return res
      .status(400)
      .send(
        '<div class="text-red-600">Não foi possível completar o pareamento.</div>'
      );
  }
});

export default router;
