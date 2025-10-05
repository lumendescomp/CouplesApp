import express from "express";
import { getDb } from "../db.js";

const router = express.Router();

// GET /movies - Lista de filmes do casal
router.get("/", (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) {
    return res.redirect("/auth/login");
  }

  const db = getDb();

  // Buscar o casal do usuário
  const couple = db
    .prepare(
      `
    SELECT * FROM couples 
    WHERE partner1_id = ? OR partner2_id = ?
  `
    )
    .get(userId, userId);

  if (!couple) {
    return res.redirect("/invite");
  }

  // Buscar filmes do casal
  const movies = db
    .prepare(
      `
    SELECT * FROM movies 
    WHERE couple_id = ?
    ORDER BY watched_at DESC, created_at DESC
  `
    )
    .all(couple.id);

  res.render("movies/index", {
    movies,
    couple,
  });
});

export default router;
