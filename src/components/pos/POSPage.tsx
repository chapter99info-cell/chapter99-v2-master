// Chapter99 V4 — Phase 5
// Main POS Component (iPad-optimised)
// PIN: 4444 / 9999

import { useState, useEffect, useCallback, useMemo } from 'react'
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
import { sendReviewRequestAfterCheckout } from '../../lib/reviewRequestService'
import { getSyncStatus } from '../../lib/syncService'
import { fetchShop } from '../../lib/shopService'
import {
  downloadAndRecordReceipt,
  emailHealthFundReceipt,
  emailReceipt,
} from '../../lib/receiptService'
import { syncTransactionToSheet } from '../../lib/googleSheets'
import { fetchLastCustomerVisit } from '../../lib/customerHistory'
import { supabase } from '../../lib/supabase'
import { useStaffShopId } from '../../hooks/useStaffShopId'
import { SHOP_UPDATED_EVENT } from '../../lib/shopLogo'
import GoogleReviewQR from './GoogleReviewQR'
import { usePlan } from '../../hooks/usePlan'
import UpgradeModal from '../plan/UpgradeModal'
import type { PlanFeature } from '../../types/plan'
import Toast, { type ToastType } from '../ui/Toast'
import {
  addonBillItemId,
  fetchServiceAddons,
  isAddonBillItem,
} from '../../lib/serviceAddonService'
import type { ServiceAddon } from '../../types/serviceAddon'

type POSMode = 'pos' | 'walkin' | 'queue'
type POSStep = 'bill' | 'payment' | 'success'
type SplittableMethod = Exclude<PaymentMethod, 'split'>

function normalizeServiceCategory(category: string | undefined): string {
  const value = (category ?? '').trim()
  return value || 'other'
}

function formatServiceCategoryLabel(category: string): string {
  const key = normalizeServiceCategory(category)
  if (key === 'other') return 'Other'
  return key.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())
}

const LOCKED_FEATURE_LABELS: Record<PlanFeature, string> = {
  booking: 'Booking',
  queue: 'Queue',
  pos: 'POS',
  staff: 'Staff',
  gift_vouchers: 'Gift vouchers',
  reports: 'Reports',
  customer_history: 'Customer history',
  website_builder: 'Website builder',
  multi_shop: 'Multi-shop',
  stripe: 'Stripe payments',
  sms: 'SMS notifications',
}

interface POSPageProps {
  /** PIN entered at staff login (shown in header). */
  loginPin?: string
}

