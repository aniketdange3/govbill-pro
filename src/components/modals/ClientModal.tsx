import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Client } from '@/src/types';

interface ClientModalProps {
  editingClient: Client | null;
  onClose: () => void;
  onSave: (clientData: { name: string; address: string; gstin: string; contactPerson: string; email: string; phone: string }) => void;
}

export default function ClientModal({ editingClient, onClose, onSave }: ClientModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (editingClient) {
      setName(editingClient.name || '');
      setAddress(editingClient.address || '');
      setGstin(editingClient.gstin || '');
      setContactPerson(editingClient.contactPerson || editingClient.contact_person || '');
      setEmail(editingClient.email || '');
      setPhone(editingClient.phone || '');
    } else {
      setName('');
      setAddress('');
      setGstin('');
      setContactPerson('');
      setEmail('');
      setPhone('');
    }
  }, [editingClient]);

  const handleSubmit = () => {
    if (!name.trim()) {
      alert('Department/Client name is required.');
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

    onSave({
      name: name.trim(),
      address: address.trim(),
      gstin: gstin.trim(),
      contactPerson: contactPerson.trim(),
      email: email.trim(),
      phone: phone.trim()
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 space-y-6">
        <h3 className="text-lg font-bold text-slate-900">{editingClient ? 'Edit Department / Client' : 'New Department / Client'}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Department/Agency Name</label>
            <input placeholder="e.g. Executive Engineer, Z.P. Nagpur" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 mt-1" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Billing Address</label>
            <textarea placeholder="Full Address" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 mt-1 h-20 resize-none" value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">GSTIN</label>
              <input placeholder="GSTIN" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 uppercase mt-1" value={gstin} onChange={e => setGstin(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Contact Person</label>
              <input placeholder="Full Name" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 mt-1" value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Email Address</label>
              <input type="email" placeholder="Email" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 mt-1" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Phone Number</label>
              <input placeholder="Phone" className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-orange-500 mt-1" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2 font-bold text-slate-500">Cancel</button>
          <button onClick={handleSubmit} className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-all shadow-md shadow-orange-100">{editingClient ? 'Save Changes' : 'Add Department'}</button>
        </div>
      </div>
    </motion.div>
  );
}
