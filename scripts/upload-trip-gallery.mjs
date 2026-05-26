/**
 * Upload local images to Supabase Storage bucket trip-gallery.
 *
 * Prerequisites:
 *   - .env with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   - Files in public/assets/gallery/NZ-2025/*.jpg (see README)
 *
 * Usage: node scripts/upload-trip-gallery.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
dotenv.config({ path: join(root, '.env') })

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(url, serviceKey)
const localDir = join(root, 'public', 'assets', 'gallery', 'NZ-2025')
const storagePrefix = 'NZ-2025'

let files
try {
  files = readdirSync(localDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
} catch {
  console.error(`Missing folder: ${localDir}`)
  console.error('Add 5 JPG files named like 01-milford-sound.jpg … 05-auckland-sky-tower.jpg')
  process.exit(1)
}

for (const name of files.sort()) {
  const storagePath = `${storagePrefix}/${name}`
  const body = readFileSync(join(localDir, name))
  const contentType = name.endsWith('.png') ? 'image/png' : 'image/jpeg'
  const { error } = await supabase.storage.from('trip-gallery').upload(storagePath, body, {
    upsert: true,
    contentType,
  })
  if (error) {
    console.error(`Failed ${storagePath}:`, error.message)
  } else {
    console.log(`Uploaded ${storagePath}`)
  }
}

console.log('Done. Run 008_trip_gallery_seed.sql if not already applied.')
