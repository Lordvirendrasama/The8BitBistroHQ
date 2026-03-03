
'use client';

import { useState, useEffect } from 'react';
import type { GamingPackage, GamingPackageFormData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save, User, Users, Star, Dice5 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

interface GamingPackageFormModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (formData: GamingPackageFormData) => void;
  pkg: GamingPackage | null;
}

const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function GamingPackageFormModal({ isOpen, onOpenChange, onSave, pkg }: GamingPackageFormModalProps) {
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [price, setPrice] = useState('');
  const [validity, setValidity] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [isFullDay, setIsFullDay] = useState(true);
  const [isAddTimePackage, setIsAddTimePackage] = useState(false);
  const [isRechargePack, setIsRechargePack] = useState(false);
  const [playerCapacity, setPlayerCapacity] = useState('1');
  const [isPriorityOffer, setIsPriorityOffer] = useState(false);
  const [isBoardGamePass, setIsBoardGamePass] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    if (isOpen) {
      if (pkg) {
        setName(pkg.name ?? '');

        const totalSeconds = pkg.duration ?? 0;
        setMinutes(String(Math.floor(totalSeconds / 60)));
        setSeconds(String(totalSeconds % 60));
        
        setPrice(pkg.price != null ? String(pkg.price) : '');
        setValidity(pkg.validity != null ? String(pkg.validity) : '');
        
        const fullDay = !pkg.startTime && !pkg.endTime;
        setIsFullDay(fullDay);
        setStartTime(pkg.startTime || '');
        setEndTime(pkg.endTime || '');

        setAvailableDays((pkg.availableDays && pkg.availableDays.length > 0) ? pkg.availableDays : daysOfWeek);
        setIsAddTimePackage(pkg.isAddTimePackage || false);
        setIsRechargePack(pkg.isRechargePack || false);
        setPlayerCapacity(String(pkg.playerCapacity || 1));
        setIsPriorityOffer(pkg.isPriorityOffer || false);
        setIsBoardGamePass(pkg.isBoardGamePass || false);

      } else {
        setName('');
        setMinutes('');
        setSeconds('0');
        setPrice('');
        setValidity('1');
        setStartTime('');
        setEndTime('');
        setAvailableDays(daysOfWeek);
        setIsFullDay(true);
        setIsAddTimePackage(false);
        setIsRechargePack(false);
        setPlayerCapacity('1');
        setIsPriorityOffer(false);
        setIsBoardGamePass(false);
      }
    }
  }, [pkg, isOpen]);

  const handleSave = () => {
    const numMinutes = parseInt(minutes, 10) || 0;
    const numSeconds = parseInt(seconds, 10) || 0;
    const totalDurationInSeconds = (numMinutes * 60) + numSeconds;
    
    const numPrice = parseInt(price, 10);
    const numValidity = parseInt(validity, 10);
    const numCapacity = parseInt(playerCapacity, 10);

    if (!name || totalDurationInSeconds <= 0 || isNaN(numPrice) || numPrice < 0 || isNaN(numValidity) || numValidity <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Information',
        description: 'Please fill out all fields with valid values. Duration and validity must be positive numbers.',
      });
      return;
    }

    const formData: GamingPackageFormData = {
        name,
        duration: totalDurationInSeconds,
        price: numPrice,
        validity: numValidity,
        startTime: isFullDay ? undefined : startTime,
        endTime: isFullDay ? undefined : endTime,
        availableDays: availableDays.length === 7 ? [] : availableDays,
        isAddTimePackage,
        isRechargePack,
        playerCapacity: numCapacity,
        isPriorityOffer,
        isBoardGamePass
    };

    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden font-body">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="font-headline tracking-wide text-2xl">
            {pkg ? 'Edit Package' : 'New Package'}
          </DialogTitle>
          <DialogDescription className="font-bold text-[10px] uppercase tracking-widest">
            {pkg ? `Updating configuration for ${pkg.name}.` : 'Define a new gaming or recharge offer.'}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] px-6 py-4">
            <div className="grid gap-6">
                <div className="space-y-2">
                    <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Package Title</Label>
                    <Input 
                        id="name" 
                        placeholder="e.g. 10 HOUR RECHARGE"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="font-bold h-12 uppercase"
                    />
                </div>

                <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Player Capacity</Label>
                    <RadioGroup value={playerCapacity} onValueChange={setPlayerCapacity} className="grid grid-cols-2 gap-4">
                        <Label 
                            htmlFor="cap-1"
                            className={cn(
                                "flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer",
                                playerCapacity === '1' ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "hover:border-primary/20 bg-card"
                            )}
                        >
                            <RadioGroupItem value="1" id="cap-1" className="sr-only" />
                            <User className={cn("h-5 w-5", playerCapacity === '1' ? "text-primary" : "text-muted-foreground")} />
                            <span className="font-black text-xs uppercase">Single Player</span>
                        </Label>
                        <Label 
                            htmlFor="cap-2"
                            className={cn(
                                "flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer",
                                playerCapacity === '2' ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "hover:border-primary/20 bg-card"
                            )}
                        >
                            <RadioGroupItem value="2" id="cap-2" className="sr-only" />
                            <Users className={cn("h-5 w-5", playerCapacity === '2' ? "text-primary" : "text-muted-foreground")} />
                            <span className="font-black text-xs uppercase">Duo (2 Players)</span>
                        </Label>
                    </RadioGroup>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 p-4 rounded-xl bg-muted/20 border-2 border-dashed">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-2">Duration</Label>
                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                <Label htmlFor="duration-minutes" className="text-[8px] font-bold uppercase opacity-50">MINS</Label>
                                <Input 
                                    id="duration-minutes" type="number" 
                                    value={minutes} onChange={(e) => setMinutes(e.target.value)} 
                                    className="font-mono font-bold text-lg h-10"
                                />
                            </div>
                            <div className="flex-1">
                                <Label htmlFor="duration-seconds" className="text-[8px] font-bold uppercase opacity-50">SECS</Label>
                                <Input 
                                    id="duration-seconds" type="number" 
                                    value={seconds} onChange={(e) => setSeconds(e.target.value)} 
                                    className="font-mono font-bold text-lg h-10"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-2 p-4 rounded-xl bg-primary/5 border-2 border-primary/20">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary block mb-2">Pricing & Validity</Label>
                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                <Label htmlFor="price" className="text-[8px] font-bold uppercase text-primary/60">PRICE (₹)</Label>
                                <Input 
                                    id="price" type="number" 
                                    value={price} onChange={(e) => setPrice(e.target.value)} 
                                    className="font-mono font-bold text-lg h-10 border-primary/20"
                                />
                            </div>
                            <div className="flex-1">
                                <Label htmlFor="validity" className="text-[8px] font-bold uppercase text-primary/60">DAYS</Label>
                                <Input 
                                    id="validity" type="number" 
                                    value={validity} onChange={(e) => setValidity(e.target.value)} 
                                    className="font-mono font-bold text-lg h-10 border-primary/20"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 rounded-xl border-2 space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Special Attributes</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Label htmlFor="priority-offer" className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer",
                            isPriorityOffer ? "bg-amber-500/10 border-amber-500" : "hover:bg-muted"
                        )}>
                            <Checkbox id="priority-offer" checked={isPriorityOffer} onCheckedChange={(v) => setIsPriorityOffer(!!v)} />
                            <div>
                                <p className="text-xs font-black uppercase tracking-tight">Priority Offer</p>
                                <p className="text-[8px] font-bold opacity-60">Push to top of list</p>
                            </div>
                        </Label>

                        <Label htmlFor="recharge-pkg" className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer",
                            isRechargePack ? "bg-yellow-500/10 border-yellow-500" : "hover:bg-muted"
                        )}>
                            <Checkbox id="recharge-pkg" checked={isRechargePack} onCheckedChange={(v) => setIsRechargePack(!!v)} />
                            <div>
                                <p className="text-xs font-black uppercase tracking-tight">Recharge Pack</p>
                                <p className="text-[8px] font-bold opacity-60">Visible in Recharge Hub</p>
                            </div>
                        </Label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <Label htmlFor="add-time-pkg" className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer",
                            isAddTimePackage ? "bg-primary/10 border-primary" : "hover:bg-muted"
                        )}>
                            <Checkbox id="add-time-pkg" checked={isAddTimePackage} onCheckedChange={(v) => setIsAddTimePackage(!!v)} />
                            <div>
                                <p className="text-xs font-black uppercase tracking-tight">Add Time Only</p>
                                <p className="text-[8px] font-bold opacity-60">Session extensions</p>
                            </div>
                        </Label>
                        <Label htmlFor="board-game-pass" className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer",
                            isBoardGamePass ? "bg-blue-500/10 border-blue-500" : "hover:bg-muted"
                        )}>
                            <Checkbox id="board-game-pass" checked={isBoardGamePass} onCheckedChange={(v) => setIsBoardGamePass(!!v)} />
                            <div>
                                <p className="text-xs font-black uppercase tracking-tight">Board Game Pass</p>
                                <p className="text-[8px] font-bold opacity-60">Table stations only</p>
                            </div>
                        </Label>
                    </div>
                </div>

                <div className="space-y-4 pt-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Availability Window</Label>
                    <div className="flex items-center gap-2 mb-2">
                        <Checkbox
                            id="all-days"
                            checked={availableDays.length === 7}
                            onCheckedChange={(checked) => setAvailableDays(checked ? daysOfWeek : [])}
                        />
                        <Label htmlFor="all-days" className="text-xs font-bold uppercase tracking-tight">Everyday Availability</Label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {daysOfWeek.map(day => (
                            <button 
                                key={day} 
                                onClick={() => {
                                    if (availableDays.includes(day)) setAvailableDays(prev => prev.filter(d => d !== day));
                                    else setAvailableDays(prev => [...prev, day]);
                                }}
                                className={cn(
                                    "px-3 py-1.5 rounded-full text-[9px] font-black uppercase transition-all border-2",
                                    availableDays.includes(day) ? "bg-primary border-primary text-white shadow-md" : "bg-muted/50 border-transparent text-muted-foreground hover:border-muted"
                                )}
                            >
                                {day}
                            </button>
                        ))}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1">
                            <Label htmlFor="start-time" className="text-[8px] font-bold uppercase opacity-50 pl-1">Starts At</Label>
                            <Input id="start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-10 font-bold" />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="end-time" className="text-[8px] font-bold uppercase opacity-50 pl-1">Ends At</Label>
                            <Input id="end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-10 font-bold" />
                        </div>
                    </div>
                </div>
            </div>
        </ScrollArea>
        <DialogFooter className="p-6 border-t bg-muted/10">
          <Button onClick={handleSave} className="w-full font-black uppercase tracking-widest h-14 text-lg shadow-xl">
            <Save className="mr-2 h-5 w-5" />
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
