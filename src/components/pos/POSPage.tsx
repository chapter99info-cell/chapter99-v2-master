// Chapter99 V4 — Phase 5
// Main POS Component (iPad-optimised)
// PIN: 4444 / 9999

import { useState, useEffect, useCallback } from 'react'
import type { BillItem, PaymentMethod, Transaction, Shop, Service } from '../../types/pos'
import { mapRowToService } from '../services/ServicesManager'
import { calcPayment, formatAUD, generateReceiptId } from '../../lib/posCalc'
import { saveTransaction } from '../../lib/posDb'
import {
  sellGiftVoucher,
  validateGiftVoucher,
  redeemGiftVoucher,
  formatVoucherExpiry,
} from '../../lib/giftVoucherService'
import { VOUCHER_PRESET_AMOUNTS } from '../../types/giftVoucher'
import type { GiftVoucher, ValidatedVoucher } from '../../types/giftVoucher'
import { printReceipt } from '../../lib/thermalPrinter'
import { downloadHealthFundPDF } from '../../lib/healthFundPDF'
import { sendSMS, SMS } from '../../lib/notifyService'
import { getSyncStatus } from '../../lib/syncService'
import { fetchShop } from '../../lib/shopService'
import { downloadAndRecordReceipt, emailReceipt } from '../../lib/receiptService'
import { syncTransactionToSheet } from '../../lib/googleSheets'
import { SHOP_ID, supabase } from '../../lib/supabase'
import GoogleReviewQR from './GoogleReviewQR'

type POSMode = 'pos' | 'walkin' | 'queue'
type POSStep = 'bill' | 'payment' | 'success'

