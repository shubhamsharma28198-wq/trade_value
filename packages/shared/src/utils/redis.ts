export function redisConnection(redisUrl: string, password?: string) {
  const url = new URL(redisUrl)
  if (!['redis:', 'rediss:'].includes(url.protocol)) throw new Error('Invalid Redis URL')
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: password || (url.password ? decodeURIComponent(url.password) : undefined),
    db: Number(url.pathname.slice(1) || 0),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  }
}
