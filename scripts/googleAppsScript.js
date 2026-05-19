// Chapter99 V4 — Phase 6
// Google Apps Script
// Paste this in: script.google.com → New Project
// Triggers: onFormSubmit → saves to Sheet + Supabase + Drive

const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co'
const SUPABASE_KEY = 'your_service_role_key_here'
const SHOP_ID = 'shop-001'
const DRIVE_FOLDER_ID = 'your_google_drive_folder_id'
const ACCOUNTANT_EMAIL = 'accountant@example.com'

// ── Trigger: runs every time client submits intake form ───────
function onFormSubmit(e) {
  const response = e.response
  const answers = response.getItemResponses()

  // Parse form answers into structured object
  const intake = parseIntakeForm(answers, response)

  // 1. Save to Google Sheet (auto by Form, but we enrich it)
  enrichSheet(intake, response.getId())

  // 2. Sync to Supabase (client profile)
  syncToSupabase(intake)

  // 3. Save PDF to Google Drive
  savePDFtoDrive(intake, response.getId())

  // 4. Alert staff if medical flags found
  if (intake.medicalFlags.length > 0) {
    alertStaff(intake)
  }
}

// ── Parse Google Form responses ───────────────────────────────
function parseIntakeForm(answers, response) {
  const data = {}
  answers.forEach(a => {
    const title = a.getItem().getTitle()
    const val = a.getResponse()
    data[title] = val
  })

  return {
    submittedAt: response.getTimestamp().toISOString(),
    responseId: response.getId(),
    // Personal
    title: data['Title'] || '',
    fullName: data['Full Name:'] || '',
    dob: data['Date of Birth:'] || '',
    phone: data['Phone Number or emails'] || '',
    address: data['Residential Address:'] || '',
    // Health Fund
    hasHealthFund: data['Do you have Private Health Insurance for Remedial Massage?'] === 'Yes',
    healthFundName: data['Health Fund Name:'] || '',
    // Medical (checkboxes return array)
    medicalFlags: parseMedicalFlags(data['Do you currently have or have you ever had any of the following?']),
    otherConditions: data['Other medical conditions:'] || '',
    // Preferences
    focusAreas: parseArray(data['Which areas would you like us to focus on today? (Select multiple if needed)']),
    pressurePref: parsePressure(data['Preferred Massage Pressure:']),
    // Consent
    signature: data['Please type your full name as a digital signature'] || '',
    consentGiven: true,
  }
}

