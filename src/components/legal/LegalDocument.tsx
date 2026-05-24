import type { ReactNode } from 'react'

interface LegalDocumentProps {
  title: string
  shopName: string
  lastUpdated: string
  children: ReactNode
}

export default function LegalDocument({
  title,
  shopName,
  lastUpdated,
  children,
}: LegalDocumentProps) {
  return (
    <article className="public-page legal-doc">
      <p className="public-eyebrow">Legal</p>
      <h1 className="public-page-title">{title}</h1>
      <p className="legal-doc-meta">
        <strong>{shopName}</strong>
        <span aria-hidden> · </span>
        Last updated {lastUpdated}
      </p>
      <div className="legal-doc-body">{children}</div>
    </article>
  )
}

export function LegalSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}
