
'use client';
import { useMemo, useState, useEffect } from 'react';
import type { Station, GamingPackage, Member, MemberTier, BillItem, PaymentMethod, FoodItem } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Star, Receipt, Banknote, Smartphone, ArrowLeft, Layers, Tag, ChevronRight, FileWarning, Zap, Phone, Clock, CheckCircle2, Search, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { settings } from '@/lib/data';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { recordDebt } from '@/firebase/firestore/debts';
import { useAuth } from '@/firebase/auth/use-user';

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
    rechargePkg?: GamingPackage
  ) => void;
  onSaveBill: (stationId: string, newBill: BillItem[], newDiscount: number) => void;
  allMembers: Member[];
  foodItems: FoodItem[];
}

const tierMultipliers: Record<MemberTier, number> = { Red: 1, Green: 1.5, Gold: 2 };
const tierColors: Record<MemberTier, string> = { Red: 'bg-red-500/20 text-red-500 border-red-500/50', Green: 'bg-green-500/20 text-green-500 border-green-500/50', Gold: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50' };

type CheckoutStep = 'review-bill' | 'member-xp' | 'payment-method' | 'split-details' | 'pending-details';

export function CheckoutModal({ isOpen, onOpenChange, station, gamingPackages, onConfirmCheckout, onSaveBill, allMembers, foodItems }: CheckoutModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<CheckoutStep>('review-bill');
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [splitCash, setSplitCash] = useState<string>('');
  const [splitUpi, setSplitUpi] = useState<string>('');
  const [paidNow, setPaidNow] = useState<string>('0');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [contactName, setContactName] = useState<string>('');
  const [isClosing, setIsClosing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen && station) {
        setBillItems(station.currentBill || []);
        setDiscount(station.discount || 0);
        setStep('review-bill');
        setIsClosing(false);
        setSearchTerm('');
        if (station.members.length > 0) {
            setContactName(station.members[0].name);
            const member = allMembers.find(m => m.id && m.id === station.members[0].id);
            setContactPhone(member?.phone || '');
        }
    }
  }, [isOpen, station, allMembers]);

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
    const hasItemizedSessionItems = billItems.some(i => {
        const nameLower = i.name.toLowerCase();
        return (station.members.some(m => nameLower.includes(`(${m.name.toLowerCase()})`)) || nameLower.startsWith('time:') || nameLower.startsWith('buy recharge:') || nameLower.startsWith('recharge:'));
    });
    if (hasItemizedSessionItems) return null;
    if (billItems.some(i => i.name === station.packageName)) return null;
    const isRechargeUsed = station.packageName.toLowerCase().startsWith('recharge: ');
    const isRechargeBought = station.packageName.toLowerCase().startsWith('buy recharge: ');
    const pureName = station.packageName.replace(/^(Recharge: |Buy Recharge: )/i, '').trim();
    const pkg = gamingPackages.find(p => p.name.toLowerCase().trim() === pureName.toLowerCase());
    const price = isRechargeUsed ? 0 : (pkg?.price || 0);
    const playerCount = station.members.length > 0 ? station.members.length : 1;
    return { name: station.packageName, purePackage: pkg, total: price * playerCount, isExistingRecharge: isRechargeUsed, isNewRechargePurchase: isRechargeBought };
  }, [station, gamingPackages, billItems]);

  const playedSecondsPerPlayer = useMemo(() => {
    if (!station || !station.startTime || !station.endTime) return 0;
    const totalSessionSeconds = Math.floor((new Date(station.endTime).getTime() - new Date(station.startTime).getTime()) / 1000);
    let remainingSecondsOnTimer = 0;
    if (station.status === 'paused' && station.remainingTimeOnPause != null) { remainingSecondsOnTimer = station.remainingTimeOnPause; }
    else { const end = new Date(station.endTime).getTime(); remainingSecondsOnTimer = Math.max(0, Math.floor((end - Date.now()) / 1000)); }
    return Math.max(0, totalSessionSeconds - remainingSecondsOnTimer);
  }, [station]);

  const finalBillTotal = Math.max(0, foodSubtotal + timePackageTotal + (initialPackageInfo?.total || 0) - discount);
  
  const totalPlayersInSession = station?.members.length || 1;
  const billPerMember = finalBillTotal / totalPlayersInSession;

  const realMembersInSession = useMemo(() => {
    if (!station) return [];
    return station.members.filter(m => m.id && !m.id.startsWith('guest-')).map(am => allMembers.find(m => m.id === am.id)).filter(m => !!m) as Member[];
  }, [station, allMembers]);

  const handleUpdateQuantityByIndex = (index: number, delta: number) => {
    if (!station) return;
    const updatedItems = billItems.map((item, i) => i === index ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter(item => item.quantity > 0);
    setBillItems(updatedItems);
    onSaveBill(station.id, updatedItems, discount);
  };

  const handleAddItem = (food: FoodItem) => {
    if (!station) return;
    // FIX: Check both ID and Name to avoid merging per-player session entries
    const existingIndex = billItems.findIndex(i => i.itemId === food.id && i.name === food.name);
    let updatedItems: BillItem[];
    if (existingIndex > -1) { 
        updatedItems = billItems.map((i, idx) => idx === existingIndex ? { ...i, quantity: i.quantity + 1 } : i); 
    }
    else { 
        updatedItems = [...billItems, { itemId: food.id, name: food.name, price: food.price, quantity: 1, addedAt: new Date().toISOString() }]; 
    }
    setBillItems(updatedItems);
    onSaveBill(station.id, updatedItems, discount);
    setSearchTerm('');
    toast({ title: "Item Added" });
  };

  const handleDiscountChange = (val: string) => {
    if (!station) return;
    const num = Math.max(0, parseFloat(val) || 0);
    setDiscount(num);
    onSaveBill(station.id, billItems, num);
  };

  const filteredFood = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return foodItems.filter(f => f.name.toLowerCase().includes(term)).slice(0, 5);
  }, [foodItems, searchTerm]);

  const handleCheckout = (method: PaymentMethod, cash?: number, upi?: number) => {
    if (!station || isClosing) return;
    setIsClosing(true);
    onConfirmCheckout(station.id, finalBillTotal, billItems, discount, method, cash, upi, initialPackageInfo?.isNewRechargePurchase, initialPackageInfo?.purePackage);
  };

  const handlePendingConfirm = async () => {
    if (!station || !user || isClosing) return;
    setIsClosing(true);
    const paid = parseFloat(paidNow) || 0;
    const diff = finalBillTotal - paid;
    
    if (diff > 0) {
      await recordDebt({ 
        type: 'receivable', 
        contactName, 
        contactPhone, 
        amount: diff, 
        originalAmount: finalBillTotal, 
        description: `Pending for ${station.name}`, 
        memberId: (station.members[0]?.id && station.members[0]?.id.startsWith('guest-')) ? undefined : station.members[0]?.id 
      }, user);
    } else if (diff < 0) {
      await recordDebt({ 
        type: 'payable', 
        contactName, 
        contactPhone, 
        amount: Math.abs(diff), 
        originalAmount: finalBillTotal, 
        description: `Overpayment change for ${station.name}`, 
        memberId: (station.members[0]?.id && station.members[0]?.id.startsWith('guest-')) ? undefined : station.members[0]?.id 
      }, user);
    }

    handleCheckout('pending', paid, 0);
  };

  if (!station) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isClosing && onOpenChange(open)}>
        <DialogContent className="w-[95vw] sm:max-w-lg h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="px-6 pt-5 shrink-0 bg-background border-b pb-3">
                <DialogTitle className="flex items-center gap-2 font-display tracking-tight text-base sm:text-xl">
                    {step === 'review-bill' && <><Receipt className="h-4 w-4 text-primary" /> BILL REVIEW: {station.name}</>}
                    {step === 'member-xp' && <><Star className="h-4 w-4 text-yellow-500" /> REWARD POINTS</>}
                    {step === 'payment-method' && <><Banknote className="h-4 w-4 text-primary" /> CHECKOUT</>}
                    {step === 'split-details' && <><Layers className="h-4 w-4 text-amber-500" /> SPLIT PAYMENT</>}
                    {step === 'pending-details' && <><FileWarning className="h-4 w-4 text-destructive" /> RECORD PENDING</>}
                </DialogTitle>
            </DialogHeader>

            <ScrollArea className="flex-1 min-h-0 bg-muted/5">
                {step === 'review-bill' && (
                    <div className="space-y-4 p-4 sm:p-6">
                        <div className={cn("text-center p-4 rounded-xl border-2 border-dashed transition-all", finalBillTotal === 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-primary/5 border-primary/20")}>
                            <p className="text-[10px] font-bold uppercase tracking-normal opacity-50 mb-0.5">{finalBillTotal === 0 ? "RECHARGE SETTLEMENT" : "FINAL AMOUNT DUE"}</p>
                            <p className={cn("text-3xl sm:text-5xl font-bold font-mono tracking-tighter", finalBillTotal === 0 ? "text-emerald-600" : "text-primary")}>₹{finalBillTotal.toLocaleString()}</p>
                            {finalBillTotal === 0 && <div className="flex items-center justify-center gap-1 mt-1 text-[8px] font-bold uppercase text-emerald-600 tracking-normal"><CheckCircle2 className="h-2.5 w-2.5" />Balance Covered</div>}
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-[10px] font-bold uppercase tracking-normal text-muted-foreground flex items-center gap-1.5 pl-1"><ShoppingBag className="h-2.5 w-2.5" />Bill Auditor</h3>
                            <div className="space-y-1.5">
                                {initialPackageInfo && (
                                    <div className="flex justify-between items-center p-2 rounded-lg bg-card border-2 shadow-sm animate-in fade-in duration-300">
                                        <div className="min-w-0"><p className="font-bold text-[10px] uppercase truncate flex items-center gap-1.5">{initialPackageInfo.name}{initialPackageInfo.isExistingRecharge && <Badge variant="outline" className="text-[7px] h-3.5 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">PREPAID</Badge>}</p><p className="text-[8px] font-bold text-muted-foreground uppercase">Session Package</p></div>
                                        <span className="font-mono font-bold text-xs text-foreground">₹{initialPackageInfo.total.toLocaleString()}</span>
                                    </div>
                                )}
                                {billItems.map((item, idx) => (
                                    <div key={`${item.itemId}-${idx}`} className="flex justify-between items-center p-2 rounded-lg bg-card border-2 shadow-sm animate-in slide-in-from-right-2 duration-300 group">
                                        <div className="min-w-0 flex-1 pr-2"><p className="font-bold text-[10px] uppercase truncate leading-tight">{item.name}</p><p className="text-[8px] font-bold text-muted-foreground uppercase">₹{item.price} / unit</p></div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center bg-muted/30 rounded-md p-0.5 border">
                                                <button onClick={() => handleUpdateQuantityByIndex(idx, -1)} className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive hover:text-white transition-colors"><Minus className="h-2.5 w-2.5"/></button>
                                                <span className="w-6 text-center font-bold text-[10px] font-mono">{item.quantity}</span>
                                                <button onClick={() => handleUpdateQuantityByIndex(idx, 1)} className="h-5 w-5 flex items-center justify-center rounded hover:bg-primary hover:text-white transition-colors"><Plus className="h-2.5 w-2.5"/></button>
                                            </div>
                                            <div className="text-right min-w-[50px]"><p className="font-mono font-bold text-xs text-primary">₹{(item.price * item.quantity).toLocaleString()}</p></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="relative mt-3">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input placeholder="QUICK ADD FOOD/DRINKS..." className="h-10 pl-8 border-2 border-dashed font-bold uppercase text-[9px] tracking-normal bg-background" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                {filteredFood.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-card border-2 rounded-lg shadow-2xl z-50 overflow-hidden divide-y">{filteredFood.map(food => <button key={food.id} onClick={() => handleAddItem(food)} className="w-full p-2.5 text-left hover:bg-primary/5 flex justify-between items-center transition-colors"><span className="font-bold text-[9px] uppercase">{food.name}</span><span className="font-mono font-bold text-[10px] text-primary">₹{food.price}</span></button>)}</div>}
                            </div>
                            <div className="pt-3 border-t border-dashed mt-3">
                                <div className="flex items-center justify-between p-2 rounded-lg bg-destructive/5 border-2 border-destructive/20">
                                    <div className="flex items-center gap-1.5"><Tag className="h-3 w-3 text-destructive" /><Label className="text-[8px] font-bold uppercase tracking-normal text-destructive">Discount</Label></div>
                                    <div className="relative w-20"><span className="absolute left-1.5 top-1/2 -translate-y-1/2 font-mono font-bold text-[10px] text-destructive">₹</span><Input type="number" value={discount || ''} onChange={e => handleDiscountChange(e.target.value)} className="h-7 pl-4 text-right font-mono font-bold text-[10px] text-destructive border-destructive/30 focus-visible:ring-destructive" placeholder="0" /></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {step === 'member-xp' && (
                    <div className="space-y-3 p-4 sm:p-6">
                        <div className="rounded-xl border-2 border-dashed bg-green-500/5 p-3 space-y-2">
                            {realMembersInSession.map((member, idx) => {
                                const assignedMember = station.members.find(sm => sm.id === member.id);
                                const isProvidingRecharge = !!assignedMember?.rechargeId;
                                const isPurchaser = idx === 0 && initialPackageInfo?.isNewRechargePurchase;
                                const currentBalanceSeconds = (member.recharges || []).filter(r => new Date(r.expiryDate) > new Date() && r.remainingDuration > 0).reduce((sum, r) => sum + r.remainingDuration, 0);
                                const newPackDuration = isPurchaser ? (initialPackageInfo?.purePackage?.duration || 0) : 0;
                                const totalGroupManSeconds = playedSecondsPerPlayer * station.members.length;
                                const deduction = (isProvidingRecharge || isPurchaser) ? totalGroupManSeconds : 0;
                                const previewBalance = Math.max(0, (currentBalanceSeconds + newPackDuration) - deduction);
                                const hasAnyBalanceContext = currentBalanceSeconds > 0 || isPurchaser;
                                return (
                                    <div key={member.id} className="flex flex-col bg-card p-3 rounded-lg border-2 gap-2 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarImage src={member.avatarUrl} /><AvatarFallback>{member.name[0]}</AvatarFallback></Avatar>
                                                <div className="text-left"><p className="font-bold text-[11px] uppercase">{member.name}</p><Badge variant="outline" className={cn("text-[7px] h-3.5 uppercase font-bold", tierColors[member.tier])}>{member.tier} Tier</Badge></div>
                                            </div>
                                            <div className="text-right"><p className="text-[8px] font-mono opacity-50 font-bold">₹{billPerMember.toFixed(0)} SHARE</p><div className="flex items-center gap-1 text-green-600 font-bold text-xs"><Star className="h-2.5 w-2.5 fill-current" /><span>+{Math.floor(billPerMember * settings.xpPerRupee * (tierMultipliers[member.tier] || 1))} XP</span></div></div>
                                        </div>
                                        {hasAnyBalanceContext && <div className="flex items-center justify-between pt-2 border-t-2 border-dashed border-muted"><span className="text-[8px] font-bold uppercase text-muted-foreground tracking-normal flex items-center gap-1"><Zap className="h-2.5 w-2.5 text-yellow-500 fill-current" />Balance</span><span className="text-[10px] font-bold text-primary font-mono">{formatBalance(previewBalance)}</span></div>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                {step === 'payment-method' && <div className="grid grid-cols-2 gap-3 p-4 sm:p-6 my-2"><Button variant="outline" className="h-24 flex flex-col gap-1 text-base font-bold border-2 hover:border-green-500 uppercase tracking-tighter" onClick={() => handleCheckout('cash')}><Banknote className="h-8 w-8 text-green-600" /> Cash</Button><Button variant="outline" className="h-24 flex flex-col gap-1 text-base font-bold border-2 hover:border-primary uppercase tracking-tighter" onClick={() => handleCheckout('upi')}><Smartphone className="h-8 w-8 text-primary" /> UPI</Button><Button variant="outline" className="h-14 flex gap-2 font-bold uppercase border-dashed border-2 text-[10px]" onClick={() => setStep('split-details')}><Layers className="h-4 w-4 text-amber-500" /> Split</Button><Button variant="outline" className="h-14 flex gap-2 font-bold uppercase border-dashed border-2 text-[10px]" onClick={() => setStep('pending-details')}><FileWarning className="h-4 w-4 text-destructive" /> Pending</Button></div>}
                {step === 'split-details' && <div className="space-y-4 p-4 sm:p-6 my-2"><div className="space-y-4"><div className="space-y-1"><Label className="text-[9px] font-bold uppercase tracking-normal opacity-50">Cash Portion (₹)</Label><Input type="number" value={splitCash} onChange={e => { setSplitCash(e.target.value); setSplitUpi((finalBillTotal - (parseFloat(e.target.value) || 0)).toString()); }} className="h-12 text-xl font-mono font-bold border-2"/></div><div className="space-y-1"><Label className="text-[9px] font-bold uppercase tracking-normal opacity-50">UPI Portion (₹)</Label><Input type="number" value={splitUpi} onChange={e => { setUpiTotal(e.target.value); setSplitCash((finalBillTotal - (parseFloat(e.target.value) || 0)).toString()); }} className="h-12 text-xl font-mono font-bold border-2"/></div></div></div>}
                {step === 'pending-details' && <div className="space-y-4 p-4 sm:p-6 my-2"><div className="grid gap-3"><div className="space-y-1"><Label className="text-[9px] font-bold uppercase tracking-normal opacity-50">Collected Now (₹)</Label><Input type="number" value={paidNow} onChange={e => setPaidNow(e.target.value)} className="h-12 text-xl font-mono font-bold border-2"/></div><div className="space-y-1"><Label className="text-[9px] font-bold uppercase tracking-normal opacity-50">Customer Name</Label><Input value={contactName} onChange={e => setContactName(e.target.value)} className="h-10 font-bold uppercase text-xs"/></div><div className="space-y-1"><Label className="text-[9px] font-bold uppercase tracking-normal opacity-50">Phone Number</Label><Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="h-10 font-bold font-mono text-xs"/></div></div></div>}
            </ScrollArea>

            <DialogFooter className="px-4 py-3 border-t bg-muted/10 shrink-0">
                {step === 'review-bill' && <Button disabled={isClosing} onClick={() => realMembersInSession.length > 0 ? setStep('member-xp') : (finalBillTotal === 0 ? handleCheckout('recharge') : setStep('payment-method'))} className="w-full h-12 font-display text-[10px] uppercase tracking-normal shadow-xl">{finalBillTotal === 0 && realMembersInSession.length === 0 ? 'SETTLE & CLOSE' : 'CONTINUE TO PAYMENT'} <ChevronRight className="ml-1.5 h-3.5 w-3.5" /></Button>}
                {step === 'member-xp' && <Button disabled={isClosing} onClick={() => finalBillTotal === 0 ? handleCheckout('recharge') : setStep('payment-method')} className="w-full h-12 font-display text-[10px] uppercase tracking-normal shadow-xl">{finalBillTotal === 0 ? 'COMPLETE SETTLEMENT' : 'CONFIRM REWARDS & PAY'} <ChevronRight className="ml-1.5 h-3.5 w-3.5" /></Button>}
                {step === 'payment-method' && <Button variant="ghost" disabled={isClosing} onClick={() => setStep('review-bill')} className="w-full h-10 font-bold uppercase text-[9px] tracking-normal"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> BACK TO REVIEW</Button>}
                {step === 'split-details' && <Button onClick={() => handleCheckout('split', parseFloat(splitCash), parseFloat(splitUpi))} disabled={isClosing || Math.abs((parseFloat(splitCash)||0) + (parseFloat(splitUpi)||0) - finalBillTotal) > 0.1} className="w-full h-12 font-bold uppercase tracking-tight text-base bg-primary shadow-xl">FINALIZE SPLIT</Button>}
                {step === 'pending-details' && <Button onClick={handlePendingConfirm} disabled={isClosing} className="w-full h-12 font-bold uppercase tracking-tight text-base bg-destructive shadow-xl">SAVE DEBT & CLOSE</Button>}
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
