export const themeConfig = {
  id: 'traditional',
  label: 'Traditional',
  primaryColor: '#7B5EA7',
  secondaryColor: '#D4AF37',
} as const

export type ThemeConfig = typeof themeConfig
