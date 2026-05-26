/**
 * Install GuidePageNew.jsx → src/pages/GuidePageNew.tsx (embedded image data preserved).
 *
 * Place your file at:
 *   - ./GuidePageNew.jsx (project root), or
 *   - ./src/pages/GuidePageNew.jsx
 *
 * Then: node scripts/install-guide-page-new.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dest = join(root, 'src', 'pages', 'GuidePageNew.tsx')
const cliPath = process.argv[2]
const candidates = [
  cliPath,
  join(root, 'GuidePageNew.jsx'),
  join(root, 'src', 'pages', 'GuidePageNew.jsx'),
].filter(Boolean)

const src = candidates.find((p) => existsSync(p))
if (!src) {
  console.error('GuidePageNew.jsx not found.')
  console.error('Expected at:', join(root, 'GuidePageNew.jsx'))
  console.error('Or pass path: node scripts/install-guide-page-new.mjs "C:\\path\\GuidePageNew.jsx"')
  process.exit(1)
}

let code = readFileSync(src, 'utf8')
const sizeMb = code.length / (1024 * 1024)
console.log(`Source: ${src} (${sizeMb.toFixed(2)} MB)`)

// Paths when file lives in src/pages/
code = code.replace(/from ['"]\.\/lib\//g, "from '../lib/")
code = code.replace(/from ['"]\.\/components\//g, "from '../components/")
code = code.replace(/from ['"]\.\/hooks\//g, "from '../hooks/")
code = code.replace(/from ['"]\.\/types\//g, "from '../types/")
code = code.replace(/from ['"](\.\.\/[^'"]+)\.jsx['"]/g, "from '$1'")

if (code.includes('client-neon') && !code.includes('ClientApp.css')) {
  const reactImport = code.match(/^import .+ from ['"]react['"];?\s*/m)
  if (reactImport) {
    code = code.replace(reactImport[0], `${reactImport[0]}import './ClientApp.css'\n`)
  } else {
    code = `import './ClientApp.css'\n${code}`
  }
}

writeFileSync(dest, code, 'utf8')
console.log('Installed', dest)

const appTsx = join(root, 'src', 'App.tsx')
if (existsSync(appTsx)) {
  let app = readFileSync(appTsx, 'utf8')
  if (app.includes("from './pages/ClientApp'") && app.includes('<ClientApp />')) {
    app = app.replace("import ClientApp from './pages/ClientApp'", "import GuidePageNew from './pages/GuidePageNew'")
    app = app.replace('<Route path="guide" element={<ClientApp />} />', '<Route path="guide" element={<GuidePageNew />} />')
    writeFileSync(appTsx, app, 'utf8')
    console.log('Updated src/App.tsx → /guide uses GuidePageNew')
  }
}

console.log('Next: npm run deploy:trip2talk')
