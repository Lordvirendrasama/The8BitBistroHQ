'use client';

import { useState, useEffect } from 'react';
import type { Bill } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Send, Copy, Check, Phone, User } from 'lucide-react';
import { formatWhatsAppBillMessage, openWhatsAppBillLink } from '@/lib/whatsapp';
import { useToast } from '@/hooks/use-toast';

interface ShareWhatsAppModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  bill: Bill | null;
  defaultPhone?: string;
  defaultName?: string;
}

export function ShareWhatsAppModal({
  isOpen,
  onOpenChange,
  bill,
  defaultPhone = '',
  defaultName = ''
}: ShareWhatsAppModalProps) {
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && bill) {
      setPhone(defaultPhone || '');
      setCustomerName(defaultName || (bill.members && bill.members.length > 0 ? bill.members[0].name : ''));
      setCopied(false);
    }
  }, [isOpen, bill, defaultPhone, defaultName]);

  if (!bill) return null;

  const formattedMessage = formatWhatsAppBillMessage(bill, customerName);

  const handleSend = () => {
    openWhatsAppBillLink(bill, phone, customerName);
    toast({
      title: "WhatsApp Opened",
      description: "Bill text pre-filled into WhatsApp chat.",
    });
    onOpenChange(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedMessage);
    setCopied(true);
    toast({
      title: "Copied to Clipboard",
      description: "Bill text copied successfully.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-md flex flex-col p-0 overflow-hidden border-2 shadow-2xl">
        <DialogHeader className="px-6 pt-5 bg-muted/20 border-b pb-3">
          <DialogTitle className="flex items-center gap-2 font-display tracking-tight text-lg sm:text-xl text-emerald-600">
            <MessageSquare className="h-5 w-5 fill-emerald-500/20 text-emerald-600" />
            SEND WHATSAPP RECEIPT
          </DialogTitle>
          <DialogDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {bill.stationName} • ₹{(bill.totalAmount || 0).toLocaleString('en-IN')}
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase tracking-normal opacity-70 flex items-center gap-1">
                <User className="h-3 w-3" /> Customer Name
              </Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Gamer Name"
                className="h-9 font-bold uppercase text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase tracking-normal opacity-70 flex items-center gap-1">
                <Phone className="h-3 w-3" /> WhatsApp Phone
              </Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="h-9 font-mono font-bold text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-bold uppercase tracking-normal opacity-70">
                Receipt Message Preview
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-6 px-2 text-xs font-bold uppercase gap-1 text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <Textarea
              value={formattedMessage}
              readOnly
              className="h-44 text-xs font-mono bg-muted/30 border-2 resize-none leading-relaxed p-3 focus-visible:ring-0"
            />
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-muted/10 flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto font-bold uppercase text-xs h-10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            className="w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase text-xs h-10 gap-2 shadow-lg"
          >
            <Send className="h-4 w-4" />
            Send via WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
