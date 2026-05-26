import type { CRMClient, Tour } from '../types/tour'
import type { OSHCValidation } from '../types/compliance'

export const WAIVER_TEXT = {
  EN: {
    title: 'Student Tour Liability Waiver & Safety Agreement',
    terms: 'I agree to follow all guide and safety instructions during the tour.',
    risk: 'I acknowledge inherent risks of travel activities and accept responsibility.',
    medical: 'I authorize emergency medical treatment if required during the tour.',
    media: 'I consent to photographic and video recording for promotional use.',
    privacy: 'I confirm my visa and personal details match official documents.',
  },
  TH: {
    title: 'หนังสือยินยอมสละสิทธิ์ความรับผิดชอบและข้อตกลงความปลอดภัย',
    terms: 'ข้าพเจ้ายินยอมปฏิบัติตามคำสั่งและข้อปฏิบัติความปลอดภัยของมัคคุเทศก์',
    risk: 'ข้าพเจ้ารับทราบความเสี่ยงของกิจกรรมท่องเที่ยวและยอมรับความรับผิดชอบ',
    medical: 'ข้าพเจ้ายินยอมให้มีการรักษาพยาบาลฉุกเฉินหากจำเป็น',
    media: 'ข้าพเจ้ายินยอมให้ถ่ายภาพและวิดีโอเพื่อการประชาสัมพันธ์',
    privacy: 'ข้าพเจ้ายืนยันว่าข้อมูลวีซ่าและข้อมูลส่วนตัวตรงกับเอกสารทางการ',
  },
} as const

export type WaiverLanguage = keyof typeof WAIVER_TEXT

export function validateOSHC(client: CRMClient, tour: Tour): OSHCValidation {
  const warnings: string[] = []
  const expiry = new Date(client.oshc_expiry)
  const tourEnd = new Date(tour.end_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daysRemaining = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (expiry < today) {
    warnings.push(`OSHC expired on ${client.oshc_expiry}`)
  } else if (expiry < tourEnd) {
    warnings.push(`OSHC expires before tour end (${client.oshc_expiry} vs ${tour.end_date})`)
  }

  return {
    is_valid: warnings.length === 0,
    days_remaining: Math.max(0, daysRemaining),
    warnings,
  }
}
