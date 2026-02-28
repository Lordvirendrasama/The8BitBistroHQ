
'use client';
import { useState, useMemo, useEffect } from 'react';
import type { Member, AssignedMember, Station, GamingPackage, MemberRecharge, BillItem } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Search, UserPlus, X, Clock, UserPlus2, Zap, ChevronRight, ArrowLeft, CheckCircle2, Gamepad2, Star } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';
import { useFirebase } from '@/firebase/provider';
import { collection } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Badge } from '@/components/ui/badge';
import { isAfter } from 'date-fns';
import { AddMemberModal } from './add-member-modal';
import { addMember } from '@/firebase/firestore/members';

const GUEST_AVATAR = PlaceHolderImages.find(img => img.id === 'avatar-6')?.imageUrl || 'https://picsum.photos/seed/guest/100/100';

const formatPackageDuration = (totalSeconds: number) => {
    if (!totalSeconds || totalSeconds < 0) return '0m';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const parts = [];
    if (hours > 0) parts.push(`${hours}H`);
    if (minutes > 0) parts.push(`${minutes}M`);
    return parts.length > 0 ? parts.join(' ') : '0M';
};

interface JoinPlayerModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  station: Station;
  members: Member[];
  onConfirm: (newPlayer: AssignedMember, billItem: BillItem | null) => void;
}

