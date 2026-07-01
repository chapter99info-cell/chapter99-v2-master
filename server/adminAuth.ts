import type { VercelRequest, VercelResponse } from '@vercel/node'

export function verifySuperAdminSession(req: VercelRequest): boolean {
  const secret = process.env.SUPER_ADMIN_SESSION_SECRET?.trim()
  if (!secret) return false
  const header = req.headers['x-admin-session']
  const value = Array.isArray(header) ? header[0] : header
  return value === secret
}

export function requireSuperAdminSession(
  req: VercelRequest,
  res: VercelResponse
): boolean {
  if (verifySuperAdminSession(req)) return true
  res.status(401).json({ error: 'Unauthorized — invalid x-admin-session' })
  return false
}
