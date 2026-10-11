import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { Request, Response, NextFunction } from 'express'
import { UnauthorizedError } from './error-handler'
import { config } from '../config'
import { db } from '../database'

interface UserPayload {
  userId: string
  username: string
  role: string
  sessionId: string
}

interface JwtPayload extends UserPayload {
  iat: number
  exp: number
}

export interface AuthRequest extends Request {
  user?: UserPayload
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1]

  if (!token) {
    next(new UnauthorizedError('Token missing'))
    return
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload
    if (typeof decoded.userId !== 'string') throw new Error('Invalid payload')
    if (typeof decoded.sessionId !== 'string') throw new Error('Invalid session')
    const session = await db.session.findUnique({ where: { id: decoded.sessionId } })
    if (!session || session.userId !== decoded.userId || session.expiresAt <= new Date()) throw new Error('Session expired')
    const user = await db.user.findUnique({ where: { id: decoded.userId } })
    if (!user || user.status !== 'ACTIVE') throw new Error('Account is not active')
    ;(req as AuthRequest).user = { userId: user.id, username: user.username, role: user.role, sessionId: session.id }
    next()
  } catch (error) {
    next(new UnauthorizedError('Invalid token'))
  }
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest

    if (!authReq.user || authReq.user.role !== role) {
      next(new UnauthorizedError('Insufficient permissions'))
      return
    }

    next()
  }
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hashedPassword)
  } catch (error) {
    throw new Error('Password verification failed')
  }
}
