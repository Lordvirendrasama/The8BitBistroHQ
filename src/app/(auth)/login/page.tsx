
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase/auth/use-user';
import { useFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import { Shield, Users, User, Power, Zap, Clock, Calendar, Gamepad2, Cpu, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GamingPackage } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export default function LoginPage() {
  const router = useRouter();
  const { db } = useFirebase();
  const { toast } = useToast();
  const { user, login, loading } = useAuth();
  
  const [isEntering, setIsEntering] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [currentTime, setCurrentTime] = useState(new Date());

  // Fetch Live Offers
  const packagesQuery = useMemo(() => !db ? null : collection(db, 'gamingPackages'), [db]);
  const { data: packages } = useCollection<GamingPackage>(packagesQuery);

  // Clock Update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter Active Offers for Today - ONLY PRIORITY OFFERS
  const activeOffers = useMemo(() => {
    if (!packages) return [];
    const day = currentTime.toLocaleDateString('en-US', { weekday: 'short' });
    const timeStr = currentTime.toTimeString().slice(0, 5);

    return packages.filter(pkg => {
      // Must be a priority offer
      if (!pkg.isPriorityOffer) return false;
      if (pkg.isAddTimePackage || pkg.isRechargePack) return false;
      
      let isAvailable = true;
      if (pkg.availableDays && pkg.availableDays.length > 0 && !pkg.availableDays.includes(day)) isAvailable = false;
      if (isAvailable && pkg.startTime && timeStr < pkg.startTime) isAvailable = false;
      if (isAvailable && pkg.endTime && timeStr > pkg.endTime) isAvailable = false;
      return isAvailable;
    });
  }, [packages, currentTime]);

  // Mouse following logic
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
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.5); // C6
      
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

  const handleLogin = async (username: 'Viren' | 'Abbas' | 'Guest') => {
    if (isEntering) return;
    setIsEntering(true);
    playChime();
    
    setTimeout(async () => {
      try {
        await login(username);
        router.push('/dashboard');
      } catch (error: any) {
        setIsEntering(false);
        toast({
          variant: 'destructive',
          title: 'Entry Denied',
          description: error.message,
        });
      }
    }, 1200);
  };

  if (loading || (user && !isEntering)) {
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
      
      {/* GLASS BACKGROUND BLURS */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse" />
      
      {/* CRT SCANLINE EFFECT */}
      <div className="absolute inset-0 z-2 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />

      <main className={cn(
        "relative z-10 w-full max-w-5xl flex flex-col items-center gap-6 sm:gap-10 transition-all duration-700",
        isEntering ? "opacity-0 scale-95 blur-xl" : "opacity-100 scale-100 blur-0"
      )}>
        
        {/* TIME & DATE HEADER */}
        <div className="w-full max-w-lg flex justify-between items-end px-2 animate-in fade-in slide-in-from-top-4 duration-1000">
            <div className="text-left">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    {currentTime.toLocaleDateString('en-US', { weekday: 'long' })}
                </p>
                <p className="text-sm font-bold uppercase tracking-tight text-foreground/80">
                    {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
            </div>
            <div className="text-right">
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] flex items-center justify-end gap-2">
                    <Clock className="h-3 w-3" />
                    Live Terminal
                </p>
                <p className="text-3xl font-bold font-mono tracking-tighter tabular-nums leading-none">
                    {currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
            </div>
        </div>

        {/* MASCOT */}
        <div 
          className="flex flex-col items-center animate-in fade-in zoom-in duration-1000 transition-transform duration-300 ease-out"
          style={{ transform: `translate(${logoX}px, ${logoY}px)` }}
        >
            <div className="relative h-28 w-28 sm:h-32 sm:w-32 drop-shadow-[0_0_25px_rgba(239,0,53,0.2)] hover:scale-110 transition-transform">
                <Image src="/logo.png" alt="The 8 Bit Bistro" width={128} height={128} className="object-contain" priority />
            </div>
        </div>

        {/* OFFERS CONSOLE - Only show if there are priority offers */}
        {activeOffers.length > 0 && (
            <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <div className="bg-card/40 backdrop-blur-3xl border-2 border-emerald-500/10 rounded-3xl p-6 shadow-lg relative overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-4 border-b border-foreground/5 pb-3">
                        <div className="flex items-center gap-2">
                            <Gamepad2 className="h-3 w-3 text-emerald-500" />
                            <span className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest">Active Power-Ups</span>
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
                    
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mt-4 text-center italic">
                        * Rates automatically adjusted for {currentTime.toLocaleDateString('en-US', { weekday: 'long' })}
                    </p>
                </div>
            </div>
        )}

        {/* ACCESS MODES */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-4xl">
            <Button onClick={() => handleLogin('Viren')} variant="outline" className="group relative h-24 flex flex-col gap-2 bg-card/30 backdrop-blur-xl border-2 border-foreground/5 hover:border-primary/50 hover:bg-primary/5 transition-all rounded-2xl shadow-sm">
                <div className="absolute top-0 right-0 p-2 opacity-5"><Cpu className="h-12 w-12" /></div>
                <Shield className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                <span className="font-headline text-[10px] tracking-tight uppercase">VIREN</span>
                <span className="text-[8px] font-black opacity-40 uppercase tracking-widest">Master Console</span>
            </Button>

            <Button onClick={() => handleLogin('Abbas')} variant="outline" className="group relative h-24 flex flex-col gap-2 bg-emerald-500/5 backdrop-blur-xl border-2 border-emerald-500/20 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all rounded-2xl shadow-lg">
                <div className="absolute top-0 right-0 p-2 opacity-10"><Wifi className="h-12 w-12 text-emerald-500" /></div>
                <div className="absolute top-2 left-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </div>
                <Users className="h-5 w-5 text-emerald-500 group-hover:scale-110 transition-transform" />
                <span className="font-headline text-[10px] tracking-tight uppercase text-emerald-600 dark:text-emerald-400">ABBAS</span>
                <span className="text-[8px] font-black opacity-60 uppercase tracking-widest">Operator Entrance</span>
            </Button>

            <Button onClick={() => handleLogin('Guest')} variant="outline" className="group relative h-24 flex flex-col gap-2 bg-card/30 backdrop-blur-xl border-2 border-foreground/5 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all rounded-2xl shadow-sm">
                <div className="absolute top-0 right-0 p-2 opacity-5"><User className="h-12 w-12" /></div>
                <User className="h-5 w-5 text-blue-500 group-hover:scale-110 transition-transform" />
                <span className="font-headline text-[10px] tracking-tight uppercase">GUEST</span>
                <span className="text-[8px] font-black opacity-40 uppercase tracking-widest">Visitor Terminal</span>
            </Button>
        </div>

        {/* FOOTER ACTION */}
        <div className="pt-2">
            <Button onClick={() => handleLogin('Abbas')} disabled={isEntering} className={cn(
                  "h-16 px-16 rounded-full font-headline text-sm tracking-[0.2em] transition-all duration-500 uppercase border-b-4 border-black/10 shadow-lg",
                  isEntering ? "bg-emerald-500 scale-90 opacity-50" : "bg-primary hover:bg-primary/90 hover:scale-105 hover:shadow-primary/20"
                )}>
                {isEntering ? <Zap className="mr-3 h-5 w-5 animate-spin" /> : <Power className="mr-3 h-5 w-5" />}
                {isEntering ? 'Entering...' : 'Start Shift'}
            </Button>
        </div>

        <p className="text-[8px] font-mono text-muted-foreground/30 uppercase tracking-widest">
            BISTRO_OS_v1.6.7 // LOCAL_AUTH_ENABLED // STABLE_BUILD
        </p>
      </main>
    </div>
  );
}
