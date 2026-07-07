'use client'

import { Languages } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useLocale } from 'next-intl'

const locales: Record<string, string> = { en: 'English', es: 'Español' }
const localeKeys = Object.keys(locales)

export function LocaleSwitcher() {
  const locale = useLocale()

  const handleSwitch = () => {
    const nextIdx = (localeKeys.indexOf(locale) + 1) % localeKeys.length
    const nextLocale = localeKeys[nextIdx]
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=${365 * 24 * 60 * 60}`
    window.location.reload()
  }

  return (
    <DropdownMenuItem onClick={handleSwitch}>
      <Languages className="mr-2 h-4 w-4" />
      <span className="flex-1">{locales[locale] ?? locale}</span>
      <span className="text-muted-foreground text-xs">→ {locales[localeKeys[(localeKeys.indexOf(locale) + 1) % localeKeys.length]]}</span>
    </DropdownMenuItem>
  )
}
