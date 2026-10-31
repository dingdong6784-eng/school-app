import { supabase, unwrap } from "./db.ts";
import { LoungeError } from "./errors.ts";
import type { LoungeRole } from "./access.ts";
import { requireMembership } from "./rooms.ts";
import { applyGameAction, createInitialGameState, projectGameState } from "./engine.ts";
import { gameIds, type GameAction, type GameId, type PlayerSeat } from "./types.ts";

type GameRow = { state: unknown; version: number };

function assertGameId(value: unknown): GameId {
  if (typeof value !== "string" || !gameIds.includes(value as GameId)) throw new LoungeError(400, "Choose a valid game.");
  return value as GameId;
}

async function readGameRow(roomId: string, gameId: GameId) {
  return unwrap(
    await supabase
      .from("lounge_game_states")
      .select("state, version")
      .eq("room_id", roomId)
      .eq("game_id", gameId)
      .maybeSingle(),
  ) as GameRow | null;
}

async function loadGameRow(roomId: string, gameId: GameId, createdBySeat: PlayerSeat): Promise<GameRow> {
  const existing = await readGameRow(roomId, gameId);
  if (existing) return existing;

  unwrap(
    await supabase.from("lounge_game_states").upsert(
      { room_id: roomId, game_id: gameId, state: createInitialGameState(gameId, createdBySeat), version: 1 },
      { onConflict: "room_id,game_id", ignoreDuplicates: true },
    ),
  );
  const row = await readGameRow(roomId, gameId);
  if (!row) throw new LoungeError(500, "This game could not be opened.");
  return row;
}

export async function getGameView(role: LoungeRole, roomId: unknown, gameIdInput: unknown) {
  const gameId = assertGameId(gameIdInput);
  const membership = await requireMembership(role, roomId);
  const row = await loadGameRow(membership.roomId, gameId, membership.createdBySeat);
  return {
    gameId,
    version: row.version,
    playerSeat: membership.seat,
    state: projectGameState(gameId, row.state as never, membership.seat),
  };
}

export async function makeGameMove(role: LoungeRole, roomId: unknown, gameIdInput: unknown, action: GameAction) {
  const gameId = assertGameId(gameIdInput);
  const membership = await requireMembership(role, roomId);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const row = await loadGameRow(membership.roomId, gameId, membership.createdBySeat);
    const nextState = applyGameAction(gameId, row.state as never, membership.seat, action);
    const updated = unwrap(
      await supabase
        .from("lounge_game_states")
        .update({ state: nextState, version: row.version + 1, updated_at: new Date().toISOString() })
        .eq("room_id", membership.roomId)
        .eq("game_id", gameId)
        .eq("version", row.version)
        .select("state, version")
        .maybeSingle(),
    ) as GameRow | null;
    if (updated) {
      return {
        gameId,
        version: updated.version,
        playerSeat: membership.seat,
        state: projectGameState(gameId, updated.state as never, membership.seat),
      };
    }
  }
  throw new LoungeError(409, "The table changed at the same time. Please try your move again.");
}

export async function resetGame(role: LoungeRole, roomId: unknown, gameIdInput: unknown) {
  const gameId = assertGameId(gameIdInput);
  const membership = await requireMembership(role, roomId);
  const state = createInitialGameState(gameId, membership.createdBySeat);
  const updated = unwrap(
    await supabase
      .from("lounge_game_states")
      .upsert(
        { room_id: membership.roomId, game_id: gameId, state, version: 1, updated_at: new Date().toISOString() },
        { onConflict: "room_id,game_id" },
      )
      .select("state, version")
      .single(),
  ) as GameRow | null;
  if (!updated) throw new LoungeError(500, "A new round could not be started. Try again.");

  return {
    gameId,
    version: updated.version,
    playerSeat: membership.seat,
    state: projectGameState(gameId, updated.state as never, membership.seat),
  };
}
