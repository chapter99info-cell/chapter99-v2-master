// Chapter99 V4 — Receipt PDF (jsPDF)

import type { jsPDF } from 'jspdf'
import type { Transaction, Shop } from '../../types/pos'
import { formatAUD } from '../../lib/posCalc'
import { loadShopLogoDataUrl } from '../../lib/shopLogo'

export interface ReceiptPDFOptions {
  receiptNumber: string
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  payid: 'PayID',
  card: 'Card',
  hicaps: 'HICAPS / Health Fund',
  amex: 'American Express',
}

function hexToRgb(hex: string): [number, number, number] {
  const h = (hex || '#0F6E56').replace('#', '')
  if (h.length !== 6) return [15, 110, 86]
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

/** Build jsPDF document for a paid transaction */
export async function buildReceiptPDF(
  tx: Transaction,
  shop: Shop,
  options: ReceiptPDFOptions
): Promise<jsPDF> {
  const { jsPDF: JsPDF } = await import('jspdf')
  const doc = new JsPDF({ unit: 'mm', format: 'a4' })
  const theme = hexToRgb(shop.themeColor)
  const margin = 18
  let y = margin
  const pageW = doc.internal.pageSize.getWidth()
  const contentW = pageW - margin * 2

  const paidAt = new Date(tx.paidAt ?? tx.createdAt)
  const dateStr = paidAt.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timeStr = paidAt.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  })

  // Logo
  const logoData = shop.logoUrl ? await loadShopLogoDataUrl(shop.logoUrl) : null
  const hasLogo = !!logoData
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', margin, y, 28, 28)
    } catch {
      /* skip broken logo */
    }
  }

  // Shop name & details
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(theme[0], theme[1], theme[2])
  doc.text(shop.name, hasLogo ? margin + 32 : margin, y + 8)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  let detailY = y + 14
  const detailX = hasLogo ? margin + 32 : margin
  if (shop.address) {
    doc.text(shop.address, detailX, detailY)
    detailY += 4
  }
  if (shop.phone) {
    doc.text(`Phone: ${shop.phone}`, detailX, detailY)
    detailY += 4
  }
  if (shop.abn) {
    doc.text(`ABN: ${shop.abn}`, detailX, detailY)
    detailY += 4
  }

  // Receipt title (right)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(theme[0], theme[1], theme[2])
  doc.text('TAX INVOICE', pageW - margin, y + 4, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  doc.text(`Receipt: ${options.receiptNumber}`, pageW - margin, y + 12, { align: 'right' })
  doc.text(`Transaction: ${tx.id}`, pageW - margin, y + 17, { align: 'right' })
  doc.text(`Date: ${dateStr}`, pageW - margin, y + 22, { align: 'right' })
  doc.text(`Time: ${timeStr}`, pageW - margin, y + 27, { align: 'right' })

  y = Math.max(y + 32, detailY + 6)
  doc.setDrawColor(theme[0], theme[1], theme[2])
  doc.setLineWidth(0.8)
  doc.line(margin, y, pageW - margin, y)
  y += 10

  // Client
  if (tx.clientName || tx.clientEmail) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(theme[0], theme[1], theme[2])
    doc.text('BILL TO', margin, y)
    y += 5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(30, 30, 30)
    if (tx.clientName) {
      doc.text(tx.clientName, margin, y)
      y += 5
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    if (tx.clientEmail) {
      doc.text(tx.clientEmail, margin, y)
      y += 5
    }
    y += 4
  }

  // Services table header
  doc.setFillColor(theme[0], theme[1], theme[2])
  doc.rect(margin, y, contentW, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('Description', margin + 3, y + 5.5)
  doc.text('Amount', pageW - margin - 3, y + 5.5, { align: 'right' })
  y += 10

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(40, 40, 40)

  for (const item of tx.items) {
    if (y > 250) {
      doc.addPage()
      y = margin
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(item.serviceName, margin + 2, y)
    doc.text(formatAUD(item.price), pageW - margin - 2, y, { align: 'right' })
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    let sub = `${item.duration} min`
    if (item.itemNo) sub += ` · Item ${item.itemNo}`
    if (item.gstFree) sub += ' · GST-free'
    doc.text(sub, margin + 2, y)
    y += 7
    doc.setTextColor(40, 40, 40)
  }

  y += 4
  doc.setDrawColor(220, 220, 220)
  doc.line(margin, y, pageW - margin, y)
  y += 8

  // Totals
  const addTotalRow = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 12 : 9)
    doc.setTextColor(bold ? theme[0] : 60, bold ? theme[1] : 60, bold ? theme[2] : 60)
    doc.text(label, margin + 2, y)
    doc.text(value, pageW - margin - 2, y, { align: 'right' })
    y += bold ? 8 : 5
  }

  addTotalRow('Subtotal (ex GST)', formatAUD(tx.payment.exGst))

  if (shop.gstRegistered) {
    addTotalRow('GST (1/11)', formatAUD(tx.payment.gst))
    if (tx.payment.gstFreeAmt > 0) {
      addTotalRow('GST-free portion', formatAUD(tx.payment.gstFreeAmt))
    }
  }

  if (tx.payment.surcharge > 0) {
    addTotalRow(
      `Card surcharge (${(tx.payment.surchargeRate * 100).toFixed(1)}%)`,
      formatAUD(tx.payment.surcharge)
    )
  }

  y += 2
  doc.setDrawColor(theme[0], theme[1], theme[2])
  doc.line(margin, y, pageW - margin, y)
  y += 6
  addTotalRow('TOTAL PAID', formatAUD(tx.payment.total), true)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)
  doc.text(
    `Payment method: ${PAYMENT_LABELS[tx.paymentMethod] ?? tx.paymentMethod.toUpperCase()}`,
    margin + 2,
    y
  )
  y += 10

  // Health fund block
  if (tx.paymentMethod === 'hicaps' || shop.providerName || shop.providerNumber) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(theme[0], theme[1], theme[2])
    doc.text('HEALTH FUND PROVIDER', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(50, 50, 50)
    if (shop.providerName) {
      doc.text(`Provider: ${shop.providerName}`, margin, y)
      y += 5
    }
    if (shop.providerNumber) {
      doc.text(`Provider No: ${shop.providerNumber}`, margin, y)
      y += 5
    }
    y += 4
  }

  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text('Thank you for your visit · Powered by Chapter99', pageW / 2, 285, { align: 'center' })

  return doc
}

export async function generateReceiptPDFBlob(
  tx: Transaction,
  shop: Shop,
  options: ReceiptPDFOptions
): Promise<Blob> {
  const doc = await buildReceiptPDF(tx, shop, options)
  return doc.output('blob')
}

export async function receiptPDFToBase64(
  tx: Transaction,
  shop: Shop,
  options: ReceiptPDFOptions
): Promise<string> {
  const doc = await buildReceiptPDF(tx, shop, options)
  return doc.output('datauristring').split(',')[1]
}

export async function downloadReceiptPDF(
  tx: Transaction,
  shop: Shop,
  options: ReceiptPDFOptions
): Promise<void> {
  const doc = await buildReceiptPDF(tx, shop, options)
  doc.save(`Receipt-${options.receiptNumber}.pdf`)
}

/** @deprecated use generateReceiptPDFBlob */
export async function generateReceiptPDF(
  tx: Transaction,
  shop: Shop,
  options: ReceiptPDFOptions
): Promise<Blob> {
  return generateReceiptPDFBlob(tx, shop, options)
}
