var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// api/phase6Routes.ts
var phase6Routes_exports = {};
__export(phase6Routes_exports, {
  VERCEL_CONFIG: () => VERCEL_CONFIG,
  cronAlertsHandler: () => cronAlertsHandler,
  driveUploadHandler: () => driveUploadHandler,
  syncSheetHandler: () => syncSheetHandler
});
module.exports = __toCommonJS(phase6Routes_exports);
var import_googleapis = require("googleapis");

// src/lib/googleSheets.ts
function buildTransactionRow(tx) {
  const date = new Date(tx.paidAt ?? tx.createdAt);
  return [
    date.toLocaleDateString("en-AU"),
    tx.id,
    tx.clientName ?? "",
    tx.items.map((i) => i.serviceName).join(", "),
    tx.payment.subtotal,
    tx.payment.gst,
    tx.payment.exGst,
    tx.payment.gstFreeAmt,
    tx.payment.surcharge,
    tx.payment.total,
    tx.paymentMethod.toUpperCase(),
    tx.payment.gpCost,
    tx.payment.netRevenue,
    tx.therapistName ?? "",
    tx.status,
    tx.healthFundIssued ? "YES" : "No"
  ];
}

// api/phase6Routes.ts
var import_googleapis2 = require("googleapis");
var import_formidable = __toESM(require("formidable"));
var import_fs = __toESM(require("fs"));
var import_supabase_js2 = require("@supabase/supabase-js");

// src/lib/alertSystem.ts
var import_supabase_js = require("@supabase/supabase-js");
var import_meta = {};
var supabase = (0, import_supabase_js.createClient)(import_meta.env.VITE_SUPABASE_URL ?? "", import_meta.env.VITE_SUPABASE_ANON_KEY ?? "");
async function checkAllAlerts(shopId) {
  const alerts = [];
  const [staffAlerts, basAlerts, revenueAlerts] = await Promise.all([
    checkStaffAlerts(shopId),
    checkBASAlerts(shopId),
    checkRevenueAlerts(shopId)
  ]);
  alerts.push(...staffAlerts, ...basAlerts, ...revenueAlerts);
  return alerts.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, notice: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999);
  });
}
async function checkStaffAlerts(shopId) {
  const { data: staff } = await supabase.from("staff").select("id, name_en, indemnity_expiry, liability_expiry, firstaid_expiry, visa_expiry").eq("shop_id", shopId).eq("active", true);
  if (!staff)
    return [];
  const alerts = [];
  const today = new Date();
  staff.forEach((s) => {
    const checks = [
      {
        type: "indemnity_insurance",
        expiry: s.indemnity_expiry,
        label: "Professional Indemnity Insurance"
      },
      {
        type: "liability_insurance",
        expiry: s.liability_expiry,
        label: "Public Liability Insurance"
      },
      {
        type: "firstaid_cert",
        expiry: s.firstaid_expiry,
        label: "First Aid Certificate"
      },
      {
        type: "visa_expiry",
        expiry: s.visa_expiry,
        label: "Visa / Work Rights"
      }
    ];
    checks.forEach(({ type, expiry, label }) => {
      if (!expiry)
        return;
      const expiryDate = new Date(expiry);
      const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1e3 * 60 * 60 * 24));
      let severity = null;
      if (daysRemaining <= 7)
        severity = "critical";
      else if (daysRemaining <= 30)
        severity = "warning";
      else if (daysRemaining <= 60)
        severity = "notice";
      if (severity) {
        alerts.push({
          id: `${s.id}-${type}`,
          shopId,
          type,
          severity,
          title: `${label} \u2014 ${s.name_en}`,
          message: daysRemaining <= 0 ? `EXPIRED \u2014 Renew immediately` : `Expires in ${daysRemaining} days (${expiryDate.toLocaleDateString("en-AU")})`,
          daysRemaining,
          staffName: s.name_en,
          createdAt: new Date().toISOString(),
          dismissed: false
        });
      }
    });
  });
  return alerts;
}
async function checkBASAlerts(shopId) {
  const alerts = [];
  const today = new Date();
  const basDates = [
    { quarter: "Q1 Jul-Sep", due: new Date(today.getFullYear(), 9, 28) },
    { quarter: "Q2 Oct-Dec", due: new Date(today.getFullYear() + 1, 1, 28) },
    { quarter: "Q3 Jan-Mar", due: new Date(today.getFullYear(), 3, 28) },
    { quarter: "Q4 Apr-Jun", due: new Date(today.getFullYear(), 6, 28) }
  ];
  basDates.forEach(({ quarter, due }) => {
    const daysRemaining = Math.ceil((due.getTime() - today.getTime()) / (1e3 * 60 * 60 * 24));
    if (daysRemaining > 0 && daysRemaining <= 30) {
      alerts.push({
        id: `bas-${quarter.replace(/\s/g, "-")}`,
        shopId,
        type: "bas_due",
        severity: daysRemaining <= 7 ? "critical" : "warning",
        title: `BAS Due \u2014 ${quarter}`,
        message: `Submit to ATO by ${due.toLocaleDateString("en-AU")} (${daysRemaining} days)`,
        daysRemaining,
        actionUrl: "https://www.ato.gov.au/bas",
        createdAt: new Date().toISOString(),
        dismissed: false
      });
    }
  });
  return alerts;
}
async function checkRevenueAlerts(shopId) {
  const alerts = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data: todayBookings } = await supabase.from("bookings").select("id").eq("shop_id", shopId).gte("start_time", today.toISOString()).lt("start_time", new Date(today.getTime() + 864e5).toISOString()).neq("status", "cancelled");
  if (!todayBookings || todayBookings.length === 0) {
    alerts.push({
      id: `no-bookings-${today.toISOString()}`,
      shopId,
      type: "no_bookings",
      severity: "notice",
      title: "No bookings today",
      message: "Consider posting on social media or running a same-day promotion",
      createdAt: new Date().toISOString(),
      dismissed: false
    });
  }
  return alerts;
}

