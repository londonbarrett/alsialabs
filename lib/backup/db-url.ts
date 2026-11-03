const SAFE_URL_PARAMS = [
  "sslmode",
  "options",
  "application_name",
  "connect_timeout",
] as const

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

export function sanitizeDbUrl(url: string): string {
  const parsed = new URL(url)
  const keep = new Set<string>(SAFE_URL_PARAMS)
  const queryStart = url.indexOf("?")
  if (queryStart === -1) return parsed.toString()
  const base = url.slice(0, queryStart)
  const filtered = url
    .slice(queryStart + 1)
    .split("&")
    .filter((pair) => {
      const eq = pair.indexOf("=")
      return keep.has(eq === -1 ? pair : pair.slice(0, eq))
    })
    .join("&")
  return filtered ? `${base}?${filtered}` : base
}

export function rewriteLoopbackHost(url: string): string {
  const parsed = new URL(url)
  if (LOOPBACK_HOSTS.has(parsed.hostname)) {
    parsed.hostname = "host.docker.internal"
  }
  return parsed.toString()
}
