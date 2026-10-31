import { supabase, unwrap } from "./db.ts";
import { LoungeError } from "./errors.ts";
import { createToken, hashToken, type LoungeRole } from "./access.ts";
import { otherSeat, type PlayerSeat } from "./types.ts";

const inviteLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const inviteTokenPattern = /^[A-Za-z0-9_-]{43}$/;
const roomIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertRoomId(roomId: unknown): string {
  if (typeof roomId !== "string" || !roomIdPattern.test(roomId)) throw new LoungeError(400, "That room could not be found.");
  return roomId;
}

export function isSeat(value: unknown): value is PlayerSeat {
  return value === "Z" || value === "A";
}

export async function requireMembership(role: LoungeRole, roomId: unknown) {
  const id = assertRoomId(roomId);
  const member = unwrap(
    await supabase.from("lounge_room_members").select("seat").eq("room_id", id).eq("role", role).maybeSingle(),
  );
  if (!member) throw new LoungeError(403, "You are not a member of this room.");
  const room = unwrap(
    await supabase.from("lounge_rooms").select("id, created_by_role, created_by_seat").eq("id", id).maybeSingle(),
  );
  if (!room) throw new LoungeError(404, "That room could not be found.");
  return {
    roomId: id,
    role,
    seat: member.seat as PlayerSeat,
    createdBySeat: room.created_by_seat as PlayerSeat,
    isOwner: room.created_by_role === role,
  };
}

export async function createRoom(role: LoungeRole, seat: unknown) {
  if (!isSeat(seat)) throw new LoungeError(400, "Choose a valid seat.");
  const token = createToken();
  const room = unwrap(
    await supabase
      .from("lounge_rooms")
      .insert({
        created_by_role: role,
        created_by_seat: seat,
        invite_token_hash: hashToken(token),
        invite_expires_at: new Date(Date.now() + inviteLifetimeMs).toISOString(),
      })
      .select("id")
      .single(),
  );
  if (!room) throw new LoungeError(500, "The private room could not be created. Please try again.");
  const memberInsert = await supabase.from("lounge_room_members").insert({ room_id: room.id, role, seat });
  if (memberInsert.error) {
    await supabase.from("lounge_rooms").delete().eq("id", room.id);
    throw new Error(memberInsert.error.message);
  }
  return { roomId: room.id, inviteToken: token };
}

export async function joinRoom(role: LoungeRole, inviteToken: unknown) {
  if (typeof inviteToken !== "string" || !inviteTokenPattern.test(inviteToken)) {
    throw new LoungeError(400, "That invitation link is not valid.");
  }
  const room = unwrap(
    await supabase
      .from("lounge_rooms")
      .select("id, created_by_role, created_by_seat, invite_expires_at")
      .eq("invite_token_hash", hashToken(inviteToken))
      .maybeSingle(),
  );
  if (!room || new Date(room.invite_expires_at).getTime() <= Date.now()) {
    throw new LoungeError(400, "That invitation has expired or is no longer available.");
  }
  if (room.created_by_role === role) throw new LoungeError(400, "Unlock with the other passcode to join your invitation.");

  const existing = unwrap(
    await supabase.from("lounge_room_members").select("room_id").eq("room_id", room.id).eq("role", role).maybeSingle(),
  );
  if (existing) return { roomId: room.id };

  const members = unwrap(await supabase.from("lounge_room_members").select("role").eq("room_id", room.id).limit(2));
  if ((members ?? []).length >= 2) throw new LoungeError(400, "Both seats in this room are already claimed.");

  unwrap(
    await supabase.from("lounge_room_members").insert({
      room_id: room.id,
      role,
      seat: otherSeat(room.created_by_seat as PlayerSeat),
    }),
  );
  return { roomId: room.id };
}

export async function getMyRoom(role: LoungeRole) {
  const membership = unwrap(
    await supabase
      .from("lounge_room_members")
      .select("room_id, seat")
      .eq("role", role)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  if (!membership) return null;

  unwrap(
    await supabase
      .from("lounge_room_members")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("room_id", membership.room_id)
      .eq("role", role)
      .lt("last_seen_at", new Date(Date.now() - 15_000).toISOString()),
  );

  const room = unwrap(
    await supabase
      .from("lounge_rooms")
      .select("id, created_by_role, created_by_seat, created_at, invite_expires_at")
      .eq("id", membership.room_id)
      .maybeSingle(),
  );
  if (!room) return null;

  const members = unwrap(
    await supabase.from("lounge_room_members").select("role, seat, joined_at, last_seen_at").eq("room_id", room.id),
  ) ?? [];
  const now = Date.now();
  return {
    id: room.id,
    currentSeat: membership.seat as PlayerSeat,
    createdBySeat: room.created_by_seat as PlayerSeat,
    isOwner: room.created_by_role === role,
    createdAt: new Date(room.created_at).toISOString(),
    inviteExpiresAt: new Date(room.invite_expires_at).toISOString(),
    members: members.map((member) => ({
      seat: member.seat as PlayerSeat,
      joinedAt: new Date(member.joined_at).toISOString(),
      online: now - new Date(member.last_seen_at).getTime() < 40_000,
      isYou: member.role === role,
    })),
  };
}

export async function rotateRoomInvite(role: LoungeRole, roomId: unknown) {
  const membership = await requireMembership(role, roomId);
  if (!membership.isOwner) throw new LoungeError(403, "Only the person who created this room can make an invitation.");

  const token = createToken();
  const updated = unwrap(
    await supabase
      .from("lounge_rooms")
      .update({
        invite_token_hash: hashToken(token),
        invite_expires_at: new Date(Date.now() + inviteLifetimeMs).toISOString(),
      })
      .eq("id", membership.roomId)
      .select("id")
      .maybeSingle(),
  );
  if (!updated) throw new LoungeError(404, "That room could not be found.");
  return { inviteToken: token };
}
