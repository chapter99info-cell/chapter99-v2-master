export interface WaiverData {
  client_id: string
  agreed_terms: boolean
  agreed_risk: boolean
  agreed_medical: boolean
  agreed_media: boolean
  agreed_privacy: boolean
  digital_signature: string
  signed_at: string
}

export interface OSHCValidation {
  is_valid: boolean
  days_remaining: number
  warnings: string[]
}
