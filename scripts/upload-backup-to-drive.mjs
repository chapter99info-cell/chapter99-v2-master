/**
 * Upload chapter99-backup-info.md to Google Drive folder "Chapter99 Backups".
 *
 * Usage (from project root):
 *   npm run upload-backup
 *
 * Loads (first found): .env.production.local, .env.local, .env
 * Requires GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY (or GOOGLE_SERVICE_ACCOUNT JSON)
 * Optional: GOOGLE_DRIVE_FOLDER_ID (else searches by folder name)
 */

import { createReadStream, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { JWT } from 'google-auth-library'
import { google } from 'googleapis'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const BACKUP_FILE = resolve(ROOT, 'chapter99-backup-info.md')
const FOLDER_NAME = 'Chapter99 Backups'
const DRIVE_FILE_NAME = 'chapter99-backup-info.md'

for (const envFile of ['.env.production.local', '.env.local', '.env']) {
  const path = resolve(ROOT, envFile)
  if (existsSync(path)) dotenv.config({ path })
}

function resolveServiceAccount() {
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
  let key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if ((!email || !key) && process.env.GOOGLE_SERVICE_ACCOUNT?.trim()) {
    try {
      const json = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT)
      email = json.client_email
      key = json.private_key
    } catch {
      /* ignore */
    }
  }

  if (!email || !key) {
    throw new Error(
      'Missing Google credentials. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in .env or Vercel, then run: npx vercel env pull .env.production.local --environment=production'
    )
  }
  return { email, key }
}

function getAuth() {
  const { email, key } = resolveServiceAccount()
  return new JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
}

async function findFolderId(drive) {
  const fromEnv = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim()
  if (fromEnv) return fromEnv

  const escaped = FOLDER_NAME.replace(/'/g, "\\'")
  const { data } = await drive.files.list({
    q: `name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const folder = data.files?.[0]
  if (!folder?.id) {
    throw new Error(
      `Folder "${FOLDER_NAME}" not found. Share it with ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} or set GOOGLE_DRIVE_FOLDER_ID.`
    )
  }
  return folder.id
}

async function main() {
  if (!existsSync(BACKUP_FILE)) {
    throw new Error(`Backup file not found: ${BACKUP_FILE}`)
  }

  const auth = getAuth()
  const drive = google.drive({ version: 'v3', auth })
  const folderId = await findFolderId(drive)

  const { data: existing } = await drive.files.list({
    q: `name='${DRIVE_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })

  const media = { mimeType: 'text/markdown', body: createReadStream(BACKUP_FILE) }
  let fileId

  if (existing.files?.[0]?.id) {
    const updated = await drive.files.update({
      fileId: existing.files[0].id,
      media,
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    })
    fileId = updated.data.id
    console.log('[drive] Updated existing file in', FOLDER_NAME)
  } else {
    const created = await drive.files.create({
      requestBody: { name: DRIVE_FILE_NAME, parents: [folderId] },
      media,
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    })
    fileId = created.data.id
    console.log('[drive] Uploaded new file to', FOLDER_NAME)
  }

  console.log('[drive] File ID:', fileId)
  const link = `https://drive.google.com/file/d/${fileId}/view`
  console.log('[drive] View:', link)
}

main().catch(err => {
  console.error('[drive] Upload failed:', err.message || err)
  process.exit(1)
})
