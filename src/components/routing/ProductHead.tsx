import { useEffect } from 'react'

const TITLE = 'Mira Thai Massage'
const DESCRIPTION = 'Mira Thai Massage — book online'
const THEME_COLOR = '#1a3d2b'

export default function ProductHead() {
  useEffect(() => {
    document.title = TITLE
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', DESCRIPTION)
    const theme = document.querySelector('meta[name="theme-color"]')
    if (theme) theme.setAttribute('content', THEME_COLOR)
  }, [])

  return null
}