// api/phase6Routes.ts
var LEGACY_TRANSACTION_HEADERS = [
  "Date",
  "Receipt No",
  "Client",
  "Services",
  "Gross ($)",
  "GST Collected ($)",
  "Ex-GST ($)",
  "GST-Free ($)",
  "Card Surcharge ($)",
  "Tips ($)",
  "Total Charged ($)",
  "Payment Method",
  "GP Cost ($)",
  "Net Revenue ($)",
  "Therapist",
  "Status",
  "Health Fund"
];
async function getSheetsClient() {
  const auth = new import_googleapis.google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  return import_googleapis.google.sheets({ version: "v4", auth });
}
async function syncSheetHandler(req, res) {
  if (req.method !== "POST")
    return res.status(405).end();
  const tx = req.body.transaction;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  try {
    const sheets = await getSheetsClient();
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Transactions!A1:Q1"
    });
    if (!headerRes.data.values || headerRes.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Transactions!A1",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [LEGACY_TRANSACTION_HEADERS] }
      });
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Transactions!A:Q",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [buildTransactionRow(tx)] }
    });
    return res.json({ success: true });
  } catch (err) {
    console.error("[Sheet sync]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
async function driveUploadHandler(req, res) {
  if (req.method !== "POST")
    return res.status(405).end();
  const form = (0, import_formidable.default)({ maxFileSize: 10 * 1024 * 1024 });
  const [fields, files] = await form.parse(req);
  const shopId = fields.shopId?.[0] ?? "unknown";
  const fileName = fields.fileName?.[0] ?? "document.pdf";
  const file = files.file?.[0];
  if (!file)
    return res.status(400).json({ error: "No file" });
  try {
    const auth = new import_googleapis2.google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
      scopes: ["https://www.googleapis.com/auth/drive.file"]
    });
    const drive = import_googleapis2.google.drive({ version: "v3", auth });
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const shopFolderRes = await drive.files.list({
      q: `'${rootFolderId}' in parents and name='${shopId}' and mimeType='application/vnd.google-apps.folder'`,
      fields: "files(id)"
    });
    let folderId;
    if (shopFolderRes.data.files?.length) {
      folderId = shopFolderRes.data.files[0].id;
    } else {
      const created = await drive.files.create({
        requestBody: {
          name: shopId,
          mimeType: "application/vnd.google-apps.folder",
          parents: [rootFolderId]
        },
        fields: "id"
      });
      folderId = created.data.id;
    }
    const uploaded = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: {
        mimeType: "application/pdf",
        body: import_fs.default.createReadStream(file.filepath)
      },
      fields: "id, webViewLink"
    });
    import_fs.default.unlinkSync(file.filepath);
    return res.json({ driveUrl: uploaded.data.webViewLink });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
async function cronAlertsHandler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }
  const supabase2 = (0, import_supabase_js2.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: shops } = await supabase2.from("shops").select("id, name, phone, email").eq("active", true);
  if (!shops)
    return res.json({ processed: 0 });
  let processed = 0;
  for (const shop of shops) {
    const alerts = await checkAllAlerts(shop.id);
    const critical = alerts.filter((a) => a.severity === "critical");
    if (critical.length > 0 && shop.phone) {
      const msg = [
        `\u26A0\uFE0F Chapter99 Alert \u2014 ${shop.name}`,
        ...critical.slice(0, 3).map((a) => `\u{1F534} ${a.title}: ${a.message}`),
        `
Login to manage: chapter99solutions.com.au/admin`
      ].join("\n");
      await fetch(`${process.env.VERCEL_URL}/api/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: shop.phone, message: msg })
      });
    }
    processed++;
  }
  return res.json({ processed, timestamp: new Date().toISOString() });
}
var VERCEL_CONFIG = {
  crons: [
    {
      path: "/api/cron/alerts",
      schedule: "0 22 * * *"
    },
    {
      path: "/api/cron/monthly-report",
      schedule: "0 22 1 * *"
    }
  ]
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  VERCEL_CONFIG,
  cronAlertsHandler,
  driveUploadHandler,
  syncSheetHandler
});
