import { Link } from 'react-router-dom'
import { useShopContext } from '../../contexts/ShopContext'

const CORE_BRAND = '#2D5016'

const linkStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '10px 20px',
  color: CORE_BRAND,
  fontWeight: 600,
  textDecoration: 'underline',
  fontSize: '14px',
}

export default function StaffLoginButton() {
  const { withShopQuery } = useShopContext()

  return (
    <Link to={withShopQuery('/chapter99/staff')} style={linkStyle}>
      Staff Login / เข้าสู่ระบบพนักงาน
    </Link>
  )
}
