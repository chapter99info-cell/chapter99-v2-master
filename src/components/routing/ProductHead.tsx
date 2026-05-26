import { useEffect } from 'react'
import type { AppProduct } from '../../lib/productDomain'

const TITLES: Record<AppProduct, string> = {
  trip2talk: 'Trip2Talk',
  chapter99: 'Mira Thai Massage',
  dev: 'Chapter99 Platform',
}

const DESCRIPTIONS: Record<AppProduct, string> = {
  trip2talk: 'Trip2Talk — Australian student tours',
  chapter99: 'Mira Thai Massage — book online',
  dev: 'Chapter99 & Trip2Talk development',
}

const THEME_COLORS: Record<AppProduct, string> = {
  trip2talk: '#050508',
  chapter99: '#1a3d2b',
  dev: '#1a3d2b',
}

export default function ProductHead({ product }: { product: AppProduct }) {
  useEffect(() => {
    document.title = TITLES[product]
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', DESCRIPTIONS[product])
    const theme = document.querySelector('meta[name="theme-color"]')
    if (theme) theme.setAttribute('content', THEME_COLORS[product])
  }, [product])

  return null
}
