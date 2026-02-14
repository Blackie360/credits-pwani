import { neon } from '@neondatabase/serverless'
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http'

let _db: NeonHttpDatabase | null = null
let _lastDbUrl: string | null = null

export function getDb () {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  if (!_db || _lastDbUrl !== url) {
    const sql = neon(url)
    _db = drizzle(sql)
    _lastDbUrl = url
  }
  return _db
}

const dbHandler: ProxyHandler<NeonHttpDatabase> = {
  get (_target, prop: string | symbol, receiver: object) {
    const instance = getDb()
    const value = Reflect.get(instance as object, prop, receiver)
    if (typeof value === 'function') {
      return value.bind(instance)
    }
    return value
  }
}

export const db = new Proxy({} as NeonHttpDatabase, dbHandler)
