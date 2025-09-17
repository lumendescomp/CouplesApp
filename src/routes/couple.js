import { Router } from "express";
import { getDb } from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const db = getDb();
  const meId = req.session.user.id;
  const cpl = db
    .prepare("SELECT * FROM couples WHERE partner1_id = ? OR partner2_id = ?")
    .get(meId, meId);
  if (!cpl) return res.redirect("/invite");
  const partnerId =
    cpl.partner1_id === meId ? cpl.partner2_id : cpl.partner1_id;
  const partner = partnerId
    ? db
        .prepare(
          "SELECT email, display_name, avatar_path FROM users WHERE id = ?"
        )
        .get(partnerId)
    : null;
  res.render("couple/index", { couple: cpl, partner });
});

// Salvar/atualizar a data de início do relacionamento
router.post("/start-date", (req, res) => {
  const db = getDb();
  const meId = req.session.user.id;
  const cpl = db
    .prepare("SELECT * FROM couples WHERE partner1_id = ? OR partner2_id = ?")
    .get(meId, meId);
  if (!cpl) return res.status(400).send("not paired");
  const raw = (req.body && String(req.body.start_date || "").trim()) || "";
  // Aceita YYYY-MM-DD ou DD/MM/YYYY
  let iso = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    iso = raw;
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split("/");
    iso = `${yyyy}-${mm}-${dd}`; // converte para ISO simples
  } else if (raw === "") {
    iso = null; // limpar se usuário apagar explicitamente
  }
  if (iso === null || /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    db.prepare(
      "UPDATE couples SET relationship_start_date = ? WHERE id = ?"
    ).run(iso, cpl.id);
    return res.json({ ok: true, start_date: iso });
  }
  // não atualiza quando formato inválido
  return res.status(400).json({ ok: false, error: "invalid_date" });
});

export default router;
