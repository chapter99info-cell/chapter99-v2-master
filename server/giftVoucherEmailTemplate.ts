// Chapter99 — Gift Voucher HTML email (inline CSS, table layout)

export interface GiftVoucherEmailPayload {
  to: string
  buyerName: string
  voucherCode: string
  amount: number
  expiryDate: string
  shopName: string
  shopAddress: string
  shopPhone: string
  shopEmail?: string
  logoUrl?: string
}

function formatAud(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatExpiry(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildGiftVoucherEmailHTML(p: GiftVoucherEmailPayload): string {
  const buyer = escapeHtml(p.buyerName.trim() || 'Guest')
  const code = escapeHtml(p.voucherCode)
  const shop = escapeHtml(p.shopName)
  const address = escapeHtml(p.shopAddress || '')
  const phone = escapeHtml(p.shopPhone || '')
  const email = p.shopEmail ? escapeHtml(p.shopEmail) : ''
  const amount = formatAud(p.amount)
  const expiry = formatExpiry(p.expiryDate)
  const logo = p.logoUrl ? escapeHtml(p.logoUrl) : ''

  const logoBlock = logo
    ? `<img src="${logo}" alt="${shop}" width="56" height="56" style="display:block;border-radius:50%;border:2px solid #C9A227;margin:0 auto 12px;" />`
    : `<div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:400;color:#E8D5A3;letter-spacing:0.12em;margin:0 0 4px;">CHAPTER99</div>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Gift Voucher — ${shop}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .voucher-code { font-size: 28px !important; letter-spacing: 0.15em !important; }
      .pad-mobile { padding-left: 20px !important; padding-right: 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0a1f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0a1f1a;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="email-container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">

          <!-- Top lotus accent -->
          <tr>
            <td align="center" style="padding-bottom:8px;font-size:18px;color:#C9A227;line-height:1;">&#10047; &#10047; &#10047;</td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background-color:#0F3D34;border:1px solid #2a5c52;border-radius:12px;overflow:hidden;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">

                <!-- Gold top bar -->
                <tr>
                  <td height="4" style="background:linear-gradient(90deg,#8B6914 0%,#C9A227 50%,#8B6914 100%);font-size:0;line-height:0;">&nbsp;</td>
                </tr>

                <!-- Header -->
                <tr>
                  <td class="pad-mobile" align="center" style="padding:28px 40px 20px;background-color:#0d332c;">
                    ${logoBlock}
                    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:13px;color:#9FE1CB;letter-spacing:0.2em;text-transform:uppercase;">Gift Voucher</p>
                    <h1 style="margin:8px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;color:#F5F0E6;line-height:1.3;">${shop}</h1>
                  </td>
                </tr>

                <!-- Greeting -->
                <tr>
                  <td class="pad-mobile" style="padding:0 40px 20px;">
                    <p style="margin:0;font-size:15px;line-height:1.6;color:#c8ddd8;">Dear ${buyer},</p>
                    <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#c8ddd8;">Thank you for your purchase. Your gift voucher is ready — treat someone special to a moment of calm and restoration.</p>
                  </td>
                </tr>

                <!-- Voucher hero box -->
                <tr>
                  <td class="pad-mobile" style="padding:0 32px 28px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:2px solid #C9A227;border-radius:8px;background-color:#062820;">
                      <tr>
                        <td style="padding:3px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #5a4a1f;border-radius:6px;background-color:#0a2520;">
                            <tr>
                              <td align="center" style="padding:28px 20px 16px;">
                                <p style="margin:0 0 8px;font-size:11px;color:#C9A227;letter-spacing:0.25em;text-transform:uppercase;font-family:Georgia,'Times New Roman',serif;">Your voucher code</p>
                                <p class="voucher-code" style="margin:0;font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:700;color:#F5F0E6;letter-spacing:0.22em;line-height:1.2;">${code}</p>
                              </td>
                            </tr>
                            <tr>
                              <td align="center" style="padding:0 20px 24px;border-top:1px solid #1e4a40;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px;">
                                  <tr>
                                    <td width="50%" align="center" style="padding:8px;border-right:1px solid #1e4a40;">
                                      <p style="margin:0;font-size:10px;color:#7aab9e;letter-spacing:0.1em;text-transform:uppercase;">Value</p>
                                      <p style="margin:4px 0 0;font-size:20px;color:#E8D5A3;font-family:Georgia,'Times New Roman',serif;">${amount}</p>
                                    </td>
                                    <td width="50%" align="center" style="padding:8px;">
                                      <p style="margin:0;font-size:10px;color:#7aab9e;letter-spacing:0.1em;text-transform:uppercase;">Valid until</p>
                                      <p style="margin:4px 0 0;font-size:15px;color:#F5F0E6;font-family:Georgia,'Times New Roman',serif;">${expiry}</p>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Instructions -->
                <tr>
                  <td class="pad-mobile" style="padding:0 40px 28px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0d3d34;border-radius:8px;border-left:3px solid #C9A227;">
                      <tr>
                        <td style="padding:16px 18px;">
                          <p style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:16px;color:#E8D5A3;">How to redeem</p>
                          <p style="margin:0;font-size:14px;line-height:1.55;color:#b8d4cc;">Present this code at the shop when booking or paying for your treatment. Our team will apply the voucher value to your visit. Partial redemption is welcome — any remaining balance stays on the voucher until expiry.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Footer shop details -->
                <tr>
                  <td class="pad-mobile" style="padding:20px 40px 28px;background-color:#082a24;border-top:1px solid #1e4a40;">
                    <p style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#E8D5A3;text-align:center;">Visit us</p>
                    <p style="margin:0;font-size:14px;line-height:1.6;color:#9bb8b0;text-align:center;">
                      <strong style="color:#c8ddd8;">${shop}</strong><br>
                      ${address ? `${address}<br>` : ''}
                      ${phone ? `Tel: <a href="tel:${phone.replace(/\s/g, '')}" style="color:#9FE1CB;text-decoration:none;">${phone}</a><br>` : ''}
                      ${email ? `<a href="mailto:${email}" style="color:#9FE1CB;text-decoration:none;">${email}</a>` : ''}
                    </p>
                  </td>
                </tr>

                <!-- Bottom gold bar -->
                <tr>
                  <td height="3" style="background:linear-gradient(90deg,#8B6914 0%,#C9A227 50%,#8B6914 100%);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bottom lotus + powered by -->
          <tr>
            <td align="center" style="padding:20px 16px 8px;font-size:16px;color:#3d6b5f;line-height:1;">&#10047;</td>
          </tr>
          <tr>
            <td align="center" style="padding:0 16px 32px;font-size:11px;color:#5a8078;line-height:1.5;">
              This voucher is non-refundable unless required by Australian Consumer Law.<br>
              Powered by <span style="color:#9FE1CB;">Chapter99</span> · chapter99solutions.com.au
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildGiftVoucherEmailSubject(p: GiftVoucherEmailPayload): string {
  return `Your ${formatAud(p.amount)} gift voucher for ${p.shopName}`
}

export function buildGiftVoucherEmailText(p: GiftVoucherEmailPayload): string {
  return `Dear ${p.buyerName},

Your gift voucher for ${p.shopName} is ready.

Code: ${p.voucherCode}
Value: ${formatAud(p.amount)}
Valid until: ${formatExpiry(p.expiryDate)}

Present this code at the shop to redeem.

${p.shopName}
${p.shopAddress}
${p.shopPhone}
${p.shopEmail ?? ''}

— Chapter99`
}
