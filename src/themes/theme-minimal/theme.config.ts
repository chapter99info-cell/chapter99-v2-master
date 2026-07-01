export const themeConfig = {
  id: 'minimal',
  label: 'Minimal',
  primaryColor: '#6B7280',
  secondaryColor: '#FFFFFF',
} as const

export type ThemeConfig = typeof themeConfig
