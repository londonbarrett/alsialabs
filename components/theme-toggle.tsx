'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useTheme } from 'next-themes'

const themes = ['light', 'dark', 'system'] as const
const icons: Record<string, typeof Sun> = { light: Sun, dark: Moon, system: Monitor }
const labels: Record<string, string> = { light: 'Light', dark: 'Dark', system: 'System' }

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const current = theme && (themes as readonly string[]).includes(theme)
    ? (theme as typeof themes[number])
    : 'system'
  const nextIndex = (themes.indexOf(current) + 1) % themes.length
  const nextTheme = themes[nextIndex]
  const Icon = icons[current]

  return (
    <DropdownMenuItem onClick={() => setTheme(nextTheme)}>
      <Icon />
      <span className="flex-1">{labels[current]}</span>
      <span className="text-muted-foreground text-xs">→ {labels[nextTheme]}</span>
    </DropdownMenuItem>
  )
}
