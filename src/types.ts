export interface Client {
  id?: string;
  name: string;
  address: string;
  gstin: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  createdBy: string;
}

export interface InvoiceItem {
  id: string;
  hsn: string;
  description: string;
  qty: number;
  unit: string;
  rate: number;
  taxRate: number;
  taxAmount: number;
  amount: number;
}

export interface Invoice {
  id?: string;
  invoiceNo: string;
  invoiceDate: string;
  clientId: string;
  companyId?: string;
  company?: CompanyProfile;
  billTo: {
    name: string;
    address: string;
    gstin: string;
    placeOfSupply: string;
  };
  shipTo: {
    name: string;
    address: string;
  };
  subject?: string;
  hideZeroTax?: boolean;
  items: InvoiceItem[];
  totalTaxableValue: number;
  totalTaxAmount: number;
  totalAmount: number;
  amountInWords: string;
  pdfUrl?: string;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  createdAt: any;
  updatedAt: any;
  createdBy: string;
  creatorName?: string;
  creatorEmail?: string;
}

export interface CompanyProfile {
  id?: string;
  name: string;
  address: string;
  gstin: string;
  phone: string;
  email: string;
  pan: string;
  logoUrl?: string;
  isDefault?: boolean;
  createdBy?: string;
}
