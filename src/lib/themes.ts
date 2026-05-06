export type ReaderTheme = 'light' | 'sepia' | 'dark' | 'oled'

interface ThemeConfig {
  name: string
  label: string
  vars: {
    '--r-bg': string
    '--r-bg-secondary': string
    '--r-text': string
    '--r-text-secondary': string
    '--r-border': string
    '--r-accent': string
    '--r-accent-foreground': string
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
      '--r-accent': '#4a7c59',
      '--r-accent-foreground': '#ffffff',
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
      '--r-accent': '#8b6914',
      '--r-accent-foreground': '#ffffff',
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
      '--r-accent': '#6c8c50',
      '--r-accent-foreground': '#ffffff',
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
      '--r-accent': '#7c9a50',
      '--r-accent-foreground': '#ffffff',
    },
  },
}

export function applyTheme(theme: ReaderTheme): Record<string, string> {
  return themes[theme].vars
}

export const themeList = Object.values(themes)
