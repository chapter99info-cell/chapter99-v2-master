/**
 * Install PhotoFeedFull.jsx (15 embedded base64 photos) into the app.
 *
 * Place your file at either:
 *   - ./PhotoFeedFull.jsx (project root), or
 *   - ./src/pages/PhotoFeedFull.jsx
 *
 * Then: node scripts/install-photo-feed-full.mjs
 */
import { copyFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dest = join(root, 'src', 'pages', 'PhotoFeedFull.jsx')
const stubTsx = join(root, 'src', 'pages', 'PhotoFeedFull.tsx')
const cliPath = process.argv[2]
const candidates = [
  cliPath,
  join(root, 'PhotoFeedFull.jsx'),
  dest,
].filter(Boolean)

const src = candidates.find((p) => existsSync(p))
if (!src) {
  console.error('PhotoFeedFull.jsx not found.')
  console.error('Expected at:', join(root, 'PhotoFeedFull.jsx'))
  console.error('Or: src/pages/PhotoFeedFull.jsx')
  console.error('Or pass path: node scripts/install-photo-feed-full.mjs "C:\\path\\PhotoFeedFull.jsx"')
  process.exit(1)
}

const sizeMb = (existsSync(src) ? readFileSync(src).length : 0) / (1024 * 1024)
console.log(`Source: ${src} (${sizeMb.toFixed(2)} MB)`)
if (sizeMb < 0.5) {
  console.warn('Warning: file is under 0.5 MB — expected ~1+ MB with embedded photos')
}

if (src !== dest) copyFileSync(src, dest)
if (existsSync(stubTsx)) {
  unlinkSync(stubTsx)
  console.log('Removed placeholder src/pages/PhotoFeedFull.tsx')
}

const appTsx = join(root, 'src', 'App.tsx')
if (existsSync(appTsx)) {
  const app = readFileSync(appTsx, 'utf8')
  if (!app.includes("from './pages/PhotoFeedFull.jsx'")) {
    writeFileSync(
      appTsx,
      app.replace("from './pages/PhotoFeedFull'", "from './pages/PhotoFeedFull.jsx'")
    )
    console.log('Updated src/App.tsx → PhotoFeedFull.jsx')
  }
}

console.log('Installed', dest)
console.log('Next: npm run build && npx vercel --prod --yes')
