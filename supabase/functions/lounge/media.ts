import { supabase, unwrap } from "./db.ts";
import { LoungeError } from "./errors.ts";
import { userIdForRole, type LoungeRole } from "./access.ts";
import { requireMembership } from "./rooms.ts";
import { defaultLoungeMediaState, type CatalogMovie, type LoungeMediaState } from "./types.ts";

const mediaStateId = "watch-party-media";

function normalizeStreamUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;
    const hostname = url.hostname.toLowerCase();
    const videoFile = /\.(mp4|webm|ogg)$/i.test(url.pathname);
    if (videoFile) return url.toString();

    if (hostname === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      return videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId) ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;
    }
    if (hostname === "youtube.com" || hostname === "www.youtube.com" || hostname === "youtube-nocookie.com" || hostname === "www.youtube-nocookie.com") {
      const videoId = url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/)?.[1];
      return videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId) ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;
    }
    if (hostname === "player.vimeo.com" && /^\/video\/\d+/.test(url.pathname)) return url.toString();
    return null;
  } catch {
    return null;
  }
}

function normalizeSelectedMovie(value: unknown): CatalogMovie | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== "object") return undefined;
  const movie = value as Partial<CatalogMovie>;
  if (!Number.isSafeInteger(movie.id) || (movie.mediaType !== "movie" && movie.mediaType !== "tv")) return undefined;
  if (typeof movie.title !== "string" || movie.title.trim().length < 1 || movie.title.length > 180) return undefined;
  if (typeof movie.year !== "string" || movie.year.length > 8) return undefined;
  if (typeof movie.overview !== "string" || movie.overview.length > 1000) return undefined;
  if (!Array.isArray(movie.genres) || movie.genres.length > 12 || movie.genres.some((genre) => typeof genre !== "string" || genre.length > 50)) return undefined;
  const isImageUrl = (url: unknown) => url === null || (typeof url === "string" && url.startsWith("https://image.tmdb.org/t/p/") && url.length < 300);
  if (!isImageUrl(movie.posterUrl) || !isImageUrl(movie.backdropUrl)) return undefined;
  if (movie.voteAverage !== null && (typeof movie.voteAverage !== "number" || !Number.isFinite(movie.voteAverage))) return undefined;
  if (movie.certification !== null && (typeof movie.certification !== "string" || movie.certification.length > 20)) return undefined;
  return {
    id: movie.id as number,
    mediaType: movie.mediaType,
    title: movie.title.trim(),
    year: movie.year,
    overview: movie.overview,
    genres: movie.genres,
    posterUrl: movie.posterUrl ?? null,
    backdropUrl: movie.backdropUrl ?? null,
    voteAverage: movie.voteAverage ?? null,
    certification: movie.certification ?? null,
  };
}

function validatePatch(patch: unknown): Partial<LoungeMediaState> {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new LoungeError(400, "That player update is not valid.");
  const input = patch as Record<string, unknown>;
  const result: Partial<LoungeMediaState> = {};

  if ("selected" in input) {
    const selected = normalizeSelectedMovie(input.selected);
    if (selected === undefined) throw new LoungeError(400, "Choose a valid catalog title.");
    result.selected = selected;
  }
  if ("streamUrl" in input) {
    if (input.streamUrl === "") result.streamUrl = "";
    else {
      const normalized = normalizeStreamUrl(input.streamUrl);
      if (!normalized) throw new LoungeError(400, "Use a secure YouTube, Vimeo, or direct video link that you can access.");
      result.streamUrl = normalized;
    }
  }
  if ("currentTime" in input) {
    if (typeof input.currentTime !== "number" || !Number.isFinite(input.currentTime) || input.currentTime < 0 || input.currentTime > 86_400) {
      throw new LoungeError(400, "That playback position is not valid.");
    }
    result.currentTime = input.currentTime;
  }
  if ("isPlaying" in input) {
    if (typeof input.isPlaying !== "boolean") throw new LoungeError(400, "That playback state is not valid.");
    result.isPlaying = input.isPlaying;
  }
  if ("syncEnabled" in input) {
    if (typeof input.syncEnabled !== "boolean") throw new LoungeError(400, "That sync setting is not valid.");
    result.syncEnabled = input.syncEnabled;
  }
  if (Object.keys(result).length === 0) throw new LoungeError(400, "That player update is empty.");
  return result;
}

function fromStoredState(value: unknown, version: number, updatedAt: string | null): LoungeMediaState {
  const stored = value && typeof value === "object" ? value as Partial<LoungeMediaState> : {};
  const selected = normalizeSelectedMovie(stored.selected);
  return {
    ...defaultLoungeMediaState,
    selected: selected === undefined ? null : selected,
    streamUrl: typeof stored.streamUrl === "string" ? normalizeStreamUrl(stored.streamUrl) ?? "" : "",
    currentTime: typeof stored.currentTime === "number" && Number.isFinite(stored.currentTime) ? Math.max(0, Math.min(86_400, stored.currentTime)) : 0,
    isPlaying: stored.isPlaying === true,
    syncEnabled: stored.syncEnabled !== false,
    updatedByUserId: typeof stored.updatedByUserId === "string" ? stored.updatedByUserId : null,
    version,
    updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null,
  };
}

export async function getMediaState(role: LoungeRole, roomId: unknown) {
  const membership = await requireMembership(role, roomId);
  const row = unwrap(
    await supabase
      .from("lounge_game_states")
      .select("state, version, updated_at")
      .eq("room_id", membership.roomId)
      .eq("game_id", mediaStateId)
      .maybeSingle(),
  );
  return row ? fromStoredState(row.state, row.version, row.updated_at) : defaultLoungeMediaState;
}

export async function updateMediaState(role: LoungeRole, roomId: unknown, patch: unknown) {
  const membership = await requireMembership(role, roomId);
  const safePatch = { ...validatePatch(patch), updatedByUserId: userIdForRole(role) };
  const current = unwrap(
    await supabase
      .from("lounge_game_states")
      .select("state, version")
      .eq("room_id", membership.roomId)
      .eq("game_id", mediaStateId)
      .maybeSingle(),
  );
  const previous = current ? { ...defaultLoungeMediaState, ...(current.state as object) } : defaultLoungeMediaState;
  const saved = unwrap(
    await supabase
      .from("lounge_game_states")
      .upsert(
        {
          room_id: membership.roomId,
          game_id: mediaStateId,
          state: { ...previous, ...safePatch },
          version: (current?.version ?? 0) + 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "room_id,game_id" },
      )
      .select("state, version, updated_at")
      .single(),
  );
  if (!saved) throw new LoungeError(500, "The player could not be updated.");
  return fromStoredState(saved.state, saved.version, saved.updated_at);
}
