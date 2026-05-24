import { Link } from 'react-router-dom'
import { isExternalLegalUrl } from '../../lib/legalUrls'

interface LegalAgreementCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  privacyHref: string
  termsHref: string
  id?: string
  required?: boolean
}

function LegalLink({
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

export default function LegalAgreementCheckbox({
  checked,
  onChange,
  privacyHref,
  termsHref,
  id = 'legal-agree',
  required = false,
}: LegalAgreementCheckboxProps) {
  return (
    <label className="legal-agree-label" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        className="legal-agree-input"
        checked={checked}
        required={required}
        aria-required={required}
        onChange={e => onChange(e.target.checked)}
      />
      <span>
        I agree to the <LegalLink href={termsHref} label="Terms of Service" /> and{' '}
        <LegalLink href={privacyHref} label="Privacy Policy" />
      </span>
    </label>
  )
}
