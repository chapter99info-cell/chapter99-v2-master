// Chapter99 V4 — Phase 5
// Main POS Component (iPad-optimised)
// PIN: 4444 / 9999

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { BillItem, PaymentMethod, Transaction, Shop, Service } from '../../types/pos'
import { mapRowToService } from '../services/ServicesManager'
import { calcPayment, formatAUD, generateReceiptId } from '../../lib/posCalc'
import { saveTransaction } from '../../lib/posDb'
import { printReceipt } from '../../lib/thermalPrinter'
import { downloadHealthFundPDF } from '../../lib/healthFundPDF'
import { sendSMS, SMS } from '../../lib/notifyService'
import { getSyncStatus } from '../../lib/syncService'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? '',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
)

const SHOP_ID = import.meta.env.VITE_SHOP_ID ?? 'shop-001'

// ── Demo Data (fallback if Supabase has no services) ─────────
const DEMO_SHOP: Shop = {
  id: 'shop-001',
  name: 'Thai Bliss Massage',
  abn: '12 345 678 901',
  address: '123 King St, Sydney NSW 2000',
  phone: '0412 345 678',
  email: 'info@thaibliss.com.au',
  gstRegistered: true,
  currency: 'AUD',
  timezone: 'Australia/Sydney',
  providerName: 'Saen Jaidee',
  providerNumber: 'A348132F',
  signatureUrl: undefined,
  cardSurchargeRate: 0.015,
  amexSurchargeRate: 0.02,
  payidBsb: '062-000',
  payidAccount: '12345678',
}

const DEMO_SERVICES: Service[] = [
  { id: 's1', name: 'Thai Massage', nameEn: 'Thai Massage', duration: 60, price: 80, gstFree: false, category: 'thai' },
  { id: 's2', name: 'Remedial', nameEn: 'Remedial Massage', duration: 60, price: 100, gstFree: true, itemNo: '205', category: 'remedial' },
  { id: 's3', name: 'Aroma', nameEn: 'Aromatherapy', duration: 60, price: 90, gstFree: false, category: 'aroma' },
  { id: 's4', name: 'Deep Tissue', nameEn: 'Deep Tissue', duration: 90, price: 130, gstFree: false, category: 'deep_tissue' },
  { id: 's5', name: 'Hot Stone', nameEn: 'Hot Stone', duration: 75, price: 110, gstFree: false, category: 'other' },
  { id: 's6', name: 'Foot Reflex', nameEn: 'Foot Reflexology', duration: 30, price: 50, gstFree: false, category: 'other' },
]

const TIP_OPTIONS = [0, 10, 15, 20]

type POSMode = 'pos' | 'walkin' | 'queue'
type POSStep = 'bill' | 'payment' | 'success'

export default function POSPage() {
  const [mode, setMode] = useState<POSMode>('pos')
  const [step, setStep] = useState<POSStep>('bill')
  const [bill, setBill] = useState<BillItem[]>([])
  const [payMethod, setPayMethod] = useState<PaymentMethod | ''>('')
  const [tipPct, setTipPct] = useState(0)
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [currentTx, setCurrentTx] = useState<Transaction | null>(null)
  const [syncStatus, setSyncStatus] = useState({ pending: 0, isOnline: true })
  const [isLoading, setIsLoading] = useState(false)
  const [services, setServices] = useState<Service[]>(DEMO_SERVICES)

  useEffect(() => {
    async function loadServices() {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('shop_id', SHOP_ID)
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .order('name_en', { ascending: true })

      if (!error && data && data.length > 0) {
        setServices(data.map(row => mapRowToService(row)))
      }
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
    ? calcPayment(bill, payMethod as PaymentMethod, tipPct)
    : null

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

  // Charge — save transaction
  const handleCharge = async () => {
    if (!bill.length || !payMethod || !payment) return
    setIsLoading(true)
    try {
      const tx: Transaction = {
        id: generateReceiptId('TBM'),
        shopId: DEMO_SHOP.id,
        clientName: clientName || undefined,
        clientEmail: clientEmail || undefined,
        items: bill,
        payment,
        paymentMethod: payMethod as PaymentMethod,
        status: 'paid',
        createdAt: new Date().toISOString(),
        paidAt: new Date().toISOString(),
        receiptSent: false,
        healthFundIssued: false,
      }
      await saveTransaction(tx)
      setCurrentTx(tx)
      setStep('success')

      // Send SMS if phone provided
      if (clientPhone) {
        await sendSMS(
          clientPhone,
          SMS.receiptConfirm(DEMO_SHOP.name, formatAUD(payment.total))
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
    setTipPct(0)
    setClientName('')
    setClientEmail('')
    setClientPhone('')
    setCurrentTx(null)
    setStep('bill')
  }

  // Print thermal receipt
  const handlePrint = async () => {
    if (!currentTx) return
    await printReceipt(currentTx, DEMO_SHOP)
  }

  // Health Fund PDF
  const handleHealthFund = async () => {
    if (!currentTx) return
    await downloadHealthFundPDF(currentTx, DEMO_SHOP)
  }

  return (
    <div className="pos-root">
      {/* Top Bar */}
      <div className="pos-topbar">
        <div className="pos-shopname">
          <span className="pos-dot online" />
          {DEMO_SHOP.name}
        </div>
        <div className="pos-topbar-right">
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
            {mode === 'walkin' && (
              <div className="pos-card">
                <div className="card-label">ข้อมูลลูกค้า</div>
                <input
                  className="pos-input"
                  placeholder="ชื่อลูกค้า (optional)"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                />
                <input
                  className="pos-input"
                  placeholder="Email (สำหรับใบเสร็จ)"
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
                {services.map(svc => {
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
                  {payment.tip > 0 && (
                    <div className="total-row">
                      <span>Tip ({payment.tipPct}%)</span>
                      <span>{formatAUD(payment.tip)}</span>
                    </div>
                  )}
                  <div className="total-row grand">
                    <span>TOTAL</span>
                    <span>{formatAUD(payment.total)}</span>
                  </div>
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

              {/* Tip */}
              <div className="card-label" style={{ marginTop: 10 }}>Tip</div>
              <div className="tip-row">
                {TIP_OPTIONS.map(pct => (
                  <button
                    key={pct}
                    className={`tip-btn${tipPct === pct ? ' active' : ''}`}
                    onClick={() => setTipPct(pct)}
                  >
                    {pct === 0 ? 'No tip' : `${pct}%`}
                  </button>
                ))}
              </div>

              {/* Charge Button */}
              <button
                className="charge-btn"
                disabled={!bill.length || !payMethod || isLoading}
                onClick={handleCharge}
              >
                {isLoading
                  ? 'Processing...'
                  : `รับเงิน — ${payment ? formatAUD(payment.total) : '$0.00'}`}
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
          <div className="success-icon">✅</div>
          <div className="success-title">ชำระเงินสำเร็จ</div>
          <div className="success-amount">
            {currentTx && formatAUD(currentTx.payment.total)}
          </div>
          <div className="success-method">
            {currentTx?.paymentMethod.toUpperCase()} · {currentTx?.id}
          </div>
          <div className="success-actions">
            <button className="s-btn" onClick={handlePrint}>🖨 Print Receipt</button>
            <button className="s-btn" onClick={handleHealthFund}>❤️ Health Fund PDF</button>
            <button className="s-btn primary" onClick={reset}>ปิดบิล</button>
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
