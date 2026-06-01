import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toWords } from "number-to-words";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(amount);
}

export function amountToWords(amount: number) {
  // Convert to words and capitalize
  try {
    const words = toWords(Math.floor(amount));
    return (words.charAt(0).toUpperCase() + words.slice(1) + " Rupees Only").replace(/-/g, ' ');
  } catch (e) {
    return "Amount in words calculation error";
  }
}

export interface TaxBreakdown {
  rate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  total: number;
}

export function calculateTax(rate: number, amount: number) {
  const halfRate = rate / 2;
  const taxPerSide = (amount * halfRate) / 100;
  return {
    cgst: taxPerSide,
    sgst: taxPerSide,
    total: taxPerSide * 2
  };
}
