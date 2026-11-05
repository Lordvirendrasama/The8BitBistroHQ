
'use client';

import { useState, useMemo, useEffect, Suspense, useRef } from 'react';
import type { Station, Member, AssignedMember, GamingPackage, FoodItem, BillItem, MemberTier, PaymentMethod, Booking, RawMaterialRequest, Bill } from '@/lib/types';
import { TimerCard } from '@/components/dashboard/timer-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gamepad2, PlusCircle, Users, Loader2, Settings2, Zap, Gift, HelpCircle, Clock, Utensils, Sparkles, LayoutTemplate, Calendar, Package } from 'lucide-react';
import { SelectMemberModal } from '@/components/dashboard/select-member-modal';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { GuidedTour, TourStep } from '@/components/ui/guided-tour';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useData } from '@/context/data-context';
import { collection, query, orderBy, runTransaction, doc, where } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { addStation, updateStation, addPlayerToSession } from '@/firebase/firestore/stations';
import { settings } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { BillModal } from '@/components/dashboard/bill-modal';
import { CheckoutModal } from '@/components/dashboard/checkout-modal';
import { EditTimeModal } from '@/components/dashboard/edit-time-modal';
import { MoveStationModal } from '@/components/dashboard/move-station-modal';
import { JoinPlayerModal } from '@/components/dashboard/join-player-modal';
import { ManageStationsModal } from '@/components/dashboard/manage-stations-modal';
import { GlobalRechargeModal } from '@/components/dashboard/global-recharge-modal';
import { GlobalRewardsModal } from '@/components/dashboard/global-rewards-modal';
import { SessionRequestHandler } from '@/components/dashboard/session-request-handler';
import { archiveBill } from '@/firebase/firestore/bills';
import { adjustFoodItemStock } from '@/firebase/firestore/food-items';
import { createSystemAnnouncement } from '@/firebase/firestore/announcements';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/firebase/auth/use-user';
import { rechargeMember, consumeRechargeTime, consumeMemberBalancePool, adjustMemberBalancePool, reserveMemberBalance, reconcileMemberBalance, getMemberAvailableBalance } from '@/firebase/firestore/members';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { getSyncedNow, getSyncedDate } from '@/lib/synced-time';
import { calculateGroupPrice, calculatePlayerPrice, getTierMultiplier } from '@/lib/pricing';
import { GuestLoginWizardModal } from '@/components/dashboard/guest-login-wizard-modal';
import { isToday } from 'date-fns';
import { BookingsManagerModal } from '@/components/bookings/bookings-manager-modal';
import { useBookingAutoStarter } from '@/components/bookings/use-booking-auto-starter';
import { completeBooking } from '@/firebase/firestore/bookings';
import { RawMaterialsOrderModal } from '@/components/dashboard/raw-materials-order-modal';

const sanitize = (data: any): any => {
  if (data === undefined || data === null) return null;
  if (Array.isArray(data)) return data.map(v => sanitize(v));
  if (typeof data === 'object' && data !== null) {
    const clean: any = {};
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined) clean[key] = sanitize(data[key]);
    });
    return clean;
  }
  return data;
};

const tierMultipliers: Record<MemberTier, number> = {
  Red: 1,
  Green: 1.5,
  Gold: 2,
};

