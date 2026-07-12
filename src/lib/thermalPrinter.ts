// Thermal printer: Sunmi JS bridge → Web USB → browser print

import type { Transaction, Shop } from '../types/pos'
import { formatAUD } from './posCalc'

// 80mm thermal = 48 characters per line
const LINE_WIDTH = 48

/** Injected by android-sunmi-shell WebView (au.com.chapter99.sunmishell). */
type Chapter99SunmiBridge = {
  isAvailable: () => boolean
  printText: (text: string) => boolean
  printRawBase64?: (base64: string) => boolean
}

declare global {
  interface Window {
    Chapter99Sunmi?: Chapter99SunmiBridge
  }
}

function center(text: string): string {
  const pad = Math.max(0, Math.floor((LINE_WIDTH - text.length) / 2))
  return ' '.repeat(pad) + text
}

function leftRight(left: string, right: string): string {
  const gap = LINE_WIDTH - left.length - right.length
  return gap > 0 ? left + ' '.repeat(gap) + right : left + ' ' + right
}

function divider(char = '─'): string {
  return char.repeat(LINE_WIDTH)
}

// Generate ESC/POS text receipt
export function buildReceiptText(tx: Transaction, shop: Shop): string {
  const date = new Date(tx.paidAt ?? tx.createdAt)
  const dateStr = date.toLocaleDateString('en-AU')
  const timeStr = date.toLocaleTimeString('en-AU', {
    hour: '2-digit', minute: '2-digit',
  })

  const lines: string[] = [
    '',
    center(shop.name.toUpperCase()),
    center(shop.address),
    center(`Phone: ${shop.phone}`),
    center(`ABN: ${shop.abn}`),
    divider(),
    leftRight(`Receipt: ${tx.id}`, ''),
    leftRight(`Date: ${dateStr}`, `Time: ${timeStr}`),
    tx.therapistName
      ? leftRight('Therapist:', tx.therapistName)
      : '',
    divider(),
  ]

  // Items
  tx.items.forEach(item => {
    lines.push(leftRight(item.serviceName, formatAUD(item.price)))
    lines.push(`  ${item.duration} min${item.gstFree ? ' (GST-free)' : ''}`)
  })

  lines.push(divider())

  // Totals
  lines.push(leftRight('Subtotal (ex GST):', formatAUD(tx.payment.exGst)))
  lines.push(leftRight('GST (1/11):', formatAUD(tx.payment.gst)))

  if (tx.payment.surcharge > 0) {
    lines.push(leftRight('Card surcharge (1.5%):', formatAUD(tx.payment.surcharge)))
  }

  lines.push(divider('═'))
  lines.push(leftRight('TOTAL:', formatAUD(tx.payment.total)))
  lines.push(leftRight('Payment:', tx.paymentMethod.toUpperCase()))

  if (tx.payment.gstFreeAmt > 0) {
    lines.push('')
    lines.push(`GST-free portion: ${formatAUD(tx.payment.gstFreeAmt)}`)
  }

  lines.push(divider())
  lines.push(center('Thank you for your visit!'))
  lines.push(center('Book online:'))
  lines.push(center('thaibliss.com.au'))
  lines.push(divider())
  lines.push('')
  lines.push('')
  lines.push('')   // Feed before cut

  return lines.filter(l => l !== null).join('\n')
}

export function hasSunmiBridge(): boolean {
  try {
    const bridge = window.Chapter99Sunmi
    return Boolean(bridge && typeof bridge.isAvailable === 'function' && bridge.isAvailable())
  } catch {
    return false
  }
}

/** Print via Sunmi Mini shell JS bridge (AIDL print service). */
export async function printViaSunmi(text: string): Promise<boolean> {
  try {
    if (!hasSunmiBridge()) return false
    const ok = window.Chapter99Sunmi!.printText(text)
    if (ok) console.info('[Printer] printed via Chapter99Sunmi bridge')
    return ok === true
  } catch (err) {
    console.error('[Printer] Sunmi bridge error:', err)
    return false
  }
}

// Print via Web USB (direct to Epson/Star USB printer)
export async function printViaUSB(text: string): Promise<boolean> {
  try {
    if (!('usb' in navigator)) {
      console.warn('[Printer] Web USB not supported')
      return false
    }
    // Request USB device (Epson VendorId: 0x04b8, Star: 0x0519)
    const device = await (navigator as any).usb.requestDevice({
      filters: [
        { vendorId: 0x04b8 },  // Epson
        { vendorId: 0x0519 },  // Star
        { vendorId: 0x0416 },  // MUNBYN
      ],
    })
    await device.open()
    await device.selectConfiguration(1)
    await device.claimInterface(0)

    const encoder = new TextEncoder()
    const data = encoder.encode(text)

    // ESC/POS: initialize + cut
    const init = new Uint8Array([0x1b, 0x40])          // ESC @
    const cut = new Uint8Array([0x1d, 0x56, 0x41, 0x00]) // GS V A

    const full = new Uint8Array(init.length + data.length + cut.length)
    full.set(init, 0)
    full.set(data, init.length)
    full.set(cut, init.length + data.length)

    await device.transferOut(1, full)
    await device.close()
    return true
  } catch (err) {
    console.error('[Printer] USB print error:', err)
    return false
  }
}

// Fallback: print via browser print dialog (formatted)
export function printViaBrowser(tx: Transaction, shop: Shop): void {
  const text = buildReceiptText(tx, shop)
  const logoHtml = shop.logoUrl
    ? `<div style="text-align:center;margin-bottom:8px;"><img src="${shop.logoUrl}" alt="${shop.name}" style="max-width:120px;max-height:48px;object-fit:contain;" /></div>`
    : ''
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(`
    <html>
    <head>
      <title>Receipt ${tx.id}</title>
      <style>
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          width: 280px;
          margin: 0 auto;
          padding: 8px;
        }
        pre { white-space: pre-wrap; }
        @media print {
          @page { margin: 4mm; size: 80mm auto; }
        }
      </style>
    </head>
    <body>
      ${logoHtml}
      <pre>${text}</pre>
      <script>window.onload = () => { window.print(); window.close(); }<\/script>
    </body>
    </html>
  `)
  win.document.close()
}

/**
 * Main print — Sunmi bridge first, then Web USB, then browser dialog.
 * Reuses buildReceiptText layout for all paths.
 */
export async function printReceipt(
  tx: Transaction,
  shop: Shop
): Promise<void> {
  const text = buildReceiptText(tx, shop)

  if (await printViaSunmi(text)) return

  const usbOk = await printViaUSB(text)
  if (!usbOk) {
    printViaBrowser(tx, shop)
  }
}
