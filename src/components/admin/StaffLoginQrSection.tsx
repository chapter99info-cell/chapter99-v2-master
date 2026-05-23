import { useCallback, useState } from 'react'
import QRCode from 'react-qr-code'
import QRCodeLib from 'qrcode'
import { buildStaffLoginUrl } from '../../lib/staffLoginUrl'
import Toast, { type ToastType } from '../ui/Toast'

interface StaffLoginQrSectionProps {
  shopSlug: string | null | undefined
  shopName: string
}

export default function StaffLoginQrSection({
  shopSlug,
  shopName,
}: StaffLoginQrSectionProps) {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const [downloading, setDownloading] = useState(false)

  const slug = shopSlug?.trim().toLowerCase() || ''
  const staffUrl = slug ? buildStaffLoginUrl(slug) : null

  const copyLink = useCallback(async () => {
    if (!staffUrl) return
    try {
      await navigator.clipboard.writeText(staffUrl)
      setToast({ message: 'Staff login link copied', type: 'success' })
    } catch {
      setToast({ message: 'Could not copy — select the link and copy manually', type: 'error' })
    }
  }, [staffUrl])

  const downloadQr = useCallback(async () => {
    if (!staffUrl) return
    setDownloading(true)
    try {
      const dataUrl = await QRCodeLib.toDataURL(staffUrl, {
        width: 512,
        margin: 2,
        color: { dark: '#1a3d2b', light: '#ffffff' },
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${slug || 'shop'}-staff-login-qr.png`
      a.click()
      setToast({ message: 'QR code downloaded', type: 'success' })
    } catch (err) {
      console.error('[StaffLoginQrSection] download failed', err)
      setToast({ message: 'Could not generate QR image', type: 'error' })
    } finally {
      setDownloading(false)
    }
  }, [staffUrl, slug])

  return (
    <section className="staff-login-section" aria-labelledby="staff-login-heading">
      <h3 id="staff-login-heading" className="shop-detail-subtitle">
        Staff Login URL
      </h3>
      <p className="staff-login-hint sws-muted">
        พนักงานแสกน QR หรือบุ๊คมาร์ค URL นี้
      </p>

      {!slug ? (
        <p className="sws-error" style={{ marginTop: 12 }}>
          Set a shop URL slug in Website settings before generating a staff login QR.
        </p>
      ) : (
        <>
          <div className="staff-login-qr-preview">
            <div className="staff-login-qr-card">
              <QRCode
                value={staffUrl!}
                size={200}
                level="M"
                bgColor="#ffffff"
                fgColor="#1a3d2b"
              />
            </div>
            <div className="staff-login-qr-meta">
              <p className="staff-login-qr-shop">{shopName}</p>
              <a
                href={staffUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="staff-login-qr-link"
              >
                {staffUrl}
              </a>
            </div>
          </div>

          <div className="staff-login-actions">
            <button
              type="button"
              className="action-btn"
              disabled={downloading}
              onClick={() => void downloadQr()}
            >
              {downloading ? 'Generating…' : 'Download QR'}
            </button>
            <button type="button" className="action-btn" onClick={() => void copyLink()}>
              Copy link
            </button>
            <a
              href={staffUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="action-btn"
            >
              Open staff login
            </a>
          </div>
        </>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </section>
  )
}
