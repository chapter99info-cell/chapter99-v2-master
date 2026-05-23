export interface OwnerBookingNotificationPayload {
  to: string
  clientName: string
  clientPhone?: string
  clientEmail?: string
  serviceName: string
  durationMin: number
  date: string
  time: string
  therapistLabel?: string
  shopName: string
  source?: string
  bookingId?: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildOwnerBookingNotificationSubject(
  shopName: string,
  clientName: string
): string {
  return `New booking — ${clientName} — ${shopName}`
}

export function buildOwnerBookingNotificationText(
  p: OwnerBookingNotificationPayload
): string {
  const lines = [
    `New booking at ${p.shopName}`,
    '',
    `Client: ${p.clientName}`,
    p.clientPhone ? `Phone: ${p.clientPhone}` : '',
    p.clientEmail ? `Email: ${p.clientEmail}` : '',
    '',
    `Service: ${p.serviceName} (${p.durationMin} minutes)`,
    `Date: ${p.date}`,
    `Time: ${p.time}`,
    p.therapistLabel ? `Therapist: ${p.therapistLabel}` : '',
    p.source ? `Source: ${p.source}` : '',
    p.bookingId ? `Booking ID: ${p.bookingId}` : '',
  ].filter(Boolean)

  return lines.join('\n')
}

export function buildOwnerBookingNotificationHTML(
  p: OwnerBookingNotificationPayload
): string {
  const shop = escapeHtml(p.shopName)
  const name = escapeHtml(p.clientName)
  const service = escapeHtml(p.serviceName)
  const date = escapeHtml(p.date)
  const time = escapeHtml(p.time)
  const therapist = p.therapistLabel ? escapeHtml(p.therapistLabel) : ''
  const phone = p.clientPhone ? escapeHtml(p.clientPhone) : ''
  const email = p.clientEmail ? escapeHtml(p.clientEmail) : ''
  const source = p.source ? escapeHtml(p.source) : ''
  const bookingId = p.bookingId ? escapeHtml(p.bookingId) : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f0efe8;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0efe8;padding:24px 12px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e0ddd5;">
        <tr>
          <td style="background:#1B4D3E;padding:28px 24px;text-align:center;">
            <p style="margin:0;font-size:22px;color:#F5F0E6;font-weight:600;">${shop}</p>
            <p style="margin:8px 0 0;font-size:14px;color:#C9A227;letter-spacing:0.12em;text-transform:uppercase;">New booking</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 24px;color:#2c2c2c;font-size:15px;line-height:1.6;">
            <p style="margin:0 0 20px;">A new appointment has been booked:</p>
            <table width="100%" style="background:#f8f7f4;border-radius:8px;padding:4px 0;">
              <tr><td style="padding:10px 16px;border-bottom:1px solid #e8e6e0;"><span style="color:#666;font-size:13px;">Client</span><br><strong>${name}</strong>${phone ? `<br>${phone}` : ''}${email ? `<br>${email}` : ''}</td></tr>
              <tr><td style="padding:10px 16px;border-bottom:1px solid #e8e6e0;"><span style="color:#666;font-size:13px;">Service</span><br><strong>${service}</strong> · ${p.durationMin} min</td></tr>
              <tr><td style="padding:10px 16px;border-bottom:1px solid #e8e6e0;"><span style="color:#666;font-size:13px;">Date & time</span><br><strong>${date}</strong> at <strong>${time}</strong></td></tr>
              ${therapist ? `<tr><td style="padding:10px 16px;border-bottom:1px solid #e8e6e0;"><span style="color:#666;font-size:13px;">Therapist</span><br><strong>${therapist}</strong></td></tr>` : ''}
              ${source ? `<tr><td style="padding:10px 16px;border-bottom:1px solid #e8e6e0;"><span style="color:#666;font-size:13px;">Source</span><br><strong>${source}</strong></td></tr>` : ''}
              ${bookingId ? `<tr><td style="padding:10px 16px;"><span style="color:#666;font-size:13px;">Booking ID</span><br><strong>${bookingId}</strong></td></tr>` : ''}
            </table>
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
