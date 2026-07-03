export const themeConfig = {
  id: 'koala',
  label: 'Koala Wellness',
  primaryColor: '#3D6B4F',
  secondaryColor: '#7A9E7E',
  accentColor: '#C4A882',
  background: '#F5F8F4',
  surface: '#FFFFFF',
  mist: '#E8EFE4',
} as const

export type ThemeConfig = typeof themeConfig
