'use client';

import { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useFirebase } from '@/firebase/provider';
import { collection, query, orderBy } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Gamepad2, Search, User, QrCode, LogOut, Loader2, Zap, UserPlus, X, Users, Check, Send } from 'lucide-react';
import { Station, Member } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { createSessionRequest, SessionRequestPartyMember } from '@/firebase/firestore/session-requests';

export default function ScanPage() {
    const { db } = useFirebase();
    const { toast } = useToast();
    const [storedMemberId, setStoredMemberId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [partySearchQuery, setPartySearchQuery] = useState('');
    const [currentUrl, setCurrentUrl] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [requestSent, setRequestSent] = useState(false);
    // Party: list of extra players added beyond the primary member
    const [extraParty, setExtraParty] = useState<SessionRequestPartyMember[]>([]);

    // Initialize state from client side
    useEffect(() => {
        const id = localStorage.getItem('playerUserId');
        if (id) setStoredMemberId(id);
        setCurrentUrl(window.location.href);
    }, []);

    const stationsQuery = useMemo(() => !db ? null : query(collection(db, 'stations'), orderBy('order')), [db]);
    const { data: rawStations } = useCollection<Station>(stationsQuery);

    const membersQuery = useMemo(() => !db ? null : collection(db, 'members'), [db]);
    const { data: allMembers, loading: membersLoading } = useCollection<Member>(membersQuery);

    // Filter for primary member search
    const filteredMembers = useMemo(() => {
        if (!allMembers || searchQuery.length < 2) return [];
        return allMembers.filter(m =>
            m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (m.username && m.username.toLowerCase().includes(searchQuery.toLowerCase()))
        ).slice(0, 5);
    }, [allMembers, searchQuery]);

    // Filter for party member search (exclude primary + already added)
    const filteredPartyMembers = useMemo(() => {
        if (!allMembers || partySearchQuery.length < 2) return [];
        const existingIds = new Set([storedMemberId, ...extraParty.map(p => p.id)]);
        return allMembers.filter(m =>
            !existingIds.has(m.id) && (
                m.name.toLowerCase().includes(partySearchQuery.toLowerCase()) ||
                (m.username && m.username.toLowerCase().includes(partySearchQuery.toLowerCase()))
            )
        ).slice(0, 4);
    }, [allMembers, partySearchQuery, storedMemberId, extraParty]);

    // Current (primary) Member object
    const currentMember = useMemo(() => {
        if (!allMembers || !storedMemberId) return null;
        return allMembers.find(m => m.id === storedMemberId) || null;
    }, [allMembers, storedMemberId]);

    // Available PS5 stations
    const availableStations = useMemo(() => {
        if (!rawStations) return [];
        const sorted = [...rawStations].sort((a, b) => {
            if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
            if (a.order !== undefined) return -1;
            if (b.order !== undefined) return 1;
            return a.name.localeCompare(b.name);
        });
        return sorted.filter(s => s.type === 'ps5' && s.status === 'available');
    }, [rawStations]);

    // Full party (primary + extra)
    const fullParty = useMemo((): SessionRequestPartyMember[] => {
        if (!currentMember) return [];
        return [
            { id: currentMember.id, name: currentMember.name, avatarUrl: currentMember.avatarUrl || PlaceHolderImages[0].imageUrl },
            ...extraParty
        ];
    }, [currentMember, extraParty]);

    const handleSelectMember = (memberId: string) => {
        localStorage.setItem('playerUserId', memberId);
        setStoredMemberId(memberId);
        setSearchQuery('');
        setRequestSent(false);
        setExtraParty([]);
        toast({ title: "Profile Linked", description: "Your phone is now set for quick logins." });
    };

    const handleLogout = () => {
        localStorage.removeItem('playerUserId');
        setStoredMemberId(null);
        setExtraParty([]);
        setRequestSent(false);
        toast({ title: "Session Cleared", description: "ID data removed from this device." });
    };

    const handleAddPartyMember = (member: Member) => {
        if (extraParty.length >= 3) {
            toast({ variant: 'destructive', title: "Party Full", description: "Max 4 players per session." });
            return;
        }
        setExtraParty(prev => [...prev, { id: member.id, name: member.name, avatarUrl: member.avatarUrl || PlaceHolderImages[0].imageUrl }]);
        setPartySearchQuery('');
    };

    const handleRemovePartyMember = (memberId: string) => {
        setExtraParty(prev => prev.filter(p => p.id !== memberId));
    };

    const handleSendRequest = async () => {
        if (!currentMember || fullParty.length === 0) return;
        if (availableStations.length === 0) {
            toast({ variant: 'destructive', title: "No Consoles Available", description: "All PS5s are currently in use." });
            return;
        }
        setIsSending(true);
        try {
            const primary: SessionRequestPartyMember = {
                id: currentMember.id,
                name: currentMember.name,
                avatarUrl: currentMember.avatarUrl || PlaceHolderImages[0].imageUrl
            };

            const reqId = await createSessionRequest(primary, fullParty);
            if (reqId) {
                setRequestSent(true);
                toast({ title: "Request Sent!", description: "The staff will assign you a console shortly." });
            } else {
                toast({ variant: 'destructive', title: "Failed", description: "Could not send request. Try again." });
            }
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: "System Error", description: "Something went wrong. Try again." });
        } finally {
            setIsSending(false);
        }
    };

    const handleNewRequest = () => {
        setRequestSent(false);
        setExtraParty([]);
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
        <div className="min-h-screen bg-[#050505] text-white p-6 pb-24 flex flex-col items-center max-w-md mx-auto relative overflow-hidden">
            {/* BG Glow */}
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

            <div className="w-full relative z-10">
                {/* ───── NOT LOGGED IN: profile selector ───── */}
                {!storedMemberId ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <Card className="bg-white/5 border-white/10 backdrop-blur-2xl overflow-hidden rounded-[2rem]">
                            <CardContent className="p-8 flex flex-col items-center">
                                <div className="bg-white p-4 rounded-[1.5rem] mb-6 shadow-2xl shadow-primary/10">
                                    <QRCodeSVG value={currentUrl || 'https://the8bitbistro.com'} size={160} />
                                </div>
                                <h3 className="font-headline text-xl text-center mb-2">IDENTIFY YOURSELF</h3>
                                <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest text-center opacity-70">
                                    Search for your profile below to link this device
                                </p>
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

                /* ───── REQUEST SENT: waiting screen ───── */
                ) : requestSent ? (
                    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Primary card */}
                        <div className="relative p-6 bg-primary border border-primary/50 rounded-[2.5rem] shadow-2xl shadow-primary/20 overflow-hidden">
                            <div className="flex items-center justify-between gap-4 relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-[1.2rem] overflow-hidden border-2 border-black/20 shadow-2xl">
                                        <img src={currentMember?.avatarUrl || PlaceHolderImages[0].imageUrl} alt="Avatar" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="text-black">
                                        <h2 className="font-headline text-3xl tracking-tighter leading-none mb-1">{currentMember?.name.split(' ')[0].toUpperCase()}</h2>
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Verified Member</p>
                                    </div>
                                </div>
                                <button onClick={handleLogout} className="p-4 bg-black/10 hover:bg-black/20 text-black hover:scale-95 rounded-[1rem] transition-all" title="Unlink Phone">
                                    <LogOut className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
                        </div>

                        {/* Sent state */}
                        <div className="flex flex-col items-center gap-6 py-12 border-2 border-dashed border-primary/30 rounded-[3rem] bg-primary/5 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
                            <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center border border-primary/30 shadow-lg shadow-primary/20 relative z-10">
                                <Check className="w-10 h-10 text-primary" />
                            </div>
                            <div className="text-center relative z-10 space-y-2">
                                <p className="font-headline text-3xl tracking-tighter uppercase text-primary">Request Sent!</p>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                                    Staff will assign your console shortly
                                </p>
                            </div>

                            {/* Party summary */}
                            {fullParty.length > 1 && (
                                <div className="flex -space-x-3 relative z-10">
                                    {fullParty.map(p => (
                                        <div key={p.id} className="w-12 h-12 rounded-full border-2 border-primary overflow-hidden shadow-lg">
                                            <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                    <div className="w-12 h-12 rounded-full border-2 border-white/20 bg-white/5 flex items-center justify-center text-[9px] font-black uppercase tracking-tight text-white/60">
                                        {fullParty.length}P
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleNewRequest}
                                className="relative z-10 px-8 py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                Send Another Request
                            </button>
                        </div>
                    </div>

                /* ───── LOGGED IN: party builder + request ───── */
                ) : (
                    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Member Profile Card */}
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
                                <button onClick={handleLogout} className="p-4 bg-black/10 hover:bg-black/20 text-black hover:scale-95 rounded-[1rem] transition-all" title="Unlink Phone">
                                    <LogOut className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
                        </div>

                        {/* ── Party Builder ── */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 px-2">
                                <span className="w-2 h-8 bg-primary rounded-full" />
                                <div>
                                    <h3 className="font-headline text-xl tracking-tighter">YOUR PARTY</h3>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Add friends playing with you</p>
                                </div>
                            </div>

                            {/* Party members list */}
                            <div className="space-y-2">
                                {/* Primary member (non-removable) */}
                                <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-2xl">
                                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-primary/30">
                                        <img src={currentMember?.avatarUrl || PlaceHolderImages[0].imageUrl} alt="You" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-headline text-sm tracking-tight truncate">{currentMember?.name}</p>
                                        <p className="text-[9px] font-black uppercase text-primary/60 tracking-widest">Host</p>
                                    </div>
                                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-sm">
                                        <Zap className="w-3 h-3 text-black fill-current" />
                                    </div>
                                </div>

                                {/* Extra party members */}
                                {extraParty.map(p => (
                                    <div key={p.id} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-2xl group/item">
                                        <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10">
                                            <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-headline text-sm tracking-tight truncate">{p.name}</p>
                                            <p className="text-[9px] font-black uppercase text-white/30 tracking-widest">Player</p>
                                        </div>
                                        <button
                                            onClick={() => handleRemovePartyMember(p.id)}
                                            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-destructive/20 text-white/30 hover:text-destructive flex items-center justify-center transition-all"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Add party member search */}
                            {extraParty.length < 3 && (
                                <div className="space-y-2">
                                    <div className="relative group">
                                        <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
                                        <Input
                                            placeholder="ADD A PLAYER..."
                                            className="pl-11 h-12 bg-white/5 border-white/10 focus:border-primary/30 text-white font-black tracking-widest uppercase text-[10px] rounded-xl transition-all"
                                            value={partySearchQuery}
                                            onChange={(e) => setPartySearchQuery(e.target.value)}
                                        />
                                    </div>
                                    {filteredPartyMembers.map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => handleAddPartyMember(m)}
                                            className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/30 rounded-xl transition-all"
                                        >
                                            <div className="w-9 h-9 rounded-lg overflow-hidden border border-white/10 shrink-0">
                                                <img src={m.avatarUrl || PlaceHolderImages[0].imageUrl} alt={m.name} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="text-left min-w-0 flex-1">
                                                <p className="font-headline text-sm tracking-tight truncate">{m.name}</p>
                                                <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">@{m.username || 'member'}</p>
                                            </div>
                                            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                                <Users className="text-primary w-3.5 h-3.5" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── Available Consoles Status ── */}
                        <div className="flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-2xl">
                            <div className="flex items-center gap-3">
                                <Gamepad2 className="text-primary w-5 h-5" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/60">PS5 Consoles</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${availableStations.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-destructive'}`} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${availableStations.length > 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                                    {availableStations.length > 0 ? `${availableStations.length} Available` : 'Arena Full'}
                                </span>
                            </div>
                        </div>

                        {/* ── Send Request Button ── */}
                        <button
                            disabled={isSending || availableStations.length === 0}
                            onClick={handleSendRequest}
                            className={`w-full h-18 py-5 rounded-[1.8rem] font-headline text-xl tracking-tighter uppercase flex items-center justify-center gap-3 transition-all shadow-2xl ${
                                availableStations.length === 0
                                    ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
                                    : 'bg-primary text-black hover:scale-[1.02] hover:shadow-primary/30 active:scale-[0.98]'
                            }`}
                        >
                            {isSending ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>
                                    <Send className="w-5 h-5" />
                                    {fullParty.length > 1 ? `REQUEST FOR ${fullParty.length} PLAYERS` : 'REQUEST A CONSOLE'}
                                </>
                            )}
                        </button>

                        {/* Footer */}
                        <div className="pt-4 flex flex-col items-center gap-4 opacity-20 group cursor-default">
                            <div className="h-[1px] w-12 bg-white/20 group-hover:w-full transition-all duration-1000" />
                            <p className="text-[9px] font-black uppercase tracking-[0.5em] text-white/50">Project Afterlight 8.0</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Nav Accent */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-white/10 rounded-full blur-[1px] pointer-events-none" />
        </div>
    );
}
