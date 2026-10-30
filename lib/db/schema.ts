import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

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
