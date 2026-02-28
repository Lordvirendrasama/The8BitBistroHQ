
'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import type { Station, Member, AssignedMember, GamingPackage, FoodItem, BillItem, MemberTier, PaymentMethod } from '@/lib/types';
import { TimerCard } from '@/components/dashboard/timer-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gamepad2, PlusCircle, Users, Loader2 } from 'lucide-react';
import { SelectMemberModal } from '@/components/dashboard/select-member-modal';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy, runTransaction, doc } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { addStation, updateStation, addPlayerToSession } from '@/firebase/firestore/stations';
import { settings } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { BillModal } from '@/components/dashboard/bill-modal';
import { CheckoutModal } from '@/components/dashboard/checkout-modal';
import { EditTimeModal } from '@/components/dashboard/edit-time-modal';
import { MoveStationModal } from '@/components/dashboard/move-station-modal';
import { JoinPlayerModal } from '@/components/dashboard/join-player-modal';
import { archiveBill } from '@/firebase/firestore/bills';
import { createSystemAnnouncement } from '@/firebase/firestore/announcements';
import { useSearchParams } from 'next/navigation';
import { rechargeMember, consumeRechargeTime, consumeMemberBalancePool } from '@/firebase/firestore/members';

const tierMultipliers: Record<MemberTier, number> = {
  Red: 1,
  Green: 1.5,
  Gold: 2,
};

