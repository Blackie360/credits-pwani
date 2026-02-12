import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'csv-parse/sync'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { allowedEmails, referralCodes } from '../lib/db/schema'

const REFERRAL_CODES = [
  'ZCS5PIUVIIPX', 'HQFPL0CI3JW0', 'ZD3ZSDPV98L', 'XBAXE5XDUVUK', 'TTKCY0H52VMT',
  '2PMDE87YNWYR', 'EKBP9A02YSWE', 'A661M6YSPBX', '87KQ7IDMKRCA', 'R96DRZIAAQO2',
  'ZBURJAOQEIJN', 'DSZ5GKRG784K', '0P2JZX7APKMG', 'Z5BXCL7YIRNA', 'L282XP1FSPIC',
  'CHEHE4NLKXG', 'XD6PZ2RYXUNZ', 'GXY9RKUDWYWU', 'XBKXJME0VUC1', 'ETZSW90QKPS',
  'NB4HQPTBLETB', 'KQZIT2KRY9QD', 'XEUSTIH4NHX', 'MZWRU3BGNLWG', '3VMM79K5ZJ8X',
  'CTVF10BEPU78', 'YCS1CDWNFZ2S', 'K1NZW439PUMW', 'XNXUNOJYMQDY', 'PWSKXR1FAB0D',
  'F8IQJXDZ0KZV', 'UVDXNLPREXYB', '99MT1JBJUNEN', '3MHGBC7DG6EU', 'VYQCTU4FLNCY',
  'VLHV0C2GRYQS', 'CVUZK0BO7PQ', 'VGDX3OXJVEAX', 'TDKBYID5IJM', 'EVTIRP4JIKUO',
  'VDDKAXYQDDJ', 'F3V0OETNMVM2', 'VMC9DGWABMA', 'HWHGSEXGSVP5', 'Q6QXYCNILKTN',
  'UP9JHIETWNQ', 'AMS0UXBM7MP', 'L85X8AXL0CH9', 'QP9QKXD9UDFG', 'JWNXRIKUWCYI',
  '04NWEDBJZP3', '4B9WTZRCM37G', 'CQBR5MUXXUOZ', 'A4WPD1EQN7MW', '1VN4DLJB0F',
  'MWHFVALHCDVN', 'KOF0UFEUGHW', '7FKXSOCBLJFS', 'TBY4KNRQNV1Z', 'MTLIQNWQ2JDW',
  'EGR2KLKYUK3T', 'R4156YNQNCWA', 'TGLTN3SIIND', 'AGLHD57DIHS', '5A1UFFVLSS5S',
  'CLFLXO9EL8R', 'PED94CPB3ZCJ', '9QZ8GV7RV3AY', 'CMLJUGUCY6L', '2GTMLLIE9YVG',
  'SQPSKZ0QQZKX', 'FLDS6BYSNCQY', 'NPWJFKARQPHB', 'VZB4WMYSBMZQ', '9RPSB2NUUYSB'
]

const CSV_PATH = path.join(
  process.cwd(),
  'public',
  'Cursor Kenya Pwani Meetup - Guests - 2026-02-12-12-36-41.csv'
)

async function seed () {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }

  const sql = neon(connectionString)
  const db = drizzle(sql)

  console.log('Seeding referral codes...')
  for (const code of REFERRAL_CODES) {
    await db.insert(referralCodes).values({
      code,
      url: `https://cursor.com/referral?code=${code}`,
      claimedByEmail: null
    }).onConflictDoNothing()
  }
  console.log(`Inserted ${REFERRAL_CODES.length} referral codes`)

  console.log('Reading CSV for allowed emails...')
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8')
  const records = parse(csvContent, { columns: true, skip_empty_lines: true }) as Record<string, string>[]
  const byEmail = new Map<string, string>()
  for (const row of records) {
    const email = (row.email ?? row.Email ?? '').trim().toLowerCase()
    const name = (row.name ?? '').trim() || [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
    if (email && email.includes('@')) {
      if (!byEmail.has(email)) byEmail.set(email, name || '')
    }
  }

  console.log(`Found ${byEmail.size} unique emails in CSV`)
  for (const [email, name] of byEmail) {
    await db.insert(allowedEmails).values({ email, name: name || null }).onConflictDoUpdate({
      target: allowedEmails.email,
      set: { name: name || null }
    })
  }
  console.log('Seeding complete.')
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
