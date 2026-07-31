import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export type ThemeId =
  | 'elegant'
  | 'traditional'
  | 'minimal'
  | 'modern'
  | 'jasmine'
  | 'koala'
  | 'thaibody'
  | 'zenminimal'
  | 'varathai'
  | 'goldenorchid'
  | 'sukthai'
  | 'kaya'
  | 'sukha'
  | 'sabai'
  | 'solene'
  | 'orchidglass'
  | 'noirbotanica'

const themeLoaders: Record<
  ThemeId,
  () => Promise<{ default: ComponentType }>
> = {
  elegant: () => import('../themes/theme-elegant/HomePage'),
  traditional: () => import('../themes/theme-traditional/HomePage'),
  minimal: () => import('../themes/theme-minimal/HomePage'),
  modern: () => import('../themes/theme-modern/HomePage'),
  jasmine: () => import('../themes/theme-jasmine/HomePage'),
  koala: () => import('../themes/theme-koala/HomePage'),
  thaibody: () => import('../themes/theme-thaibody/HomePage'),
  zenminimal: () => import('../themes/theme-zenminimal/HomePage'),
  varathai: () => import('../themes/theme-varathai/HomePage'),
  goldenorchid: () => import('../themes/theme-goldenorchid/HomePage'),
  sukthai: () => import('../themes/theme-sukthai/HomePage'),
  kaya: () => import('../themes/theme-kaya/HomePage'),
  sukha: () => import('../themes/theme-sukha/HomePage'),
  sabai: () => import('../themes/theme-sabai/HomePage'),
  solene: () => import('../themes/theme-solene/HomePage'),
  orchidglass: () => import('../themes/theme-orchidglass/HomePage'),
  noirbotanica: () => import('../themes/theme-noirbotanica/HomePage'),
}

export const THEME_IDS: ThemeId[] = [
  'elegant',
  'traditional',
  'minimal',
  'modern',
  'jasmine',
  'koala',
  'thaibody',
  'zenminimal',
  'varathai',
  'goldenorchid',
  'sukthai',
  'kaya',
  'sukha',
  'sabai',
  'solene',
  'orchidglass',
  'noirbotanica',
]

export const THEME_LABELS: Record<ThemeId, string> = {
  elegant: 'Elegant',
  traditional: 'Traditional',
  minimal: 'Minimal',
  modern: 'Modern',
  jasmine: 'Jasmine',
  koala: 'Koala',
  thaibody: 'Thai Body — Masked Mosaic',
  zenminimal: 'Zen Minimal — Sage',
  varathai: 'Vara Thai — Word Reveal',
  goldenorchid: 'Golden Orchid — Video + Form',
  sukthai: 'Suk Thai Ritual — Cinematic Scroll',
  kaya: 'Kaya Studio — Dark Portfolio',
  sukha: 'Sukha — Glass Dashboard',
  sabai: 'Sabai. — Calm Flow',
  solene: 'Solene — Mood Switcher',
  orchidglass: 'Orchid — Liquid Glass Split',
  noirbotanica: 'Noir Botanica — Cinematic Scroll',
}

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as string[]).includes(value)
}

export function getThemeHomePage(themeId: ThemeId): LazyExoticComponent<ComponentType> {
  const loader = themeLoaders[themeId]
  if (!loader) {
    throw new Error(`Unknown theme: ${themeId}`)
  }
  return lazy(loader)
}