export function JoinPlayerModal({ isOpen, onOpenChange, station, members, onConfirm }: JoinPlayerModalProps) {
  const { db } = useFirebase();
  const [step, setStep] = useState<'selection' | 'configuration'>('selection');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<AssignedMember | null>(null);
  const [clientTime, setClientTime] = useState<string>('');

  useEffect(() => {
    setClientTime(new Date().toTimeString().slice(0, 5));
  }, []);

  const packagesCollection = useMemo(() => {
    if (!db) return null;
    return collection(db, 'gamingPackages');
  }, [db]);
  const { data: allPackages } = useCollection<GamingPackage>(packagesCollection);

  const walkInPackages = useMemo(() => {
    if (!allPackages || !clientTime || !station) return [];
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'short' }); 
    
    const filtered = allPackages.filter(pkg => {
        if (pkg.isAddTimePackage || pkg.isRechargePack) return false;
        
        // Station Type check: Board game stations only see Board Game Passes
        if (station.type === 'boardgame' && !pkg.isBoardGamePass) return false;
        if (station.type === 'ps5' && pkg.isBoardGamePass) return false;

        let isAvailable = true;
        if (pkg.availableDays && pkg.availableDays.length > 0 && !pkg.availableDays.includes(currentDay)) isAvailable = false;
        if (isAvailable && pkg.startTime && clientTime < pkg.startTime) isAvailable = false;
        if (isAvailable && pkg.endTime && clientTime > pkg.endTime) isAvailable = false;
        return isAvailable;
    });

    // Sort priority offers to the top
    return filtered.sort((a, b) => {
        if (a.isPriorityOffer && !b.isPriorityOffer) return -1;
        if (!a.isPriorityOffer && b.isPriorityOffer) return 1;
        return 0;
    });
  }, [allPackages, clientTime, station]);

  const rechargePackages = useMemo(() => allPackages?.filter(p => p.isRechargePack) || [], [allPackages]);

  useEffect(() => {
    if (isOpen) {
      setStep('selection');
      setSearchTerm('');
      setSelectedMember(null);
    }
  }, [isOpen]);

  const filteredMembers = useMemo(() => {
    const existingIds = new Set(station.members.map(m => m.id));
    const available = members.filter(m => !existingIds.has(m.id));
    if (!searchTerm) return available.slice(0, 10);
    const term = searchTerm.toLowerCase();
    return available.filter(m => m.name.toLowerCase().includes(term) || m.username.toLowerCase().includes(term)).slice(0, 15);
  }, [members, searchTerm, station.members]);

  const getMemberActiveRecharges = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    if (!member || !member.recharges) return [];
    const now = new Date();
    return member.recharges.filter(r => isAfter(new Date(r.expiryDate), now) && r.remainingDuration > 0);
  };

  const handlePickMember = (m: Member | AssignedMember) => {
    setSelectedMember({ id: m.id, name: m.name, avatarUrl: m.avatarUrl });
    setStep('configuration');
  };

  const handleAddGuest = () => {
    const guest: AssignedMember = { id: `guest-${Date.now()}`, name: 'Guest', avatarUrl: GUEST_AVATAR };
    setSelectedMember(guest);
    setStep('configuration');
  };

  const handleSelectPlan = (item: GamingPackage | MemberRecharge | 'pool', type: 'recharge' | 'walkin' | 'buy-recharge') => {
    if (!selectedMember) return;
    const now = new Date();
    let duration = 0;
    let name = '';
    let billItem: BillItem | null = null;
    let rechargeId: string | null = null;
    let isNewRecharge = false;

    if (item === 'pool') {
        const member = members.find(m => m.id === selectedMember.id);
        duration = member?.recharges?.reduce((s, r) => s + r.remainingDuration, 0) || 0;
        name = "Recharge: Combined Pool";
        rechargeId = 'pool';
    } else if (type === 'recharge') {
        const r = item as MemberRecharge;
        duration = r.remainingDuration;
        name = `Recharge: ${r.packageName}`;
        rechargeId = r.id;
    } else {
        const pkg = item as GamingPackage;
        duration = pkg.duration;
        name = type === 'buy-recharge' ? `Buy Recharge: ${pkg.name}` : pkg.name;
        isNewRecharge = type === 'buy-recharge';
        billItem = {
            itemId: pkg.id,
            name: `${name} (${selectedMember.name})`,
            price: pkg.price,
            quantity: 1,
            addedAt: now.toISOString()
        };
    }

    const endTime = duration > 0 ? new Date(now.getTime() + duration * 1000).toISOString() : null;

    onConfirm({
        ...selectedMember,
        startTime: now.toISOString(),
        endTime,
        rechargeId,
        isNewRecharge,
        packageId: (item as any).packageId || (item as any).id || null,
        status: 'active'
    }, billItem);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-md h-[80vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0 bg-muted/5 border-b">
          <DialogTitle className="font-display text-xl text-emerald-600 uppercase tracking-tight">JOIN SESSION: {station.name}</DialogTitle>
          <DialogDescription className="text-xs font-bold uppercase text-muted-foreground">Add another player to the active timer.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {step === 'selection' ? (
                <div className="flex-1 flex flex-col p-4 gap-4 animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="SEARCH MEMBERS..." className="pl-10 h-11 border-2 font-bold uppercase text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Button 
                                variant="outline" 
                                onClick={handleAddGuest} 
                                className="h-11 border-2 uppercase font-bold text-xs gap-2 bg-emerald-500/5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                            >
                                <UserPlus className="h-4 w-4"/> GUEST
                            </Button>
                            <AddMemberModal onAddMember={(data) => {
                                addMember({ ...data.memberData, level: 1, xp: 0, points: 0, totalSpent: 0, joinDate: new Date().toISOString(), avatarUrl: data.avatarUrl }, data.referrerId).then(id => {
                                    if (id) handlePickMember({ id, name: data.memberData.name, avatarUrl: data.avatarUrl } as any);
                                });
                            }} triggerButton={
                                <Button 
                                    variant="outline" 
                                    className="h-11 border-2 uppercase font-bold text-xs gap-2 bg-emerald-500/5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                >
                                    <UserPlus2 className="h-4 w-4"/> MEMBER
                                </Button>
                            } />
                        </div>
                    </div>
                    <ScrollArea className="flex-1 border-2 rounded-xl bg-muted/5">
                        <div className="p-2 space-y-1">
                            {filteredMembers.map(m => (
                                <div key={m.id} onClick={() => handlePickMember(m)} className="p-3 rounded-lg hover:bg-emerald-50 cursor-pointer flex items-center gap-3 transition-colors border border-transparent hover:border-emerald-100">
                                    <Avatar className="h-10 w-10 border-2 border-emerald-100"><AvatarImage src={m.avatarUrl}/><AvatarFallback>{m.name[0]}</AvatarFallback></Avatar>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold uppercase truncate">{m.name}</p>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">@{m.username}</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-30" />
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="p-4 border-b flex items-center justify-between bg-emerald-50/30">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border-2 border-emerald-500/20"><AvatarImage src={selectedMember?.avatarUrl}/><AvatarFallback>{selectedMember?.name[0]}</AvatarFallback></Avatar>
                            <p className="font-bold uppercase text-sm">{selectedMember?.name}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setStep('selection')} className="h-8 uppercase text-[10px] font-bold hover:text-emerald-600"><ArrowLeft className="mr-1 h-3 w-3"/> BACK</Button>
                    </div>
                    <ScrollArea className="flex-1 p-4">
                        <div className="space-y-6 pb-8">
                            {!selectedMember?.id.startsWith('guest-') && (
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-normal pl-1">USE PREPAID PACK</h4>
                                    <div className="space-y-2">
                                        {getMemberActiveRecharges(selectedMember!.id).map(r => (
                                            <div key={r.id} onClick={() => handleSelectPlan(r, 'recharge')} className="p-4 rounded-xl border-2 hover:border-emerald-500 bg-card transition-all cursor-pointer flex justify-between items-center group">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold uppercase truncate opacity-80">{r.packageName}</p>
                                                    <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 uppercase mt-1"><Zap className="h-3 w-3 fill-current" /> {formatPackageDuration(r.remainingDuration)} LEFT</div>
                                                </div>
                                                <Badge variant="outline" className="h-6 px-3 text-[10px] font-bold border-emerald-200 text-emerald-700 uppercase group-hover:bg-emerald-500 group-hover:text-white">USE</Badge>
                                            </div>
                                        ))}
                                        {getMemberActiveRecharges(selectedMember!.id).length === 0 && <p className="text-[10px] text-center italic text-muted-foreground py-4">No active time packs.</p>}
                                    </div>
                                    <Separator className="my-4" />
                                    <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-normal pl-1">BUY RECHARGE</h4>
                                    <div className="space-y-2">
                                        {rechargePackages.map(pkg => (
                                            <div key={pkg.id} onClick={() => handleSelectPlan(pkg, 'buy-recharge')} className="p-4 rounded-xl border-2 border-dashed hover:border-emerald-500 bg-card transition-all cursor-pointer flex justify-between items-center group">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold uppercase truncate opacity-80">{pkg.name}</p>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">{formatPackageDuration(pkg.duration)} &bull; {pkg.validity} Days</p>
                                                </div>
                                                <span className="font-mono font-bold text-emerald-600">₹{pkg.price}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <Separator className="my-4" />
                            <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-normal pl-1">QUICK PLAY PLANS</h4>
                            <div className="space-y-2">
                                {walkInPackages.map(pkg => (
                                    <div key={pkg.id} onClick={() => handleSelectPlan(pkg, 'walkin')} className={cn(
                                        "p-4 rounded-xl border-2 hover:border-emerald-500 bg-card transition-all cursor-pointer flex justify-between items-center group shadow-sm",
                                        pkg.isPriorityOffer && "border-amber-500/30 bg-amber-500/[0.02]"
                                    )}>
                                        <div className="min-w-0">
                                            <p className={cn("text-xs font-bold uppercase truncate transition-colors", pkg.isPriorityOffer ? "text-amber-600 group-hover:text-emerald-600" : "opacity-80 group-hover:text-emerald-600")}>
                                                {pkg.name}
                                                {pkg.isPriorityOffer && <Star className="inline h-3 w-3 ml-1.5 fill-amber-500 text-amber-500" />}
                                            </p>
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase mt-1"><Clock className="h-3 w-3" /> {formatPackageDuration(pkg.duration)}</div>
                                        </div>
                                        <span className="font-mono font-bold text-lg">₹{pkg.price}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </ScrollArea>
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
