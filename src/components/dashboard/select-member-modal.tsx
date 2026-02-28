
'use client';
import { useState, useMemo, useEffect } from 'react';
import type { Member, AssignedMember, Station, GamingPackage, MemberRecharge } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Search, UserPlus, X, Clock, UserPlus2, Zap, ChevronRight, ArrowLeft, CheckCircle2, Gamepad2, Users2, User, Users, Star } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';
import { useFirebase } from '@/firebase/provider';
import { collection } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Label } from '@/components/ui/label';
import { AddMemberModal } from './add-member-modal';
import { addMember } from '@/firebase/firestore/members';
import { isAfter } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

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

type PlayerConfig = {
    mode: 'recharge' | 'walkin' | 'buy-recharge' | null;
    packageId: string | null;
    rechargeId: string | null;
    name: string | null;
    duration: number | null;
    price: number | null;
    reminderDuration?: number | null;
};

type ModalStep = 'selection' | 'configuration';

interface SelectMemberModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  members: Member[];
  onConfirm: (assignedPlayers: AssignedMember[], selectedPackage: GamingPackage) => void;
  station: Station | null;
}

export function SelectMemberModal({ isOpen, onOpenChange, members, onConfirm, station }: SelectMemberModalProps) {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [step, setStep] = useState<ModalStep>('selection');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<AssignedMember[]>([]);
  const [configs, setConfigs] = useState<Record<string, PlayerConfig>>({});
  const [activeConfigPlayerId, setActiveConfigPlayerId] = useState<string | null>(null);
  const [clientTime, setClientTime] = useState<string>('');

  useEffect(() => {
    setClientTime(new Date().toTimeString().slice(0, 5));
  }, []);

  const playerLimit = station?.type === 'ps5' ? 4 : 8;

  const packagesCollection = useMemo(() => {
    if (!db) return null;
    return collection(db, 'gamingPackages');
  }, [db]);
  const { data: allPackages } = useCollection<GamingPackage>(packagesCollection);

  const rechargePackages = useMemo(() => {
    return allPackages?.filter(p => p.isRechargePack) || [];
  }, [allPackages]);

  const walkInPackages = useMemo(() => {
    if (!allPackages || !clientTime || !station) return [];
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'short' }); 
    
    const filtered = allPackages.filter(pkg => {
        // Core availability check
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

  useEffect(() => {
    if (isOpen) {
      setStep('selection');
      setSearchTerm('');
      setSelectedPlayers([]);
      setConfigs({});
      setActiveConfigPlayerId(null);
    }
  }, [isOpen]);

  const getMemberActiveRecharges = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    if (!member || !member.recharges) return [];
    const now = new Date();
    return member.recharges.filter(r => isAfter(new Date(r.expiryDate), now) && r.remainingDuration > 0);
  };

  const getMemberTotalBalance = (member: Member) => {
    if (!member.recharges) return 0;
    const now = new Date();
    return member.recharges
        .filter(r => isAfter(new Date(r.expiryDate), now) && r.remainingDuration > 0)
        .reduce((sum, r) => sum + r.remainingDuration, 0);
  };

  const filteredMembers = useMemo(() => {
    if (!members) return [];
    const selectedIds = new Set(selectedPlayers.map(p => p.id));
    const availableMembers = members.filter(m => m.id && !selectedIds.has(m.id));
    if (!searchTerm) return availableMembers.slice(0, 15);
    const term = searchTerm.toLowerCase();
    return availableMembers.filter(m => 
      m.name.toLowerCase().includes(term) || 
      m.username.toLowerCase().includes(term)
    ).slice(0, 20);
  }, [members, searchTerm, selectedPlayers]);

  const handleAddPlayer = (member: Member) => {
    const newPlayer: AssignedMember = { id: member.id, name: member.name, avatarUrl: member.avatarUrl };
    setSelectedPlayers(prev => [...prev, newPlayer]);
  };

  const handleAddGuest = () => {
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const newGuest: AssignedMember = { id: `guest-${Date.now()}-${randomSuffix}`, name: 'Guest', avatarUrl: GUEST_AVATAR };
    setSelectedPlayers(prev => [...prev, newGuest]);
  };

  const handleRemovePlayer = (playerId: string) => {
      setSelectedPlayers(prev => prev.filter(p => p.id !== playerId));
      setConfigs(prev => { const next = { ...prev }; delete next[playerId]; return next; });
  };

  const handleSetPlayerMode = (playerId: string, mode: 'recharge' | 'walkin' | 'buy-recharge') => {
      setConfigs(prev => ({
          ...prev,
          [playerId]: { ...prev[playerId], mode, packageId: null, rechargeId: null, name: null, duration: null, price: null, reminderDuration: null }
      }));
  };

  const handleSetPoolDuration = (playerId: string, seconds: number) => {
      setConfigs(prev => ({
          ...prev,
          [playerId]: { ...prev[playerId], reminderDuration: seconds }
      }));
  };

  const handlePickConfig = (playerId: string, item: GamingPackage | MemberRecharge | 'pool', isRecharge: boolean, isBuy: boolean = false) => {
      setConfigs(prev => {
          const next = { ...prev };
          if (item === 'pool') {
              const member = members.find(m => m.id === playerId);
              const balance = member ? getMemberTotalBalance(member) : 0;
              next[playerId] = { 
                  mode: 'recharge', 
                  packageId: 'pool', 
                  rechargeId: 'pool', 
                  name: `Recharge: Combined Balance`, 
                  duration: balance, 
                  price: 0, 
                  reminderDuration: Math.min(3600, balance) // Default to 1 hour or full balance
              };
          } else {
              const pkgId = isBuy 
                ? (item as GamingPackage).id 
                : (isRecharge ? (item as MemberRecharge).packageId : (item as GamingPackage).id);
                
              const rId = isRecharge && !isBuy ? (item as MemberRecharge).id : null;

              next[playerId] = {
                  mode: isBuy ? 'buy-recharge' : (isRecharge ? 'recharge' : 'walkin'),
                  packageId: pkgId,
                  rechargeId: rId,
                  name: isBuy ? `Buy Recharge: ${item.name}` : (isRecharge ? `Recharge: ${(item as MemberRecharge).packageName}` : item.name),
                  duration: item.duration,
                  price: (isRecharge && !isBuy) ? 0 : item.price,
                  reminderDuration: null
              };
          }
          return next;
      });
  };

  const handleApplyAllAndStart = () => {
      if (!activeConfigPlayerId) return;
      const currentConfig = configs[activeConfigPlayerId];
      if (!currentConfig || !currentConfig.name) {
          toast({ variant: 'destructive', title: "No Plan Selected", description: "Select a plan for the active player first." });
          return;
      }

      const now = new Date();
      const finalPlayers = selectedPlayers.map(p => {
          const isGuest = p.id.startsWith('guest-');
          let configToUse = { ...currentConfig };
          
          if (isGuest && (currentConfig.mode === 'recharge' || currentConfig.mode === 'buy-recharge')) {
              configToUse = configs[p.id] || { mode: 'walkin', name: 'Standard Session', duration: 3600, price: 100 };
          }

          if (!configToUse || !configToUse.name) return null;

          const durationSeconds = configToUse.reminderDuration || configToUse.duration || 0;
          const endTime = durationSeconds > 0 ? new Date(now.getTime() + durationSeconds * 1000).toISOString() : null;
          
          return { 
              ...p, 
              rechargeId: configToUse.rechargeId || null, 
              packageId: configToUse.packageId || null, 
              isNewRecharge: configToUse.mode === 'buy-recharge',
              startTime: now.toISOString(),
              endTime: endTime,
              status: 'active' as const,
              remainingTimeOnPause: null
          };
      }).filter(p => !!p) as AssignedMember[];

      if (finalPlayers.length === 0) {
          toast({ variant: 'destructive', title: "Invalid Setup", description: "At least one player must have a valid configuration." });
          return;
      }

      let minDuration = 24 * 3600; 
      let sessionName = currentConfig.name || "Mixed Session";
      
      const virtualPackage: GamingPackage = { id: 'mixed-session', name: sessionName, duration: minDuration, price: 0, validity: 1 };
      onConfirm(finalPlayers, virtualPackage);
  };

  const allPlayersConfigured = useMemo(() => {
      if (selectedPlayers.length === 0) return false;
      return selectedPlayers.every(p => configs[p.id]?.name != null);
  }, [selectedPlayers, configs]);

  const handleConfirmAll = () => {
      if (!allPlayersConfigured) return;
      const now = new Date();
      
      const finalPlayers = selectedPlayers.map(p => {
          const config = configs[p.id];
          const durationSeconds = config.reminderDuration || config.duration || 0;
          const endTime = durationSeconds > 0 ? new Date(now.getTime() + durationSeconds * 1000).toISOString() : null;
          
          return { 
              ...p, 
              rechargeId: config.rechargeId || null, 
              packageId: config.packageId || null, 
              isNewRecharge: config.mode === 'buy-recharge',
              startTime: now.toISOString(),
              endTime: endTime,
              status: 'active' as const,
              remainingTimeOnPause: null
          };
      });

      let minDuration = 24 * 3600; 
      let sessionName = "Mixed Session";
      Object.values(configs).forEach(c => {
          const dur = c.reminderDuration || c.duration;
          if (dur && dur < minDuration) { minDuration = dur; sessionName = c.name || sessionName; }
      });

      const virtualPackage: GamingPackage = { id: 'mixed-session', name: sessionName, duration: minDuration, price: 0, validity: 1 };
      onConfirm(finalPlayers, virtualPackage);
  };

  if (!station) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[98vw] sm:max-w-2xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl bg-card font-body">
        <DialogHeader className="px-4 pt-4 pb-2 relative shrink-0 border-b bg-muted/5">
          <DialogTitle className="font-headline text-xl sm:text-2xl text-primary tracking-tight uppercase">
              {step === 'selection' ? 'ASSIGN PLAYERS' : 'CONFIGURE LOGINS'}
          </DialogTitle>
          <DialogDescription className="text-xs uppercase font-bold text-muted-foreground opacity-60">
            {station.name} &bull; {selectedPlayers.length} / {playerLimit} PLAYERS
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col overflow-hidden">
            {step === 'selection' && (
                <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-4 duration-300">
                    <div className="p-3 sm:p-4 flex-1 flex flex-col min-h-0">
                        <div className="space-y-3 shrink-0 mb-4">
                            <h3 className="text-xs font-bold text-foreground uppercase tracking-normal opacity-80">1. MEMBER SELECTION</h3>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="SEARCH MEMBERS..." className="pl-10 h-10 border-2 bg-muted/5 text-xs font-bold uppercase" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} disabled={selectedPlayers.length >= playerLimit} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Button 
                                    onClick={handleAddGuest} 
                                    disabled={selectedPlayers.length >= playerLimit} 
                                    variant="outline" 
                                    className="h-10 border-2 uppercase text-xs font-bold gap-2 bg-emerald-500/5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                >
                                    <UserPlus className="h-4 w-4" /> GUEST
                                </Button>
                                <AddMemberModal onAddMember={(data) => {
                                    addMember({ ...data.memberData, level: 1, xp: 0, points: 0, totalSpent: 0, joinDate: new Date().toISOString(), avatarUrl: data.avatarUrl }, data.referrerId).then(id => {
                                        if (id) handleAddPlayer({ id, name: data.memberData.name, avatarUrl: data.avatarUrl } as any);
                                    });
                                }} triggerButton={
                                    <Button 
                                        disabled={selectedPlayers.length >= playerLimit} 
                                        variant="outline" 
                                        className="h-10 border-2 uppercase text-xs font-bold gap-2 bg-emerald-500/5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                    >
                                        <UserPlus2 className="h-4 w-4" /> MEMBER
                                    </Button>
                                } />
                            </div>
                        </div>
                        <ScrollArea className="flex-1 border-2 rounded-xl bg-muted/5 min-h-0 mb-4">
                            <div className="p-1.5 space-y-1">
                                {filteredMembers.map(member => {
                                    const balance = getMemberTotalBalance(member);
                                    return (
                                        <div key={member.id} className={cn("w-full p-2.5 rounded-lg hover:bg-primary/5 flex items-center gap-3 transition-colors group cursor-pointer", selectedPlayers.length >= playerLimit && "opacity-50 cursor-not-allowed")} onClick={() => selectedPlayers.length < playerLimit && handleAddPlayer(member)}>
                                            <Avatar className="h-10 w-10 border-2 border-primary/10"><AvatarImage src={member.avatarUrl} /><AvatarFallback>{member.name[0]}</AvatarFallback></Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold uppercase leading-none truncate text-foreground">{member.name}</p>
                                                <p className="text-[10px] text-muted-foreground font-bold uppercase mt-1">@{member.username}</p>
                                            </div>
                                            {balance > 0 && <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 text-[10px] font-bold uppercase"><Zap className="h-3 w-3 fill-current" />{formatPackageDuration(balance)}</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                        <div className="space-y-2 shrink-0">
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-normal pl-1">SESSION TRAY ({selectedPlayers.length}/{playerLimit})</h3>
                            <div className="flex flex-wrap gap-2 p-2.5 rounded-xl bg-muted/10 min-h-[60px] border-2 border-dashed border-muted-foreground/20">
                                {selectedPlayers.map((player, pIdx) => (
                                    <div key={`${player.id}-${pIdx}`} className="flex items-center gap-2 p-1 pr-3 rounded-full bg-card border-2 shadow-sm animate-in zoom-in-95 duration-200">
                                        <Avatar className="h-6 w-6"><AvatarImage src={player.avatarUrl} /><AvatarFallback className="text-[10px] font-bold">{player.name[0]}</AvatarFallback></Avatar>
                                        <span className="text-xs font-bold uppercase truncate max-w-[80px] text-foreground">{player.name}</span>
                                        <button onClick={() => handleRemovePlayer(player.id)} className="ml-1 opacity-40 hover:opacity-100 transition-opacity"><X className="h-3.5 w-3.5 text-destructive"/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-4 shrink-0 bg-muted/5 border-t">
                        <Button onClick={() => { setStep('configuration'); if (selectedPlayers.length > 0) setActiveConfigPlayerId(selectedPlayers[0].id); }} disabled={selectedPlayers.length === 0} className="w-full font-headline text-xs h-12 uppercase shadow-xl">CONTINUE TO LOGINS <ChevronRight className="ml-2 h-4 w-4" /></Button>
                    </DialogFooter>
                </div>
            )}

            {step === 'configuration' && (
                <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="p-3 sm:p-4 flex-1 flex flex-col min-h-0 overflow-hidden">
                        <div className="flex items-center justify-between shrink-0 mb-3">
                            <h3 className="text-xs font-bold text-foreground uppercase tracking-normal opacity-80">2. SESSION LOGINS</h3>
                            <Button variant="ghost" size="sm" onClick={() => setStep('selection')} className="h-8 uppercase text-[10px] font-bold text-muted-foreground hover:text-primary"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> CHANGE PLAYERS</Button>
                        </div>
                        <div className="space-y-1.5 mb-4 shrink-0 overflow-y-auto max-h-[30%] sm:max-h-[25%] border-b pb-3">
                            {selectedPlayers.map((player) => {
                                const config = configs[player.id];
                                const isSelected = activeConfigPlayerId === player.id;
                                const hasSelection = !!config?.name;
                                return (
                                    <div key={player.id} onClick={() => setActiveConfigPlayerId(player.id)} className={cn("p-2 rounded-lg border-2 transition-all cursor-pointer flex items-center justify-between", isSelected ? "border-primary bg-primary/[0.03] ring-2 ring-primary/10 shadow-md" : "border-muted hover:border-primary/20 bg-card", hasSelection && !isSelected && "border-green-500/30 opacity-80")}>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8 border-2 border-background shadow-sm"><AvatarImage src={player.avatarUrl} /><AvatarFallback className="text-xs font-bold">{player.name[0]}</AvatarFallback></Avatar>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold uppercase leading-tight truncate">{player.name}</p>
                                                {hasSelection ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold uppercase text-green-600 block truncate max-w-[140px]">{config.name}</span>
                                                        {config.reminderDuration && <Badge className="h-4 text-[9px] font-bold bg-amber-500">{formatPackageDuration(config.reminderDuration)}</Badge>}
                                                    </div>
                                                ) : <p className="text-[10px] text-muted-foreground font-bold uppercase">Tap to configure</p>}
                                            </div>
                                        </div>
                                        {hasSelection && !isSelected && <Badge variant="outline" className="h-5 px-2 text-[9px] font-bold bg-green-50 text-green-700 border-green-200 uppercase">READY</Badge>}
                                    </div>
                                );
                            })}
                        </div>
                        {activeConfigPlayerId && (
                            <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-hidden">
                                <div className="p-2 border-2 border-dashed rounded-2xl bg-muted/5 flex-1 flex flex-col overflow-hidden">
                                    <div className="flex items-center justify-between px-2 mb-2.5">
                                        <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-normal">LOGGING IN: <strong className="text-foreground">{selectedPlayers.find(p => p.id === activeConfigPlayerId)?.name}</strong></h4>
                                    </div>
                                    <div className="flex gap-3 mb-3 shrink-0">
                                        <Button variant={configs[activeConfigPlayerId]?.mode === 'recharge' ? 'default' : 'outline'} className="flex-1 h-10 uppercase text-xs font-bold gap-2 border-2" onClick={() => handleSetPlayerMode(activeConfigPlayerId, 'recharge')}><Zap className="h-4 w-4" /> RECHARGE</Button>
                                        <Button variant={configs[activeConfigPlayerId]?.mode === 'walkin' ? 'default' : 'outline'} className="flex-1 h-10 uppercase text-xs font-bold gap-2 border-2" onClick={() => handleSetPlayerMode(activeConfigPlayerId, 'walkin')}><Gamepad2 className="h-4 w-4" /> QUICK PLAY</Button>
                                    </div>
                                    <ScrollArea className="flex-1 bg-background/50 rounded-xl border-2 min-h-0">
                                        <div className="p-2.5 space-y-2.5 pb-12 font-body">
                                            {configs[activeConfigPlayerId]?.mode === 'recharge' ? (
                                                <div className="space-y-4">
                                                    {(() => {
                                                        const activeRecharges = getMemberActiveRecharges(activeConfigPlayerId);
                                                        const totalBalance = activeRecharges.reduce((sum, r) => sum + r.remainingDuration, 0);
                                                        const isSelected = configs[activeConfigPlayerId]?.rechargeId === 'pool';
                                                        if (totalBalance <= 0) return null;
                                                        return (
                                                            <div className={cn("p-4 rounded-xl border-2 bg-gradient-to-br from-yellow-50 to-white transition-all shadow-md", isSelected ? "border-yellow-500 ring-2 ring-yellow-500/20" : "border-yellow-200")}>
                                                                <div className="flex justify-between items-center">
                                                                    <div className="min-w-0">
                                                                        <p className="text-[10px] font-bold uppercase text-yellow-700 tracking-normal">TOTAL COMBINED BALANCE</p>
                                                                        <div className="flex items-center gap-2 text-2xl font-bold text-yellow-600 font-mono tracking-tighter"><Zap className="h-5 w-5 fill-current" /> {formatPackageDuration(totalBalance)}</div>
                                                                    </div>
                                                                    {!isSelected ? (
                                                                        <Button size="sm" onClick={() => handlePickConfig(activeConfigPlayerId, 'pool', true)} className="h-9 px-5 text-xs font-bold bg-yellow-500 text-black uppercase shadow-lg hover:bg-yellow-600">
                                                                            Use Pool
                                                                        </Button>
                                                                    ) : (
                                                                        <Badge className="bg-green-600 text-xs font-bold uppercase h-6 shadow-sm">
                                                                            <CheckCircle2 className="h-4 w-4 mr-1.5"/> Selected
                                                                        </Badge>
                                                                    )}
                                                                </div>

                                                                {isSelected && (
                                                                    <div className="mt-4 pt-4 border-t border-yellow-200/50 space-y-3 animate-in slide-in-from-top-2 duration-300">
                                                                        <p className="text-[9px] font-black uppercase text-yellow-700 tracking-widest px-1">Duration to Deduct</p>
                                                                        <div className="grid grid-cols-4 gap-1.5">
                                                                            {[1800, 3600, 7200].map(s => {
                                                                                const isCurrent = configs[activeConfigPlayerId].reminderDuration === s;
                                                                                return (
                                                                                    <Button 
                                                                                        key={s} 
                                                                                        variant="outline" 
                                                                                        size="sm" 
                                                                                        className={cn(
                                                                                            "h-8 text-[10px] font-bold border-yellow-200 text-yellow-700 hover:bg-yellow-500 hover:text-white transition-all",
                                                                                            isCurrent && "bg-yellow-500 text-white border-yellow-500"
                                                                                        )}
                                                                                        onClick={() => handleSetPoolDuration(activeConfigPlayerId, s)}
                                                                                        disabled={s > totalBalance}
                                                                                    >
                                                                                        {formatPackageDuration(s)}
                                                                                    </Button>
                                                                                );
                                                                            })}
                                                                            <Button 
                                                                                variant="outline" 
                                                                                size="sm" 
                                                                                className={cn(
                                                                                    "h-8 text-[10px] font-bold border-yellow-200 text-yellow-700 hover:bg-yellow-500 hover:text-white transition-all",
                                                                                    configs[activeConfigPlayerId].reminderDuration === totalBalance && "bg-yellow-500 text-white border-yellow-500"
                                                                                )}
                                                                                onClick={() => handleSetPoolDuration(activeConfigPlayerId, totalBalance)}
                                                                            >
                                                                                FULL
                                                                            </Button>
                                                                        </div>
                                                                        
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="relative flex-1">
                                                                                <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-yellow-600 opacity-50" />
                                                                                <Input 
                                                                                    type="number" 
                                                                                    placeholder="Custom Mins..." 
                                                                                    className="h-8 pl-7 text-[10px] font-bold border-yellow-200 bg-white/50 focus-visible:ring-yellow-500"
                                                                                    onChange={(e) => {
                                                                                        const mins = parseInt(e.target.value);
                                                                                        if (mins > 0) {
                                                                                            const secs = Math.min(mins * 60, totalBalance);
                                                                                            handleSetPoolDuration(activeConfigPlayerId, secs);
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                            {configs[activeConfigPlayerId].reminderDuration && (
                                                                                <div className="text-[10px] font-black text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                                                                                    USING: {formatPackageDuration(configs[activeConfigPlayerId].reminderDuration!)}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                    <div className="space-y-2.5">
                                                        <p className="text-[10px] font-bold uppercase text-muted-foreground px-1 tracking-normal">INDIVIDUAL PACKS</p>
                                                        {getMemberActiveRecharges(activeConfigPlayerId).map((r, rIdx) => {
                                                            const isSelected = configs[activeConfigPlayerId]?.rechargeId === r.id;
                                                            return (
                                                                <div key={`${r.id}-${rIdx}`} className={cn("p-3 rounded-lg border-2 bg-card transition-all", isSelected ? "border-primary bg-primary/5" : "border-muted opacity-60")}>
                                                                    <div className="flex justify-between items-center">
                                                                        <div className="min-w-0">
                                                                            <p className="text-xs font-bold uppercase truncate opacity-80">{r.packageName}</p>
                                                                            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase"><Clock className="h-3 w-3" /> {formatPackageDuration(r.remainingDuration)} LEFT</div>
                                                                        </div>
                                                                        <Button size="sm" variant="ghost" onClick={() => handlePickConfig(activeConfigPlayerId, r, true)} className="h-7 px-3 text-[10px] font-bold uppercase hover:bg-primary/10">Select</Button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <div className="pt-3">
                                                        <p className="text-[10px] font-bold uppercase text-muted-foreground text-center mb-3 tracking-normal border-t pt-3">--- BUY NEW PACK ---</p>
                                                        <div className="space-y-2">
                                                            {rechargePackages.map(pkg => (
                                                                <div key={pkg.id} onClick={() => handlePickConfig(activeConfigPlayerId, pkg, false, true)} className="p-3 rounded-xl border-2 border-dashed hover:border-yellow-500 transition-all cursor-pointer flex justify-between items-center bg-card shadow-sm group">
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-bold uppercase truncate group-hover:text-yellow-600">{pkg.name}</p>
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase">{formatPackageDuration(pkg.duration)} &bull; {pkg.validity} Days</p>
                                                                            {pkg.playerCapacity && pkg.playerCapacity > 1 && <Badge variant="outline" className="h-4 text-[8px] border-primary/20 text-primary uppercase font-bold">{pkg.playerCapacity}P</Badge>}
                                                                        </div>
                                                                    </div>
                                                                    <span className="text-sm font-bold text-primary">₹{pkg.price}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : configs[activeConfigPlayerId]?.mode === 'walkin' ? (
                                                <div className="space-y-2.5">
                                                    {walkInPackages.map(pkg => (
                                                        <div key={pkg.id} onClick={() => handlePickConfig(activeConfigPlayerId, pkg, false)} className={cn(
                                                            "p-4 rounded-xl border-2 bg-card hover:border-primary/50 transition-all cursor-pointer group shadow-sm flex justify-between items-center",
                                                            pkg.isPriorityOffer && "border-amber-500/30 bg-amber-500/[0.02] ring-1 ring-amber-500/10"
                                                        )}>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <p className={cn("text-xs font-bold uppercase truncate group-hover:text-primary", pkg.isPriorityOffer && "text-amber-600")}>
                                                                        {pkg.name}
                                                                        {pkg.isPriorityOffer && <Star className="inline h-3 w-3 ml-1.5 fill-amber-500 text-amber-500" />}
                                                                    </p>
                                                                    {pkg.playerCapacity && pkg.playerCapacity > 1 ? <Badge variant="outline" className="h-4 text-[8px] bg-primary/5 border-primary/30 text-primary font-black uppercase flex items-center gap-1"><Users className="h-2 w-2" />{pkg.playerCapacity}P</Badge> : <Badge variant="outline" className="h-4 text-[8px] border-muted text-muted-foreground uppercase flex items-center gap-1"><User className="h-2 w-2" />1P</Badge>}
                                                                </div>
                                                                <p className="text-[10px] font-bold text-primary mt-1 uppercase tracking-normal flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {formatPackageDuration(pkg.duration)}</p>
                                                            </div>
                                                            <span className="font-mono font-bold text-base text-foreground">₹{pkg.price}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : <div className="h-40 flex items-center justify-center opacity-30 italic text-xs font-bold uppercase tracking-normal text-center px-10">Choose a login type above</div>}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="p-4 shrink-0 bg-muted/5 border-t flex flex-col sm:flex-row-reverse gap-3">
                        <Button 
                            onClick={handleApplyAllAndStart} 
                            disabled={!activeConfigPlayerId || !configs[activeConfigPlayerId]?.name}
                            className="flex-1 font-display text-base h-14 uppercase tracking-tight shadow-2xl transition-all active:scale-[0.98] gap-2"
                        >
                            <Users2 className="h-5 w-5" /> APPLY TO ALL AND START
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={handleConfirmAll}
                            disabled={!allPlayersConfigured}
                            className="flex-1 font-display text-base h-14 uppercase tracking-tight shadow-sm transition-all active:scale-[0.98] border-2"
                        >
                            START SESSION
                        </Button>
                    </DialogFooter>
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
