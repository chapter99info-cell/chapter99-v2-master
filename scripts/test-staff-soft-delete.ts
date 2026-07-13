/**
 * Unit checks for staff soft-delete helpers (no DB required).
 * Usage: npx tsx scripts/test-staff-soft-delete.ts
 *    or: npm run test:staff-soft-delete
 */
import {
  DELETED_PIN_MARKER,
  canDeleteStaffMember,
  evaluateSoftDeleteResult,
  isDeletedPinHash,
} from '../src/lib/staffSoftDelete'

let failed = 0
function assert(name: string, cond: boolean) {
  if (cond) {
    console.log(`  OK  ${name}`)
  } else {
    failed += 1
    console.error(`  FAIL ${name}`)
  }
}

console.log('staff soft-delete helpers')

assert('sentinel looks like bcrypt', DELETED_PIN_MARKER.startsWith('$2a$'))
assert('sentinel is not plain __deleted__', DELETED_PIN_MARKER !== '__deleted__')

assert('isDeletedPinHash: sentinel', isDeletedPinHash(DELETED_PIN_MARKER))
assert('isDeletedPinHash: legacy __deleted__', isDeletedPinHash('__deleted__'))
assert('isDeletedPinHash: legacy DELETED', isDeletedPinHash('DELETED'))
assert(
  'isDeletedPinHash: normal bcrypt PIN',
  !isDeletedPinHash('$2a$06$/tM5JX/tiykve1gjGevd9.LWK')
)
assert('isDeletedPinHash: null', !isDeletedPinHash(null))
assert('isDeletedPinHash: empty', !isDeletedPinHash(''))

assert(
  'evaluate: success only when sentinel sticks',
  evaluateSoftDeleteResult({
    error: null,
    rows: [{ id: '1', pin_hash: DELETED_PIN_MARKER }],
  }).ok === true
)

assert(
  'evaluate: fail when trigger re-hashes plain marker',
  evaluateSoftDeleteResult({
    error: null,
    rows: [{ id: '1', pin_hash: '$2a$06$O48RG1gWMyRk6Vgs0fQsXu.someOtherHash' }],
  }).reason === 'marker_altered'
)

assert(
  'evaluate: fail on empty (RLS / wrong shop)',
  evaluateSoftDeleteResult({ error: null, rows: [] }).reason === 'empty'
)

assert(
  'evaluate: fail on null rows',
  evaluateSoftDeleteResult({ error: null, rows: null }).reason === 'empty'
)

assert(
  'evaluate: fail on supabase error',
  evaluateSoftDeleteResult({
    error: { message: 'permission denied', code: '42501' },
    rows: null,
  }).reason === 'error'
)

assert(
  'evaluate: never success on active-only fake path (no sentinel)',
  evaluateSoftDeleteResult({
    error: null,
    rows: [{ id: '1', pin_hash: '$2a$06$stillARealPinHashxxxxxxxxxxxx' }],
  }).ok === false
)

assert(
  'list filter hides sentinel rows',
  [{ pin_hash: DELETED_PIN_MARKER }, { pin_hash: '$2a$06$active' }].filter(
    s => !isDeletedPinHash(s.pin_hash)
  ).length === 1
)

assert(
  'double-delete still ok (idempotent sentinel write)',
  evaluateSoftDeleteResult({
    error: null,
    rows: [{ id: '1', pin_hash: DELETED_PIN_MARKER }],
  }).ok === true
)

console.log('last owner/super_admin delete guard')

assert(
  'guard: therapist always allowed',
  canDeleteStaffMember({
    target: { id: 't1', role: 'therapist', active: true },
    shopStaff: [{ id: 'o1', role: 'owner', active: true }],
  }).allowed === true
)

assert(
  'guard: block last active owner',
  canDeleteStaffMember({
    target: { id: 'o1', role: 'owner', active: true },
    shopStaff: [{ id: 'o1', role: 'owner', active: true }],
  }).allowed === false
)

assert(
  'guard: block last active super_admin when owner suspended',
  canDeleteStaffMember({
    target: { id: 'sa1', role: 'super_admin', active: false },
    shopStaff: [
      { id: 'sa1', role: 'super_admin', active: false },
      { id: 'o1', role: 'owner', active: false },
    ],
  }).allowed === false
)

assert(
  'guard: allow owner when another active super_admin exists',
  canDeleteStaffMember({
    target: { id: 'o1', role: 'owner', active: true },
    shopStaff: [
      { id: 'o1', role: 'owner', active: true },
      { id: 'sa1', role: 'super_admin', active: true },
    ],
  }).allowed === true
)

assert(
  'guard: ignore soft-deleted other admin',
  canDeleteStaffMember({
    target: { id: 'o1', role: 'owner', active: true },
    shopStaff: [
      { id: 'o1', role: 'owner', active: true },
      { id: 'sa1', role: 'super_admin', active: true, pin_hash: DELETED_PIN_MARKER },
    ],
  }).allowed === false
)

assert(
  'guard: role case-insensitive SUPER_ADMIN',
  canDeleteStaffMember({
    target: { id: 'sa1', role: 'SUPER_ADMIN', active: true },
    shopStaff: [
      { id: 'sa1', role: 'SUPER_ADMIN', active: true },
      { id: 'o1', role: 'Owner', active: true },
    ],
  }).allowed === true
)

if (failed) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll soft-delete assertions passed')
