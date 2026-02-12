import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { referralCodes } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'

export async function GET () {
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(referralCodes)
    return NextResponse.json({
      connected: true,
      codesTotal: row?.count ?? 0
    })
  } catch (err) {
    return NextResponse.json(
      { connected: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
