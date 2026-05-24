/**
 * Google Drive uploads via service account (same credentials as Sheets sync).
 *
 * Env:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_PRIVATE_KEY
 *   GOOGLE_DRIVE_FOLDER_ID (optional — else search by folder name)
 */

import { createReadStream } from 'fs'
import { JWT } from 'google-auth-library'
import { google } from 'googleapis'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'

export function getGoogleDriveAuth(): JWT {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!email || !key) {
    throw new Error(
      'Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY in environment'
    )
  }

  return new JWT({
    email,
    key,
    scopes: [DRIVE_SCOPE],
  })
}

export async function findDriveFolderByName(folderName: string): Promise<string | null> {
  const auth = getGoogleDriveAuth()
  const drive = google.drive({ version: 'v3', auth })
  const escaped = folderName.replace(/'/g, "\\'")
  const { data } = await drive.files.list({
    q: `name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    pageSize: 10,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  return data.files?.[0]?.id ?? null
}

export async function resolveBackupFolderId(folderName: string): Promise<string> {
  const fromEnv = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim()
  if (fromEnv) return fromEnv

  const found = await findDriveFolderByName(folderName)
  if (!found) {
    throw new Error(
      `Drive folder "${folderName}" not found. Set GOOGLE_DRIVE_FOLDER_ID or share the folder with the service account.`
    )
  }
  return found
}

export async function uploadFileToDriveFolder(opts: {
  localPath: string
  fileName: string
  folderId: string
  mimeType?: string
}): Promise<{ fileId: string; webViewLink?: string | null }> {
  const auth = getGoogleDriveAuth()
  const drive = google.drive({ version: 'v3', auth })
  const mimeType = opts.mimeType ?? 'text/markdown'

  const { data: existing } = await drive.files.list({
    q: `name='${opts.fileName.replace(/'/g, "\\'")}' and '${opts.folderId}' in parents and trashed=false`,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })

  const parents = [opts.folderId]
  const media = { mimeType, body: createReadStream(opts.localPath) }

  if (existing.files?.[0]?.id) {
    const fileId = existing.files[0].id
    const { data } = await drive.files.update({
      fileId,
      media,
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    })
    return { fileId: data.id!, webViewLink: data.webViewLink }
  }

  const { data } = await drive.files.create({
    requestBody: { name: opts.fileName, parents },
    media,
    fields: 'id, webViewLink',
    supportsAllDrives: true,
  })
  return { fileId: data.id!, webViewLink: data.webViewLink }
}
