var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// api/stripe-webhook.ts
var stripe_webhook_exports = {};
__export(stripe_webhook_exports, {
  default: () => handler
});
module.exports = __toCommonJS(stripe_webhook_exports);
var import_stripe = __toESM(require("stripe"));
var import_supabase_js = require("@supabase/supabase-js");
var import_resend = require("resend");

// api/giftVoucherEmailTemplate.ts
function formatAud(amount) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2
  }).format(amount);
}
function formatExpiry(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function buildGiftVoucherEmailHTML(p) {
  const buyer = escapeHtml(p.buyerName.trim() || "Guest");
  const code = escapeHtml(p.voucherCode);
  const shop = escapeHtml(p.shopName);
  const address = escapeHtml(p.shopAddress || "");
  const phone = escapeHtml(p.shopPhone || "");
  const email = p.shopEmail ? escapeHtml(p.shopEmail) : "";
  const amount = formatAud(p.amount);
  const expiry = formatExpiry(p.expiryDate);
  const logo = p.logoUrl ? escapeHtml(p.logoUrl) : "";
  const logoBlock = logo ? `<img src="${logo}" alt="${shop}" width="56" height="56" style="display:block;border-radius:50%;border:2px solid #C9A227;margin:0 auto 12px;" />` : `<div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:400;color:#E8D5A3;letter-spacing:0.12em;margin:0 0 4px;">CHAPTER99</div>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Gift Voucher \u2014 ${shop}</title>
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
                    <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#c8ddd8;">Thank you for your purchase. Your gift voucher is ready \u2014 treat someone special to a moment of calm and restoration.</p>
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
                          <p style="margin:0;font-size:14px;line-height:1.55;color:#b8d4cc;">Present this code at the shop when booking or paying for your treatment. Our team will apply the voucher value to your visit. Partial redemption is welcome \u2014 any remaining balance stays on the voucher until expiry.</p>
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
                      ${address ? `${address}<br>` : ""}
                      ${phone ? `Tel: <a href="tel:${phone.replace(/\s/g, "")}" style="color:#9FE1CB;text-decoration:none;">${phone}</a><br>` : ""}
                      ${email ? `<a href="mailto:${email}" style="color:#9FE1CB;text-decoration:none;">${email}</a>` : ""}
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
              Powered by <span style="color:#9FE1CB;">Chapter99</span> \xB7 chapter99solutions.com.au
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
function buildGiftVoucherEmailSubject(p) {
  return `Your ${formatAud(p.amount)} gift voucher for ${p.shopName}`;
}
function buildGiftVoucherEmailText(p) {
  return `Dear ${p.buyerName},

Your gift voucher for ${p.shopName} is ready.

Code: ${p.voucherCode}
Value: ${formatAud(p.amount)}
Valid until: ${formatExpiry(p.expiryDate)}

Present this code at the shop to redeem.

${p.shopName}
${p.shopAddress}
${p.shopPhone}
${p.shopEmail ?? ""}

\u2014 Chapter99`;
}

// api/stripe-webhook.ts
function oneYearFromToday() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) {
    return res.status(500).json({ error: "Stripe not configured" });
  }
  const stripe = new import_stripe.default(secret, { apiVersion: "2024-06-20" });
  const sig = req.headers["stripe-signature"];
  const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return res.status(400).json({ error: message });
  }
  if (event.type !== "checkout.session.completed") {
    return res.json({ received: true });
  }
  const session = event.data.object;
  const meta = session.metadata ?? {};
  const shopId = meta.shop_id;
  const amount = parseFloat(meta.amount_aud || "0");
  const recipientEmail = meta.recipient_email;
  const recipientName = meta.recipient_name;
  const buyerName = meta.buyer_name || recipientName;
  const buyerEmail = meta.buyer_email;
  if (!shopId || amount <= 0 || !recipientEmail) {
    console.error("[stripe-webhook] missing metadata", meta);
    return res.status(400).json({ error: "Invalid session metadata" });
  }
  const supabase = (0, import_supabase_js.createClient)(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  const expiryDate = oneYearFromToday();
  const { data: voucher, error: insertErr } = await supabase.from("gift_vouchers").insert({
    shop_id: shopId,
    original_amount: amount,
    remaining_balance: amount,
    expiry_date: expiryDate,
    status: "active",
    purchased_via: "web",
    buyer_name: buyerName,
    buyer_email: buyerEmail,
    recipient_name: recipientName,
    recipient_email: recipientEmail,
    stripe_session_id: session.id
  }).select().single();
  if (insertErr) {
    console.error("[stripe-webhook] voucher insert", insertErr);
    return res.status(500).json({ error: insertErr.message });
  }
  const { data: shop } = await supabase.from("shops").select("name, address, phone, email, logo_url").eq("id", shopId).single();
  if (process.env.RESEND_API_KEY) {
    const resend = new import_resend.Resend(process.env.RESEND_API_KEY);
    const payload = {
      to: recipientEmail,
      buyerName: recipientName,
      voucherCode: voucher.code,
      amount,
      expiryDate,
      shopName: shop?.name || "Chapter99",
      shopAddress: shop?.address || "",
      shopPhone: shop?.phone || "",
      shopEmail: shop?.email,
      logoUrl: shop?.logo_url
    };
    try {
      await resend.emails.send({
        from: "Chapter99 Gift Vouchers <onboarding@resend.dev>",
        to: recipientEmail,
        subject: buildGiftVoucherEmailSubject(payload),
        html: buildGiftVoucherEmailHTML(payload),
        text: buildGiftVoucherEmailText(payload)
      });
    } catch (emailErr) {
      console.error("[stripe-webhook] email failed", emailErr);
    }
  }
  return res.json({ received: true, voucherCode: voucher.code });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {});
