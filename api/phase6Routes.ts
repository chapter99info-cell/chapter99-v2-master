// Chapter99 V4 — Phase 6
// Vercel API Routes

// ── /api/sync-sheet.ts ────────────────────────────────────────
import { google } from 'googleapis'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Transaction } from '../src/types/pos'
import { buildTransactionRow, TRANSACTION_HEADERS } from '../src/lib/googleSheets'

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT!),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}

export async function syncSheetHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const tx: Transaction = req.body.transaction
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!

  try {
    const sheets = await getSheetsClient()

    // Ensure headers exist
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Transactions!A1:Q1',
    })

    if (!headerRes.data.values || headerRes.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Transactions!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [TRANSACTION_HEADERS] },
      })
    }

    // Append transaction row
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Transactions!A:Q',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [buildTransactionRow(tx)] },
    })

    return res.json({ success: true })
  } catch (err: any) {
    console.error('[Sheet sync]', err.message)
    return res.status(500).json({ error: err.message })
  }
}

// ── /api/drive-upload.ts ──────────────────────────────────────
import { google as googleDrive } from 'googleapis'
import formidable from 'formidable'
import fs from 'fs'

export async function driveUploadHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const form = formidable({ maxFileSize: 10 * 1024 * 1024 })
  const [fields, files] = await form.parse(req)

  const shopId = fields.shopId?.[0] ?? 'unknown'
  const fileName = fields.fileName?.[0] ?? 'document.pdf'
  const file = files.file?.[0]
  if (!file) return res.status(400).json({ error: 'No file' })

  try {
    const auth = new googleDrive.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT!),
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    })
    const drive = googleDrive.drive({ version: 'v3', auth })

    // Get or create shop folder
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!
    const shopFolderRes = await drive.files.list({
      q: `'${rootFolderId}' in parents and name='${shopId}' and mimeType='application/vnd.google-apps.folder'`,
      fields: 'files(id)',
    })

    let folderId: string
    if (shopFolderRes.data.files?.length) {
      folderId = shopFolderRes.data.files[0].id!
    } else {
      const created = await drive.files.create({
        requestBody: {
          name: shopId,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [rootFolderId],
        },
        fields: 'id',
      })
      folderId = created.data.id!
    }

    // Upload PDF
    const uploaded = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: {
        mimeType: 'application/pdf',
        body: fs.createReadStream(file.filepath),
      },
      fields: 'id, webViewLink',
    })

    fs.unlinkSync(file.filepath)
    return res.json({ driveUrl: uploaded.data.webViewLink })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}

// ── /api/cron/alerts.ts ───────────────────────────────────────
// Vercel Cron Job — runs daily 8am AU time
// vercel.json: "crons": [{"path":"/api/cron/alerts","schedule":"0 22 * * *"}]
// (22:00 UTC = 08:00 AEST)

import { createClient } from '@supabase/supabase-js'
import { checkAllAlerts, type Alert } from '../src/lib/alertSystem'

export async function cronAlertsHandler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end()
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: shops } = await supabase
    .from('shops')
    .select('id, name, phone, email')
    .eq('active', true)

  if (!shops) return res.json({ processed: 0 })

  let processed = 0
  for (const shop of shops) {
    const alerts = await checkAllAlerts(shop.id)
    const critical = alerts.filter(a => a.severity === 'critical')

    if (critical.length > 0 && shop.phone) {
      const msg = [
        `⚠️ Chapter99 Alert — ${shop.name}`,
        ...critical.slice(0, 3).map(a => `🔴 ${a.title}: ${a.message}`),
        `\nLogin to manage: chapter99solutions.com.au/admin`,
      ].join('\n')

      await fetch(`${process.env.VERCEL_URL}/api/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: shop.phone, message: msg }),
      })
    }
    processed++
  }

  return res.json({ processed, timestamp: new Date().toISOString() })
}

// ── vercel.json config ────────────────────────────────────────
export const VERCEL_CONFIG = {
  crons: [
    {
      path: '/api/cron/alerts',
      schedule: '0 22 * * *',  // 8am AEST daily
    },
    {
      path: '/api/cron/monthly-report',
      schedule: '0 22 1 * *',  // 8am AEST 1st of month
    },
  ],
}
