'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { parse } from 'csv-parse/sync'
import { validateAdminCredentials, getAdminCookieName, verifyAdminToken } from '@/lib/admin'
import { db } from '@/lib/db'
import { allowedEmails, referralCodes } from '@/lib/db/schema'

async function requireAdmin () {
  const cookieStore = await cookies()
  const token = cookieStore.get(getAdminCookieName())?.value
  if (!verifyAdminToken(token)) {
    throw new Error('Unauthorized')
  }
}

export async function adminLogin (formData: FormData) {
  const username = (formData.get('username') as string | null)?.trim()
  const password = formData.get('password') as string | null
  if (!username || !password) {
    return { error: 'Please enter username and password.' }
  }
  const token = validateAdminCredentials(username, password)
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

export async function uploadEmailsCsv (formData: FormData) {
  await requireAdmin()

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) {
    return { error: 'Please select a CSV file.' }
  }
  if (!file.name.endsWith('.csv')) {
    return { error: 'Only .csv files are supported.' }
  }

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
    const email = (row.email ?? row.Email ?? '').trim().toLowerCase()
    const name = (row.name ?? row.Name ?? '').trim() ||
      [row.first_name ?? row.First_Name ?? '', row.last_name ?? row.Last_Name ?? '']
        .filter(Boolean).join(' ').trim()
    if (email && email.includes('@')) {
      if (!byEmail.has(email)) byEmail.set(email, name || '')
    }
  }

  if (byEmail.size === 0) {
    return { error: 'No valid emails found. Make sure the CSV has an "email" column.' }
  }

  let inserted = 0
  for (const [email, name] of byEmail) {
    await db.insert(allowedEmails).values({ email, name: name || null }).onConflictDoNothing()
    inserted++
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

  const codes = new Set<string>()
  for (const row of records) {
    const code = (row.code ?? row.Code ?? '').trim()
    if (code) codes.add(code)
  }

  if (codes.size === 0) {
    return { error: 'No valid codes found. Make sure the CSV has a "code" column.' }
  }

  for (const code of codes) {
    await db.insert(referralCodes).values({
      code,
      url: `https://cursor.com/referral?code=${code}`,
      claimedByEmail: null
    }).onConflictDoNothing()
  }

  redirect('/admin')
}
