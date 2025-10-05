// Serviço para buscar filmes na API do TMDB
// API Key gratuita - requer registro em https://www.themoviedb.org/settings/api

const TMDB_API_KEY = process.env.TMDB_API_KEY || ""; // Adicionar no .env
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

/**
 * Busca filmes por título
 * @param {string} query - Título do filme
 * @param {number} page - Página de resultados (padrão: 1)
 * @returns {Promise<Object>} Resultados da busca
 */
export async function searchMovies(query, page = 1) {
  if (!query) {
    throw new Error("Query é obrigatória");
  }

  const url = new URL(`${TMDB_BASE_URL}/search/movie`);
  url.searchParams.append("api_key", TMDB_API_KEY);
  url.searchParams.append("query", query);
  url.searchParams.append("page", page);
  url.searchParams.append("language", "pt-BR");
  url.searchParams.append("include_adult", "false");

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();

    // Formatar resultados
    return {
      results: data.results.map((movie) => ({
        id: movie.id,
        title: movie.title,
        originalTitle: movie.original_title,
        year: movie.release_date
          ? new Date(movie.release_date).getFullYear()
          : null,
        releaseDate: movie.release_date,
        overview: movie.overview,
        posterPath: movie.poster_path
          ? `${TMDB_IMAGE_BASE}/w500${movie.poster_path}`
          : null,
        posterThumbnail: movie.poster_path
          ? `${TMDB_IMAGE_BASE}/w200${movie.poster_path}`
          : null,
        backdropPath: movie.backdrop_path
          ? `${TMDB_IMAGE_BASE}/original${movie.backdrop_path}`
          : null,
        voteAverage: movie.vote_average,
        popularity: movie.popularity,
      })),
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
    };
  } catch (error) {
    console.error("Erro ao buscar filmes no TMDB:", error);
    throw error;
  }
}

/**
 * Busca detalhes de um filme específico
 * @param {number} movieId - ID do filme no TMDB
 * @returns {Promise<Object>} Detalhes do filme
 */
export async function getMovieDetails(movieId) {
  const url = new URL(`${TMDB_BASE_URL}/movie/${movieId}`);
  url.searchParams.append("api_key", TMDB_API_KEY);
  url.searchParams.append("language", "pt-BR");

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const movie = await response.json();

    return {
      id: movie.id,
      title: movie.title,
      originalTitle: movie.original_title,
      year: movie.release_date
        ? new Date(movie.release_date).getFullYear()
        : null,
      releaseDate: movie.release_date,
      overview: movie.overview,
      posterPath: movie.poster_path
        ? `${TMDB_IMAGE_BASE}/w500${movie.poster_path}`
        : null,
      backdropPath: movie.backdrop_path
        ? `${TMDB_IMAGE_BASE}/original${movie.backdrop_path}`
        : null,
      runtime: movie.runtime,
      genres: movie.genres,
      voteAverage: movie.vote_average,
      voteCount: movie.vote_count,
      tagline: movie.tagline,
    };
  } catch (error) {
    console.error("Erro ao buscar detalhes do filme no TMDB:", error);
    throw error;
  }
}

/**
 * Verifica se a API Key está configurada
 */
export function isApiConfigured() {
  return Boolean(TMDB_API_KEY);
}
