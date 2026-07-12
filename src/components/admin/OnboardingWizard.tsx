import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  generateShopIdFromName,
  generateShopSlug,
  type OnboardingPayload,
} from '../../lib/onboardingUtils'
import { normalizeCustomDomain } from '../../config/shopRegistry'

const ADMIN_SESSION = import.meta.env.VITE_SUPER_ADMIN_SESSION_SECRET as string | undefined

const PLANS = [
  { id: 'starter' as const, label: 'Starter', setup: 199, monthly: 19 },
  { id: 'professional' as const, label: 'Professional', setup: 199, monthly: 49 },
  { id: 'business' as const, label: 'Business', setup: 199, monthly: 99 },
]

const THEMES = [
  { id: 'elegant' as const, label: 'Elegant', colors: ['#2D5016', '#C8A84B'] },
  { id: 'traditional' as const, label: 'Traditional', colors: ['#7B5EA7', '#D4AF37'] },
  { id: 'minimal' as const, label: 'Minimal', colors: ['#6B7280', '#FFFFFF'] },
  { id: 'modern' as const, label: 'Modern', colors: ['#1A1A1A', '#FFFFFF'] },
  { id: 'jasmine' as const, label: 'Jasmine Luxury', colors: ['#B8860B', '#D4AF37'] },
  { id: 'koala' as const, label: 'Koala Wellness', colors: ['#3D6B4F', '#7A9E7E'] },
]

type Step = 1 | 2 | 3 | 4 | 5

interface OnboardingWizardProps {
  onClose: () => void
  onComplete?: () => void
}

