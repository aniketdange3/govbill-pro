import React, { useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, db } from '@/src/lib/firebase';
import { Invoice, CompanyProfile } from '@/src/types';
import { format } from 'date-fns';

function oklchToRgb(l: number, c: number, h: number): string {
  if (isNaN(h)) h = 0;
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b;
  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;
  let r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  let b_ = -0.0041960863 * l3 - 0.7034186145 * m3 + 1.7076147010 * s3;
  const gamma = (x: number) => {
    return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  };
  const rByte = Math.min(255, Math.max(0, Math.round(gamma(r) * 255)));
  const gByte = Math.min(255, Math.max(0, Math.round(gamma(g) * 255)));
  const bByte = Math.min(255, Math.max(0, Math.round(gamma(b_) * 255)));
  return `rgb(${rByte}, ${gByte}, ${bByte})`;
}

const replaceOklch = (str: string) => {
  let cleaned = str.replace(/oklch\(\s*([\d.%]+)\s+([\d.]+)\s+([\d.deg%]+)\s*(?:\/\s*[\d.%\s]+)?\)/g, (match, lStr, cStr, hStr) => {
    try {
      let l = lStr.endsWith('%') ? parseFloat(lStr) / 100 : parseFloat(lStr);
      let c = parseFloat(cStr);
      let h = hStr.endsWith('deg') ? parseFloat(hStr) : parseFloat(hStr);
      if (hStr.endsWith('%')) h = (parseFloat(hStr) / 100) * 360;

      if (l > 0.85) {
        if (c > 0.05) return '#fff7ed';
        return '#f8fafc';
      }
      if (h >= 20 && h <= 55 && c > 0.1) {
        return '#ea580c';
      }

      return oklchToRgb(l, c, h);
    } catch {
      return '#f1f5f9';
    }
  });

  cleaned = cleaned.replace(/oklab\(\s*[^)]+\)/g, '#f1f5f9');
  return cleaned;
};

interface PDFProcessorProps {
  invoice: Invoice;
  company: CompanyProfile;
  onComplete: (url: string) => void;
  onError: (error: string) => void;
}

