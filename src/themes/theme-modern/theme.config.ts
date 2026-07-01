export const themeConfig = {
  id: 'modern',
  label: 'Modern',
  primaryColor: '#1A1A1A',
  secondaryColor: '#FFFFFF',
} as const

export type ThemeConfig = typeof themeConfig