export default function OnboardingWizard({ onClose, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>(1)
  const [name, setName] = useState('')
  const [shopId, setShopId] = useState('')
  const [shopSlug, setShopSlug] = useState('')
  const [abn, setAbn] = useState('')
  const [address, setAddress] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [plan, setPlan] = useState<OnboardingPayload['plan']>('professional')
  const [photographyAddon, setPhotographyAddon] = useState(false)
  const [themeId, setThemeId] = useState<OnboardingPayload['themeId']>('elegant')
  const [primaryColor, setPrimaryColor] = useState('#2D5016')
  const [domainInput, setDomainInput] = useState('')
  const [domains, setDomains] = useState<string[]>([])
  const [domainCheck, setDomainCheck] = useState<{ ok: boolean; conflicts: { domain: string; existingSlug: string }[] } | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (name.trim()) {
      setShopId(generateShopIdFromName(name))
      setShopSlug(generateShopSlug(name))
    }
  }, [name])

  const payload = useMemo<OnboardingPayload>(
    () => ({
      name: name.trim(),
      shopId,
      shopSlug,
      abn: abn.trim(),
      address: address.trim(),
      ownerEmail: ownerEmail.trim(),
      ownerPhone: ownerPhone.trim(),
      plan,
      photographyAddon,
      themeId,
      primaryColor,
      domains,
    }),
    [name, shopId, shopSlug, abn, address, ownerEmail, ownerPhone, plan, photographyAddon, themeId, primaryColor, domains]
  )

  const appendLog = useCallback((line: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${line}`])
  }, [])

  const apiHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      'x-admin-session': ADMIN_SESSION ?? '',
    }),
    []
  )

  const checkDomainsLive = useCallback(async (list: string[]) => {
    if (!list.length) {
      setDomainCheck(null)
      return
    }
    const res = await fetch('/api/onboarding/check-domains', {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({ domains: list }),
    })
    const data = (await res.json()) as { ok: boolean; conflicts: { domain: string; existingSlug: string }[] }
    setDomainCheck(data)
  }, [apiHeaders])

  function addDomain() {
    const raw = domainInput.trim()
    if (!raw) return
    const host = normalizeCustomDomain(raw)
    if (!host) return
    // Keep apex + www as distinct literals (matches Mira registry). Dedupe exact strings.
    const candidates = [host, `www.${host}`]
    const next = [...domains]
    for (const d of candidates) {
      if (!next.includes(d)) next.push(d)
    }
    if (next.length === domains.length) return
    setDomains(next)
    setDomainInput('')
    void checkDomainsLive(next)
  }

  async function runStep(path: string, body: unknown): Promise<boolean> {
    appendLog(`→ POST /api/onboarding/${path}`)
    const res = await fetch(`/api/onboarding/${path}`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; result?: { ok?: boolean; error?: string } }
    const ok = res.ok && (data.ok !== false) && (data.result?.ok !== false)
    if (ok) {
      appendLog(`✓ ${path} completed`)
      return true
    }
    appendLog(`✗ ${path} failed: ${data.error ?? data.result?.error ?? res.statusText}`)
    return false
  }

  async function createShop() {
    if (!ADMIN_SESSION) {
      appendLog('✗ VITE_SUPER_ADMIN_SESSION_SECRET not configured')
      return
    }
    setSubmitting(true)
    setLogs([])
    appendLog('Starting onboarding pipeline…')

    const steps: [string, unknown][] = [
      ['check-domains', { domains }],
      ['register-shop', payload],
      ['create-shop-db', payload],
      ['deploy', {}],
    ]

    for (const [path, body] of steps) {
      const ok = await runStep(path, body)
      if (!ok) {
        setSubmitting(false)
        return
      }
    }

    appendLog('✅ Shop created — Vercel deploy triggered')
    setSubmitting(false)
    onComplete?.()
  }

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true">
      <div className="onboarding-modal">
        <div className="onboarding-header">
          <h2>Onboarding Wizard</h2>
          <button type="button" className="action-btn" onClick={onClose}>Close</button>
        </div>

        <div className="onboarding-steps">
          {[1, 2, 3, 4, 5].map(n => (
            <span key={n} className={`onboarding-step-dot${step === n ? ' active' : step > n ? ' done' : ''}`}>
              {n}
            </span>
          ))}
        </div>

        {step === 1 && (
          <div className="onboarding-body">
            <h3>Shop basics</h3>
            <label>Shop name<input className="search-input" value={name} onChange={e => setName(e.target.value)} /></label>
            <p className="sws-muted">shopId: {shopId || '—'} · slug: {shopSlug || '—'}</p>
            <label>ABN<input className="search-input" value={abn} onChange={e => setAbn(e.target.value)} /></label>
            <label>Address<input className="search-input" value={address} onChange={e => setAddress(e.target.value)} /></label>
            <label>Owner email<input className="search-input" type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} /></label>
            <label>Owner phone<input className="search-input" value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} /></label>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-body">
            <h3>Plan selection</h3>
            <div className="onboarding-plan-grid">
              {PLANS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className={`plan-option${plan === p.id ? ' selected' : ''}`}
                  onClick={() => setPlan(p.id)}
                >
                  <strong>{p.label}</strong>
                  <span>${p.setup} setup</span>
                  <span>${p.monthly}/mo</span>
                </button>
              ))}
            </div>
            <label className="onboarding-check">
              <input type="checkbox" checked={photographyAddon} onChange={e => setPhotographyAddon(e.target.checked)} />
              Photography add-on $499 one-time
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-body">
            <h3>Theme + colour</h3>
            <div className="onboarding-plan-grid">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`plan-option${themeId === t.id ? ' selected' : ''}`}
                  onClick={() => {
                    setThemeId(t.id)
                    setPrimaryColor(t.colors[0])
                  }}
                >
                  {t.label}
                  <span style={{ color: t.colors[0] }}>● {t.colors[0]}</span>
                </button>
              ))}
            </div>
            <label>Primary colour<input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} /></label>
          </div>
        )}

        {step === 4 && (
          <div className="onboarding-body">
            <h3>Domains</h3>
            <div className="onboarding-domain-row">
              <input className="search-input" placeholder="example.com.au" value={domainInput} onChange={e => setDomainInput(e.target.value)} />
              <button type="button" className="add-shop-btn" onClick={addDomain}>Add</button>
            </div>
            <ul className="onboarding-domain-list">
              {domains.map(d => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            {domainCheck && !domainCheck.ok && (
              <p className="pin-error">
                Conflicts: {domainCheck.conflicts.map(c => `${c.domain} → ${c.existingSlug}`).join(', ')}
              </p>
            )}
            {domainCheck?.ok && domains.length > 0 && <p className="sws-muted">✓ No domain conflicts</p>}
          </div>
        )}

        {step === 5 && (
          <div className="onboarding-body">
            <h3>Review</h3>
            <pre className="onboarding-review">{JSON.stringify(payload, null, 2)}</pre>
            {logs.length > 0 && (
              <div className="onboarding-log">
                {logs.map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
            )}
            <button type="button" className="add-shop-btn" disabled={submitting || !domainCheck?.ok} onClick={() => void createShop()}>
              {submitting ? 'Creating…' : 'Create Shop'}
            </button>
          </div>
        )}

        <div className="onboarding-footer">
          {step > 1 && (
            <button type="button" className="action-btn" onClick={() => setStep(s => (s - 1) as Step)}>Back</button>
          )}
          {step < 5 && (
            <button
              type="button"
              className="add-shop-btn"
              onClick={() => {
                if (step === 4) void checkDomainsLive(domains)
                setStep(s => (s + 1) as Step)
              }}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
