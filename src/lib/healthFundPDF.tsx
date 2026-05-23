// Chapter99 V4 — Phase 5
// Health Fund Receipt PDF Generator
// Uses React-PDF (@react-pdf/renderer)
// HICAPS-compliant, ABN + Provider Number + Item No.

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer'
import type { Transaction, Shop } from '../types/pos'
import { formatAUD } from './posCalc'
import { loadShopLogoDataUrl } from './shopLogo'
import { downloadBlob } from './downloadBlob'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 40,
    color: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    borderBottom: '1px solid #e0e0e0',
    paddingBottom: 16,
  },
  shopBlock: { flex: 1 },
  shopLogo: { width: 48, height: 48, marginBottom: 8, objectFit: 'contain' },
  shopName: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  shopDetail: { fontSize: 9, color: '#555', lineHeight: 1.5 },
  receiptTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold' },
  receiptMeta: { fontSize: 9, color: '#555', marginTop: 4, lineHeight: 1.6 },
  section: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    borderBottom: '0.5px solid #e0e0e0',
    paddingBottom: 4,
  },
  clientName: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  clientSub: { fontSize: 9, color: '#555' },
  table: { marginTop: 8 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0F6E56',
    padding: '8px 10px',
    borderRadius: 3,
    marginBottom: 8,
  },
  tableHeaderText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  tableBody: {
    paddingTop: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    borderBottom: '0.5px solid #eee',
  },
  tableHeaderCol1: { flex: 3 },
  tableHeaderCol2: { flex: 1, textAlign: 'right' },
  tableCellCol1: { flex: 3, paddingTop: 8, paddingBottom: 8 },
  tableCellCol2: { flex: 1, textAlign: 'right', paddingTop: 8, paddingBottom: 8 },
  itemName: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  itemSub: { fontSize: 8, color: '#777' },
  amountPaid: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#0F6E56' },
  totalsBlock: {
    backgroundColor: '#f8f8f8',
    padding: '10px 12px',
    borderRadius: 4,
    marginTop: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  totalLabel: { fontSize: 9, color: '#555' },
  totalVal: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: '1px solid #ccc',
    marginTop: 6,
    paddingTop: 6,
  },
  grandLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  grandVal: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  gstNote: { fontSize: 8, color: '#777', marginTop: 4 },
  providerBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  providerLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  providerVal: { fontSize: 9, color: '#333' },
  signature: { width: 80, height: 32, marginTop: 8 },
  disclaimer: {
    fontSize: 8,
    color: '#888',
    marginTop: 24,
    borderTop: '0.5px solid #e0e0e0',
    paddingTop: 8,
    lineHeight: 1.5,
  },
  footer: {
    fontSize: 8,
    color: '#aaa',
    marginTop: 16,
    textAlign: 'center',
  },
})

interface HealthFundReceiptProps {
  tx: Transaction
  shop: Shop
  logoDataUrl?: string | null
}

