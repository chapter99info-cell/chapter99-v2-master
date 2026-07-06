import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export type ThemeId = 'elegant' | 'traditional' | 'minimal' | 'modern' | 'jasmine' | 'koala'

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
}

export const THEME_IDS: ThemeId[] = [
  'elegant',
  'traditional',
  'minimal',
  'modern',
  'jasmine',
  'koala',
]

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
