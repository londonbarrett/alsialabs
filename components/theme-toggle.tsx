'use client'

import { Moon, Sun } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'

export function ThemeToggle() {
  const t = useTranslations('theme')
  const { resolvedTheme, setTheme } = useTheme()

  const current = resolvedTheme === 'dark' ? 'dark' : 'light'
  const next = current === 'dark' ? 'light' : 'dark'
  const icons: Record<string, typeof Sun> = { light: Sun, dark: Moon }
  const Icon = icons[current]

  return (
    <DropdownMenuItem onClick={() => setTheme(next)}>
      <Icon />
      <span className="flex-1">{t(current)}</span>
      <span className="text-muted-foreground text-xs">→ {t(next)}</span>
    </DropdownMenuItem>
  )
}
