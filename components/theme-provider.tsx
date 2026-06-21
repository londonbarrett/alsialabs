'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark' | 'system'

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}>({
  theme: 'system',
  setTheme: () => {},
  resolvedTheme: 'light',
})

export function useTheme() {
  return useContext(ThemeContext)
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem('theme') as Theme | null
    return stored || 'system'
  } catch {
    return 'system'
  }
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
  root.style.colorScheme = resolved
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = getStoredTheme()
    setThemeState(stored)
    const resolved = stored === 'system' ? getSystemTheme() : stored
    setResolvedTheme(resolved)
    applyTheme(stored)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (theme === 'system') {
        const sys = getSystemTheme()
        setResolvedTheme(sys)
        applyTheme('system')
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme, mounted])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    const resolved = newTheme === 'system' ? getSystemTheme() : newTheme
    setResolvedTheme(resolved)
    localStorage.setItem('theme', newTheme)
    applyTheme(newTheme)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
