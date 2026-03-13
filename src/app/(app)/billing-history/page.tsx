'use client';

import { useMemo, useState, useEffect } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { Bill, FoodItem, GamingPackage, Station } from '@/lib/types';
import { useFirebase } from '@/firebase/provider';
import { useAuth } from '@/firebase/auth/use-user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format, differenceInMinutes, differenceInSeconds, addSeconds, addDays, subDays } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Info, Calendar as CalendarIcon, Clock, Users, Moon, Timer, ArrowRight, UserCheck, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { deleteBill, updateBill } from '@/firebase/firestore/bills';
import { useToast } from '@/hooks/use-toast';
import { EditBillModal } from '@/components/billing/EditBillModal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, getBusinessDate } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

export default function BillingHistoryPage() {
    const { db } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    const [editingBill, setEditingBill] = useState<Bill | null>(null);
    const [date, setDate] = useState<Date | undefined>(undefined);

    useEffect(() => {
        setDate(new Date());
    }, []);

    const canEdit = user?.role === 'admin' || user?.role === 'staff' || user?.role === 'guest';

    const billsQuery = useMemo(() => {
        if (!db) return null;
        return query(collection(db, 'bills'), orderBy('timestamp', 'desc'));
    }, [db]);

    const { data: bills, loading, error } = useCollection<Bill>(billsQuery);
    
    const foodItemsQuery = useMemo(() => !db ? null : collection(db, 'foodItems'), [db]);
    const { data: foodItems } = useCollection<FoodItem>(foodItemsQuery);

    const packagesQuery = useMemo(() => !db ? null : collection(db, 'gamingPackages'), [db]);
    const { data: gamingPackages } = useCollection<GamingPackage>(packagesQuery);

    const activeStationsQuery = useMemo(() => !db ? null : query(collection(db, 'stations'), where('status', 'in', ['in-use', 'paused'])), [db]);
    const { data: activeStations } = useCollection<Station>(activeStationsQuery);

    const filteredBills = useMemo(() => {
        if (!bills) return [];
        if (!date) return bills;
        const selectedBusinessDate = getBusinessDate(date, true);
        return bills.filter(bill => getBusinessDate(new Date(bill.timestamp)) === selectedBusinessDate);
    }, [bills, date]);

    const filteredTotal = useMemo(() => {
        return filteredBills.reduce((sum, bill) => sum + (bill.totalAmount || 0), 0);
    }, [filteredBills]);

    const projectedTotal = useMemo(() => {
        if (!date) return 0;
        if (getBusinessDate(date, true) !== getBusinessDate(new Date())) return filteredTotal;

        let projected = filteredTotal;
        if (activeStations) {
            activeStations.forEach(station => {
                const currentBillSum = (station.currentBill || []).reduce((s, i) => s + (i.price * i.quantity), 0);
                projected += currentBillSum;

                if (station.packageName && station.packageName !== 'Walk-in Order' && gamingPackages) {
                    const isItemized = (station.currentBill || []).some(item => 
                        item.name === station.packageName || 
                        item.name.startsWith(`Time: ${station.packageName}`) ||
                        item.name.startsWith(`Buy Recharge: ${station.packageName}`) ||
                        item.name.startsWith(`Recharge: ${station.packageName}`)
                    );

                    if (!isItemized) {
                        const pureName = station.packageName.replace(/^(Recharge: |Buy Recharge: )/i, '').trim();
                        const pkg = gamingPackages.find(p => p.name.toLowerCase() === pureName.toLowerCase());
                        if (pkg) {
                            const playerCount = station.members.length || 1;
                            const capacity = pkg.playerCapacity || 1;
                            const instances = Math.ceil(playerCount / capacity);
                            if (!station.packageName.startsWith('Recharge: ')) {
                                projected += (pkg.price * instances);
                            }
                        }
                    }
                }
                projected -= (station.discount || 0);
            });
        }
        return projected;
    }, [filteredTotal, activeStations, gamingPackages, date]);

    const handleDeleteBill = async (billId: string) => {
        if (!canEdit || !user) return;
        const result = await deleteBill(billId, user);
        if (result.success) {
            toast({ title: "Bill Deleted", description: "Audit trail and XP reverted." });
        } else {
            toast({ variant: 'destructive', title: 'Deletion Failed', description: result.message });
        }
    };
    
    const handleUpdateBill = async (billId: string, updates: Partial<Bill>) => {
        if (!canEdit || !user) return;
        await updateBill(billId, updates, user);
        toast({ title: "Bill Updated", description: "Changes saved to audit ledger." });
        setEditingBill(null);
    };

    const formatLoggedTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    if (loading) {
        return <div className="flex h-screen items-center justify-center font-headline text-xs animate-pulse">Syncing Billing Records...</div>;
    }

    return (
        <div className="space-y-6 sm:space-y-8 font-body">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                <div>
                    <h1 className="font-headline text-3xl sm:text-4xl tracking-wider text-foreground">Billing Audit</h1>
                    <p className="mt-1 text-xs sm:text-sm text-muted-foreground uppercase font-black tracking-widest">Historical Station Records & Transparency Ledger.</p>
                </div>
                 <div className="flex flex-col xs:flex-row gap-3 items-stretch xs:items-center">
                    <div className="flex items-center bg-muted/30 rounded-xl p-1 border-2 border-dashed">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10" 
                            onClick={() => setDate(prev => subDays(prev || new Date(), 1))}
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" className={cn("h-10 px-4 justify-start text-left font-black uppercase text-[10px] tracking-widest", !date && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                    {date ? format(date, "MMM dd, yyyy") : <span>All History</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                                <div className="p-1 border-t border-border">
                                    <Button variant="ghost" onClick={() => setDate(undefined)} className="w-full text-xs font-bold uppercase">View Full History</Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10" 
                            onClick={() => setDate(prev => addDays(prev || new Date(), 1))}
                        >
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    </div>
                    <div className="flex gap-2">
                        <div className="bg-muted/30 border-2 rounded-lg px-4 py-2 flex flex-col justify-center shrink-0">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Period Revenue</p>
                            <p className="text-xl font-black text-primary font-mono leading-none">₹{filteredTotal.toLocaleString()}</p>
                        </div>
                        {date && getBusinessDate(date, true) === getBusinessDate(new Date()) && (
                            <div className="bg-blue-500/5 border-2 border-blue-500/20 rounded-lg px-4 py-2 flex flex-col justify-center shrink-0">
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">Live Projection</p>
                                <p className="text-xl font-black text-blue-600 font-mono leading-none">₹{Math.floor(projectedTotal).toLocaleString()}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Card className="border-2 shadow-none overflow-hidden">
                <CardHeader className="p-4 sm:p-6 bg-muted/10">
                    <CardTitle className="text-lg font-black uppercase">Transaction Records</CardTitle>
                    <CardDescription className="text-xs font-bold uppercase tracking-wider">Detailed audit of receipts and session timelines.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Accordion type="single" collapsible className="w-full">
                        {filteredBills?.map((bill, bIdx) => (
                            <AccordionItem value={bill.id} key={`${bill.id}-${bIdx}`} className="border-b last:border-0 px-2 sm:px-0">
                                <AccordionTrigger className="hover:no-underline py-4 px-2 sm:px-4 hover:bg-muted/5 transition-colors">
                                    <div className="flex flex-col sm:flex-row justify-between w-full items-start sm:items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <p className="font-black uppercase tracking-tight text-sm">{bill.stationName}</p>
                                            <Badge variant="outline" className="text-[9px] uppercase font-black h-5 border-primary/30">{(bill.paymentMethod || 'cash').toUpperCase()}</Badge>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-[10px] text-muted-foreground font-mono font-bold uppercase">{format(new Date(bill.timestamp), 'MMM d, h:mm a')}</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-start sm:justify-center px-0 sm:px-4">
                                            {(bill.members || []).map((member, mIdx) => (
                                                <div key={mIdx} className="flex items-center gap-1.5 bg-muted/50 pl-1 pr-2 py-0.5 rounded-full border border-primary/10">
                                                    <Avatar className="h-5 w-5 border border-background">
                                                        <AvatarImage src={member.avatarUrl} />
                                                        <AvatarFallback className="text-[8px]">{member.name?.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-[9px] font-black uppercase tracking-tighter truncate max-w-[60px]">{member.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="font-black text-lg text-primary shrink-0 self-end sm:self-center font-mono">₹{(bill.totalAmount || 0).toLocaleString()}</div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="mx-2 sm:mx-4 p-3 sm:p-4 bg-muted/20 rounded-xl border-2 border-dashed space-y-6 mb-4">
                                        <div className="space-y-4">
                                            <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                                <Info className="h-3.5 w-3.5" />
                                                Surgical Receipt Audit
                                            </h4>
                                            <TooltipProvider>
                                                <div className="overflow-hidden border-2 rounded-lg bg-background shadow-sm">
                                                    <Table>
                                                        <TableBody>
                                                            {bill.initialPackagePrice > 0 && (
                                                                <TableRow className="text-xs bg-muted/5">
                                                                    <TableCell className="px-3 font-bold uppercase text-[10px]">{bill.packageName || 'Initial Gaming Session'}</TableCell>
                                                                    <TableCell className="text-center font-mono">1</TableCell>
                                                                    <TableCell className="text-right px-3 font-mono font-bold">₹{bill.initialPackagePrice.toLocaleString()}</TableCell>
                                                                </TableRow>
                                                            )}
                                                            {(bill.items || []).map((item, iIdx) => (
                                                                <TableRow key={iIdx} className="text-xs">
                                                                    <TableCell className="px-3">
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="font-bold uppercase text-[10px]">{item.name}</span>
                                                                            {item.addedAt && (
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <Button variant="ghost" size="icon" className="h-4 w-4 opacity-30"><Clock className="h-3 w-3" /></Button>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent><p className="text-[10px] font-bold">Added to bill at: {format(new Date(item.addedAt), 'p')}</p></TooltipContent>
                                                                                </Tooltip>
                                                                            )}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="text-center font-mono">{item.quantity}</TableCell>
                                                                    <TableCell className="text-right px-3 font-mono">₹{(item.price * item.quantity).toLocaleString()}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                            {bill.discount > 0 && (
                                                                <TableRow className="font-bold text-destructive text-xs">
                                                                    <TableCell className="px-3 uppercase text-[10px]">Special Discount</TableCell>
                                                                    <TableCell></TableCell>
                                                                    <TableCell className="text-right px-3 font-mono">- ₹{bill.discount.toLocaleString()}</TableCell>
                                                                </TableRow>
                                                            )}
                                                            <TableRow className="font-black border-t-2 bg-muted/30">
                                                                <TableCell className="px-3 uppercase tracking-widest text-[10px]">Grand Total</TableCell>
                                                                <TableCell colSpan={2} className="text-right px-3 font-mono text-base text-primary">₹{(bill.totalAmount || 0).toLocaleString()}</TableCell>
                                                            </TableRow>
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </TooltipProvider>
                                        </div>

                                        {bill.members && bill.members.length > 0 && bill.members.some(m => !!m.startTime) && (
                                            <div className="pt-2 border-t border-dashed space-y-3">
                                                <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                                    <Timer className="h-3.5 w-3.5" />
                                                    Session Timeline Audit
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {bill.members.map((member, mIdx) => {
                                                        const start = member.startTime ? new Date(member.startTime) : null;
                                                        const end = member.endTime ? new Date(member.endTime) : null;
                                                        const durationSec = (start && end) ? Math.max(0, differenceInSeconds(end, start)) : 0;
                                                        const unusedSec = member.remainingSecondsAtStop || 0;
                                                        const hasLeftEarly = unusedSec > 60;
                                                        
                                                        // Calculate original scheduled end time for display
                                                        const scheduledEnd = (end && unusedSec > 0) ? addSeconds(end, unusedSec) : null;
                                                        
                                                        return (
                                                            <div key={mIdx} className={cn(
                                                                "bg-background rounded-xl border-2 p-3 flex flex-col gap-2 shadow-sm transition-all",
                                                                hasLeftEarly ? "border-amber-500 ring-4 ring-amber-500/10 bg-amber-500/[0.03] animate-in zoom-in-95" : "border-muted"
                                                            )}>
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <Avatar className="h-6 w-6 border shadow-sm">
                                                                            <AvatarImage src={member.avatarUrl} />
                                                                            <AvatarFallback className="text-[8px] font-black">{member.name[0]}</AvatarFallback>
                                                                        </Avatar>
                                                                        <span className="font-black text-[10px] uppercase truncate max-w-[100px]">{member.name}</span>
                                                                    </div>
                                                                    {hasLeftEarly && (
                                                                        <Badge variant="destructive" className="text-[8px] h-5 bg-amber-600 text-white border-none uppercase font-black px-2 shadow-lg animate-pulse">LEFT EARLY</Badge>
                                                                    )}
                                                                </div>
                                                                <div className="grid grid-cols-3 items-center bg-muted/20 p-2 rounded-lg border-2 border-dashed relative">
                                                                    <div className="flex flex-col items-center">
                                                                        <span className="text-[7px] font-black text-muted-foreground uppercase opacity-50">Log In</span>
                                                                        <span className="font-mono text-[10px] font-bold">{start ? format(start, 'p') : 'N/A'}</span>
                                                                    </div>
                                                                    <div className="flex justify-center opacity-20"><ArrowRight className="h-3 w-3" /></div>
                                                                    <div className="flex flex-col items-center">
                                                                        <span className={cn("text-[7px] font-black uppercase opacity-50", hasLeftEarly ? "text-amber-600 opacity-100" : "text-muted-foreground")}>Log Out</span>
                                                                        <span className={cn("font-mono text-[10px] font-bold", hasLeftEarly ? "text-amber-600" : "")}>{end ? format(end, 'p') : 'N/A'}</span>
                                                                    </div>
                                                                    
                                                                    {scheduledEnd && (
                                                                        <div className="absolute -bottom-2 right-2 px-1.5 py-0.5 bg-muted border-2 rounded shadow-xs ring-1 ring-background">
                                                                            <span className="text-[6px] font-black uppercase text-muted-foreground">Scheduled: {format(scheduledEnd, 'p')}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="space-y-1 mt-1.5">
                                                                    <div className="flex justify-between items-center px-1">
                                                                        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tight">Total Playtime</span>
                                                                        <span className={cn(
                                                                            "font-mono text-[10px] font-black",
                                                                            hasLeftEarly ? "text-amber-600" : "text-emerald-600"
                                                                        )}>{formatLoggedTime(durationSec)}</span>
                                                                    </div>
                                                                    {hasLeftEarly && (
                                                                        <div className="flex justify-between items-center px-1 animate-in slide-in-from-left-1 duration-300 bg-amber-500/10 rounded py-0.5">
                                                                            <span className="text-[8px] font-black text-amber-700 uppercase tracking-tight flex items-center gap-1">
                                                                                <AlertTriangle className="h-2.5 w-2.5" />
                                                                                Unused Value
                                                                            </span>
                                                                            <span className="font-mono text-[10px] font-black text-amber-700">-{formatLoggedTime(unusedSec)}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
                                            <div className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                                <Users className="h-3 w-3 text-primary" />
                                                XP awarded to {bill.members.filter(m => m.id && !m.id.startsWith('guest-')).length} members.
                                            </div>
                                            {canEdit && (
                                                <div className="flex gap-2 w-full sm:w-auto">
                                                    <Button variant="outline" size="sm" onClick={() => setEditingBill(bill)} className="flex-1 sm:flex-none font-black uppercase text-[10px] h-9 border-2"><Edit className="mr-2 h-3.5 w-3.5" /> Edit</Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="destructive" size="sm" className="flex-1 sm:flex-none font-black uppercase text-[10px] h-9 shadow-md"><Trash2 className="mr-2 h-3.5 w-3.5" /> Wipe</Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent className="border-4 border-destructive">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle className="font-headline text-destructive uppercase tracking-tighter">Destroy Data?</AlertDialogTitle>
                                                                <AlertDialogDescription className="font-bold text-foreground">This will erase the bill and REVERT XP for all associated members. This is permanent.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter className="gap-2">
                                                                <AlertDialogCancel className="font-bold">ABORT</AlertDialogCancel>
                                                                <AlertDialogAction className="bg-destructive hover:bg-destructive/90 font-black uppercase shadow-xl" onClick={() => handleDeleteBill(bill.id)}>CONFIRM WIPEOUT</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                         {(!filteredBills || filteredBills.length === 0) && (
                            <div className="text-center text-muted-foreground p-12 italic text-sm font-bold uppercase tracking-[0.2em] opacity-30">No records found for this period.</div>
                        )}
                    </Accordion>
                </CardContent>
            </Card>
            {editingBill && (
                <EditBillModal isOpen={!!editingBill} onOpenChange={(isOpen) => !isOpen && setEditingBill(null)} bill={editingBill} foodItems={foodItems || []} gamingPackages={gamingPackages || []} onSave={handleUpdateBill} />
            )}
        </div>
    );
}