export default function POSPage({ loginPin }: POSPageProps = {}) {
  const { shopId } = useStaffShopId()
  const { can, plan, requiredPlan } = usePlan()
  const [upgradeFeature, setUpgradeFeature] = useState<PlanFeature | null>(null)

  function requireFeature(feature: PlanFeature, action: () => void) {
    if (!can(feature)) {
      setUpgradeFeature(feature)
      return
    }
    action()
  }

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
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<string>('all')
  const [serviceAddons, setServiceAddons] = useState<ServiceAddon[]>([])
  const [addonsLoading, setAddonsLoading] = useState(true)
  const [shop, setShop] = useState<Shop | null>(null)
  const [receiptNote, setReceiptNote] = useState('')
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailToast, setEmailToast] = useState<{ message: string; type: ToastType } | null>(null)
  const [healthFundEmailLoading, setHealthFundEmailLoading] = useState(false)
  const [showHealthFundEmailInput, setShowHealthFundEmailInput] = useState(false)
  const [healthFundEmailDraft, setHealthFundEmailDraft] = useState('')
  const [healthFundEmailSent, setHealthFundEmailSent] = useState<string | null>(null)
  const [healthFundLoading, setHealthFundLoading] = useState(false)
  const [healthFundNote, setHealthFundNote] = useState('')

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
  const [lastVisitHint, setLastVisitHint] = useState<string | null>(null)

  useEffect(() => {
    const load = () => fetchShop(shopId).then(setShop)
    load()
    const onUpdated = () => load()
    window.addEventListener(SHOP_UPDATED_EVENT, onUpdated)
    return () => window.removeEventListener(SHOP_UPDATED_EVENT, onUpdated)
  }, [shopId])

  useEffect(() => {
    async function loadTherapists() {
      const { data } = await supabase
        .from('staff')
        .select('id, name_en')
        .eq('shop_id', shopId)
        .eq('active', true)
        .eq('role', 'therapist')
        .order('name_en')
      setTherapists(data ?? [])
    }
    loadTherapists()
  }, [shopId])

  useEffect(() => {
    async function loadServices() {
      setServicesLoading(true)
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('shop_id', shopId)
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
  }, [shopId])

  useEffect(() => {
    async function loadAddons() {
      setAddonsLoading(true)
      try {
        setServiceAddons(await fetchServiceAddons(shopId, { activeOnly: true }))
      } catch {
        setServiceAddons([])
      }
      setAddonsLoading(false)
    }
    void loadAddons()
  }, [shopId])

  const serviceCategories = useMemo(() => {
    const categories = new Set<string>()
    for (const svc of services) {
      categories.add(normalizeServiceCategory(svc.category))
    }
    return Array.from(categories).sort((a, b) =>
      formatServiceCategoryLabel(a).localeCompare(formatServiceCategoryLabel(b))
    )
  }, [services])

  const filteredServices = useMemo(() => {
    if (serviceCategoryFilter === 'all') return services
    return services.filter(
      svc => normalizeServiceCategory(svc.category) === serviceCategoryFilter
    )
  }, [services, serviceCategoryFilter])

  useEffect(() => {
    if (
      serviceCategoryFilter !== 'all' &&
      !serviceCategories.includes(serviceCategoryFilter)
    ) {
      setServiceCategoryFilter('all')
    }
  }, [serviceCategories, serviceCategoryFilter])

  // Update sync status
  useEffect(() => {
    const update = async () => setSyncStatus(await getSyncStatus())
    update()
    const id = setInterval(update, 10000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!can('customer_history')) {
      setLastVisitHint(null)
      return
    }
    const email = clientEmail.trim()
    if (!email || !email.includes('@')) {
      setLastVisitHint(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      fetchLastCustomerVisit(shopId, email).then(visit => {
        if (cancelled) return
        if (!visit) {
          setLastVisitHint(null)
          return
        }
        const daysLabel =
          visit.daysAgo === 0
            ? 'today'
            : visit.daysAgo === 1
              ? '1 day ago'
              : `${visit.daysAgo} days ago`
        setLastVisitHint(
          `Last visit: ${daysLabel} · Service: ${visit.serviceLabel} · ${formatAUD(visit.total)}`
        )
      })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [clientEmail, can])

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

  const hasMainServiceInBill = useMemo(
    () => bill.some(item => !isAddonBillItem(item.serviceId)),
    [bill]
  )

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

  const toggleAddon = useCallback((addon: ServiceAddon) => {
    const lineId = addonBillItemId(addon.id)
    setBill(prev => {
      const exists = prev.find(i => i.serviceId === lineId)
      if (exists) return prev.filter(i => i.serviceId !== lineId)
      return [
        ...prev,
        {
          serviceId: lineId,
          serviceName: `+ ${addon.name}`,
          duration: 0,
          price: addon.price,
          gstFree: false,
        },
      ]
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

      if (clientPhone && can('sms')) {
        await sendSMS(
          clientPhone,
          SMS.receiptConfirm(shop.name, formatAUD(payment.total))
        )
      }

      if (clientEmail.trim()) {
        const emailResult = await emailReceipt(tx, shop)
        if (emailResult.ok) {
          setReceiptNote(
            emailResult.receiptNumber
              ? `Receipt ${emailResult.receiptNumber} emailed to ${clientEmail.trim()}`
              : 'Receipt emailed to customer'
          )
          setCurrentTx({ ...tx, receiptSent: true })
        } else {
          console.warn('[pos] auto receipt email failed', emailResult.error)
          setReceiptNote(emailResult.error ?? 'Receipt email could not be sent')
        }
      }

      if (shop.reviewRequestEnabled && shop.googleReviewUrl?.trim()) {
        void sendReviewRequestAfterCheckout({
          shopId: shop.id,
          clientName: clientName || undefined,
          clientEmail: clientEmail || undefined,
          clientPhone: clientPhone || undefined,
        })
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
    setHealthFundNote('')
    setEmailToast(null)
    setShowHealthFundEmailInput(false)
    setHealthFundEmailDraft('')
    setHealthFundEmailSent(null)
    clearAppliedVoucher()
    setStep('bill')
  }

  const buildHealthFundTransaction = (): Transaction | null => {
    if (currentTx) return currentTx
    if (!shop || !bill.length || !payment) return null

    const shopCode = shop.id.replace(/[^A-Z0-9]/gi, '').slice(0, 3).toUpperCase() || 'RCP'
    const finalPayment =
      splitMode && paymentSplits.length > 0
        ? calcPaymentWithSplits(bill, paymentSplits)
        : payment

    return {
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
      status: 'open',
      createdAt: new Date().toISOString(),
      paidAt: new Date().toISOString(),
      receiptSent: false,
      healthFundIssued: false,
      voucherCode: appliedVoucher?.code,
      voucherAmount: voucherDeduction > 0 ? voucherDeduction : undefined,
    }
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

  const resolveClientEmail = () =>
    (currentTx?.clientEmail ?? clientEmail).trim()

  const submitReceiptEmail = async (to: string) => {
    if (!currentTx || !shop) return
    const email = to.trim()
    if (!email) return

    setEmailLoading(true)
    setReceiptNote('')
    const tx = { ...currentTx, clientEmail: email }
    const result = await emailReceipt(tx, shop, email)
    setEmailLoading(false)

    if (result.ok) {
      setClientEmail(email)
      setCurrentTx({ ...tx, receiptSent: true })
      setEmailToast({ message: 'ส่งอีเมลสำเร็จ', type: 'success' })
    } else {
      setEmailToast({ message: 'ส่งอีเมลไม่สำเร็จ', type: 'error' })
    }
  }

  const clientEmailForReceipt = step === 'success' ? resolveClientEmail() : ''
  const showSendReceiptEmail =
    step === 'success' && clientEmailForReceipt.includes('@')

  const submitHealthFundEmail = async (to: string) => {
    if (!currentTx || !shop) return
    const email = to.trim()
    if (!email) return

    setHealthFundEmailLoading(true)
    setHealthFundNote('')
    const tx = { ...currentTx, clientEmail: email }
    const result = await emailHealthFundReceipt(tx, shop, email)
    setHealthFundEmailLoading(false)

    if (result.ok) {
      setClientEmail(email)
      setCurrentTx({ ...tx, healthFundIssued: true })
      setHealthFundEmailSent(email)
      setShowHealthFundEmailInput(false)
      setHealthFundEmailDraft('')
    } else {
      setHealthFundNote(result.error ?? 'Could not send health fund email')
    }
  }

  const onHealthFundEmailClick = () => {
    const email = resolveClientEmail()
    if (email) void submitHealthFundEmail(email)
    else {
      setShowHealthFundEmailInput(true)
      setHealthFundEmailDraft(clientEmail)
    }
  }

  const handlePrint = async () => {
    if (!currentTx || !shop) return
    await printReceipt(currentTx, shop)
  }

  const handleHealthFund = async () => {
    if (!shop) return
    const tx = buildHealthFundTransaction()
    if (!tx) {
      const msg = 'Add services to the bill before generating a health fund receipt'
      setHealthFundNote(msg)
      setReceiptNote(msg)
      return
    }
    setHealthFundLoading(true)
    setHealthFundNote('')
    setReceiptNote('')
    try {
      await downloadHealthFundPDF(tx, shop)
      const msg = 'Health fund receipt downloaded'
      setHealthFundNote(msg)
      setReceiptNote(msg)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : 'Could not generate health fund PDF'
      setHealthFundNote(msg)
      setReceiptNote(msg)
    } finally {
      setHealthFundLoading(false)
    }
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
            className={`voucher-sell-btn${!can('gift_vouchers') ? ' pos-feature-locked' : ''}`}
            onClick={() =>
              requireFeature('gift_vouchers', () => {
                setShowSellVoucher(true)
                setSellError('')
                setSoldVoucherEmailNote(null)
              })
            }
          >
            🎁 Gift Voucher
            {!can('gift_vouchers') && <span aria-hidden> 🔒</span>}
          </button>
          {syncStatus.pending > 0 && (
            <span className="sync-badge">
              {syncStatus.pending} pending sync
            </span>
          )}
          {loginPin && <span className="pin-badge">PIN {loginPin}</span>}
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
                {lastVisitHint && (
                  <p className="pos-customer-hint">{lastVisitHint}</p>
                )}
                <input
                  className="pos-input"
                  placeholder={can('sms') ? 'เบอร์โทร (SMS)' : 'เบอร์โทร (SMS — upgrade to unlock)'}
                  value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                  disabled={!can('sms')}
                  title={!can('sms') ? 'SMS requires Growth plan or SMS add-on' : undefined}
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
            <div className="pos-card services-picker-card">
              <div className="card-label">เลือกบริการ</div>
              {!servicesLoading && services.length > 0 && (
                <div className="service-category-tabs" role="tablist" aria-label="Service categories">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={serviceCategoryFilter === 'all'}
                    className={`service-category-tab${serviceCategoryFilter === 'all' ? ' active' : ''}`}
                    onClick={() => setServiceCategoryFilter('all')}
                  >
                    All
                  </button>
                  {serviceCategories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      role="tab"
                      aria-selected={serviceCategoryFilter === cat}
                      className={`service-category-tab${serviceCategoryFilter === cat ? ' active' : ''}`}
                      onClick={() => setServiceCategoryFilter(cat)}
                    >
                      {formatServiceCategoryLabel(cat)}
                    </button>
                  ))}
                </div>
              )}
              <div className="services-grid">
                {servicesLoading ? (
                  <p className="services-empty">กำลังโหลดบริการ…</p>
                ) : services.length === 0 ? (
                  <p className="services-empty">
                    ยังไม่มีบริการที่เปิดใช้งาน — เพิ่มในหน้า Services (Owner)
                  </p>
                ) : filteredServices.length === 0 ? (
                  <p className="services-empty">ไม่มีบริการในหมวดนี้</p>
                ) : (
                  filteredServices.map(svc => {
                    const added = bill.some(i => i.serviceId === svc.id)
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        className={`svc-card${added ? ' added' : ''}`}
                        onClick={() => toggleService(svc)}
                      >
                        <div className="svc-card-name">{svc.name}</div>
                        <div className="svc-card-price">{formatAUD(svc.price)}</div>
                        <div className="svc-card-meta">
                          <span className="svc-card-duration">{svc.duration} min</span>
                          {svc.gstFree && <span className="gst-free-tag">GST-free</span>}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>

              {hasMainServiceInBill && !addonsLoading && serviceAddons.length > 0 && (
                <div className="service-addon-chips">
                  <div className="service-addon-chips-label">Add-ons</div>
                  <div className="service-addon-chip-row">
                    {serviceAddons.map(addon => {
                      const lineId = addonBillItemId(addon.id)
                      const selected = bill.some(i => i.serviceId === lineId)
                      return (
                        <button
                          key={addon.id}
                          type="button"
                          className={`service-addon-chip${selected ? ' selected' : ''}`}
                          onClick={() => toggleAddon(addon)}
                        >
                          <span className="service-addon-chip-sign" aria-hidden>
                            {selected ? '−' : '+'}
                          </span>
                          <span className="service-addon-chip-name">{addon.name}</span>
                          <span className="service-addon-chip-price">{formatAUD(addon.price)}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
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
                    <div
                      key={item.serviceId}
                      className={`bill-item${isAddonBillItem(item.serviceId) ? ' bill-item-addon' : ''}`}
                    >
                      <div className="bill-item-info">
                        <div className="bill-item-name">{item.serviceName}</div>
                        <div className="bill-item-sub">
                          {isAddonBillItem(item.serviceId) ? 'Add-on' : `${item.duration} min`}
                        </div>
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
                    className={`split-toggle-btn${showRedeemVoucher && !appliedVoucher ? ' active' : ''}${!can('gift_vouchers') ? ' pos-feature-locked' : ''}`}
                    onClick={() => {
                      if (appliedVoucher) return
                      requireFeature('gift_vouchers', () => {
                        setShowRedeemVoucher(v => !v)
                        setRedeemError('')
                      })
                    }}
                    disabled={!!appliedVoucher}
                  >
                    🎫 Redeem Voucher
                    {!can('gift_vouchers') && <span aria-hidden> 🔒</span>}
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
                <>
                  <button
                    type="button"
                    className="hf-btn"
                    disabled={healthFundLoading || !bill.length || !shop}
                    onClick={handleHealthFund}
                  >
                    {healthFundLoading ? 'Generating PDF…' : '❤️ ออก Health Fund Receipt'}
                  </button>
                  {healthFundNote && <p className="success-note">{healthFundNote}</p>}
                </>
              )}

              {/* Void */}
              {bill.length > 0 && (
                <button type="button" className="void-btn" onClick={reset}>
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
            {showSendReceiptEmail && (
              <button
                type="button"
                className="s-btn primary"
                disabled={emailLoading || !shop}
                onClick={() => void submitReceiptEmail(clientEmailForReceipt)}
              >
                {emailLoading ? 'กำลังส่ง…' : '✉️ Send Receipt by Email'}
              </button>
            )}
            <button className="s-btn" onClick={handlePrint}>🖨 Print Receipt</button>
            <button
              type="button"
              className="s-btn"
              disabled={healthFundLoading || !shop}
              onClick={handleHealthFund}
            >
              {healthFundLoading ? 'Generating…' : '❤️ Health Fund PDF'}
            </button>
            <button
              type="button"
              className="s-btn"
              disabled={healthFundEmailLoading || !shop}
              onClick={onHealthFundEmailClick}
            >
              {healthFundEmailLoading ? 'Sending…' : '📧 Email Health Fund PDF'}
            </button>
            <button className="s-btn" onClick={reset}>ปิดบิล</button>
          </div>
          {showHealthFundEmailInput && !healthFundEmailSent && (
            <div className="success-email-prompt">
              <input
                type="email"
                className="pos-input success-email-input"
                placeholder="กรอก email ลูกค้า"
                value={healthFundEmailDraft}
                onChange={e => setHealthFundEmailDraft(e.target.value)}
                autoComplete="email"
              />
              <button
                type="button"
                className="s-btn primary"
                disabled={healthFundEmailLoading || !healthFundEmailDraft.trim()}
                onClick={() => void submitHealthFundEmail(healthFundEmailDraft)}
              >
                {healthFundEmailLoading ? 'Sending…' : 'Send'}
              </button>
            </div>
          )}
          {healthFundEmailSent && (
            <p className="success-email-sent">✅ ส่งแล้วไปที่ {healthFundEmailSent}</p>
          )}
          {healthFundNote && !healthFundEmailSent && (
            <p className="success-note">{healthFundNote}</p>
          )}
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

      {upgradeFeature && (
        <UpgradeModal
          featureLabel={LOCKED_FEATURE_LABELS[upgradeFeature]}
          requiredPlan={requiredPlan(upgradeFeature)}
          currentPlan={plan}
          onClose={() => setUpgradeFeature(null)}
        />
      )}

      {emailToast && (
        <Toast
          message={emailToast.message}
          type={emailToast.type}
          onClose={() => setEmailToast(null)}
        />
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
