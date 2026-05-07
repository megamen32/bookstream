import type { AccentTheme, ReaderTheme } from '@/lib/store'

interface ThemeConfig {
  name: string
  label: string
  vars: {
    '--r-bg': string
    '--r-bg-secondary': string
    '--r-text': string
    '--r-text-secondary': string
    '--r-border': string
  }
}

interface AccentThemeConfig {
  name: AccentTheme
  label: string
  description: string
  vars: {
    '--user-accent': string
    '--user-accent-foreground': string
    '--user-accent-soft': string
    '--user-accent-border': string
    '--user-accent-text': string
  }
}

export const themes: Record<ReaderTheme, ThemeConfig> = {
  light: {
    name: 'light',
    label: 'Светлая',
    vars: {
      '--r-bg': '#ffffff',
      '--r-bg-secondary': '#f8f8f8',
      '--r-text': '#1a1a1a',
      '--r-text-secondary': '#666666',
      '--r-border': '#e0e0e0',
    },
  },
  sepia: {
    name: 'sepia',
    label: 'Сепия',
    vars: {
      '--r-bg': '#fdf6e3',
      '--r-bg-secondary': '#f5edd3',
      '--r-text': '#5c4b37',
      '--r-text-secondary': '#8b7355',
      '--r-border': '#d4c5a9',
    },
  },
  dark: {
    name: 'dark',
    label: 'Тёмная',
    vars: {
      '--r-bg': '#1a1a2e',
      '--r-bg-secondary': '#232340',
      '--r-text': '#e0e0e0',
      '--r-text-secondary': '#a0a0b0',
      '--r-border': '#333355',
    },
  },
  oled: {
    name: 'oled',
    label: 'OLED',
    vars: {
      '--r-bg': '#000000',
      '--r-bg-secondary': '#111111',
      '--r-text': '#ffffff',
      '--r-text-secondary': '#999999',
      '--r-border': '#222222',
    },
  },
}

export const accentThemes: Record<AccentTheme, AccentThemeConfig> = {
  sky: {
    name: 'sky',
    label: 'Голубой свет',
    description: 'Холодный мягкий акцент для выделений и навигации.',
    vars: {
      '--user-accent': '#0ea5e9',
      '--user-accent-foreground': '#ffffff',
      '--user-accent-soft': '#e0f2fe',
      '--user-accent-border': '#7dd3fc',
      '--user-accent-text': '#075985',
    },
  },
  forest: {
    name: 'forest',
    label: 'Лесной',
    description: 'Спокойный природный акцент, ближе к текущему стилю.',
    vars: {
      '--user-accent': '#4a7c59',
      '--user-accent-foreground': '#ffffff',
      '--user-accent-soft': '#e8f3eb',
      '--user-accent-border': '#9ec5a7',
      '--user-accent-text': '#2f5a3b',
    },
  },
  sunset: {
    name: 'sunset',
    label: 'Тёплый янтарь',
    description: 'Более тёплый акцент для кнопок и подсветок.',
    vars: {
      '--user-accent': '#f59e0b',
      '--user-accent-foreground': '#ffffff',
      '--user-accent-soft': '#fff1d6',
      '--user-accent-border': '#fcd34d',
      '--user-accent-text': '#92400e',
    },
  },
}

export function applyTheme(theme: ReaderTheme, accentTheme: AccentTheme): Record<string, string> {
  const readerTheme = themes[theme]
  const accent = accentThemes[accentTheme]

  return {
    ...readerTheme.vars,
    '--r-accent': accent.vars['--user-accent'],
    '--r-accent-foreground': accent.vars['--user-accent-foreground'],
  }
}

export function getAppAccentVars(accentTheme: AccentTheme): Record<string, string> {
  const accent = accentThemes[accentTheme]

  return {
    ...accent.vars,
    '--primary': accent.vars['--user-accent'],
    '--primary-foreground': accent.vars['--user-accent-foreground'],
    '--ring': accent.vars['--user-accent'],
    '--sidebar-primary': accent.vars['--user-accent'],
    '--sidebar-primary-foreground': accent.vars['--user-accent-foreground'],
    '--r-accent': accent.vars['--user-accent'],
    '--r-accent-foreground': accent.vars['--user-accent-foreground'],
  }
}

export const themeList = Object.values(themes)
export const accentThemeList = Object.values(accentThemes)
