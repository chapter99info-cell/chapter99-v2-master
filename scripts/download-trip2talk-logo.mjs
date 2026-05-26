import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public/trip2talk-logo.png')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function main() {
  const pageRes = await fetch('https://www.facebook.com/TriptoTalk', {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
    redirect: 'follow',
  })
  const html = await pageRes.text()
  const match =
    html.match(/https:\/\/scontent[^"'\s]+686944264[^"'\s]+/i) ??
    html.match(/https:\/\/scontent[^"'\s]+_n\.jpg[^"'\s]*/i)
  if (!match) {
    console.error('Could not find profile image URL on Facebook page')
    process.exit(1)
  }
  let imgUrl = match[0].replace(/&amp;/g, '&')
  if (!imgUrl.includes('stp=')) {
    imgUrl = imgUrl.replace(/_n\.jpg.*/, (m) => m) + (imgUrl.includes('?') ? '' : '')
  }
  console.log('Image URL:', imgUrl.slice(0, 80) + '...')

  const imgRes = await fetch(imgUrl, {
    headers: { 'User-Agent': UA, Referer: 'https://www.facebook.com/' },
  })
  if (!imgRes.ok) {
    console.error('Image download failed:', imgRes.status, await imgRes.text())
    process.exit(1)
  }
  const buf = Buffer.from(await imgRes.arrayBuffer())
  if (buf.length < 1000) {
    console.error('Download too small — likely blocked:', buf.toString())
    process.exit(1)
  }
  writeFileSync(out, buf)
  console.log('Saved', out, buf.length, 'bytes')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
