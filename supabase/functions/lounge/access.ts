import { createHash, createHmac, randomBytes } from "node:crypto";
import { serviceRoleKey, supabase, unwrap } from "./db.ts";
import { LoungeError } from "./errors.ts";

export type LoungeRole = "host" | "partner";

const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const presenceWindowMs = 45_000;
const maxAttempts = 5;
const attemptWindowMs = 15 * 60 * 1000;
const lockoutMs = 15 * 60 * 1000;

export function createToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function userIdForRole(role: LoungeRole) {
  return `lounge-${role}`;
}

export function nameForRole(role: LoungeRole) {
  return role === "host" ? "Host" : "Partner";
}

function isTokenShape(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export async function requireSession(token: unknown): Promise<LoungeRole> {
  if (!isTokenShape(token)) throw new LoungeError(401, "Unlock the lounge to continue.");
  const now = new Date();
  const tokenHash = hashToken(token);
  const session = unwrap(
    await supabase
      .from("lounge_access_sessions")
      .select("role, last_seen_at")
      .eq("token_hash", tokenHash)
      .gt("expires_at", now.toISOString())
      .maybeSingle(),
  );
  if (!session || (session.role !== "host" && session.role !== "partner")) {
    throw new LoungeError(401, "Unlock the lounge to continue.");
  }
  if (new Date(session.last_seen_at).getTime() < now.getTime() - 15_000) {
    unwrap(
      await supabase
        .from("lounge_access_sessions")
        .update({ last_seen_at: now.toISOString() })
        .eq("token_hash", tokenHash),
    );
  }
  return session.role;
}

function attemptKey(clientAddress: string) {
  return createHmac("sha256", serviceRoleKey).update(clientAddress).digest("hex");
}

async function recordFailedAttempt(ipHash: string, now: Date) {
  const existing = unwrap(
    await supabase
      .from("lounge_access_attempts")
      .select("attempt_count, window_started_at, locked_until")
      .eq("ip_hash", ipHash)
      .maybeSingle(),
  );
  const inWindow = existing !== null && new Date(existing.window_started_at).getTime() > now.getTime() - attemptWindowMs;
  const attemptCount = existing && inWindow ? existing.attempt_count + 1 : 1;
  let lockedUntil: string | null = null;
  if (attemptCount >= maxAttempts) lockedUntil = new Date(now.getTime() + lockoutMs).toISOString();
  else if (existing && inWindow) lockedUntil = existing.locked_until;

  unwrap(
    await supabase.from("lounge_access_attempts").upsert({
      ip_hash: ipHash,
      attempt_count: attemptCount,
      window_started_at: existing && inWindow ? existing.window_started_at : now.toISOString(),
      locked_until: lockedUntil,
    }),
  );
}

export async function unlockLounge(passcode: unknown, clientAddress: string) {
  if (typeof passcode !== "string" || !/^\d{4}$/.test(passcode)) {
    return { ok: false, message: "Enter your four-digit passcode." };
  }

  const ipHash = attemptKey(clientAddress);
  const now = new Date();
  const attempt = unwrap(
    await supabase.from("lounge_access_attempts").select("locked_until").eq("ip_hash", ipHash).maybeSingle(),
  );
  if (attempt?.locked_until && new Date(attempt.locked_until) > now) {
    const minutes = Math.max(1, Math.ceil((new Date(attempt.locked_until).getTime() - now.getTime()) / 60_000));
    return { ok: false, message: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` };
  }

  const hostCode = Deno.env.get("LOUNGE_HOST_PASSCODE") ?? "";
  const partnerCode = Deno.env.get("LOUNGE_PARTNER_PASSCODE") ?? "";
  if (!/^\d{4}$/.test(hostCode) || !/^\d{4}$/.test(partnerCode) || hostCode === partnerCode) {
    return { ok: false, message: "Lounge access is not configured. Please check the passcode settings." };
  }

  const role: LoungeRole | null = passcode === hostCode ? "host" : passcode === partnerCode ? "partner" : null;
  if (!role) {
    await recordFailedAttempt(ipHash, now);
    return { ok: false, message: "That passcode didn’t match. Please try again." };
  }

  const token = createToken();
  const expiresAt = new Date(now.getTime() + sessionLifetimeMs);
  const values = {
    token_hash: hashToken(token),
    last_seen_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  const inserted = await supabase.from("lounge_access_sessions").insert({ role, ...values }).select("role");
  let reserved = !inserted.error && (inserted.data?.length ?? 0) > 0;
  if (inserted.error && inserted.error.code !== "23505") throw new Error(inserted.error.message);
  if (!reserved) {
    const replaced = unwrap(
      await supabase
        .from("lounge_access_sessions")
        .update(values)
        .eq("role", role)
        .lte("expires_at", now.toISOString())
        .select("role"),
    );
    reserved = (replaced?.length ?? 0) > 0;
  }
  if (!reserved) {
    return { ok: false, message: "That passcode is already active in another browser. Lock that session first." };
  }

  unwrap(await supabase.from("lounge_access_attempts").delete().eq("ip_hash", ipHash));
  return { ok: true, token, user: { id: userIdForRole(role), role, name: nameForRole(role) } };
}

export async function lockLounge(token: unknown) {
  if (isTokenShape(token)) {
    unwrap(await supabase.from("lounge_access_sessions").delete().eq("token_hash", hashToken(token)));
  }
  return { ok: true };
}

export async function partnerPresence(role: LoungeRole) {
  const partnerRole = role === "host" ? "partner" : "host";
  const partner = unwrap(
    await supabase.from("lounge_access_sessions").select("last_seen_at, expires_at").eq("role", partnerRole).maybeSingle(),
  );
  const now = Date.now();
  return {
    partnerOnline: Boolean(
      partner &&
        new Date(partner.expires_at).getTime() > now &&
        now - new Date(partner.last_seen_at).getTime() < presenceWindowMs,
    ),
  };
}