function DashboardContent() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isEditTimeModalOpen, setIsEditTimeModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  const membersQuery = useMemo(() => !db ? null : collection(db, 'members'), [db]);
  const { data: members, loading: membersLoading } = useCollection<Member>(membersQuery);
  
  const stationsQuery = useMemo(() => !db ? null : query(collection(db, 'stations'), orderBy('name')), [db]);
  const { data: stations, loading: stationsLoading } = useCollection<Station>(stationsQuery);

  const foodItemsQuery = useMemo(() => !db ? null : collection(db, 'foodItems'), [db]);
  const { data: foodItems } = useCollection<FoodItem>(foodItemsQuery);

  const packagesQuery = useMemo(() => !db ? null : collection(db, 'gamingPackages'), [db]);
  const { data: gamingPackages } = useCollection<GamingPackage>(packagesQuery);

  const ps5Stations = useMemo(() => stations?.filter(s => s.type === 'ps5') || [], [stations]);
  const boardGameStations = useMemo(() => stations?.filter(s => s.type === 'boardgame') || [], [stations]);
  const availableStations = useMemo(() => stations?.filter(s => s.status === 'available') || [], [stations]);

  useEffect(() => {
    const checkoutId = searchParams.get('checkoutId');
    if (checkoutId && stations && stations.length > 0) {
      const station = stations.find(s => s.id === checkoutId);
      if (station) {
        setSelectedStation(station);
        setIsCheckoutModalOpen(true);
        const url = new URL(window.location.href);
        url.searchParams.delete('checkoutId');
        window.history.replaceState({}, '', url.pathname);
      }
    }
  }, [searchParams, stations]);

  const onGrantXp = (memberId: string, baseXp: number, billAmount: number, billId?: string) => {
    if (!db) return;
    runTransaction(db, async (transaction) => {
      const memberRef = doc(db, "members", memberId);
      const memberDoc = await transaction.get(memberRef);
      if (!memberDoc.exists()) throw "Member not found!";

      const member = memberDoc.data() as Member;
      const multiplier = tierMultipliers[member.tier] || 1;
      const finalXpToGrant = Math.floor(baseXp * multiplier);
      
      const newXp = (member.xp || 0) + finalXpToGrant;
      const newTotalSpent = (member.totalSpent || 0) + billAmount;

      let newLevel = member.level || 1;
      let newPoints = member.points || 0;
      
      const xpForNextLevel = newLevel * settings.xpPerLevel;
      if (newXp >= xpForNextLevel) {
          newLevel += 1;
          newPoints += settings.pointsPerLevelUp;
      }
      
      transaction.update(memberRef, { xp: newXp, level: newLevel, points: newPoints, totalSpent: newTotalSpent });
      
      const transactionRef = doc(collection(db, `members/${memberId}/transactions`));
      transaction.set(transactionRef, {
        date: new Date().toISOString(),
        amount: billAmount,
        xpGained: finalXpToGrant,
        billId: billId || null
      });

    }).catch(e => {
        console.error("XP Transaction failed: ", e);
    });
  };

  const handleAddStation = async (type: 'ps5' | 'boardgame') => {
    const stationList = type === 'ps5' ? ps5Stations : boardGameStations;
    const existingNumbers = stationList.map(s => parseInt(s.name.match(/\d+$/)?.[0] || '0', 10)).filter(n => !isNaN(n));
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const newName = type === 'ps5' ? `PS5 ${maxNumber + 1}` : `Table ${maxNumber + 1}`;

    await addStation({ name: newName, type, status: 'available', startTime: null, endTime: null, packageName: null, members: [], currentBill: [], discount: 0 });
  };

  const handlePauseTimer = (station: Station) => {
    const now = new Date().toISOString();
    const updatedMembers = station.members.map(m => {
        if (!m.endTime || m.status === 'finished') return m;
        const remaining = new Date(m.endTime).getTime() - Date.now();
        return { 
            ...m, 
            status: 'paused' as const,
            remainingTimeOnPause: Math.max(0, Math.floor(remaining / 1000)) 
        };
    });
    
    const stationRemaining = station.endTime ? new Date(station.endTime).getTime() - Date.now() : 0;

    updateStation(station.id, {
        status: 'paused',
        pauseStartTime: now,
        remainingTimeOnPause: Math.max(0, Math.floor(stationRemaining / 1000)),
        members: updatedMembers
    });
  };

  const handleResumeTimer = (station: Station) => {
      const updatedMembers = station.members.map(m => {
          if (m.remainingTimeOnPause == null || m.status === 'finished') return m;
          return {
              ...m,
              status: 'active' as const,
              endTime: new Date(Date.now() + m.remainingTimeOnPause * 1000).toISOString(),
              remainingTimeOnPause: null
          };
      });
      
      const newStationEndTime = station.remainingTimeOnPause 
        ? new Date(Date.now() + station.remainingTimeOnPause * 1000).toISOString()
        : null;

      updateStation(station.id, {
          status: 'in-use',
          endTime: newStationEndTime,
          pauseStartTime: null,
          remainingTimeOnPause: null,
          members: updatedMembers
      });
  };

  const handleToggleTimer = (station: Station) => {
    if (station.status === 'in-use') handlePauseTimer(station);
    else if (station.status === 'paused') handleResumeTimer(station);
    else {
      setSelectedStation(station);
      setIsModalOpen(true);
    }
  };

  const handleTogglePlayerTimer = async (stationId: string, playerId: string) => {
    const station = stations?.find(s => s.id === stationId);
    if (!station) return;

    let updatedMembers = [...station.members];
    const memberIndex = updatedMembers.findIndex(m => m.id === playerId);
    if (memberIndex === -1) return;

    const member = updatedMembers[memberIndex];
    
    if (station.status === 'paused') {
        toast({ title: "Station Paused", description: "Resume the whole station first." });
        return;
    }

    if (member.status === 'paused') {
        // Resume individual
        const newEndTime = new Date(Date.now() + (member.remainingTimeOnPause || 0) * 1000).toISOString();
        updatedMembers[memberIndex] = {
            ...member,
            status: 'active',
            endTime: newEndTime,
            remainingTimeOnPause: null
        };
    } else {
        // Pause individual
        const remaining = member.endTime ? new Date(member.endTime).getTime() - Date.now() : 0;
        updatedMembers[memberIndex] = {
            ...member,
            status: 'paused',
            remainingTimeOnPause: Math.max(0, Math.floor(remaining / 1000)),
        };
    }

    // Recalculate station-level latest endTime based on active players only
    const activeMembers = updatedMembers.filter(m => m.status === 'active');
    const endTimes = activeMembers.map(p => p.endTime ? new Date(p.endTime).getTime() : 0).filter(t => t > 0);
    const latestEndTime = endTimes.length > 0 ? new Date(Math.max(...endTimes)).toISOString() : null;

    updateStation(stationId, {
        members: updatedMembers,
        endTime: latestEndTime
    });
  };
  
  const handleStopSession = (station: Station) => {
      setSelectedStation(station);
      setIsCheckoutModalOpen(true);
  }

  const handleOpenBillModal = (station: Station) => {
    setSelectedStation(station);
    setIsBillModalOpen(true);
  };

  const handleOpenEditTimeModal = (station: Station) => {
    setSelectedStation(station);
    setIsEditTimeModalOpen(true);
  };

  const handleOpenMoveModal = (station: Station) => {
    setSelectedStation(station);
    setIsMoveModalOpen(true);
  };

  const handleOpenJoinModal = (station: Station) => {
    setSelectedStation(station);
    setIsJoinModalOpen(true);
  };

  const handleStopPlayer = async (stationId: string, playerId: string) => {
    const station = stations?.find(s => s.id === stationId);
    if (!station) return;

    const now = new Date();
    let updatedMembers = [...station.members];
    const memberIndex = updatedMembers.findIndex(m => m.id === playerId);
    if (memberIndex === -1) return;

    const member = updatedMembers[memberIndex];
    
    let playedSeconds = 0;
    if (member.startTime) {
        const totalPossibleSeconds = member.endTime ? (new Date(member.endTime).getTime() - new Date(member.startTime).getTime()) / 1000 : 0;
        let remainingSeconds = 0;
        
        if ((station.status === 'paused' || member.status === 'paused') && member.remainingTimeOnPause != null) {
            remainingSeconds = member.remainingTimeOnPause;
        } else if (member.endTime) {
            remainingSeconds = Math.max(0, (new Date(member.endTime).getTime() - Date.now()) / 1000);
        }
        
        playedSeconds = Math.max(0, totalPossibleSeconds - remainingSeconds);
    }

    if (member.rechargeId) {
        if (member.rechargeId === 'pool') {
            await consumeMemberBalancePool(member.id, playedSeconds);
        } else {
            await consumeRechargeTime(member.id, member.rechargeId, playedSeconds);
        }
    }

    updatedMembers[memberIndex] = {
        ...member,
        status: 'finished',
        endTime: now.toISOString(),
        remainingTimeOnPause: null
    };

    const activeMembers = updatedMembers.filter(m => m.status !== 'finished');
    const endTimes = activeMembers.map(p => p.endTime ? new Date(p.endTime).getTime() : 0).filter(t => t > 0);
    const latestEndTime = endTimes.length > 0 ? new Date(Math.max(...endTimes)).toISOString() : null;

    updateStation(stationId, {
        members: updatedMembers,
        endTime: latestEndTime
    });

    toast({ title: `Stopped Session for ${member.name}` });

    if (activeMembers.length === 0) {
        setSelectedStation({ ...station, members: updatedMembers, endTime: latestEndTime });
        setIsCheckoutModalOpen(true);
    }
  };

  const handleStartSession = (assignedPlayers: AssignedMember[], selectedPackage: GamingPackage) => {
    if (!selectedStation) return;
    const now = new Date();
    
    const initialBill: BillItem[] = [];
    
    // Group players by walk-in package to handle capacity-based pricing
    const walkinGroups: Record<string, AssignedMember[]> = {};
    
    assignedPlayers.forEach(p => {
        if (!p.rechargeId && p.packageId) {
            if (!walkinGroups[p.packageId]) walkinGroups[p.packageId] = [];
            walkinGroups[p.packageId].push(p);
        }
    });

    Object.entries(walkinGroups).forEach(([pkgId, players]) => {
        const pkg = gamingPackages?.find(gp => gp.id === pkgId);
        if (pkg) {
            const capacity = pkg.playerCapacity || 1;
            const numInstances = Math.ceil(players.length / capacity);
            
            for (let i = 0; i < numInstances; i++) {
                const start = i * capacity;
                const end = Math.min(start + capacity, players.length);
                const subGroup = players.slice(start, end);
                const playerNames = subGroup.map(p => p.name).join(', ');
                
                const label = subGroup[0].isNewRecharge ? `Buy Recharge: ${pkg.name}` : pkg.name;
                
                initialBill.push({
                    itemId: pkg.id,
                    name: `${label} (${playerNames})`,
                    price: pkg.price,
                    quantity: 1,
                    addedAt: now.toISOString()
                });
            }
        }
    });

    const endTimes = assignedPlayers.map(p => p.endTime ? new Date(p.endTime).getTime() : 0).filter(t => t > 0);
    const latestEndTime = endTimes.length > 0 ? new Date(Math.max(...endTimes)).toISOString() : null;

    updateStation(selectedStation.id, {
        status: 'in-use',
        startTime: now.toISOString(),
        endTime: latestEndTime,
        packageName: assignedPlayers.length === 1 ? (assignedPlayers[0].rechargeId ? `Recharge: ${selectedPackage.name}` : selectedPackage.name) : "Mixed Session",
        members: assignedPlayers.map(p => ({ ...p, status: 'active' })),
        currentBill: initialBill,
        discount: 0,
    });
    setIsModalOpen(false);
    setSelectedStation(null);
  };
  
  const handleConfirmJoin = async (newPlayer: AssignedMember, billItem: BillItem | null) => {
    if (!selectedStation) return;
    
    const result = await addPlayerToSession(selectedStation.id, newPlayer, billItem);
    if (result.success) {
        toast({ title: "Player Joined", description: `${newPlayer.name} has joined the session.` });
        setIsJoinModalOpen(false);
        setSelectedStation(null);
    } else {
        toast({ variant: 'destructive', title: "Join Failed", description: result.message });
    }
  };

  const handleStartFoodSession = (stationId: string, assignedPlayers: AssignedMember[]) => {
    updateStation(stationId, {
        status: 'in-use',
        members: assignedPlayers.map(p => ({ ...p, status: 'active' })),
        startTime: null,
        endTime: null,
        packageName: "Walk-in Order",
        currentBill: [],
        discount: 0,
    });
  };

  const handleSaveBill = (stationId: string, newBill: BillItem[], newDiscount: number) => {
    updateStation(stationId, { currentBill: newBill, discount: newDiscount });
    toast({ title: "Bill Saved" });
  };

  const handleConfirmCheckout = async (
    stationId: string, 
    finalBill: number, 
    billItems: BillItem[], 
    discountValue: number, 
    paymentMethod: PaymentMethod,
    cashAmount?: number,
    upiAmount?: number,
    isRechargePurchase?: boolean,
    rechargePkg?: GamingPackage
  ) => {
    const station = stations?.find(s => s.id === stationId);
    if (!station) return;

    for (const member of station.members) {
        if (!member.id || member.id.startsWith('guest-') || member.status === 'finished') continue;

        let playedSecondsForMember = 0;
        if (member.startTime && member.endTime) {
            const totalSessionSeconds = Math.floor((new Date(member.endTime).getTime() - new Date(member.startTime).getTime()) / 1000);
            let remainingSecondsOnTimer = 0;
            if ((station.status === 'paused' || member.status === 'paused') && member.remainingTimeOnPause != null) {
                remainingSecondsOnTimer = member.remainingTimeOnPause;
            } else {
                const end = new Date(member.endTime).getTime();
                remainingSecondsOnTimer = Math.max(0, Math.floor((end - Date.now()) / 1000));
            }
            playedSecondsForMember = Math.max(0, totalSessionSeconds - remainingSecondsOnTimer);
        }

        if (member.isNewRecharge && member.packageId) {
            const pkg = gamingPackages?.find(p => p.id === member.packageId);
            if (pkg) {
                const newRechargeId = await rechargeMember(member.id, pkg, paymentMethod === 'upi' ? 'upi' : 'cash', { skipBill: true });
                if (newRechargeId) {
                    await consumeRechargeTime(member.id, newRechargeId, playedSecondsForMember);
                }
            }
        } 
        else if (member.rechargeId) {
            if (member.rechargeId === 'pool') {
                await consumeMemberBalancePool(member.id, playedSecondsForMember);
            } else {
                await consumeRechargeTime(member.id, member.rechargeId, playedSecondsForMember);
            }
        }
    }

    const initialPackage = gamingPackages?.find(p => {
        const pureName = station.packageName?.replace(/^(Recharge: |Buy Recharge: )/i, '').trim();
        return p.name.toLowerCase() === pureName?.toLowerCase();
    });

    const isExistingRecharge = station.packageName?.startsWith('Recharge: ');
    
    const hasItemizedSessionItems = billItems.some(i => {
        const nameLower = i.name.toLowerCase();
        return (
            station.members.some(m => nameLower.includes(`(${m.name.toLowerCase()})`)) ||
            nameLower.startsWith('time:') ||
            nameLower.startsWith('buy recharge:') ||
            nameLower.startsWith('recharge:')
        );
    });

    const initialPackagePrice = (initialPackage && !isExistingRecharge && !hasItemizedSessionItems && !billItems.some(item => item.name === station.packageName)) 
        ? initialPackage.price * Math.ceil(station.members.length / (initialPackage.playerCapacity || 1))
        : 0;
    
    const foodSubtotal = billItems.filter(item => !item.name.startsWith('Time:') && !item.name.startsWith('Walk-in:')).reduce((total, item) => total + (item.price * item.quantity), 0);
    
    const newBillId = await archiveBill({
        stationId: station.id,
        stationName: station.name,
        packageName: station.packageName || null,
        members: station.members,
        items: billItems,
        initialPackagePrice,
        foodSubtotal,
        discount: discountValue,
        totalAmount: finalBill,
        timestamp: new Date().toISOString(),
        paymentMethod,
        cashAmount: cashAmount || 0,
        upiAmount: upiAmount || 0,
    });

    if (!newBillId) {
      toast({ variant: 'destructive', title: 'Checkout Error', description: 'Failed to archive the bill.' });
      return;
    }

    const realMembers = station.members.filter(m => m.id && !m.id.startsWith('guest-'));
    
    // FIX: Divide bill by TOTAL players (members + guests) so XP share is fair
    const totalPlayers = station.members.length;
    const billPerMember = totalPlayers > 0 ? finalBill / totalPlayers : 0;

    if (billPerMember > 0) {
        realMembers.forEach(assignedMember => {
            const baseXp = Math.floor(billPerMember * settings.xpPerRupee);
            onGrantXp(assignedMember.id, baseXp, billPerMember, newBillId);
        });
    }

    updateStation(stationId, {
      status: 'available', startTime: null, endTime: null, packageName: null,
      members: [], currentBill: [], discount: 0,
    });
    
    const paymentLabel = paymentMethod === 'split' 
        ? `Split (C: ${cashAmount}, U: ${upiAmount})` 
        : paymentMethod.toUpperCase();

    const thankYouMessage = `Checkout for ${station.name}. Total: ₹${finalBill.toLocaleString()} via ${paymentLabel}.`;
    toast({ title: "Session Closed", description: thankYouMessage });
    await createSystemAnnouncement(thankYouMessage);

    setIsCheckoutModalOpen(false);
    setSelectedStation(null);
  };

  const handleAddTime = (pkg: GamingPackage, quantity: number, targetIds: string[]) => {
    if (!selectedStation) return;
    const durationToAddInSeconds = pkg.duration;
    
    const updatedMembers = selectedStation.members.map(m => {
        if (!targetIds.includes(m.id)) return m;
        
        let newEndTime = m.endTime ? new Date(m.endTime).toISOString() : null;
        let newRemaining = m.remainingTimeOnPause;
        
        const wasFinished = m.status === 'finished';
        const newStatus = 'active' as const;

        if ((selectedStation.status === 'paused' || m.status === 'paused') && m.remainingTimeOnPause != null) {
            newRemaining = m.remainingTimeOnPause + durationToAddInSeconds;
        } else if (selectedStation.status === 'in-use') {
            // Reactivation logic: If they were stopped, timer starts from NOW.
            const baseTime = (m.endTime && !wasFinished) ? new Date(m.endTime).getTime() : Date.now();
            newEndTime = new Date(baseTime + durationToAddInSeconds * 1000).toISOString();
        }
        
        return { 
            ...m, 
            status: newStatus, 
            endTime: newEndTime, 
            remainingTimeOnPause: newRemaining,
            startTime: m.startTime || new Date().toISOString()
        };
    });

    const currentBill = selectedStation.currentBill || [];
    
    const newBillItems: BillItem[] = [...currentBill];
    
    const capacity = pkg.playerCapacity || 1;
    const numInstances = Math.ceil(targetIds.length / capacity);
    
    for (let i = 0; i < numInstances; i++) {
        const start = i * capacity;
        const end = Math.min(start + capacity, targetIds.length);
        const subgroupTids = targetIds.slice(start, end);
        const playerNames = subgroupTids.map(tid => selectedStation.members.find(m => m.id === tid)?.name).filter(Boolean).join(', ');
        
        newBillItems.push({
            itemId: pkg.id,
            name: `Time: ${pkg.name} (${playerNames})`,
            price: pkg.price,
            quantity: 1,
            addedAt: new Date().toISOString()
        });
    }
    
    const activeMembers = updatedMembers.filter(m => m.status !== 'finished');
    const endTimes = activeMembers.map(p => p.endTime ? new Date(p.endTime).getTime() : 0).filter(t => t > 0);
    const latestEndTime = endTimes.length > 0 ? new Date(Math.max(...endTimes)).toISOString() : null;

    updateStation(selectedStation.id, { 
        currentBill: newBillItems, 
        members: updatedMembers,
        endTime: latestEndTime 
    });
    
    toast({ title: "Time Added", description: `Updated ${targetIds.length} players.` });
    setIsEditTimeModalOpen(false);
    setSelectedStation(null);
  };

  const handleReduceTime = (minutesToReduce: number, targetIds: string[]) => {
    if (!selectedStation) return;
    const secondsToReduce = minutesToReduce * 60;

    const updatedMembers = selectedStation.members.map(m => {
        if (m.status === 'finished' || !targetIds.includes(m.id)) return m;
        
        let newEndTime = m.endTime ? new Date(m.endTime).toISOString() : null;
        let newRemaining = m.remainingTimeOnPause;

        if ((selectedStation.status === 'paused' || m.status === 'paused') && m.remainingTimeOnPause != null) {
            newRemaining = Math.max(0, m.remainingTimeOnPause - secondsToReduce);
        } else if (selectedStation.status === 'in-use' && m.endTime) {
            newEndTime = new Date(new Date(m.endTime).getTime() - secondsToReduce * 1000).toISOString();
        }
        return { ...m, endTime: newEndTime, remainingTimeOnPause: newRemaining };
    });
    
    const activeMembers = updatedMembers.filter(m => m.status !== 'finished');
    const endTimes = activeMembers.map(p => p.endTime ? new Date(p.endTime).getTime() : 0).filter(t => t > 0);
    const latestEndTime = endTimes.length > 0 ? new Date(Math.max(...endTimes)).toISOString() : null;

    updateStation(selectedStation.id, { 
        members: updatedMembers,
        endTime: latestEndTime 
    });

    toast({ title: "Time Reduced", description: `Subtracted from ${targetIds.length} players.` });
    setIsEditTimeModalOpen(false);
    setSelectedStation(null);
  };

  if (stationsLoading || membersLoading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4 opacity-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="font-headline text-xs tracking-widest animate-pulse">Syncing Bistro Core...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-4xl tracking-wider text-foreground">Cafe Dashboard</h1>
        <p className="mt-2 text-muted-foreground">Manage active timers for PS5 consoles and board game tables.</p>
      </div>

      <div className="space-y-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-2xl flex items-center gap-2"><Gamepad2 className="h-6 w-6"/> PS5 Consoles</CardTitle>
            <Button onClick={() => handleAddStation('ps5')}><PlusCircle className="mr-2 h-4 w-4" /> Add PS5</Button>
          </CardHeader>
          <CardContent>
            {ps5Stations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {ps5Stations.map(station => (
                  <TimerCard 
                    key={station.id} 
                    station={station} 
                    onToggleTimer={() => handleToggleTimer(station)} 
                    onStopSession={() => handleStopSession(station)} 
                    onOpenBillModal={() => handleOpenBillModal(station)} 
                    onOpenEditTimeModal={() => handleOpenEditTimeModal(station)} 
                    onOpenMoveModal={() => handleOpenMoveModal(station)} 
                    onStopPlayer={handleStopPlayer}
                    onOpenJoinModal={handleOpenJoinModal}
                    onTogglePlayerTimer={handleTogglePlayerTimer}
                  />
                ))}
              </div>
            ) : <div className="text-center text-muted-foreground py-12 italic">No PS5 units online.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-2xl flex items-center gap-2"><Users className="h-6 w-6" /> Board Games</CardTitle>
            <Button onClick={() => handleAddStation('boardgame')}><PlusCircle className="mr-2 h-4 w-4" /> Add Table</Button>
          </CardHeader>
          <CardContent>
            {boardGameStations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {boardGameStations.map(station => (
                  <TimerCard 
                    key={station.id} 
                    station={station} 
                    onToggleTimer={() => handleToggleTimer(station)} 
                    onStopSession={() => handleStopSession(station)} 
                    onOpenBillModal={() => handleOpenBillModal(station)} 
                    onOpenEditTimeModal={() => handleOpenEditTimeModal(station)} 
                    onOpenMoveModal={() => handleOpenMoveModal(station)} 
                    onStopPlayer={handleStopPlayer}
                    onOpenJoinModal={handleOpenJoinModal}
                    onTogglePlayerTimer={handleTogglePlayerTimer}
                  />
                ))}
              </div>
            ) : <div className="text-center text-muted-foreground py-12 italic">No tables active.</div>}
          </CardContent>
        </Card>
      </div>

      {selectedStation && (
        <>
          <SelectMemberModal isOpen={isModalOpen} onOpenChange={setIsModalOpen} members={members || []} onConfirm={handleStartSession} station={selectedStation} />
          <BillModal isOpen={isBillModalOpen} onOpenChange={setIsBillModalOpen} station={selectedStation} allMembers={members || []} foodItems={foodItems || []} onSaveBill={handleSaveBill} gamingPackages={gamingPackages || []} onConfirmCheckout={handleConfirmCheckout} onStartFoodSession={handleStartFoodSession} />
          <CheckoutModal isOpen={isCheckoutModalOpen} onOpenChange={setIsCheckoutModalOpen} station={selectedStation} gamingPackages={gamingPackages || []} onConfirmCheckout={handleConfirmCheckout} onSaveBill={handleSaveBill} allMembers={members || []} foodItems={foodItems || []} />
          <EditTimeModal isOpen={isEditTimeModalOpen} onOpenChange={setIsEditTimeModalOpen} onAddTime={handleAddTime} onReduceTime={handleReduceTime} gamingPackages={gamingPackages || []} station={selectedStation} />
          <MoveStationModal isOpen={isMoveModalOpen} onOpenChange={setIsMoveModalOpen} sourceStation={selectedStation} availableStations={availableStations} />
          <JoinPlayerModal isOpen={isJoinModalOpen} onOpenChange={setIsJoinModalOpen} station={selectedStation} members={members || []} onConfirm={handleConfirmJoin} />
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center font-headline text-xs animate-pulse">Initializing Dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
