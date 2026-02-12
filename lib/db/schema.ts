import { pgTable, text, serial } from 'drizzle-orm/pg-core'

export const allowedEmails = pgTable('allowed_emails', {
  email: text('email').primaryKey().notNull(),
  name: text('name')
})

export const referralCodes = pgTable('referral_codes', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  url: text('url').notNull(),
  claimedByEmail: text('claimed_by_email')
})
