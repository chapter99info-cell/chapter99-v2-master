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

// api/sheets-sync.ts
var sheets_sync_exports = {};
__export(sheets_sync_exports, {
  default: () => handler
});
module.exports = __toCommonJS(sheets_sync_exports);

// api/sheetsSyncCore.ts
var import_google_auth_library = require("google-auth-library");
var import_google_spreadsheet = require("google-spreadsheet");

// src/lib/sheetConstants.ts
var TRANSACTION_HEADERS = [
  "transaction_id",
  "date",
  "time",
  "services",
  "amount",
  "GST",
  "payment_method",
  "customer"
];
var BOOKING_HEADERS = [
  "booking_id",
  "date",
  "time",
  "service",
  "customer",
  "phone",
  "status"
];
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
async function testSpreadsheetConnection(spreadsheetUrl) {
  const doc = await openSpreadsheet(spreadsheetUrl);
  return {
    title: doc.title,
    sheetTitles: doc.sheetsByIndex.map((s) => s.title)
  };
}
function txToSheetRow(tx) {
  const paidAt = new Date(tx.paidAt ?? tx.createdAt);
  return {
    transaction_id: tx.id,
    date: paidAt.toLocaleDateString("en-AU"),
    time: paidAt.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }),
    services: tx.items.map((i) => i.serviceName).join(", "),
    amount: tx.payment.total,
    GST: tx.payment.gst,
    payment_method: tx.paymentMethod.toUpperCase(),
    customer: tx.clientName ?? ""
  };
}
async function appendTransactionRow(spreadsheetUrl, tx) {
  const doc = await openSpreadsheet(spreadsheetUrl);
  const sheet = await ensureSheet(doc, SHEET_TRANSACTIONS, [...TRANSACTION_HEADERS]);
  await sheet.addRow(txToSheetRow(tx));
}
async function appendBookingRow(spreadsheetUrl, booking) {
  const doc = await openSpreadsheet(spreadsheetUrl);
  const sheet = await ensureSheet(doc, SHEET_BOOKINGS, [...BOOKING_HEADERS]);
  await sheet.addRow({
    booking_id: booking.bookingId,
    date: booking.date,
    time: booking.time,
    service: booking.service,
    customer: booking.customer,
    phone: booking.phone,
    status: booking.status
  });
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

// api/sheets-sync.ts
async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const body = req.body;
  const { action, spreadsheetUrl } = body;
  if (!action) {
    return res.status(400).json({ error: "Missing action" });
  }
  if (!spreadsheetUrl?.trim()) {
    return res.status(400).json({ error: "Missing spreadsheetUrl" });
  }
  try {
    switch (action) {
      case "test": {
        const info = await testSpreadsheetConnection(spreadsheetUrl);
        return res.json({ success: true, ...info });
      }
      case "sync_transaction": {
        if (!body.transaction) {
          return res.status(400).json({ error: "Missing transaction" });
        }
        await appendTransactionRow(spreadsheetUrl, body.transaction);
        const paidAt = new Date(body.transaction.paidAt ?? body.transaction.createdAt);
        const dateStr = paidAt.toLocaleDateString("en-AU");
        await refreshDailySummaryFromTransactions(spreadsheetUrl, dateStr);
        return res.json({ success: true });
      }
      case "sync_booking": {
        if (!body.booking) {
          return res.status(400).json({ error: "Missing booking" });
        }
        await appendBookingRow(spreadsheetUrl, body.booking);
        await refreshDailySummaryFromTransactions(spreadsheetUrl, body.booking.date);
        return res.json({ success: true });
      }
      case "daily_summary": {
        const dateStr = body.date ?? new Date().toLocaleDateString("en-AU", { timeZone: "Australia/Sydney" });
        await refreshDailySummaryFromTransactions(spreadsheetUrl, dateStr);
        return res.json({ success: true, date: dateStr });
      }
      default:
        return res.status(400).json({ error: "Unknown action" });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sheets sync failed";
    console.error("[sheets-sync]", action, message);
    return res.status(500).json({ error: message });
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {});
