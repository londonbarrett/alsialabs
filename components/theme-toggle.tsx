'use client'

import { Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/theme-provider'

const themes = ['light', 'dark', 'system'] as const
const icons = { light: Sun, dark: Moon, system: Monitor }
const labels = { light: 'Light mode', dark: 'Dark mode', system: 'System theme' }

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const current = theme as (typeof themes)[number] || 'system'
  const nextIndex = (themes.indexOf(current) + 1) % themes.length
  const nextTheme = themes[nextIndex]
  const Icon = icons[current]

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Switch to ${labels[nextTheme]}`}
      title={`Current: ${labels[current]}`}
    >
      <Icon />
    </Button>
  )
}
