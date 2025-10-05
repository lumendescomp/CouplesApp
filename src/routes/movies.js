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
    SELECT m.*,
           r1.rating as partner1_rating,
           r1.notes as partner1_notes,
           r2.rating as partner2_rating,
           r2.notes as partner2_notes,
           (r1.user_id = ?) as current_user_is_partner1
    FROM movies m
    LEFT JOIN movie_ratings r1 ON m.id = r1.movie_id AND r1.user_id = ?
    LEFT JOIN movie_ratings r2 ON m.id = r2.movie_id AND r2.user_id = ? AND r2.user_id != ?
    WHERE m.couple_id = ? AND m.status = 'watched'
    ORDER BY m.watched_at DESC, m.created_at DESC
  `
    )
    .all(
      userId,
      userId,
      couple.partner1_id === userId ? couple.partner2_id : couple.partner1_id,
      userId,
      couple.id
    );

  const watchlistMovies = db
    .prepare(
      `
    SELECT * FROM movies 
    WHERE couple_id = ? AND status = 'watchlist'
    ORDER BY created_at DESC
  `
    )
    .all(couple.id);

  // Adicionar informação de quem avaliou
  watchedMovies.forEach((movie) => {
    movie.currentUserRating = movie.current_user_is_partner1
      ? movie.partner1_rating
      : movie.partner2_rating;
    movie.partnerRating = movie.current_user_is_partner1
      ? movie.partner2_rating
      : movie.partner1_rating;
    movie.hasCurrentUserRated = !!movie.currentUserRating;
    movie.hasPartnerRated = !!movie.partnerRating;
  });

  res.render("movies/index", {
    watchedMovies,
    watchlistMovies,
    couple,
    currentUserId: userId,
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

    // Inserir filme (sem rating no filme)
    const result = db
      .prepare(
        `
      INSERT INTO movies (couple_id, title, year, poster_url, status, notes, watched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        couple.id,
        title,
        year || null,
        posterUrl || null,
        status,
        notes || null,
        status === "watched" ? new Date().toISOString() : null
      );

    const movieId = result.lastInsertRowid;

    // Se houver rating, inserir na tabela movie_ratings
    if (rating && status === "watched") {
      db.prepare(
        `
        INSERT INTO movie_ratings (movie_id, user_id, rating, notes)
        VALUES (?, ?, ?, ?)
      `
      ).run(movieId, userId, rating, notes || null);
    }

    res.json({
      success: true,
      movieId: movieId,
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

    // Atualizar dados básicos do filme
    db.prepare(
      `
      UPDATE movies 
      SET title = COALESCE(?, title),
          year = COALESCE(?, year),
          poster_url = COALESCE(?, poster_url),
          status = COALESCE(?, status),
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
      status,
      status,
      movieId
    );

    // Se houver rating, atualizar ou inserir na tabela movie_ratings
    if (rating !== undefined && status === "watched") {
      const existingRating = db
        .prepare(
          "SELECT id FROM movie_ratings WHERE movie_id = ? AND user_id = ?"
        )
        .get(movieId, userId);

      if (existingRating) {
        // Atualizar rating existente
        db.prepare(
          `
          UPDATE movie_ratings 
          SET rating = ?, notes = ?, updated_at = datetime('now')
          WHERE movie_id = ? AND user_id = ?
        `
        ).run(rating, notes || null, movieId, userId);
      } else {
        // Inserir novo rating
        db.prepare(
          `
          INSERT INTO movie_ratings (movie_id, user_id, rating, notes)
          VALUES (?, ?, ?, ?)
        `
        ).run(movieId, userId, rating, notes || null);
      }
    }

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