function DashboardContent() {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const isAdmin = user?.role === 'admin' || user?.username === 'Viren';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isEditTimeModalOpen, setIsEditTimeModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [isRewardsModalOpen, setIsRewardsModalOpen] = useState(false);
  const [isGuestWizardOpen, setIsGuestWizardOpen] = useState(false);
  const [isBookingsModalOpen, setIsBookingsModalOpen] = useState(false);
  const [isRawMaterialsModalOpen, setIsRawMaterialsModalOpen] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [manageType, setManageType] = useState<'ps5' | 'ps4' | 'boardgame' | 'retrogaming'>('ps5');
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [initialPlayers, setInitialPlayers] = useState<AssignedMember[] | undefined>(undefined);

  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const tourParam = searchParams.get('tour');

  const defaultTourSteps: TourStep[] = [
    {
      selector: "#cafe-dashboard-header",
      title: "1. Cafe Dashboard Hub",
      description: "Welcome to your operator terminal. Here, you monitor active gaming stations, track remaining session hours, and manage customer accounts.",
      position: "bottom"
    },
    {
      selector: "#redeem-perks-btn",
      title: "2. Redeem Perks",
      description: "Access the reward system. Redeem free gaming hours, beverages, or snack vouchers directly to verified player accounts.",
      position: "left"
    },
    {
      selector: "#quick-recharge-btn",
      title: "3. Quick Recharge",
      description: "Instantly recharge a player's prepaid hour balance pool. Updates their account credits database in real-time.",
      position: "left"
    },
    {
      selector: "#ps5-consoles-grid",
      title: "4. PS5 Consoles",
      description: "Manage your active gaming consoles. Start sessions, add players, pause timers, add food items, and checkout players.",
      position: "top"
    },
    {
      selector: "#board-games-grid",
      title: "5. Board Game Tables",
      description: "Track physical board games, table rentals, and play durations. End table sessions to invoice renting customers.",
      position: "top"
    },
    {
      selector: "#order-raw-material-btn",
      title: "6. Raw Materials & Stock Order",
      description: "When supplies run low, employees click here to report items that need ordering directly to the owner.",
      position: "left"
    }
  ];

  const checkinTourSteps: TourStep[] = [
    {
      selector: "#ps5-consoles-grid",
      title: "1. Idle Stations",
      description: "Locate any idle console or table on the dashboard grid. Idle stations are marked with green START buttons.",
      position: "top"
    },
    {
      selector: ".station-start-btn, #ps5-consoles-grid",
      title: "2. Assign Players Trigger",
      description: "Click 'START' to open the registration dialog. Select GUEST access or search the database for registered MEMBERS.",
      position: "bottom"
    }
  ];

  const controlsTourSteps: TourStep[] = [
    {
      selector: ".station-pause-btn, #ps5-consoles-grid",
      title: "1. Pause Session",
      description: "Freeze time tracking for player breaks. Stops time deductions and flips status to paused.",
      position: "bottom"
    },
    {
      selector: ".station-time-btn, #ps5-consoles-grid",
      title: "2. Adjust Time Limits",
      description: "Click 'TIME' to add extra prepaid minutes or reduce play balance.",
      position: "bottom"
    },
    {
      selector: ".station-join-btn, #ps5-consoles-grid",
      title: "3. Join co-player",
      description: "Add additional players (up to 4 members) to active console slots to split hourly rates.",
      position: "bottom"
    },
    {
      selector: ".station-move-btn, #ps5-consoles-grid",
      title: "4. Relocate Station",
      description: "Shift active players to another console. Retains all logged items and timers.",
      position: "bottom"
    }
  ];

  const checkoutTourSteps: TourStep[] = [
    {
      selector: ".station-food-btn, #ps5-consoles-grid",
      title: "1. Order Food",
      description: "Click 'FOOD' to open the kitchen cart. Log drinks or snacks straight to the station drawer.",
      position: "bottom"
    },
    {
      selector: ".station-stop-btn, #ps5-consoles-grid",
      title: "2. End & Settle Session",
      description: "Tap 'STOP ALL' to close the session, compile totals, and launch the invoice Review dialog.",
      position: "bottom"
    }
  ];

  const perksTourSteps: TourStep[] = [
    {
      selector: "#redeem-perks-btn",
      title: "1. Redeem Member Perks",
      description: "Redeem free vouchers, achievements rewards, or tier bonuses for registered members.",
      position: "left"
    },
    {
      selector: "#quick-recharge-btn",
      title: "2. Account Credits Recharge",
      description: "Quick recharge prepaid credit hours directly to registered customer database files.",
      position: "left"
    }
  ];

  const tourSteps =
    tourParam === 'checkin' ? checkinTourSteps :
      tourParam === 'controls' ? controlsTourSteps :
        tourParam === 'checkout' ? checkoutTourSteps :
          tourParam === 'perks' ? perksTourSteps : defaultTourSteps;

  const { stations: rawStations, stationsLoading, foodItems, foodItemsLoading: foodLoading, gamingPackages, gamingPackagesLoading: packagesLoading } = useData();

  useEffect(() => {
    const tourVal = searchParams.get('tour');
    if (tourVal) {
      setTourOpen(true);
    }
  }, [searchParams]);

  const activeMemberIds = useMemo(() => {
    const ids: string[] = [];
    if (rawStations) {
      rawStations.forEach(s => {
        if (s.status !== 'available') {
          (s.members || []).forEach(m => {
            if (m.id && !m.id.startsWith('guest-')) {
              ids.push(m.id);
            }
          });
        }
      });
    }
    if (selectedStation) {
      (selectedStation.members || []).forEach(m => {
        if (m.id && !m.id.startsWith('guest-')) {
          ids.push(m.id);
        }
      });
    }
    return Array.from(new Set(ids));
  }, [rawStations, selectedStation]);

  const activeMemberIdsStr = activeMemberIds.join(',');
  const membersQuery = useMemo(() => {
    if (!db) return null;
    if (activeMemberIds.length === 0) return null;
    return query(collection(db, 'members'), where('__name__', 'in', activeMemberIds.slice(0, 30)));
  }, [db, activeMemberIdsStr]);

  const { data: members, loading: membersLoading } = useCollection<Member>(membersQuery);

  const bookingsQuery = useMemo(() => {
    if (!db) return null;
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return query(collection(db, 'bookings'), where('startTime', '>=', cutoff), orderBy('startTime', 'asc'));
  }, [db]);
  const { data: bookings } = useCollection<Booking>(bookingsQuery);

  const todayBookingsCount = useMemo(() => {
    if (!bookings) return 0;
    return bookings.filter(b => {
      try {
        return isToday(new Date(b.startTime)) && (b.status === 'confirmed' || b.status === 'active');
      } catch {
        return false;
      }
    }).length;
  }, [bookings]);

  const rawRequestsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'rawMaterialRequests'), where('status', '==', 'pending'));
  }, [db]);
  const { data: pendingRawRequests } = useCollection<RawMaterialRequest>(rawRequestsQuery);
  const pendingRawRequestsCount = pendingRawRequests?.length || 0;


  const stations = useMemo(() => {
    if (!rawStations) return [];
    return [...rawStations].sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [rawStations]);

  const ps5Stations = useMemo(() => stations?.filter(s => s.type === 'ps5') || [], [stations]);
  const ps4Stations = useMemo(() => stations?.filter(s => s.type === 'ps4') || [], [stations]);
  const boardGameStations = useMemo(() => stations?.filter(s => s.type === 'boardgame') || [], [stations]);
  const retroGamingStations = useMemo(() => stations?.filter(s => s.type === 'retrogaming') || [], [stations]);
  const availableStations = useMemo(() => stations?.filter(s => s.status === 'available') || [], [stations]);

  useBookingAutoStarter({ bookings: bookings || [], stations });

  useEffect(() => {
    const checkoutId = searchParams.get('checkoutId');
    const addTimeId = searchParams.get('addTimeId');
    if (checkoutId && stations && stations.length > 0) {
      const station = stations.find(s => s.id === checkoutId);
      if (station) {
        setSelectedStation(station);
        setIsCheckoutModalOpen(true);
        const url = new URL(window.location.href);
        url.searchParams.delete('checkoutId');
        window.history.replaceState({}, '', url.pathname);
      }
    } else if (addTimeId && stations && stations.length > 0) {
      const station = stations.find(s => s.id === addTimeId);
      if (station) {
        setSelectedStation(station);
        setIsEditTimeModalOpen(true);
        const url = new URL(window.location.href);
        url.searchParams.delete('addTimeId');
        window.history.replaceState({}, '', url.pathname);
      }
    }
  }, [searchParams, stations]);

  useEffect(() => {
    if (selectedStation) {
      const latest = stations.find(s => s.id === selectedStation.id);
      if (latest && JSON.stringify(latest) !== JSON.stringify(selectedStation)) {
        setSelectedStation(latest);
      }
    }
  }, [stations, selectedStation]);

  const onGrantXp = (memberId: string, baseXp: number, billAmount: number, billId?: string) => {
    if (!db || !memberId) return;
    runTransaction(db, async (transaction) => {
      const memberRef = doc(db, "members", memberId);
      const memberDoc = await transaction.get(memberRef);
      if (!memberDoc.exists()) throw "Member not found!";

      const member = memberDoc.data() as Member;
      const multiplier = getTierMultiplier(member.tier);
      // Formula: bitsEarned = floor(amountSpent / 10 * tierMultiplier)
      const bitsEarned = Math.floor((billAmount / 10) * multiplier);

      const currentBitsBalance = member.bitsBalance ?? member.points ?? 0;
      const currentLifetimeBits = member.lifetimeBitsEarned ?? currentBitsBalance;

      const newBitsBalance = currentBitsBalance + bitsEarned;
      const newLifetimeBits = currentLifetimeBits + bitsEarned;
      const newTotalSpent = (member.totalSpent || 0) + billAmount;

      const bitsPerLevelThreshold = 100;
      const calculatedLevel = Math.floor(newLifetimeBits / bitsPerLevelThreshold) + 1;
      const newLevel = Math.max(member.level || 1, calculatedLevel);

      transaction.update(memberRef, sanitize({
        bitsBalance: newBitsBalance,
        lifetimeBitsEarned: newLifetimeBits,
        level: newLevel,
        totalSpent: newTotalSpent,
        isBitsMigrated: true
      }));

      const transactionRef = doc(collection(db, `members/${memberId}/transactions`));
      transaction.set(transactionRef, sanitize({
        date: new Date().toISOString(),
        amount: billAmount,
        bitsGained: bitsEarned,
        billId: billId || null
      }));

      const logRef = doc(collection(db, 'logs'));
      const activeUser = user || { username: 'System', displayName: 'System' };
      transaction.set(logRef, sanitize({
        type: 'BITS_EARNED',
        description: `<strong>${member.name || 'Member'}</strong> earned <strong>${bitsEarned} Bits</strong>.`,
        memberId: memberId,
        details: { amount: billAmount, bitsGained: bitsEarned, billId: billId || null },
        timestamp: new Date().toISOString(),
        user: { uid: activeUser.username || 'system', displayName: activeUser.displayName || activeUser.username || 'System' },
        cycle: settings.activeCycle || 'Live Cycle'
      }));

    }).catch(e => {
      console.error("Bits Transaction failed: ", e);
    });
  };

  const handleAddStation = async (type: 'ps5' | 'ps4' | 'boardgame' | 'retrogaming') => {
    let stationList = ps5Stations;
    let prefix = 'PS5 ';
    if (type === 'ps4') { stationList = ps4Stations; prefix = 'PS4 '; }
    else if (type === 'boardgame') { stationList = boardGameStations; prefix = 'Table '; }
    else if (type === 'retrogaming') { stationList = retroGamingStations; prefix = 'Retro '; }

    const existingNumbers = stationList.map(s => parseInt(s.name.match(/\d+$/)?.[0] || '0', 10)).filter(n => !isNaN(n));
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const newName = `${prefix}${maxNumber + 1}`;

    const maxOrder = stationList.reduce((max, s) => Math.max(max, s.order || 0), 0);

    await addStation({
      name: newName,
      type,
      status: 'available',
      startTime: null,
      endTime: null,
      packageName: null,
      members: [],
      currentBill: [],
      discount: 0,
      order: maxOrder + 100
    });
    toast({ title: "Unit Added", description: `${newName} has been created.` });
  };

  const handlePauseTimer = (station: Station) => {
    const now = getSyncedDate().toISOString();
    const updatedMembers = station.members.map(m => {
      if (m.status === 'finished' || !m.endTime) return m;
      const remaining = new Date(m.endTime).getTime() - getSyncedNow();
      return {
        ...m,
        status: 'paused' as const,
        remainingTimeOnPause: Math.max(0, Math.floor(remaining / 1000))
      };
    });

    const stationRemaining = station.endTime ? new Date(station.endTime).getTime() - getSyncedNow() : 0;

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
        endTime: new Date(getSyncedNow() + m.remainingTimeOnPause * 1000).toISOString(),
        remainingTimeOnPause: null
      };
    });

    const newStationEndTime = station.remainingTimeOnPause
      ? new Date(getSyncedNow() + station.remainingTimeOnPause * 1000).toISOString()
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
      setInitialPlayers(undefined);
      setSelectedStation(station);
      setIsModalOpen(true);
    }
  };

  const handleApproveSessionRequest = (station: Station, partyMembers: any[]) => {
    const mappedMembers: AssignedMember[] = partyMembers.map(p => ({
      id: p.id,
      name: p.name,
      avatarUrl: p.avatarUrl,
      status: 'active' as const,
      startTime: getSyncedDate().toISOString(),
      endTime: null,
    }));
    setInitialPlayers(mappedMembers);
    setSelectedStation(station);
    setIsModalOpen(true);
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
      const newEndTime = new Date(getSyncedNow() + (member.remainingTimeOnPause || 0) * 1000).toISOString();
      updatedMembers[memberIndex] = {
        ...member,
        status: 'active',
        endTime: newEndTime,
        remainingTimeOnPause: null
      };
    } else {
      const remaining = member.endTime ? new Date(member.endTime).getTime() - getSyncedNow() : 0;
      updatedMembers[memberIndex] = {
        ...member,
        status: 'paused',
        remainingTimeOnPause: Math.max(0, Math.floor(remaining / 1000)),
      };
    }

    const activeMembers = updatedMembers.filter(m => m.status === 'active');
    const endTimes = activeMembers.map(p => p.endTime ? new Date(p.endTime).getTime() : 0).filter(t => t > 0);
    const latestEndTime = endTimes.length > 0 ? new Date(Math.max(...endTimes)).toISOString() : null;

    updateStation(stationId, {
      members: updatedMembers,
      endTime: latestEndTime
    });
  };

  const handleStopSession = async (station: Station) => {
    const now = getSyncedDate();
    const nowIso = now.toISOString();
    const nowMs = now.getTime();

    // Freeze and reconcile all active members on the station immediately
    const updatedMembers: AssignedMember[] = [];
    for (const member of (station.members || [])) {
      if (member.status === 'finished') {
        updatedMembers.push(member);
        continue;
      }

      const startIso = member.startTime || station.startTime || nowIso;
      const endIso = member.endTime || station.endTime;
      const rawStartMs = new Date(startIso).getTime();
      const startMs = !isNaN(rawStartMs) ? rawStartMs : nowMs;
      const rawEndMs = endIso ? new Date(endIso).getTime() : NaN;
      const endMs = !isNaN(rawEndMs) ? rawEndMs : startMs + (member.allocatedSeconds || 3600) * 1000;
      const totalSessionSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));

      let remainingSeconds = 0;
      if ((station.status === 'paused' || member.status === 'paused') && (member.remainingTimeOnPause != null || station.remainingTimeOnPause != null)) {
        remainingSeconds = Number(member.remainingTimeOnPause ?? station.remainingTimeOnPause ?? 0);
      } else if (endIso && nowMs < endMs) {
        remainingSeconds = Math.max(0, Math.floor((endMs - nowMs) / 1000));
      }
      if (isNaN(remainingSeconds)) remainingSeconds = 0;

      const safeAllocated = Number.isFinite(member.allocatedSeconds) ? member.allocatedSeconds! : (totalSessionSeconds || 3600);
      const playedEntitled = Math.max(0, totalSessionSeconds - remainingSeconds);
      const consumedSeconds = Math.min(safeAllocated, isNaN(playedEntitled) ? 0 : playedEntitled);
      const alreadyDeducted = Number.isFinite(member.consumedSeconds) ? member.consumedSeconds! : 0;
      const deltaToDeduct = Math.max(0, consumedSeconds - alreadyDeducted);

      const isMemberPrepaid = member.billingType === 'prepaid' || (!!member.rechargeId && !member.isNewRecharge);
      if (isMemberPrepaid && !member.id.startsWith('guest-')) {
        const res = await reconcileMemberBalance(member.id, safeAllocated, deltaToDeduct, member.rechargeId);
        if (!res.success) {
          console.error(`Failed to reconcile balance for ${member.name}:`, res.error || res);
        }
      }

      updatedMembers.push({
        ...member,
        status: 'finished',
        endTime: nowIso,
        remainingTimeOnPause: null,
        remainingSecondsAtStop: remainingSeconds,
        consumedSeconds: consumedSeconds,
        rechargeProcessed: true
      });
    }

    const frozenStation: Station = {
      ...station,
      members: updatedMembers,
      endTime: nowIso,
    };

    // Commit frozen state to Firestore so that even if checkout is dismissed or cancelled,
    // the used session time is already safely deducted and reconciled!
    updateStation(station.id, {
      members: updatedMembers,
      endTime: nowIso,
    });

    setSelectedStation(frozenStation);
    setIsCheckoutModalOpen(true);
  };

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

    const now = getSyncedDate();
    const nowIso = now.toISOString();
    const nowMs = now.getTime();
    let updatedMembers = [...station.members];
    const memberIndex = updatedMembers.findIndex(m => m.id === playerId);
    if (memberIndex === -1) return;

    const member = updatedMembers[memberIndex];
    if (member.status === 'finished') return;

    const startIso = member.startTime || station.startTime || nowIso;
    const endIso = member.endTime || station.endTime;
    const rawStartMs = new Date(startIso).getTime();
    const startMs = !isNaN(rawStartMs) ? rawStartMs : nowMs;
    const rawEndMs = endIso ? new Date(endIso).getTime() : NaN;
    const endMs = !isNaN(rawEndMs) ? rawEndMs : startMs + (member.allocatedSeconds || 3600) * 1000;
    const totalPossibleSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));

    let remainingSeconds = 0;
    if ((station.status === 'paused' || member.status === 'paused') && (member.remainingTimeOnPause != null || station.remainingTimeOnPause != null)) {
      remainingSeconds = Number(member.remainingTimeOnPause ?? station.remainingTimeOnPause ?? 0);
    } else if (endIso && nowMs < endMs) {
      remainingSeconds = Math.max(0, Math.floor((endMs - nowMs) / 1000));
    }
    if (isNaN(remainingSeconds)) remainingSeconds = 0;

    const safeAllocated = Number.isFinite(member.allocatedSeconds) ? member.allocatedSeconds! : (totalPossibleSeconds || 3600);
    const playedSeconds = Math.max(0, totalPossibleSeconds - remainingSeconds);
    const consumedSeconds = Math.min(safeAllocated, isNaN(playedSeconds) ? 0 : playedSeconds);
    const alreadyDeducted = Number.isFinite(member.consumedSeconds) ? member.consumedSeconds! : 0;
    const deltaToDeduct = Math.max(0, consumedSeconds - alreadyDeducted);

    const isPrepaid = member.billingType === 'prepaid' || (!!member.rechargeId && !member.isNewRecharge);
    if (isPrepaid && !member.id.startsWith('guest-')) {
      const res = await reconcileMemberBalance(member.id, safeAllocated, deltaToDeduct, member.rechargeId);
      if (!res.success) {
        console.error(`Failed to reconcile balance for ${member.name}:`, res.error || res);
      }
    } else if (member.rechargeId && !member.id.startsWith('guest-')) {
      if (member.rechargeId === 'pool') {
        await consumeMemberBalancePool(member.id, deltaToDeduct);
      } else {
        await consumeRechargeTime(member.id, member.rechargeId, deltaToDeduct);
      }
    }

    updatedMembers[memberIndex] = {
      ...member,
      status: 'finished',
      endTime: nowIso,
      remainingTimeOnPause: null,
      remainingSecondsAtStop: remainingSeconds,
      consumedSeconds: consumedSeconds,
      rechargeProcessed: true
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

  const handleStartSession = async (assignedPlayers: AssignedMember[], selectedPackage: GamingPackage) => {
    if (!selectedStation) return;
    const now = getSyncedDate();
    const initialBill: BillItem[] = [];

    // Atomically reserve wallet balance for all prepaid players at session start
    for (const p of assignedPlayers) {
      const isPrepaid = p.billingType === 'prepaid' || (!!p.rechargeId && !p.isNewRecharge);
      if (isPrepaid && !p.id.startsWith('guest-')) {
        const toReserve = p.allocatedSeconds || selectedPackage.duration || 3600;
        await reserveMemberBalance(p.id, toReserve, p.rechargeId);
      }
    }

    const walkinPlayers = assignedPlayers.filter(p => !p.rechargeId);

    if (walkinPlayers.length > 0) {
      const count = walkinPlayers.length;
      walkinPlayers.forEach(p => {
        if (p.isNewRecharge) {
          const pkg = gamingPackages?.find(g => g.id === p.packageId);
          const pkgPrice = pkg ? pkg.price : selectedPackage?.price || 0;
          const pkgName = pkg ? pkg.name : selectedPackage?.name || 'Recharge Pack';
          initialBill.push({
            itemId: `recharge-${p.id}-${now.getTime()}`,
            name: `Buy Recharge: ${pkgName} (${p.name})`,
            price: pkgPrice,
            quantity: 1,
            billingType: 'recharge_purchase',
            memberId: p.id,
            addedAt: now.toISOString()
          });
        } else {
          let durationMins = 60;
          if (p.packageId?.includes('-30m')) durationMins = 30;
          else if (p.packageId?.includes('-1h')) durationMins = 60;
          else if (p.packageId?.includes('-2h')) durationMins = 120;
          else if (p.startTime && p.endTime) {
            const diff = new Date(p.endTime).getTime() - new Date(p.startTime).getTime();
            durationMins = Math.max(1, Math.round(diff / 60000));
          }

          const perPlayerPrice = calculatePlayerPrice(selectedStation.type, count, durationMins);
          const durText = durationMins >= 60 ? `${durationMins / 60} Hour` : `${durationMins} Min`;

          initialBill.push({
            itemId: `time-${p.id}-${now.getTime()}`,
            name: `Time: ${durText} Session (${p.name})`,
            price: perPlayerPrice,
            quantity: 1,
            billingType: 'walk_in',
            memberId: p.id,
            addedAt: now.toISOString()
          });
        }
      });
    }

    const endTimes = assignedPlayers.map(p => p.endTime ? new Date(p.endTime).getTime() : 0).filter(t => t > 0);
    const latestEndTime = endTimes.length > 0 ? new Date(Math.max(...endTimes)).toISOString() : null;

    updateStation(selectedStation.id, {
      status: 'in-use',
      startTime: now.toISOString(),
      endTime: latestEndTime,
      packageName: assignedPlayers.length === 1
        ? (assignedPlayers[0].rechargeId
          ? (selectedPackage.name.startsWith('Recharge: ') ? selectedPackage.name : `Recharge: ${selectedPackage.name}`)
          : selectedPackage.name)
        : "Mixed Session",
      members: assignedPlayers.map(p => ({ ...p, status: 'active' })),
      currentBill: initialBill,
      discount: 0,
      checkoutProcessed: false,
    });
    setIsModalOpen(false);
    setSelectedStation(null);
  };

  const handleConfirmJoin = async (newPlayer: AssignedMember, billItem: BillItem | null) => {
    if (!selectedStation) return;
    const result = await addPlayerToSession(selectedStation.id, newPlayer, billItem);
    if (result.success) {
      toast({ title: "Player Joined", description: `${newPlayer.name} joined.` });
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
      startTime: getSyncedDate().toISOString(),
      endTime: null,
      packageName: "Walk-in Order",
      currentBill: [],
      discount: 0,
      checkoutProcessed: false,
    });
  };

  const handleAssignStationFromWizard = (
    station: Station,
    guestInfo: { name: string; phone: string; groupSize: string; member: Member | null; experience: string }
  ) => {
    const player: AssignedMember = {
      id: guestInfo.member?.id || `guest-${Date.now()}`,
      name: guestInfo.name || guestInfo.member?.name || 'Walk-in Guest',
      avatarUrl: guestInfo.member?.avatarUrl || PlaceHolderImages.find(img => img.id === 'avatar-6')?.imageUrl || 'https://picsum.photos/seed/guest/100/100',
      status: 'active' as const,
      startTime: getSyncedDate().toISOString(),
      endTime: null,
    };

    setInitialPlayers([player]);
    setSelectedStation(station);

    if (guestInfo.experience === 'fnb') {
      if (station.status === 'in-use') {
        setIsBillModalOpen(true);
      } else {
        handleStartFoodSession(station.id, [player]);
        setIsBillModalOpen(true);
      }
    } else {
      setIsModalOpen(true);
    }
  };

  const handleSaveBill = (stationId: string, newBill: BillItem[], newDiscount: number) => {
    const station = stations.find(s => s.id === stationId);
    const updates: Partial<Station> = { currentBill: newBill, discount: newDiscount };

    // Real-time inventory adjustment: calculate delta per tracked item
    if (foodItems && foodItems.length > 0) {
      const oldBill = station?.currentBill || [];
      foodItems.forEach(food => {
        if (!food.trackInventory) return;

        const oldQty = oldBill
          .filter(bi => bi.itemId === food.id || bi.name.toLowerCase() === food.name.toLowerCase())
          .reduce((sum, bi) => sum + bi.quantity, 0);

        const newQty = newBill
          .filter(bi => bi.itemId === food.id || bi.name.toLowerCase() === food.name.toLowerCase())
          .reduce((sum, bi) => sum + bi.quantity, 0);

        const delta = newQty - oldQty;
        if (delta !== 0) {
          // delta > 0: items added to tab -> deduct from stock (-delta)
          // delta < 0: items removed from tab -> restore to stock (+Math.abs(delta))
          adjustFoodItemStock(food.id, -delta, food.name);
        }
      });
    }

    if (station?.status === 'available' && newBill.length > 0) {
      updates.status = 'in-use';
      updates.packageName = 'Walk-in Order';
      updates.startTime = getSyncedDate().toISOString();

      if (station.members.length === 0) {
        updates.members = [{
          id: `guest-walkin-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: 'Walk-in Customer',
          avatarUrl: PlaceHolderImages.find(img => img.id === 'avatar-6')?.imageUrl || 'https://picsum.photos/seed/guest/100/100',
          status: 'active'
        }];
      }
    }

    updateStation(stationId, updates);
  };

  const handleCheckoutClickFromBillModal = (stationId: string) => {
    setIsBillModalOpen(false);
    const station = stations?.find(s => s.id === stationId);
    if (station) {
      setSelectedStation(station);
      setIsCheckoutModalOpen(true);
    }
  };

  const isCheckingOutRef = useRef<Set<string>>(new Set());

  const handleConfirmCheckout = async (
    stationId: string,
    finalBill: number,
    billItems: BillItem[],
    discountValue: number,
    paymentMethod: PaymentMethod,
    cashAmount?: number,
    upiAmount?: number,
    isRechargePurchase?: boolean,
    rechargePkg?: GamingPackage,
    debtAdjustment?: Bill['debtAdjustment']
  ) => {
    if (isCheckingOutRef.current.has(stationId)) return;
    isCheckingOutRef.current.add(stationId);

    try {
      const station = stations?.find(s => s.id === stationId) || (selectedStation?.id === stationId ? selectedStation : undefined);
      if (!station) {
        setIsCheckoutModalOpen(false);
        setSelectedStation(null);
        return;
      }

      if (station.status === 'available') {
        setIsCheckoutModalOpen(false);
        setSelectedStation(null);
        return;
      }

      const finalMembersForBill: AssignedMember[] = [];
      const now = getSyncedDate();
      const finalBillItems: BillItem[] = [...billItems];
      let computedFinalBill = finalBill;

      for (const member of (station.members || [])) {
        let playedSecondsForMember = 0;
        let remainingSecondsOnTimer = 0;
        let overtimeSeconds = 0;

        const isMemberPrepaid = member.billingType === 'prepaid' || (!!member.rechargeId && !member.isNewRecharge);
        const isMemberBuyRecharge = member.billingType === 'recharge_purchase' || !!member.isNewRecharge;

        const startIso = member.startTime || station.startTime;
        const endIso = member.endTime || station.endTime;
        const startMs = startIso ? new Date(startIso).getTime() : now.getTime();
        const endMs = endIso ? new Date(endIso).getTime() : startMs + (member.allocatedSeconds || 3600) * 1000;
        const totalSessionSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
        const nowMs = now.getTime();

        if (member.status === 'finished') {
          playedSecondsForMember = member.consumedSeconds || 0;
          remainingSecondsOnTimer = member.remainingSecondsAtStop || 0;
          if (endMs > 0 && nowMs > endMs) {
            overtimeSeconds = Math.max(0, Math.floor((nowMs - endMs) / 1000));
          }
        } else {
          if ((station.status === 'paused' || member.status === 'paused') && (member.remainingTimeOnPause != null || station.remainingTimeOnPause != null)) {
            remainingSecondsOnTimer = member.remainingTimeOnPause ?? station.remainingTimeOnPause ?? 0;
            if (remainingSecondsOnTimer === 0 && station.pauseStartTime && endMs > 0) {
              overtimeSeconds = Math.max(0, Math.floor((new Date(station.pauseStartTime).getTime() - endMs) / 1000));
            }
          } else {
            if (nowMs < endMs) {
              remainingSecondsOnTimer = Math.max(0, Math.floor((endMs - nowMs) / 1000));
            } else {
              remainingSecondsOnTimer = 0;
              overtimeSeconds = Math.max(0, Math.floor((nowMs - endMs) / 1000));
            }
          }

          const totalAllocated = member.allocatedSeconds || totalSessionSeconds;
          const playedEntitled = Math.max(0, totalSessionSeconds - remainingSecondsOnTimer);
          const consumedSeconds = Math.min(totalAllocated, playedEntitled);
          playedSecondsForMember = consumedSeconds + overtimeSeconds;
        }

        const safeAllocated = Number.isFinite(member.allocatedSeconds) ? member.allocatedSeconds! : (totalSessionSeconds || 3600);
        const entitledPlayed = member.status === 'finished' 
          ? (member.consumedSeconds || 0) 
          : Math.min(safeAllocated, Math.max(0, totalSessionSeconds - remainingSecondsOnTimer));
        const alreadyDeducted = Number.isFinite(member.consumedSeconds) ? member.consumedSeconds! : 0;
        const deltaToDeduct = Math.max(0, entitledPlayed - alreadyDeducted);

        if (isMemberBuyRecharge && !member.id.startsWith('guest-')) {
          const pureStationName = (station.packageName || '').replace(/^(Recharge: |Buy Recharge: )/i, '').trim().toLowerCase();
          const pkg = gamingPackages?.find(p => p.id === member.packageId)
            || gamingPackages?.find(p => p.name.toLowerCase() === pureStationName)
            || {
              id: member.packageId || 'custom-recharge',
              name: (station.packageName || '').replace(/^(Recharge: |Buy Recharge: )/i, '') || 'Recharge Pack',
              duration: member.allocatedSeconds || 3600,
              price: 0,
              validity: 1,
              isRechargePack: true
            };

          const newRechargeId = await rechargeMember(member.id, pkg, paymentMethod === 'upi' ? 'upi' : 'cash', { 
            skipBill: true,
            initialConsumedSeconds: entitledPlayed
          });
          if (!newRechargeId) {
            console.error(`Failed to create new recharge for ${member.name}`);
          }
        } else if (isMemberPrepaid && !member.id.startsWith('guest-')) {
          // Delta deduction: if deltaToDeduct is 0 (already reconciled at Stop All / Stop Player),
          // this safely releases any remaining hold and deducts 0 seconds!
          const res = await reconcileMemberBalance(member.id, safeAllocated, deltaToDeduct, member.rechargeId);
          if (!res.success) {
            console.error(`Failed to reconcile balance for ${member.name} during checkout:`, res.error || res);
          }
        }

        // Overtime check: beyond 5 minutes grace period (300 seconds), charge walk-in rate
        if (overtimeSeconds > 300) {
          const hasOvertimeItem = finalBillItems.some(i => i.billingType === 'overtime' && i.memberId === member.id);
          if (!hasOvertimeItem) {
            const overtimeMinutes = Math.ceil(overtimeSeconds / 60);
            const overtimePrice = calculatePlayerPrice(station.type || 'ps5', station.members.length, overtimeMinutes);
            finalBillItems.push({
              itemId: `overtime-${member.id}-${nowMs}`,
              name: `Overtime: ${overtimeMinutes}m (${member.name})`,
              price: overtimePrice,
              quantity: 1,
              billingType: 'overtime',
              memberId: member.id,
              addedAt: now.toISOString()
            });
            computedFinalBill += overtimePrice;
          }
        }

        finalMembersForBill.push({
          ...member,
          status: 'finished',
          endTime: member.status === 'finished' ? (member.endTime || now.toISOString()) : now.toISOString(),
          remainingSecondsAtStop: remainingSecondsOnTimer,
          consumedSeconds: entitledPlayed,
          rechargeProcessed: true
        });
      }

      const initialPackage = gamingPackages?.find(p => {
        const pureName = station.packageName?.replace(/^(Recharge: |Buy Recharge: )/i, '').trim();
        return p.name.toLowerCase() === pureName?.toLowerCase();
      });

      const isExistingRecharge = station.packageName?.startsWith('Recharge: ');
      const hasItemizedSessionItems = finalBillItems.some(i => {
        const nameLower = i.name.toLowerCase();
        return (
          station.members.some(m => {
            const matches = nameLower.match(/\(([^)]+)\)/g);
            if (!matches) return false;
            return matches.some(match => {
              const content = match.slice(1, -1);
              return content.split(',').map(p => p.trim()).includes(m.name.toLowerCase());
            });
          }) ||
          nameLower.startsWith('time:') ||
          nameLower.startsWith('buy recharge:') ||
          nameLower.startsWith('recharge:') ||
          nameLower.startsWith('overtime:')
        );
      });

      let initialPackagePrice = 0;
      if (!isExistingRecharge && !hasItemizedSessionItems && station.packageName && station.packageName !== 'Walk-in Order' && !finalBillItems.some(item => item.name === station.packageName)) {
        if (initialPackage) {
          initialPackagePrice = initialPackage.price * Math.ceil(station.members.length / (initialPackage.playerCapacity || 1));
        } else {
          let durMins = 60;
          if (station.startTime && station.endTime) {
            const diff = new Date(station.endTime).getTime() - new Date(station.startTime).getTime();
            durMins = Math.max(1, Math.round(diff / 60000));
          }
          initialPackagePrice = calculateGroupPrice(station.type || 'ps5', Math.max(1, station.members.length), durMins);
        }
      }

      const foodSubtotal = finalBillItems.filter(item => !item.name.startsWith('Time:') && !item.name.startsWith('Walk-in:') && !item.name.startsWith('Overtime:')).reduce((total, item) => total + (item.price * item.quantity), 0);

      const newBillId = await archiveBill({
        stationId: station.id,
        stationName: station.name,
        packageName: station.packageName || undefined,
        members: finalMembersForBill,
        items: finalBillItems,
        initialPackagePrice,
        foodSubtotal,
        discount: discountValue,
        totalAmount: computedFinalBill,
        timestamp: new Date().toISOString(),
        paymentMethod,
        cashAmount: cashAmount || 0,
        upiAmount: upiAmount || 0,
        advancePaid: station.advancePaid || 0,
        bookingId: station.bookingId || undefined,
        debtAdjustment: debtAdjustment || undefined,
      });

      if (!newBillId) {
        toast({ variant: 'destructive', title: 'Checkout Error', description: 'Failed to archive.' });
        return;
      }

      const realMembers = station.members.filter(m => m.id && !m.id.startsWith('guest-'));
      const totalPlayers = station.members.length;

      realMembers.forEach(assignedMember => {
        const isRechargeBuyer = assignedMember.isNewRecharge || assignedMember.billingType === 'recharge_purchase';
        let eligibleSpend = computedFinalBill / Math.max(1, totalPlayers);
        if (isRechargeBuyer && assignedMember.packageId) {
          const pkg = gamingPackages?.find(p => p.id === assignedMember.packageId);
          if (pkg) {
            eligibleSpend = Math.max(0, eligibleSpend - pkg.price);
          }
        }
        if (eligibleSpend > 0) {
          const rate = settings.bitsPerRupeeRate ?? settings.xpPerRupee ?? 0.1;
          const baseXp = Math.floor(eligibleSpend * rate);
          onGrantXp(assignedMember.id, baseXp, eligibleSpend, newBillId);
        }
      });

      await updateStation(stationId, {
        status: 'available',
        startTime: null,
        endTime: null,
        pauseStartTime: null,
        remainingTimeOnPause: null,
        finishingStartTime: null,
        packageName: null,
        members: [],
        currentBill: [],
        discount: 0,
        advancePaid: 0,
        bookingId: undefined,
        checkoutProcessed: false
      });

      if (station.bookingId) {
        completeBooking(station.bookingId).catch(console.error);
      }

      const paymentLabel = paymentMethod === 'split' ? `Split` : paymentMethod.toUpperCase();
      toast({ title: "Session Closed", description: `Total: ₹${computedFinalBill.toLocaleString()} via ${paymentLabel}.` });
      createSystemAnnouncement(`Checkout for ${station.name}. Total: ${Math.round(computedFinalBill)} Rupees. Thank you for visiting the 8 bit bistro.`).catch(console.error);

      setIsCheckoutModalOpen(false);
      setSelectedStation(null);
    } catch (err: any) {
      console.error("Checkout confirmation error:", err);
      toast({
        variant: 'destructive',
        title: 'Checkout Error',
        description: err?.message || 'Failed to complete checkout. Please try again.'
      });
      throw err;
    } finally {
      isCheckingOutRef.current.delete(stationId);
    }
  };

  const handleAddTime = async (pkg: GamingPackage, quantity: number, targetIds: string[]) => {
    if (!selectedStation) return;
    const durationToAddInSeconds = pkg.duration;

    let graceDeduction = 0;
    if (selectedStation.status === 'finishing' && selectedStation.finishingStartTime) {
      const elapsedMs = getSyncedNow() - new Date(selectedStation.finishingStartTime).getTime();
      graceDeduction = Math.floor(elapsedMs / 1000);
    }

    const updatedMembers = await Promise.all(selectedStation.members.map(async m => {
      if (!targetIds.includes(m.id)) return m;

      let durationToAddInSeconds = pkg.duration;

      // Handle Account Balance Extension
      if (pkg.id === 'account-pool') {
        const memberData = members?.find(mem => mem.id === m.id);
        if (memberData) {
          const available = getMemberAvailableBalance(memberData);
          if (available <= 0) {
            toast({ variant: 'destructive', title: "No Available Balance", description: `${m.name} has no unreserved recharge balance.` });
            return m;
          }

          const timeToAdd = (pkg.duration > 0 && pkg.duration <= available) ? pkg.duration : available;
          await reserveMemberBalance(m.id, timeToAdd);

          const memberEndTimeMs = m.endTime ? new Date(m.endTime).getTime() : 0;
          const nowMs = getSyncedNow();
          const baseTime = (memberEndTimeMs > nowMs && m.status !== 'finished' && selectedStation.status !== 'finishing')
            ? memberEndTimeMs
            : nowMs;
          const effectiveAdd = Math.max(0, timeToAdd - (selectedStation.status === 'finishing' ? graceDeduction : 0));
          const newEndTime = new Date(baseTime + effectiveAdd * 1000).toISOString();

          return {
            ...m,
            status: 'active' as const,
            endTime: newEndTime,
            billingType: 'prepaid' as const,
            rechargeId: m.rechargeId || 'pool',
            allocatedSeconds: (m.allocatedSeconds || 0) + timeToAdd,
            remainingTimeOnPause: null,
            startTime: m.startTime || getSyncedDate().toISOString()
          };
        }
      }

      let newEndTime = m.endTime ? new Date(m.endTime).toISOString() : null;
      let newRemaining = m.remainingTimeOnPause;
      const wasFinished = m.status === 'finished';

      if ((selectedStation.status === 'paused' || m.status === 'paused') && m.remainingTimeOnPause != null) {
        newRemaining = m.remainingTimeOnPause + durationToAddInSeconds;
      } else {
        const memberEndTimeMs = m.endTime ? new Date(m.endTime).getTime() : 0;
        const nowMs = getSyncedNow();
        const baseTime = (memberEndTimeMs > nowMs && !wasFinished && selectedStation.status !== 'finishing')
          ? memberEndTimeMs
          : nowMs;

        const effectiveAdd = Math.max(0, durationToAddInSeconds - (selectedStation.status === 'finishing' ? graceDeduction : 0));
        newEndTime = new Date(baseTime + effectiveAdd * 1000).toISOString();
      }

      return {
        ...m,
        status: 'active' as const,
        endTime: newEndTime,
        remainingTimeOnPause: newRemaining,
        startTime: m.startTime || getSyncedDate().toISOString()
      };
    }));

    const currentBill = selectedStation.currentBill || [];
    const newBillItems: BillItem[] = [...currentBill];

    // Only add bill items if it's NOT an account extension (account time is already paid for)
    if (pkg.id !== 'account-pool') {
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
          addedAt: getSyncedDate().toISOString()
        });
      }
    } else {
      // Just log it or notify
      toast({ title: "Account Balance Applied", description: `Session timer extended to match registry balance.` });
    }

    const activeMembers = updatedMembers.filter(m => m.status !== 'finished');
    const endTimes = activeMembers.map(p => p.endTime ? new Date(p.endTime).getTime() : 0).filter(t => t > 0);
    const latestEndTime = endTimes.length > 0 ? new Date(Math.max(...endTimes)).toISOString() : null;

    const updates: any = {
      currentBill: newBillItems,
      members: updatedMembers,
      endTime: latestEndTime
    };

    if (selectedStation.status === 'finishing') {
      updates.status = 'in-use';
      updates.finishingStartTime = null;
    }

    updateStation(selectedStation.id, updates);

    toast({ title: "Time Added", description: graceDeduction > 0 ? `Adjusted for used grace period.` : undefined });
    setIsEditTimeModalOpen(false);
    setSelectedStation(null);
  };

  const handleReduceTime = (minutesToReduce: number, targetIds: string[]) => {
    if (!selectedStation) return;
    const secondsToReduce = minutesToReduce * 60;
    const updatedMembers = selectedStation.members.map(m => {
      if (m.status === 'finished' || !targetIds.includes(m.id)) return m;

      // Intercept for account-pool players: Reduce time straight from their registry balance
      if (m.rechargeId === 'pool') {
        adjustMemberBalancePool(m.id, -secondsToReduce);
        const shiftedEndTime = m.endTime ? new Date(new Date(m.endTime).getTime() - secondsToReduce * 1000).toISOString() : null;
        return { ...m, endTime: shiftedEndTime };
      }

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

    toast({ title: "Time Reduced" });
    setIsEditTimeModalOpen(false);
    setSelectedStation(null);
  };

  const handleManage = (type: 'ps5' | 'ps4' | 'boardgame' | 'retrogaming') => {
    setManageType(type);
    setIsManageModalOpen(true);
  };

  const isInitialLoading =
    (stationsLoading && (!stations || stations.length === 0)) ||
    (foodLoading && (!foodItems || foodItems.length === 0)) ||
    (packagesLoading && (!gamingPackages || gamingPackages.length === 0));

  if (isInitialLoading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4 opacity-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="font-headline text-sm tracking-normal animate-pulse">Syncing Bistro...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 -mt-2 sm:-mt-4">
      <div id="cafe-dashboard-header" className="flex flex-wrap items-center justify-start sm:justify-end gap-1.5 sm:gap-2 pb-1 w-full max-w-full">
        <Button
          id="guest-login-btn"
          onClick={() => setIsGuestWizardOpen(true)}
          className="h-8 sm:h-9 px-2.5 sm:px-4 font-bold uppercase tracking-normal bg-primary hover:bg-primary/90 text-primary-foreground shadow-md animate-in fade-in gap-1.5 text-xs shrink-0"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden xs:inline">Guest Login &amp; Check-in</span>
          <span className="xs:hidden">Guest Login</span>
        </Button>
        <Button
          onClick={() => setIsCompactMode(!isCompactMode)}
          variant="outline"
          className="h-8 sm:h-9 px-2.5 sm:px-4 font-bold uppercase tracking-normal border-2 text-xs shrink-0"
        >
          <LayoutTemplate className="mr-1.5 h-3.5 w-3.5" />
          {isCompactMode ? 'Original' : 'Compact'}
        </Button>
        <Button
          id="redeem-perks-btn"
          onClick={() => setIsRewardsModalOpen(true)}
          className="h-8 sm:h-9 px-2.5 sm:px-4 font-bold uppercase tracking-normal bg-emerald-500 hover:bg-emerald-600 text-black shadow-md animate-in fade-in text-xs shrink-0"
        >
          <Gift className="mr-1 sm:mr-1.5 h-3.5 w-3.5 fill-current" />
          <span>Perks</span>
        </Button>
        <Button
          id="quick-recharge-btn"
          onClick={() => setIsRechargeModalOpen(true)}
          className="h-8 sm:h-9 px-2.5 sm:px-4 font-bold uppercase tracking-normal bg-yellow-500 hover:bg-yellow-600 text-black shadow-md animate-in fade-in text-xs shrink-0"
        >
          <Zap className="mr-1 sm:mr-1.5 h-3.5 w-3.5 fill-current" />
          <span>Recharge</span>
        </Button>
        <Button
          id="ps5-bookings-btn"
          onClick={() => setIsBookingsModalOpen(true)}
          className="h-8 sm:h-9 px-2.5 sm:px-4 font-bold uppercase tracking-normal bg-sky-500 hover:bg-sky-600 text-black shadow-md animate-in fade-in text-xs shrink-0 gap-1.5"
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>Bookings</span>
          {todayBookingsCount > 0 && (
            <span className="h-4 px-1.5 bg-black text-sky-400 rounded-full font-mono text-[10px] font-extrabold flex items-center justify-center">
              {todayBookingsCount}
            </span>
          )}
        </Button>
        <Button
          id="order-raw-material-btn"
          onClick={() => setIsRawMaterialsModalOpen(true)}
          className="h-8 sm:h-9 px-2.5 sm:px-4 font-bold uppercase tracking-normal bg-amber-500 hover:bg-amber-600 text-black shadow-md animate-in fade-in text-xs shrink-0 gap-1.5"
        >
          <Package className="h-3.5 w-3.5" />
          <span>Need to Order</span>
          {pendingRawRequestsCount > 0 && (
            <span className="h-4 px-1.5 bg-black text-amber-400 rounded-full font-mono text-[10px] font-extrabold flex items-center justify-center animate-pulse">
              {pendingRawRequestsCount}
            </span>
          )}
        </Button>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {/* PS5 CONSOLES */}
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="flex flex-row items-center justify-between px-0 pb-2 pt-0">
            <CardTitle className="text-xl sm:text-2xl flex items-center gap-2"><Gamepad2 className="h-5 sm:h-6 w-5 sm:w-6 text-primary" /> PS5 Consoles</CardTitle>
            <div className="flex gap-2">
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => handleManage('ps5')} className="h-9 px-3 text-sm sm:text-sm font-bold uppercase tracking-tight border-2"><Settings2 className="mr-1.5 h-3.5 w-3.5" /> Manage</Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {ps5Stations.length > 0 ? (
              <div id="ps5-consoles-grid" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 w-full max-w-full">
                {ps5Stations.map(station => {
                  const upcoming = (bookings || []).find(b =>
                    b.stationId === station.id &&
                    b.status === 'confirmed' &&
                    new Date(b.startTime).getTime() >= getSyncedNow() - (5 * 60 * 1000) &&
                    new Date(b.startTime).getTime() <= getSyncedNow() + (45 * 60 * 1000)
                  );
                  return (
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
                      allMembers={members || []}
                      compactMode={isCompactMode}
                      upcomingBooking={upcoming}
                    />
                  );
                })}
              </div>
            ) : <div className="text-center text-muted-foreground py-12 italic border-2 border-dashed rounded-xl">No active PS5 units.</div>}
          </CardContent>
        </Card>

        {/* PS4 CONSOLES */}
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="flex flex-row items-center justify-between px-0 pb-2 pt-0">
            <CardTitle className="text-xl sm:text-2xl flex items-center gap-2"><Gamepad2 className="h-5 sm:h-6 w-5 sm:w-6 text-blue-400" /> PS4 Consoles</CardTitle>
            <div className="flex gap-2">
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => handleManage('ps4')} className="h-9 px-3 text-sm sm:text-sm font-bold uppercase tracking-tight border-2"><Settings2 className="mr-1.5 h-3.5 w-3.5" /> Manage</Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {ps4Stations.length > 0 ? (
              <div id="ps4-consoles-grid" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 w-full max-w-full">
                {ps4Stations.map(station => {
                  const upcoming = (bookings || []).find(b =>
                    b.stationId === station.id &&
                    b.status === 'confirmed' &&
                    new Date(b.startTime).getTime() >= getSyncedNow() - (5 * 60 * 1000) &&
                    new Date(b.startTime).getTime() <= getSyncedNow() + (45 * 60 * 1000)
                  );
                  return (
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
                      allMembers={members || []}
                      compactMode={isCompactMode}
                      upcomingBooking={upcoming}
                    />
                  );
                })}
              </div>
            ) : <div className="text-center text-muted-foreground py-12 italic border-2 border-dashed rounded-xl">No active PS4 units.</div>}
          </CardContent>
        </Card>

        {/* BOARD GAMES */}
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="flex flex-row items-center justify-between px-0 pb-2 pt-0">
            <CardTitle className="text-xl sm:text-2xl flex items-center gap-2"><Users className="h-5 sm:h-6 w-5 sm:w-6 text-emerald-500" /> Board Games</CardTitle>
            <div className="flex gap-2">
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => handleManage('boardgame')} className="h-9 px-3 text-sm sm:text-sm font-bold uppercase tracking-tight border-2"><Settings2 className="mr-1.5 h-3.5 w-3.5" /> Manage</Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {boardGameStations.length > 0 ? (
              <div id="board-games-grid" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 w-full max-w-full">
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
                    gamingPackages={gamingPackages || []}
                    compactMode={isCompactMode}
                  />
                ))}
              </div>
            ) : <div className="text-center text-muted-foreground py-12 italic border-2 border-dashed rounded-xl">No active tables.</div>}
          </CardContent>
        </Card>

        {/* RETRO GAMING */}
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="flex flex-row items-center justify-between px-0 pb-2 pt-0">
            <CardTitle className="text-xl sm:text-2xl flex items-center gap-2"><Sparkles className="h-5 sm:h-6 w-5 sm:w-6 text-purple-400" /> Retro Gaming</CardTitle>
            <div className="flex gap-2">
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => handleManage('retrogaming')} className="h-9 px-3 text-sm sm:text-sm font-bold uppercase tracking-tight border-2"><Settings2 className="mr-1.5 h-3.5 w-3.5" /> Manage</Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {retroGamingStations.length > 0 ? (
              <div id="retro-gaming-grid" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 w-full max-w-full">
                {retroGamingStations.map(station => (
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
                    gamingPackages={gamingPackages || []}
                    compactMode={isCompactMode}
                  />
                ))}
              </div>
            ) : <div className="text-center text-muted-foreground py-12 italic border-2 border-dashed rounded-xl">No active retro units.</div>}
          </CardContent>
        </Card>
      </div>

      {selectedStation && (
        <>
          <SelectMemberModal isOpen={isModalOpen} onOpenChange={setIsModalOpen} members={members || []} onConfirm={handleStartSession} station={selectedStation} initialPlayers={initialPlayers} />
          <BillModal isOpen={isBillModalOpen} onOpenChange={setIsBillModalOpen} station={selectedStation} allMembers={members || []} foodItems={foodItems || []} onSaveBill={handleSaveBill} gamingPackages={gamingPackages || []} onConfirmCheckout={handleConfirmCheckout} onStartFoodSession={handleStartFoodSession} onCheckoutClick={handleCheckoutClickFromBillModal} />
          <CheckoutModal isOpen={isCheckoutModalOpen} onOpenChange={setIsCheckoutModalOpen} station={selectedStation} gamingPackages={gamingPackages || []} onConfirmCheckout={handleConfirmCheckout} onSaveBill={handleSaveBill} allMembers={members || []} foodItems={foodItems || []} />
          <EditTimeModal isOpen={isEditTimeModalOpen} onOpenChange={setIsEditTimeModalOpen} onAddTime={handleAddTime} onReduceTime={handleReduceTime} gamingPackages={gamingPackages || []} station={selectedStation} />
          <MoveStationModal isOpen={isMoveModalOpen} onOpenChange={setIsMoveModalOpen} sourceStation={selectedStation} allStations={stations} />
          <JoinPlayerModal isOpen={isJoinModalOpen} onOpenChange={setIsJoinModalOpen} station={selectedStation} members={members || []} onConfirm={handleConfirmJoin} />
        </>
      )}

      <ManageStationsModal
        isOpen={isManageModalOpen}
        onOpenChange={setIsManageModalOpen}
        stations={
          manageType === 'ps5'
            ? ps5Stations
            : manageType === 'ps4'
              ? ps4Stations
              : manageType === 'boardgame'
                ? boardGameStations
                : retroGamingStations
        }
        type={manageType}
        onAdd={() => handleAddStation(manageType)}
      />

      <GlobalRechargeModal
        isOpen={isRechargeModalOpen}
        onOpenChange={setIsRechargeModalOpen}
        members={members || []}
      />

      <GlobalRewardsModal
        isOpen={isRewardsModalOpen}
        onOpenChange={setIsRewardsModalOpen}
        members={members || []}
      />

      <GuestLoginWizardModal
        isOpen={isGuestWizardOpen}
        onOpenChange={setIsGuestWizardOpen}
        stations={stations}
        onOpenSelectMemberModal={() => setIsModalOpen(true)}
        onOpenAddMemberModal={() => setIsModalOpen(true)}
        onAssignStation={handleAssignStationFromWizard}
      />

      <SessionRequestHandler ps5Stations={ps5Stations} onApprove={handleApproveSessionRequest} />

      <BookingsManagerModal
        isOpen={isBookingsModalOpen}
        onOpenChange={setIsBookingsModalOpen}
        bookings={bookings || []}
        stations={stations}
        members={members || []}
      />

      <RawMaterialsOrderModal
        isOpen={isRawMaterialsModalOpen}
        onClose={() => setIsRawMaterialsModalOpen(false)}
      />

      {/* Guided Tour component */}
      <GuidedTour
        isOpen={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={tourSteps}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center font-headline text-sm animate-pulse">Initializing Dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
