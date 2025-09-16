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
    ? db.prepare("SELECT email FROM users WHERE id = ?").get(partnerId)
    : null;
  res.render("couple/index", { couple: cpl, partner });
});

export default router;
