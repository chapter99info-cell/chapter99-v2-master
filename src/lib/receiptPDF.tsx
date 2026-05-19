// Re-export jsPDF receipt utilities (legacy import path)
export {
  buildReceiptPDF,
  downloadReceiptPDF,
  generateReceiptPDF,
  generateReceiptPDFBlob,
  receiptPDFToBase64,
} from '../components/receipt/ReceiptPDF'

export type { ReceiptPDFOptions } from '../components/receipt/ReceiptPDF'
