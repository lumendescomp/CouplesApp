import { Router } from "express";
import bcrypt from "bcryptjs";
import { getDb } from "../db.js";
import { requireNoCouple } from "../middleware/auth.js";

const router = Router();

router.get("/register", (req, res) => {
  res.render("auth/register");
});

router.post("/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .render("auth/register", { error: "Preencha e-mail e senha." });
  }
  const db = getDb();
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (exists) {
    return res
      .status(400)
      .render("auth/register", { error: "E-mail já cadastrado." });
  }
  const hash = await bcrypt.hash(password, 10);
  const info = db
    .prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)")
    .run(email, hash);
  req.session.user = { id: info.lastInsertRowid, email };
  res.redirect("/invite");
});

router.get("/login", (req, res) => {
  res.render("auth/login");
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user)
    return res
      .status(400)
      .render("auth/login", { error: "Credenciais inválidas." });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok)
    return res
      .status(400)
      .render("auth/login", { error: "Credenciais inválidas." });

  // Load couple if any
  const cpl = db
    .prepare("SELECT * FROM couples WHERE partner1_id = ? OR partner2_id = ?")
    .get(user.id, user.id);
  req.session.user = {
    id: user.id,
    email: user.email,
    coupleId: cpl?.id || null,
  };
  const returnTo = req.session.returnTo;
  delete req.session.returnTo;
  if (returnTo) return res.redirect(returnTo);
  res.redirect(cpl ? "/couple" : "/invite");
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/auth/login");
  });
});

export default router;
