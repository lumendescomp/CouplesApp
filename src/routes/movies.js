import express from "express";
import { getDb } from "../db.js";
import {
  searchMovies,
  getMovieDetails,
  isApiConfigured,
} from "../utils/tmdb.js";

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

  // Buscar filmes do casal separados por status
  const watchedMovies = db
    .prepare(
      `
    SELECT * FROM movies 
    WHERE couple_id = ? AND status = 'watched'
    ORDER BY watched_at DESC, created_at DESC
  `
    )
    .all(couple.id);

  const watchlistMovies = db
    .prepare(
      `
    SELECT * FROM movies 
    WHERE couple_id = ? AND status = 'watchlist'
    ORDER BY created_at DESC
  `
    )
    .all(couple.id);

  res.render("movies/index", {
    watchedMovies,
    watchlistMovies,
    couple,
    tmdbConfigured: isApiConfigured(),
  });
});

// POST /movies/search - Buscar filmes na API
router.post("/search", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query é obrigatória" });
    }

    if (!isApiConfigured()) {
      return res.status(503).json({
        error: "API do TMDB não configurada. Adicione TMDB_API_KEY no .env",
      });
    }

    const results = await searchMovies(query);
    res.json(results);
  } catch (error) {
    console.error("Erro na busca de filmes:", error);
    res.status(500).json({ error: "Erro ao buscar filmes" });
  }
});

// POST /movies - Adicionar filme
router.post("/", async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const db = getDb();

    // Buscar casal
    const couple = db
      .prepare(
        `
      SELECT * FROM couples 
      WHERE partner1_id = ? OR partner2_id = ?
    `
      )
      .get(userId, userId);

    if (!couple) {
      return res.status(404).json({ error: "Casal não encontrado" });
    }

    const {
      title,
      year,
      posterUrl,
      status = "watchlist",
      rating,
      notes,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Título é obrigatório" });
    }

    // Inserir filme
    const result = db
      .prepare(
        `
      INSERT INTO movies (couple_id, title, year, poster_url, status, rating, notes, watched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        couple.id,
        title,
        year || null,
        posterUrl || null,
        status,
        rating || null,
        notes || null,
        status === "watched" ? new Date().toISOString() : null
      );

    res.json({
      success: true,
      movieId: result.lastInsertRowid,
    });
  } catch (error) {
    console.error("Erro ao adicionar filme:", error);
    res.status(500).json({ error: "Erro ao adicionar filme" });
  }
});

// PUT /movies/:id - Atualizar filme
router.put("/:id", (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const db = getDb();
    const movieId = req.params.id;

    // Verificar se o filme pertence ao casal do usuário
    const movie = db
      .prepare(
        `
      SELECT m.* FROM movies m
      INNER JOIN couples c ON m.couple_id = c.id
      WHERE m.id = ? AND (c.partner1_id = ? OR c.partner2_id = ?)
    `
      )
      .get(movieId, userId, userId);

    if (!movie) {
      return res.status(404).json({ error: "Filme não encontrado" });
    }

    const { title, year, posterUrl, status, rating, notes } = req.body;

    // Atualizar filme
    db.prepare(
      `
      UPDATE movies 
      SET title = COALESCE(?, title),
          year = COALESCE(?, year),
          poster_url = COALESCE(?, poster_url),
          status = COALESCE(?, status),
          rating = ?,
          notes = ?,
          watched_at = CASE 
            WHEN ? = 'watched' AND status = 'watchlist' THEN datetime('now')
            WHEN ? = 'watchlist' THEN NULL
            ELSE watched_at
          END
      WHERE id = ?
    `
    ).run(
      title || null,
      year || null,
      posterUrl || null,
      status || null,
      rating !== undefined ? rating : movie.rating,
      notes !== undefined ? notes : movie.notes,
      status,
      status,
      movieId
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar filme:", error);
    res.status(500).json({ error: "Erro ao atualizar filme" });
  }
});

// DELETE /movies/:id - Deletar filme
router.delete("/:id", (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const db = getDb();
    const movieId = req.params.id;

    // Verificar e deletar
    const result = db
      .prepare(
        `
      DELETE FROM movies 
      WHERE id = ? AND couple_id IN (
        SELECT id FROM couples WHERE partner1_id = ? OR partner2_id = ?
      )
    `
      )
      .run(movieId, userId, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Filme não encontrado" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar filme:", error);
    res.status(500).json({ error: "Erro ao deletar filme" });
  }
});

export default router;
