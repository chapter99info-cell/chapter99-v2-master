var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// api/cron/daily-sheets.ts
var daily_sheets_exports = {};
__export(daily_sheets_exports, {
  default: () => handler
});
module.exports = __toCommonJS(daily_sheets_exports);
var import_supabase_js = require("@supabase/supabase-js");

// api/sheetsSyncCore.ts
var import_google_auth_library = require("google-auth-library");
var import_google_spreadsheet = require("google-spreadsheet");

// src/lib/sheetConstants.ts
var DAILY_SUMMARY_HEADERS = [
  "date",
  "total_revenue",
  "total_bookings",
  "payment_methods_breakdown"
];

// api/sheetsSyncCore.ts
var SHEET_TRANSACTIONS = "Transactions";
var SHEET_BOOKINGS = "Bookings";
var SHEET_DAILY_SUMMARY = "Daily Summary";
function parseSpreadsheetId(urlOrId) {
  const trimmed = urlOrId.trim();
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed) && !trimmed.includes("/")) {
    return trimmed;
  }
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}
function getServiceAccountAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY in environment");
  }
  return new import_google_auth_library.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}
async function openSpreadsheet(spreadsheetUrl) {
  const spreadsheetId = parseSpreadsheetId(spreadsheetUrl);
  if (!spreadsheetId) {
    throw new Error("Invalid Google Sheet URL or spreadsheet ID");
  }
  const doc = new import_google_spreadsheet.GoogleSpreadsheet(spreadsheetId, getServiceAccountAuth());
  await doc.loadInfo();
  return doc;
}
async function ensureSheet(doc, title, headers) {
  let sheet = doc.sheetsByTitle[title];
  if (!sheet) {
    sheet = await doc.addSheet({ title, headerValues: headers });
    return sheet;
  }
  await sheet.loadHeaderRow();
  if (!sheet.headerValues?.length) {
    await sheet.setHeaderRow(headers);
  }
  return sheet;
}
async function upsertDailySummary(spreadsheetUrl, date, totalRevenue, totalBookings, paymentBreakdown) {
  const doc = await openSpreadsheet(spreadsheetUrl);
  const sheet = await ensureSheet(doc, SHEET_DAILY_SUMMARY, [...DAILY_SUMMARY_HEADERS]);
  await sheet.loadCells();
  const rows = await sheet.getRows();
  const existing = rows.find((r) => String(r.get("date")) === date);
  const breakdownStr = Object.entries(paymentBreakdown).map(([method, amt]) => `${method}: $${amt.toFixed(2)}`).join(" | ");
  if (existing) {
    existing.set("total_revenue", totalRevenue);
    existing.set("total_bookings", totalBookings);
    existing.set("payment_methods_breakdown", breakdownStr);
    await existing.save();
  } else {
    await sheet.addRow({
      date,
      total_revenue: totalRevenue,
      total_bookings: totalBookings,
      payment_methods_breakdown: breakdownStr
    });
  }
}
async function refreshDailySummaryFromTransactions(spreadsheetUrl, date) {
  const doc = await openSpreadsheet(spreadsheetUrl);
  const txSheet = doc.sheetsByTitle[SHEET_TRANSACTIONS];
  if (!txSheet) {
    await upsertDailySummary(spreadsheetUrl, date, 0, 0, {});
    return;
  }
  await txSheet.loadHeaderRow();
  const rows = await txSheet.getRows();
  const dayRows = rows.filter((r) => String(r.get("date")) === date);
  let totalRevenue = 0;
  const breakdown = {};
  for (const row of dayRows) {
    const amount = Number(row.get("amount")) || 0;
    const method = String(row.get("payment_method") || "unknown").toLowerCase();
    totalRevenue += amount;
    breakdown[method] = (breakdown[method] || 0) + amount;
  }
  const bookSheet = doc.sheetsByTitle[SHEET_BOOKINGS];
  let totalBookings = 0;
  if (bookSheet) {
    await bookSheet.loadHeaderRow();
    const bookRows = await bookSheet.getRows();
    totalBookings = bookRows.filter((r) => String(r.get("date")) === date).length;
  }
  await upsertDailySummary(spreadsheetUrl, date, Math.round(totalRevenue * 100) / 100, totalBookings, breakdown);
}

// api/cron/daily-sheets.ts
async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const supabase = (0, import_supabase_js.createClient)(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  const dateStr = new Date().toLocaleDateString("en-AU", {
    timeZone: "Australia/Sydney"
  });
  const { data: shops, error } = await supabase.from("shops").select("id, name, google_sheet_url, google_sheet_sync_enabled").eq("active", true).eq("google_sheet_sync_enabled", true).not("google_sheet_url", "is", null);
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  let processed = 0;
  const failures = [];
  for (const shop of shops ?? []) {
    if (!shop.google_sheet_url)
      continue;
    try {
      await refreshDailySummaryFromTransactions(shop.google_sheet_url, dateStr);
      processed++;
    } catch (err) {
      failures.push({
        shopId: shop.id,
        error: err instanceof Error ? err.message : "Unknown error"
      });
    }
  }
  return res.json({
    success: true,
    date: dateStr,
    processed,
    failures
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {});
