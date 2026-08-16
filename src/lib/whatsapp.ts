import type { Bill } from '@/lib/types';
import { format } from 'date-fns';

/**
 * Sanitizes phone number to standard international format without '+' or non-digits.
 * Defaults to India (+91) if a 10-digit number is passed.
 */
export function sanitizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    cleaned = `91${cleaned}`;
  }
  return cleaned;
}

/**
 * Formats a clean, highly compatible & professional WhatsApp receipt for The 8 Bit Bistro.
 * Uses high-compatibility ASCII formatting to prevent missing font glyphs or diamond question marks.
 */
export function formatWhatsAppBillMessage(bill: Bill, customerName?: string): string {
  const billDate = bill.timestamp ? format(new Date(bill.timestamp), 'MMM d, yyyy | h:mm a') : format(new Date(), 'MMM d, yyyy | h:mm a');
  const membersList = (bill.members || []).map(m => m.name).join(', ');
  const displayName = customerName || membersList || 'Valued Customer';

  let message = `====================================\n`;
  message += `        *THE 8 BIT BISTRO*\n`;
  message += `====================================\n`;
  message += `*Station:* ${bill.stationName || 'Bistro Station'}\n`;
  message += `*Date:* ${billDate}\n`;
  message += `*Customer:* ${displayName}\n`;
  message += `------------------------------------\n\n`;

  message += `*ITEMIZED RECEIPT:*\n`;

  let itemIndex = 1;

  if (bill.initialPackagePrice > 0) {
    message += `${itemIndex++}. *${bill.packageName || 'Gaming Session'}* x1\n   -> Rs. ${bill.initialPackagePrice.toLocaleString('en-IN')}\n`;
  }

  if (bill.items && bill.items.length > 0) {
    bill.items.forEach(item => {
      message += `${itemIndex++}. *${item.name}* x${item.quantity}\n   -> Rs. ${(item.price * item.quantity).toLocaleString('en-IN')}\n`;
    });
  }

  message += `\n------------------------------------\n`;

  const subtotal = (bill.initialPackagePrice || 0) + (bill.foodSubtotal || 0) + (bill.items || []).filter(i => i.name.startsWith('Time:')).reduce((acc, item) => acc + (item.price * item.quantity), 0);
  
  if (bill.discount > 0) {
    message += `Subtotal: Rs. ${subtotal.toLocaleString('en-IN')}\n`;
    message += `Discount: -Rs. ${bill.discount.toLocaleString('en-IN')}\n`;
  }

  message += `*TOTAL AMOUNT: Rs. ${(bill.totalAmount || 0).toLocaleString('en-IN')}*\n`;
  
  const paymentMethodLabel = bill.paymentMethod ? bill.paymentMethod.toUpperCase() : 'CASH';
  message += `*Payment Method:* ${paymentMethodLabel}\n`;

  if (bill.paymentMethod === 'split') {
    if (bill.cashAmount) message += `   - Cash: Rs. ${bill.cashAmount.toLocaleString('en-IN')}\n`;
    if (bill.upiAmount) message += `   - UPI: Rs. ${bill.upiAmount.toLocaleString('en-IN')}\n`;
  }

  message += `------------------------------------\n`;
  message += `*Member XP & Rewards Updated!*\n`;
  message += `Thank you for visiting The 8 Bit Bistro HQ!\n\n`;
  message += `Support / Helpline: +91 8830325714\n`;
  message += `====================================`;

  return message;
}

/**
 * Generates a wa.me URL for sending the bill via WhatsApp Web or App.
 */
export function generateWhatsAppBillLink(bill: Bill, phone?: string, customerName?: string): string {
  const message = formatWhatsAppBillMessage(bill, customerName);
  const encodedText = encodeURIComponent(message);
  
  if (phone) {
    const cleanPhone = sanitizePhoneNumber(phone);
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }

  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Directly opens WhatsApp web/app link in a new tab.
 */
export function openWhatsAppBillLink(bill: Bill, phone?: string, customerName?: string): void {
  const url = generateWhatsAppBillLink(bill, phone, customerName);
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
