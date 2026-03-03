
'use client';
import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, Clock, IndianRupee, Minus, Sparkles, History, Users, CheckCircle2, User } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { GamingPackage, Station, AssignedMember } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';

interface EditTimeModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAddTime: (pkg: GamingPackage, quantity: number, targetIds: string[]) => void;
  onReduceTime: (minutes: number, targetIds: string[]) => void;
  gamingPackages: GamingPackage[];
  station: Station | null;
}

const formatPackageDuration = (totalSeconds: number) => {
    if (!totalSeconds || totalSeconds < 0) return '0m';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);
    return parts.length > 0 ? parts.join(' ') : '0m';
};

export function EditTimeModal({ isOpen, onOpenChange, onAddTime, onReduceTime, gamingPackages, station }: EditTimeModalProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<'add' | 'reduce'>('add');
  
  // Selection State
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

  // Add Time State
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [customMinutes, setCustomMinutes] = useState('');
  const [customPrice, setCustomPrice] = useState('');

  // Reduce Time State
  const [reduceValue, setReduceValue] = useState('30');
  const [reduceCustomAmount, setReduceCustomAmount] = useState('');

  // SHOW ALL MEMBERS (including finished ones) so they can be reactivated
  const allStationMembers = useMemo(() => 
    station?.members || [], 
  [station]);

  useEffect(() => {
    if (isOpen && allStationMembers.length > 0) {
      // Default to selecting only currently active members
      const activeIds = allStationMembers.filter(m => m.status !== 'finished').map(m => m.id);
      setSelectedPlayerIds(activeIds);
      
      setSelectedPackageId(null);
      setCustomMinutes('');
      setCustomPrice('');
      setReduceValue('30');
      setReduceCustomAmount('');
    }
  }, [isOpen, allStationMembers]);

  const togglePlayer = (id: string) => {
    setSelectedPlayerIds(prev => 
        prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const selectAllPlayers = () => {
    setSelectedPlayerIds(allStationMembers.map(m => m.id));
  };

  const addTimePackages = useMemo(() => {
    return gamingPackages.filter(p => p.isAddTimePackage);
  }, [gamingPackages]);

  const selectedPackage = useMemo(() => {
    return addTimePackages.find(p => p.id === selectedPackageId);
  }, [addTimePackages, selectedPackageId]);

  const handleConfirmAdd = () => {
    if (selectedPlayerIds.length === 0) {
        toast({ variant: 'destructive', title: "No Players Selected", description: "Please select who to add time for." });
        return;
    }

    if (selectedPackageId === 'custom') {
        const mins = parseInt(customMinutes, 10);
        const price = parseInt(customPrice, 10) || 0;
        if (mins > 0) {
            onAddTime({
                id: 'custom-' + Date.now(),
                name: `Custom (${mins}m)`,
                duration: mins * 60,
                price: price,
                validity: 1,
                isAddTimePackage: true
            }, selectedPlayerIds.length, selectedPlayerIds);
        }
    } else if (selectedPackage) {
        onAddTime(selectedPackage, selectedPlayerIds.length, selectedPlayerIds);
    }
    onOpenChange(false);
  };

  const handleConfirmReduce = () => {
    if (selectedPlayerIds.length === 0) {
        toast({ variant: 'destructive', title: "No Players Selected" });
        return;
    }

    const minutes = parseInt(reduceValue === 'custom' ? reduceCustomAmount : reduceValue, 10);
    if (isNaN(minutes) || minutes <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount' });
      return;
    }
    onReduceTime(minutes, selectedPlayerIds);
    onOpenChange(false);
  };
  
  const canConfirmAdd = (selectedPackageId === 'custom' ? (parseInt(customMinutes, 10) > 0) : !!selectedPackageId) && selectedPlayerIds.length > 0;

  const reduceOptions = [
    { value: '15', label: '15 minutes' },
    { value: '30', label: '30 minutes' },
    { value: '60', label: '60 minutes' },
    { value: 'custom', label: 'Custom Amount' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="px-6 pt-6 pb-2 border-b bg-muted/5">
          <DialogTitle className="font-headline text-xl sm:text-2xl text-primary tracking-tighter">EDIT TIMER: {station?.name}</DialogTitle>
          <DialogDescription className="font-black uppercase text-[8px] tracking-[0.2em] text-muted-foreground">Adjust session duration for active or stopped players.</DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-4">
            {/* TARGET SELECTION */}
            <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <Users className="h-3 w-3" />
                        Target Players
                    </Label>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={selectAllPlayers}
                        className="h-6 px-2 text-[8px] font-black uppercase tracking-tighter hover:text-primary"
                    >
                        FOR ALL PLAYERS
                    </Button>
                </div>
                <div className="flex flex-wrap gap-2 p-3 rounded-xl border-2 border-dashed bg-muted/5">
                    {allStationMembers.map(member => {
                        const isSelected = selectedPlayerIds.includes(member.id);
                        const isFinished = member.status === 'finished';
                        return (
                            <button
                                key={member.id}
                                onClick={() => togglePlayer(member.id)}
                                className={cn(
                                    "flex items-center gap-2 px-2 py-1.5 rounded-full border-2 transition-all",
                                    isSelected 
                                        ? "bg-primary border-primary text-white shadow-md scale-105" 
                                        : "bg-background border-muted text-muted-foreground opacity-60 hover:opacity-100",
                                    isFinished && !isSelected && "border-dashed grayscale opacity-40"
                                )}
                            >
                                <Avatar className="h-5 w-5 border border-background/20">
                                    <AvatarImage src={member.avatarUrl} />
                                    <AvatarFallback className="text-[8px] font-black">{member.name[0]}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col items-start leading-none">
                                    <span className="text-[9px] font-black uppercase tracking-tight truncate max-w-[80px]">{member.name}</span>
                                    {isFinished && (
                                        <span className="text-[6px] font-black uppercase text-destructive tracking-widest mt-0.5">STOPPED</span>
                                    )}
                                </div>
                                {isSelected && <CheckCircle2 className="h-2.5 w-2.5" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as 'add' | 'reduce')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-muted/20 h-12 p-1 rounded-xl">
                    <TabsTrigger value="add" className="font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm">Add Time</TabsTrigger>
                    <TabsTrigger value="reduce" className="font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm">Reduce Time</TabsTrigger>
                </TabsList>

                <TabsContent value="add" className="space-y-4 pt-4 animate-in fade-in slide-in-from-left-2 duration-300">
                    <RadioGroup value={selectedPackageId || ''} onValueChange={setSelectedPackageId} className="space-y-2">
                        <ScrollArea className="h-56 pr-3">
                            {addTimePackages.map(pkg => (
                                <Label 
                                    key={pkg.id}
                                    className={cn(
                                        "flex items-center justify-between p-3.5 rounded-xl border-2 transition-all cursor-pointer bg-card mb-2",
                                        selectedPackageId === pkg.id ? "border-primary ring-2 ring-primary/10 shadow-md" : "hover:border-primary/20 border-muted"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <RadioGroupItem value={pkg.id} id={pkg.id} />
                                        <div className="space-y-0.5">
                                            <p className="font-black text-[11px] uppercase tracking-tight">{pkg.name}</p>
                                            <div className="flex items-center gap-2 text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                                                <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {formatPackageDuration(pkg.duration)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <span className="font-mono font-black text-sm text-primary">₹{pkg.price}</span>
                                </Label>
                            ))}

                            <Label 
                                className={cn(
                                    "flex items-center gap-3 p-3.5 rounded-xl border-2 border-dashed transition-all cursor-pointer bg-card",
                                    selectedPackageId === 'custom' ? "border-primary ring-2 ring-primary/10 bg-primary/[0.02]" : "hover:border-primary/20 border-muted"
                                )}
                            >
                                <RadioGroupItem value="custom" id="custom-option" />
                                <div className="flex-1">
                                    <p className="font-black text-[11px] uppercase tracking-tight flex items-center gap-2"><Sparkles className="h-3 w-3 text-yellow-500"/> Custom Duration</p>
                                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Manual entry</p>
                                </div>
                            </Label>

                            {selectedPackageId === 'custom' && (
                                <div className="p-3 border-2 border-dashed rounded-xl bg-muted/10 space-y-3 mt-2 animate-in zoom-in-95 duration-200">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[8px] font-black uppercase tracking-widest opacity-50 pl-1">Minutes</Label>
                                            <Input type="number" value={customMinutes} onChange={e => setCustomMinutes(e.target.value)} placeholder="0" className="h-9 font-mono font-black text-xs" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[8px] font-black uppercase tracking-widest opacity-50 pl-1">Price / Player</Label>
                                            <Input type="number" value={customPrice} onChange={e => setCustomPrice(e.target.value)} placeholder="0" className="h-9 font-mono font-black text-xs" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </ScrollArea>
                    </RadioGroup>

                    <div className="pt-2 border-t border-dashed">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">BILLING PREVIEW</p>
                                <p className="text-[10px] font-bold text-foreground uppercase">{selectedPlayerIds.length} Packages to be Added</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xl font-black text-primary font-mono tracking-tighter">
                                    ₹{((selectedPackageId === 'custom' ? (parseInt(customPrice, 10) || 0) : (selectedPackage?.price || 0)) * selectedPlayerIds.length).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <Button onClick={handleConfirmAdd} className="w-full h-12 font-black uppercase tracking-[0.1em] shadow-xl" disabled={!canConfirmAdd}>
                        <Plus className="mr-2 h-4 w-4" /> Finalize Addition
                    </Button>
                </TabsContent>

                <TabsContent value="reduce" className="space-y-4 pt-4 animate-in fade-in slide-in-from-right-2 duration-300">
                    <RadioGroup value={reduceValue} onValueChange={setReduceValue} className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            {reduceOptions.map((opt) => (
                                <Label 
                                    key={opt.value}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer bg-card text-center",
                                        reduceValue === opt.value ? "border-destructive bg-destructive/[0.03] ring-2 ring-destructive/10" : "hover:border-destructive/20 border-muted"
                                    )}
                                >
                                    <RadioGroupItem value={opt.value} id={`reduce-${opt.value}`} className="sr-only" />
                                    <History className={cn("h-5 w-5 mb-1.5", reduceValue === opt.value ? "text-destructive" : "text-muted-foreground")} />
                                    <span className="font-black uppercase text-[10px] tracking-tight">{opt.label}</span>
                                </Label>
                            ))}
                        </div>
                    </RadioGroup>

                    {reduceValue === 'custom' && (
                        <div className="p-4 border-2 border-dashed rounded-xl bg-destructive/[0.02] space-y-2 animate-in slide-in-from-top-2 duration-200">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-destructive/70 px-1">Minutes to Subtract</Label>
                            <Input 
                                type="number"
                                placeholder="ENTER MINUTES..."
                                value={reduceCustomAmount}
                                onChange={(e) => setReduceCustomAmount(e.target.value)}
                                className="h-10 font-black font-mono text-center border-destructive/20 focus-visible:ring-destructive"
                            />
                        </div>
                    )}

                    <div className="pt-2 border-t border-dashed">
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">IMPACT</p>
                        <p className="text-[10px] font-bold text-foreground uppercase">Subtracting from {selectedPlayerIds.length} players' timers.</p>
                    </div>

                    <Button variant="destructive" onClick={handleConfirmReduce} className="w-full h-12 font-black uppercase tracking-[0.1em] shadow-xl" disabled={selectedPlayerIds.length === 0 || (reduceValue === 'custom' && !reduceCustomAmount)}>
                        <Minus className="mr-2 h-4 w-4" /> Subtract Time
                    </Button>
                </TabsContent>
            </Tabs>
        </div>
        <div className="h-2 bg-muted/5 border-t shrink-0" />
      </DialogContent>
    </Dialog>
  );
}
