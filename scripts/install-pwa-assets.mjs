/**
 * Copy Trip2Talk PWA assets from project root into public/.
 *
 * Place at project root:
 *   icon-192.png, icon-512.png, favicon.ico, manifest.json
 *
 * Then: node scripts/install-pwa-assets.mjs
 */
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const map = [
  ['icon-192.png', 'public/icons/icon-192.png'],
  ['icon-512.png', 'public/icons/icon-512.png'],
  ['favicon.ico', 'public/favicon.ico'],
  ['manifest.json', 'public/manifest.json'],
]

let ok = 0
for (const [srcRel, destRel] of map) {
  const src = join(root, srcRel)
  const dest = join(root, destRel)
  if (!existsSync(src)) {
    console.warn(`skip (missing): ${srcRel}`)
    continue
  }
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(src, dest)
  console.log(`installed ${destRel}`)
  ok++
}

if (ok === 0) {
  console.error('No files found at project root.')
  process.exit(1)
}
console.log(`Done (${ok}/${map.length} files).`)
