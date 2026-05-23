/** Public multi-tenant shop routing & business context */
export type BusinessType = 'massage' | 'restaurant'

export const BUSINESS_TYPES: BusinessType[] = ['massage', 'restaurant']

export function isBusinessType(value: string | null | undefined): value is BusinessType {
  return value === 'massage' || value === 'restaurant'
}
