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

// api/sms.ts
var sms_exports = {};
__export(sms_exports, {
  default: () => handler
});
module.exports = __toCommonJS(sms_exports);

// api/posRoutes.ts
var import_twilio = __toESM(require("twilio"));
var import_resend = require("resend");
var import_googleapis = require("googleapis");
var client = (0, import_twilio.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
async function POST_sms(req, res) {
  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: "Missing to or message" });
  }
  try {
    const msg = await client.messages.create({
      body: message,
      from: process.env.TWILIO_FROM_NUMBER,
      to: to.startsWith("+") ? to : `+61${to.replace(/^0/, "")}`
    });
    return res.json({ success: true, sid: msg.sid });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
var resend = new import_resend.Resend(process.env.RESEND_API_KEY);

// api/sms.ts
async function handler(req, res) {
  if (req.method === "POST")
    return POST_sms(req, res);
  return res.status(405).json({ error: "Method not allowed" });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {});
