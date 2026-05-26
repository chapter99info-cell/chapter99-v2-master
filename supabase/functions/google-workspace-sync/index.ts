import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GOOGLE_SERVICE_ACCOUNT = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') ?? ''
const SPREADSHEET_ID = Deno.env.get('GOOGLE_SPREADSHEET_ID') ?? ''
const DRIVE_FOLDER_ID = Deno.env.get('GOOGLE_DRIVE_FOLDER_ID') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson)
  const now = Math.floor(Date.now() / 1000)

  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: sa.client_email,
    scope:
      'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const signingInput = `${encode(header)}.${encode(payload)}`

  const pemContents = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '')

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  )

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const jwt = `${signingInput}.${sigB64}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    throw new Error(tokenData.error_description ?? 'Failed to obtain Google access token')
  }
  return tokenData.access_token
}

async function appendToSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  values: (string | number)[]
): Promise<void> {
  const encodedSheet = encodeURIComponent(sheetName)
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheet}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [values] }),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sheets append failed: ${err}`)
  }
}

async function uploadReceiptToDrive(
  accessToken: string,
  folderId: string,
  filename: string,
  base64Data: string
): Promise<void> {
  if (!base64Data) return

  const boundary = 'trip2talk_boundary'
  const metadata = JSON.stringify({
    name: filename,
    parents: [folderId],
  })

  const binary = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: image/jpeg',
    '',
  ].join('\r\n')

  const encoder = new TextEncoder()
  const prefix = encoder.encode(body)
  const suffix = encoder.encode(`\r\n--${boundary}--`)
  const multipart = new Uint8Array(prefix.length + binary.length + suffix.length)
  multipart.set(prefix, 0)
  multipart.set(binary, prefix.length)
  multipart.set(suffix, prefix.length + binary.length)

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipart,
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Drive upload failed: ${err}`)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!GOOGLE_SERVICE_ACCOUNT || !SPREADSHEET_ID) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Google credentials not configured (GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_SPREADSHEET_ID)',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { action, taxYear, payload, record } = body

    const accessToken = await getGoogleAccessToken(GOOGLE_SERVICE_ACCOUNT)
    const sheetName = taxYear ?? 'Tax_Year_2025_2026'

    if (action === 'SYNC_EXPENSE') {
      const row = [
        new Date().toISOString(),
        payload.id ?? '',
        payload.tourId ?? '',
        payload.vendor ?? '',
        payload.category ?? '',
        payload.amountAud ?? 0,
        payload.hasGst ? 'YES' : 'NO',
        payload.gstAmount ?? 0,
        Number(payload.amountAud ?? 0) - Number(payload.gstAmount ?? 0),
        payload.filename ?? '',
        payload.createdAt ?? '',
      ]

      await appendToSheet(accessToken, SPREADSHEET_ID, sheetName, row)

      if (DRIVE_FOLDER_ID && payload.fileData) {
        await uploadReceiptToDrive(
          accessToken,
          DRIVE_FOLDER_ID,
          payload.filename ?? `receipt_${payload.id ?? Date.now()}.jpg`,
          payload.fileData
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'SYNC_SETTLEMENT') {
      const settlementSheet = `${sheetName}_Settlements`
      const row = [
        new Date().toISOString(),
        payload.tourCode ?? '',
        payload.revenue ?? 0,
        payload.expenses ?? 0,
        payload.commissions ?? 0,
        payload.netProfit ?? 0,
        payload.gstCollected ?? 0,
        payload.gstClaimed ?? 0,
        payload.syncedAt ?? '',
      ]

      await appendToSheet(accessToken, SPREADSHEET_ID, settlementSheet, row)

      return new Response(
        JSON.stringify({
          success: true,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'archive_client' && record) {
      const archiveSheet = 'Client_Archive'
      const row = [
        new Date().toISOString(),
        record.client_id ?? '',
        record.full_name_en ?? '',
        record.passport_number ?? '',
        record.tour_code ?? '',
        record.archived_at ?? '',
      ]
      await appendToSheet(accessToken, SPREADSHEET_ID, archiveSheet, row)
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
