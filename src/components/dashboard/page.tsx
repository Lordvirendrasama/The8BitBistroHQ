
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Station, Member, AssignedMember, GamingPackage, FoodItem, BillItem, MemberTier, StationStatus } from '@/lib/types';
import { TimerCard } from '@/components/dashboard/timer-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gamepad2, PlusCircle, Users } from 'lucide-react';
import { SelectMemberModal } from '@/components/dashboard/select-member-modal';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy, runTransaction, doc } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { addStation, updateStation } from '@/firebase/firestore/stations';
import { settings } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { BillModal } from '@/components/dashboard/bill-modal';
import { CheckoutModal } from '@/components/dashboard/checkout-modal';
import { AddTimeModal } from '@/components/dashboard/add-time-modal';
import { ReduceTimeModal } from '@/components/dashboard/reduce-time-modal';
import { archiveBill } from '@/firebase/firestore/bills';

const tierMultipliers: Record<MemberTier, number> = {
  Red: 1,
  Green: 1.5,
  Gold: 2,
};

export default function DashboardPage() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isAddTimeModalOpen, setIsAddTimeModalOpen] = useState(false);
  const [isReduceTimeModalOpen, setIsReduceTimeModalOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

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

  const onGrantXp = (memberId: string, baseXp: number, billAmount: number, billId?: string) => {
    if (!db) return;
    runTransaction(db, async (transaction) => {
      const memberRef = doc(db, "members", memberId);
      const memberDoc = await transaction.get(memberRef);
      if (!memberDoc.exists()) throw "Member not found!";

      const member = memberDoc.data() as Member;
      const multiplier = tierMultipliers[member.tier] || 1;
      const finalXpToGrant = Math.floor(baseXp * multiplier);
      
      const newXp = member.xp + finalXpToGrant;
      const newTotalSpent = member.totalSpent + billAmount;

      let newLevel = member.level;
      let newPoints = member.points;
      
      const xpForNextLevel = newLevel * settings.xpPerLevel;
      if (newXp >= xpForNextLevel) {
          newLevel += 1;
          newPoints += settings.pointsPerLevelUp;
      }
      
      const memberUpdates = { xp: newXp, level: newLevel, points: newPoints, totalSpent: newTotalSpent };
      transaction.update(memberRef, memberUpdates);
      
      const transactionRef = doc(collection(db, `members/${memberId}/transactions`));
      const txPayload: any = {
        date: new Date().toISOString(),
        amount: billAmount,
        xpGained: finalXpToGrant,
      };

      if (billId) {
        txPayload.billId = billId;
      }
      
      transaction.set(transactionRef, txPayload);

    }).catch(e => {
        console.error("Transaction failed: ", e);
        toast({
            variant: "destructive",
            title: "Checkout Error",
            description: "Could not grant XP or update member details."
        });
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
    if (!station.endTime) return;
    const remaining = new Date(station.endTime).getTime() - Date.now();
    updateStation(station.id, {
        status: 'paused',
        pauseStartTime: new Date().toISOString(),
        remainingTimeOnPause: Math.max(0, Math.floor(remaining / 1000)), // store seconds
    });
  };

  const handleResumeTimer = (station: Station) => {
      if (station.remainingTimeOnPause == null) return;
      const newEndTime = new Date(Date.now() + station.remainingTimeOnPause * 1000);
      updateStation(station.id, {
          status: 'in-use',
          endTime: newEndTime.toISOString(),
          pauseStartTime: null,
          remainingTimeOnPause: null,
      });
  };

  const handleToggleTimer = (station: Station) => {
    if (station.status === 'in-use') {
      handlePauseTimer(station);
    } else if (station.status === 'paused') {
        handleResumeTimer(station);
    } else {
      setSelectedStation(station);
      setIsModalOpen(true);
    }
  };
  
  const handleStopSession = (station: Station) => {
      setSelectedStation(station);
      setIsCheckoutModalOpen(true);
  }

  const handleStartSession = (assignedPlayers: AssignedMember[], selectedPackage: GamingPackage) => {
    if (!selectedStation) return;
    const now = new Date();
    const endTime = new Date(now.getTime() + selectedPackage.duration * 1000);
    updateStation(selectedStation.id, {
        status: 'in-use',
        startTime: now.toISOString(),
        endTime: endTime.toISOString(),
        packageName: selectedPackage.name,
        members: assignedPlayers,
        currentBill: [],
        discount: 0,
    });
    setIsModalOpen(false);
    setSelectedStation(null);
  };
  
  const handleStartFoodSession = (stationId: string, assignedPlayers: AssignedMember[]) => {
    const updates: Partial<Station> = {
        status: 'in-use',
        members: assignedPlayers,
        startTime: new Date().toISOString(),
        endTime: null,
        packageName: "Walk-in Order", // Use a descriptive name
        currentBill: [],
        discount: 0,
    };
    updateStation(stationId, updates);
    setSelectedStation(prev => {
      if (!prev || prev.id !== stationId) return prev;
      return { ...prev, ...updates } as Station;
    });
  };

  const handleOpenBillModal = (station: Station) => {
    setSelectedStation(station);
    setIsBillModalOpen(true);
  };

  const handleSaveBill = (stationId: string, newBill: BillItem[], newDiscount: number) => {
    updateStation(stationId, { currentBill: newBill, discount: newDiscount });
    toast({ title: "Bill Saved", description: "The station's bill has been updated." });
  };

  const handleConfirmCheckout = async (stationId: string, finalBill: number, billItems: BillItem[], discountValue: number) => {
    const station = stations?.find(s => s.id === stationId);
    if (!station) return;

    // Archive the bill to get an ID
    const initialPackage = gamingPackages?.find(p => p.name === station.packageName);
    const initialPackagePrice = (initialPackage && !billItems.some(item => item.name === station.packageName)) ? initialPackage.price : 0;
    const foodSubtotal = billItems.filter(item => !item.name.startsWith('Time:')).reduce((total, item) => total + (item.price * item.quantity), 0);
    const newBillId = await archiveBill({
        stationId: station.id,
        stationName: station.name,
        members: station.members,
        items: billItems,
        initialPackagePrice,
        foodSubtotal,
        discount: discountValue,
        totalAmount: finalBill,
        timestamp: new Date().toISOString(),
        paymentMethod: 'cash', // Default fallback
    });

    if (!newBillId) {
      toast({ variant: 'destructive', title: 'Checkout Error', description: 'Failed to archive the bill.' });
      return;
    }

    const realMembers = station.members.filter(m => m.id && !m.id.startsWith('guest-'));
    // FIX: Divide bill by TOTAL players (members + guests) so XP share is fair
    const totalParticipants = station.members.length;
    const billPerMember = totalParticipants > 0 ? finalBill / totalParticipants : 0;

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
    
    const thankYouMessage = `Thank you for your payment of ${finalBill.toLocaleString()} Rupees. Station ${station.name} is now available.`;
    toast({ title: "Payment Received!", description: thankYouMessage });
    
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(thankYouMessage);
      window.speechSynthesis.speak(utterance);
    }

    setIsCheckoutModalOpen(false);
    setSelectedStation(null);
  };

  const handleOpenAddTimeModal = (station: Station) => {
    setSelectedStation(station);
    setIsAddTimeModalOpen(true);
  };

  const handleAddTime = (pkg: GamingPackage, quantity: number) => {
    if (!selectedStation) return;

    // The duration is added only once, but the cost is multiplied by quantity.
    const durationToAddInSeconds = pkg.duration;

    let newEndTime: Date | null = null;
    let newRemainingTimeOnPause: number | null = null;

    if (selectedStation.status === 'paused' && selectedStation.remainingTimeOnPause != null) {
        newRemainingTimeOnPause = selectedStation.remainingTimeOnPause + durationToAddInSeconds;
    } else if (selectedStation.status === 'in-use' && selectedStation.endTime) {
        const currentEndTime = new Date(selectedStation.endTime);
        newEndTime = new Date(currentEndTime.getTime() + durationToAddInSeconds * 1000);
    } else {
        toast({ variant: 'destructive', title: "Cannot Add Time", description: "You can only add time to an active or paused session with a timer."});
        return;
    }
    
    // Find if a bill item for this time package already exists
    const currentBill = selectedStation.currentBill || [];
    const existingItemIndex = currentBill.findIndex(
        (item) => item.itemId === pkg.id && item.name.startsWith('Time:')
    );

    let newBill: BillItem[];

    if (existingItemIndex > -1) {
        // If it exists, just increase its quantity
        newBill = [...currentBill];
        newBill[existingItemIndex].quantity += quantity;
    } else {
        // If not, add it as a new item
        const newBillItem: BillItem = {
            itemId: pkg.id,
            name: `Time: ${pkg.name}`,
            price: pkg.price,
            quantity: quantity,
            addedAt: new Date().toISOString()
        };
        newBill = [...currentBill, newBillItem];
    }
    
    const updates: Partial<Station> = {
        currentBill: newBill,
    };
    if (newEndTime) {
        updates.endTime = newEndTime.toISOString();
    }
    if (newRemainingTimeOnPause != null) {
        updates.remainingTimeOnPause = newRemainingTimeOnPause;
    }

    updateStation(selectedStation.id, updates);

    toast({ title: "Time Added", description: `${pkg.name} has been added for ${quantity} player(s) to ${selectedStation.name}.`});
    setIsAddTimeModalOpen(false);
    setSelectedStation(null);
  };

  const handleOpenReduceTimeModal = (station: Station) => {
    setSelectedStation(station);
    setIsReduceTimeModalOpen(true);
  };

  const handleReduceTime = (minutesToReduce: number) => {
    if (!selectedStation) return;

    const secondsToReduce = minutesToReduce * 60;

    let newEndTime: Date | null = null;
    let newRemainingTimeOnPause: number | null = null;

    if (selectedStation.status === 'paused' && selectedStation.remainingTimeOnPause != null) {
        newRemainingTimeOnPause = Math.max(0, selectedStation.remainingTimeOnPause - secondsToReduce);
    } else if (selectedStation.status === 'in-use' && selectedStation.endTime) {
        const currentEndTime = new Date(selectedStation.endTime);
        newEndTime = new Date(currentEndTime.getTime() - secondsToReduce * 1000);
    } else {
        toast({ variant: 'destructive', title: "Cannot Reduce Time", description: "You can only reduce time from an active or paused session with a timer."});
        return;
    }
    
    const updates: Partial<Station> = {};
    if (newEndTime) {
        updates.endTime = newEndTime.toISOString();
    }
    if (newRemainingTimeOnPause != null) {
        updates.remainingTimeOnPause = newRemainingTimeOnPause;
    }

    if (Object.keys(updates).length > 0) {
        updateStation(selectedStation.id, updates);
        toast({ title: "Time Reduced", description: `${minutesToReduce} minutes have been removed from ${selectedStation.name}.`});
    }

    setIsReduceTimeModalOpen(false);
    setSelectedStation(null);
  };

  if (stationsLoading || membersLoading) {
    return <div className="flex h-screen items-center justify-center">Loading Cafe Dashboard...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-4xl tracking-wider text-foreground">
          Cafe Dashboard
        </h1>
        <p className="mt-2 text-muted-foreground">
          Manage active timers for PS5 consoles and board game tables.
        </p>
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
                  <TimerCard key={station.id} station={station} onToggleTimer={() => handleToggleTimer(station)} onStopSession={() => handleStopSession(station)} onOpenBillModal={() => handleOpenBillModal(station)} onOpenEditTimeModal={() => handleOpenAddTimeModal(station)} />
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-12">
                <p>No PS5 consoles added yet.</p>
                <p className="text-sm">Click "Add PS5" to get started.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-2xl flex items-center gap-2"><Users className="h-6 w-6" /> Board Game Tables</CardTitle>
            <Button onClick={() => handleAddStation('boardgame')}><PlusCircle className="mr-2 h-4 w-4" /> Add Table</Button>
          </CardHeader>
          <CardContent>
            {boardGameStations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {boardGameStations.map(station => (
                  <TimerCard key={station.id} station={station} onToggleTimer={() => handleToggleTimer(station)} onStopSession={() => handleStopSession(station)} onOpenBillModal={() => handleOpenBillModal(station)} onOpenEditTimeModal={() => handleOpenAddTimeModal(station)}/>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-12">
                <p>No board game tables added yet.</p>
                <p className="text-sm">Click "Add Table" to get started.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedStation && (
        <SelectMemberModal isOpen={isModalOpen} onOpenChange={setIsModalOpen} members={members || []} onConfirm={handleStartSession} station={selectedStation} />
      )}
      
      <BillModal 
        isOpen={isBillModalOpen} 
        onOpenChange={setIsBillModalOpen} 
        station={selectedStation} 
        allMembers={members || []}
        foodItems={foodItems || []} 
        onSaveBill={handleSaveBill} 
        gamingPackages={gamingPackages || []} 
        onConfirmCheckout={handleConfirmCheckout}
        onStartFoodSession={handleStartFoodSession} />

      <CheckoutModal 
        isOpen={isCheckoutModalOpen} 
        onOpenChange={setIsCheckoutModalOpen} 
        station={selectedStation} 
        gamingPackages={gamingPackages || []} 
        onConfirmCheckout={handleConfirmCheckout} 
        onSaveBill={handleSaveBill}
        allMembers={members || []}
        foodItems={foodItems || []}
      />
      
      <AddTimeModal 
        isOpen={isAddTimeModalOpen}
        onOpenChange={setIsAddTimeModalOpen}
        onAddTime={handleAddTime}
        gamingPackages={gamingPackages || []}
        station={selectedStation}
      />

      <ReduceTimeModal
        isOpen={isReduceTimeModalOpen}
        onOpenChange={setIsReduceTimeModalOpen}
        onReduceTime={handleReduceTime}
        station={selectedStation}
      />

    </div>
  );
}
