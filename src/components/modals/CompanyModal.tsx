import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CompanyProfile } from '@/src/types';

interface CompanyModalProps {
  editingCompany: CompanyProfile | null;
  onClose: () => void;
  onSave: (companyData: Partial<CompanyProfile>) => void;
}

export default function CompanyModal({ editingCompany, onClose, onSave }: CompanyModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (editingCompany) {
      setName(editingCompany.name || '');
      setAddress(editingCompany.address || '');
      setGstin(editingCompany.gstin || '');
      setPan(editingCompany.pan || '');
      setPhone(editingCompany.phone || '');
      setEmail(editingCompany.email || '');
    } else {
      setName('');
      setAddress('');
      setGstin('');
      setPan('');
      setPhone('');
      setEmail('');
    }
  }, [editingCompany]);

  const handleSubmit = () => {
    if (!name.trim()) {
      alert('Company name is required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email.trim() && !emailRegex.test(email.trim())) {
      alert('Please enter a valid email address.');
      return;
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    if (phone.trim() && !phoneRegex.test(phone.trim())) {
      alert('Phone number must be a valid 10-digit mobile number.');
      return;
    }

    if (gstin.trim() && gstin.trim().length !== 15) {
      alert('GSTIN must be exactly 15 characters.');
      return;
    }

    if (pan.trim() && pan.trim().length !== 10) {
      alert('PAN must be exactly 10 characters.');
      return;
    }

    onSave({
      name: name.trim(),
      address: address.trim(),
      gstin: gstin.trim(),
      pan: pan.trim(),
      phone: phone.trim(),
      email: email.trim()
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 space-y-6">
        <h3 className="text-lg font-bold text-slate-900">{editingCompany ? 'Edit Company Profile' : 'New Seller Company'}</h3>
        <div className="space-y-3">
          {[
            { key: 'name', label: 'Company / Seller Name', placeholder: 'e.g. PREM CONSTRUCTION', value: name, onChange: setName },
            { key: 'address', label: 'Business Address', placeholder: 'e.g. Nagpur Road, Maharashtra', value: address, onChange: setAddress, textarea: true },
            { key: 'gstin', label: 'GSTIN', placeholder: 'GSTIN', value: gstin, onChange: setGstin },
            { key: 'pan', label: 'PAN Number', placeholder: 'PAN', value: pan, onChange: setPan },
            { key: 'phone', label: 'Mobile / Phone', placeholder: 'Phone', value: phone, onChange: setPhone },
            { key: 'email', label: 'Email ID', placeholder: 'Email', value: email, onChange: setEmail, type: 'email' },
          ].map(field => (
            <div key={field.key}>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{field.label}</label>
              {field.textarea
                ? <textarea placeholder={field.placeholder} className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 mt-1 h-20 resize-none" value={field.value} onChange={e => field.onChange(e.target.value)} />
                : <input type={field.type || 'text'} placeholder={field.placeholder} className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 mt-1" value={field.value} onChange={e => field.onChange(e.target.value)} />
              }
            </div>
          ))}
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-1.5 font-bold text-slate-500 text-sm">Cancel</button>
          <button onClick={handleSubmit} className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-all shadow-md shadow-orange-100 text-sm">{editingCompany ? 'Save Changes' : 'Create Profile'}</button>
        </div>
      </div>
    </motion.div>
  );
}
