import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Resend } from 'resend'
import type { Transaction } from '../src/types/pos'

const resend = new Resend(process.env.RESEND_API_KEY!)

/** POST /api/email — receipt email with optional PDF attachment */
export async function POST_email(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY is not configured' })
  }

  const { to, subject, shopName, transaction: tx, pdfBase64 } = req.body as {
    to: string
    subject: string
    shopName: string
    transaction: Transaction
    pdfBase64?: string
  }

  const attachments = pdfBase64
    ? [
        {
          filename: `Receipt-${tx.id}.pdf`,
          content: pdfBase64,
        },
      ]
    : []

  try {
    const result = await resend.emails.send({
      from: `${shopName || 'Chapter99'} <receipts@chapter99solutions.com.au>`,
      to,
      subject,
      html: buildEmailHTML(tx, shopName),
      attachments,
    })
    return res.json({ success: true, id: result.data?.id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Email failed'
    return res.status(500).json({ error: message })
  }
}

function buildEmailHTML(tx: Transaction, shopName: string): string {
  const date = new Date(tx.paidAt ?? tx.createdAt).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>Receipt from ${shopName}</title>
</head>
<body style="font-family:-apple-system,sans-serif;background:#f5f4ee;padding:20px">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <div style="background:#0F6E56;padding:24px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:22px">${shopName}</h1>
      <p style="color:#9FE1CB;margin:6px 0 0;font-size:13px">Thank you for your visit!</p>
    </div>
    <div style="padding:24px">
      <p style="font-size:13px;color:#555;margin:0 0 16px">
        Receipt No: <strong>${tx.id}</strong><br>
        Date: ${date}
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr style="background:#f0efe8">
          <th style="padding:8px 10px;text-align:left">Service</th>
          <th style="padding:8px 10px;text-align:right">Amount</th>
        </tr>
        ${tx.items
          .map(
            i => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #f0efe8">
            ${i.serviceName} (${i.duration} min)
          </td>
          <td style="padding:8px 10px;text-align:right;border-bottom:1px solid #f0efe8">
            $${i.price.toFixed(2)}
          </td>
        </tr>`
          )
          .join('')}
      </table>
      <table style="width:100%;font-size:13px;margin-top:12px">
        <tr>
          <td style="padding:3px 0;color:#777">GST (1/11)</td>
          <td style="padding:3px 0;text-align:right">$${tx.payment.gst.toFixed(2)}</td>
        </tr>
        ${
          tx.payment.surcharge > 0
            ? `
        <tr>
          <td style="padding:3px 0;color:#993C1D">Card surcharge (1.5%)</td>
          <td style="padding:3px 0;text-align:right;color:#993C1D">$${tx.payment.surcharge.toFixed(2)}</td>
        </tr>`
            : ''
        }
        <tr style="border-top:1px solid #e0ddd5">
          <td style="padding:10px 0 0;font-size:15px;font-weight:600">Total Paid</td>
          <td style="padding:10px 0 0;text-align:right;font-size:15px;font-weight:600;color:#0F6E56">
            $${tx.payment.total.toFixed(2)} AUD
          </td>
        </tr>
      </table>
      ${
        tx.healthFundIssued
          ? `
      <div style="background:#EAF3DE;border-radius:8px;padding:12px;margin-top:16px;font-size:12px;color:#3B6D11">
        ❤️ Health Fund receipt attached — submit to your health fund for rebate.
      </div>`
          : ''
      }
      <p style="font-size:12px;color:#999;margin-top:20px;text-align:center">
        Powered by Chapter99 · chapter99solutions.com.au
      </p>
    </div>
  </div>
</body>
</html>`
}
