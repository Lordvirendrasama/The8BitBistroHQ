
'use client';
import { useMemo, useState, useEffect } from 'react';
import type { Station, GamingPackage, Member, MemberTier, BillItem, PaymentMethod, FoodItem, Bill, Debt } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Star, Receipt, Banknote, Smartphone, ArrowLeft, Layers, Tag, ChevronRight, FileWarning, Zap, Phone, Clock, CheckCircle2, Search, Plus, Minus, Trash2, ShoppingBag, MapPin, MessageSquare, Send, X, Coins, Check, AlertCircle } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { settings } from '@/lib/data';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { recordDebt, clearDebt } from '@/firebase/firestore/debts';
import { useAuth } from '@/firebase/auth/use-user';
import { useFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, doc, updateDoc, getFirestore } from 'firebase/firestore';
import { getSyncedNow } from '@/lib/synced-time';
import { playCoinSound } from '@/lib/audio/chiptune';
import { openWhatsAppBillLink } from '@/lib/whatsapp';
import { calculateGroupPrice, calculatePlayerPrice } from '@/lib/pricing';

interface CheckoutModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  station: Station | null;
  gamingPackages: GamingPackage[];
  onConfirmCheckout: (
    stationId: string, 
    finalBill: number, 
    billItems: BillItem[], 
    discount: number, 
    paymentMethod: PaymentMethod,
    cashAmount?: number,
    upiAmount?: number,
    isRechargePurchase?: boolean,
    rechargePkg?: GamingPackage,
    debtAdjustment?: Bill['debtAdjustment']
  ) => void;
  onSaveBill: (stationId: string, newBill: BillItem[], newDiscount: number) => void;
  allMembers: Member[];
  foodItems: FoodItem[];
}

