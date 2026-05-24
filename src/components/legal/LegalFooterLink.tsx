import { Link } from 'react-router-dom'
import { isExternalLegalUrl } from '../../lib/legalUrls'

export default function LegalFooterLink({
  href,
  label,
}: {
  href: string
  label: string
}) {
  if (isExternalLegalUrl(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    )
  }
  return <Link to={href}>{label}</Link>
}
