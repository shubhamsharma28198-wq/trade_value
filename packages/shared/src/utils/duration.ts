export function parseDuration(durationStr: string): number {
  const match = durationStr.match(/^(\d+)([smhd])$/)
  if (!match) {
    throw new Error(`Invalid duration format: ${durationStr}`)
  }
  const value = parseInt(match[1])
  const unit = match[2]

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  }

  return value * multipliers[unit as keyof typeof multipliers]
}

export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) return '1s'
  if (milliseconds < 60 * 1000) {
    const seconds = Math.ceil(milliseconds / 1000)
    return `${seconds}s`
  }
  if (milliseconds < 60 * 60 * 1000) {
    const minutes = Math.ceil(milliseconds / (60 * 1000))
    return `${minutes}m`
  }
  if (milliseconds < 24 * 60 * 60 * 1000) {
    const hours = Math.ceil(milliseconds / (60 * 60 * 1000))
    return `${hours}h`
  }

  const days = Math.ceil(milliseconds / (24 * 60 * 60 * 1000))
  return `${days}d`
}