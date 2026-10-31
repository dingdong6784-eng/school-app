import { LoungeError } from "./errors.ts";
import { lockLounge, partnerPresence, requireSession, unlockLounge, userIdForRole, nameForRole } from "./access.ts";
import { createRoom, getMyRoom, joinRoom, rotateRoomInvite } from "./rooms.ts";
import { listMessages, reactToMessage, sendMessage } from "./chat.ts";
import { getGameView, makeGameMove, resetGame } from "./games.ts";
import { getMediaState, updateMediaState } from "./media.ts";
import { fetchCatalog } from "./catalog.ts";
import type { GameAction } from "./types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function dispatch(body: Record<string, unknown>, clientAddress: string) {
  const { action, token, roomId } = body;
  switch (action) {
    case "unlock":
      return unlockLounge(body.passcode, clientAddress);
    case "lock":
      return lockLounge(token);
    case "session": {
      const role = await requireSession(token);
      return { user: { id: userIdForRole(role), role, name: nameForRole(role) } };
    }
    case "presence":
      return partnerPresence(await requireSession(token));
    case "myRoom":
      return getMyRoom(await requireSession(token));
    case "createRoom":
      return createRoom(await requireSession(token), body.seat);
    case "joinRoom":
      return joinRoom(await requireSession(token), body.inviteToken);
    case "rotateInvite":
      return rotateRoomInvite(await requireSession(token), roomId);
    case "listMessages":
      return listMessages(await requireSession(token), roomId);
    case "sendMessage":
      return sendMessage(await requireSession(token), roomId, body.text);
    case "reactMessage":
      return reactToMessage(await requireSession(token), roomId, body.id, body.reaction);
    case "getGame":
      return getGameView(await requireSession(token), roomId, body.gameId);
    case "makeMove":
      return makeGameMove(await requireSession(token), roomId, body.gameId, body.move as GameAction);
    case "resetGame":
      return resetGame(await requireSession(token), roomId, body.gameId);
    case "getMedia":
      return getMediaState(await requireSession(token), roomId);
    case "updateMedia":
      return updateMediaState(await requireSession(token), roomId, body.patch);
    case "catalog": {
      await requireSession(token);
      const query = typeof body.query === "string" ? body.query.trim() : "";
      const category = typeof body.category === "string" ? body.category : "all";
      if (query.length > 80) throw new LoungeError(400, "Search is limited to 80 characters.");
      if (!["all", "romcom", "action", "horror", "family"].includes(category)) {
        throw new LoungeError(400, "Choose a valid movie category.");
      }
      return fetchCatalog(query, category, body.safe !== false);
    }
    default:
      throw new LoungeError(400, "That request is not recognized.");
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (!body || typeof body !== "object") throw new LoungeError(400, "That request is not valid.");
    const clientAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    return json(await dispatch(body, clientAddress));
  } catch (error) {
    if (error instanceof LoungeError) return json({ error: error.message }, error.status);
    console.error(error);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
