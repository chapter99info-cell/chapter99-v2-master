// Chapter99 V4 — Tax receipt PDF (@react-pdf/renderer)

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

function buildStyles(themeColor: string) {
  return StyleSheet.create({
    page: {
      fontFamily: 'Helvetica',
      fontSize: 10,
      padding: 40,
      color: '#1a1a1a',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 20,
      borderBottomWidth: 2,
      borderBottomColor: themeColor,
      paddingBottom: 14,
    },
    logo: { width: 72, height: 72, objectFit: 'contain', marginRight: 12 },
    shopBlock: { flex: 1 },
    shopName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: themeColor },
    shopDetail: { fontSize: 9, color: '#555', lineHeight: 1.5, marginTop: 2 },
    receiptTitle: {
      fontSize: 20,
      fontFamily: 'Helvetica-Bold',
      color: themeColor,
      textAlign: 'right',
    },
    receiptMeta: { fontSize: 9, color: '#555', marginTop: 4, textAlign: 'right', lineHeight: 1.5 },
    sectionLabel: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: themeColor,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 6,
      marginTop: 12,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: themeColor,
      padding: '6px 10px',
    },
    tableHeaderText: { color: '#fff', fontSize: 9, fontFamily: 'Helvetica-Bold' },
    tableRow: {
      flexDirection: 'row',
      padding: '8px 10px',
      borderBottomWidth: 0.5,
      borderBottomColor: '#eee',
    },
    colDesc: { flex: 3 },
    colAmt: { flex: 1, textAlign: 'right' },
    itemName: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
    itemSub: { fontSize: 8, color: '#777', marginTop: 2 },
    totalsBlock: {
      backgroundColor: '#f8f8f8',
      padding: 12,
      marginTop: 10,
      borderRadius: 4,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    totalLabel: { fontSize: 9, color: '#555' },
    totalVal: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
    grandRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: themeColor,
      marginTop: 8,
      paddingTop: 8,
    },
    grandLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: themeColor },
    grandVal: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: themeColor },
    payMethod: { fontSize: 9, marginTop: 8, color: '#333' },
    providerSection: { marginTop: 16, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: '#ddd' },
    footer: { fontSize: 8, color: '#aaa', marginTop: 20, textAlign: 'center' },
  })
}

interface ReceiptDocProps {
  tx: Transaction
  shop: Shop
  healthFund?: boolean
}

