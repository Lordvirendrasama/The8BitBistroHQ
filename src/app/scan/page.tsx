'use client';

import { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useFirebase } from '@/firebase/provider';
import { collection, query, where, doc, getDoc, orderBy } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Gamepad2, Search, User, CheckCircle2, QrCode, LogOut, Loader2, Zap } from 'lucide-react';
import { Station, Member } from '@/lib/types';
import { updateStation } from '@/firebase/firestore/stations';
import { useToast } from '@/hooks/use-toast';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function ScanPage() {
    const { db } = useFirebase();
    const { toast } = useToast();
    const [storedMemberId, setStoredMemberId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentUrl, setCurrentUrl] = useState('');
    const [isStarting, setIsStarting] = useState<string | null>(null);

    // Initialize state from client side
    useEffect(() => {
        const id = localStorage.getItem('playerUserId');
        if (id) setStoredMemberId(id);
        setCurrentUrl(window.location.href);
    }, []);

    const stationsQuery = useMemo(() => !db ? null : query(collection(db, 'stations'), where('type', '==', 'ps5')), [db]);
    const { data: stations, loading: stationsLoading } = useCollection<Station>(stationsQuery);

    const membersQuery = useMemo(() => !db ? null : collection(db, 'members'), [db]);
    const { data: allMembers, loading: membersLoading } = useCollection<Member>(membersQuery);

    // Dynamic Filter for Member Selection
    const filteredMembers = useMemo(() => {
        if (!allMembers || searchQuery.length < 2) return [];
        return allMembers.filter(m => 
            m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (m.username && m.username.toLowerCase().includes(searchQuery.toLowerCase()))
        ).slice(0, 5);
    }, [allMembers, searchQuery]);

    // Current Member Object
    const currentMember = useMemo(() => {
        if (!allMembers || !storedMemberId) return null;
        return allMembers.find(m => m.id === storedMemberId);
    }, [allMembers, storedMemberId]);

    // Available Stations
    const availableStations = useMemo(() => {
        return (stations || []).filter(s => s.status === 'available').sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [stations]);

    const handleSelectMember = (memberId: string) => {
        localStorage.setItem('playerUserId', memberId);
        setStoredMemberId(memberId);
        setSearchQuery('');
        toast({ title: "Profile Linked", description: "Your phone is now set for quick logins." });
    };

    const handleLogout = () => {
        localStorage.removeItem('playerUserId');
        setStoredMemberId(null);
        toast({ title: "Session Cleared", description: "ID data removed from this device." });
    };

    const handleStartSession = async (station: Station) => {
        if (!currentMember) return;
        setIsStarting(station.id);

        try {
            // Check for balance
            const now = new Date();
            const validRecharges = (currentMember.recharges || []).filter(r => {
                const expiryDate = new Date(r.expiryDate);
                return expiryDate > now && r.remainingDuration > 0;
            });

            const totalPool = validRecharges.reduce((sum, r) => sum + r.remainingDuration, 0);

            if (totalPool <= 0) {
                toast({ 
                    variant: 'destructive', 
                    title: "No Gaming Balance", 
                    description: "Visit the counter to recharge your account balance first." 
                });
                setIsStarting(null);
                return;
            }

            // Calculate end time based on full pool balance (standard behavior for registry login)
            const startTime = new Date().toISOString();
            const endTime = new Date(Date.now() + totalPool * 1000).toISOString();
            
            await updateStation(station.id, {
                status: 'in-use',
                startTime: startTime,
                endTime: endTime,
                packageName: "Account Balance",
                members: [{
                    id: currentMember.id,
                    name: currentMember.name,
                    avatarUrl: currentMember.avatarUrl || PlaceHolderImages[0].imageUrl,
                    status: 'active',
                    rechargeId: 'pool',
                    startTime: startTime,
                    endTime: endTime
                }],
                currentBill: [],
                discount: 0
            });

            toast({ 
                title: "Session Started!", 
                description: `Console ${station.name} is now yours. Grab the controller!` 
            });
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: "System Error", description: "Failed to deploy station. Try again." });
        } finally {
            setIsStarting(null);
        }
    };

    if (membersLoading && !allMembers) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="font-headline text-[10px] tracking-widest uppercase animate-pulse">Establishing Connection...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 pb-20 flex flex-col items-center max-w-md mx-auto relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

            {/* Header */}
            <header className="w-full mb-10 text-center pt-8 relative z-10">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/20 rounded-2xl border border-primary/30 mb-4 shadow-lg shadow-primary/20">
                    <QrCode className="text-primary w-8 h-8" />
                </div>
                <h1 className="font-headline text-5xl tracking-tighter text-white mb-2 italic">
                    SCAN <span className="text-primary">&</span> PLAY
                </h1>
                <p className="text-primary/60 text-[10px] uppercase tracking-[0.3em] font-black italic">The 8 Bit Bistro OS</p>
            </header>

            {/* Content Area */}
            <div className="w-full relative z-10">
                {!storedMemberId ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <Card className="bg-white/5 border-white/10 backdrop-blur-2xl overflow-hidden rounded-[2rem]">
                            <CardContent className="p-8 flex flex-col items-center">
                                <div className="bg-white p-4 rounded-[1.5rem] mb-6 shadow-2xl shadow-primary/10">
                                    <QRCodeSVG value={currentUrl} size={160} />
                                </div>
                                <h3 className="font-headline text-xl text-center mb-2">IDENTIFY YOURSELF</h3>
                                <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest text-center opacity-70">Search for your profile below to link this device</p>
                            </CardContent>
                        </Card>

                        <div className="space-y-4">
                            <div className="relative group">
                                <div className="absolute inset-0 bg-primary/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary w-5 h-5" />
                                <Input 
                                    placeholder="SEARCH NAME OR USERNAME..." 
                                    className="pl-12 h-16 bg-white/5 border-white/10 focus:border-primary/50 text-white font-black tracking-widest uppercase text-xs rounded-2xl transition-all relative z-10"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="space-y-3">
                                {filteredMembers.map(m => (
                                    <button 
                                        key={m.id}
                                        onClick={() => handleSelectMember(m.id)}
                                        className="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-primary border border-white/10 hover:border-primary rounded-[1.5rem] transition-all group overflow-hidden relative"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-primary to-transparent opacity-0 group-hover:opacity-10 transition-opacity" />
                                        <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/10 group-hover:border-black/20 shadow-lg relative z-10">
                                            <img src={m.avatarUrl || PlaceHolderImages[0].imageUrl} alt={m.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="text-left relative z-10">
                                            <p className="font-headline text-xl tracking-tight group-hover:text-black transition-colors">{m.name}</p>
                                            <p className="text-[10px] font-black text-muted-foreground group-hover:text-black/60 uppercase tracking-widest">@{m.username || 'user'}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            
                            {searchQuery.length > 0 && filteredMembers.length === 0 && (
                                <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-[2rem] opacity-40">
                                    <p className="font-headline text-xs tracking-widest uppercase">No Intel Found</p>
                                </div>
                            )}
                            
                            {!searchQuery && (
                                <div className="flex flex-col items-center py-12 text-white/20 gap-4 border-2 border-dashed border-white/5 rounded-[2rem]">
                                    <User className="w-10 h-10" />
                                    <p className="font-headline text-[10px] tracking-[0.3em] uppercase">Awaiting Input</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Member Profile Header */}
                        <div className="relative p-6 bg-primary border border-primary/50 rounded-[2.5rem] shadow-2xl shadow-primary/20 overflow-hidden group">
                            <div className="flex items-center justify-between gap-4 relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-[1.2rem] overflow-hidden border-2 border-black/20 shadow-2xl">
                                        <img src={currentMember?.avatarUrl || PlaceHolderImages[0].imageUrl} alt="Avatar" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="text-black">
                                    <h2 className="font-headline text-3xl tracking-tighter leading-none mb-1">{currentMember?.name.split(' ')[0].toUpperCase()}</h2>
                                    <div className="flex items-center gap-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Verified Member</p>
                                        <div className="w-1 h-1 rounded-full bg-black/20" />
                                        <p className="text-[10px] font-black uppercase tracking-widest bg-black/10 px-2 py-0.5 rounded-full">
                                            {Math.floor(((currentMember?.recharges || [])
                                                .filter(r => new Date(r.expiryDate) > new Date() && r.remainingDuration > 0)
                                                .reduce((sum, r) => sum + r.remainingDuration, 0)) / 3600)} HRS LEFT
                                        </p>
                                    </div>
                                </div>
                                </div>
                                <button 
                                    onClick={handleLogout} 
                                    className="p-4 bg-black/10 hover:bg-black/20 text-black hover:scale-95 rounded-[1rem] transition-all"
                                    title="Unlink Phone"
                                >
                                    <LogOut className="w-5 h-5" />
                                </button>
                            </div>
                            {/* Decorative Elements */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
                        </div>

                        {/* Station Selection */}
                        <div className="space-y-5">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="font-headline text-2xl tracking-tighter flex items-center gap-3">
                                    <span className="w-2 h-8 bg-primary rounded-full" />
                                    SELECT CONSOLE
                                </h3>
                                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500/20 shadow-inner">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                                        {availableStations.length} ACTIVE UNITS
                                    </span>
                                </div>
                            </div>

                            <div className="grid gap-4">
                                {availableStations.map(station => (
                                    <button
                                        key={station.id}
                                        disabled={!!isStarting}
                                        onClick={() => handleStartSession(station)}
                                        className={`w-full p-6 bg-white/5 border border-white/10 hover:border-primary/50 rounded-[2rem] flex items-center justify-between group transition-all relative overflow-hidden ${isStarting === station.id ? 'opacity-70 scale-95' : 'hover:-translate-y-1'}`}
                                    >
                                        <div className="flex items-center gap-5 relative z-10">
                                            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-primary transition-all duration-500">
                                                <Gamepad2 className="text-white group-hover:text-black w-6 h-6 transition-colors" />
                                            </div>
                                            <div className="text-left">
                                                <span className="font-headline text-2xl tracking-tight group-hover:text-primary transition-colors leading-none block mb-1.5 uppercase">{station.name}</span>
                                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2 italic">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                                    UNIT READY
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="relative z-10 h-12 px-6 bg-white/10 group-hover:bg-primary text-white group-hover:text-black rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg overflow-hidden group-hover:shadow-primary/20">
                                            {isStarting === station.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <>
                                                    <Zap className="w-4 h-4 fill-current" />
                                                    INITIATE
                                                </>
                                            )}
                                        </div>

                                        {/* Background Animation on Hover */}
                                        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                ))}

                                {availableStations.length === 0 && !stationsLoading && (
                                    <div className="text-center py-20 px-10 border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.02] flex flex-col items-center gap-6">
                                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/10 shadow-inner">
                                            <Gamepad2 className="text-white/20 w-10 h-10" />
                                        </div>
                                        <div className="space-y-2">
                                            <p className="font-headline text-3xl tracking-tighter uppercase text-white/40">ARENA FULL</p>
                                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Stand by for available units</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Branding */}
                        <div className="pt-8 flex flex-col items-center gap-4 opacity-30 group cursor-default">
                             <div className="h-[1px] w-12 bg-white/20 group-hover:w-full transition-all duration-1000" />
                             <p className="text-[9px] font-black uppercase tracking-[0.5em] text-white/50 group-hover:text-primary transition-colors">Project Afterlight 8.0</p>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Nav Accent for mobile UX */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-white/10 rounded-full blur-[1px] pointer-events-none" />
        </div>
    );
}
