import { z } from 'zod'

export const emailSchema = z.string().email({ message: 'Invalid email format' })

export function validateEmail(email: string): boolean {
  try {
    emailSchema.parse(email)
    return true
  } catch {
    return false
  }
}