const tierMultipliers: Record<MemberTier, number> = { Red: 1, Green: 1.5, Gold: 2 };
const tierColors: Record<MemberTier, string> = { Red: 'bg-red-500/20 text-red-500 border-red-500/50', Green: 'bg-green-500/20 text-green-500 border-green-500/50', Gold: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50' };

type CheckoutStep = 'review-bill' | 'member-xp' | 'payment-method' | 'split-details' | 'pending-details' | 'checkout-success';

export function CheckoutModal({ isOpen, onOpenChange, station, gamingPackages, onConfirmCheckout, onSaveBill, allMembers, foodItems }: CheckoutModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<CheckoutStep>('review-bill');
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [discountInput, setDiscountInput] = useState('0');
  const [splitCash, setSplitCash] = useState<string>('');
  const [splitUpi, setSplitUpi] = useState<string>('');
  const [paidNow, setPaidNow] = useState<string>('0');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [contactName, setContactName] = useState<string>('');
  const [wantWhatsAppBill, setWantWhatsAppBill] = useState<boolean | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');

  useEffect(() => {
    if (isOpen && station) {
        let items = station.currentBill ? [...station.currentBill] : [];
        const hasSessionItems = items.some(i => 
            i.name.startsWith('Time:') || 
            i.name.startsWith('Recharge:') || 
            i.name.startsWith('Buy Recharge:')
        );

        const isWalkInOrNoTimer = station.packageName === 'Walk-in Order' || !station.endTime;

        if (!hasSessionItems && station.status !== 'available' && station.members && station.members.length > 0 && !isWalkInOrNoTimer) {
            const isRecharge = station.packageName?.startsWith('Recharge: ');
            if (!isRecharge) {
                let durMins = 60;
                if (station.startTime && station.endTime) {
                    const diff = new Date(station.endTime).getTime() - new Date(station.startTime).getTime();
                    durMins = Math.max(1, Math.round(diff / 60000));
                }
                const count = station.members.length;
                const perPlayerPrice = calculatePlayerPrice(station.type || 'ps5', count, durMins);
                const durText = durMins >= 60 ? `${durMins / 60} Hour` : `${durMins} Min`;

                const synthesizedItems: BillItem[] = station.members.map(m => ({
                    itemId: `time-${m.id}`,
                    name: `Time: ${durText} Session (${m.name})`,
                    price: perPlayerPrice,
                    quantity: 1,
                    addedAt: station.startTime || new Date().toISOString()
                }));

                items = [...synthesizedItems, ...items];
            }
        }

        setBillItems(items);
        setDiscount(station.discount || 0);
        setDiscountInput(String(station.discount || 0));
        setStep('review-bill');
        setIsClosing(false);
        setSearchTerm('');
        setSelectedMethod('cash');
        setWantWhatsAppBill(null);
        const members = station.members || [];
        if (members.length > 0) {
            setContactName(members[0].name);
            const member = allMembers.find(m => m.id && m.id === members[0].id);
            setContactPhone(member?.phone || '');
            if (member?.phone) {
                setWantWhatsAppBill(true);
            }
        }
    }
  }, [isOpen, station?.id]);

  const formatBalance = (sec: number) => {
    if (sec < 0) sec = 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
  };

  const foodSubtotal = useMemo(() => billItems.filter(i => !i.name.startsWith('Time:')).reduce((s, i) => s + (i.price * i.quantity), 0), [billItems]);
  const timePackageTotal = useMemo(() => billItems.filter(i => i.name.startsWith('Time:')).reduce((s, i) => s + (i.price * i.quantity), 0), [billItems]);

  const initialPackageInfo = useMemo(() => {
    if (!station || !station.packageName || station.packageName === 'Walk-in Order') return null;
    const members = station.members || [];
    const hasItemizedSessionItems = billItems.some(i => {
        const nameLower = i.name.toLowerCase();
        return (
            members.some(m => {
                const matches = nameLower.match(/\(([^)]+)\)/g);
                if (!matches) return false;
                return matches.some(match => {
                    const content = match.slice(1, -1);
                    return content.split(',').map(p => p.trim()).includes(m.name.toLowerCase());
                });
            }) ||
            nameLower.startsWith('time:') ||
            nameLower.startsWith('buy recharge:') ||
            nameLower.startsWith('recharge:')
        );
    });
    if (hasItemizedSessionItems) return null;
    if (billItems.some(i => i.name === station.packageName)) return null;
    const isRechargeUsed = station.packageName.toLowerCase().startsWith('recharge: ');
    
    // SMART CHECK: Even if not started as "Recharge:", if the members HAVE balance, we treat it as prepaid
    const membersWithPool = members.filter(am => {
        const mData = allMembers.find(m => m.id === am.id);
        return (mData?.recharges || []).some(r => new Date(r.expiryDate) > new Date() && r.remainingDuration > 0);
    });
    const autoUsePool = membersWithPool.length > 0;

    const isRechargeBought = station.packageName.toLowerCase().startsWith('buy recharge: ');
    const pureName = station.packageName.replace(/^(Recharge: |Buy Recharge: )/i, '').trim();
    const pkg = gamingPackages.find(p => p.name.toLowerCase().trim() === pureName.toLowerCase());
    const playerCount = members.length > 0 ? members.length : 1;

    let total = 0;
    if (isRechargeUsed || autoUsePool) {
      total = 0;
    } else if (pkg) {
      const capacity = pkg.playerCapacity || 1;
      total = pkg.price * Math.ceil(playerCount / capacity);
    } else {
      let durMins = 60;
      if (station.startTime && station.endTime) {
        const diff = new Date(station.endTime).getTime() - new Date(station.startTime).getTime();
        durMins = Math.max(1, Math.round(diff / 60000));
      }
      total = calculateGroupPrice(station.type || 'ps5', playerCount, durMins);
    }

    return { 
        name: station.packageName, 
        purePackage: pkg, 
        total, 
        isExistingRecharge: isRechargeUsed || autoUsePool, 
        isNewRechargePurchase: isRechargeBought 
    };

  }, [station, gamingPackages, billItems, allMembers]);


  const { db } = useFirebase();
  const debtsQuery = useMemo(() => (!db ? null : query(collection(db, 'debts'), where('status', '==', 'pending'))), [db]);
  const { data: allPendingDebts } = useCollection<Debt>(debtsQuery);
  const [appliedDebtIds, setAppliedDebtIds] = useState<string[]>([]);

  const playedSecondsPerPlayer = useMemo(() => {
    if (!station || !station.startTime || !station.endTime) return 0;
    const totalSessionSeconds = Math.floor((new Date(station.endTime).getTime() - new Date(station.startTime).getTime()) / 1000);
    let remainingSecondsOnTimer = 0;
    if (station.status === 'paused' && station.remainingTimeOnPause != null) { remainingSecondsOnTimer = station.remainingTimeOnPause; }
    else { const end = new Date(station.endTime).getTime(); remainingSecondsOnTimer = Math.max(0, Math.floor((end - getSyncedNow()) / 1000)); }
    return Math.max(0, totalSessionSeconds - remainingSecondsOnTimer);
  }, [station]);

  // Match pending debts for the current session members, phone, or customer name
  const matchingDebts = useMemo(() => {
    if (!allPendingDebts || !station) return [];
    const stationMembers = station.members || [];
    const normalizedContactPhone = (contactPhone || '').replace(/\D/g, '').slice(-10);
    const normalizedContactName = (contactName || '').trim().toLowerCase();

    return allPendingDebts.filter(debt => {
      const debtPhone = (debt.contactPhone || '').replace(/\D/g, '').slice(-10);
      const debtName = (debt.contactName || '').trim().toLowerCase();
      const isGenericDebtName = !debtName || debtName.startsWith('guest') || debtName.startsWith('player');

      // 1. Match by memberId directly
      if (debt.memberId && stationMembers.some(m => m.id === debt.memberId)) {
        return true;
      }

      // 2. Match by station members' profile phone and name
      for (const sm of stationMembers) {
        const mData = allMembers.find(m => m.id === sm.id);
        const mPhone = (mData?.phone || '').replace(/\D/g, '').slice(-10);
        if (mPhone && debtPhone && mPhone === debtPhone) {
          return true;
        }
        const smName = sm.name.trim().toLowerCase();
        const isGenericSmName = !smName || smName.startsWith('guest') || smName.startsWith('player');
        if (!isGenericSmName && !isGenericDebtName && smName === debtName) {
          return true;
        }
      }

      // 3. Match by currently entered contactPhone in modal
      if (normalizedContactPhone && debtPhone && normalizedContactPhone === debtPhone) {
        return true;
      }

      // 4. Match by currently entered contactName if non-generic
      if (normalizedContactName && !isGenericDebtName && normalizedContactName === debtName) {
        return true;
      }

      return false;
    });
  }, [allPendingDebts, station, allMembers, contactPhone, contactName]);

  // Synchronize applied debts when matching debts are found
  const matchingDebtIdsKey = useMemo(() => matchingDebts.map(d => d.id).sort().join(','), [matchingDebts]);
  useEffect(() => {
    if (matchingDebts.length > 0) {
      setAppliedDebtIds(matchingDebts.map(d => d.id));
    } else {
      setAppliedDebtIds([]);
    }
  }, [matchingDebtIdsKey, isOpen]);

  const handleToggleDebt = (debtId: string) => {
    setAppliedDebtIds(prev => 
      prev.includes(debtId) ? prev.filter(id => id !== debtId) : [...prev, debtId]
    );
  };

  const activeDebts = useMemo(() => {
    return matchingDebts.filter(d => appliedDebtIds.includes(d.id));
  }, [matchingDebts, appliedDebtIds]);

  const debtAdjustmentTotal = useMemo(() => {
    return activeDebts.reduce((sum, d) => {
      return sum + (d.type === 'receivable' ? d.amount : -d.amount);
    }, 0);
  }, [activeDebts]);

  const grossBillTotal = Math.max(0, foodSubtotal + timePackageTotal + (initialPackageInfo?.total || 0) - discount);
  const advanceDeduction = (station?.advancePaid && station.advancePaid > 0) ? station.advancePaid : 0;
  const finalBillTotal = Math.max(0, grossBillTotal - advanceDeduction + debtAdjustmentTotal);
  
  const primaryDebt = activeDebts[0];
  const debtAdjustmentPayload: Bill['debtAdjustment'] | undefined = primaryDebt ? {
    debtId: primaryDebt.id,
    type: primaryDebt.type,
    amount: primaryDebt.type === 'payable' 
      ? Math.min(primaryDebt.amount, Math.max(0, grossBillTotal - advanceDeduction))
      : primaryDebt.amount,
    description: primaryDebt.description || (primaryDebt.type === 'receivable' ? 'Customer Outstanding Due' : 'Customer Credit / Overpayment'),
    settled: true,
  } : undefined;

  const totalPlayersInSession = (station?.members || []).length || 1;
  const billPerMember = finalBillTotal / totalPlayersInSession;

  const realMembersInSession = useMemo(() => {
    if (!station) return [];
    return (station.members || []).filter(m => m.id && !m.id.startsWith('guest-')).map(am => allMembers.find(m => m.id === am.id)).filter(m => !!m) as Member[];
  }, [station, allMembers]);

  const handleUpdateQuantityByIndex = (index: number, delta: number) => {
    if (!station) return;
    const updatedItems = billItems.map((item, i) => i === index ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter(item => item.quantity > 0);
    setBillItems(updatedItems);
    const finalDiscount = Math.max(0, parseFloat(discountInput) || 0);
    onSaveBill(station.id, updatedItems, finalDiscount);
  };

  const handleAddItem = (food: FoodItem) => {
    if (!station) return;
    const existingIndex = billItems.findIndex(i => i.itemId === food.id && i.name === food.name);
    let updatedItems: BillItem[];
    if (existingIndex > -1) { 
        updatedItems = billItems.map((i, idx) => idx === existingIndex ? { ...i, quantity: i.quantity + 1 } : i); 
    }
    else { 
        updatedItems = [...billItems, { itemId: food.id, name: food.name, price: food.price, quantity: 1, addedAt: new Date().toISOString() }]; 
    }
    setBillItems(updatedItems);
    const finalDiscount = Math.max(0, parseFloat(discountInput) || 0);
    onSaveBill(station.id, updatedItems, finalDiscount);
    setSearchTerm('');
    toast({ title: "Item Added" });
  };

  const handleDiscountChange = (val: string) => {
    setDiscountInput(val);
    const num = Math.max(0, parseFloat(val) || 0);
    setDiscount(num);
  };

  const handleDiscountBlur = () => {
    if (!station) return;
    const num = Math.max(0, parseFloat(discountInput) || 0);
    setDiscountInput(String(num));
    onSaveBill(station.id, billItems, num);
  };

  const handleContinueToPayment = () => {
    if (!station) return;
    const finalDiscount = Math.max(0, parseFloat(discountInput) || 0);
    onSaveBill(station.id, billItems, finalDiscount);
    if (realMembersInSession.length > 0) {
      setStep('member-xp');
    } else if (finalBillTotal === 0) {
      handleCheckout('recharge');
    } else {
      setStep('payment-method');
    }
  };

  const handleConfirmRewards = () => {
    if (!station) return;
    const finalDiscount = Math.max(0, parseFloat(discountInput) || 0);
    onSaveBill(station.id, billItems, finalDiscount);
    if (finalBillTotal === 0) {
      handleCheckout('recharge');
    } else {
      setStep('payment-method');
    }
  };

  const filteredFood = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return foodItems.filter(f => f.name.toLowerCase().includes(term)).slice(0, 5);
  }, [foodItems, searchTerm]);

  const handleShareWhatsApp = () => {
    if (!station) return;
    const tempBill: Bill = {
      id: `checkout-${Date.now()}`,
      stationId: station.id,
      stationName: station.name,
      packageName: initialPackageInfo?.name || station.packageName || undefined,
      members: station.members || [],
      items: billItems,
      initialPackagePrice: initialPackageInfo?.total || 0,
      foodSubtotal,
      discount,
      totalAmount: finalBillTotal,
      timestamp: new Date().toISOString(),
      paymentMethod: selectedMethod,
      advancePaid: advanceDeduction,
      debtAdjustment: debtAdjustmentPayload,
    };

    openWhatsAppBillLink(tempBill, contactPhone, contactName);
    toast({
      title: "WhatsApp Opened",
      description: "Bill text pre-filled into WhatsApp chat.",
    });
  };

  const handleSettleDebts = async () => {
    if (!user || activeDebts.length === 0) return;
    const availableBillAmount = Math.max(0, grossBillTotal - advanceDeduction);

    for (const debt of activeDebts) {
      try {
        if (debt.type === 'receivable') {
          await clearDebt(debt.id, user);
        } else if (debt.type === 'payable') {
          if (debt.amount <= availableBillAmount) {
            await clearDebt(debt.id, user);
          } else {
            const remainingCredit = debt.amount - availableBillAmount;
            const dbInstance = getFirestore();
            await updateDoc(doc(dbInstance, 'debts', debt.id), {
              amount: remainingCredit,
              updatedAt: new Date().toISOString()
            });
          }
        }
      } catch (err) {
        console.error('Error settling debt:', err);
      }
    }
  };

  const handleCheckout = async (method: PaymentMethod, cash?: number, upi?: number) => {
    if (!station || isClosing) return;
    setIsClosing(true);
    playCoinSound();
    await handleSettleDebts();
    onConfirmCheckout(
      station.id, 
      finalBillTotal, 
      billItems, 
      discount, 
      method, 
      cash, 
      upi, 
      initialPackageInfo?.isNewRechargePurchase, 
      initialPackageInfo?.purePackage,
      debtAdjustmentPayload
    );
  };

  const handlePendingConfirm = async () => {
    if (!station || !user || isClosing) return;
    setIsClosing(true);
    const paid = parseFloat(paidNow) || 0;
    const diff = finalBillTotal - paid;
    
    // First clear old settled debts so balance isn't double-recorded
    await handleSettleDebts();

    if (diff > 0) {
      await recordDebt({ 
        type: 'receivable', 
        contactName, 
        contactPhone, 
        amount: diff, 
        originalAmount: finalBillTotal, 
        description: `Pending for ${station.name}`, 
        memberId: ((station.members || [])[0]?.id && (station.members || [])[0]?.id.startsWith('guest-')) ? undefined : (station.members || [])[0]?.id 
      }, user);
    } else if (diff < 0) {
      await recordDebt({ 
        type: 'payable', 
        contactName, 
        contactPhone, 
        amount: Math.abs(diff), 
        originalAmount: finalBillTotal, 
        description: `Overpayment change for ${station.name}`, 
        memberId: ((station.members || [])[0]?.id && (station.members || [])[0]?.id.startsWith('guest-')) ? undefined : (station.members || [])[0]?.id 
      }, user);
    }

    onConfirmCheckout(
      station.id, 
      finalBillTotal, 
      billItems, 
      discount, 
      'pending', 
      paid, 
      0, 
      initialPackageInfo?.isNewRechargePurchase, 
      initialPackageInfo?.purePackage,
      debtAdjustmentPayload
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isClosing && onOpenChange(open)}>
        <DialogContent showClose={false} className="w-full h-[92dvh] sm:h-[88vh] max-h-[92dvh] sm:max-h-[88vh] max-w-full sm:max-w-lg rounded-none sm:rounded-xl flex flex-col sm:flex-col p-0 gap-0 overflow-hidden border-0 sm:border-2 sm:border-primary/30 shadow-2xl">
            <DialogHeader className="px-4 py-3 sm:px-6 sm:pt-5 shrink-0 bg-background border-b flex flex-row items-center justify-between space-y-0">
                <DialogTitle className="flex items-center gap-2 font-display tracking-tight text-base sm:text-xl min-w-0 pr-2">
                    {step === 'review-bill' && <><Receipt className="h-5 w-5 text-primary shrink-0" /> <span className="truncate">BILL REVIEW: {station?.name}</span></>}
                    {step === 'member-xp' && <><Star className="h-5 w-5 text-yellow-500 shrink-0" /> <span className="truncate">BITS EARNED</span></>}
                    {step === 'payment-method' && <><Banknote className="h-5 w-5 text-primary shrink-0" /> <span className="truncate">CHECKOUT</span></>}
                    {step === 'split-details' && <><Layers className="h-5 w-5 text-amber-500 shrink-0" /> <span className="truncate">SPLIT PAYMENT</span></>}
                    {step === 'pending-details' && <><FileWarning className="h-5 w-5 text-destructive shrink-0" /> <span className="truncate">RECORD PENDING</span></>}
                    {step === 'checkout-success' && <><CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" /> <span className="truncate">CHECKOUT COMPLETE</span></>}
                </DialogTitle>
                <button
                    onClick={() => !isClosing && onOpenChange(false)}
                    className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted/80 active:scale-95 transition-colors text-muted-foreground hover:text-foreground shrink-0"
                    aria-label="Close dialog"
                >
                    <X className="h-4 w-4" />
                </button>
            </DialogHeader>

            <ScrollArea className="flex-1 min-h-0 bg-muted/5">
                {step === 'review-bill' && (
                    <div className="space-y-4 p-4 sm:p-6 pb-6">
                        <div className={cn("text-center p-3 sm:p-4 rounded-xl border-2 border-dashed transition-all", finalBillTotal === 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-primary/5 border-primary/20")}>
                            <p className="text-xs sm:text-sm font-bold uppercase tracking-normal opacity-50 mb-0.5">{finalBillTotal === 0 ? "RECHARGE / CREDIT SETTLEMENT" : "FINAL AMOUNT DUE"}</p>
                            <p className={cn("text-3xl sm:text-5xl font-bold font-mono tracking-tight", finalBillTotal === 0 ? "text-emerald-600" : "text-primary")}>₹{finalBillTotal.toLocaleString()}</p>
                            {finalBillTotal === 0 && <div className="flex items-center justify-center gap-1 mt-1 text-xs sm:text-sm font-bold uppercase text-emerald-600 tracking-normal"><CheckCircle2 className="h-3 w-3" />Balance Covered</div>}
                        </div>

                        {matchingDebts.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-normal text-muted-foreground flex items-center gap-1.5 pl-1">
                                    <Coins className="h-3.5 w-3.5 text-primary" /> Outstanding Balance
                                </h3>
                                <div className="space-y-2">
                                    {matchingDebts.map(debt => {
                                        const isApplied = appliedDebtIds.includes(debt.id);
                                        const isReceivable = debt.type === 'receivable';
                                        return (
                                            <div 
                                                key={debt.id} 
                                                className={cn(
                                                    "p-3 rounded-xl border-2 transition-all flex items-center justify-between gap-3 shadow-xs",
                                                    isApplied 
                                                        ? (isReceivable ? "bg-amber-500/10 border-amber-500/40 dark:bg-amber-950/20" : "bg-emerald-500/10 border-emerald-500/40 dark:bg-emerald-950/20")
                                                        : "bg-card/50 border-muted opacity-60"
                                                )}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                    <div className={cn(
                                                        "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border",
                                                        isReceivable ? "bg-amber-500/20 text-amber-600 border-amber-500/30" : "bg-emerald-500/20 text-emerald-600 border-emerald-500/30"
                                                    )}>
                                                        {isReceivable ? <FileWarning className="h-4.5 w-4.5" /> : <Coins className="h-4.5 w-4.5" />}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-extrabold text-xs sm:text-sm uppercase tracking-tight text-foreground truncate">
                                                                {isReceivable ? `Owes Bistro (Due)` : `Bistro Owes Customer (Credit)`}
                                                            </span>
                                                            <Badge 
                                                                variant="outline" 
                                                                className={cn(
                                                                    "font-mono font-bold text-xs h-5 px-1.5 shrink-0",
                                                                    isReceivable 
                                                                        ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40" 
                                                                        : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                                                                )}
                                                            >
                                                                {isReceivable ? `+₹${debt.amount.toLocaleString()}` : `-₹${debt.amount.toLocaleString()}`}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                                            {debt.contactName} {debt.contactPhone ? `(${debt.contactPhone})` : ''} • {debt.description || 'Previous session balance'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={isApplied ? "default" : "outline"}
                                                    onClick={() => handleToggleDebt(debt.id)}
                                                    className={cn(
                                                        "h-8 px-3 text-xs font-bold uppercase shrink-0 transition-all active:scale-95",
                                                        isApplied
                                                            ? (isReceivable ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600" : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600")
                                                            : "hover:border-primary"
                                                    )}
                                                >
                                                    {isApplied ? (
                                                        <span className="flex items-center gap-1">
                                                            <Check className="h-3.5 w-3.5" /> {isReceivable ? 'Added' : 'Deducted'}
                                                        </span>
                                                    ) : (
                                                        <span>{isReceivable ? '+ Add to Bill' : '- Deduct Credit'}</span>
                                                    )}
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-normal text-muted-foreground flex items-center gap-1.5 pl-1"><ShoppingBag className="h-3 w-3" />Bill Auditor</h3>
                            <div className="space-y-1.5">
                                {initialPackageInfo && (
                                    <div className="flex justify-between items-center p-2.5 rounded-xl bg-card border-2 shadow-xs animate-in fade-in duration-300 gap-2">
                                        <div className="min-w-0 flex-1"><p className="font-bold text-xs sm:text-sm uppercase truncate flex items-center gap-1.5">{initialPackageInfo.name}{initialPackageInfo.isExistingRecharge && <Badge variant="outline" className="text-[10px] sm:text-xs h-4 bg-yellow-500/10 text-yellow-600 border-yellow-500/20 shrink-0">PREPAID</Badge>}</p><p className="text-xs font-bold text-muted-foreground uppercase">Session Package</p></div>
                                        <span className="font-mono font-bold text-xs sm:text-sm text-foreground shrink-0">₹{initialPackageInfo.total.toLocaleString()}</span>
                                    </div>
                                )}
                                {billItems.map((item, idx) => (
                                    <div key={`${item.itemId}-${idx}`} className="flex justify-between items-center p-2.5 sm:p-3 rounded-xl bg-card border-2 shadow-xs animate-in slide-in-from-right-2 duration-300 group gap-2 overflow-hidden">
                                        <div className="min-w-0 flex-1 pr-1"><p className="font-bold text-xs sm:text-sm uppercase truncate leading-tight">{item.name}</p><p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase">₹{item.price} / unit</p></div>
                                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                            <div className="flex items-center bg-muted/40 rounded-lg p-0.5 border">
                                                <button 
                                                    onClick={() => handleUpdateQuantityByIndex(idx, -1)} 
                                                    className="h-7 w-7 sm:h-7 sm:w-7 flex items-center justify-center rounded-md bg-muted/80 hover:bg-destructive hover:text-white active:scale-95 transition-colors shrink-0"
                                                    aria-label="Decrease quantity"
                                                >
                                                    <Minus className="h-3.5 w-3.5 sm:h-3 sm:w-3"/>
                                                </button>
                                                <span className="w-6 sm:w-7 text-center font-bold text-xs sm:text-sm font-mono shrink-0">{item.quantity}</span>
                                                <button 
                                                    onClick={() => handleUpdateQuantityByIndex(idx, 1)} 
                                                    className="h-7 w-7 sm:h-7 sm:w-7 flex items-center justify-center rounded-md bg-primary/20 hover:bg-primary hover:text-white active:scale-95 transition-colors shrink-0"
                                                    aria-label="Increase quantity"
                                                >
                                                    <Plus className="h-3.5 w-3.5 sm:h-3 sm:w-3"/>
                                                </button>
                                            </div>
                                            <div className="text-right min-w-[44px] sm:min-w-[56px] shrink-0"><p className="font-mono font-bold text-xs sm:text-sm text-primary">₹{(item.price * item.quantity).toLocaleString()}</p></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="relative mt-3">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input placeholder="QUICK ADD FOOD/DRINKS..." className="h-10 pl-8 border-2 border-dashed font-bold uppercase text-xs sm:text-sm tracking-normal bg-background" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                {filteredFood.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-card border-2 rounded-lg shadow-2xl z-50 overflow-hidden divide-y">{filteredFood.map(food => <button key={food.id} onClick={() => handleAddItem(food)} className="w-full p-2.5 text-left hover:bg-primary/5 flex justify-between items-center transition-colors"><span className="font-bold text-xs sm:text-sm uppercase">{food.name}</span><span className="font-mono font-bold text-xs sm:text-sm text-primary">₹{food.price}</span></button>)}</div>}
                            </div>
                            <div className="pt-3 border-t border-dashed mt-3 space-y-2">
                                <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-destructive/5 border-2 border-destructive/20 gap-2 overflow-hidden">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1"><Tag className="h-3.5 w-3.5 text-destructive shrink-0" /><Label className="text-xs sm:text-sm font-bold uppercase tracking-normal text-destructive truncate">Discount</Label></div>
                                    <div className="relative w-24 sm:w-28 shrink-0"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-xs sm:text-sm text-destructive pointer-events-none">₹</span><Input type="number" min="0" value={discountInput} onChange={e => handleDiscountChange(e.target.value)} onBlur={handleDiscountBlur} className="h-8 pl-6 pr-2 text-right font-mono font-bold text-xs sm:text-sm text-destructive border-destructive/30 focus-visible:ring-destructive bg-background [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0" /></div>
                                </div>
                                {advanceDeduction > 0 && (
                                    <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/30 gap-2 overflow-hidden">
                                        <div className="flex items-center gap-1.5 min-w-0 flex-1"><Coins className="h-4 w-4 text-emerald-500 shrink-0" /><span className="text-xs sm:text-sm font-bold uppercase text-emerald-600 truncate">Advance Paid (Deducted)</span></div>
                                        <span className="font-mono font-bold text-xs sm:text-sm text-emerald-600 shrink-0">-₹{advanceDeduction.toLocaleString()}</span>
                                    </div>
                                )}
                                {activeDebts.map(d => (
                                    <div key={d.id} className={cn(
                                        "flex items-center justify-between p-2.5 sm:p-3 rounded-xl border-2 gap-2 overflow-hidden animate-in fade-in duration-200",
                                        d.type === 'receivable' ? "bg-amber-500/10 border-amber-500/30" : "bg-emerald-500/10 border-emerald-500/30"
                                    )}>
                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                            {d.type === 'receivable' ? <FileWarning className="h-4 w-4 text-amber-600 shrink-0" /> : <Coins className="h-4 w-4 text-emerald-600 shrink-0" />}
                                            <span className={cn("text-xs sm:text-sm font-bold uppercase truncate", d.type === 'receivable' ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300")}>
                                                {d.type === 'receivable' ? `Previous Due Settled (${d.contactName})` : `Credit Deducted (${d.contactName})`}
                                            </span>
                                        </div>
                                        <span className={cn("font-mono font-bold text-xs sm:text-sm shrink-0", d.type === 'receivable' ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300")}>
                                            {d.type === 'receivable' ? `+₹${d.amount.toLocaleString()}` : `-₹${d.amount.toLocaleString()}`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                {step === 'member-xp' && (
                    <div className="space-y-3 p-4 sm:p-6">
                        <div className="rounded-xl border-2 border-dashed bg-green-500/5 p-3 space-y-2">
                            {realMembersInSession.map((member, idx) => {
                                const assignedMember = (station?.members || []).find(sm => sm.id === member.id);
                                const isProvidingRecharge = !!assignedMember?.rechargeId;
                                const isPurchaser = idx === 0 && initialPackageInfo?.isNewRechargePurchase;
                                const currentBalanceSeconds = (member.recharges || []).filter(r => new Date(r.expiryDate) > new Date() && r.remainingDuration > 0).reduce((sum, r) => sum + r.remainingDuration, 0);
                                const newPackDuration = isPurchaser ? (initialPackageInfo?.purePackage?.duration || 0) : 0;
                                const totalGroupManSeconds = playedSecondsPerPlayer * (station?.members || []).length;
                                const deduction = (isProvidingRecharge || isPurchaser) ? totalGroupManSeconds : 0;
                                const previewBalance = Math.max(0, (currentBalanceSeconds + newPackDuration) - deduction);
                                const hasAnyBalanceContext = currentBalanceSeconds > 0 || isPurchaser;
                                return (
                                    <div key={member.id} className="flex flex-col bg-card p-3 rounded-lg border-2 gap-2 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarImage src={member.avatarUrl} /><AvatarFallback>{member.name[0]}</AvatarFallback></Avatar>
                                                <div className="text-left"><p className="font-bold text-sm uppercase">{member.name}</p><Badge variant="outline" className={cn("text-sm h-3.5 uppercase font-bold", tierColors[member.tier])}>{member.tier} Tier</Badge></div>
                                            </div>
                                            <div className="text-right"><p className="text-sm font-mono opacity-50 font-bold">₹{billPerMember.toFixed(0)} SHARE</p><div className="flex items-center gap-1 text-green-600 font-bold text-sm"><Star className="h-2.5 w-2.5 fill-current" /><span>+{Math.floor((billPerMember / 10) * (tierMultipliers[member.tier] || 1))} BITS</span></div></div>
                                        </div>
                                        {hasAnyBalanceContext && <div className="flex items-center justify-between pt-2 border-t-2 border-dashed border-muted"><span className="text-sm font-bold uppercase text-muted-foreground tracking-normal flex items-center gap-1"><Zap className="h-2.5 w-2.5 text-yellow-500 fill-current" />Balance</span><span className="text-sm font-bold text-primary font-mono">{formatBalance(previewBalance)}</span></div>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                {step === 'payment-method' && (
                    <div className="space-y-4 p-4 sm:p-6 my-2">
                        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                            <Button 
                                type="button"
                                variant="outline" 
                                className={cn(
                                    "h-20 sm:h-24 flex flex-col gap-1 text-sm sm:text-base font-bold border-2 transition-all relative uppercase tracking-tight active:scale-95",
                                    selectedMethod === 'cash' ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 ring-2 ring-emerald-500/20" : "hover:border-emerald-500"
                                )} 
                                onClick={() => setSelectedMethod('cash')}
                            >
                                {selectedMethod === 'cash' && (
                                    <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-0.5 shadow-xs">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                    </div>
                                )}
                                <Banknote className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-600" /> Cash
                            </Button>
                            
                            <Button 
                                type="button"
                                variant="outline" 
                                className={cn(
                                    "h-20 sm:h-24 flex flex-col gap-1 text-sm sm:text-base font-bold border-2 transition-all relative uppercase tracking-tight active:scale-95",
                                    selectedMethod === 'upi' ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" : "hover:border-primary"
                                )} 
                                onClick={() => setSelectedMethod('upi')}
                            >
                                {selectedMethod === 'upi' && (
                                    <div className="absolute top-2 right-2 bg-primary text-white rounded-full p-0.5 shadow-xs">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                    </div>
                                )}
                                <Smartphone className="h-6 w-6 sm:h-8 sm:w-8 text-primary" /> UPI
                            </Button>

                            <Button 
                                type="button"
                                variant="outline" 
                                className={cn(
                                    "h-20 sm:h-24 flex flex-col gap-1 text-sm sm:text-base font-bold border-2 transition-all relative uppercase tracking-tight active:scale-95",
                                    selectedMethod === 'district-dinein' ? "border-amber-500 bg-amber-500/10 text-amber-600 ring-2 ring-amber-500/20" : "hover:border-amber-500"
                                )} 
                                onClick={() => setSelectedMethod('district-dinein')}
                            >
                                {selectedMethod === 'district-dinein' && (
                                    <div className="absolute top-2 right-2 bg-amber-500 text-white rounded-full p-0.5 shadow-xs">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                    </div>
                                )}
                                <MapPin className="h-6 w-6 sm:h-8 sm:w-8 text-amber-500" /> District
                            </Button>

                            <div className="grid grid-cols-2 gap-2">
                                <Button 
                                    type="button"
                                    variant="outline" 
                                    className="h-20 sm:h-24 flex flex-col items-center justify-center gap-1 font-bold uppercase border-dashed border-2 text-xs sm:text-sm active:scale-95 transition-all p-1" 
                                    onClick={() => {
                                        setStep('split-details');
                                        const cashVal = parseFloat(splitCash) || 0;
                                        const upiVal = parseFloat(splitUpi) || 0;
                                        if (cashVal === 0 && upiVal === 0) {
                                            const half = Math.floor(finalBillTotal / 2);
                                            setSplitCash(half.toString());
                                            setSplitUpi((finalBillTotal - half).toString());
                                        }
                                    }}
                                >
                                    <Layers className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" /> Split
                                </Button>
                                <Button 
                                    type="button"
                                    variant="outline" 
                                    className="h-20 sm:h-24 flex flex-col items-center justify-center gap-1 font-bold uppercase border-dashed border-2 text-xs sm:text-sm active:scale-95 transition-all p-1" 
                                    onClick={() => setStep('pending-details')}
                                >
                                    <FileWarning className="h-5 w-5 sm:h-6 sm:w-6 text-destructive" /> Pending
                                </Button>
                            </div>
                        </div>

                        {/* Integrated WhatsApp Section under options */}
                        <div className="bg-card border-2 rounded-xl p-3.5 space-y-3 shadow-xs">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-extrabold uppercase tracking-tight flex items-center gap-1.5 text-emerald-600">
                                    <MessageSquare className="h-4 w-4 text-emerald-600" /> Would you like your bill on WhatsApp?
                                </Label>
                                <div className="flex items-center gap-1">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setWantWhatsAppBill(true)}
                                        className={cn(
                                            "h-7 px-3 text-[11px] font-extrabold uppercase rounded-md border-2 transition-all",
                                            wantWhatsAppBill === true
                                                ? "bg-emerald-500 text-black border-emerald-500 shadow-xs"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        YES
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setWantWhatsAppBill(false);
                                            setContactPhone('');
                                        }}
                                        className={cn(
                                            "h-7 px-3 text-[11px] font-extrabold uppercase rounded-md border-2 transition-all",
                                            wantWhatsAppBill === false
                                                ? "bg-zinc-800 text-white border-zinc-700"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        NO
                                    </Button>
                                </div>
                            </div>

                            {wantWhatsAppBill !== false && (
                                <div className="flex items-center gap-2 animate-in fade-in duration-200">
                                    <div className="relative flex-1">
                                        <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input 
                                            placeholder="Enter 10-digit Mobile Number..." 
                                            value={contactPhone} 
                                            onChange={e => {
                                                setContactPhone(e.target.value);
                                                if (wantWhatsAppBill === null) setWantWhatsAppBill(true);
                                            }} 
                                            className="h-9 pl-8 font-mono text-xs border-2 bg-background" 
                                        />
                                    </div>
                                    <Button 
                                        type="button" 
                                        onClick={handleShareWhatsApp} 
                                        disabled={!contactPhone.trim()}
                                        variant="outline" 
                                        className="h-9 px-3 border-2 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 font-bold uppercase text-xs gap-1.5 shrink-0"
                                    >
                                        <Send className="h-3.5 w-3.5 text-emerald-600" /> Send Bill
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {step === 'split-details' && (
                    <div className="space-y-4 p-4 sm:p-6">
                        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-xl p-4 text-center space-y-1">
                            <p className="text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">Total Bill to Split</p>
                            <p className="text-3xl font-extrabold font-mono text-foreground">₹{finalBillTotal.toLocaleString()}</p>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-card border-2 p-4 rounded-xl space-y-2 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-extrabold uppercase tracking-tight flex items-center gap-1.5 text-emerald-600">
                                        <Banknote className="h-4 w-4 text-emerald-600" /> Cash Amount (₹)
                                    </Label>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 text-[10px] font-bold uppercase text-muted-foreground hover:text-emerald-600"
                                        onClick={() => {
                                            const upiVal = parseFloat(splitUpi) || 0;
                                            setSplitCash(Math.max(0, finalBillTotal - upiVal).toString());
                                        }}
                                    >
                                        Auto-Fill Remainder
                                    </Button>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-base text-muted-foreground">₹</span>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="any"
                                        placeholder="0"
                                        value={splitCash}
                                        onChange={(e) => setSplitCash(e.target.value)}
                                        className="h-11 pl-8 font-mono text-lg font-bold border-2 bg-background focus-visible:ring-emerald-500"
                                    />
                                </div>
                            </div>

                            <div className="bg-card border-2 p-4 rounded-xl space-y-2 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-extrabold uppercase tracking-tight flex items-center gap-1.5 text-primary">
                                        <Smartphone className="h-4 w-4 text-primary" /> UPI Amount (₹)
                                    </Label>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 text-[10px] font-bold uppercase text-muted-foreground hover:text-primary"
                                        onClick={() => {
                                            const cashVal = parseFloat(splitCash) || 0;
                                            setSplitUpi(Math.max(0, finalBillTotal - cashVal).toString());
                                        }}
                                    >
                                        Auto-Fill Remainder
                                    </Button>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-base text-muted-foreground">₹</span>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="any"
                                        placeholder="0"
                                        value={splitUpi}
                                        onChange={(e) => setSplitUpi(e.target.value)}
                                        className="h-11 pl-8 font-mono text-lg font-bold border-2 bg-background focus-visible:ring-primary"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 h-8 text-xs font-bold uppercase border-dashed"
                                    onClick={() => {
                                        const half = Math.floor(finalBillTotal / 2);
                                        setSplitCash(half.toString());
                                        setSplitUpi((finalBillTotal - half).toString());
                                    }}
                                >
                                    50 / 50 Split
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 h-8 text-xs font-bold uppercase border-dashed"
                                    onClick={() => {
                                        setSplitCash(finalBillTotal.toString());
                                        setSplitUpi('0');
                                    }}
                                >
                                    100% Cash
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 h-8 text-xs font-bold uppercase border-dashed"
                                    onClick={() => {
                                        setSplitCash('0');
                                        setSplitUpi(finalBillTotal.toString());
                                    }}
                                >
                                    100% UPI
                                </Button>
                            </div>

                            {(() => {
                                const cashVal = parseFloat(splitCash) || 0;
                                const upiVal = parseFloat(splitUpi) || 0;
                                const splitSum = cashVal + upiVal;
                                const diff = Math.round((finalBillTotal - splitSum) * 100) / 100;

                                if (Math.abs(diff) <= 0.1) {
                                    return (
                                        <div className="p-3 rounded-lg bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                                            <span>Split amounts match total bill (₹{finalBillTotal.toLocaleString()})</span>
                                        </div>
                                    );
                                } else if (diff > 0) {
                                    return (
                                        <div className="p-3 rounded-lg bg-amber-500/10 border-2 border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center justify-between">
                                            <span className="flex items-center gap-2">
                                                <FileWarning className="h-4 w-4 shrink-0" />
                                                Remaining to allocate: ₹{diff.toLocaleString()}
                                            </span>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="link"
                                                className="h-auto p-0 text-xs font-extrabold underline text-amber-600 dark:text-amber-400"
                                                onClick={() => setSplitUpi((upiVal + diff).toString())}
                                            >
                                                Add to UPI
                                            </Button>
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div className="p-3 rounded-lg bg-destructive/10 border-2 border-destructive/30 text-destructive text-xs font-bold flex items-center gap-2">
                                            <FileWarning className="h-4 w-4 shrink-0" />
                                            <span>Total split (₹{splitSum.toLocaleString()}) exceeds bill by ₹{Math.abs(diff).toLocaleString()}</span>
                                        </div>
                                    );
                                }
                            })()}
                        </div>
                    </div>
                )}
                {step === 'pending-details' && (
                    <div className="space-y-4 p-4 sm:p-6">
                        <div className="bg-destructive/10 border-2 border-destructive/30 rounded-xl p-4 text-center space-y-1">
                            <p className="text-xs font-bold uppercase tracking-wide text-destructive">Total Bill Due</p>
                            <p className="text-3xl font-extrabold font-mono text-foreground">₹{finalBillTotal.toLocaleString()}</p>
                        </div>

                        <div className="space-y-3 bg-card border-2 p-4 rounded-xl shadow-xs">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-extrabold uppercase tracking-tight text-muted-foreground">
                                    Customer Name
                                </Label>
                                <Input
                                    placeholder="Enter customer name..."
                                    value={contactName}
                                    onChange={(e) => setContactName(e.target.value)}
                                    className="h-10 text-sm font-bold border-2 bg-background"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-extrabold uppercase tracking-tight text-muted-foreground">
                                    Mobile Number
                                </Label>
                                <div className="relative">
                                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Enter 10-digit phone number..."
                                        value={contactPhone}
                                        onChange={(e) => setContactPhone(e.target.value)}
                                        className="h-10 pl-8 font-mono text-sm font-bold border-2 bg-background"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 pt-2 border-t border-dashed">
                                <Label className="text-xs font-extrabold uppercase tracking-tight text-emerald-600 flex items-center gap-1.5">
                                    <Banknote className="h-4 w-4 text-emerald-600" /> Amount Paid Now (₹)
                                </Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-base text-muted-foreground">₹</span>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="any"
                                        placeholder="0"
                                        value={paidNow}
                                        onChange={(e) => setPaidNow(e.target.value)}
                                        className="h-11 pl-8 font-mono text-lg font-bold border-2 bg-background focus-visible:ring-emerald-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {(() => {
                            const paid = parseFloat(paidNow) || 0;
                            const diff = finalBillTotal - paid;
                            return (
                                <div className={cn(
                                    "p-3 rounded-lg border-2 text-xs font-bold flex items-center justify-between",
                                    diff > 0 ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                                )}>
                                    <span>
                                        {diff > 0 ? `Pending Debt to Record: ₹${diff.toLocaleString()}` : diff < 0 ? `Overpayment / Change: ₹${Math.abs(diff).toLocaleString()}` : 'Fully Paid'}
                                    </span>
                                </div>
                            );
                        })()}
                    </div>
                )}
            </ScrollArea>

            <DialogFooter className="px-4 py-3 sm:py-3.5 pb-3 sm:pb-3.5 pb-safe border-t bg-muted/10 shrink-0">
                {step === 'review-bill' && <Button disabled={isClosing} onClick={handleContinueToPayment} className="w-full h-12 font-display text-sm uppercase tracking-normal shadow-xl active:scale-[0.99]">{finalBillTotal === 0 && realMembersInSession.length === 0 ? 'SETTLE & CLOSE' : 'CONTINUE TO PAYMENT'} <ChevronRight className="ml-1.5 h-4 w-4" /></Button>}
                {step === 'member-xp' && <Button disabled={isClosing} onClick={handleConfirmRewards} className="w-full h-12 font-display text-sm uppercase tracking-normal shadow-xl active:scale-[0.99]">{finalBillTotal === 0 ? 'COMPLETE SETTLEMENT' : 'CONFIRM REWARDS & PAY'} <ChevronRight className="ml-1.5 h-4 w-4" /></Button>}
                {step === 'payment-method' && (
                    <div className="flex items-center gap-2 w-full">
                        <Button variant="ghost" disabled={isClosing} onClick={() => setStep('review-bill')} className="h-12 px-3 font-bold uppercase text-xs sm:text-sm tracking-normal">
                            <ArrowLeft className="mr-1 h-4 w-4" /> REVIEW
                        </Button>
                        <Button 
                            disabled={!selectedMethod || isClosing} 
                            onClick={() => handleCheckout(selectedMethod)} 
                            className="flex-1 h-14 sm:h-12 font-bold uppercase tracking-tight text-sm sm:text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl gap-2 active:scale-[0.99]"
                        >
                            <CheckCircle2 className="h-5 w-5" /> CONFIRM & CLOSE SESSION
                        </Button>
                    </div>
                )}
                {step === 'split-details' && (
                    <div className="flex items-center gap-2 w-full">
                        <Button variant="ghost" disabled={isClosing} onClick={() => setStep('payment-method')} className="h-14 sm:h-12 px-4 font-bold uppercase text-xs sm:text-sm tracking-normal">
                            <ArrowLeft className="mr-1 h-4 w-4" /> BACK
                        </Button>
                        <Button onClick={() => handleCheckout('split', parseFloat(splitCash), parseFloat(splitUpi))} disabled={isClosing || Math.abs((parseFloat(splitCash)||0) + (parseFloat(splitUpi)||0) - finalBillTotal) > 0.1} className="flex-1 h-14 sm:h-12 font-bold uppercase tracking-tight text-sm sm:text-base bg-primary shadow-xl">FINALIZE SPLIT</Button>
                    </div>
                )}
                {step === 'pending-details' && (
                    <div className="flex items-center gap-2 w-full">
                        <Button variant="ghost" disabled={isClosing} onClick={() => setStep('payment-method')} className="h-14 sm:h-12 px-4 font-bold uppercase text-xs sm:text-sm tracking-normal">
                            <ArrowLeft className="mr-1 h-4 w-4" /> BACK
                        </Button>
                        <Button onClick={handlePendingConfirm} disabled={isClosing} className="flex-1 h-14 sm:h-12 font-bold uppercase tracking-tight text-sm sm:text-base bg-destructive shadow-xl">SAVE DEBT & CLOSE</Button>
                    </div>
                )}
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
