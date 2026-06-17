/**
 * spec:status
 * Shows the current active spec.
 */

import { readFile, readdir } from 'fs/promises'

async function getActive() {
  try {
    const active = await readFile('specs/.active', 'utf-8')
    const number = parseInt(active.trim(), 10)
    if (isNaN(number)) return null
    const files = await readdir('specs')
    const prefix = String(number).padStart(3, '0')
    const file = files.find((f) => f.startsWith(prefix) && f.endsWith('.md'))
    return file ? `specs/${file}` : null
  } catch {
    return null
  }
}

async function listSpecs() {
  try {
    const files = await readdir('specs')
    return files.filter((f) => f.endsWith('.md')).sort()
  } catch {
    return []
  }
}

try {
  const active = await getActive()
  const specs = await listSpecs()

  console.log(`\n  Specs Directory (${specs.length} file${specs.length === 1 ? '' : 's'})`)
  console.log('  ' + '─'.repeat(40))

  for (const s of specs) {
    const isActive = active?.endsWith(s)
    console.log(`  ${isActive ? '●' : '○'} ${s}${isActive ? '  ← active' : ''}`)
  }
  console.log()
} catch (err) {
  console.error('Error:', err.message)
  process.exit(1)
}