export default function POSPage() {
  const [mode, setMode] = useState<POSMode>('pos')
  const [step, setStep] = useState<POSStep>('bill')
  const [bill, setBill] = useState<BillItem[]>([])
  const [payMethod, setPayMethod] = useState<PaymentMethod | ''>('')
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [currentTx, setCurrentTx] = useState<Transaction | null>(null)
  const [syncStatus, setSyncStatus] = useState({ pending: 0, isOnline: true })
  const [isLoading, setIsLoading] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [shop, setShop] = useState<Shop | null>(null)
  const [receiptNote, setReceiptNote] = useState('')
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)

  // Gift voucher — sell
  const [showSellVoucher, setShowSellVoucher] = useState(false)
  const [soldVoucher, setSoldVoucher] = useState<GiftVoucher | null>(null)
  const [sellAmount, setSellAmount] = useState<number | 'custom'>(50)
  const [sellCustomAmount, setSellCustomAmount] = useState('')
  const [sellBuyerName, setSellBuyerName] = useState('')
  const [sellBuyerEmail, setSellBuyerEmail] = useState('')
  const [sellPayMethod, setSellPayMethod] = useState<PaymentMethod>('cash')
  const [sellLoading, setSellLoading] = useState(false)
  const [sellError, setSellError] = useState('')

  // Gift voucher — redeem
  const [showRedeemVoucher, setShowRedeemVoucher] = useState(false)
  const [redeemCode, setRedeemCode] = useState('')
  const [redeemLoading, setRedeemLoading] = useState(false)
  const [redeemError, setRedeemError] = useState('')
  const [chargeError, setChargeError] = useState('')
  const [appliedVoucher, setAppliedVoucher] = useState<ValidatedVoucher | null>(null)

  useEffect(() => {
    fetchShop(SHOP_ID).then(setShop)
  }, [])

  useEffect(() => {
    async function loadServices() {
      setServicesLoading(true)
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('shop_id', SHOP_ID)
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .order('name_en', { ascending: true })

      if (!error && data) {
        setServices(data.map(row => mapRowToService(row)))
      } else {
        setServices([])
      }
      setServicesLoading(false)
    }
    loadServices()
  }, [])

  // Update sync status
  useEffect(() => {
    const update = async () => setSyncStatus(await getSyncStatus())
    update()
    const id = setInterval(update, 10000)
    return () => clearInterval(id)
  }, [])

  const payment = payMethod
    ? calcPayment(bill, payMethod as PaymentMethod)
    : null

  const voucherDeduction = appliedVoucher && payment
    ? Math.min(appliedVoucher.remainingBalance, payment.total)
    : 0
  const amountToCollect = payment
    ? Math.round(Math.max(0, payment.total - voucherDeduction) * 100) / 100
    : 0
  const voucherCoversAll = voucherDeduction > 0 && amountToCollect === 0

  const resolvedSellAmount =
    sellAmount === 'custom'
      ? parseFloat(sellCustomAmount) || 0
      : sellAmount

  // Toggle service in bill
  const toggleService = useCallback((svc: Service) => {
    setBill(prev => {
      const exists = prev.find(i => i.serviceId === svc.id)
      if (exists) return prev.filter(i => i.serviceId !== svc.id)
      return [...prev, {
        serviceId: svc.id,
        serviceName: svc.nameEn,
        duration: svc.duration,
        price: svc.price,
        gstFree: svc.gstFree,
        itemNo: svc.itemNo,
      }]
    })
  }, [])

  const clearAppliedVoucher = () => {
    setAppliedVoucher(null)
    setRedeemCode('')
    setRedeemError('')
    setShowRedeemVoucher(false)
  }

  const handleApplyVoucher = async () => {
    setRedeemLoading(true)
    setRedeemError('')
    const result = await validateGiftVoucher(redeemCode)
    setRedeemLoading(false)
    if (!result.ok) {
      setRedeemError('error' in result ? result.error : 'Invalid voucher')
      return
    }
    setAppliedVoucher(result.voucher)
    setShowRedeemVoucher(false)
  }

  const handleSellVoucher = async () => {
    if (!shop || resolvedSellAmount <= 0 || !sellBuyerName.trim()) {
      setSellError('Enter amount and buyer name')
      return
    }
    setSellLoading(true)
    setSellError('')
    try {
      const voucher = await sellGiftVoucher({
        amount: resolvedSellAmount,
        buyerName: sellBuyerName,
        buyerEmail: sellBuyerEmail || undefined,
      })

      const voucherItem: BillItem = {
        serviceId: `voucher-${voucher.id}`,
        serviceName: `Gift Voucher (${voucher.code})`,
        duration: 0,
        price: resolvedSellAmount,
        gstFree: false,
      }
      const voucherPayment = calcPayment([voucherItem], sellPayMethod)
      const shopCode = shop.id.replace(/[^A-Z0-9]/gi, '').slice(0, 3).toUpperCase() || 'RCP'
      await saveTransaction({
        id: generateReceiptId(shopCode),
        shopId: shop.id,
        clientName: sellBuyerName,
        clientEmail: sellBuyerEmail || undefined,
        items: [voucherItem],
        payment: voucherPayment,
        paymentMethod: sellPayMethod,
        status: 'paid',
        createdAt: new Date().toISOString(),
        paidAt: new Date().toISOString(),
        receiptSent: false,
        healthFundIssued: false,
      })

      setSoldVoucher(voucher)
      setShowSellVoucher(false)
      setSellBuyerName('')
      setSellBuyerEmail('')
      setSellCustomAmount('')
    } catch (e) {
      setSellError(e instanceof Error ? e.message : 'Could not sell voucher')
    } finally {
      setSellLoading(false)
    }
  }

  // Charge — save transaction
  const handleCharge = async () => {
    if (!bill.length || !payment || !shop) return
    if (amountToCollect > 0 && !payMethod) return
    setIsLoading(true)
    setReceiptNote('')
    setChargeError('')
    try {
      if (appliedVoucher && voucherDeduction > 0) {
        const redeem = await redeemGiftVoucher(appliedVoucher.code, voucherDeduction)
        if (!redeem.ok) {
          setChargeError('error' in redeem ? redeem.error : 'Redemption failed')
          return
        }
      }

      const shopCode = shop.id.replace(/[^A-Z0-9]/gi, '').slice(0, 3).toUpperCase() || 'RCP'
      const tx: Transaction = {
        id: generateReceiptId(shopCode),
        shopId: shop.id,
        clientName: clientName || undefined,
        clientEmail: clientEmail || undefined,
        items: bill,
        payment,
        paymentMethod: (payMethod || 'cash') as PaymentMethod,
        status: 'paid',
        createdAt: new Date().toISOString(),
        paidAt: new Date().toISOString(),
        receiptSent: false,
        healthFundIssued: false,
        voucherCode: appliedVoucher?.code,
        voucherAmount: voucherDeduction > 0 ? voucherDeduction : undefined,
      }
      await saveTransaction(tx)
      setCurrentTx(tx)
      setStep('success')

      if (shop.googleSheetSyncEnabled && shop.googleSheetUrl) {
        void syncTransactionToSheet(shop.googleSheetUrl, shop.id, tx)
      }

      if (clientPhone) {
        await sendSMS(
          clientPhone,
          SMS.receiptConfirm(shop.name, formatAUD(payment.total))
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Reset POS
  const reset = () => {
    setBill([])
    setPayMethod('')
    setClientName('')
    setClientEmail('')
    setClientPhone('')
    setCurrentTx(null)
    setReceiptNote('')
    clearAppliedVoucher()
    setStep('bill')
  }

  const handleDownloadReceipt = async () => {
    if (!currentTx || !shop) return
    setReceiptLoading(true)
    const result = await downloadAndRecordReceipt(currentTx, shop)
    setReceiptLoading(false)
    if (!result.ok) setReceiptNote(result.error ?? 'Download failed')
    else {
      setReceiptNote(
        result.receiptNumber
          ? `Receipt ${result.receiptNumber} downloaded`
          : 'Receipt downloaded'
      )
    }
  }

  const handleEmailReceipt = async () => {
    if (!currentTx || !shop) return
    setEmailLoading(true)
    const result = await emailReceipt(currentTx, shop)
    setEmailLoading(false)
    if (result.ok) {
      setReceiptNote(
        result.receiptNumber
          ? `Receipt ${result.receiptNumber} emailed to ${currentTx.clientEmail}`
          : 'Receipt emailed to customer'
      )
      setCurrentTx({ ...currentTx, receiptSent: true })
    } else {
      setReceiptNote(result.error ?? 'Could not send email')
    }
  }

  const handlePrint = async () => {
    if (!currentTx || !shop) return
    await printReceipt(currentTx, shop)
  }

  const handleHealthFund = async () => {
    if (!currentTx || !shop) return
    await downloadHealthFundPDF(currentTx, shop)
  }

  const shopName = shop?.name ?? 'Loading…'

  return (
    <div className="pos-root">
      {/* Top Bar */}
      <div className="pos-topbar">
        <div className="pos-shopname">
          <span className="pos-dot online" />
          {shopName}
        </div>
        <div className="pos-topbar-right">
          <button
            type="button"
            className="voucher-sell-btn"
            onClick={() => {
              setShowSellVoucher(true)
              setSellError('')
            }}
          >
            🎁 Gift Voucher
          </button>
          {syncStatus.pending > 0 && (
            <span className="sync-badge">
              {syncStatus.pending} pending sync
            </span>
          )}
          <span className="pin-badge">PIN 4444</span>
          <Clock />
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="pos-tabs">
        {(['pos', 'walkin', 'queue'] as POSMode[]).map(m => (
          <button
            key={m}
            className={`pos-tab${mode === m ? ' active' : ''}`}
            onClick={() => setMode(m)}
          >
            {m === 'pos' && '🧾 POS'}
            {m === 'walkin' && '🚶 Walk-in'}
            {m === 'queue' && '📅 จากคิว'}
          </button>
        ))}
      </div>

      {/* Main Layout */}
      {step !== 'success' ? (
        <div className="pos-layout">
          {/* Left — Services + Client */}
          <div className="pos-left">
            {/* Client Info (Walk-in) */}
            {(mode === 'walkin' || mode === 'pos') && (
              <div className="pos-card">
                <div className="card-label">ข้อมูลลูกค้า (optional)</div>
                <input
                  className="pos-input"
                  placeholder="ชื่อลูกค้า"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                />
                <input
                  className="pos-input"
                  placeholder="Email (auto-send receipt)"
                  type="email"
                  value={clientEmail}
                  onChange={e => setClientEmail(e.target.value)}
                />
                <input
                  className="pos-input"
                  placeholder="เบอร์โทร (SMS)"
                  value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                />
              </div>
            )}

            {/* Services Grid */}
            <div className="pos-card">
              <div className="card-label">เลือกบริการ</div>
              <div className="services-grid">
                {servicesLoading ? (
                  <p className="services-empty">กำลังโหลดบริการ…</p>
                ) : services.length === 0 ? (
                  <p className="services-empty">
                    ยังไม่มีบริการที่เปิดใช้งาน — เพิ่มในหน้า Services (Owner)
                  </p>
                ) : services.map(svc => {
                  const added = bill.some(i => i.serviceId === svc.id)
                  return (
                    <button
                      key={svc.id}
                      className={`svc-btn${added ? ' added' : ''}`}
                      onClick={() => toggleService(svc)}
                    >
                      <div className="svc-name">{svc.name}</div>
                      <div className="svc-price">{formatAUD(svc.price)}</div>
                      <div className="svc-dur">
                        {svc.duration} min
                        {svc.gstFree && <span className="gst-free-tag">GST-free</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right — Bill + Payment */}
          <div className="pos-right">
            <div className="pos-card bill-card">
              <div className="card-label">บิลปัจจุบัน</div>

              {/* Bill Items */}
              <div className="bill-items">
                {bill.length === 0 ? (
                  <div className="bill-empty">
                    เลือกบริการด้านซ้าย
                  </div>
                ) : (
                  bill.map(item => (
                    <div key={item.serviceId} className="bill-item">
                      <div className="bill-item-info">
                        <div className="bill-item-name">{item.serviceName}</div>
                        <div className="bill-item-sub">{item.duration} min</div>
                      </div>
                      <div className="bill-item-price">{formatAUD(item.price)}</div>
                      <button
                        className="bill-item-del"
                        onClick={() => setBill(b => b.filter(i => i.serviceId !== item.serviceId))}
                        aria-label="Remove item"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Totals */}
              {payment && (
                <div className="totals-block">
                  <div className="total-row">
                    <span>Subtotal (ex GST)</span>
                    <span>{formatAUD(payment.exGst)}</span>
                  </div>
                  <div className="total-row">
                    <span>GST (1/11)</span>
                    <span>{formatAUD(payment.gst)}</span>
                  </div>
                  {payment.gstFreeAmt > 0 && (
                    <div className="total-row gst-free">
                      <span>GST-free portion</span>
                      <span>{formatAUD(payment.gstFreeAmt)}</span>
                    </div>
                  )}
                  {payment.surcharge > 0 && (
                    <div className="total-row surcharge">
                      <span>Card surcharge (1.5%)</span>
                      <span>{formatAUD(payment.surcharge)}</span>
                    </div>
                  )}
                  <div className="total-row grand">
                    <span>TOTAL</span>
                    <span>{formatAUD(payment.total)}</span>
                  </div>
                  {appliedVoucher && voucherDeduction > 0 && (
                    <>
                      <div className="total-row voucher-deduct">
                        <span>Voucher {appliedVoucher.code}</span>
                        <span>−{formatAUD(voucherDeduction)}</span>
                      </div>
                      <div className="total-row grand collect">
                        <span>Collect</span>
                        <span>{formatAUD(amountToCollect)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {bill.length > 0 && payment && (
                <div className="voucher-redeem-block">
                  {!appliedVoucher ? (
                    <>
                      <button
                        type="button"
                        className="voucher-redeem-btn"
                        onClick={() => {
                          setShowRedeemVoucher(v => !v)
                          setRedeemError('')
                        }}
                      >
                        🎫 Redeem Voucher
                      </button>
                      {showRedeemVoucher && (
                        <div className="voucher-redeem-form">
                          <input
                            className="pos-input"
                            placeholder="Enter code e.g. CH99-A1B2"
                            value={redeemCode}
                            onChange={e => setRedeemCode(e.target.value.toUpperCase())}
                          />
                          {redeemError && <p className="voucher-form-error">{redeemError}</p>}
                          <button
                            type="button"
                            className="voucher-apply-btn"
                            disabled={redeemLoading || !redeemCode.trim()}
                            onClick={handleApplyVoucher}
                          >
                            {redeemLoading ? 'Checking…' : 'Apply voucher'}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="voucher-applied">
                      <div>
                        <strong>{appliedVoucher.code}</strong>
                        <span> — {formatAUD(appliedVoucher.remainingBalance)} left</span>
                      </div>
                      <p className="voucher-applied-exp">
                        Expires {formatVoucherExpiry(appliedVoucher.expiryDate)}
                      </p>
                      <button type="button" className="voucher-remove-btn" onClick={clearAppliedVoucher}>
                        Remove voucher
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Methods */}
              <div className="card-label" style={{ marginTop: 12 }}>วิธีชำระเงิน</div>
              <div className="pay-grid">
                {[
                  { method: 'cash' as PaymentMethod, label: 'Cash', sub: 'ไม่มี surcharge', icon: '💵' },
                  { method: 'payid' as PaymentMethod, label: 'PayID', sub: 'ฟรี 100% ⭐', icon: '📱' },
                  { method: 'card' as PaymentMethod, label: 'Card', sub: '+1.5% surcharge', icon: '💳' },
                  { method: 'hicaps' as PaymentMethod, label: 'HICAPS', sub: 'Health Fund', icon: '❤️' },
                ].map(({ method, label, sub, icon }) => (
                  <button
                    key={method}
                    className={`pay-btn${payMethod === method ? ' selected' : ''}`}
                    onClick={() => setPayMethod(prev => prev === method ? '' : method)}
                  >
                    <div className="pay-icon">{icon}</div>
                    <div className="pay-label">{label}</div>
                    <div className="pay-sub">{sub}</div>
                  </button>
                ))}
              </div>

              {/* Charge Button */}
              {chargeError && <p className="voucher-form-error">{chargeError}</p>}
              <button
                className="charge-btn"
                disabled={
                  !bill.length ||
                  isLoading ||
                  !shop ||
                  (amountToCollect > 0 && !payMethod) ||
                  (!payMethod && !voucherCoversAll)
                }
                onClick={handleCharge}
              >
                {isLoading
                  ? 'Processing...'
                  : voucherCoversAll
                    ? 'Complete — paid by voucher'
                    : `รับเงิน — ${payment ? formatAUD(amountToCollect > 0 ? amountToCollect : payment.total) : '$0.00'}`}
              </button>

              {/* Health Fund button if HICAPS selected */}
              {payMethod === 'hicaps' && (
                <button className="hf-btn" onClick={handleHealthFund}>
                  ❤️ ออก Health Fund Receipt
                </button>
              )}

              {/* Void */}
              {bill.length > 0 && (
                <button className="void-btn" onClick={reset}>
                  🗑 Void / Clear Bill
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Success Screen */
        <div className="success-screen">
          <div className="success-screen-main">
          <div className="success-icon">✅</div>
          <div className="success-title">ชำระเงินสำเร็จ</div>
          <div className="success-amount">
            {currentTx && formatAUD(currentTx.payment.total)}
          </div>
          <div className="success-method">
            {currentTx?.paymentMethod.toUpperCase()} · {currentTx?.id}
            {currentTx?.voucherCode && (
              <> · Voucher {currentTx.voucherCode} (−{formatAUD(currentTx.voucherAmount ?? 0)})</>
            )}
          </div>
          {receiptNote && <p className="success-note">{receiptNote}</p>}
          <div className="success-actions">
            <button
              className="s-btn primary"
              disabled={receiptLoading || !shop}
              onClick={handleDownloadReceipt}
            >
              {receiptLoading ? 'Generating…' : '📄 Download Receipt'}
            </button>
            {currentTx?.clientEmail && (
              <button
                className="s-btn primary"
                disabled={emailLoading || !shop}
                onClick={handleEmailReceipt}
              >
                {emailLoading ? 'Sending…' : '✉️ Email Receipt'}
              </button>
            )}
            <button className="s-btn" onClick={handlePrint}>🖨 Print Receipt</button>
            <button className="s-btn" onClick={handleHealthFund}>❤️ Health Fund PDF</button>
            <button className="s-btn" onClick={reset}>ปิดบิล</button>
          </div>
          </div>
          {shop?.googleReviewUrl?.trim() && (
            <GoogleReviewQR url={shop.googleReviewUrl} />
          )}
        </div>
      )}

      {showSellVoucher && (
        <div className="pos-modal-overlay" onClick={() => setShowSellVoucher(false)}>
          <div className="pos-modal" onClick={e => e.stopPropagation()}>
            <h3 className="pos-modal-title">Sell Gift Voucher</h3>
            <p className="pos-modal-sub">Valid for 1 year · Code generated automatically</p>

            <div className="voucher-amount-grid">
              {VOUCHER_PRESET_AMOUNTS.map(amt => (
                <button
                  key={amt}
                  type="button"
                  className={`voucher-amount-btn${sellAmount === amt ? ' selected' : ''}`}
                  onClick={() => setSellAmount(amt)}
                >
                  {formatAUD(amt)}
                </button>
              ))}
              <button
                type="button"
                className={`voucher-amount-btn${sellAmount === 'custom' ? ' selected' : ''}`}
                onClick={() => setSellAmount('custom')}
              >
                Custom
              </button>
            </div>

            {sellAmount === 'custom' && (
              <input
                className="pos-input"
                type="number"
                min="1"
                step="0.01"
                placeholder="Custom amount"
                value={sellCustomAmount}
                onChange={e => setSellCustomAmount(e.target.value)}
              />
            )}

            <input
              className="pos-input"
              placeholder="Buyer name *"
              value={sellBuyerName}
              onChange={e => setSellBuyerName(e.target.value)}
            />
            <input
              className="pos-input"
              type="email"
              placeholder="Buyer email (optional)"
              value={sellBuyerEmail}
              onChange={e => setSellBuyerEmail(e.target.value)}
            />

            <div className="card-label">Payment for voucher</div>
            <div className="pay-grid">
              {(['cash', 'payid', 'card'] as PaymentMethod[]).map(method => (
                <button
                  key={method}
                  type="button"
                  className={`pay-btn${sellPayMethod === method ? ' selected' : ''}`}
                  onClick={() => setSellPayMethod(method)}
                >
                  <div className="pay-label">{method.toUpperCase()}</div>
                </button>
              ))}
            </div>

            {sellError && <p className="voucher-form-error">{sellError}</p>}

            <div className="pos-modal-actions">
              <button type="button" className="s-btn" onClick={() => setShowSellVoucher(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="s-btn primary"
                disabled={sellLoading || resolvedSellAmount <= 0 || !sellBuyerName.trim()}
                onClick={handleSellVoucher}
              >
                {sellLoading ? 'Saving…' : `Sell ${formatAUD(resolvedSellAmount)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {soldVoucher && (
        <div className="pos-modal-overlay" onClick={() => setSoldVoucher(null)}>
          <div className="pos-modal pos-modal--success" onClick={e => e.stopPropagation()}>
            <div className="voucher-sold-icon">🎁</div>
            <h3 className="pos-modal-title">Voucher sold</h3>
            <p className="voucher-sold-code">{soldVoucher.code}</p>
            <p className="pos-modal-sub">
              {formatAUD(soldVoucher.originalAmount)} · Expires {formatVoucherExpiry(soldVoucher.expiryDate)}
            </p>
            <p className="voucher-sold-hint">Give this code to the customer. Print or write it down.</p>
            <button type="button" className="s-btn primary" onClick={() => setSoldVoucher(null)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Clock component
function Clock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="pos-clock">
      {time.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}
