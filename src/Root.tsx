import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import PublicVoucherPage from './pages/PublicVoucherPage'

export default function Root() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/voucher" element={<PublicVoucherPage />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  )
}
