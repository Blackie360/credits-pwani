import { createHash, timingSafeEqual } from 'node:crypto'

const ADMIN_COOKIE = 'admin_session'
const TOKEN_LENGTH = 32

function safeEqual (a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

function getToken (username: string, password: string): string {
  return createHash('sha256')
    .update(`${username}:${password}`)
    .digest('hex')
    .slice(0, TOKEN_LENGTH)
}

export function verifyAdminToken (token: string | undefined): boolean {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD
  if (!username || !password) return false
  if (!token || token.length !== TOKEN_LENGTH) return false
  const expected = getToken(username, password)
  try {
    return timingSafeEqual(
      Buffer.from(token, 'hex'),
      Buffer.from(expected, 'hex')
    )
  } catch {
    return false
  }
}

export function validateAdminCredentials (username: string, password: string): string | null {
  const envUsername = process.env.ADMIN_USERNAME
  const envPassword = process.env.ADMIN_PASSWORD
  if (!envUsername || !envPassword) return null
  if (!safeEqual(username, envUsername)) return null
  if (!safeEqual(password, envPassword)) return null
  return getToken(username, password)
}

export function getAdminCookieName (): string {
  return ADMIN_COOKIE
}
