'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { parse } from 'csv-parse/sync'
import { eq, sql } from 'drizzle-orm'
import { validateAdminCredentials, getAdminCookieName, verifyAdminToken } from '@/lib/admin'
import { db } from '@/lib/db'
import { allowedEmails, referralCodes } from '@/lib/db/schema'

async function requireAdmin () {
  const cookieStore = await cookies()
  const token = cookieStore.get(getAdminCookieName())?.value
  if (!(await verifyAdminToken(token))) {
    throw new Error('Unauthorized')
  }
}

export async function adminLogin (formData: FormData) {
  const username = (formData.get('username') as string | null)?.trim()
  const password = formData.get('password') as string | null
  if (!username || !password) {
    return { error: 'Please enter username and password.' }
  }
  const token = await validateAdminCredentials(username, password)
  if (!token) {
    return { error: 'Invalid username or password.' }
  }
  const cookieStore = await cookies()
  cookieStore.set(getAdminCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/'
  })
  redirect('/admin')
}

export async function adminLogout () {
  const cookieStore = await cookies()
  cookieStore.delete(getAdminCookieName())
  redirect('/admin')
}

function normalizeKey (s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, '')
}

function findColumn (row: Record<string, string>, ...candidates: string[]): string | undefined {
  const keys = Object.keys(row)
  for (const candidate of candidates) {
    const target = normalizeKey(candidate)
    const found = keys.find((k) => normalizeKey(k) === target)
    if (found) return row[found]?.trim()
  }
  return undefined
}

function normalizeEmail (email: string): string {
  return email.trim().toLowerCase()
}

function extractEmailsFromRawText (text: string): string[] {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []
  const unique = new Set<string>()
  for (const entry of matches) {
    unique.add(normalizeEmail(entry))
  }
  return Array.from(unique)
}

export async function upsertAllowedEmail (formData: FormData) {
  await requireAdmin()

  const rawEmail = (formData.get('email') as string | null) ?? ''
  const rawName = (formData.get('name') as string | null) ?? ''
  const email = normalizeEmail(rawEmail)
  const name = rawName.trim()

  if (!email || !email.includes('@')) {
    return { error: 'Please enter a valid email address.' }
  }

  await db.insert(allowedEmails).values({
    email,
    name: name || null
  }).onConflictDoUpdate({
    target: allowedEmails.email,
    set: { name: sql`excluded.name` }
  })

  return { success: `Saved ${email}` }
}

export async function deleteAllowedEmail (formData: FormData) {
  await requireAdmin()

  const rawEmail = (formData.get('email') as string | null) ?? ''
  const email = normalizeEmail(rawEmail)

  if (!email || !email.includes('@')) {
    return { error: 'Please enter a valid email address.' }
  }

  await db.delete(allowedEmails).where(eq(allowedEmails.email, email))
  return { success: `Removed ${email}` }
}

export async function uploadEmailsCsv (formData: FormData) {
  await requireAdmin()

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) {
    return { error: 'Please select a CSV file.' }
  }
  if (!file.name.endsWith('.csv')) {
    return { error: 'Only .csv files are supported.' }
  }

  const replace = formData.get('replace') === 'on'

  const text = await file.text()
  let records: Record<string, string>[]
  try {
    records = parse(text, { columns: true, skip_empty_lines: true, relax_column_count: true })
  } catch {
    return { error: 'Failed to parse CSV. Make sure it is a valid CSV file.' }
  }

  if (records.length === 0) {
    return { error: 'CSV has no data rows.' }
  }

  const byEmail = new Map<string, string>()
  for (const row of records) {
    const email = (
      findColumn(row, 'email') ??
      findColumn(row, 'e-mail') ??
      findColumn(row, 'email address') ??
      ''
    ).toLowerCase()
    const name =
      findColumn(row, 'name') ??
      ([findColumn(row, 'first_name', 'firstname', 'first name'), findColumn(row, 'last_name', 'lastname', 'last name')]
        .filter(Boolean)
        .join(' ')
        .trim() || '')
    if (email && email.includes('@')) {
      if (!byEmail.has(email)) byEmail.set(email, name || '')
    }
  }

  if (byEmail.size === 0) {
    const fallbackEmails = extractEmailsFromRawText(text)
    for (const email of fallbackEmails) {
      byEmail.set(email, '')
    }
  }

  if (byEmail.size === 0) {
    return { error: 'No valid emails found. Use a CSV with an "email" column or a plain one-email-per-line file.' }
  }

  const rows = Array.from(byEmail, ([email, name]) => ({ email, name: name || null }))

  if (replace) {
    await db.transaction(async (tx) => {
      await tx.delete(allowedEmails)
      await tx.insert(allowedEmails).values(rows).onConflictDoUpdate({
        target: allowedEmails.email,
        set: { name: sql`excluded.name` }
      })
    })
  } else {
    await db.insert(allowedEmails).values(rows).onConflictDoUpdate({
      target: allowedEmails.email,
      set: { name: sql`excluded.name` }
    })
  }

  redirect('/admin')
}

export async function uploadCodesCsv (formData: FormData) {
  await requireAdmin()

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) {
    return { error: 'Please select a CSV file.' }
  }
  if (!file.name.endsWith('.csv')) {
    return { error: 'Only .csv files are supported.' }
  }

  const replace = formData.get('replace') === 'on'

  const text = await file.text()
  let records: Record<string, string>[]
  try {
    records = parse(text, { columns: true, skip_empty_lines: true, relax_column_count: true })
  } catch {
    return { error: 'Failed to parse CSV. Make sure it is a valid CSV file.' }
  }

  if (records.length === 0) {
    return { error: 'CSV has no data rows.' }
  }

  const entries: Array<{ code: string; url: string }> = []
  const seen = new Set<string>()

  for (const row of records) {
    const url = findColumn(row, 'url', 'link', 'referral_url', 'referral_link')
    const codeOnly = findColumn(row, 'code', 'code_id', 'referral_code')

    let code = ''

    if (url) {
      const codeMatch = url.match(/[?&]code=([A-Za-z0-9._~-]+)/i)
      code = (codeMatch?.[1] ?? '').trim()
    } else if (codeOnly) {
      code = codeOnly
    }

    if (!code) continue
    const resolvedUrl = `https://cursor.com/referral?code=${encodeURIComponent(code)}`
    if (seen.has(code)) continue
    seen.add(code)
    entries.push({ code, url: resolvedUrl })
  }

  if (entries.length === 0) {
    return { error: 'No valid codes found. CSV must have a "code" or "url" column. Other columns are ignored.' }
  }

  if (replace) {
    await db.transaction(async (tx) => {
      await tx.delete(referralCodes)
      await tx.insert(referralCodes).values(entries.map(({ code, url }) => ({
        code,
        url,
        claimedByEmail: null
      }))).onConflictDoNothing()
    })
  } else {
    await db.insert(referralCodes).values(entries.map(({ code, url }) => ({
      code,
      url,
      claimedByEmail: null
    }))).onConflictDoNothing()
  }

  redirect('/admin')
}
