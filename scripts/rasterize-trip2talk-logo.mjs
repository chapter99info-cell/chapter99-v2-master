/**
 * Rasterize public/trip2talk-logo.svg → public/trip2talk-logo.png (+ PWA icons).
 * Or copy Trip2talk__1_.png from project root if present.
 */
import { copyFileSync, existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outPng = join(root, 'public/trip2talk-logo.png')
const svg = join(root, 'public/trip2talk-logo.svg')
const uploaded = join(root, 'Trip2talk__1_.png')
const uploadedAlt = join(root, 'trip2talk-logo-source.png')

function copySource() {
  const src = [uploaded, uploadedAlt].find((p) => existsSync(p))
  if (!src) return false
  copyFileSync(src, outPng)
  console.log('Copied', src, '→', outPng)
  return true
}

async function rasterizeSvg() {
  const { Resvg } = await import('@resvg/resvg-js')
  const svgData = readFileSync(svg)
  const resvg = new Resvg(svgData, { fitTo: { mode: 'width', value: 1024 } })
  const png = resvg.render().asPng()
  const { writeFileSync } = await import('fs')
  writeFileSync(outPng, png)
  console.log('Rasterized SVG →', outPng, png.length, 'bytes')
}

async function main() {
  if (copySource()) {
    execSync('powershell -ExecutionPolicy Bypass -File scripts/generate-trip2talk-icons.ps1', {
      cwd: root,
      stdio: 'inherit',
    })
    return
  }
  if (!existsSync(svg)) {
    console.error('Missing public/trip2talk-logo.svg')
    process.exit(1)
  }
  try {
    await rasterizeSvg()
  } catch {
    console.log('Installing @resvg/resvg-js for SVG → PNG…')
    execSync('npm install --no-save @resvg/resvg-js', { cwd: root, stdio: 'inherit' })
    await rasterizeSvg()
  }
  execSync('powershell -ExecutionPolicy Bypass -File scripts/generate-trip2talk-icons.ps1', {
    cwd: root,
    stdio: 'inherit',
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
