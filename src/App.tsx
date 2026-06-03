import React, { useState, useEffect, useCallback } from 'react';
import Shell from '@/src/components/layout/Shell';
import {
  Plus, Download, FileText, Search, ArrowUpRight, ArrowDownRight,
  Clock, UserPlus, Building, Trash2, Users, Cloud, ExternalLink,
  Loader2, Check, AlertCircle, Printer, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Invoice, Client, CompanyProfile } from '@/src/types';
import { formatCurrency, cn, amountToWords } from '@/src/lib/utils';
import { format } from 'date-fns';
import InvoiceForm from '@/src/components/invoice/InvoiceForm';
import InvoicePreview from '@/src/components/invoice/InvoicePreview';
import {
  authAPI, companiesAPI, clientsAPI, invoicesAPI,
  getToken, setToken, clearToken,
  getStoredUser, setStoredUser, clearStoredUser
} from '@/src/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
type AppUser = { id: string; name: string; email: string };
type ToastType = { message: string; type: 'success' | 'error' | 'info' };

export default function App() {
  // Auth state
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // App state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const defaultCompanyTemplate: CompanyProfile = {
    name: 'Prem Construction Building Materials Suppliers',
    address: 'Priya Housing Society, Besa Beltarodi, Nagpur, Maharashtra, 440015',
    gstin: '27HOGPM9083C1ZK',
    phone: '9049890261',
    email: 'premmoon903@gmail.com',
    pan: 'HOGPM9083C',
  };

  const [company, setCompany] = useState<CompanyProfile>(defaultCompanyTemplate);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [newClient, setNewClient] = useState({ name: '', address: '', gstin: '', contactPerson: '', email: '', phone: '' });
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyProfile | null>(null);
  const [newCompany, setNewCompany] = useState<Partial<CompanyProfile>>({ name: '', address: '', gstin: '', phone: '', email: '', pan: '' });
  const [toast, setToast] = useState<ToastType | null>(null);
  const [stats, setStats] = useState({ totalRevenue: 0, outstanding: 0, pendingCount: 0, totalClients: 0 });

  // ─── Filter States ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterWeek, setFilterWeek] = useState('all');

  const getFilteredInvoices = useCallback(() => {
    return invoices.filter(inv => {
      // 1. Search Query
      const matchesSearch = searchQuery === '' || 
        inv.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.billTo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.subject && inv.subject.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      const date = new Date(inv.invoiceDate);
      if (isNaN(date.getTime())) return true; // fallback if invalid date

      // 2. Year
      if (filterYear !== 'all') {
        if (date.getFullYear().toString() !== filterYear) return false;
      }

      // 3. Month
      if (filterMonth !== 'all') {
        if (date.getMonth().toString() !== filterMonth) return false;
      }

      // 4. Week
      if (filterWeek !== 'all') {
        const now = new Date();
        
        // Calculate weeks
        const getWeekNumber = (d: Date) => {
          const temp = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          const dayNum = temp.getDay() || 7;
          temp.setDate(temp.getDate() + 4 - dayNum);
          const yearStart = new Date(temp.getFullYear(), 0, 1);
          return Math.ceil((((temp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        };

        const currentWeek = getWeekNumber(now);
        const currentYear = now.getFullYear();
        const targetWeek = getWeekNumber(date);
        const targetYear = date.getFullYear();

        if (filterWeek === 'this-week') {
          if (targetWeek !== currentWeek || targetYear !== currentYear) return false;
        } else if (filterWeek === 'last-week') {
          let lastWeekNum = currentWeek - 1;
          let expectedYear = currentYear;
          if (lastWeekNum === 0) {
            lastWeekNum = 52;
            expectedYear -= 1;
          }
          if (targetWeek !== lastWeekNum || targetYear !== expectedYear) return false;
        }
      }

      return true;
    });
  }, [invoices, searchQuery, filterYear, filterMonth, filterWeek]);

  const handlePrintSummaryReport = () => {
    const filtered = getFilteredInvoices();
    
    // Create a temporary hidden print container outside #root
    const printDiv = document.createElement('div');
    printDiv.id = 'print-summary-report';
    printDiv.className = 'print-only-report';
    
    // Add print styles dynamically
    const style = document.createElement('style');
    style.innerHTML = `
      @media screen {
        #print-summary-report { display: none; }
      }
      @media print {
        #root { display: none !important; }
        #print-summary-report {
          display: block !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #000;
          padding: 20px;
        }
        .report-header {
          text-align: center;
          margin-bottom: 25px;
          border-bottom: 3px double #000;
          padding-bottom: 10px;
        }
        .report-title {
          font-size: 20px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 0;
        }
        .report-meta {
          font-size: 11px;
          color: #555;
          margin-top: 5px;
          font-weight: 600;
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
          font-size: 11px;
        }
        .report-table th, .report-table td {
          border: 1px solid #000;
          padding: 8px 10px;
          text-align: left;
        }
        .report-table th {
          background-color: #f2f2f2 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-weight: 700;
          text-transform: uppercase;
        }
        .report-table td {
          font-weight: 500;
        }
        .font-mono {
          font-family: monospace;
        }
        .text-right {
          text-align: right;
        }
        .font-bold {
          font-weight: 700;
        }
        .badge {
          border: 1px solid #000;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 9px;
          text-transform: uppercase;
          font-weight: 700;
        }
        .report-totals {
          margin-top: 20px;
          border: 1px solid #000;
          padding: 15px;
          background-color: #fafafa !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-size: 12px;
          display: flex;
          justify-content: flex-end;
        }
        .totals-box {
          width: 300px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
        }
        .totals-row:last-child {
          border-top: 1px solid #000;
          padding-top: 5px;
          font-weight: 800;
          font-size: 13px;
        }
      }
    `;
    document.head.appendChild(style);

    // Calculate totals
    const totalTaxable = filtered.reduce((acc, inv) => acc + (inv.totalTaxableValue || 0), 0);
    const totalTax = filtered.reduce((acc, inv) => acc + (inv.totalTaxAmount || 0), 0);
    const grandTotal = filtered.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);

    // Generate active filter text
    let filterDetails = [];
    if (filterYear !== 'all') filterDetails.push(`Year: ${filterYear}`);
    if (filterMonth !== 'all') {
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      filterDetails.push(`Month: ${monthNames[parseInt(filterMonth)]}`);
    }
    if (filterWeek !== 'all') filterDetails.push(`Week: ${filterWeek === 'this-week' ? 'This Week' : 'Last Week'}`);
    const filterStr = filterDetails.length > 0 ? filterDetails.join(' | ') : 'All Invoices';

    // Construct HTML
    let tableRowsHtml = filtered.map(inv => {
      const dateStr = format(new Date(inv.invoiceDate), 'dd/MM/yyyy');
      return `
        <tr>
          <td class="font-bold font-mono">#${inv.invoiceNo}</td>
          <td>${inv.billTo.name}</td>
          <td class="font-mono">${dateStr}</td>
          <td class="font-mono text-right">₹${(inv.totalTaxableValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="font-mono text-right">₹${(inv.totalTaxAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="font-mono text-right font-bold">₹${(inv.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td class="text-center"><span class="badge">${inv.status}</span></td>
        </tr>
      `;
    }).join('');

    if (filtered.length === 0) {
      tableRowsHtml = `<tr><td colspan="7" style="text-align:center;font-style:italic;color:#666;padding:20px;">No invoices match the selected filters.</td></tr>`;
    }

    printDiv.innerHTML = `
      <div class="report-header">
        <h1 class="report-title">${company.name || 'Prem Construction'}</h1>
        <p style="font-size: 10px; margin: 2px 0; color: #444; font-weight: 500;">${company.address || ''}</p>
        <p style="font-size: 10px; margin: 2px 0; color: #444; font-weight: 600;">GSTIN: ${company.gstin || ''} | Phone: ${company.phone || ''}</p>
        <h2 style="font-size: 14px; font-weight: 800; margin: 15px 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px;">INVOICES SUMMARY REPORT</h2>
        <div class="report-meta">
          <span>Active Filters: <strong>${filterStr}</strong></span>
          <span style="margin-left: 20px;">Report Generated: <strong>${format(new Date(), 'dd/MM/yyyy HH:mm')}</strong></span>
        </div>
      </div>
      
      <table class="report-table">
        <thead>
          <tr>
            <th style="width: 12%">Invoice No</th>
            <th style="width: 33%">Client / Department Name</th>
            <th style="width: 13%">Billing Date</th>
            <th style="width: 13%; text-align: right;">Taxable Val</th>
            <th style="width: 11%; text-align: right;">Tax (GST)</th>
            <th style="width: 13%; text-align: right;">Grand Total</th>
            <th style="width: 10%; text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>

      ${filtered.length > 0 ? `
      <div class="report-totals">
        <div class="totals-box">
          <div class="totals-row">
            <span>Total Taxable Value:</span>
            <span class="font-mono">₹${totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="totals-row">
            <span>Total Tax (GST):</span>
            <span class="font-mono">₹${totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="totals-row">
            <span>Grand Total (All Bills):</span>
            <span class="font-mono">₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
      ` : ''}

      <div style="margin-top: 50px; display: flex; justify-content: space-between; font-size: 10px; font-weight: 700;">
        <div style="text-align: center; width: 200px;">
          <div style="border-top: 1px solid #000; padding-top: 5px; margin-top: 40px;">Prepared By</div>
        </div>
        <div style="text-align: center; width: 200px;">
          <div style="border-top: 1px solid #000; padding-top: 5px; margin-top: 40px;">Authorised Signatory</div>
        </div>
      </div>
    `;

    document.body.appendChild(printDiv);
    window.print();
    document.body.removeChild(printDiv);
    document.head.removeChild(style);
  };

  // ─── Toast helper ───────────────────────────────────────────────────────────
  const showToast = (message: string, type: ToastType['type'] = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ─── Auth restore on mount ──────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    const savedUser = getStoredUser();
    if (token && savedUser) {
      setUser(savedUser);
      // Verify token still valid in background
      authAPI.me()
        .then(u => setUser({ id: u.id, name: u.name, email: u.email }))
        .catch(() => { clearToken(); clearStoredUser(); setUser(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // ─── Load data when user is set ────────────────────────────────────────────
  const loadAllData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      const [invs, clts, comps, s] = await Promise.all([
        invoicesAPI.list(),
        clientsAPI.list(),
        companiesAPI.list(),
        invoicesAPI.stats(),
      ]);
      setInvoices(invs);
      setClients(clts);
      setCompanies(comps);
      setStats(s);
      const defaultComp = comps.find((c: any) => c.isDefault) || comps[0];
      if (defaultComp) setCompany(defaultComp);
    } catch (err: any) {
      showToast('Failed to load data: ' + err.message, 'error');
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadAllData();
  }, [user, loadAllData]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      alert('Please fill all fields.');
      showToast('Please fill all fields.', 'error');
      return;
    }
    if (authMode === 'register' && !authName) {
      alert('Full name is required.');
      showToast('Full name is required.', 'error');
      return;
    }
    if (authPassword.length < 6) {
      alert('Password must be at least 6 characters.');
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(authEmail.trim())) {
      alert('Please enter a valid email address.');
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    if (authMode === 'register') {
      const trimmedName = authName.trim();
      if (trimmedName.length < 3) {
        alert('Name must be at least 3 characters.');
        showToast('Name must be at least 3 characters.', 'error');
        return;
      }
      const nameRegex = /^[a-zA-Z\s]+$/;
      if (!nameRegex.test(trimmedName)) {
        alert('Name can only contain letters and spaces.');
        showToast('Name can only contain letters and spaces.', 'error');
        return;
      }
    }

    setAuthLoading(true);
    try {
      let result;
      if (authMode === 'register') {
        result = await authAPI.register(authName, authEmail, authPassword);
        showToast('Registration successful! Welcome.', 'success');
      } else {
        result = await authAPI.login(authEmail, authPassword);
        showToast('Logged in successfully!', 'success');
      }
      setToken(result.token);
      setStoredUser(result.user);
      setUser(result.user);
    } catch (err: any) {
      showToast(err.message || 'Authentication failed.', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    clearStoredUser();
    setUser(null);
    setInvoices([]);
    setClients([]);
    setCompanies([]);
    showToast('Logged out successfully.', 'info');
  };

  // ─── Invoice handlers ───────────────────────────────────────────────────────
  const saveInvoice = async (data: Partial<Invoice>) => {
    try {
      if (editingInvoice?.id) {
        const updated = await invoicesAPI.update(editingInvoice.id, data);
        setInvoices(prev => prev.map(inv => inv.id === editingInvoice.id ? updated : inv));
        if (viewingInvoice?.id === editingInvoice.id) {
          setViewingInvoice(updated);
        }
        setEditingInvoice(null);
        showToast('Invoice updated successfully!', 'success');
      } else {
        const created = await invoicesAPI.create(data);
        setInvoices(prev => [created, ...prev]);
        setIsCreatingInvoice(false);
        showToast('Invoice created successfully!', 'success');
      }
      // Refresh stats
      invoicesAPI.stats().then(setStats).catch(() => {});
    } catch (err: any) {
      showToast(err.message || 'Failed to save invoice.', 'error');
    }
  };

  const updateInvoiceStatus = async (invoiceId: string, status: Invoice['status']) => {
    try {
      await invoicesAPI.updateStatus(invoiceId, status);
      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status } : inv));
      if (viewingInvoice?.id === invoiceId) setViewingInvoice(prev => prev ? { ...prev, status } : null);
      showToast(`Invoice marked as ${status}!`, 'success');
      invoicesAPI.stats().then(setStats).catch(() => {});
    } catch (err: any) {
      showToast(err.message || 'Failed to update status.', 'error');
    }
  };

  const handleViewInvoice = async (invSummary: Invoice) => {
    try {
      setDataLoading(true);
      const fullInvoice = await invoicesAPI.get(invSummary.id!);
      setViewingInvoice(fullInvoice);
    } catch (err: any) {
      showToast('Failed to load invoice details: ' + err.message, 'error');
    } finally {
      setDataLoading(false);
    }
  };

  const saveClient = async () => {
    if (!newClient.name?.trim()) {
      alert('Department/Client name is required.');
      showToast('Department/Client name is required.', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (newClient.email?.trim() && !emailRegex.test(newClient.email.trim())) {
      alert('Please enter a valid email address.');
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    if (newClient.phone?.trim() && !phoneRegex.test(newClient.phone.trim())) {
      alert('Phone number must be a valid 10-digit mobile number.');
      showToast('Phone number must be a valid 10-digit mobile number.', 'error');
      return;
    }

    if (newClient.gstin?.trim() && newClient.gstin.trim().length !== 15) {
      alert('GSTIN must be exactly 15 characters.');
      showToast('GSTIN must be exactly 15 characters.', 'error');
      return;
    }

    try {
      if (editingClient?.id) {
        const updated = await clientsAPI.update(editingClient.id, {
          name: newClient.name,
          address: newClient.address,
          gstin: newClient.gstin,
          contact_person: newClient.contactPerson,
          email: newClient.email,
          phone: newClient.phone,
        });
        setClients(prev => prev.map(c => c.id === editingClient.id ? updated : c));
        setIsCreatingClient(false);
        setEditingClient(null);
        setNewClient({ name: '', address: '', gstin: '', contactPerson: '', email: '', phone: '' });
        showToast('Department updated successfully!', 'success');
      } else {
        const created = await clientsAPI.create({
          name: newClient.name,
          address: newClient.address,
          gstin: newClient.gstin,
          contact_person: newClient.contactPerson,
          email: newClient.email,
          phone: newClient.phone,
        });
        setClients(prev => [created, ...prev]);
        setIsCreatingClient(false);
        setNewClient({ name: '', address: '', gstin: '', contactPerson: '', email: '', phone: '' });
        showToast('Department added successfully!', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save department.', 'error');
    }
  };

  const deleteClient = async (clientId: string) => {
    if (!window.confirm('Delete this department? This cannot be undone.')) return;
    try {
      await clientsAPI.delete(clientId);
      setClients(prev => prev.filter(c => c.id !== clientId));
      showToast('Department removed.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete department.', 'error');
    }
  };

  // ─── Company handlers ───────────────────────────────────────────────────────
  const handleSaveCompany = async () => {
    if (!newCompany.name?.trim()) {
      alert('Company name is required.');
      showToast('Company name is required.', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (newCompany.email?.trim() && !emailRegex.test(newCompany.email.trim())) {
      alert('Please enter a valid email address.');
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    if (newCompany.phone?.trim() && !phoneRegex.test(newCompany.phone.trim())) {
      alert('Phone number must be a valid 10-digit mobile number.');
      showToast('Phone number must be a valid 10-digit mobile number.', 'error');
      return;
    }

    if (newCompany.gstin?.trim() && newCompany.gstin.trim().length !== 15) {
      alert('GSTIN must be exactly 15 characters.');
      showToast('GSTIN must be exactly 15 characters.', 'error');
      return;
    }

    if (newCompany.pan?.trim() && newCompany.pan.trim().length !== 10) {
      alert('PAN must be exactly 10 characters.');
      showToast('PAN must be exactly 10 characters.', 'error');
      return;
    }

    try {
      if (editingCompany?.id) {
        const updated = await companiesAPI.update(editingCompany.id, newCompany);
        setCompanies(prev => prev.map(c => c.id === editingCompany.id ? updated : c));
        showToast('Company updated!', 'success');
      } else {
        const created = await companiesAPI.create(newCompany);
        setCompanies(prev => [...prev, created]);
        showToast('Company profile added!', 'success');
      }
      setIsCreatingCompany(false);
      setEditingCompany(null);
      setNewCompany({ name: '', address: '', gstin: '', phone: '', email: '', pan: '' });
    } catch (err: any) {
      showToast(err.message || 'Failed to save company.', 'error');
    }
  };

  const handleSetDefaultCompany = async (comp: CompanyProfile) => {
    try {
      await companiesAPI.setDefault(comp.id!);
      setCompanies(prev => prev.map(c => ({ ...c, isDefault: c.id === comp.id })));
      const updated = companies.map(c => ({ ...c, isDefault: c.id === comp.id }));
      const def = updated.find(c => c.isDefault);
      if (def) setCompany(def);
      showToast(`${comp.name} set as default.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to set default.', 'error');
    }
  };

  const handleDeleteCompany = async (comp: CompanyProfile) => {
    if (comp.isDefault) { showToast('Cannot delete the default company. Set another as default first.', 'error'); return; }
    if (!window.confirm(`Delete "${comp.name}"?`)) return;
    try {
      await companiesAPI.delete(comp.id!);
      setCompanies(prev => prev.filter(c => c.id !== comp.id));
      showToast('Company deleted.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete company.', 'error');
    }
  };

  const updateCompanySettings = async () => {
    if (!company.name?.trim()) {
      alert('Company name is required.');
      showToast('Company name is required.', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (company.email?.trim() && !emailRegex.test(company.email.trim())) {
      alert('Please enter a valid email address.');
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    if (company.phone?.trim() && !phoneRegex.test(company.phone.trim())) {
      alert('Phone number must be a valid 10-digit mobile number.');
      showToast('Phone number must be a valid 10-digit mobile number.', 'error');
      return;
    }

    if (company.gstin?.trim() && company.gstin.trim().length !== 15) {
      alert('GSTIN must be exactly 15 characters.');
      showToast('GSTIN must be exactly 15 characters.', 'error');
      return;
    }

    if (company.pan?.trim() && company.pan.trim().length !== 10) {
      alert('PAN must be exactly 10 characters.');
      showToast('PAN must be exactly 10 characters.', 'error');
      return;
    }

    const target = companies.find(c => c.isDefault) || companies[0];
    if (!target?.id) {
      try {
        const created = await companiesAPI.create({ ...company, is_default: true });
        setCompanies([created]);
        setCompany(created);
        showToast('Company profile saved!', 'success');
      } catch (err: any) { showToast(err.message, 'error'); }
      return;
    }
    try {
      const updated = await companiesAPI.update(target.id, company);
      setCompanies(prev => prev.map(c => c.id === target.id ? updated : c));
      setCompany(updated);
      showToast('Company profile saved!', 'success');
    } catch (err: any) { showToast(err.message, 'error'); }
  };

  // ─── Loading state ──────────────────────────────────────────────────────────
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
    </div>
  );

  // ─── Auth Screen ────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <>
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_50%_0%,rgba(249,115,22,0.1),transparent)]">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-slate-200/50 p-8 border border-slate-100 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-orange-600"></div>

            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-orange-200 mb-4 transform rotate-3">
                <FileText size={32} />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">GovBill Pro</h1>
              <p className="text-slate-500 text-xs text-center mt-1 uppercase tracking-wider font-semibold">
                Government Billing & GST Software
              </p>
              <span className="mt-2 px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200 uppercase tracking-wider">
                🗄️ MySQL Backend
              </span>
            </div>

            {/* Tab */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-6">
              {(['login', 'register'] as const).map(mode => (
                <button key={mode} type="button"
                  className={cn("py-2 text-xs font-bold rounded-lg transition-all", authMode === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900")}
                  onClick={() => setAuthMode(mode)}>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'register' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                  <input type="text" placeholder="e.g. Prem Moon" value={authName} onChange={e => setAuthName(e.target.value)}
                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200/80 rounded-xl text-xs focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 font-semibold outline-none transition-all" required />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                <input type="email" placeholder="you@government.in" value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                  className="w-full h-11 px-4 bg-slate-50 border border-slate-200/80 rounded-xl text-xs focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 font-semibold outline-none transition-all" required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
                <input type="password" placeholder="••••••••" value={authPassword} onChange={e => setAuthPassword(e.target.value)}
                  className="w-full h-11 px-4 bg-slate-50 border border-slate-200/80 rounded-xl text-xs focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 font-semibold outline-none transition-all" required />
                {authMode === 'register' && <p className="text-[10px] text-slate-400">Must be at least 6 characters.</p>}
              </div>
              <button type="submit" disabled={authLoading}
                className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-orange-100 flex items-center justify-center gap-2">
                {authLoading ? <Loader2 size={16} className="animate-spin" /> : (authMode === 'login' ? 'Sign In' : 'Register & Log In')}
              </button>
            </form>
          </div>
        </div>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 bg-white border border-slate-100 rounded-3xl shadow-2xl shadow-slate-300 max-w-sm">
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", toast.type === 'success' ? 'bg-emerald-50 text-emerald-600' : toast.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600')}>
                {toast.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 uppercase tracking-wide">{toast.type === 'success' ? 'Success' : toast.type === 'error' ? 'Error' : 'Info'}</p>
                <p className="text-xs text-slate-500 font-medium">{toast.message}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // ─── Main App ───────────────────────────────────────────────────────────────
  return (
    <Shell user={user} onLogout={handleLogout} activeTab={activeTab} setActiveTab={setActiveTab}>
      <AnimatePresence mode="wait">

        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
            {dataLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
                <Loader2 size={14} className="animate-spin" /> Loading data from MySQL…
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), icon: ArrowUpRight, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Pending Bills', value: stats.pendingCount, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
                { label: 'Total Clients', value: stats.totalClients, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Outstanding', value: formatCurrency(stats.outstanding), icon: ArrowDownRight, color: 'text-red-600', bg: 'bg-red-50' },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p><h3 className="text-xl font-bold text-slate-900">{stat.value}</h3></div>
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", stat.bg, stat.color)}><stat.icon size={20} /></div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Recent Invoices</h3>
                <button className="text-xs font-bold text-orange-600 uppercase tracking-widest" onClick={() => setActiveTab('invoices')}>View all</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-sans">
                  <thead className="bg-slate-50/50">
                    <tr>{['Invoice', 'Client', 'Date', 'Amount', 'Status'].map(h => <th key={h} className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.length === 0
                      ? <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic text-sm">No invoices yet. Create your first invoice!</td></tr>
                      : invoices.slice(0, 5).map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => handleViewInvoice(inv)}>
                          <td className="px-6 py-4 flex items-center gap-3 font-semibold text-slate-900 text-sm"><FileText size={16} className="text-slate-400" /> #{inv.invoiceNo}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{inv.billTo.name}</td>
                          <td className="px-6 py-4 text-sm text-slate-500 font-mono">{format(new Date(inv.invoiceDate), 'dd/MM/yyyy')}</td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-900">{formatCurrency(inv.totalAmount)}</td>
                          <td className="px-6 py-4">
                            <span className={cn("px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider", inv.status === 'paid' ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700")}>{inv.status}</span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* INVOICES */}
        {activeTab === 'invoices' && (
          <motion.div key="invoices" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            
            {/* Search and Filters Bar */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-5 bg-white border border-slate-200 rounded-3xl shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 flex-1">
                {/* Search Bar */}
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search invoices..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 text-xs font-semibold outline-none transition-colors" 
                  />
                </div>

                {/* Year Filter */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                  <Filter size={14} className="text-slate-400 shrink-0" />
                  <select 
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 outline-none w-full cursor-pointer"
                  >
                    <option value="all">All Years</option>
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                  </select>
                </div>

                {/* Month Filter */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                  <Filter size={14} className="text-slate-400 shrink-0" />
                  <select 
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 outline-none w-full cursor-pointer"
                  >
                    <option value="all">All Months</option>
                    <option value="0">January</option>
                    <option value="1">February</option>
                    <option value="2">March</option>
                    <option value="3">April</option>
                    <option value="4">May</option>
                    <option value="5">June</option>
                    <option value="6">July</option>
                    <option value="7">August</option>
                    <option value="8">September</option>
                    <option value="9">October</option>
                    <option value="10">November</option>
                    <option value="11">December</option>
                  </select>
                </div>

                {/* Week Filter */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                  <Filter size={14} className="text-slate-400 shrink-0" />
                  <select 
                    value={filterWeek}
                    onChange={(e) => setFilterWeek(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 outline-none w-full cursor-pointer"
                  >
                    <option value="all">All Weeks</option>
                    <option value="this-week">This Week</option>
                    <option value="last-week">Last Week</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 shrink-0 self-end xl:self-center">
                <button 
                  onClick={handlePrintSummaryReport}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center gap-2 text-xs font-bold transition-all shadow-sm cursor-pointer"
                  title="Print Summary Report of Filtered Invoices"
                >
                  <Printer size={15} /> Print Summary
                </button>
                
                <button 
                  onClick={() => setIsCreatingInvoice(true)} 
                  className="px-6 py-2.5 bg-orange-600 text-white rounded-xl flex items-center gap-2 text-xs font-bold hover:bg-orange-700 shadow-lg shadow-orange-100 transition-all cursor-pointer"
                >
                  <Plus size={15} /> Create Invoice
                </button>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50"><tr>{['ID', 'Client', 'Date', 'Amount', 'Status', ''].map(h => <th key={h} className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {getFilteredInvoices().length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                        No invoices match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    getFilteredInvoices().map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => handleViewInvoice(inv)}>
                        <td className="px-6 py-4 font-semibold text-slate-900 text-sm">#{inv.invoiceNo}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{inv.billTo.name}</td>
                        <td className="px-6 py-4 text-sm text-slate-500 font-mono">{format(new Date(inv.invoiceDate), 'dd/MM/yyyy')}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900 uppercase">₹{inv.totalAmount.toLocaleString()}</td>
                        <td className="px-6 py-4 flex items-center gap-2">
                          <span className={cn("px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase", inv.status === 'paid' ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700")}>{inv.status}</span>
                          {inv.pdfUrl && <a href={inv.pdfUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}><ExternalLink size={14} className="text-blue-500 hover:text-blue-700" /></a>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={e => { e.stopPropagation(); window.confirm('Delete this invoice?') && invoicesAPI.delete(inv.id!).then(() => { setInvoices(p => p.filter(i => i.id !== inv.id)); showToast('Invoice deleted.'); }).catch(err => showToast(err.message, 'error')); }}
                            className="p-2 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500 transition-colors"
                            title="Delete Invoice"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* CLIENTS */}
        {activeTab === 'clients' && (
          <motion.div key="clients" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">Government Departments</h2>
              <button onClick={() => setIsCreatingClient(true)} className="px-4 py-2 bg-orange-600 text-white rounded-xl text-sm font-bold flex items-center gap-2">
                <UserPlus size={16} /> Add Client
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {clients.map(client => (
                <div key={client.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-full translate-x-12 -translate-y-12 transition-transform group-hover:scale-150"></div>
                  <Building size={24} className="text-orange-600 mb-4 relative z-10" />
                  <h4 className="font-bold text-slate-900 mb-1 relative z-10">{client.name}</h4>
                  <p className="text-xs text-slate-500 mb-2 relative z-10">{client.address}</p>
                  <div className="space-y-1 text-[10px] text-slate-500 mb-4 relative z-10 border-t border-dashed border-slate-100 pt-2">
                    {client.contactPerson && <div>Contact: <span className="font-bold text-slate-700">{client.contactPerson}</span></div>}
                    {client.phone && <div>Phone: <span className="font-mono text-slate-700">{client.phone}</span></div>}
                    {client.email && <div>Email: <span className="font-mono text-slate-700">{client.email}</span></div>}
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center relative z-10">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">GSTIN: {client.gstin || 'N/A'}</span>
                    <div className="flex gap-1.5 items-center">
                      <button onClick={() => { setEditingClient(client); setNewClient({ name: client.name, address: client.address || '', gstin: client.gstin || '', contactPerson: client.contactPerson || '', email: client.email || '', phone: client.phone || '' }); setIsCreatingClient(true); }} className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold transition-all">Edit</button>
                      <button onClick={() => deleteClient(client.id!)} className="text-slate-300 hover:text-red-500 transition-colors p-1.5 rounded hover:bg-slate-50"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* COMPANIES */}
        {activeTab === 'companies' && (
          <motion.div key="companies" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Registered Seller Profiles</h2>
                <p className="text-xs text-slate-500 mt-1">Manage multiple company and vendor identities for invoice templates</p>
              </div>
              <button onClick={() => { setEditingCompany(null); setNewCompany({ name: '', address: '', gstin: '', phone: '', email: '', pan: '' }); setIsCreatingCompany(true); }}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md shadow-orange-100">
                <Building size={16} /> Add Company
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {companies.map(comp => (
                <div key={comp.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <Building size={24} className="text-orange-600" />
                      {comp.isDefault && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase rounded-full tracking-wider border border-emerald-100">Default</span>}
                    </div>
                    <h4 className="font-bold text-slate-900 mb-1 leading-snug">{comp.name}</h4>
                    <p className="text-xs text-slate-500 mb-3 leading-normal">{comp.address}</p>
                    <div className="space-y-1 text-[11px] text-slate-600 mb-4 border-t border-dashed border-slate-100 pt-3">
                      <div>GSTIN: <span className="font-bold font-mono text-slate-800">{comp.gstin || 'N/A'}</span></div>
                      <div>PAN: <span className="font-bold font-mono text-slate-800">{comp.pan || 'N/A'}</span></div>
                      <div>Phone: <span className="font-medium text-slate-800">{comp.phone || 'N/A'}</span></div>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-100 flex justify-between items-center gap-2">
                    <div className="flex gap-1.5 flex-wrap">
                      {!comp.isDefault && <button onClick={() => handleSetDefaultCompany(comp)} className="px-2.5 py-1.5 bg-slate-100 hover:bg-orange-50 hover:text-orange-600 text-slate-600 rounded-lg text-[10px] font-bold transition-all">Set Default</button>}
                      <button onClick={() => { setEditingCompany(comp); setNewCompany({ ...comp }); setIsCreatingCompany(true); }} className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold transition-all">Edit</button>
                    </div>
                    {!comp.isDefault && <button onClick={() => handleDeleteCompany(comp)} className="text-slate-300 hover:text-red-500 transition-colors p-1.5 rounded hover:bg-slate-50"><Trash2 size={14} /></button>}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* SETTINGS */}
        {activeTab === 'settings' && (
          <motion.div key="settings" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600"><Building size={32} /></div>
              <div><h2 className="text-xl font-bold text-slate-900">Company Settings</h2><p className="text-xs text-slate-500">Configure your business profile for invoice headers</p></div>
            </div>

            <div className="p-4 bg-orange-50 border border-orange-200/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-extrabold text-orange-850 uppercase tracking-widest mb-0.5">Need sample vendor data?</h4>
                <p className="text-xs text-orange-700/80 font-medium leading-relaxed">Prepopulate with Divyanshi Enterprises civil works profile.</p>
              </div>
              <button type="button"
                onClick={() => { setCompany({ name: 'DIVYANSHI ENTERPRISES', address: 'BUILDING MATERIAL SUPPLIERS AND CIVIL WORK\nPANJARI (BU) TA DIST. NAGPUR, MAHARASHTRA-441108', gstin: '27BMWMP7901B1ZT', phone: '9588668605, 8007058601', email: 'dipalimoon1234@gmail.com', pan: 'BMWMP7901B' }); showToast('Company profile prefilled! Click "Save Profile" to store.', 'info'); }}
                className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-orange-100 whitespace-nowrap">
                ✨ Load Divyanshi Enterprises
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {(['name', 'address', 'gstin', 'phone', 'email', 'pan'] as (keyof CompanyProfile)[]).map(key => {
                const val = (company as any)[key] || '';
                return (
                  <div key={key} className="space-y-1.5 capitalize">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{key}</label>
                    {key === 'address'
                      ? <textarea value={val} onChange={e => setCompany({ ...company, [key]: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 outline-none text-sm font-medium h-20 resize-none" />
                      : <input type="text" value={val} onChange={e => setCompany({ ...company, [key]: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 outline-none text-sm font-medium" />
                    }
                  </div>
                );
              })}
            </div>
            <button onClick={updateCompanySettings} className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-100">Save Profile</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Modals ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isCreatingInvoice && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-4xl">
              <InvoiceForm clients={clients} companies={companies} onSave={saveInvoice} onCancel={() => setIsCreatingInvoice(false)} lastInvoiceNo={invoices[0]?.invoiceNo} />
            </div>
          </motion.div>
        )}

        {editingInvoice && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-4xl">
              <InvoiceForm clients={clients} companies={companies} onSave={saveInvoice} onCancel={() => setEditingInvoice(null)} initialData={editingInvoice} />
            </div>
          </motion.div>
        )}

        {viewingInvoice && (
          <InvoicePreview 
            invoice={viewingInvoice} 
            company={company} 
            onClose={() => setViewingInvoice(null)} 
            onUpdateStatus={status => updateInvoiceStatus(viewingInvoice.id!, status)} 
            onEdit={() => {
              setEditingInvoice(viewingInvoice);
              setViewingInvoice(null);
            }} 
          />
        )}

        {isCreatingClient && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white rounded-3xl p-8 space-y-6">
              <h3 className="text-lg font-bold text-slate-900">{editingClient ? 'Edit Department / Client' : 'New Department / Client'}</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Department/Agency Name</label>
                  <input placeholder="e.g. Executive Engineer, Z.P. Nagpur" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 mt-1" value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Billing Address</label>
                  <textarea placeholder="Full Address" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 mt-1 h-20 resize-none" value={newClient.address} onChange={e => setNewClient({ ...newClient, address: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">GSTIN</label>
                    <input placeholder="GSTIN" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 uppercase mt-1" value={newClient.gstin} onChange={e => setNewClient({ ...newClient, gstin: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Contact Person</label>
                    <input placeholder="Full Name" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 mt-1" value={newClient.contactPerson} onChange={e => setNewClient({ ...newClient, contactPerson: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Email Address</label>
                    <input type="email" placeholder="Email" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 mt-1" value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Phone Number</label>
                    <input placeholder="Phone" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 mt-1" value={newClient.phone} onChange={e => setNewClient({ ...newClient, phone: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setIsCreatingClient(false); setEditingClient(null); }} className="flex-1 py-2 font-bold text-slate-500">Cancel</button>
                <button onClick={saveClient} className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-all shadow-md shadow-orange-100">{editingClient ? 'Save Changes' : 'Add Department'}</button>
              </div>
            </div>
          </motion.div>
        )}

        {isCreatingCompany && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white rounded-3xl p-8 space-y-6">
              <h3 className="text-lg font-bold text-slate-900">{editingCompany ? 'Edit Company Profile' : 'New Seller Company'}</h3>
              <div className="space-y-3">
                {[
                  { key: 'name', label: 'Company / Seller Name', placeholder: 'e.g. PREM CONSTRUCTION' },
                  { key: 'address', label: 'Business Address', placeholder: 'e.g. Nagpur Road, Maharashtra', textarea: true },
                  { key: 'gstin', label: 'GSTIN', placeholder: 'GSTIN' },
                  { key: 'pan', label: 'PAN Number', placeholder: 'PAN' },
                  { key: 'phone', label: 'Mobile / Phone', placeholder: 'Phone' },
                  { key: 'email', label: 'Email ID', placeholder: 'Email', type: 'email' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{field.label}</label>
                    {field.textarea
                      ? <textarea placeholder={field.placeholder} className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 mt-1 h-20 resize-none" value={(newCompany as any)[field.key] || ''} onChange={e => setNewCompany({ ...newCompany, [field.key]: e.target.value })} />
                      : <input type={field.type || 'text'} placeholder={field.placeholder} className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 mt-1" value={(newCompany as any)[field.key] || ''} onChange={e => setNewCompany({ ...newCompany, [field.key]: e.target.value })} />
                    }
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setIsCreatingCompany(false); setEditingCompany(null); setNewCompany({ name: '', address: '', gstin: '', phone: '', email: '', pan: '' }); }} className="flex-1 py-1.5 font-bold text-slate-500 text-sm">Cancel</button>
                <button onClick={handleSaveCompany} className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-all shadow-md shadow-orange-100 text-sm">{editingCompany ? 'Save Changes' : 'Create Profile'}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 bg-white border border-slate-100 rounded-3xl shadow-2xl shadow-slate-300 max-w-sm">
            <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", toast.type === 'success' ? 'bg-emerald-50 text-emerald-600' : toast.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600')}>
              {toast.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 uppercase tracking-wide">{toast.type === 'success' ? 'Success' : toast.type === 'error' ? 'Error' : 'Info'}</p>
              <p className="text-xs text-slate-500 font-medium">{toast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
}
