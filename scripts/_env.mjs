/**
 * Loads env vars from .env.local (for CLI scripts).
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

export function loadEnv() {
  const envPath = resolve('.env.local')
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      let value = trimmed.slice(eqIdx + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  }

  return {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GITHUB_REPO: process.env.GITHUB_REPO,
  }
}