export default function PDFProcessor({ invoice, company, onComplete, onError }: PDFProcessorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hideZero = invoice.hideZeroTax !== false;
  const displayCompany = invoice.company || company;

  useEffect(() => {
    const process = async () => {
      if (!containerRef.current) return;

      const originalError = console.error;
      const originalWarn = console.warn;

      console.error = (...args: any[]) => {
        const msg = args[0];
        if (msg && typeof msg === 'string' && (msg.includes('unsupported color function') || msg.includes('oklch') || msg.includes('oklab'))) {
          return;
        }
        originalError(...args);
      };

      console.warn = (...args: any[]) => {
        const msg = args[0];
        if (msg && typeof msg === 'string' && (msg.includes('unsupported color function') || msg.includes('oklch') || msg.includes('oklab'))) {
          return;
        }
        originalWarn(...args);
      };

      try {
        await new Promise(resolve => setTimeout(resolve, 500));

        const canvas = await html2canvas(containerRef.current, {
          scale: 2,
          useCORS: true,
          logging: false,
          onclone: (clonedDoc) => {
            clonedDoc.querySelectorAll('style').forEach((styleTag) => {
              if (styleTag.textContent) {
                styleTag.textContent = replaceOklch(styleTag.textContent);
              }
            });

            const elements = clonedDoc.querySelectorAll('*');
            const colorProps = [
              'color',
              'backgroundColor',
              'borderColor',
              'borderTopColor',
              'borderRightColor',
              'borderBottomColor',
              'borderLeftColor',
              'fill',
              'stroke',
              'outlineColor'
            ];

            elements.forEach((el) => {
              if (el instanceof HTMLElement || el instanceof SVGElement) {
                const computed = window.getComputedStyle(el);
                colorProps.forEach((prop) => {
                  const rawVal = el.style[prop as any] || computed[prop as any];
                  if (rawVal && (rawVal.includes('oklch') || rawVal.includes('oklab'))) {
                    el.style[prop as any] = replaceOklch(rawVal);
                  }
                });
              }
            });
          }
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

        const pdfBlob = pdf.output('blob');
        const storageRef = ref(storage, `invoices/${invoice.createdBy || 'default'}/${invoice.id}.pdf`);

        await uploadBytes(storageRef, pdfBlob);
        const downloadUrl = await getDownloadURL(storageRef);

        await updateDoc(doc(db, 'invoices', invoice.id), {
          pdfUrl: downloadUrl
        });

        onComplete(downloadUrl);
      } catch (err: any) {
        console.error('PDF Generation failed:', err);
        onError(err.message || 'Unknown error');
      } finally {
        console.error = originalError;
        console.warn = originalWarn;
      }
    };

    process();
  }, []);

  const taxSummary = (invoice.items || []).reduce((acc, item) => {
    const key = `${item.hsn || '-'}_${item.taxRate}`;
    if (!acc[key]) {
      acc[key] = { hsn: item.hsn || '-', rate: item.taxRate, taxable: 0, tax: 0 };
    }
    acc[key].taxable += item.qty * item.rate;
    acc[key].tax += item.taxAmount;
    return acc;
  }, {} as Record<string, { hsn: string; rate: number; taxable: number; tax: number }>);

  let sNo = 1;
  const processItems = (invoice.items || []).map((item) => {
    const isSectionHeader = item.description.trim().startsWith('#');
    let currentSNo = '';
    if (isSectionHeader) {
      sNo = 1;
    } else {
      currentSNo = `${sNo++}`;
    }
    return {
      ...item,
      isSectionHeader,
      displaySNo: currentSNo,
      cleanedDescription: isSectionHeader ? item.description.trim().replace(/^#\s*/, '') : item.description,
    };
  });

  return (
    <div className="fixed -left-[2000px] top-0 pointer-events-none opacity-0">
      <div
        ref={containerRef}
        className="bg-white w-[210mm] min-h-[297mm] p-[0.20in] font-sans text-black leading-relaxed"
        style={{ fontSize: '12px' }}
      >
        {/* Header Box */}
        <div className="border-t border-x border-black flex">
          {/* Left Column: Vendor Profile */}
          <div className="w-[60%] p-3 border-r border-black flex flex-col justify-between">
            <div>
              <h1 className="text-[20px] font-black tracking-tight text-neutral-900 uppercase leading-none mb-0.5">
                {displayCompany.name}
              </h1>
              <p className="text-[10px] font-bold text-orange-600 tracking-wide uppercase border-b border-dashed border-orange-200 pb-1 mb-1">
                BUILDING MATERIAL SUPPLIERS AND CIVIL WORK
              </p>
              <p className="text-[10px] font-medium leading-normal text-neutral-800">
                {displayCompany.address}
              </p>
            </div>
            <div className="mt-2 space-y-0.5 text-[10px] font-medium text-neutral-900">
              <div>GSTIN: <strong className="font-bold font-mono">{displayCompany.gstin}</strong></div>
              <div>Mobile: <strong className="font-mono">{displayCompany.phone}</strong></div>
              <div>Email: <strong className="font-mono">{displayCompany.email}</strong></div>
            </div>
          </div>

          {/* Right Column: Invoice Info */}
          <div className="w-[40%] flex flex-col justify-center items-center text-center p-3">
            <h2 className="text-[11px] font-black tracking-widest text-white uppercase px-4 py-1.5 bg-orange-600 rounded-md mb-3 shadow-sm">
              INVOICE BILL
            </h2>
            <div className="w-full space-y-1 text-left pl-4 text-[11px] text-neutral-900">
              <div className="flex justify-between max-w-[200px]">
                <span className="font-bold text-neutral-600">Invoice no.:</span>
                <strong className="font-black font-mono">{invoice.invoiceNo}</strong>
              </div>
              <div className="flex justify-between max-w-[200px]">
                <span className="font-bold text-neutral-600">Invoice date:</span>
                <strong className="font-black font-mono">
                  {format(new Date(invoice.invoiceDate), 'dd/MM/yyyy')}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* BILL TO / SHIP TO Box */}
        <div className="border border-black flex min-h-[110px]">
          {/* BILL TO */}
          <div className="w-1/2 p-3 border-r border-black flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-black text-orange-600 uppercase tracking-wider mb-0.5">BILL TO</p>
              <p className="font-extrabold text-[12px] leading-snug uppercase text-neutral-900">
                {invoice.billTo.name}
              </p>
              <p className="text-[10px] text-neutral-800 leading-normal mt-0.5 whitespace-pre-wrap">
                {invoice.billTo.address}
              </p>
            </div>
            <div className="pt-1.5 border-t border-dashed border-neutral-300 mt-1 flex flex-col gap-0.5 text-[10px] font-bold text-neutral-900">
              <div>GSTIN: <span className="font-mono">{invoice.billTo.gstin || '-'}</span></div>
              <div>PLACE OF SUPPLY: <span className="uppercase">{invoice.billTo.placeOfSupply || 'MAHARASHTRA'}</span></div>
            </div>
          </div>

          {/* SHIP TO */}
          <div className="w-1/2 p-3 flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-black text-orange-600 uppercase tracking-wider mb-0.5">SHIP TO</p>
              <p className="font-extrabold text-[12px] leading-snug uppercase text-neutral-900">
                {invoice.shipTo.name || invoice.billTo.name}
              </p>
              <p className="text-[10px] text-neutral-800 leading-normal mt-0.5 whitespace-pre-wrap">
                {invoice.shipTo.address || invoice.billTo.address}
              </p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full border-x border-b border-black table-fixed text-[10px]">
          <colgroup>
            <col style={{ width: '45px' }} />
            <col />
            <col style={{ width: '70px' }} />
            <col style={{ width: '70px' }} />
            <col style={{ width: '70px' }} />
            <col style={{ width: '70px' }} />
            <col style={{ width: '70px' }} />
            <col style={{ width: '70px' }} />
          </colgroup>
          <thead>
            {/* Optional work subject line */}
            {invoice.subject && (
              <tr className="bg-orange-50 border-b border-black">
                <td colSpan={8} className="py-1.5 px-3 text-center text-[11px] font-extrabold uppercase tracking-wide text-orange-950">
                  {invoice.subject}
                </td>
              </tr>
            )}
            {/* Table Headers */}
            <tr className="bg-orange-600 border-b border-black text-center font-bold text-[9px] uppercase tracking-wider h-8 text-white">
              <th className="border-r border-black py-1">SR. NO</th>
              <th className="border-r border-black py-1 text-left px-3">ITEMS</th>
              <th className="border-r border-black py-1">QTY/UNIT</th>
              <th className="border-r border-black py-1">RATE</th>
              <th className="border-r border-black py-1">RS</th>
              <th className="border-r border-black py-1">TAX</th>
              <th className="border-r border-black py-1">PERSENT</th>
              <th className="py-1">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {processItems.map((item, idx) => {
              if (item.isSectionHeader) {
                return (
                  <tr key={item.id} className="border-b border-black bg-slate-50 font-bold">
                    <td className="border-r border-black py-1.5 text-center font-bold">#</td>
                    <td colSpan={7} className="border-r border-black py-1.5 text-left px-3 font-extrabold uppercase tracking-wide text-neutral-900">
                      {item.cleanedDescription}
                    </td>
                  </tr>
                );
              }

              const taxableVal = item.qty * item.rate;
              return (
                <tr key={item.id} className="text-center border-b border-neutral-300 last:border-b-0 h-8">
                  <td className="border-r border-black py-1 text-neutral-800 font-mono text-[9px]">{item.displaySNo}</td>
                  <td className="border-r border-black py-1 text-left px-3 font-semibold uppercase text-neutral-900">{item.cleanedDescription}</td>
                  <td className="border-r border-black py-1 font-medium font-mono text-[9px]">
                    {item.qty > 0 ? `${item.qty} ${item.unit}` : '-'}
                  </td>
                  <td className="border-r border-black py-1 font-mono text-[9px]">{item.rate > 0 ? item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                  <td className="border-r border-black py-1 font-mono text-[9px]">{taxableVal > 0 ? taxableVal.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                  <td className="border-r border-black py-1 font-mono text-[9px]">{hideZero && item.taxAmount === 0 ? '-' : item.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="border-r border-black py-1 font-mono text-[9px]">{hideZero && item.taxRate === 0 ? '-' : `${item.taxRate}%`}</td>
                  <td className="py-1 font-bold font-mono text-[9px]">{item.amount > 0 ? item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                </tr>
              );
            })}

            {/* Fill empty space up to a reasonable list size to maintain premium single-page layout if items list is small */}
            {Array.from({ length: Math.max(0, 4 - processItems.length) }).map((_, i) => (
              <tr key={`empty-${i}`} className="h-7 border-b border-neutral-100 last:border-b-0">
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td></td>
              </tr>
            ))}

            {/* Totals Row */}
            <tr className="border-t-2 border-black font-extrabold bg-orange-50 text-[10px] text-center h-8">
              <td colSpan={2} className="border-r border-black px-3 py-1 text-[11px] font-black uppercase text-center text-orange-950">
                TOTAL
              </td>
              <td className="border-r border-black py-1">-</td>
              <td className="border-r border-black py-1">-</td>
              <td className="border-r border-black py-1 font-mono text-neutral-900">
                {invoice.totalTaxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
              <td className="border-r border-black py-1 font-mono text-neutral-900">
                {invoice.totalTaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
              <td className="border-r border-black py-1">-</td>
              <td className="py-1 font-black font-mono text-orange-600">
                {invoice.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>

        {/* GST Details Box */}
        <div className="mt-3">
          <table className="w-full border border-black text-center text-[10px] font-sans">
            <thead>
              <tr className="bg-orange-600 border-b border-black font-bold text-[9px] uppercase tracking-wider text-white">
                <th rowSpan={2} className="border-r border-black py-1.5 w-[16%]">HSN/SAC</th>
                <th rowSpan={2} className="border-r border-black py-1.5 w-[20%]">Taxable value</th>
                <th colSpan={2} className="border-r border-black py-1">CGST</th>
                <th colSpan={2} className="border-r border-black py-1">SGST</th>
                <th rowSpan={2} className="py-1.5 w-[24%]">TOTAL TAX AMOUNT</th>
              </tr>
              <tr className="bg-orange-50 border-b border-black font-bold text-[8px] uppercase tracking-wider text-orange-950">
                <th className="border-r border-black py-1 w-[10%]">RATE</th>
                <th className="border-r border-black py-1 w-[15%]">AMOUNT</th>
                <th className="border-r border-black py-1 w-[10%]">RATE</th>
                <th className="border-r border-black py-1 w-[15%]">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(taxSummary)
                .filter(([_, vals]) => !(hideZero && vals.tax === 0))
                .map(([key, vals]) => (
                  <tr key={key} className="border-b border-neutral-300 last:border-b-0 h-6">
                    <td className="border-r border-black py-1 font-mono text-neutral-800 font-bold">{vals.hsn}</td>
                    <td className="border-r border-black py-1 font-mono text-neutral-900">{vals.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="border-r border-black py-1 font-mono text-neutral-800">{(vals.rate / 2)}%</td>
                    <td className="border-r border-black py-1 font-mono text-neutral-900">{(vals.tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="border-r border-black py-1 font-mono text-neutral-800">{(vals.rate / 2)}%</td>
                    <td className="border-r border-black py-1 font-mono text-neutral-900">{(vals.tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="py-1 font-bold font-mono text-neutral-900">{vals.tax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))
              }
              {/* Totals Row inside GST Table */}
              <tr className="border-t-2 border-black font-extrabold bg-orange-50 text-[9px] uppercase tracking-wider h-7 text-orange-950">
                <td className="border-r border-black py-1 text-left pl-3">Total</td>
                <td className="border-r border-black py-1 font-mono">
                  {invoice.totalTaxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="border-r border-black py-1">-</td>
                <td className="border-r border-black py-1 font-mono text-neutral-900">
                  {(invoice.totalTaxAmount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="border-r border-black py-1">-</td>
                <td className="border-r border-black py-1 font-mono text-neutral-900">
                  {(invoice.totalTaxAmount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-1 font-black font-mono text-neutral-900">
                  {invoice.totalTaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Amount in Words */}
        <div className="mt-3 border border-black p-3 bg-orange-50/50 flex flex-col justify-center min-h-[44px]">
          <p className="text-[8px] font-black text-orange-600 uppercase tracking-wider leading-none mb-1">TOTAL AMOUNT (IN WORD)</p>
          <p className="text-[11px] font-extrabold text-neutral-900 uppercase italic">
            {invoice.amountInWords}
          </p>
        </div>

        {/* Terms and Signatures */}
        <div className="mt-3 flex border border-black min-h-[90px] break-inside-avoid">
          <div className="w-[55%] p-3 border-r border-black flex flex-col justify-between">
            <div>
              <p className="font-black text-[9px] text-orange-600 uppercase tracking-wider border-b border-dashed border-orange-200 pb-1 mb-1.5">Terms and Conditions</p>
              <ol className="text-[9px] font-semibold text-neutral-700 space-y-1 pl-0">
                <li>1. GOODS ONCE SOLD WILL NOT BE TAKEN BACK OR EXCHANGED.</li>
                <li>2. ALL DISPUTES ARE SUBJECT TO NAGPUR, MAHARASHTRA JURISDICTION ONLY.</li>
              </ol>
            </div>
          </div>
          <div className="w-[45%] p-3 flex flex-col justify-between items-center text-center">
            <p className="text-[9px] font-extrabold text-neutral-800 uppercase tracking-wide">
              AUTHORISED SIGNATORY FOR <span className="font-black text-black block mt-0.5">{displayCompany.name}</span>
            </p>
            <div className="flex-1 min-h-[30px]"></div>
            <div className="w-full">
              <div className="border-t border-dashed border-neutral-400 mx-auto w-[85%]"></div>
              <p className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest mt-1">
                Authorised Signatory
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
