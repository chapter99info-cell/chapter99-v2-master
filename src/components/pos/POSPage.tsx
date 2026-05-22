// Chapter99 V4 — Phase 5
// Main POS Component (iPad-optimised)
// PIN: 4444 / 9999

import { useState, useEffect, useCallback } from 'react'
import type { BillItem, PaymentMethod, PaymentSplit, Transaction, Shop, Service } from '../../types/pos'
import { mapRowToService } from '../services/ServicesManager'
import {
  calcPayment,
  calcPaymentWithSplits,
  formatAUD,
  generateReceiptId,
  splitTotalAmount,
} from '../../lib/posCalc'
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
import { sendSMS, SMS, sendGiftVoucherEmail } from '../../lib/notifyService'
import { getSyncStatus } from '../../lib/syncService'
import { fetchShop } from '../../lib/shopService'
import { downloadAndRecordReceipt, emailReceipt } from '../../lib/receiptService'
import { syncTransactionToSheet } from '../../lib/googleSheets'
import { SHOP_ID, supabase } from '../../lib/supabase'
import { SHOP_UPDATED_EVENT } from '../../lib/shopLogo'
import GoogleReviewQR from './GoogleReviewQR'

type POSMode = 'pos' | 'walkin' | 'queue'
type POSStep = 'bill' | 'payment' | 'success'
type SplittableMethod = Exclude<PaymentMethod, 'split'>

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
  const [soldVoucherEmailNote, setSoldVoucherEmailNote] = useState<string | null>(null)
  const [sellAmount, setSellAmount] = useState<number | 'custom'>(50)
  const [sellCustomAmount, setSellCustomAmount] = useState('')
  const [sellBuyerName, setSellBuyerName] = useState('')
  const [sellBuyerEmail, setSellBuyerEmail] = useState('')
  const [sellPayMethod, setSellPayMethod] = useState<SplittableMethod>('cash')
  const [sellLoading, setSellLoading] = useState(false)
  const [sellError, setSellError] = useState('')

  // Gift voucher — redeem
  const [showRedeemVoucher, setShowRedeemVoucher] = useState(false)
  const [redeemCode, setRedeemCode] = useState('')
  const [redeemLoading, setRedeemLoading] = useState(false)
  const [redeemError, setRedeemError] = useState('')
  const [chargeError, setChargeError] = useState('')
  const [appliedVoucher, setAppliedVoucher] = useState<ValidatedVoucher | null>(null)

  // Split payment
  const [splitMode, setSplitMode] = useState(false)
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([])
  const [splitDraftMethod, setSplitDraftMethod] = useState<SplittableMethod>('cash')
  const [splitDraftAmount, setSplitDraftAmount] = useState('')
  const [splitError, setSplitError] = useState('')

  // Therapist (for reports)
  const [therapists, setTherapists] = useState<{ id: string; name_en: string }[]>([])
  const [therapistId, setTherapistId] = useState('')
  const [therapistName, setTherapistName] = useState('')

  useEffect(() => {
    const load = () => fetchShop(SHOP_ID).then(setShop)
    load()
    const onUpdated = () => load()
    window.addEventListener(SHOP_UPDATED_EVENT, onUpdated)
    return () => window.removeEventListener(SHOP_UPDATED_EVENT, onUpdated)
  }, [])

  useEffect(() => {
    async function loadTherapists() {
      const { data } = await supabase
        .from('staff')
        .select('id, name_en')
        .eq('shop_id', SHOP_ID)
        .eq('active', true)
        .eq('role', 'therapist')
        .order('name_en')
      setTherapists(data ?? [])
    }
    loadTherapists()
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

  const payment = (() => {
    if (!bill.length) return null
    if (splitMode && paymentSplits.length > 0) {
      return calcPaymentWithSplits(bill, paymentSplits)
    }
    if (!splitMode && payMethod && payMethod !== 'split') {
      return calcPayment(bill, payMethod as SplittableMethod)
    }
    return calcPayment(bill, 'cash')
  })()

  const voucherDeduction = appliedVoucher && payment
    ? Math.min(appliedVoucher.remainingBalance, payment.total)
    : 0
  const amountToCollect = payment
    ? Math.round(Math.max(0, payment.total - voucherDeduction) * 100) / 100
    : 0
  const voucherCoversAll = voucherDeduction > 0 && amountToCollect === 0
  const splitsPaid = splitTotalAmount(paymentSplits)
  const remainingToSplit =
    amountToCollect > 0
      ? Math.round(Math.max(0, amountToCollect - splitsPaid) * 100) / 100
      : 0

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
    setRedeemError('')
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

      const buyerEmail = sellBuyerEmail.trim()
      if (buyerEmail) {
        const emailResult = await sendGiftVoucherEmail({
          to: buyerEmail,
          buyerName: sellBuyerName,
          voucherCode: voucher.code,
          amount: resolvedSellAmount,
          expiryDate: voucher.expiryDate,
          shopName: shop.name,
          shopAddress: shop.address,
          shopPhone: shop.phone,
          shopEmail: shop.email,
          logoUrl: shop.logoUrl,
        })
        setSoldVoucherEmailNote(
          emailResult.ok
            ? `Voucher emailed to ${buyerEmail}`
            : emailResult.error ?? 'Could not send voucher email'
        )
      } else {
        setSoldVoucherEmailNote(null)
      }

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
  const addPaymentSplit = () => {
    setSplitError('')
    const amt = Math.round((parseFloat(splitDraftAmount) || 0) * 100) / 100
    if (amt <= 0) {
      setSplitError('Enter an amount greater than zero')
      return
    }
    if (paymentSplits.length >= 3) {
      setSplitError('Maximum 3 payment methods')
      return
    }
    if (amt > remainingToSplit + 0.01) {
      setSplitError(`Amount exceeds remaining ${formatAUD(remainingToSplit)}`)
      return
    }
    setPaymentSplits(prev => [...prev, { method: splitDraftMethod, amount: amt }])
    setSplitDraftAmount('')
  }

  const removePaymentSplit = (index: number) => {
    setPaymentSplits(prev => prev.filter((_, i) => i !== index))
    setSplitError('')
  }

  const handleCharge = async () => {
    if (!bill.length || !payment || !shop) return
    if (amountToCollect > 0) {
      if (splitMode) {
        if (paymentSplits.length === 0 || remainingToSplit > 0.01) {
          setChargeError('Split payments must equal the amount to collect')
          return
        }
      } else if (!payMethod) {
        return
      }
    }
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
      const finalPayment =
        splitMode && paymentSplits.length > 0
          ? calcPaymentWithSplits(bill, paymentSplits)
          : payment

      const tx: Transaction = {
        id: generateReceiptId(shopCode),
        shopId: shop.id,
        clientName: clientName || undefined,
        clientEmail: clientEmail || undefined,
        therapistId: therapistId || undefined,
        therapistName: therapistName || undefined,
        items: bill,
        payment: finalPayment,
        paymentMethod: splitMode ? 'split' : ((payMethod || 'cash') as PaymentMethod),
        paymentSplits: splitMode ? paymentSplits : undefined,
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
    setSplitMode(false)
    setPaymentSplits([])
    setSplitDraftAmount('')
    setSplitError('')
    setTherapistId('')
    setTherapistName('')
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
              setSoldVoucherEmailNote(null)
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
                {therapists.length > 0 && (
                  <select
                    className="pos-input"
                    value={therapistId}
                    onChange={e => {
                      const id = e.target.value
                      setTherapistId(id)
                      const t = therapists.find(x => x.id === id)
                      setTherapistName(t?.name_en ?? '')
                    }}
                  >
                    <option value="">Therapist (optional)</option>
                    {therapists.map(t => (
                      <option key={t.id} value={t.id}>{t.name_en}</option>
                    ))}
                  </select>
                )}
              </div>

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
                  {payment.total !== amountToCollect && appliedVoucher && (
                    <div className="total-row subtotal-before-voucher">
                      <span>Subtotal</span>
                      <span>{formatAUD(payment.total)}</span>
                    </div>
                  )}
                  {appliedVoucher && voucherDeduction > 0 && (
                    <div className="total-row voucher-deduct">
                      <span>Voucher {appliedVoucher.code}</span>
                      <span>−{formatAUD(voucherDeduction)}</span>
                    </div>
                  )}
                  <div className="total-row grand">
                    <span>{appliedVoucher && voucherDeduction > 0 ? 'TOTAL DUE' : 'TOTAL'}</span>
                    <span>
                      {formatAUD(
                        appliedVoucher && voucherDeduction > 0
                          ? amountToCollect
                          : payment.total
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Payment Methods */}
              <div className="card-label payment-label-row" style={{ marginTop: 12 }}>
                <span>วิธีชำระเงิน</span>
                <div className="payment-action-btns">
                  <button
                    type="button"
                    className={`split-toggle-btn${showRedeemVoucher && !appliedVoucher ? ' active' : ''}`}
                    onClick={() => {
                      if (appliedVoucher) return
                      setShowRedeemVoucher(v => !v)
                      setRedeemError('')
                    }}
                    disabled={!!appliedVoucher}
                  >
                    🎫 Redeem Voucher
                  </button>
                  <button
                    type="button"
                    className={`split-toggle-btn${splitMode ? ' active' : ''}`}
                    onClick={() => {
                      setSplitMode(m => !m)
                      setPayMethod('')
                      setPaymentSplits([])
                      setSplitError('')
                    }}
                  >
                    {splitMode ? 'Single payment' : 'Split payment'}
                  </button>
                </div>
              </div>

              {showRedeemVoucher && !appliedVoucher && bill.length > 0 && (
                <div className="voucher-redeem-panel">
                  <input
                    className="pos-input"
                    placeholder="Voucher code e.g. CH99-A1B2"
                    value={redeemCode}
                    onChange={e => setRedeemCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleApplyVoucher()}
                  />
                  <button
                    type="button"
                    className="voucher-apply-btn"
                    disabled={redeemLoading || !redeemCode.trim()}
                    onClick={handleApplyVoucher}
                  >
                    {redeemLoading ? 'Checking…' : 'Apply'}
                  </button>
                  {redeemError && <p className="voucher-form-error">{redeemError}</p>}
                </div>
              )}

              {appliedVoucher && (
                <div className="voucher-applied">
                  <div className="voucher-applied-main">
                    <strong>{appliedVoucher.code}</strong>
                    <span className="voucher-applied-balance">
                      Balance {formatAUD(appliedVoucher.remainingBalance)}
                      {voucherDeduction > 0 && (
                        <> · Applying {formatAUD(voucherDeduction)}</>
                      )}
                    </span>
                  </div>
                  <p className="voucher-applied-exp">
                    Expires {formatVoucherExpiry(appliedVoucher.expiryDate)}
                  </p>
                  <button type="button" className="voucher-remove-btn" onClick={clearAppliedVoucher}>
                    Remove voucher
                  </button>
                </div>
              )}
              {!splitMode ? (
              <div className="pay-grid">
                {[
                  { method: 'cash' as SplittableMethod, label: 'Cash', sub: 'ไม่มี surcharge', icon: '💵' },
                  { method: 'payid' as SplittableMethod, label: 'PayID', sub: 'ฟรี 100% ⭐', icon: '📱' },
                  { method: 'card' as SplittableMethod, label: 'Card', sub: '+1.5% surcharge', icon: '💳' },
                  { method: 'hicaps' as SplittableMethod, label: 'HICAPS', sub: 'Health Fund', icon: '❤️' },
                ].map(({ method, label, sub, icon }) => (
                  <button
                    key={method}
                    className={`pay-btn${payMethod === method ? ' selected' : ''}`}
                    type="button"
                    onClick={() => setPayMethod(prev => (prev === method ? '' : method))}
                  >
                    <div className="pay-icon">{icon}</div>
                    <div className="pay-label">{label}</div>
                    <div className="pay-sub">{sub}</div>
                  </button>
                ))}
              </div>
              ) : (
                <div className="split-payment-block">
                  <div className="split-remaining">
                    <span>Remaining</span>
                    <strong>{formatAUD(remainingToSplit)}</strong>
                    <span className="split-remaining-of">of {formatAUD(amountToCollect)}</span>
                  </div>
                  {paymentSplits.map((s, i) => (
                    <div key={i} className="split-row">
                      <span>{s.method.toUpperCase()}</span>
                      <span>{formatAUD(s.amount)}</span>
                      <button type="button" className="split-remove" onClick={() => removePaymentSplit(i)}>×</button>
                    </div>
                  ))}
                  {paymentSplits.length < 3 && remainingToSplit > 0 && (
                    <div className="split-add-row">
                      <select
                        className="pos-input"
                        value={splitDraftMethod}
                        onChange={e => setSplitDraftMethod(e.target.value as SplittableMethod)}
                      >
                        <option value="cash">Cash</option>
                        <option value="payid">PayID</option>
                        <option value="card">Card</option>
                        <option value="hicaps">HICAPS</option>
                      </select>
                      <input
                        className="pos-input"
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder={formatAUD(remainingToSplit)}
                        value={splitDraftAmount}
                        onChange={e => setSplitDraftAmount(e.target.value)}
                      />
                      <button type="button" className="split-add-btn" onClick={addPaymentSplit}>
                        Add
                      </button>
                    </div>
                  )}
                  {splitError && <p className="voucher-form-error">{splitError}</p>}
                </div>
              )}

              {/* Charge Button */}
              {chargeError && <p className="voucher-form-error">{chargeError}</p>}
              <button
                className="charge-btn"
                disabled={
                  !bill.length ||
                  isLoading ||
                  !shop ||
                  (amountToCollect > 0 &&
                    (splitMode
                      ? paymentSplits.length === 0 || remainingToSplit > 0.01
                      : !payMethod)) ||
                  (!splitMode && !payMethod && !voucherCoversAll)
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
              {(payMethod === 'hicaps' || paymentSplits.some(s => s.method === 'hicaps')) && (
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
            {currentTx?.paymentMethod === 'split' && currentTx.paymentSplits?.length
              ? currentTx.paymentSplits.map(s => `${s.method.toUpperCase()} ${formatAUD(s.amount)}`).join(' + ')
              : currentTx?.paymentMethod.toUpperCase()}
            {' · '}{currentTx?.id}
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
              {(['cash', 'payid', 'card'] as SplittableMethod[]).map(method => (
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
        <div
          className="pos-modal-overlay"
          onClick={() => {
            setSoldVoucher(null)
            setSoldVoucherEmailNote(null)
          }}
        >
          <div className="pos-modal pos-modal--success" onClick={e => e.stopPropagation()}>
            <div className="voucher-sold-icon">🎁</div>
            <h3 className="pos-modal-title">Voucher sold</h3>
            <p className="voucher-sold-code">{soldVoucher.code}</p>
            <p className="pos-modal-sub">
              {formatAUD(soldVoucher.originalAmount)} · Expires {formatVoucherExpiry(soldVoucher.expiryDate)}
            </p>
            <p className="voucher-sold-hint">Give this code to the customer. Print or write it down.</p>
            {soldVoucherEmailNote && (
              <p
                className={`voucher-sold-hint${soldVoucherEmailNote.startsWith('Voucher emailed') ? ' voucher-email-ok' : ' voucher-email-err'}`}
              >
                {soldVoucherEmailNote}
              </p>
            )}
            <button
              type="button"
              className="s-btn primary"
              onClick={() => {
                setSoldVoucher(null)
                setSoldVoucherEmailNote(null)
              }}
            >
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
