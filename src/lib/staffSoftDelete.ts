/**
 * Staff soft-delete helpers.
 *
 * Live staff_pin_hash may bcrypt-hash any non-bcrypt pin_hash. Soft-delete must
 * therefore write a pre-hashed bcrypt sentinel so the marker survives the trigger
 * and the staff list filter can hide the row.
 */

/** crypt('__deleted__', gen_salt('bf')) - not a valid 4-digit login PIN. */
export const DELETED_PIN_MARKER =
  '$2a$06$O48RG1gWMyRk6Vgs0fQsXuwcmpKNuVSVcW9xni7W2ABVF1he.D9ZG'

export const PRIVILEGED_STAFF_ROLES = ['owner', 'super_admin'] as const

export const LAST_ADMIN_BLOCK_MESSAGE =
  "Can't remove the last owner/admin for this shop."

export type SoftDeleteRow = {
  id?: string
  pin_hash?: string | null
}

export type PrivilegedStaffRow = SoftDeleteRow & {
  id: string
  role: string
  active?: boolean | null
}

export function normalizeStaffRole(role: string | null | undefined): string {
  return (role ?? '').trim().toLowerCase()
}

export function isPrivilegedStaffRole(role: string | null | undefined): boolean {
  const r = normalizeStaffRole(role)
  return r === 'owner' || r === 'super_admin'
}

export function isDeletedPinHash(hash: string | null | undefined): boolean {
  if (!hash) return false
  return (
    hash === DELETED_PIN_MARKER ||
    hash === '__deleted__' ||
    hash === 'DELETED'
  )
}

export function isDeletedStaff(row: SoftDeleteRow): boolean {
  return isDeletedPinHash(row.pin_hash)
}

/** Map DB trigger P0001 (and message) to the friendly last-admin toast. */
export function friendlyStaffMutationError(
  error: { message?: string; code?: string } | null | undefined
): string | null {
  if (!error?.message && !error?.code) return null
  const msg = error.message ?? ''
  const code = error.code ?? ''
  if (
    code === 'P0001' ||
    msg.includes(LAST_ADMIN_BLOCK_MESSAGE) ||
    /last owner\/admin/i.test(msg)
  ) {
    return LAST_ADMIN_BLOCK_MESSAGE
  }
  return null
}

export type SoftDeleteEval =
  | { ok: true }
  | { ok: false; reason: 'error' | 'empty' | 'marker_altered'; message: string }

/**
 * Decide whether a soft-delete update actually stuck.
 * Success toast must only fire when ok === true.
 */
export function evaluateSoftDeleteResult(args: {
  error: { message: string; code?: string } | null
  rows: SoftDeleteRow[] | null | undefined
}): SoftDeleteEval {
  const { error, rows } = args

  if (error) {
    const lastAdmin = friendlyStaffMutationError(error)
    if (lastAdmin) {
      return { ok: false, reason: 'error', message: lastAdmin }
    }
    const message =
      error.message.includes('policy') || error.code === '42501'
        ? `${error.message} - run supabase/12-staff-manager-rls.sql in Supabase SQL Editor`
        : error.message
    return { ok: false, reason: 'error', message }
  }

  if (!rows?.length) {
    return {
      ok: false,
      reason: 'empty',
      message:
        'Delete did not apply - no matching staff row (check shop / permissions).',
    }
  }

  if (rows[0]?.pin_hash !== DELETED_PIN_MARKER) {
    return {
      ok: false,
      reason: 'marker_altered',
      message:
        'Delete failed: PIN marker was altered by the database. Staff was not removed from the list.',
    }
  }

  return { ok: true }
}

export type LastAdminGuard =
  | { allowed: true }
  | { allowed: false; message: string }

/**
 * Block deleting OR deactivating the last active owner/super_admin for a shop.
 * Non-privileged roles are always allowed. shopStaff should be the shop's
 * owner/super_admin rows (active + inactive); filtering is done here.
 */
export function canDeleteStaffMember(args: {
  target: PrivilegedStaffRow
  shopStaff: PrivilegedStaffRow[]
}): LastAdminGuard {
  if (!isPrivilegedStaffRole(args.target.role)) {
    return { allowed: true }
  }

  const otherActiveAdmins = args.shopStaff.filter(row => {
    if (row.id === args.target.id) return false
    if (!isPrivilegedStaffRole(row.role)) return false
    if (isDeletedStaff(row)) return false
    if (row.active === false) return false
    return true
  })

  if (otherActiveAdmins.length === 0) {
    return {
      allowed: false,
      message: LAST_ADMIN_BLOCK_MESSAGE,
    }
  }

  return { allowed: true }
}

/** Same rules as soft-delete — used by Suspend / deactivate. */
export const canDeactivateStaffMember = canDeleteStaffMember
