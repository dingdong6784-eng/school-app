import { LoungeError } from "./errors.ts";
import type { CatalogMovie, MovieMediaType } from "./types.ts";

const tmdbBaseUrl = "https://api.themoviedb.org/3";
const imageBaseUrl = "https://image.tmdb.org/t/p";
const genreNames: Record<number, string> = {
  12: "Adventure", 14: "Fantasy", 16: "Animation", 18: "Drama", 27: "Horror",
  28: "Action", 35: "Comedy", 36: "History", 37: "Western", 53: "Thriller",
  80: "Crime", 99: "Documentary", 878: "Science Fiction", 9648: "Mystery",
  10402: "Music", 10749: "Romance", 10751: "Family", 10752: "War", 10759: "Action & Adventure",
  10762: "Kids", 10763: "News", 10764: "Reality", 10765: "Sci-Fi & Fantasy",
  10766: "Soap", 10767: "Talk", 10768: "War & Politics", 10770: "TV Movie",
};
const safeMovieRatings = new Set(["G", "PG", "PG-13"]);
const safeTvRatings = new Set(["TV-Y", "TV-Y7", "TV-G", "TV-PG", "TV-14"]);
const discoverGenres: Record<string, string> = {
  romcom: "10749,35",
  action: "28",
  horror: "27",
  family: "10751,16",
};

type TmdbRawItem = {
  id: number;
  media_type?: MovieMediaType | "person";
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  genre_ids?: number[];
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  adult?: boolean;
};

type TmdbResponse = { results?: TmdbRawItem[] };

async function tmdbFetch<T>(path: string, parameters: Record<string, string>, apiKey: string): Promise<T> {
  const url = new URL(`${tmdbBaseUrl}${path}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "en-US");
  Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error("TMDB request failed");
  return response.json() as Promise<T>;
}

async function getUsCertification(item: TmdbRawItem, mediaType: MovieMediaType, apiKey: string) {
  if (mediaType === "movie") {
    const data = await tmdbFetch<{ results?: Array<{ iso_3166_1: string; release_dates?: Array<{ certification?: string }> }> }>(
      `/movie/${item.id}/release_dates`, {}, apiKey,
    );
    const usRelease = data.results?.find((country) => country.iso_3166_1 === "US");
    return usRelease?.release_dates?.map((entry) => entry.certification?.trim()).find(Boolean) ?? null;
  }

  const data = await tmdbFetch<{ results?: Array<{ iso_3166_1: string; rating?: string }> }>(
    `/tv/${item.id}/content_ratings`, {}, apiKey,
  );
  return data.results?.find((country) => country.iso_3166_1 === "US")?.rating?.trim() || null;
}

async function withConcurrency<T, R>(items: T[], limit: number, mapItem: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += limit) {
    results.push(...await Promise.all(items.slice(index, index + limit).map(mapItem)));
  }
  return results;
}

function isAllowedRating(rating: string | null, mediaType: MovieMediaType) {
  return rating !== null && (mediaType === "movie" ? safeMovieRatings.has(rating) : safeTvRatings.has(rating));
}

function toCatalogMovie(item: TmdbRawItem, mediaType: MovieMediaType, certification: string | null): CatalogMovie {
  const releaseDate = mediaType === "movie" ? item.release_date : item.first_air_date;
  return {
    id: item.id,
    mediaType,
    title: mediaType === "movie" ? item.title?.trim() || "Untitled film" : item.name?.trim() || "Untitled series",
    year: releaseDate?.slice(0, 4) || "—",
    overview: item.overview?.trim() || "A new pick for your next movie night.",
    genres: (item.genre_ids ?? []).map((id) => genreNames[id]).filter(Boolean),
    posterUrl: item.poster_path ? `${imageBaseUrl}/w500${item.poster_path}` : null,
    backdropUrl: item.backdrop_path ? `${imageBaseUrl}/w1280${item.backdrop_path}` : null,
    voteAverage: typeof item.vote_average === "number" ? Math.round(item.vote_average * 10) / 10 : null,
    certification,
  };
}

export async function fetchCatalog(query: string, category: string, safeMode: boolean) {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) throw new LoungeError(503, "Movie catalog is not configured.");

  try {
    let rawItems: TmdbRawItem[];
    if (query) {
      const result = await tmdbFetch<TmdbResponse>("/search/multi", { query, include_adult: "false", page: "1" }, apiKey);
      rawItems = (result.results ?? []).filter((item) => item.media_type === "movie" || item.media_type === "tv").slice(0, 20) as TmdbRawItem[];
    } else if (category === "all") {
      const [movies, shows] = await Promise.all([
        tmdbFetch<TmdbResponse>("/trending/movie/week", { page: "1" }, apiKey),
        tmdbFetch<TmdbResponse>("/trending/tv/week", { page: "1" }, apiKey),
      ]);
      rawItems = [
        ...(movies.results ?? []).map((item) => ({ ...item, media_type: "movie" as const })),
        ...(shows.results ?? []).map((item) => ({ ...item, media_type: "tv" as const })),
      ].slice(0, 20);
    } else {
      const discoverParams: Record<string, string> = {
        with_genres: discoverGenres[category],
        sort_by: "popularity.desc",
        include_adult: "false",
        page: "1",
      };
      if (safeMode) {
        discoverParams.certification_country = "US";
        discoverParams["certification.lte"] = "PG-13";
      }
      const result = await tmdbFetch<TmdbResponse>("/discover/movie", discoverParams, apiKey);
      rawItems = (result.results ?? []).map((item) => ({ ...item, media_type: "movie" as const })).slice(0, 20);
    }

    const typedItems = rawItems
      .filter((item): item is TmdbRawItem & { media_type: MovieMediaType } => item.media_type === "movie" || item.media_type === "tv")
      .filter((item) => item.adult !== true);
    const ratedItems = safeMode
      ? await withConcurrency(typedItems, 5, async (item) => {
          try {
            const certification = await getUsCertification(item, item.media_type, apiKey);
            return { item, certification, allowed: isAllowedRating(certification, item.media_type) };
          } catch {
            return { item, certification: null, allowed: false };
          }
        })
      : typedItems.map((item) => ({ item, certification: null, allowed: true }));

    const items = ratedItems
      .filter((result) => result.allowed)
      .map(({ item, certification }) => toCatalogMovie(item, item.media_type, certification));
    return { items, safeMode };
  } catch (error) {
    if (error instanceof LoungeError) throw error;
    throw new LoungeError(502, "The movie catalog is temporarily unavailable. Please try again.");
  }
}
