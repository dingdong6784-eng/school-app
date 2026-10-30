import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const coupleMessages = pgTable(
  'couple_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roomId: text('room_id').notNull().default('z-k-lounge'),
    author: text('author').notNull(),
    body: text('body').notNull(),
    reaction: text('reaction'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [index('couple_messages_room_created_idx').on(table.roomId, table.createdAt)],
)

export const loungeRooms = pgTable(
  'lounge_rooms',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    createdByUserId: text('created_by_user_id').notNull(),
    createdBySeat: text('created_by_seat').notNull(),
    inviteTokenHash: text('invite_token_hash').notNull(),
    inviteExpiresAt: timestamp('invite_expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
)

export const loungeRoomMembers = pgTable(
  'lounge_room_members',
  {
    roomId: uuid('room_id').notNull().references(() => loungeRooms.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    seat: text('seat').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('lounge_room_members_user_joined_idx').on(table.userId, table.joinedAt),
    index('lounge_room_members_room_seen_idx').on(table.roomId, table.lastSeenAt),
  ],
)

export const loungeGameStates = pgTable(
  'lounge_game_states',
  {
    roomId: uuid('room_id').notNull().references(() => loungeRooms.id, { onDelete: 'cascade' }),
    gameId: text('game_id').notNull(),
    state: jsonb('state').notNull(),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [index('lounge_game_states_updated_idx').on(table.roomId, table.updatedAt)],
)
