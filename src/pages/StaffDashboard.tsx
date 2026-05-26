import StaffPortalShell from '../components/staff/StaffPortalShell'

/** Guide / staff portal at /staff (PIN 1111). */
export default function StaffDashboard({ onLogout }: { onLogout: () => void }) {
  return <StaffPortalShell onLogout={onLogout} />
}
