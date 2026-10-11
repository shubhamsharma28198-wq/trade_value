export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') return ''
  return input
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
}

export function maskEmail(email: string): string {
  const [username, domain] = email.split('@')
  if (username.length <= 2) return `**@${domain}`
  const maskedUsername = `*${'*'.repeat(Math.min(username.length - 1, 3))}`
  return `${maskedUsername}@${domain}`
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.substring(0, length) + '...'
}