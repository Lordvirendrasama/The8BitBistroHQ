
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase/auth/use-user';
import { useFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, doc, setDoc } from 'firebase/firestore';
import { Shield, Users, User, Zap, Clock, Calendar, Gamepad2, KeyRound, ArrowRight, Loader2, RefreshCcw, IndianRupee, TrendingUp } from 'lucide-react';
import { cn, isBusinessToday } from '@/lib/utils';
import type { GamingPackage, Employee, Bill, Station } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { APP_VERSION } from '@/lib/version';

export default function LoginPage() {
  const router = useRouter();
  const { db } = useFirebase();
  const { toast } = useToast();
  const { user, login, loading } = useAuth();
  
  const [isEntering, setIsEntering] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [currentTime, setCurrentTime] = useState(new Date());

  // PIN State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pendingUser, setPendingUser] = useState<Employee | null>(null);

  // Fetch Data
  const employeesQuery = useMemo(() => !db ? null : query(collection(db, 'employees'), where('isActive', '==', true)), [db]);
  const { data: rawEmployees, loading: empsLoading } = useCollection<Employee>(employeesQuery);

  const billsQuery = useMemo(() => !db ? null : collection(db, 'bills'), [db]);
  const { data: bills } = useCollection<Bill>(billsQuery);

  const stationsQuery = useMemo(() => !db ? null : collection(db, 'stations'), [db]);
  const { data: stations } = useCollection<Station>(stationsQuery);

  // Sort Employees: Viren first, then Admins, then alphabetical
  const employees = useMemo(() => {
    if (!rawEmployees) return [];
    return [...rawEmployees].sort((a, b) => {
        if (a.username === 'Viren') return -1;
        if (b.username === 'Viren') return 1;
        
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (b.role === 'admin' && a.role !== 'admin') return 1;
        
        return a.displayName.localeCompare(b.displayName);
    });
  }, [rawEmployees]);

  const todayCollection = useMemo(() => {
    if (!bills) return 0;
    return bills
      .filter(b => b.timestamp && isBusinessToday(b.timestamp))
      .reduce((s, b) => s + (b.totalAmount || 0), 0);
  }, [bills]);

  // Fetch Live Offers
  const packagesQuery = useMemo(() => !db ? null : collection(db, 'gamingPackages'), [db]);
  const { data: packages } = useCollection<GamingPackage>(packagesQuery);

  const projectedTotal = useMemo(() => {
    let sum = todayCollection;
    if (stations && packages) {
      stations.filter(s => s.status === 'in-use' || s.status === 'paused' || s.status === 'finishing').forEach(station => {
        sum += (station.currentBill || []).reduce((s, i) => s + (i.price * i.quantity), 0);
        
        if (station.packageName && station.packageName !== 'Walk-in Order') {
          const isItemized = (station.currentBill || []).some(item => 
            item.name === station.packageName || 
            item.name.startsWith(`Time: ${station.packageName}`) ||
            item.name.startsWith(`Buy Recharge: ${station.packageName}`) ||
            item.name.startsWith(`Recharge: ${station.packageName}`)
          );

          if (!isItemized) {
            const pureName = station.packageName.replace(/^(Recharge: |Buy Recharge: )/i, '').trim();
            const pkg = packages.find(p => p.name.toLowerCase() === pureName.toLowerCase());
            if (pkg) {
              const playerCount = station.members.length || 1;
              const capacity = pkg.playerCapacity || 1;
              const instances = Math.ceil(playerCount / capacity);
              if (!station.packageName.startsWith('Recharge: ')) {
                sum += (pkg.price * instances);
              }
            }
          }
        }
        sum -= (station.discount || 0);
      });
    }
    return Math.max(0, sum);
  }, [todayCollection, stations, packages]);

  // Clock Update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeOffers = useMemo(() => {
    if (!packages) return [];
    const day = currentTime.toLocaleDateString('en-US', { weekday: 'short' });
    const timeStr = currentTime.toTimeString().slice(0, 5);

    return packages.filter(pkg => {
      if (!pkg.isPriorityOffer) return false;
      if (pkg.isAddTimePackage || pkg.isRechargePack) return false;
      
      let isAvailable = true;
      if (pkg.availableDays && pkg.availableDays.length > 0 && !pkg.availableDays.includes(day)) isAvailable = false;
      if (isAvailable && pkg.startTime && timeStr < pkg.startTime) isAvailable = false;
      if (isAvailable && pkg.endTime && timeStr > pkg.endTime) isAvailable = false;
      return isAvailable;
    });
  }, [packages, currentTime]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const playChime = useCallback(() => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.5);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 1);
    } catch (e) {
      console.warn("Audio chime failed", e);
    }
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleLoginAttempt = (emp: Employee) => {
    setPendingUser(emp);
    setIsPinModalOpen(true);
  };

  const handleManualSeed = async () => {
    if (!db) return;
    setIsSeeding(true);
    try {
        const initial = [
            { username: 'Viren', displayName: 'Viren', role: 'admin', pin: '6969', salary: 0, salaryType: 'monthly', weekOffDay: 5, joinDate: new Date().toISOString(), isActive: true, photoURL: 'https://picsum.photos/seed/viren/100/100' },
            { username: 'Abbas', displayName: 'Abbas', role: 'staff', pin: '8888', salary: 100, salaryType: 'hourly', weekOffDay: 5, joinDate: new Date().toISOString(), isActive: true, photoURL: 'https://picsum.photos/seed/abbas/100/100' },
            { username: 'Guest', displayName: 'Guest', role: 'guest', pin: '1234', salary: 0, salaryType: 'hourly', weekOffDay: 0, joinDate: new Date().toISOString(), isActive: true, photoURL: 'https://picsum.photos/seed/guest/100/100' }
        ];
        
        for (const emp of initial) {
            const empDocRef = doc(db, 'employees', emp.username);
            await setDoc(empDocRef, emp);
        }
        
        toast({ title: "System Initialized", description: "Default profiles have been restored." });
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Recovery Failed", description: error.message });
    } finally {
        setIsSeeding(false);
    }
  };

  const executeLogin = async (username: string, pin: string) => {
    if (isEntering) return;
    setIsEntering(true);
    playChime();
    
    setTimeout(async () => {
      try {
        await login(username, pin);
        router.push('/dashboard');
      } catch (error: any) {
        setIsEntering(false);
        toast({
          variant: 'destructive',
          title: 'Entry Denied',
          description: error.message,
        });
      }
    }, 800);
  };

  const verifyPinAndLogin = () => {
    if (!pendingUser) return;
    executeLogin(pendingUser.username, pinInput);
    setIsPinModalOpen(false);
    setPinInput('');
  };

  if (loading || empsLoading || (user && !isEntering)) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-4">
            <Zap className="h-12 w-12 text-primary animate-pulse" />
            <p className="font-headline text-[10px] tracking-widest text-primary animate-pulse uppercase">Entering World...</p>
        </div>
      </div>
    );
  }

  const logoX = (mousePos.x - (typeof window !== 'undefined' ? window.innerWidth / 2 : 0)) / 30;
  const logoY = (mousePos.y - (typeof window !== 'undefined' ? window.innerHeight / 2 : 0)) / 30;

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className={cn(
      "relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-background transition-all duration-1000 p-4",
      isEntering ? "brightness-125" : "brightness-100"
    )}>
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute inset-0 z-2 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />

      <main className={cn(
        "relative z-10 w-full max-w-6xl flex flex-col items-center gap-6 sm:gap-10 transition-all duration-700",
        isEntering ? "opacity-0 scale-95 blur-xl" : "opacity-100 scale-100 blur-0"
      )}>
        <div className="w-full flex justify-between items-end px-2 animate-in fade-in slide-in-from-top-4 duration-1000">
            <div className="text-left">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    {currentTime.toLocaleDateString('en-US', { weekday: 'long' })}
                </p>
                <p className="text-sm font-bold uppercase tracking-tight text-foreground/80">
                    {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
            </div>
            
            <div className="flex items-center gap-6">
                <div className="text-right">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] flex items-center justify-end gap-2">
                        <IndianRupee className="h-3 w-3" />
                        Today's Intake
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold font-mono tracking-tighter tabular-nums leading-none text-emerald-500">
                        ₹{todayCollection.toLocaleString()}
                    </p>
                </div>
                <div className="text-right border-l border-foreground/10 pl-6">
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] flex items-center justify-end gap-2">
                        <TrendingUp className="h-3 w-3" />
                        Projected
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold font-mono tracking-tighter tabular-nums leading-none text-blue-500">
                        ₹{Math.floor(projectedTotal).toLocaleString()}
                    </p>
                </div>
                <div className="text-right border-l border-foreground/10 pl-6">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] flex items-center justify-end gap-2">
                        <Clock className="h-3 w-3" />
                        Live Terminal
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold font-mono tracking-tighter tabular-nums leading-none">
                        {currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                </div>
            </div>
        </div>

        <div 
          className="flex flex-col items-center animate-in fade-in zoom-in duration-1000 transition-transform duration-300 ease-out"
          style={{ transform: `translate(${logoX}px, ${logoY}px)` }}
        >
            <div className="relative h-24 w-24 sm:h-32 sm:w-32 drop-shadow-[0_0_25px_rgba(239,0,53,0.2)] hover:scale-110 transition-transform">
                <Image src="/logo.png" alt="The 8 Bit Bistro" width={128} height={128} className="object-contain" priority />
            </div>
            <p className="text-[10px] font-black font-mono mt-4 text-primary uppercase tracking-[0.2em] bg-primary/5 px-3 py-1 rounded-full border border-primary/10">Build v{APP_VERSION}</p>
        </div>

        {activeOffers.length > 0 && (
            <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <div className="bg-card/40 backdrop-blur-3xl border-2 border-emerald-500/10 rounded-3xl p-4 sm:p-6 shadow-lg relative overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-4 border-b border-foreground/5 pb-3">
                        <div className="flex items-center gap-2">
                            <Gamepad2 className="h-3 w-3 text-emerald-500" />
                            <span className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest">Power-Ups</span>
                        </div>
                        <Badge variant="outline" className="h-4 text-[8px] border-emerald-500/20 text-emerald-600 bg-emerald-500/5 font-black uppercase">Today's Deals</Badge>
                    </div>
                    <div className="space-y-2">
                        {activeOffers.map((pkg) => (
                            <div key={pkg.id} className="flex justify-between items-center p-3 rounded-xl border-2 bg-amber-500/5 border-amber-500/20 transition-all group">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-[10px] uppercase truncate text-amber-600">{pkg.name}</p>
                                        <Badge className="h-3.5 px-1 bg-amber-500 text-[7px] font-black">BOOST</Badge>
                                    </div>
                                    <p className="text-[8px] font-bold text-muted-foreground uppercase mt-0.5 tracking-wider">
                                        {formatDuration(pkg.duration)} Session
                                    </p>
                                </div>
                                <span className="font-mono font-black text-sm text-primary">₹{pkg.price}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-4xl">
            {employees?.map(emp => (
                <Button key={emp.id} onClick={() => handleLoginAttempt(emp)} variant="outline" className={cn(
                    "group relative h-20 sm:h-24 flex flex-col gap-1 sm:gap-2 bg-card/30 backdrop-blur-xl border-2 border-foreground/5 hover:border-primary/50 hover:bg-primary/5 transition-all rounded-2xl shadow-sm",
                    emp.role === 'admin' ? "border-primary/10" : emp.role === 'staff' ? "border-emerald-500/10" : ""
                )}>
                    <div className="absolute top-0 right-0 p-2 opacity-5 hidden xs:block">
                        {emp.role === 'admin' ? <Shield className="h-12 w-12" /> : emp.role === 'staff' ? <Users className="h-12 w-12" /> : <User className="h-12 w-12" />}
                    </div>
                    {emp.role === 'admin' ? <Shield className="h-4 sm:h-5 w-4 sm:w-5 text-primary group-hover:scale-110 transition-transform" /> : 
                     emp.role === 'staff' ? <Users className="h-4 sm:h-5 w-4 sm:w-5 text-emerald-500 group-hover:scale-110 transition-transform" /> : 
                     <User className="h-4 sm:h-5 w-4 sm:w-5 text-blue-500 group-hover:scale-110 transition-transform" />}
                    <span className="font-headline text-[10px] tracking-tight uppercase">{emp.displayName}</span>
                    <span className="text-[8px] font-black opacity-40 uppercase tracking-widest">{emp.role === 'admin' ? 'Master Console' : emp.role === 'staff' ? 'Operator Entrance' : 'Visitor Terminal'}</span>
                </Button>
            ))}
            {(!employees || employees.length === 0) && (
                <div className="col-span-full py-12 flex flex-col items-center gap-4 opacity-50 bg-card/20 rounded-3xl border-2 border-dashed">
                    <RefreshCcw className="h-10 w-10 animate-spin text-muted-foreground" />
                    <div className="text-center">
                        <p className="font-headline text-[10px] tracking-widest uppercase">No Operator Profiles Detected</p>
                        <button 
                            onClick={handleManualSeed} 
                            disabled={isSeeding}
                            className="text-[10px] font-black uppercase text-primary hover:underline mt-2 flex items-center justify-center gap-2"
                        >
                            {isSeeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
                            Initialize Default Profiles
                        </button>
                    </div>
                </div>
            )}
        </div>

        <p className="text-[8px] font-mono text-muted-foreground/30 uppercase tracking-widest text-center">
            BISTRO_OS_v{APP_VERSION} // DYNAMIC_AUTH_ENABLED // STABLE_BUILD
        </p>
      </main>

      <Dialog open={isPinModalOpen} onOpenChange={setIsPinModalOpen}>
        <DialogContent className="sm:max-w-sm font-body border-4 border-primary">
          <DialogHeader>
            <DialogTitle className="font-headline text-lg sm:text-xl flex items-center gap-3 text-primary uppercase tracking-tight">
              <KeyRound className="h-5 sm:h-6 w-5 sm:w-6" />
              Verification
            </DialogTitle>
            <DialogDescription className="font-bold text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground">
              Enter the unique 4-digit PIN for <strong>{pendingUser?.displayName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 sm:py-6 flex flex-col items-center gap-4">
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && verifyPinAndLogin()}
              className="h-14 sm:h-16 w-40 sm:w-48 text-center text-3xl sm:text-4xl font-mono font-black tracking-[0.5em] border-2 border-muted bg-muted/10 focus-visible:ring-primary"
              placeholder="****"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button onClick={verifyPinAndLogin} className="w-full h-12 sm:h-14 font-black uppercase tracking-widest text-base sm:text-lg shadow-xl">
              Unlock Console
              <ArrowRight className="ml-2 h-4 sm:h-5 w-4 sm:w-5" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