function parseMedicalFlags(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

function parseArray(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

function parsePressure(raw) {
  if (!raw) return 2
  if (raw.includes('1') || raw.toLowerCase().includes('soft')) return 1
  if (raw.includes('3') || raw.toLowerCase().includes('deep')) return 3
  return 2
}

// ── Enrich Google Sheet with parsed data ──────────────────────
function enrichSheet(intake, responseId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  let sheet = ss.getSheetByName('Parsed Intake')

  if (!sheet) {
    sheet = ss.insertSheet('Parsed Intake')
    sheet.appendRow([
      'Timestamp', 'Response ID', 'Name', 'DOB', 'Phone',
      'Health Fund', 'Fund Name', 'Medical Flags',
      'Focus Areas', 'Pressure', 'Consent', 'Drive PDF'
    ])
    sheet.getRange(1, 1, 1, 12).setFontWeight('bold')
      .setBackground('#0F6E56').setFontColor('#ffffff')
  }

  sheet.appendRow([
    intake.submittedAt,
    responseId,
    `${intake.title} ${intake.fullName}`,
    intake.dob,
    intake.phone,
    intake.hasHealthFund ? 'YES' : 'No',
    intake.healthFundName,
    intake.medicalFlags.join(', '),
    intake.focusAreas.join(', '),
    intake.pressurePref === 1 ? 'Soft' : intake.pressurePref === 3 ? 'Deep' : 'Medium',
    intake.signature ? '✅ Signed' : '❌',
    '' // Drive link added later
  ])
}

// ── Sync client to Supabase ───────────────────────────────────
function syncToSupabase(intake) {
  const payload = {
    shop_id: SHOP_ID,
    name: `${intake.title} ${intake.fullName}`.trim(),
    phone: intake.phone,
    dob: intake.dob || null,
    address: intake.address || null,
    health_fund: intake.hasHealthFund,
    health_fund_name: intake.healthFundName || null,
    medical_flags: intake.medicalFlags,
    pressure_pref: intake.pressurePref,
    focus_areas: intake.focusAreas,
    notes: intake.otherConditions || null,
  }

  const options = {
    method: 'POST',
    contentType: 'application/json',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=minimal',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  }

  const res = UrlFetchApp.fetch(`${SUPABASE_URL}/rest/v1/clients`, options)
  if (res.getResponseCode() !== 201) {
    console.error('Supabase sync failed:', res.getContentText())
  }
}

// ── Save intake PDF to Google Drive ──────────────────────────
function savePDFtoDrive(intake, responseId) {
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID)

  // Get or create subfolder: Clients/YYYY/Mon/
  const now = new Date()
  const yearFolder = getOrCreateFolder(folder, now.getFullYear().toString())
  const monthFolder = getOrCreateFolder(yearFolder,
    now.toLocaleString('en-AU', { month: 'long' }))

  // Build HTML for PDF
  const html = buildIntakeHTML(intake)
  const blob = Utilities.newBlob(html, 'text/html', 'temp.html')
    .getAs('application/pdf')

  const safeName = intake.fullName.replace(/[^a-zA-Z0-9]/g, '-')
  const dateStr = Utilities.formatDate(now, 'Australia/Sydney', 'dd-MMM-yyyy')
  const fileName = `Intake-${safeName}-${dateStr}.pdf`

  blob.setName(fileName)
  const file = monthFolder.createFile(blob)

  console.log(`Saved intake PDF: ${file.getUrl()}`)
  return file.getUrl()
}

function getOrCreateFolder(parent, name) {
  const existing = parent.getFoldersByName(name)
  if (existing.hasNext()) return existing.next()
  return parent.createFolder(name)
}

// ── Build HTML for PDF generation ────────────────────────────
function buildIntakeHTML(intake) {
  const flags = intake.medicalFlags.length > 0
    ? `<div style="background:#FAECE7;border-left:4px solid #993C1D;padding:10px;margin:12px 0;border-radius:4px">
        <strong style="color:#993C1D">⚠️ Medical Flags:</strong>
        <p style="margin:4px 0;color:#993C1D">${intake.medicalFlags.join(', ')}</p>
       </div>`
    : '<p style="color:#3B6D11">✅ No medical flags</p>'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; padding: 24px; color: #1a1a1a; }
    h1 { color: #0F6E56; font-size: 18px; margin: 0 0 4px; }
    h2 { font-size: 13px; color: #666; font-weight: normal; margin: 0 0 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    td { padding: 6px 8px; border-bottom: 0.5px solid #e0e0e0; }
    td:first-child { color: #666; width: 40%; }
    .section { font-weight: bold; color: #0F6E56; font-size: 11px;
                text-transform: uppercase; letter-spacing: 1px;
                margin: 16px 0 8px; border-bottom: 1px solid #0F6E56; padding-bottom: 4px; }
    .sig { font-family: cursive; font-size: 16px; color: #0F6E56; }
    .footer { margin-top: 24px; font-size: 10px; color: #999; text-align: center;
               border-top: 0.5px solid #e0e0e0; padding-top: 12px; }
  </style>
</head>
<body>
  <h1>Remedial Thai Massage — Client Intake Form</h1>
  <h2>Submitted: ${new Date(intake.submittedAt).toLocaleString('en-AU')}</h2>

  <div class="section">Personal Details</div>
  <table>
    <tr><td>Full Name</td><td>${intake.title} ${intake.fullName}</td></tr>
    <tr><td>Date of Birth</td><td>${intake.dob}</td></tr>
    <tr><td>Phone / Email</td><td>${intake.phone}</td></tr>
    <tr><td>Address</td><td>${intake.address}</td></tr>
  </table>

  <div class="section">Health Insurance</div>
  <table>
    <tr><td>Private Health Insurance</td><td>${intake.hasHealthFund ? '✅ Yes' : '❌ No'}</td></tr>
    ${intake.hasHealthFund ? `<tr><td>Health Fund</td><td>${intake.healthFundName}</td></tr>` : ''}
  </table>

  <div class="section">Medical History</div>
  ${flags}
  ${intake.otherConditions ? `<p><strong>Other:</strong> ${intake.otherConditions}</p>` : ''}

  <div class="section">Treatment Preferences</div>
  <table>
    <tr><td>Focus Areas</td><td>${intake.focusAreas.join(', ') || 'Not specified'}</td></tr>
    <tr><td>Pressure</td><td>${intake.pressurePref === 1 ? '1 — Soft/Relaxing' : intake.pressurePref === 3 ? '3 — Deep Tissue' : '2 — Medium/Firm'}</td></tr>
  </table>

  <div class="section">Consent & Declaration</div>
  <p style="font-size:11px;color:#555">
    I confirm that the information provided above is true and correct to the best of my knowledge.
    I understand that the massage treatment is for the purpose of stress reduction and muscular relief.
    I consent to receive the treatment.
  </p>
  <p>Digital Signature: <span class="sig">${intake.signature}</span></p>

  <div class="footer">
    Powered by Chapter99 · Stored securely per Australian Privacy Principles
  </div>
</body>
</html>`
}

// ── Alert staff if medical flags found ───────────────────────
function alertStaff(intake) {
  const subject = `⚠️ Medical Alert — ${intake.fullName}`
  const body = `
New client intake submitted with medical flags.

Client: ${intake.title} ${intake.fullName}
Phone: ${intake.phone}

⚠️ Medical Flags:
${intake.medicalFlags.map(f => `  • ${f}`).join('\n')}

${intake.otherConditions ? `Other conditions: ${intake.otherConditions}` : ''}

Focus Areas: ${intake.focusAreas.join(', ')}
Pressure Preference: ${intake.pressurePref === 1 ? 'Soft' : intake.pressurePref === 3 ? 'Deep' : 'Medium'}

Please review before the appointment.
  `
  GmailApp.sendEmail(ACCOUNTANT_EMAIL, subject, body)
}

// ── Monthly Tax Report: auto-email accountant ─────────────────
function sendMonthlyTaxReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const txSheet = ss.getSheetByName('Transactions')
  if (!txSheet) return

  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const monthName = lastMonth.toLocaleString('en-AU', { month: 'long', year: 'numeric' })

  // Export sheet as Excel
  const url = `https://docs.google.com/spreadsheets/d/${ss.getId()}/export?format=xlsx`
  const token = ScriptApp.getOAuthToken()
  const blob = UrlFetchApp.fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  }).getBlob().setName(`Chapter99-Tax-${monthName}.xlsx`)

  GmailApp.sendEmail(
    ACCOUNTANT_EMAIL,
    `Tax Report — ${monthName}`,
    `Hi,\n\nPlease find attached the monthly transaction report for ${monthName}.\n\nThis report includes:\n• Daily transactions with GST breakdown\n• Payment method summary\n• HICAPS (Health Fund) transactions\n• Card surcharge collected\n\nNext BAS due: ${getNextBASDue()}\n\nPowered by Chapter99`,
    { attachments: [blob] }
  )
}

function getNextBASDue() {
  const now = new Date()
  const quarter = Math.floor(now.getMonth() / 3)
  const dueDates = ['28 October', '28 February', '28 April', '28 July']
  return dueDates[(quarter + 1) % 4]
}

// ── Setup triggers (run once) ─────────────────────────────────
function setupTriggers() {
  // Form submit trigger
  const form = FormApp.openById('YOUR_FORM_ID')
  ScriptApp.newTrigger('onFormSubmit')
    .forForm(form)
    .onFormSubmit()
    .create()

  // Monthly tax report (1st of each month at 9am)
  ScriptApp.newTrigger('sendMonthlyTaxReport')
    .timeBased()
    .onMonthDay(1)
    .atHour(9)
    .create()

  console.log('Triggers set up successfully')
}
