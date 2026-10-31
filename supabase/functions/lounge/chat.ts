import { supabase, unwrap } from "./db.ts";
import { LoungeError } from "./errors.ts";
import type { LoungeRole } from "./access.ts";
import { requireMembership } from "./rooms.ts";

const quickReactions = ["❤️", "🍿", "🎮", "😮", "😂"];
const messageIdPattern = /^[0-9a-f-]{36}$/i;
const messageColumns = "id, author, body, reaction, created_at";

function authorForSeat(seat: "Z" | "A") {
  return seat === "Z" ? "Him" : "Her";
}

function toClientMessage(row: { id: string; author: string; body: string; reaction: string | null; created_at: string }) {
  return { id: row.id, author: row.author, body: row.body, reaction: row.reaction, createdAt: new Date(row.created_at).toISOString() };
}

export async function listMessages(role: LoungeRole, roomId: unknown) {
  const membership = await requireMembership(role, roomId);
  const rows = unwrap(
    await supabase
      .from("couple_messages")
      .select(messageColumns)
      .eq("room_id", membership.roomId)
      .order("created_at", { ascending: false })
      .limit(100),
  ) ?? [];
  return rows.reverse().map(toClientMessage);
}

export async function sendMessage(role: LoungeRole, roomId: unknown, text: unknown) {
  const membership = await requireMembership(role, roomId);
  if (typeof text !== "string") throw new LoungeError(400, "Messages must be plain text.");
  const body = text.trim();
  if (!body || body.length > 1000) throw new LoungeError(400, "Messages must be between 1 and 1000 characters.");

  const row = unwrap(
    await supabase
      .from("couple_messages")
      .insert({ room_id: membership.roomId, author: authorForSeat(membership.seat), body })
      .select(messageColumns)
      .single(),
  );
  if (!row) throw new LoungeError(500, "The message could not be sent.");
  return toClientMessage(row);
}

export async function reactToMessage(role: LoungeRole, roomId: unknown, id: unknown, reaction: unknown) {
  const membership = await requireMembership(role, roomId);
  if (typeof id !== "string" || !messageIdPattern.test(id) || typeof reaction !== "string" || !quickReactions.includes(reaction)) {
    throw new LoungeError(400, "That reaction is not available.");
  }

  const updated = unwrap(
    await supabase
      .from("couple_messages")
      .update({ reaction })
      .eq("id", id)
      .eq("room_id", membership.roomId)
      .select("id, reaction")
      .maybeSingle(),
  );
  return updated ?? null;
}