function HealthFundReceiptDoc({ tx, shop, logoDataUrl }: HealthFundReceiptProps) {
  const accent = shop.themeColor || '#0F6E56'
  const date = new Date(tx.paidAt ?? tx.createdAt)
  const dateStr = date.toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const timeStr = date.toLocaleTimeString('en-AU', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.shopBlock}>
            {logoDataUrl ? (
              <Image src={logoDataUrl} style={styles.shopLogo} />
            ) : null}
            <Text style={styles.shopName}>{shop.name}</Text>
            <Text style={styles.shopDetail}>{shop.address}</Text>
            <Text style={styles.shopDetail}>Phone: {shop.phone}</Text>
            <Text style={styles.shopDetail}>ABN: {shop.abn}</Text>
          </View>
          <View>
            <Text style={[styles.receiptTitle, { color: accent }]}>RECEIPT</Text>
            <Text style={styles.receiptMeta}>Receipt No: {tx.id}</Text>
            <Text style={styles.receiptMeta}>Date Issued: {dateStr}</Text>
            <Text style={styles.receiptMeta}>Date of Service: {dateStr}</Text>
            <Text style={styles.receiptMeta}>Time: {timeStr}</Text>
          </View>
        </View>

        {/* Invoice To */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Invoice to</Text>
          <Text style={styles.clientName}>{tx.clientName ?? 'Client'}</Text>
          {tx.clientEmail && (
            <Text style={styles.clientSub}>{tx.clientEmail}</Text>
          )}
        </View>

        {/* Services Table */}
        <View style={styles.section}>
          <View style={styles.table}>
            <View style={[styles.tableHeader, { backgroundColor: accent }]}>
              <Text style={[styles.tableHeaderText, styles.tableHeaderCol1]}>Description</Text>
              <Text style={[styles.tableHeaderText, styles.tableHeaderCol2]}>Amount</Text>
            </View>
            <View style={styles.tableBody}>
            {tx.items.map((item, i) => (
              <View key={i} style={styles.tableRow}>
                <View style={styles.tableCellCol1}>
                  <Text style={styles.itemName}>{item.serviceName}</Text>
                  <Text style={styles.itemSub}>Duration: {item.duration} minutes</Text>
                  {item.itemNo && (
                    <Text style={styles.itemSub}>Item No: {item.itemNo}</Text>
                  )}
                  {item.gstFree && (
                    <Text style={styles.itemSub}>GST-free service</Text>
                  )}
                </View>
                <View style={styles.tableCellCol2}>
                  <Text style={styles.amountPaid}>Amount Paid</Text>
                  <Text style={[styles.itemName, { fontSize: 13 }]}>
                    {formatAUD(item.price)}
                  </Text>
                </View>
              </View>
            ))}
            </View>
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandLabel}>Total Paid (incl. GST)</Text>
            <Text style={styles.grandVal}>{formatAUD(tx.payment.total)}</Text>
          </View>
          <Text style={styles.gstNote}>
            GST included (1/11): {formatAUD(tx.payment.gst)} · Ex-GST: {formatAUD(tx.payment.exGst)}
            {tx.payment.gstFreeAmt > 0 &&
              ` · GST-free portion: ${formatAUD(tx.payment.gstFreeAmt)}`}
          </Text>
          {tx.payment.surcharge > 0 && (
            <Text style={styles.gstNote}>
              Card surcharge (1.5% — ACCC compliant): {formatAUD(tx.payment.surcharge)}
            </Text>
          )}
        </View>

        {/* Provider Details */}
        <View style={[styles.section, { marginTop: 20 }]}>
          <Text style={styles.sectionLabel}>Provider Details</Text>
          <View style={styles.providerBlock}>
            <View>
              <Text style={styles.providerLabel}>Provider Name</Text>
              <Text style={styles.providerVal}>{shop.providerName}</Text>
              <Text style={[styles.providerLabel, { marginTop: 8 }]}>Phone</Text>
              <Text style={styles.providerVal}>{shop.phone}</Text>
              <Text style={[styles.providerLabel, { marginTop: 8 }]}>
                Provider Signature
              </Text>
              {shop.signatureUrl && (
                <Image src={shop.signatureUrl} style={styles.signature} />
              )}
            </View>
            <View>
              <Text style={styles.providerLabel}>Provider Number</Text>
              <Text style={styles.providerVal}>{shop.providerNumber}</Text>
              <Text style={[styles.providerLabel, { marginTop: 8 }]}>ABN</Text>
              <Text style={styles.providerVal}>{shop.abn}</Text>
            </View>
          </View>
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          This receipt is issued for health fund claim purposes only.
          Claims are subject to individual health fund policies.
          Please check with your health fund for applicable rebates.
        </Text>

        {/* Footer */}
        <Text style={styles.footer}>
          Receipt No: {tx.id} · Issued: {dateStr} · Powered by Chapter99
        </Text>

      </Page>
    </Document>
  )
}

// Generate PDF as blob (for download or email attachment)
export async function generateHealthFundPDF(
  tx: Transaction,
  shop: Shop
): Promise<Blob> {
  const logoDataUrl = shop.logoUrl ? await loadShopLogoDataUrl(shop.logoUrl) : null
  const doc = <HealthFundReceiptDoc tx={tx} shop={shop} logoDataUrl={logoDataUrl} />
  return await pdf(doc).toBlob()
}

// Generate PDF as base64 (for email API)
export async function generateHealthFundBase64(
  tx: Transaction,
  shop: Shop
): Promise<string> {
  const blob = await generateHealthFundPDF(tx, shop)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Download PDF directly in browser (no popup — anchor download)
export async function downloadHealthFundPDF(
  tx: Transaction,
  shop: Shop
): Promise<void> {
  const blob = await generateHealthFundPDF(tx, shop)
  const safeId = tx.id.replace(/[^\w.-]+/g, '_')
  await downloadBlob(blob, `HealthFund-${safeId}.pdf`)
}
