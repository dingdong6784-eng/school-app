/*
# Create lounge schema (private two-seat app)

1. New Tables
- `lounge_rooms`: one private room per couple, with a hashed, expiring invite token.
- `lounge_room_members`: which passcode role sits in which seat (Z or A) of a room.
- `lounge_game_states`: shared state for each game and the shared movie player, one row per room and game.
- `couple_messages`: live chat messages within a room.
- `lounge_access_sessions`: one active browser session per passcode role (host, partner), stored as a hash.
- `lounge_access_attempts`: failed passcode attempts per hashed client address, used for lockouts.

2. Security
- Row level security is enabled on every table with no policies, so browsers using the public key cannot read or write any row.
- Only the server function (service role) can access these tables. Game hands and battleship fleets never leave the server.

3. Notes
- Existing data from the previous database is not copied into these tables.
- Statements are idempotent and safe to re-run.
*/

CREATE TABLE IF NOT EXISTS lounge_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_role text NOT NULL CHECK (created_by_role IN ('host', 'partner')),
  created_by_seat text NOT NULL CHECK (created_by_seat IN ('Z', 'A')),
  invite_token_hash text NOT NULL UNIQUE,
  invite_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lounge_room_members (
  room_id uuid NOT NULL REFERENCES lounge_rooms(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('host', 'partner')),
  seat text NOT NULL CHECK (seat IN ('Z', 'A')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, role),
  UNIQUE (room_id, seat)
);
CREATE INDEX IF NOT EXISTS lounge_room_members_role_joined_idx ON lounge_room_members (role, joined_at);

CREATE TABLE IF NOT EXISTS lounge_game_states (
  room_id uuid NOT NULL REFERENCES lounge_rooms(id) ON DELETE CASCADE,
  game_id text NOT NULL,
  state jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, game_id)
);

CREATE TABLE IF NOT EXISTS couple_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES lounge_rooms(id) ON DELETE CASCADE,
  author text NOT NULL CHECK (author IN ('Him', 'Her')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  reaction text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS couple_messages_room_created_idx ON couple_messages (room_id, created_at);

CREATE TABLE IF NOT EXISTS lounge_access_sessions (
  role text PRIMARY KEY CHECK (role IN ('host', 'partner')),
  token_hash text NOT NULL UNIQUE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS lounge_access_attempts (
  ip_hash text PRIMARY KEY,
  attempt_count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz
);

ALTER TABLE lounge_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE lounge_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE lounge_game_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE couple_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE lounge_access_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lounge_access_attempts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON lounge_rooms, lounge_room_members, lounge_game_states, couple_messages, lounge_access_sessions, lounge_access_attempts TO service_role;
