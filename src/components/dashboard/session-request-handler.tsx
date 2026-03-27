'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { updateSessionRequest, deleteSessionRequest, SessionRequest } from '@/firebase/firestore/session-requests';
import { updateStation } from '@/firebase/firestore/stations';
import type { Station } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Gamepad2, Users, X, Check, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export function SessionRequestHandler({ ps5Stations }: { ps5Stations: Station[] }) {
    const { db } = useFirebase();
    const { toast } = useToast();

    const [pendingRequests, setPendingRequests] = useState<SessionRequest[]>([]);
    const [activeRequest, setActiveRequest] = useState<SessionRequest | null>(null);
    const [selectedStationId, setSelectedStationId] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const sessionStart = useRef(new Date().toISOString());
    const processedRef = useRef<Set<string>>(new Set());

    // Live listener on pending requests
    useEffect(() => {
        if (!db) return;
        const q = query(
            collection(db, 'sessionRequests'),
            where('status', '==', 'pending')
        );

        const unsub = onSnapshot(q, (snap) => {
            const requests = snap.docs.map(d => ({ id: d.id, ...d.data() } as SessionRequest));
            // Only show truly new ones (not ones already handled this session)
            const newOnes = requests.filter(r => !processedRef.current.has(r.id));
            setPendingRequests(newOnes);
        });

        return () => unsub();
    }, [db]);

    // Auto-pop the oldest pending request if none is active
    useEffect(() => {
        if (!activeRequest && pendingRequests.length > 0) {
            setActiveRequest(pendingRequests[0]);
            setSelectedStationId('');
        }
    }, [pendingRequests, activeRequest]);

    // Use the prop instead of a secondary query so it perfectly syncs with the dashboard
    const availableStations = ps5Stations.filter(s => s.status === 'available');

    const handleDeny = async () => {
        if (!activeRequest) return;
        setIsProcessing(true);
        processedRef.current.add(activeRequest.id);
        await updateSessionRequest(activeRequest.id, 'denied');
        await deleteSessionRequest(activeRequest.id);
        toast({ title: "Request Denied", description: `${activeRequest.primaryMemberName}'s request was turned down.` });
        setPendingRequests(prev => prev.filter(r => r.id !== activeRequest.id));
        setActiveRequest(null);
        setIsProcessing(false);
    };

    const handleApprove = async () => {
        if (!activeRequest || !selectedStationId) {
            toast({ variant: 'destructive', title: "Select a Console", description: "Choose a PS5 station to assign this party to." });
            return;
        }

        setIsProcessing(true);
        try {
            const now = new Date();

            // Calculate combined pool across all party members' recharges
            // Each player will be set up as a pool-based member
            const assignedMembers = activeRequest.partyMembers.map(p => ({
                id: p.id,
                name: p.name,
                avatarUrl: p.avatarUrl,
                status: 'active' as const,
                rechargeId: 'pool',
                startTime: now.toISOString(),
                endTime: null,
            }));

            await updateStation(selectedStationId, {
                status: 'in-use',
                startTime: now.toISOString(),
                endTime: null, // Staff can set time or add package from dashboard
                packageName: 'Account Balance',
                members: assignedMembers,
                currentBill: [],
                discount: 0,
            });

            await updateSessionRequest(activeRequest.id, 'approved');
            await deleteSessionRequest(activeRequest.id);

            const names = activeRequest.partyMembers.map(p => p.name).join(', ');
            toast({ title: "Session Started!", description: `${names} assigned to ${(availableStations || []).find(s => s.id === selectedStationId)?.name}.` });

            processedRef.current.add(activeRequest.id);
            setPendingRequests(prev => prev.filter(r => r.id !== activeRequest.id));
            setActiveRequest(null);
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: "System Error", description: "Failed to start session. Try again." });
        } finally {
            setIsProcessing(false);
        }
    };

    if (!activeRequest) return null;

    const partyCount = activeRequest.partyMembers.length;

    return (
        <AlertDialog open={!!activeRequest} onOpenChange={() => {}}>
            <AlertDialogContent className="border-2 border-primary/30 z-[10001] max-w-md bg-card shadow-2xl shadow-primary/10 rounded-3xl overflow-hidden p-0">
                {/* Header Bar */}
                <div className="bg-primary px-6 py-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
                    <AlertDialogHeader className="relative z-10 m-0 space-y-1">
                        <AlertDialogTitle className="text-black font-headline text-3xl tracking-tighter flex items-center gap-3">
                            <Gamepad2 className="h-7 w-7" />
                            SESSION REQUEST
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-black/60 font-black text-[10px] uppercase tracking-widest m-0">
                            {partyCount > 1 ? `Party of ${partyCount} wants to play` : 'Player wants to start a session'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                </div>

                <div className="p-6 space-y-5">
                    {/* Party Members */}
                    <div className="space-y-3">
                        {activeRequest.partyMembers.map((p, i) => (
                            <div key={p.id} className={cn(
                                "flex items-center gap-4 p-3 rounded-2xl border",
                                i === 0 ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border/50"
                            )}>
                                <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-sm">
                                    <AvatarImage src={p.avatarUrl} />
                                    <AvatarFallback className="font-bold text-sm">{p.name[0]}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="font-headline text-lg tracking-tight leading-none truncate">{p.name}</p>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">
                                        {i === 0 ? 'Host' : 'Party Member'}
                                    </p>
                                </div>
                                {i === 0 && (
                                    <div className="shrink-0 px-3 py-1.5 bg-primary text-black text-[8px] font-black uppercase tracking-widest rounded-full">
                                        Primary
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Station Selector */}
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Gamepad2 className="w-3.5 h-3.5 text-primary" />
                            Assign PS5 Console
                        </p>
                        <Select value={selectedStationId} onValueChange={setSelectedStationId}>
                            <SelectTrigger className="h-14 font-bold uppercase tracking-tight text-sm border-2 rounded-2xl">
                                <SelectValue placeholder="Select an available console..." />
                            </SelectTrigger>
                            <SelectContent>
                                {(availableStations || []).length === 0 ? (
                                    <SelectItem value="none" disabled>No consoles available</SelectItem>
                                ) : (
                                    (availableStations || []).map(s => (
                                        <SelectItem key={s.id} value={s.id} className="font-bold uppercase tracking-tight">
                                            {s.name}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            className="flex-1 h-14 font-black uppercase tracking-widest text-[11px] border-2 border-destructive/30 text-destructive hover:bg-destructive hover:text-white rounded-2xl transition-all"
                            onClick={handleDeny}
                            disabled={isProcessing}
                        >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><X className="w-4 h-4 mr-2" />Deny</>}
                        </Button>
                        <Button
                            className="flex-1 h-14 font-black uppercase tracking-widest text-[11px] bg-primary text-black hover:bg-primary/90 rounded-2xl transition-all shadow-lg shadow-primary/20"
                            onClick={handleApprove}
                            disabled={isProcessing || !selectedStationId}
                        >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-2" />Approve</>}
                        </Button>
                    </div>

                    {/* Pending queue count */}
                    {pendingRequests.length > 1 && (
                        <p className="text-center text-[9px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">
                            +{pendingRequests.length - 1} more request{pendingRequests.length > 2 ? 's' : ''} waiting
                        </p>
                    )}
                </div>
            </AlertDialogContent>
        </AlertDialog>
    );
}