function ReceiptDoc({ tx, shop, healthFund }: ReceiptDocProps) {
  const themeColor = shop.themeColor || '#0F6E56'
  const styles = buildStyles(themeColor)
  const date = new Date(tx.paidAt ?? tx.createdAt)
  const dateStr = date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timeStr = date.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const payLabel: Record<string, string> = {
    cash: 'Cash',
    payid: 'PayID',
    card: 'Card',
    hicaps: 'HICAPS / Health Fund',
    amex: 'American Express',
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', flex: 1 }}>
            {shop.logoUrl ? (
              <Image src={shop.logoUrl} style={styles.logo} />
            ) : null}
            <View style={styles.shopBlock}>
              <Text style={styles.shopName}>{shop.name}</Text>
              {shop.address ? <Text style={styles.shopDetail}>{shop.address}</Text> : null}
              {shop.phone ? <Text style={styles.shopDetail}>Phone: {shop.phone}</Text> : null}
              {shop.email ? <Text style={styles.shopDetail}>{shop.email}</Text> : null}
              {shop.abn ? <Text style={styles.shopDetail}>ABN: {shop.abn}</Text> : null}
            </View>
          </View>
          <View>
            <Text style={styles.receiptTitle}>TAX INVOICE</Text>
            <Text style={styles.receiptMeta}>Receipt No: {tx.id}</Text>
            <Text style={styles.receiptMeta}>Date: {dateStr}</Text>
            <Text style={styles.receiptMeta}>Time: {timeStr}</Text>
          </View>
        </View>

        {tx.clientName ? (
          <View>
            <Text style={styles.sectionLabel}>Bill to</Text>
            <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold' }}>{tx.clientName}</Text>
            {tx.clientEmail ? (
              <Text style={{ fontSize: 9, color: '#555' }}>{tx.clientEmail}</Text>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Services</Text>
        <View>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colDesc]}>Description</Text>
            <Text style={[styles.tableHeaderText, styles.colAmt]}>Amount</Text>
          </View>
          {tx.items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={styles.colDesc}>
                <Text style={styles.itemName}>{item.serviceName}</Text>
                <Text style={styles.itemSub}>{item.duration} min</Text>
                {item.itemNo ? <Text style={styles.itemSub}>Item No: {item.itemNo}</Text> : null}
                {item.gstFree ? <Text style={styles.itemSub}>GST-free</Text> : null}
              </View>
              <Text style={[styles.itemName, styles.colAmt]}>{formatAUD(item.price)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal (ex GST)</Text>
            <Text style={styles.totalVal}>{formatAUD(tx.payment.exGst)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>GST (1/11)</Text>
            <Text style={styles.totalVal}>{formatAUD(tx.payment.gst)}</Text>
          </View>
          {tx.payment.gstFreeAmt > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>GST-free portion</Text>
              <Text style={styles.totalVal}>{formatAUD(tx.payment.gstFreeAmt)}</Text>
            </View>
          ) : null}
          {tx.payment.surcharge > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Card surcharge ({(tx.payment.surchargeRate * 100).toFixed(1)}%)
              </Text>
              <Text style={styles.totalVal}>{formatAUD(tx.payment.surcharge)}</Text>
            </View>
          ) : null}
          {tx.payment.tip > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tip ({tx.payment.tipPct}%)</Text>
              <Text style={styles.totalVal}>{formatAUD(tx.payment.tip)}</Text>
            </View>
          ) : null}
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>TOTAL PAID</Text>
            <Text style={styles.grandVal}>{formatAUD(tx.payment.total)}</Text>
          </View>
          <Text style={styles.payMethod}>
            Payment: {payLabel[tx.paymentMethod] ?? tx.paymentMethod.toUpperCase()}
          </Text>
        </View>

        {healthFund || tx.paymentMethod === 'hicaps' ? (
          <View style={styles.providerSection}>
            <Text style={styles.sectionLabel}>Health fund provider</Text>
            <Text style={{ fontSize: 9 }}>Provider: {shop.providerName || '—'}</Text>
            <Text style={{ fontSize: 9 }}>Provider No: {shop.providerNumber || '—'}</Text>
            {shop.signatureUrl ? (
              <Image src={shop.signatureUrl} style={{ width: 80, height: 32, marginTop: 6 }} />
            ) : null}
          </View>
        ) : null}

        {shop.payidBsb && shop.payidAccount ? (
          <Text style={{ fontSize: 8, color: '#777', marginTop: 10 }}>
            PayID: BSB {shop.payidBsb} · Acc {shop.payidAccount}
          </Text>
        ) : null}

        <Text style={styles.footer}>
          Thank you for your visit · {shop.name} · Powered by Chapter99
        </Text>
      </Page>
    </Document>
  )
}

export async function generateReceiptPDF(
  tx: Transaction,
  shop: Shop,
  options?: { healthFund?: boolean }
): Promise<Blob> {
  const doc = (
    <ReceiptDoc
      tx={tx}
      shop={shop}
      healthFund={options?.healthFund ?? tx.paymentMethod === 'hicaps'}
    />
  )
  return pdf(doc).toBlob()
}

export async function receiptPDFToBase64(
  tx: Transaction,
  shop: Shop,
  options?: { healthFund?: boolean }
): Promise<string> {
  const blob = await generateReceiptPDF(tx, shop, options)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function downloadReceiptPDF(
  tx: Transaction,
  shop: Shop,
  options?: { healthFund?: boolean }
): Promise<void> {
  const blob = await generateReceiptPDF(tx, shop, options)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Receipt-${tx.id}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
