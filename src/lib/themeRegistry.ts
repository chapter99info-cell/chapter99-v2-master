import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { themeConfig as elegantConfig } from '../themes/theme-elegant/theme.config'
import { themeConfig as traditionalConfig } from '../themes/theme-traditional/theme.config'
import { themeConfig as minimalConfig } from '../themes/theme-minimal/theme.config'
import { themeConfig as modernConfig } from '../themes/theme-modern/theme.config'
import { themeConfig as jasmineConfig } from '../themes/theme-jasmine/theme.config'
import { themeConfig as koalaConfig } from '../themes/theme-koala/theme.config'
import { themeConfig as thaibodyConfig } from '../themes/theme-thaibody/theme.config'
import { themeConfig as zenminimalConfig } from '../themes/theme-zenminimal/theme.config'
import { themeConfig as varathaiConfig } from '../themes/theme-varathai/theme.config'
import { themeConfig as goldenorchidConfig } from '../themes/theme-goldenorchid/theme.config'
import { themeConfig as sukthaiConfig } from '../themes/theme-sukthai/theme.config'
import { themeConfig as kayaConfig } from '../themes/theme-kaya/theme.config'
import { themeConfig as sukhaConfig } from '../themes/theme-sukha/theme.config'
import { themeConfig as sabaiConfig } from '../themes/theme-sabai/theme.config'
import { themeConfig as soleneConfig } from '../themes/theme-solene/theme.config'
import { themeConfig as orchidglassConfig } from '../themes/theme-orchidglass/theme.config'
import { themeConfig as noirbotanicaConfig } from '../themes/theme-noirbotanica/theme.config'

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

// Auto-tint the shared Book/Menu/Services pages to match whichever theme a
// shop uses, instead of every shop showing the same green (#1a3d2b) accent.
// Picks whichever of the theme's two brand colors reads better as a small
// accent (text/border/button) on the white booking-page background — some
// themes' primaryColor is itself pale (e.g. Kaya's cream, meant to sit on a
// near-black page), so a plain "always use primaryColor" rule would produce
// near-invisible text there. Shops with no themeId (Mira, Jasmine's real
// shop record, ...) are completely unaffected — this only ever applies
// inline, per-shop.
const THEME_CONFIGS: Record<ThemeId, { primaryColor: string; secondaryColor: string }> = {
  elegant: elegantConfig,
  traditional: traditionalConfig,
  minimal: minimalConfig,
  modern: modernConfig,
  jasmine: jasmineConfig,
  koala: koalaConfig,
  thaibody: thaibodyConfig,
  zenminimal: zenminimalConfig,
  varathai: varathaiConfig,
  goldenorchid: goldenorchidConfig,
  sukthai: sukthaiConfig,
  kaya: kayaConfig,
  sukha: sukhaConfig,
  sabai: sabaiConfig,
  solene: soleneConfig,
  orchidglass: orchidglassConfig,
  noirbotanica: noirbotanicaConfig,
}

function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return 0.5
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Returns the accent color to use for a shop's theme, or null for no theme. */
export function getThemeAccentColor(themeId: string | null | undefined): string | null {
  if (!themeId || !isThemeId(themeId)) return null
  const { primaryColor, secondaryColor } = THEME_CONFIGS[themeId]
  // Prefer primaryColor (each theme's intended brand accent) unless it's too
  // pale to read as text/border on white — then fall back to secondaryColor.
  return relativeLuminance(primaryColor) > 0.75 ? secondaryColor : primaryColor
}

export function getThemeHomePage(themeId: ThemeId): LazyExoticComponent<ComponentType> {
  const loader = themeLoaders[themeId]
  if (!loader) {
    throw new Error(`Unknown theme: ${themeId}`)
  }
  return lazy(loader)
}
