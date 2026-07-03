export const themeConfig = {
  id: 'jasmine',
  label: 'Jasmine Luxury',
  primaryColor: '#B8860B',
  secondaryColor: '#D4AF37',
  accentColor: '#F5C518',
  background: '#FDFBF7',
  surface: '#FFFFFF',
  goldLight: '#F5ECD4',
} as const

export type ThemeConfig = typeof themeConfig
