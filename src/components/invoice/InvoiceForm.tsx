import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, ChevronRight, ChevronLeft, Calculator } from 'lucide-react';
import { Invoice, InvoiceItem, Client, CompanyProfile } from '@/src/types';
import { calculateTax, cn, amountToWords } from '@/src/lib/utils';
import { motion } from 'motion/react';

interface InvoiceFormProps {
  onSave: (invoice: Partial<Invoice>) => void;
  onCancel: () => void;
  clients: Client[];
  companies?: CompanyProfile[];
  lastInvoiceNo?: string;
  initialData?: Partial<Invoice>;
}

export default function InvoiceForm({ onSave, onCancel, clients, companies, lastInvoiceNo, initialData }: InvoiceFormProps) {
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<{ invoiceNo?: string; invoiceDate?: string }>({});
  const defaultCompany = companies?.find(c => c.isDefault) || companies?.[0];
  const [invoice, setInvoice] = useState<Partial<Invoice>>(initialData ? {
    ...initialData,
    company: initialData.company || companies?.find(c => c.id === initialData.companyId) || defaultCompany
  } : {
    invoiceNo: lastInvoiceNo ? (parseInt(lastInvoiceNo) + 1).toString() : '1',
    invoiceDate: new Date().toISOString().split('T')[0],
    items: [],
    status: 'draft',
    billTo: { name: '', address: '', gstin: '', placeOfSupply: 'Maharashtra' },
    shipTo: { name: '', address: '' },
    totalTaxableValue: 0,
    totalTaxAmount: 0,
    totalAmount: 0,
    amountInWords: '',
    companyId: defaultCompany?.id || '',
    company: defaultCompany
  });

  useEffect(() => {
    if (companies && companies.length > 0 && !invoice.companyId) {
      const defComp = companies.find(c => c.isDefault) || companies[0];
      if (defComp) {
        setInvoice(prev => ({
          ...prev,
          companyId: defComp.id,
          company: defComp
        }));
      }
    }
  }, [companies]);

  const [newItem, setNewItem] = useState<Partial<InvoiceItem>>({
    hsn: '',
    description: '',
    qty: 1,
    unit: 'PCS',
    rate: 0,
    taxRate: 18
  });

  const loadExampleData = () => {
    const sampleItems: InvoiceItem[] = [
      {
        id: 'sample-sect-1',
        hsn: '-',
        description: '# GOTAL PANJRI AJANTA HOUSING SOCIETY',
        qty: 0,
        unit: 'PCS',
        rate: 0,
        taxRate: 0,
        taxAmount: 0,
        amount: 0
      },
      {
        id: 'sample-item-1',
        hsn: '2517',
        description: 'L BEO 3"',
        qty: 6,
        unit: 'PCS',
        rate: 125,
        taxRate: 18,
        taxAmount: 135,
        amount: 885
      },
      {
        id: 'sample-item-2',
        hsn: '2517',
        description: 'ADJESTOR 3"',
        qty: 2,
        unit: 'PCS',
        rate: 350,
        taxRate: 18,
        taxAmount: 126,
        amount: 826
      },
      {
        id: 'sample-item-3',
        hsn: '3506',
        description: 'Solution',
        qty: 1,
        unit: 'PCS',
        rate: 500,
        taxRate: 18,
        taxAmount: 90,
        amount: 590
      },
      {
        id: 'sample-sect-2',
        hsn: '-',
        description: '# VELAHARI TOILET AND KAMODE',
        qty: 0,
        unit: 'PCS',
        rate: 0,
        taxRate: 0,
        taxAmount: 0,
        amount: 0
      },
      {
        id: 'sample-item-4',
        hsn: '3917',
        description: '110mm PVC PIPE',
        qty: 2,
        unit: 'PCS',
        rate: 3400,
        taxRate: 18,
        taxAmount: 1224,
        amount: 8024
      },
      {
        id: 'sample-item-5',
        hsn: '3917',
        description: 'TEE',
        qty: 4,
        unit: 'PCS',
        rate: 250,
        taxRate: 18,
        taxAmount: 180,
        amount: 1180
      },
      {
        id: 'sample-item-6',
        hsn: '3917',
        description: 'CAP',
        qty: 8,
        unit: 'PCS',
        rate: 100,
        taxRate: 18,
        taxAmount: 144,
        amount: 944
      }
    ];

    const totalTaxable = sampleItems.reduce((acc, item) => acc + (item.qty * item.rate), 0);
    const totalTax = sampleItems.reduce((acc, item) => acc + item.taxAmount, 0);
    const grandTotal = totalTaxable + totalTax;

    setInvoice({
      invoiceNo: '107',
      invoiceDate: new Date().toISOString().split('T')[0],
      clientId: 'sampleclientid',
      billTo: {
        name: 'GRAMPANCHAYAT WELA HARISHCHANDRA TAH. DIST. NAGPUR',
        address: 'WELAHARI, TAH. DIST. NAGPUR, MAHARASHTRA, 440037',
        gstin: '27AAALG6282C1DI',
        placeOfSupply: 'Maharashtra'
      },
      shipTo: {
        name: 'GRAMPANCHAYAT WELA HARISHCHANDRA TAH. DIST. NAGPUR',
        address: 'WELAHARI, TAH. DIST. NAGPUR, MAHARASHTRA, 440037'
      },
      subject: 'GAT GRAMPANCHAYAT WELAHARI MATERIAL PIPELINE LEAKAGE',
      hideZeroTax: true,
      items: sampleItems,
      totalTaxableValue: totalTaxable,
      totalTaxAmount: totalTax,
      totalAmount: grandTotal,
      amountInWords: amountToWords(grandTotal),
      status: 'sent'
    });
  };

  const addItem = () => {
    if (!newItem.description || !newItem.rate) return;
    
    const taxableValue = (newItem.qty || 1) * (newItem.rate || 0);
    const tax = calculateTax(newItem.taxRate || 0, taxableValue);
    
    const item: InvoiceItem = {
      id: Math.random().toString(36).substr(2, 9),
      hsn: newItem.hsn || '-',
      description: newItem.description || '',
      qty: newItem.qty || 1,
      unit: newItem.unit || 'PCS',
      rate: newItem.rate || 0,
      taxRate: newItem.taxRate || 0,
      taxAmount: tax.total,
      amount: taxableValue + tax.total
    };

    const updatedItems = [...(invoice.items || []), item];
    updateTotals(updatedItems);
    setNewItem({ hsn: '', description: '', qty: 1, unit: 'PCS', rate: 0, taxRate: 18 });
  };

  const removeItem = (id: string) => {
    const updatedItems = (invoice.items || []).filter(i => i.id !== id);
    updateTotals(updatedItems);
  };

  const updateTotals = (items: InvoiceItem[]) => {
    const totalTaxable = items.reduce((acc, item) => acc + (item.qty * item.rate), 0);
    const totalTax = items.reduce((acc, item) => acc + item.taxAmount, 0);
    const grandTotal = totalTaxable + totalTax;

    setInvoice(prev => ({
      ...prev,
      items,
      totalTaxableValue: totalTaxable,
      totalTaxAmount: totalTax,
      totalAmount: grandTotal,
      amountInWords: amountToWords(grandTotal)
    }));
  };

  const handleClientSelect = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setInvoice(prev => ({
        ...prev,
        clientId,
        billTo: { 
          name: client.name, 
          address: client.address, 
          gstin: client.gstin, 
          placeOfSupply: 'Maharashtra' 
        },
        shipTo: { name: client.name, address: client.address }
      }));
    }
  };

  return (
    <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 overflow-hidden shadow-2xl shadow-slate-200">
      <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className={cn("w-2 h-2 rounded-full", step === 1 ? "bg-orange-600 ring-4 ring-orange-100" : "bg-slate-300")} />
          <div className={cn("w-2 h-2 rounded-full", step === 2 ? "bg-orange-600 ring-4 ring-orange-100" : "bg-slate-300")} />
          <h2 className="font-bold text-slate-900 ml-2 text-sm sm:text-base">
            {step === 1 ? "Bill Details" : "Invoice Items"}
          </h2>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-slate-50 rounded-full text-slate-400">
          <X size={20} />
        </button>
      </div>

      <div className="p-4 sm:p-8 max-h-[70vh] overflow-y-auto">
        {step === 1 ? (
          <div className="space-y-6">
            {/* Example Loader Alert Banner */}
            <div className="p-4 bg-orange-50 border border-orange-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-extrabold text-orange-850 uppercase tracking-wider mb-0.5">Need a starting point?</h4>
                <p className="text-xs text-orange-700/90 font-semibold leading-normal">
                  Prepopulate the entire billing form with our custom pipeline material leakage reference data instantly.
                </p>
              </div>
              <button
                type="button"
                onClick={loadExampleData}
                className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-orange-100 hover:shadow-lg active:scale-95 whitespace-nowrap self-start sm:self-center"
              >
                ✨ Load Example Bill
              </button>
            </div>

            <motion.div 
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8"
            >
               <div className="space-y-6">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">General Information</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600">Invoice No <span className="text-rose-500 font-bold">*</span></label>
                      <input 
                        type="text" 
                        value={invoice.invoiceNo}
                        onChange={(e) => {
                          setInvoice(prev => ({ ...prev, invoiceNo: e.target.value }));
                          if (e.target.value.trim()) setErrors(prev => ({ ...prev, invoiceNo: undefined }));
                        }}
                        className={cn(
                          "w-full px-4 py-2.5 bg-slate-50 border rounded-xl outline-none text-sm font-medium transition-all duration-200",
                          errors.invoiceNo 
                            ? "border-rose-500 focus:border-rose-600 focus:ring-1 focus:ring-rose-500" 
                            : "border-slate-200 focus:border-orange-500"
                        )}
                      />
                      {errors.invoiceNo && (
                        <p className="text-[11px] font-semibold text-rose-500 mt-1">{errors.invoiceNo}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600">Invoice Date <span className="text-rose-500 font-bold">*</span></label>
                      <input 
                        type="date" 
                        value={invoice.invoiceDate}
                        onChange={(e) => {
                          setInvoice(prev => ({ ...prev, invoiceDate: e.target.value }));
                          if (e.target.value) setErrors(prev => ({ ...prev, invoiceDate: undefined }));
                        }}
                        className={cn(
                          "w-full px-4 py-2.5 bg-slate-50 border rounded-xl outline-none text-sm font-medium transition-all duration-200",
                          errors.invoiceDate 
                            ? "border-rose-500 focus:border-rose-600 focus:ring-1 focus:ring-rose-500" 
                            : "border-slate-200 focus:border-orange-500"
                        )}
                      />
                      {errors.invoiceDate && (
                        <p className="text-[11px] font-semibold text-rose-500 mt-1">{errors.invoiceDate}</p>
                      )}
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600">Client / Buyer and Seller Details</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Seller / Company</label>
                        <select 
                          value={invoice.companyId || ''}
                          onChange={(e) => {
                            const comp = companies?.find(c => c.id === e.target.value);
                            if (comp) {
                              setInvoice(prev => ({ ...prev, companyId: comp.id, company: comp }));
                            }
                          }}
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-orange-500 outline-none text-xs font-semibold"
                        >
                          {companies && companies.length > 0 ? (
                            companies.map(c => <option key={c.id} value={c.id}>{c.name} {c.isDefault ? '(Default)' : ''}</option>)
                          ) : (
                            <option value="">No companies configured</option>
                          )}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Client / Buyer</label>
                        <select 
                          onChange={(e) => handleClientSelect(e.target.value)}
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-orange-500 outline-none text-xs font-semibold"
                          value={invoice.clientId || ''}
                        >
                          <option value="">Choose a Department/Agency</option>
                          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600">Work Subject / Gat (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. GAT GRAMPANCHAYAT WELAHARI MATERIAL PIPELINE LEAKAGE" 
                      value={invoice.subject || ''}
                      onChange={(e) => setInvoice(prev => ({ ...prev, subject: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 outline-none text-sm font-medium"
                    />
                 </div>
                 <div className="flex items-center gap-2.5 pt-2">
                   <input 
                     type="checkbox" 
                     id="hideZeroTax"
                     checked={invoice.hideZeroTax !== false}
                     onChange={(e) => setInvoice(prev => ({ ...prev, hideZeroTax: e.target.checked }))}
                     className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500 cursor-pointer"
                   />
                   <label htmlFor="hideZeroTax" className="text-xs font-bold text-slate-700 select-none cursor-pointer">
                     Hide zero-tax value/rate cells and GST rows (0% lines)
                   </label>
                 </div>
               </div>

             <div className="space-y-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Billing Address</h3>
                <div className="space-y-4">
                   <textarea
                     placeholder="Client Full Address"
                     rows={3}
                     value={invoice.billTo?.address}
                     onChange={(e) => setInvoice(prev => ({ ...prev, billTo: { ...prev.billTo!, address: e.target.value } }))}
                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 outline-none text-sm"
                   />
                   <input 
                     placeholder="GSTIN/UIN"
                     value={invoice.billTo?.gstin}
                     onChange={(e) => setInvoice(prev => ({ ...prev, billTo: { ...prev.billTo!, gstin: e.target.value } }))}
                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 outline-none text-sm uppercase"
                   />
                </div>
             </div>
          </motion.div>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
             {/* Item Input Row */}
             <div className="grid grid-cols-1 md:grid-cols-6 gap-3 p-4 bg-orange-50/50 rounded-2xl border border-orange-100 items-start">
                <div className="md:col-span-2 space-y-1">
                  <input 
                    placeholder="Description (e.g. Metal 20mm)" 
                    value={newItem.description}
                    onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:border-orange-500 outline-none"
                  />
                  <p className="text-[9px] text-slate-400 font-medium px-1 leading-tight py-0.5">
                    Tip: Start with <strong>#</strong> to make a category header row (e.g. <code># GOTAL PANJRI</code>).
                  </p>
                  <input 
                    placeholder="HSN/SAC Code" 
                    value={newItem.hsn}
                    onChange={(e) => setNewItem(prev => ({ ...prev, hsn: e.target.value }))}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:border-orange-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <input 
                    type="number" 
                    placeholder="Qty" 
                    value={isNaN(newItem.qty as number) ? '' : newItem.qty}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setNewItem(prev => ({ ...prev, qty: isNaN(val) ? 0 : val }));
                    }}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs focus:border-orange-500 outline-none"
                  />
                  <input 
                    placeholder="Unit (CBM/BAG/PCS)" 
                    value={newItem.unit}
                    onChange={(e) => setNewItem(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs uppercase focus:border-orange-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <input 
                    type="number" 
                    placeholder="Rate" 
                    value={isNaN(newItem.rate as number) ? '' : newItem.rate}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setNewItem(prev => ({ ...prev, rate: isNaN(val) ? 0 : val }));
                    }}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs focus:border-orange-500 outline-none"
                  />
                  <div className="h-10 px-3 bg-white/70 border border-slate-200/55 rounded-lg text-[10px] text-slate-500 flex items-center font-mono truncate">
                    Taxable: ₹{((newItem.qty || 0) * (newItem.rate || 0)).toFixed(2)}
                  </div>
                </div>
                <div className="space-y-1">
                  <select 
                    value={isNaN(newItem.taxRate as number) ? 18 : newItem.taxRate}
                    onChange={(e) => setNewItem(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs focus:border-orange-500 outline-none font-semibold"
                  >
                    {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}% GST</option>)}
                  </select>
                  <div className="h-10 px-3 bg-white/70 border border-slate-200/55 rounded-lg text-[10px] text-orange-600 flex items-center font-mono truncate font-semibold">
                    Tax: ₹{(((newItem.qty || 1) * (newItem.rate || 0)) * (newItem.taxRate || 0) / 100).toFixed(2)}
                  </div>
                </div>
                <button 
                  onClick={addItem}
                  className="w-full h-21 md:h-[84px] bg-orange-600 text-white rounded-lg flex flex-col items-center justify-center hover:bg-orange-700 transition-all shadow-md shadow-orange-100 hover:shadow-lg hover:-translate-y-0.5"
                  title="Add item to list"
                >
                  <Plus size={20} className="stroke-[3]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Add</span>
                </button>
             </div>

             {/* Items Table */}
             <div className="space-y-3">
                {(invoice.items || []).map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors group">
                    <span className="text-xs font-bold text-slate-300 w-4">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                       <p className="text-sm font-semibold text-slate-900 truncate">{item.description}</p>
                       <p className="text-[10px] text-slate-400 font-mono tracking-wider">HSN: {item.hsn}</p>
                    </div>
                     <div className="text-right flex flex-col justify-center">
                        <p className="text-xs font-bold text-slate-900">{item.qty}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">{item.unit}</p>
                        <p className="text-[10px] text-slate-500">@{item.rate}</p>
                     </div>
                    <div className="text-right w-24">
                       <p className="text-sm font-bold text-slate-900">{((item.qty * item.rate) + item.taxAmount).toFixed(2)}</p>
                       <p className="text-[10px] text-orange-600 font-bold">{item.taxRate}% Tax</p>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
             </div>

             {/* Summary */}
             <div className="mt-8 p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col md:flex-row justify-between items-end gap-6">
                <div className="max-w-sm">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Amount in Words</p>
                   <p className="text-xs font-bold text-slate-600 italic">"{invoice.amountInWords}"</p>
                </div>
                <div className="space-y-2 w-full md:w-64">
                   <div className="flex justify-between text-xs text-slate-500">
                     <span>Taxable Total</span>
                     <span className="font-mono">{invoice.totalTaxableValue?.toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between text-xs text-slate-500">
                     <span>Tax (GST)</span>
                     <span className="font-mono">{invoice.totalTaxAmount?.toFixed(2)}</span>
                   </div>
                   <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                     <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Grand Total</span>
                     <span className="text-lg font-bold text-orange-600">{invoice.totalAmount?.toFixed(2)}</span>
                   </div>
                </div>
             </div>
          </motion.div>
        )}
      </div>

      <div className="p-4 sm:p-6 bg-white border-t border-slate-100 flex items-center justify-between">
        {step === 2 && (
          <button 
            onClick={() => setStep(1)}
            className="px-6 py-2.5 text-sm font-semibold text-slate-600 flex items-center gap-2 hover:bg-slate-50 rounded-xl transition-all"
          >
            <ChevronLeft size={18} /> Back
          </button>
        )}
        <div className="ml-auto flex items-center gap-3">
          {step === 1 ? (
            <button 
              onClick={() => {
                const newErrors: { invoiceNo?: string; invoiceDate?: string } = {};
                if (!invoice.invoiceNo?.trim()) {
                  newErrors.invoiceNo = 'Invoice number is required.';
                }
                if (!invoice.invoiceDate) {
                  newErrors.invoiceDate = 'Invoice date is required.';
                }

                if (Object.keys(newErrors).length > 0) {
                  setErrors(newErrors);
                  return;
                }
                setErrors({});
                setStep(2);
              }}
              className="px-8 py-2.5 bg-orange-600 text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-orange-700 shadow-lg shadow-orange-100 transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              Continue <ChevronRight size={18} />
            </button>
          ) : (
            <button 
              onClick={() => {
                const newErrors: { invoiceNo?: string; invoiceDate?: string } = {};
                if (!invoice.invoiceNo?.trim()) {
                  newErrors.invoiceNo = 'Invoice number is required.';
                }
                if (!invoice.invoiceDate) {
                  newErrors.invoiceDate = 'Invoice date is required.';
                }

                if (Object.keys(newErrors).length > 0) {
                  setErrors(newErrors);
                  setStep(1);
                  return;
                }
                setErrors({});
                onSave(invoice);
              }}
              className="px-8 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              <Save size={18} /> Finish & Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
