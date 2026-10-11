import jwt from 'jsonwebtoken'
import { createHash, randomUUID } from 'crypto'
import type { Response } from 'express'
import { config } from './config'
import { db } from './database'
import { UnauthorizedError } from './middleware/error-handler'

type Member = { id: string; username: string; role: string }
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
const cookieOptions = { httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'strict' as const, path: '/api/auth' }

export async function issueSession(user: Member, res: Response, previousToken?: string) {
  const sessionId = randomUUID()
  const payload = { userId: user.id, username: user.username, role: user.role, sessionId }
  const refreshToken = jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshExpiresIn })
  const expiresAt = new Date((jwt.decode(refreshToken) as jwt.JwtPayload).exp! * 1000)
  await db.$transaction(async tx => {
    if (previousToken) {
      const removed = await tx.session.deleteMany({ where: { tokenHash: tokenHash(previousToken), userId: user.id, expiresAt: { gt: new Date() } } })
      if (removed.count !== 1) throw new UnauthorizedError('Session expired')
    }
    await tx.session.deleteMany({ where: { userId: user.id, expiresAt: { lte: new Date() } } })
    await tx.session.create({ data: { id: sessionId, userId: user.id, tokenHash: tokenHash(refreshToken), expiresAt } })
  })
  res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: Math.max(0, expiresAt.getTime() - Date.now()) })
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn })
}

export async function revokeSession(token: string | undefined, res: Response) {
  if (token) await db.session.deleteMany({ where: { tokenHash: tokenHash(token) } })
  res.clearCookie('refreshToken', cookieOptions)
}
