// src/lib/api.ts — Centralized API client for MySQL backend
// All calls go to the Express backend at http://localhost:4000

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000/api';

// ─── Token management ─────────────────────────────────────────────────────────
export const getToken = (): string | null => localStorage.getItem('govbill_token');
export const setToken = (token: string) => localStorage.setItem('govbill_token', token);
export const clearToken = () => localStorage.removeItem('govbill_token');

export const getStoredUser = (): { id: string; name: string; email: string } | null => {
  try {
    const raw = localStorage.getItem('govbill_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
export const setStoredUser = (user: { id: string; name: string; email: string }) =>
  localStorage.setItem('govbill_user', JSON.stringify(user));
export const clearStoredUser = () => localStorage.removeItem('govbill_user');

// ─── Base fetch helper ────────────────────────────────────────────────────────
async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || `Request failed: ${res.status}`);
  }

  return data as T;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (full_name: string, email: string, password: string) =>
    apiFetch<{ token: string; user: { id: string; name: string; email: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ full_name, email, password }),
    }),

  login: (email: string, password: string) =>
    apiFetch<{ token: string; user: { id: string; name: string; email: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () =>
    apiFetch<{ id: string; name: string; email: string; createdAt: string }>('/auth/me'),
};

// ─── Companies API ────────────────────────────────────────────────────────────
export const companiesAPI = {
  list: () => apiFetch<any[]>('/companies'),
  create: (data: any) => apiFetch<any>('/companies', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => apiFetch<any>(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setDefault: (id: string) => apiFetch<any>(`/companies/${id}/set-default`, { method: 'PATCH' }),
  delete: (id: string) => apiFetch<any>(`/companies/${id}`, { method: 'DELETE' }),
};

// ─── Clients API ──────────────────────────────────────────────────────────────
export const clientsAPI = {
  list: () => apiFetch<any[]>('/clients'),
  create: (data: any) => apiFetch<any>('/clients', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => apiFetch<any>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch<any>(`/clients/${id}`, { method: 'DELETE' }),
};

// ─── Invoices API ─────────────────────────────────────────────────────────────
export const invoicesAPI = {
  list: () => apiFetch<any[]>('/invoices'),
  get: (id: string) => apiFetch<any>(`/invoices/${id}`),
  create: (data: any) => {
    const mapped = {
      invoice_no: data.invoiceNo,
      invoice_date: data.invoiceDate,
      company_id: data.companyId,
      client_id: data.clientId,
      bill_to: data.billTo,
      ship_to: data.shipTo,
      subject: data.subject,
      hide_zero_tax: data.hideZeroTax,
      items: data.items,
      total_taxable_value: data.totalTaxableValue,
      total_tax_amount: data.totalTaxAmount,
      total_amount: data.totalAmount,
      amount_in_words: data.amountInWords,
      status: data.status,
    };
    return apiFetch<any>('/invoices', { method: 'POST', body: JSON.stringify(mapped) });
  },
  update: (id: string, data: any) => {
    const mapped = {
      invoice_no: data.invoiceNo,
      invoice_date: data.invoiceDate,
      company_id: data.companyId,
      client_id: data.clientId,
      bill_to: data.billTo,
      ship_to: data.shipTo,
      subject: data.subject,
      hide_zero_tax: data.hideZeroTax,
      items: data.items,
      total_taxable_value: data.totalTaxableValue,
      total_tax_amount: data.totalTaxAmount,
      total_amount: data.totalAmount,
      amount_in_words: data.amountInWords,
      status: data.status,
    };
    return apiFetch<any>(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(mapped) });
  },
  updateStatus: (id: string, status: string) =>
    apiFetch<any>(`/invoices/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  savePdfUrl: (id: string, pdf_url: string) =>
    apiFetch<any>(`/invoices/${id}/pdf-url`, { method: 'PATCH', body: JSON.stringify({ pdf_url }) }),
  delete: (id: string) => apiFetch<any>(`/invoices/${id}`, { method: 'DELETE' }),
  stats: () => apiFetch<any>('/invoices/stats/summary'),
};
