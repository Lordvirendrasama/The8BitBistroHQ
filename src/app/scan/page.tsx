'use client';

import { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useFirebase } from '@/firebase/provider';
import { collection, query, orderBy } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Gamepad2, Search, User, QrCode, LogOut, Loader2, Zap, UserPlus, X, Users, Check, Send } from 'lucide-react';
import { Station, Member, MemberTier } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { createSessionRequest, SessionRequestPartyMember } from '@/firebase/firestore/session-requests';

const generateSvgIdCard = (member: Member) => {
  const tierColorMap: Record<MemberTier, { color: string; bg: string; text: string }> = {
    Red: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', text: 'RED' },
    Green: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', text: 'GREEN' },
    Gold: { color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', text: 'GOLD' }
  };
  
  const tier = tierColorMap[member.tier] || tierColorMap.Red;
  
  return `<svg width="400" height="250" viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg">
  <style>
    .title { font-family: 'Courier New', monospace; font-weight: bold; fill: #00ffcc; font-size: 16px; }
    .name { font-family: 'Segoe UI', Roboto, sans-serif; font-weight: 800; fill: #ffffff; font-size: 20px; }
    .username { font-family: 'Segoe UI', Roboto, sans-serif; fill: #a0aec0; font-size: 13px; }
    .label { font-family: 'Segoe UI', Roboto, sans-serif; font-weight: bold; fill: #718096; font-size: 9px; letter-spacing: 1px; }
    .value { font-family: 'Segoe UI', Roboto, sans-serif; font-weight: bold; fill: #ffffff; font-size: 13px; }
    .tier-badge { font-family: 'Segoe UI', Roboto, sans-serif; font-weight: bold; font-size: 11px; }
  </style>
  
  <defs>
    <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f0c20" />
      <stop offset="100%" stop-color="#060210" />
    </linearGradient>
    <linearGradient id="borderGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ef4444" />
      <stop offset="50%" stop-color="#00ffcc" />
      <stop offset="100%" stop-color="#9d4edd" />
    </linearGradient>
    <clipPath id="avatarClip">
      <rect x="20" y="70" width="70" height="70" rx="15" />
    </clipPath>
  </defs>

  <!-- Background Card -->
  <rect x="5" y="5" width="390" height="240" rx="20" fill="url(#cardBg)" stroke="url(#borderGlow)" stroke-width="2.5" />
  
  <!-- Bistro Brand Logo -->
  <text x="20" y="40" class="title">THE 8-BIT BISTRO</text>
  
  <!-- Tier Badge -->
  <rect x="300" y="22" width="80" height="24" rx="12" fill="${tier.bg}" stroke="${tier.color}" stroke-width="1.5" />
  <text x="340" y="38" text-anchor="middle" class="tier-badge" fill="${tier.color}">${tier.text}</text>

  <!-- Avatar -->
  <image href="${member.avatarUrl || 'https://via.placeholder.com/150'}" x="20" y="70" width="70" height="70" clip-path="url(#avatarClip)" />
  <rect x="20" y="70" width="70" height="70" rx="15" fill="none" stroke="${tier.color}" stroke-width="1.5" />

  <!-- Info -->
  <text x="110" y="90" class="name">${member.name}</text>
  <text x="110" y="110" class="username">@${member.username}</text>

  <!-- Stats Grid -->
  <!-- Level -->
  <text x="20" y="180" class="label">LEVEL</text>
  <text x="20" y="198" class="value">${member.level}</text>
  
  <!-- Points -->
  <text x="110" y="180" class="label">LOYALTY POINTS</text>
  <text x="110" y="198" class="value">${member.points.toLocaleString()} pts</text>

  <!-- XP -->
  <text x="260" y="180" class="label">XP</text>
  <text x="260" y="198" class="value">${member.xp.toLocaleString()} xp</text>

  <!-- Scanner line decoration -->
  <line x1="20" y1="222" x2="380" y2="222" stroke="#ff007f" stroke-width="1" stroke-dasharray="4,4" opacity="0.4" />
</svg>`;
};

export default function ScanPage() {
    const { db } = useFirebase();
    const { toast } = useToast();
    const [storedMemberId, setStoredMemberId] = useState<string | null>(null);
    const [partySearchQuery, setPartySearchQuery] = useState('');
    const [currentUrl, setCurrentUrl] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [requestSent, setRequestSent] = useState(false);
    // Party: list of extra players added beyond the primary member
    const [extraParty, setExtraParty] = useState<SessionRequestPartyMember[]>([]);

    // Initialize state from client side
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const memberIdParam = params.get('memberId');
        
        if (memberIdParam) {
            localStorage.setItem('playerUserId', memberIdParam);
            setStoredMemberId(memberIdParam);
            window.history.replaceState({}, document.title, window.location.pathname);
            toast({ title: "Profile Linked", description: "Your phone is now set for quick logins." });
        } else {
            const id = localStorage.getItem('playerUserId');
            if (id) setStoredMemberId(id);
        }
        setCurrentUrl(window.location.href);
    }, []);

    const stationsQuery = useMemo(() => !db ? null : query(collection(db, 'stations'), orderBy('order')), [db]);
    const { data: rawStations } = useCollection<Station>(stationsQuery);

    const membersQuery = useMemo(() => !db ? null : collection(db, 'members'), [db]);
    const { data: allMembers, loading: membersLoading } = useCollection<Member>(membersQuery);

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

    useEffect(() => {
        if (storedMemberId && !currentMember && !membersLoading && allMembers && allMembers.length > 0) {
            localStorage.removeItem('playerUserId');
            setStoredMemberId(null);
        }
    }, [storedMemberId, currentMember, membersLoading, allMembers]);

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
                <p className="font-headline text-sm tracking-normal uppercase animate-pulse">Establishing Connection...</p>
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
                <h1 className="font-pixel text-3xl text-white mb-2">
                    SCAN <span className="text-primary">&</span> PLAY
                </h1>
                <p className="text-primary/60 text-sm uppercase tracking-[0.3em] font-bold italic">The 8 Bit Bistro OS</p>
            </header>

            <div className="w-full relative z-10">
                {/* ───── NOT LOGGED IN: scan prompt ───── */}
                {!storedMemberId ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full">
                        <Card className="bg-white/5 border-white/10 backdrop-blur-2xl overflow-hidden rounded-[2rem]">
                            <CardContent className="p-8 flex flex-col items-center text-center">
                                <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-2xl border border-primary/20 mb-6 shadow-lg shadow-primary/5">
                                    <QrCode className="text-primary w-10 h-10" />
                                </div>
                                <h3 className="font-headline text-xl mb-2 text-primary">SCANNABLE ID REQUIRED</h3>
                                <p className="text-muted-foreground text-sm font-bold uppercase tracking-normal text-center opacity-70 max-w-xs mb-4">
                                    Please scan your personal Digital ID QR Code on your phone to link your device and request play sessions.
                                </p>
                                <div className="h-1 w-12 bg-primary/30 rounded-full animate-pulse" />
                            </CardContent>
                        </Card>
                        <div className="text-center py-4 opacity-20 text-xs font-bold uppercase tracking-[0.2em]">
                            The 8 Bit Bistro OS
                        </div>
                    </div>

                /* ───── REQUEST SENT: waiting screen ───── */
                ) : requestSent ? (
                    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Member Profile Card (Cyberpunk ID) */}
                        <div className="w-full flex flex-col gap-2">
                            <div className="flex justify-between items-center px-2">
                                <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">Verified Member Terminal</span>
                                <button 
                                    onClick={handleLogout} 
                                    className="text-xs font-bold uppercase tracking-wider text-destructive hover:underline flex items-center gap-1.5" 
                                    title="Unlink Phone"
                                >
                                    <LogOut className="w-3.5 h-3.5" />
                                    Unlink Phone
                                </button>
                            </div>
                            {currentMember && (
                                <div 
                                    className="w-full border border-white/10 rounded-2xl overflow-hidden shadow-2xl bg-zinc-950"
                                    dangerouslySetInnerHTML={{ __html: generateSvgIdCard(currentMember) }}
                                />
                            )}
                        </div>

                        {/* Sent state */}
                        <div className="flex flex-col items-center gap-6 py-12 border-2 border-dashed border-primary/30 rounded-[3rem] bg-primary/5 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
                            <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center border border-primary/30 shadow-lg shadow-primary/20 relative z-10">
                                <Check className="w-10 h-10 text-primary" />
                            </div>
                            <div className="text-center relative z-10 space-y-2">
                                <p className="font-headline text-3xl tracking-tight uppercase text-primary">Request Sent!</p>
                                <p className="text-sm font-bold uppercase tracking-[0.3em] text-white/40">
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
                                    <div className="w-12 h-12 rounded-full border-2 border-white/20 bg-white/5 flex items-center justify-center text-sm font-bold uppercase tracking-tight text-white/60">
                                        {fullParty.length}P
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleNewRequest}
                                className="relative z-10 px-8 py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-sm font-bold uppercase tracking-normal transition-all"
                            >
                                Send Another Request
                            </button>
                        </div>
                    </div>

                /* ───── LOGGED IN: party builder + request ───── */
                ) : (
                    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Member Profile Card (Cyberpunk ID) */}
                        <div className="w-full flex flex-col gap-2">
                            <div className="flex justify-between items-center px-2">
                                <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">Verified Member Terminal</span>
                                <button 
                                    onClick={handleLogout} 
                                    className="text-xs font-bold uppercase tracking-wider text-destructive hover:underline flex items-center gap-1.5" 
                                    title="Unlink Phone"
                                >
                                    <LogOut className="w-3.5 h-3.5" />
                                    Unlink Phone
                                </button>
                            </div>
                            {currentMember && (
                                <div 
                                    className="w-full border border-white/10 rounded-2xl overflow-hidden shadow-2xl bg-zinc-950"
                                    dangerouslySetInnerHTML={{ __html: generateSvgIdCard(currentMember) }}
                                />
                            )}
                        </div>

                        {/* ── Party Builder ── */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 px-2">
                                <span className="w-2 h-8 bg-primary rounded-full" />
                                <div>
                                    <h3 className="font-headline text-xl tracking-tight">YOUR PARTY</h3>
                                    <p className="text-sm font-bold uppercase tracking-normal text-white/30">Add friends playing with you</p>
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
                                        <p className="text-sm font-bold uppercase text-primary/60 tracking-normal">Host</p>
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
                                            <p className="text-sm font-bold uppercase text-white/30 tracking-normal">Player</p>
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
                                            className="pl-11 h-12 bg-white/5 border-white/10 focus:border-primary/30 text-white font-bold tracking-normal uppercase text-sm rounded-xl transition-all"
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
                                                <p className="text-sm font-bold text-white/30 uppercase tracking-normal">@{m.username || 'member'}</p>
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
                                <span className="text-sm font-bold uppercase tracking-normal text-white/60">PS5 Consoles</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${availableStations.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-destructive'}`} />
                                <span className={`text-sm font-bold uppercase tracking-normal ${availableStations.length > 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                                    {availableStations.length > 0 ? `${availableStations.length} Available` : 'Arena Full'}
                                </span>
                            </div>
                        </div>

                        {/* ── Send Request Button ── */}
                        <button
                            disabled={isSending || availableStations.length === 0}
                            onClick={handleSendRequest}
                            className={`w-full h-18 py-5 rounded-[1.8rem] font-headline text-xl tracking-tight uppercase flex items-center justify-center gap-3 transition-all shadow-2xl ${
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
                            <p className="text-sm font-bold uppercase tracking-[0.5em] text-white/50">Project Afterlight 8.0</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Nav Accent */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-white/10 rounded-full blur-[1px] pointer-events-none" />
        </div>
    );
}
