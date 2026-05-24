export interface BookingConfirmationEmailPayload {
  to: string
  clientName: string
  serviceName: string
  durationMin: number
  date: string
  time: string
  therapistLabel: string
  shopName: string
  shopAddress?: string
  shopPhone?: string
  shopEmail?: string
  logoUrl?: string
  bookingRef: string
  cancelUrl?: string
  totalPrice?: number
  depositPaid?: number
  balanceDue?: number
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildBookingConfirmationSubject(shopName: string): string {
  return `Booking Confirmed — ${shopName}`
}

export function buildBookingConfirmationText(p: BookingConfirmationEmailPayload): string {
  const price =
    p.totalPrice != null ? `\nService total: $${p.totalPrice.toFixed(2)} AUD\n` : ''
  const deposit =
    p.depositPaid != null
      ? `Deposit paid: $${p.depositPaid.toFixed(2)} AUD\n`
      : ''
  const balance =
    p.balanceDue != null && p.balanceDue > 0
      ? `Balance due at visit: $${p.balanceDue.toFixed(2)} AUD\n`
      : ''
  return `Hi ${p.clientName},

Thank you — your booking is confirmed at ${p.shopName}.

Booking reference: ${p.bookingRef}

Service: ${p.serviceName} (${p.durationMin} minutes)
Date: ${p.date}
Time: ${p.time}
Therapist: ${p.therapistLabel}
${price}${deposit}${balance}
${p.shopAddress ? `Location: ${p.shopAddress}\n` : ''}${p.shopPhone ? `Phone: ${p.shopPhone}\n` : ''}${p.shopEmail ? `Email: ${p.shopEmail}\n` : ''}
Cancellation policy: Please give at least 24 hours notice to cancel or reschedule.

${p.cancelUrl ? `Cancel booking: ${p.cancelUrl}\n` : ''}
We look forward to seeing you.

— ${p.shopName}`
}

export function buildBookingConfirmationHTML(p: BookingConfirmationEmailPayload): string {
  const shop = escapeHtml(p.shopName)
  const name = escapeHtml(p.clientName)
  const service = escapeHtml(p.serviceName)
  const date = escapeHtml(p.date)
  const time = escapeHtml(p.time)
  const therapist = escapeHtml(p.therapistLabel)
  const ref = escapeHtml(p.bookingRef)
  const address = p.shopAddress ? escapeHtml(p.shopAddress) : ''
  const phone = p.shopPhone ? escapeHtml(p.shopPhone) : ''
  const email = p.shopEmail ? escapeHtml(p.shopEmail) : ''
  const logo = p.logoUrl
    ? `<img src="${escapeHtml(p.logoUrl)}" alt="${shop}" width="120" style="max-height:56px;object-fit:contain;margin-bottom:12px;" />`
    : ''
  const priceRow =
    p.totalPrice != null
      ? `<tr><td style="padding:10px 16px;border-bottom:1px solid #e8e6e0;"><span style="color:#666;font-size:13px;">Service total</span><br><strong>$${p.totalPrice.toFixed(2)} AUD</strong></td></tr>`
      : ''
  const depositRow =
    p.depositPaid != null
      ? `<tr><td style="padding:10px 16px;border-bottom:1px solid #e8e6e0;"><span style="color:#666;font-size:13px;">Deposit paid</span><br><strong style="color:#1a3d2b;">$${p.depositPaid.toFixed(2)} AUD</strong></td></tr>`
      : ''
  const balanceRow =
    p.balanceDue != null && p.balanceDue > 0
      ? `<tr><td style="padding:10px 16px;border-bottom:1px solid #e8e6e0;"><span style="color:#666;font-size:13px;">Balance due at visit</span><br><strong>$${p.balanceDue.toFixed(2)} AUD</strong></td></tr>`
      : ''
  const cancelBtn = p.cancelUrl
    ? `<p style="margin:20px 0 0;text-align:center;"><a href="${escapeHtml(p.cancelUrl)}" style="display:inline-block;padding:12px 20px;background:#993c1d;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;">Cancel booking</a></p>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f0efe8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0efe8;padding:24px 12px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e0ddd5;">
        <tr>
          <td style="background:#1a3d2b;padding:28px 24px;text-align:center;">
            ${logo}
            <p style="margin:0;font-size:22px;color:#F5F0E6;font-weight:600;">${shop}</p>
            <p style="margin:8px 0 0;font-size:14px;color:#C9A227;letter-spacing:0.08em;text-transform:uppercase;">Booking confirmed</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 24px;color:#2c2c2c;font-size:15px;line-height:1.6;">
            <p style="margin:0 0 16px;">Hi <strong>${name}</strong>,</p>
            <p style="margin:0 0 12px;">Thank you for your booking. Your appointment is confirmed.</p>
            <p style="margin:0 0 20px;font-size:14px;color:#1a3d2b;"><strong>Reference:</strong> ${ref}</p>
            <table width="100%" style="background:#f8f7f4;border-radius:8px;">
              <tr><td style="padding:10px 16px;border-bottom:1px solid #e8e6e0;"><span style="color:#666;font-size:13px;">Service</span><br><strong>${service}</strong> · ${p.durationMin} min</td></tr>
              <tr><td style="padding:10px 16px;border-bottom:1px solid #e8e6e0;"><span style="color:#666;font-size:13px;">Date & time</span><br><strong>${date}</strong> at <strong>${time}</strong></td></tr>
              <tr><td style="padding:10px 16px;border-bottom:1px solid #e8e6e0;"><span style="color:#666;font-size:13px;">Therapist</span><br><strong>${therapist}</strong></td></tr>
              ${priceRow}
              ${depositRow}
              ${balanceRow}
            </table>
            ${address ? `<p style="margin:16px 0 4px;font-size:14px;"><strong>Location:</strong> ${address}</p>` : ''}
            ${phone ? `<p style="margin:4px 0;"><strong>Phone:</strong> ${phone}</p>` : ''}
            ${email ? `<p style="margin:4px 0;"><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>` : ''}
            <p style="margin:20px 0 0;padding:12px;background:#f0f7f2;border-radius:8px;font-size:13px;color:#1a3d2b;"><strong>Cancellation policy:</strong> Please provide at least 24 hours notice to cancel or reschedule.</p>
            ${cancelBtn}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px;background:#f8f7f4;text-align:center;font-size:11px;color:#999;">
            Powered by Chapter99
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
