import { Router } from "express";
import { getDb } from "../db.js";
import { generateInviteCode } from "../utils/code.js";

const router = Router();

router.get("/", (req, res) => {
  const db = getDb();
  const invites = db
    .prepare(
      "SELECT * FROM invites WHERE issuer_user_id = ? AND used_at IS NULL AND datetime(expires_at) > datetime('now') ORDER BY created_at DESC"
    )
    .all(req.session.user.id);
  res.render("invite/index", { invites });
});

router.post("/create", (req, res) => {
  const db = getDb();
  // Check if user already in a couple
  const cpl = db
    .prepare("SELECT id FROM couples WHERE partner1_id = ? OR partner2_id = ?")
    .get(req.session.user.id, req.session.user.id);
  if (cpl) {
    return res
      .status(400)
      .send(
        '<div class="border border-red-700/40 rounded-xl p-3 bg-red-900/20 text-red-200 text-sm">❌ Você já está em um casal e não pode criar novos convites.</div>'
      );
  }
  const code = generateInviteCode(8);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  db.prepare(
    "INSERT INTO invites (code, issuer_user_id, expires_at) VALUES (?, ?, ?)"
  ).run(code, req.session.user.id, expiresAt);
  const invite = db.prepare("SELECT * FROM invites WHERE code = ?").get(code);
  // Render fragment row
  res.set("HX-Trigger", "invite-created");
  res.render("invite/_code_row", { invite, layout: false });
});

// Opcional: detalhar um convite por ID (para futuro revoke/sharing expandido)
router.get("/:code", (req, res) => {
  const db = getDb();
  const invite = db
    .prepare("SELECT * FROM invites WHERE code = ? AND issuer_user_id = ?")
    .get(req.params.code, req.session.user.id);
  if (!invite) return res.status(404).send("Convite não encontrado");
  res.render("invite/_code_row", { invite, layout: false });
});

export default router;
