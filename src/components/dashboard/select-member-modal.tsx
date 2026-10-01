'use client';
import { useState, useMemo, useEffect } from 'react';
import type { Member, MemberTier, AssignedMember, Station, GamingPackage, MemberRecharge } from '@/lib/types';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Search, UserPlus, X, Clock, Zap, ChevronRight, ArrowLeft, CheckCircle2, Gamepad2, Users, Sparkles, RotateCcw, Timer, Play, Crown, User, Plus, Lock, AlertTriangle } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { getSyncedNow } from '@/lib/synced-time';
import { generateDynamicQuickPlayPackages } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import { useFirebase } from '@/firebase/provider';
import { collection } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Label } from '@/components/ui/label';
import { addMember, searchMembers } from '@/firebase/firestore/members';
import { isAfter } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const GUEST_AVATAR = PlaceHolderImages.find(img => img.id === 'avatar-6')?.imageUrl || 'https://picsum.photos/seed/guest/100/100';

const formatPackageDuration = (totalSeconds: number) => {
    if (!totalSeconds || totalSeconds < 0) return '0m';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const parts = [];
    if (hours > 0) parts.push(`${hours}H`);
    if (minutes > 0) parts.push(`${minutes}M`);
    return parts.length > 0 ? parts.join(' ') : '0M';
};

type PlayerConfig = {
    mode: 'recharge' | 'walkin' | 'buy-recharge' | null;
    packageId: string | null;
    rechargeId: string | null;
    name: string | null;
    duration: number | null;
    price: number | null;
    reminderDuration?: number | null;
};

type ModalStep = 'membership-check' | 'registration' | 'selection' | 'configuration';

interface SelectMemberModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  members: Member[];
  onConfirm: (assignedPlayers: AssignedMember[], selectedPackage: GamingPackage) => void;
  station: Station | null;
  initialPlayers?: AssignedMember[];
}

export function SelectMemberModal({ isOpen, onOpenChange, members, onConfirm, station, initialPlayers }: SelectMemberModalProps) {
  const { db } = useFirebase();
  const { toast } = useToast();

  const [step, setStep] = useState<ModalStep>('membership-check');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<AssignedMember[]>([]);
  const [targetSlotsCount, setTargetSlotsCount] = useState<number>(1);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);

  // Registration form state
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regBirthday, setRegBirthday] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regTier, setRegTier] = useState<MemberTier>('Red');
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);

  // Fallback to Red tier if phone number is cleared
  useEffect(() => {
    if (!regPhone.trim() && regTier !== 'Red') {
      setRegTier('Red');
    }
  }, [regPhone, regTier]);

  // Configurations per player for step 2
  const [configs, setConfigs] = useState<Record<string, PlayerConfig>>({});
  const [activeConfigPlayerId, setActiveConfigPlayerId] = useState<string | null>(null);
  const [clientTime, setClientTime] = useState<string>('');
  const [customMinutes, setCustomMinutes] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  // Start Timer Confirmation Overlay State
  const [startTimerConfirm, setStartTimerConfirm] = useState<{
    finalPlayers: AssignedMember[];
    virtualPackage: GamingPackage;
    totalCost: number;
    durationText: string;
  } | null>(null);

  const [checklist, setChecklist] = useState({ charged: false, cable: false, takenUpstairs: false });

  const toggleChecklistItem = (key: 'charged' | 'cable' | 'takenUpstairs') => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isAllChecked = checklist.charged && checklist.cable && checklist.takenUpstairs;

  // Add Guest Confirmation State
  const [showGuestConfirmModal, setShowGuestConfirmModal] = useState(false);
  const [guestReason, setGuestReason] = useState('');

  useEffect(() => {
    if (showGuestConfirmModal) {
      setGuestReason('');
    }
  }, [showGuestConfirmModal]);

  // Duplicate Name Gamer Tag Prompt Modal State
  const [duplicatePromptState, setDuplicatePromptState] = useState<{
    isOpen: boolean;
    originalName: string;
    gamerTag: string;
  }>({
    isOpen: false,
    originalName: '',
    gamerTag: '',
  });

  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loadedMembers, setLoadedMembers] = useState<Record<string, Member>>({});

  useEffect(() => {
    if (isOpen) {
      if (initialPlayers && initialPlayers.length > 0) {
        setSelectedPlayers(initialPlayers);
        setTargetSlotsCount(initialPlayers.length);
        setActiveSlotIndex(0);
        setStep('selection');
      } else {
        setSelectedPlayers([]);
        setTargetSlotsCount(1);
        setActiveSlotIndex(0);
        setStep('membership-check');
      }
      setSearchTerm('');
      setRegName('');
      setRegPhone('');
      setRegBirthday('');
      setRegEmail('');
      setRegTier('Red');
      setConfigs({});
      setActiveConfigPlayerId(null);
      setStartTimerConfirm(null);
      setChecklist({ charged: false, cable: false, takenUpstairs: false });
      setShowGuestConfirmModal(false);
    }
  }, [isOpen, initialPlayers]);

  useEffect(() => {
    if (isOpen && members) {
      setLoadedMembers(prev => {
        const next = { ...prev };
        members.forEach(m => {
          if (m.id) next[m.id] = m;
        });
        return next;
      });
    }
  }, [isOpen, members]);

  useEffect(() => {
    if (!isOpen) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const results = await searchMembers(searchTerm);
        setSearchResults(results);
        setLoadedMembers(prev => {
          const next = { ...prev };
          results.forEach(m => {
            if (m.id) next[m.id] = m;
          });
          return next;
        });
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm, isOpen]);

  useEffect(() => {
    setClientTime(new Date().toTimeString().slice(0, 5));
  }, []);

  const playerLimit = (station?.type === 'ps5' || station?.type === 'ps4') ? 4 : 8;

  const packagesCollection = useMemo(() => {
    if (!db) return null;
    return collection(db, 'gamingPackages');
  }, [db]);
  const { data: allPackages } = useCollection<GamingPackage>(packagesCollection);

  const rechargePackages = useMemo(() => {
    return allPackages?.filter(p => p.isRechargePack) || [];
  }, [allPackages]);

  const walkInPackages = useMemo(() => {
    if (!station) return [];
    const playerCount = Math.max(1, selectedPlayers.filter(Boolean).length);
    return generateDynamicQuickPlayPackages(station.type, playerCount);
  }, [station, selectedPlayers]);

  const getMemberActiveRecharges = (memberId: string) => {
    const member = loadedMembers[memberId];
    if (!member || !member.recharges) return [];
    const now = new Date();
    return member.recharges.filter(r => isAfter(new Date(r.expiryDate), now) && r.remainingDuration > 0);
  };

  const getMemberTotalBalance = (member: Member) => {
    if (!member || !member.recharges) return 0;
    const now = new Date();
    return member.recharges
        .filter(r => isAfter(new Date(r.expiryDate), now) && r.remainingDuration > 0)
        .reduce((sum, r) => sum + r.remainingDuration, 0);
  };

  // Auto-initialize mode for active configuration player
  useEffect(() => {
    if (activeConfigPlayerId) {
      setConfigs(prev => {
        if (prev[activeConfigPlayerId]?.mode) return prev;

        const activeRecharges = getMemberActiveRecharges(activeConfigPlayerId);
        const defaultMode: 'recharge' | 'walkin' = activeRecharges.length > 0 ? 'recharge' : 'walkin';

        return {
          ...prev,
          [activeConfigPlayerId]: {
            mode: defaultMode,
            packageId: null,
            rechargeId: null,
            name: null,
            duration: null,
            price: null
          }
        };
      });
    }
  }, [activeConfigPlayerId, loadedMembers]);

  const filteredMembers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const selectedIds = new Set(selectedPlayers.filter(Boolean).map(p => p.id));
    const pool = [...members, ...searchResults];
    const uniqueMap = new Map<string, Member>();
    pool.forEach(m => {
      if (m.id && !selectedIds.has(m.id)) {
        uniqueMap.set(m.id, m);
      }
    });

    const results = Array.from(uniqueMap.values());
    if (!term) return [];

    return results.filter(m => {
      const nameMatch = m.name && m.name.toLowerCase().includes(term);
      const usernameMatch = m.username && m.username.toLowerCase().includes(term);
      const phoneMatch = m.phone && m.phone.replace(/\D/g, '').includes(term);
      return nameMatch || usernameMatch || phoneMatch;
    }).slice(0, 15);
  }, [searchTerm, members, searchResults, selectedPlayers]);

  const assignPlayerToSlot = (player: AssignedMember) => {
    setSelectedPlayers(prev => {
      const updated = [...prev];
      updated[activeSlotIndex] = player;
      return updated;
    });

    setSearchTerm('');

    // Advance active slot index to the next empty slot if available
    const nextSlot = activeSlotIndex + 1;
    if (nextSlot < targetSlotsCount) {
      setActiveSlotIndex(nextSlot);
    }
  };

  const handleSelectCustomer = (member: Member) => {
    const newPlayer: AssignedMember = {
      id: member.id,
      name: member.name,
      avatarUrl: member.avatarUrl || GUEST_AVATAR,
    };
    assignPlayerToSlot(newPlayer);
  };

  const handleConfirmAddGuest = () => {
    const cleanReason = guestReason.trim();
    if (!cleanReason) return;

    const guestPlayer: AssignedMember = {
      id: `guest-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: `Guest (${cleanReason})`,
      avatarUrl: GUEST_AVATAR,
    };
    assignPlayerToSlot(guestPlayer);
    setGuestReason('');
    setShowGuestConfirmModal(false);
  };

  const handleConfirmDuplicateGamerTag = () => {
    const original = duplicatePromptState.originalName.trim();
    const tag = duplicatePromptState.gamerTag.trim();
    if (!original) return;

    const formattedName = tag ? `${original} (${tag})` : original;
    setDuplicatePromptState(prev => ({ ...prev, isOpen: false }));
    handleRegisterNewMember(undefined, formattedName);
  };

  const handleRegisterNewMember = async (e?: React.FormEvent, overrideName?: string) => {
    if (e) e.preventDefault();
    const cleanName = (overrideName || regName).trim();
    const cleanPhone = regPhone.trim();
    const cleanBirthday = regBirthday.trim();
    const cleanEmail = regEmail.trim();

    if (!cleanName || isSubmittingReg) return;

    // Check for duplicate name if not already overridden with gamer tag
    if (!overrideName) {
      const isDuplicateName = Object.values(loadedMembers).some(
        m => m.name.toLowerCase().trim() === cleanName.toLowerCase()
      ) || members.some(
        m => m.name.toLowerCase().trim() === cleanName.toLowerCase()
      );

      if (isDuplicateName) {
        setDuplicatePromptState({
          isOpen: true,
          originalName: cleanName,
          gamerTag: '',
        });
        return;
      }
    }

    const grantedTier: MemberTier = cleanPhone ? regTier : 'Red';

    setIsSubmittingReg(true);
    try {
      const baseUsername = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'customer';
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const generatedUsername = `${baseUsername}_${randomSuffix}`;

      const newId = await addMember({
        name: cleanName,
        username: generatedUsername,
        phone: cleanPhone || undefined,
        email: cleanEmail || undefined,
        birthday: cleanBirthday || undefined,
        tier: grantedTier,
        level: 1,
        bitsBalance: 0,
        lifetimeBitsEarned: 0,
        xp: 0,
        points: 0,
        totalSpent: 0,
        joinDate: new Date().toISOString(),
        avatarUrl: GUEST_AVATAR,
      });

      const createdId = newId || `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newPlayer: AssignedMember = {
        id: createdId,
        name: cleanName,
        avatarUrl: GUEST_AVATAR,
      };

      if (newId) {
        const newMemberObj: Member = {
          id: createdId,
          name: cleanName,
          username: generatedUsername,
          phone: cleanPhone || undefined,
          email: cleanEmail || undefined,
          birthday: cleanBirthday || undefined,
          tier: grantedTier,
          level: 1,
          bitsBalance: 0,
          lifetimeBitsEarned: 0,
          xp: 0,
          points: 0,
          totalSpent: 0,
          joinDate: new Date().toISOString(),
          avatarUrl: GUEST_AVATAR,
        };
        setLoadedMembers(prev => ({ ...prev, [createdId]: newMemberObj }));
      }

      toast({
        title: "Customer Registered",
        description: `${cleanName} registered with ${grantedTier} Tier.`,
      });

      setRegName('');
      setRegPhone('');
      setRegBirthday('');
      setRegEmail('');
      setRegTier('Red');
      setRegBirthday('');
      setRegEmail('');
      assignPlayerToSlot(newPlayer);
      setStep('selection');
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Registration Error',
        description: 'Failed to register customer. Added fallback profile.',
      });
      const fallbackPlayer: AssignedMember = {
        id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: cleanName,
        avatarUrl: GUEST_AVATAR,
      };
      assignPlayerToSlot(fallbackPlayer);
      setStep('selection');
    } finally {
      setIsSubmittingReg(false);
    }
  };

  const handleCreateNewCustomer = (nameToCreate: string) => {
    const cleanName = nameToCreate.trim();
    if (cleanName) {
      setRegName(cleanName);
    }
    setStep('registration');
  };

  const handleAddPlayerSlot = () => {
    if (targetSlotsCount >= playerLimit) {
      toast({
        variant: 'destructive',
        title: 'Player Limit Reached',
        description: `Maximum ${playerLimit} players allowed for ${station?.name || 'this station'}.`,
      });
      return;
    }
    const newCount = targetSlotsCount + 1;
    setTargetSlotsCount(newCount);
    
    // Set active slot index to the first empty slot or newly added slot
    const firstEmptyIndex = selectedPlayers.findIndex((p, idx) => !p && idx < newCount);
    if (firstEmptyIndex !== -1) {
      setActiveSlotIndex(firstEmptyIndex);
    } else {
      setActiveSlotIndex(newCount - 1);
    }
    setSearchTerm('');
  };

  const handleRemovePlayerAt = (index: number) => {
    setSelectedPlayers(prev => {
      const updated = [...prev];
      const removed = updated[index];
      updated.splice(index, 1);
      if (removed) {
        setConfigs(c => {
          const next = { ...c };
          delete next[removed.id];
          return next;
        });
      }
      return updated;
    });

    if (targetSlotsCount > 1) {
      setTargetSlotsCount(prev => Math.max(1, prev - 1));
    }

    if (activeSlotIndex >= index && activeSlotIndex > 0) {
      setActiveSlotIndex(activeSlotIndex - 1);
    }
  };

  const handleResetAll = () => {
    setSelectedPlayers([]);
    setTargetSlotsCount(1);
    setActiveSlotIndex(0);
    setSearchTerm('');
    setConfigs({});
  };

  const handleProceedToConfiguration = () => {
    const validPlayers = selectedPlayers.filter(Boolean);
    if (validPlayers.length === 0) {
      toast({ variant: 'destructive', title: "No Players Selected", description: "Please add at least one customer to start." });
      return;
    }
    setStep('configuration');
    setActiveConfigPlayerId(validPlayers[0].id);
  };

  const handleSetPlayerMode = (playerId: string, mode: 'recharge' | 'walkin' | 'buy-recharge') => {
      setConfigs(prev => ({
          ...prev,
          [playerId]: { ...prev[playerId], mode, packageId: null, rechargeId: null, name: null, duration: null, price: null, reminderDuration: null }
      }));
  };

  const handleSetPoolDuration = (playerId: string, seconds: number) => {
      setConfigs(prev => ({
          ...prev,
          [playerId]: { ...prev[playerId], reminderDuration: seconds }
      }));
  };

  const handlePickConfig = (playerId: string, item: GamingPackage | MemberRecharge | 'pool', isRecharge: boolean, isBuy: boolean = false) => {
      setConfigs(prev => {
          const next = { ...prev };
          if (item === 'pool') {
              const member = loadedMembers[playerId];
              const balance = member ? getMemberTotalBalance(member) : 0;
              next[playerId] = { 
                  mode: 'recharge', 
                  packageId: 'pool', 
                  rechargeId: 'pool', 
                  name: `Recharge: Combined Balance`, 
                  duration: balance, 
                  price: 0, 
                  reminderDuration: balance
              };

          } else {
              const isRec = isRecharge && !isBuy;
              const pkg = item as GamingPackage;
              const rec = item as MemberRecharge;

              const pkgId = isBuy ? pkg.id : (isRec ? rec.packageId : pkg.id);
              const rId = isRec ? rec.id : null;

              next[playerId] = {
                  mode: isBuy ? 'buy-recharge' : (isRec ? 'recharge' : 'walkin'),
                  packageId: pkgId,
                  rechargeId: rId,
                  name: isBuy ? `Buy Recharge: ${pkg.name}` : (isRec ? `Recharge: ${rec.packageName}` : pkg.name),
                  duration: isRec ? rec.remainingDuration : pkg.duration,
                  price: isRec ? 0 : pkg.price,
                  reminderDuration: null
              };
          }
          return next;
      });
  };

  const handlePickCustomWalkin = (playerId: string) => {
      const mins = parseInt(customMinutes);
      const price = parseInt(customPrice) || 0;
      if (isNaN(mins) || mins <= 0) {
          toast({ variant: 'destructive', title: 'Invalid Time', description: 'Please enter a valid number of minutes.' });
          return;
      }
      
      const customPkg = {
          id: `custom-walkin-${Date.now()}`,
          name: `Custom (${mins}m)`,
          duration: mins * 60,
          price: price,
          validity: 1,
      } as GamingPackage;
      
      handlePickConfig(playerId, customPkg, false);
      setCustomMinutes('');
      setCustomPrice('');
  };

  const handleApplyAllAndStart = () => {
      if (!activeConfigPlayerId) return;
      const currentConfig = configs[activeConfigPlayerId];
      if (!currentConfig || !currentConfig.name) {
          toast({ variant: 'destructive', title: "No Plan Selected", description: "Select a plan for the active player first." });
          return;
      }

      const now = new Date();
      let calculatedTotalCost = 0;

      const validPlayers = selectedPlayers.filter(Boolean);

      const finalPlayers = validPlayers.map(p => {
          let configToUse = { ...currentConfig };
          
          if (!configToUse || !configToUse.name) return null;

          const durationSeconds = configToUse.reminderDuration || configToUse.duration || 0;
          const endTime = durationSeconds > 0 ? new Date(now.getTime() + durationSeconds * 1000).toISOString() : null;
          
          calculatedTotalCost += (configToUse.price || 0);

          return { 
              ...p, 
              rechargeId: configToUse.rechargeId || null, 
              packageId: configToUse.packageId || null, 
              isNewRecharge: configToUse.mode === 'buy-recharge',
              startTime: now.toISOString(),
              endTime: endTime,
              status: 'active' as const,
              remainingTimeOnPause: null
          };
      }).filter(Boolean) as AssignedMember[];

      if (finalPlayers.length === 0) {
          toast({ variant: 'destructive', title: "Invalid Setup", description: "At least one player must have a valid configuration." });
          return;
      }

      let minDuration = 24 * 3600; 
      let sessionName = currentConfig.name || "Standard Session";
      
      const virtualPackage: GamingPackage = { id: 'mixed-session', name: sessionName, duration: minDuration, price: 0, validity: 1 };
      
      const durationSeconds = currentConfig.reminderDuration || currentConfig.duration || 3600;
      const durationText = currentConfig.name || formatPackageDuration(durationSeconds);

      setStartTimerConfirm({
          finalPlayers,
          virtualPackage,
          totalCost: calculatedTotalCost,
          durationText
      });
  };

  const validPlayers = useMemo(() => selectedPlayers.filter(Boolean), [selectedPlayers]);

  const allPlayersConfigured = useMemo(() => {
      if (validPlayers.length === 0) return false;
      return validPlayers.every(p => configs[p.id]?.name != null);
  }, [validPlayers, configs]);

  const handleConfirmAll = () => {
      if (!allPlayersConfigured) return;
      const syncedNow = getSyncedNow();
      let calculatedTotalCost = 0;
      
      const finalPlayers = validPlayers.map(p => {
          const config = configs[p.id];
          const durationSeconds = config.reminderDuration || config.duration || 0;
          const endTime = durationSeconds > 0 ? new Date(syncedNow + durationSeconds * 1000).toISOString() : null;
          calculatedTotalCost += (config.price || 0);

          return { 
              ...p, 
              rechargeId: config.rechargeId || null, 
              packageId: config.packageId || null, 
              isNewRecharge: config.mode === 'buy-recharge',
              startTime: new Date(syncedNow).toISOString(),
              endTime: endTime,
              status: 'active' as const,
              remainingTimeOnPause: null
          };
      });

      let minDuration = 24 * 3600; 
      let sessionName = "Session";
      Object.values(configs).forEach(c => {
          const dur = c.reminderDuration || c.duration;
          if (dur && dur < minDuration) { minDuration = dur; sessionName = c.name || sessionName; }
      });

      const virtualPackage: GamingPackage = { id: 'mixed-session', name: sessionName, duration: minDuration, price: 0, validity: 1 };
      const firstConfig = configs[validPlayers[0]?.id];
      const durationText = firstConfig?.name || formatPackageDuration(minDuration);

      setStartTimerConfirm({
          finalPlayers,
          virtualPackage,
          totalCost: calculatedTotalCost,
          durationText
      });
  };

  if (!station) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent showClose={false} className="w-[98vw] max-w-[98vw] sm:max-w-2xl max-h-[88vh] flex flex-col p-0 overflow-hidden border-2 border-primary/30 shadow-2xl font-body rounded-xl">
        <DialogTitle className="sr-only">Assign Players Modal</DialogTitle>
        <DialogDescription className="sr-only">Assign customer players to gaming station and configure session time</DialogDescription>

        {/* START TIMER CONFIRMATION OVERLAY (PRE-FLIGHT MISSION BRIEFING) */}
        {startTimerConfirm && (
          <div className="absolute inset-0 z-50 bg-zinc-950/98 backdrop-blur-xl flex flex-col justify-between p-5 sm:p-7 animate-in zoom-in-95 duration-200 border-2 border-primary/40 rounded-xl overflow-y-auto font-body">
            <div className="space-y-4">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center text-primary shadow-md shrink-0">
                    <Timer className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-extrabold uppercase text-white tracking-wide font-headline flex items-center gap-2">
                      READY TO START SESSION
                    </h3>
                    <p className="text-xs text-zinc-400 font-medium pt-0.5">
                      Everything looks good. Check pre-flight steps below.
                    </p>
                  </div>
                </div>
                <Badge className="bg-primary/20 text-primary border border-primary/30 text-xs font-bold uppercase px-3 py-1.5 rounded-full shrink-0">
                  {station?.name}
                </Badge>
              </div>

              {/* 1. SESSION SUMMARY (PLAYERS & STATION) */}
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-extrabold uppercase text-zinc-400 tracking-wider">SESSION</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1.5 shadow-inner">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-zinc-400">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      <span>{startTimerConfirm.finalPlayers.length} {startTimerConfirm.finalPlayers.length === 1 ? 'PLAYER' : 'PLAYERS'}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {startTimerConfirm.finalPlayers.map(p => (
                        <Badge key={p.id} variant="secondary" className="bg-zinc-800 text-white border border-zinc-700 font-extrabold uppercase px-2.5 py-1 text-xs">
                          {p.name}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-1.5 shadow-inner">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-zinc-400">
                      <Gamepad2 className="h-3.5 w-3.5 text-primary" />
                      <span>STATION</span>
                    </div>
                    <p className="text-base font-extrabold text-white uppercase pt-0.5">{station?.name}</p>
                  </div>
                </div>
              </div>

              {/* 2. PLAN & PRICE SUMMARY */}
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-extrabold uppercase text-zinc-400 tracking-wider">SESSION PLAN</h4>
                <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between shadow-inner">
                  <div className="space-y-0.5 min-w-0 pr-3">
                    <p className="text-base font-extrabold text-white uppercase truncate">{startTimerConfirm.durationText}</p>
                    <p className="text-xs text-zinc-400 font-medium">Starts when you press Start Timer</p>
                  </div>
                  <p className="text-2xl font-mono font-extrabold text-primary shrink-0">₹{startTimerConfirm.totalCost}</p>
                </div>
              </div>

              {/* 3. CONTROLLER CHECK & PRE-FLIGHT CHECKLIST */}
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-extrabold uppercase text-zinc-400 tracking-wider">CONTROLLER CHECK</h4>
                <div className="p-3.5 rounded-xl bg-zinc-900/90 border-2 border-amber-500/30 space-y-3 shadow-md">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Gamepad2 className="h-4 w-4 text-amber-400 shrink-0" />
                      <div>
                        <p className="text-xs font-extrabold uppercase text-amber-400">
                          {startTimerConfirm.finalPlayers.length} CONTROLLER{startTimerConfirm.finalPlayers.length > 1 ? 'S' : ''} REQUIRED
                        </p>
                        <p className="text-[11px] text-zinc-300 font-medium">
                          Take {startTimerConfirm.finalPlayers.length > 1 ? `${startTimerConfirm.finalPlayers.length} charged controllers` : 'a charged controller'} + cable upstairs.
                        </p>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setChecklist({ charged: true, cable: true, takenUpstairs: true })}
                      className="text-[10px] font-extrabold uppercase text-amber-400 hover:text-white px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all shrink-0"
                    >
                      ✓ MARK ALL READY
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-zinc-800/80">
                    <div 
                      onClick={() => toggleChecklistItem('charged')}
                      className={cn(
                        "p-2.5 rounded-lg border flex items-center gap-2.5 cursor-pointer transition-all text-xs font-extrabold uppercase select-none",
                        checklist.charged 
                          ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300" 
                          : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      )}
                    >
                      <div className={cn(
                        "h-4 w-4 rounded flex items-center justify-center border transition-all shrink-0",
                        checklist.charged ? "bg-emerald-500 border-emerald-500 text-black" : "border-zinc-600 bg-zinc-900"
                      )}>
                        {checklist.charged && <CheckCircle2 className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <span>Controller{startTimerConfirm.finalPlayers.length > 1 ? 's' : ''} Charged</span>
                    </div>

                    <div 
                      onClick={() => toggleChecklistItem('cable')}
                      className={cn(
                        "p-2.5 rounded-lg border flex items-center gap-2.5 cursor-pointer transition-all text-xs font-extrabold uppercase select-none",
                        checklist.cable 
                          ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300" 
                          : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      )}
                    >
                      <div className={cn(
                        "h-4 w-4 rounded flex items-center justify-center border transition-all shrink-0",
                        checklist.cable ? "bg-emerald-500 border-emerald-500 text-black" : "border-zinc-600 bg-zinc-900"
                      )}>
                        {checklist.cable && <CheckCircle2 className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <span>Cable Collected</span>
                    </div>

                    <div 
                      onClick={() => toggleChecklistItem('takenUpstairs')}
                      className={cn(
                        "p-2.5 rounded-lg border flex items-center gap-2.5 cursor-pointer transition-all text-xs font-extrabold uppercase select-none",
                        checklist.takenUpstairs 
                          ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300" 
                          : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      )}
                    >
                      <div className={cn(
                        "h-4 w-4 rounded flex items-center justify-center border transition-all shrink-0",
                        checklist.takenUpstairs ? "bg-emerald-500 border-emerald-500 text-black" : "border-zinc-600 bg-zinc-900"
                      )}>
                        {checklist.takenUpstairs && <CheckCircle2 className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <span>Taken Upstairs</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. RETURN CONTROLLER NOTICE */}
              <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-300 text-xs font-medium flex items-center gap-2">
                <span className="font-extrabold text-amber-400 shrink-0">⚠ RETURN CONTROLLER:</span>
                <span className="text-zinc-300 truncate">Bring controller{startTimerConfirm.finalPlayers.length > 1 ? 's' : ''} + cable back downstairs after session.</span>
              </div>

            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-3 mt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStartTimerConfirm(null)}
                className="h-12 px-4 text-xs uppercase font-extrabold text-zinc-400 hover:text-white border border-zinc-800 rounded-xl"
              >
                &larr; BACK TO EDIT
              </Button>

              <Button
                type="button"
                onClick={() => {
                  onConfirm(startTimerConfirm.finalPlayers, startTimerConfirm.virtualPackage);
                  setStartTimerConfirm(null);
                }}
                className={cn(
                  "flex-1 h-14 text-base font-extrabold uppercase transition-all shadow-2xl rounded-xl gap-2 tracking-wide active:scale-[0.98]",
                  isAllChecked 
                    ? "bg-emerald-500 hover:bg-emerald-600 text-black ring-2 ring-emerald-400/30" 
                    : "bg-primary hover:bg-primary/90 text-primary-foreground"
                )}
              >
                <Play className="h-5 w-5 fill-current" /> {isAllChecked ? '✓ ALL READY - START TIMER' : 'START TIMER'}
              </Button>
            </div>
          </div>
        )}

        {/* Top Header */}
        <div className="px-6 py-3.5 flex items-center justify-between border-b border-zinc-800/50 bg-zinc-950 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-headline font-extrabold text-base sm:text-lg tracking-wide text-zinc-100 uppercase flex items-center gap-2">
              {step === 'membership-check' && 'CUSTOMER CHECK-IN'}
              {step === 'registration' && 'CUSTOMER REGISTRATION'}
              {step === 'selection' && 'ASSIGN PLAYERS'}
              {step === 'configuration' && 'CONFIGURE SESSION LOGINS'}
            </h2>
          </div>
          <div className="flex items-center gap-3 pr-8">
            {step === 'selection' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep('membership-check')}
                className="h-7 text-[11px] text-zinc-400 hover:text-white px-2 font-bold uppercase gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Change Option
              </Button>
            )}
            {step === 'registration' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep('membership-check')}
                className="h-7 text-[11px] text-zinc-400 hover:text-white px-2 font-bold uppercase gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </Button>
            )}
            {step === 'configuration' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep('selection')}
                className="h-7 text-[11px] text-zinc-400 hover:text-white px-2 font-bold uppercase gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Change Players
              </Button>
            )}
            <span className="text-xs font-bold text-zinc-300 bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-800 shadow-sm shrink-0">
              {station.name}
            </span>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-zinc-950">
            {/* STEP 0: ARE YOU A MEMBER HERE? */}
            {step === 'membership-check' && (
              <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-10 space-y-8 animate-in fade-in zoom-in-95 duration-200 overflow-y-auto">
                <div className="text-center space-y-3 max-w-md">
                  <div className="h-16 w-16 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center mx-auto text-primary shadow-xl">
                    <Crown className="h-8 w-8" />
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-extrabold uppercase text-white tracking-wide font-headline">
                    ARE YOU A MEMBER HERE?
                  </h3>
                  <p className="text-sm text-zinc-300 font-medium leading-relaxed italic border-l-2 border-primary/40 pl-3 text-left">
                    "Welcome to The 8 Bit Bistro! Are you registered with us as a member?"
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
                  {/* YES BUTTON */}
                  <div
                    onClick={() => setStep('selection')}
                    className="p-6 rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-500/10 to-emerald-500/5 hover:bg-emerald-500/20 hover:border-emerald-500 transition-all flex flex-col items-center text-center gap-3 cursor-pointer shadow-xl group active:scale-95"
                  >
                    <div className="h-12 w-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-extrabold uppercase text-white tracking-wide">
                        YES, I'M A MEMBER
                      </h4>
                      <p className="text-xs text-emerald-400 font-medium pt-1">
                        Search existing member database
                      </p>
                    </div>
                  </div>

                  {/* NO BUTTON */}
                  <div
                    onClick={() => setStep('registration')}
                    className="p-6 rounded-2xl border-2 border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-amber-500/5 hover:bg-amber-500/20 hover:border-amber-500 transition-all flex flex-col items-center text-center gap-3 cursor-pointer shadow-xl group active:scale-95"
                  >
                    <div className="h-12 w-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:bg-amber-500 group-hover:text-black transition-all">
                      <UserPlus className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-extrabold uppercase text-white tracking-wide">
                        NO, NEW CUSTOMER
                      </h4>
                      <p className="text-xs text-amber-400 font-medium pt-1">
                        Register new account in 10 seconds
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 0.5: CUSTOMER REGISTRATION PAGE */}
            {step === 'registration' && (
              <div className="flex-1 flex flex-col justify-between p-6 sm:p-8 animate-in fade-in slide-in-from-right-4 duration-300 overflow-y-auto">
                <form onSubmit={handleRegisterNewMember} className="space-y-6 max-w-lg mx-auto w-full my-auto">
                  <div className="text-center space-y-2">
                    <div className="h-14 w-14 rounded-2xl bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center mx-auto text-amber-400 shadow-lg">
                      <UserPlus className="h-7 w-7" />
                    </div>
                    <h3 className="text-2xl font-extrabold uppercase text-white tracking-wide font-headline">
                      NEW CUSTOMER REGISTRATION
                    </h3>
                    <p className="text-xs text-zinc-400 font-medium">
                      Register a new customer for <strong className="text-white">{station?.name}</strong> player {activeSlotIndex + 1}
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-zinc-900/90 border-2 border-zinc-800 space-y-4 shadow-xl">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-zinc-300">
                        Customer Full Name <span className="text-primary">*</span>
                      </Label>
                      <Input
                        autoFocus
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="h-12 text-base font-bold bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:border-amber-500 rounded-xl"
                      />
                      {regName.trim() && (Object.values(loadedMembers).some(m => m.name.toLowerCase().trim() === regName.trim().toLowerCase()) || members.some(m => m.name.toLowerCase().trim() === regName.trim().toLowerCase())) && (
                        <p className="text-[11px] text-amber-400 font-semibold flex items-center gap-1.5 pt-0.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          A customer named "{regName.trim()}" exists. Gamer name prompt will appear on save.
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-zinc-300">
                        Phone Number <span className="text-zinc-500 font-normal">(Optional)</span>
                      </Label>
                      <Input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="e.g. 9876543210"
                        className="h-12 text-base font-mono bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:border-amber-500 rounded-xl"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase text-zinc-300">
                          Birthday <span className="text-zinc-500 font-normal">(Optional)</span>
                        </Label>
                        <Input
                          type="date"
                          value={regBirthday}
                          onChange={(e) => setRegBirthday(e.target.value)}
                          className="h-12 text-sm bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:border-amber-500 rounded-xl"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase text-zinc-300">
                          Email <span className="text-zinc-500 font-normal">(Optional)</span>
                        </Label>
                        <Input
                          type="email"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="e.g. customer@example.com"
                          className="h-12 text-sm bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:border-amber-500 rounded-xl"
                        />
                      </div>
                    </div>

                    {/* MEMBERSHIP TIER TO GRANT */}
                    <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                      <Label className="text-xs font-bold uppercase text-zinc-300 flex items-center justify-between">
                        <span>Membership Tier to Grant</span>
                        {regPhone.trim() ? (
                          <span className="text-[11px] text-zinc-400 font-medium">Selected: <strong className="text-white">{regTier} Tier</strong></span>
                        ) : (
                          <span className="text-[11px] text-amber-400 font-semibold italic flex items-center gap-1">
                            <Lock className="h-3 w-3 text-amber-400" /> Enter phone number to unlock Green & Gold
                          </span>
                        )}
                      </Label>

                      <div className="grid grid-cols-3 gap-2.5">
                        {/* RED TIER */}
                        <button
                          type="button"
                          onClick={() => setRegTier('Red')}
                          className={cn(
                            "p-3 rounded-xl border-2 flex flex-col items-center justify-center text-center transition-all cursor-pointer",
                            regTier === 'Red'
                              ? "border-red-500 bg-red-500/20 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)] font-extrabold"
                              : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                          )}
                        >
                          <div className={cn(
                            "h-3 w-3 rounded-full mb-1.5",
                            regTier === 'Red' ? "bg-red-500 shadow-[0_0_8px_#ef4444]" : "bg-red-500/40"
                          )} />
                          <span className="text-xs uppercase tracking-wide font-extrabold text-red-400">Red</span>
                          <span className="text-[10px] text-zinc-400 mt-0.5 font-medium">Standard</span>
                        </button>

                        {/* GREEN TIER */}
                        <button
                          type="button"
                          disabled={!regPhone.trim()}
                          onClick={() => regPhone.trim() && setRegTier('Green')}
                          className={cn(
                            "p-3 rounded-xl border-2 flex flex-col items-center justify-center text-center transition-all relative overflow-hidden",
                            !regPhone.trim()
                              ? "border-zinc-800/60 bg-zinc-950/30 text-zinc-600 opacity-50 cursor-not-allowed"
                              : regTier === 'Green'
                                ? "border-emerald-500 bg-emerald-500/20 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] font-extrabold cursor-pointer"
                                : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 cursor-pointer"
                          )}
                        >
                          <div className={cn(
                            "h-3 w-3 rounded-full mb-1.5",
                            !regPhone.trim() ? "bg-zinc-700" : regTier === 'Green' ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-emerald-500/40"
                          )} />
                          <span className={cn("text-xs uppercase tracking-wide font-extrabold flex items-center justify-center gap-1", !regPhone.trim() ? "text-zinc-500" : "text-emerald-400")}>
                            {!regPhone.trim() && <Lock className="h-3 w-3" />} Green
                          </span>
                          <span className="text-[10px] text-zinc-400 mt-0.5 font-medium">
                            {!regPhone.trim() ? "Needs Phone" : "Verified"}
                          </span>
                        </button>

                        {/* GOLD TIER */}
                        <button
                          type="button"
                          disabled={!regPhone.trim()}
                          onClick={() => regPhone.trim() && setRegTier('Gold')}
                          className={cn(
                            "p-3 rounded-xl border-2 flex flex-col items-center justify-center text-center transition-all relative overflow-hidden",
                            !regPhone.trim()
                              ? "border-zinc-800/60 bg-zinc-950/30 text-zinc-600 opacity-50 cursor-not-allowed"
                              : regTier === 'Gold'
                                ? "border-amber-500 bg-amber-500/20 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)] font-extrabold cursor-pointer"
                                : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 cursor-pointer"
                          )}
                        >
                          <div className={cn(
                            "h-3 w-3 rounded-full mb-1.5",
                            !regPhone.trim() ? "bg-zinc-700" : regTier === 'Gold' ? "bg-amber-400 shadow-[0_0_8px_#f59e0b]" : "bg-amber-400/40"
                          )} />
                          <span className={cn("text-xs uppercase tracking-wide font-extrabold flex items-center justify-center gap-1", !regPhone.trim() ? "text-zinc-500" : "text-amber-400")}>
                            {!regPhone.trim() && <Lock className="h-3 w-3" />} Gold
                          </span>
                          <span className="text-[10px] text-zinc-400 mt-0.5 font-medium">
                            {!regPhone.trim() ? "Needs Phone" : "VIP Pass"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep('membership-check')}
                      className="h-13 px-5 text-xs font-extrabold uppercase text-zinc-400 hover:text-white border border-zinc-800 rounded-xl"
                    >
                      &larr; BACK
                    </Button>
                    <Button
                      type="submit"
                      disabled={!regName.trim() || isSubmittingReg}
                      className="flex-1 h-13 text-sm font-extrabold uppercase bg-amber-500 hover:bg-amber-600 text-black shadow-2xl rounded-xl gap-2 tracking-wide transition-all active:scale-[0.98]"
                    >
                      <UserPlus className="h-4 w-4" />
                      {isSubmittingReg ? 'REGISTERING...' : 'REGISTER & ASSIGN PLAYER →'}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* STEP 1: PLAYER ASSIGNMENT */}
            {step === 'selection' && (
                <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-5 space-y-4 animate-in fade-in duration-200">
                    
                    {/* Customer-First Hospitality Dialogue Quote */}
                    <div className="px-2">
                      <p className="text-base sm:text-lg font-light tracking-wide text-zinc-200 leading-relaxed italic border-l-2 border-primary/40 pl-4">
                        "Welcome to The 8 Bit Bistro! May I have your name to assign players today?"
                      </p>
                    </div>

                    {/* Customer Name Search & Input Field */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-xs font-extrabold uppercase text-zinc-300 tracking-wide flex items-center gap-2">
                          <Search className="h-3.5 w-3.5 text-primary" />
                          <span>WHO'S PLAYING?</span>
                          {targetSlotsCount > 1 && (
                            <Badge className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md">
                              PLAYER {activeSlotIndex + 1}
                            </Badge>
                          )}
                        </label>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setShowGuestConfirmModal(true)}
                            className="text-[11px] text-zinc-500 hover:text-zinc-300 underline font-medium transition-colors"
                          >
                            Add a guest instead
                          </button>
                          {targetSlotsCount > 1 && (
                            <span className="text-[11px] text-zinc-400 font-semibold uppercase">
                              Slot {activeSlotIndex + 1} of {targetSlotsCount}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="relative flex items-center gap-3.5 bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border-2 border-primary shadow-[0_0_25px_rgba(239,68,68,0.3)] focus-within:shadow-[0_0_35px_rgba(239,68,68,0.55)] focus-within:border-primary rounded-2xl px-4 py-3 transition-all cursor-text">
                        <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground shadow-lg flex items-center justify-center shrink-0">
                          <Search className="h-5 w-5 stroke-[2.5]" />
                        </div>
                        <Input 
                          autoFocus
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && searchTerm.trim()) {
                              const exactMatch = filteredMembers.find(m => m.name.toLowerCase() === searchTerm.trim().toLowerCase());
                              if (exactMatch) {
                                handleSelectCustomer(exactMatch);
                              } else {
                                handleCreateNewCustomer(searchTerm.trim());
                              }
                            }
                          }}
                          placeholder={`Search customer name or phone number...`}
                          className="h-11 text-base sm:text-xl font-headline font-extrabold tracking-wide bg-transparent border-none focus-visible:ring-0 px-0 text-white placeholder:text-zinc-300 placeholder:font-normal transition-colors flex-1"
                        />
                        {searchTerm.trim() ? (
                          <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="h-8 w-8 rounded-full bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 flex items-center justify-center transition-colors shrink-0 shadow-inner"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        ) : (
                          <Badge className="hidden sm:flex text-[10px] font-extrabold uppercase border border-primary/40 text-primary bg-primary/10 px-2.5 py-1 rounded-lg shrink-0">
                            START TYPING
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* MATCHING EXISTING CUSTOMERS & "+ CREATE NEW CUSTOMER" (ONLY SHOWN WHEN TYPING) */}
                    {searchTerm.trim().length > 0 && (
                      <div className="max-h-[220px] overflow-y-auto min-h-0 space-y-2 pr-1 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                        
                        {/* + CREATE NEW CUSTOMER BUTTON */}
                        {searchTerm.trim().length > 0 && (
                          <div 
                            onClick={() => handleCreateNewCustomer(searchTerm.trim())}
                            className="p-3 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all flex items-center justify-between gap-3 shadow-md cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border-2 border-emerald-500/50">
                                <AvatarImage src={GUEST_AVATAR} />
                                <AvatarFallback className="font-bold text-xs bg-emerald-500 text-black">
                                  {searchTerm.trim().substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-extrabold uppercase text-white tracking-wide">{searchTerm.trim()}</p>
                                <p className="text-[11px] text-emerald-400 font-semibold">Not registered? Fill registration form</p>
                              </div>
                            </div>

                            <Button 
                              size="sm"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreateNewCustomer(searchTerm.trim());
                              }}
                              className="h-8 px-3 font-bold uppercase text-xs bg-emerald-500 hover:bg-emerald-600 text-black shadow-md gap-1 rounded-lg"
                            >
                              <UserPlus className="h-3.5 w-3.5" /> + REGISTER NEW MEMBER
                            </Button>
                          </div>
                        )}

                        {/* MATCHING EXISTING CUSTOMERS */}
                        {filteredMembers.map(member => {
                          const balance = getMemberTotalBalance(member);
                          const isMember = !!member.tier;

                          return (
                            <div 
                              key={member.id} 
                              onClick={() => handleSelectCustomer(member)}
                              className="w-full p-2.5 rounded-xl border-2 border-zinc-800 bg-zinc-900/90 hover:border-primary/50 hover:bg-zinc-800 flex items-center justify-between gap-3 transition-all cursor-pointer"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <Avatar className="h-9 w-9 border border-zinc-700 shrink-0">
                                  <AvatarImage src={member.avatarUrl} />
                                  <AvatarFallback className="font-bold text-xs bg-zinc-800 text-white">{member.name[0]}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-extrabold uppercase truncate text-white">{member.name}</p>
                                    {isMember ? (
                                      <Badge className="text-[9px] font-bold uppercase px-1.5 py-0 border-amber-500/30 text-amber-400 bg-amber-500/10">
                                        MEMBER
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[9px] font-bold uppercase px-1.5 py-0 border-zinc-700 text-zinc-400">
                                        CUSTOMER
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-zinc-400 font-bold uppercase font-mono mt-0.5">@{member.username}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {balance > 0 && (
                                  <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs font-bold uppercase">
                                    <Zap className="h-3 w-3 fill-current" />{formatPackageDuration(balance)}
                                  </div>
                                )}
                                <Button
                                  size="sm"
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectCustomer(member);
                                  }}
                                  className="h-8 px-3 text-xs font-bold uppercase bg-primary hover:bg-primary/90 text-primary-foreground gap-1 rounded-lg"
                                >
                                  <UserPlus className="h-3.5 w-3.5" /> SELECT
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* INDIVIDUAL PLAYER SLOTS DISPLAY */}
                    <div className="space-y-2 pt-2 border-t border-zinc-800">
                      <div className="flex justify-between items-center text-xs font-bold uppercase text-zinc-400">
                        <span>SESSION PLAYER SLOTS ({validPlayers.length}/{targetSlotsCount})</span>
                        {targetSlotsCount < playerLimit && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAddPlayerSlot}
                            className="h-7 px-2.5 text-[11px] font-extrabold uppercase border-primary/40 text-primary hover:bg-primary hover:text-black transition-all gap-1 rounded-lg shadow-sm"
                          >
                            <Plus className="h-3.5 w-3.5" /> ADD PLAYER
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Array.from({ length: targetSlotsCount }).map((_, idx) => {
                          const player = selectedPlayers[idx];
                          const isSelectedForEdit = activeSlotIndex === idx;
                          const isMember = player && loadedMembers[player.id]?.tier;

                          return (
                            <div
                              key={idx}
                              onClick={() => { setActiveSlotIndex(idx); setSearchTerm(''); }}
                              className={cn(
                                "p-3 rounded-xl border-2 transition-all flex items-center justify-between cursor-pointer",
                                player ? "border-zinc-800 bg-zinc-900/90" : "border-dashed border-zinc-800 bg-zinc-950 hover:border-zinc-700",
                                isSelectedForEdit && "border-primary bg-primary/10 ring-1 ring-primary"
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <Avatar className="h-9 w-9 border border-zinc-700">
                                  <AvatarImage src={player?.avatarUrl || GUEST_AVATAR} />
                                  <AvatarFallback className="font-bold text-xs bg-zinc-800 text-white">
                                    {player ? player.name[0] : `P${idx + 1}`}
                                  </AvatarFallback>
                                </Avatar>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold uppercase text-zinc-400">Player {idx + 1}:</span>
                                    {player ? (
                                      <span className="text-sm font-extrabold uppercase text-white truncate">{player.name}</span>
                                    ) : (
                                      <span className="text-xs font-medium text-zinc-500 italic">Add customer</span>
                                    )}
                                  </div>
                                  {isMember && (
                                    <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-bold uppercase px-1.5 py-0 mt-0.5">
                                      MEMBER
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {player ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemovePlayerAt(idx);
                                  }}
                                  className="h-7 w-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              ) : (
                                <Badge variant="outline" className="text-[10px] font-bold uppercase border-primary/40 text-primary">
                                  Select
                                </Badge>
                              )}
                            </div>
                          );
                        })}

                        {targetSlotsCount < playerLimit && (
                          <div
                            onClick={handleAddPlayerSlot}
                            className="p-3 rounded-xl border-2 border-dashed border-zinc-800 hover:border-primary/50 bg-zinc-950/50 hover:bg-primary/5 transition-all flex items-center justify-center gap-2 cursor-pointer text-zinc-400 hover:text-primary min-h-[58px]"
                          >
                            <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                              <Plus className="h-4 w-4" />
                            </div>
                            <span className="text-xs font-extrabold uppercase tracking-wide">ADD PLAYER SLOT</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Bar */}
                    <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleResetAll}
                        className="text-xs text-zinc-500 uppercase font-bold gap-1 hover:text-white"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> RESET
                      </Button>

                      <Button 
                        type="button"
                        onClick={handleProceedToConfiguration} 
                        disabled={validPlayers.length === 0} 
                        className="h-12 px-6 font-extrabold text-sm uppercase bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl rounded-xl gap-2 transition-transform active:scale-[0.99]"
                      >
                        START SESSION &rarr;
                      </Button>
                    </div>

                </div>
            )}

            {/* STEP 2: SESSION CONFIGURATION */}
            {step === 'configuration' && (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="p-3 sm:p-4 flex-1 flex flex-col min-h-0 overflow-hidden">
                        <div className="flex items-center justify-between shrink-0 mb-3">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wide">2. SELECT SESSION TIME</h3>
                            <Button variant="ghost" size="sm" onClick={() => setStep('selection')} className="h-7 uppercase text-xs font-bold text-zinc-400 hover:text-white"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> CHANGE PLAYERS</Button>
                        </div>

                        <div className="space-y-1.5 mb-4 shrink-0 overflow-y-auto max-h-[30%] sm:max-h-[25%] border-b border-zinc-800 pb-3">
                            {validPlayers.map((player) => {
                                const config = configs[player.id];
                                const isSelected = activeConfigPlayerId === player.id;
                                const hasSelection = !!config?.name;
                                return (
                                    <div key={player.id} onClick={() => setActiveConfigPlayerId(player.id)} className={cn("p-2 rounded-lg border-2 transition-all cursor-pointer flex items-center justify-between", isSelected ? "border-primary bg-primary/10 ring-1 ring-primary shadow-md" : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/60", hasSelection && !isSelected && "border-green-500/30 opacity-80")}>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8 border border-zinc-700"><AvatarImage src={player.avatarUrl} /><AvatarFallback className="text-sm font-bold">{player.name[0]}</AvatarFallback></Avatar>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold uppercase leading-tight truncate text-white">{player.name}</p>
                                                {hasSelection ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold uppercase text-green-400 block truncate max-w-[140px]">{config.name}</span>
                                                        {config.reminderDuration && <Badge className="h-4 text-[10px] font-bold bg-amber-500">{formatPackageDuration(config.reminderDuration)}</Badge>}
                                                    </div>
                                                ) : <p className="text-xs text-zinc-500 font-bold uppercase">Tap to configure time</p>}
                                            </div>
                                        </div>
                                        {hasSelection && !isSelected && <Badge variant="outline" className="h-5 px-2 text-[10px] font-bold bg-green-500/10 text-green-400 border-green-500/30 uppercase">READY</Badge>}
                                    </div>
                                );
                            })}
                        </div>

                        {activeConfigPlayerId && (
                            <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-hidden">
                                <div className="p-2 border border-zinc-800 rounded-xl bg-zinc-900/30 flex-1 flex flex-col overflow-hidden">
                                    <div className="flex items-center justify-between px-2 mb-2.5">
                                        <h4 className="text-xs font-bold uppercase text-zinc-400 tracking-wide">CONFIGURING FOR: <strong className="text-white">{validPlayers.find(p => p.id === activeConfigPlayerId)?.name}</strong></h4>
                                    </div>
                                    <div className="flex gap-3 mb-3 shrink-0">
                                        <Button variant={configs[activeConfigPlayerId]?.mode === 'walkin' ? 'default' : 'outline'} className="flex-1 h-10 uppercase text-xs font-bold gap-2 border-2" onClick={() => handleSetPlayerMode(activeConfigPlayerId, 'walkin')}><Gamepad2 className="h-4 w-4" /> QUICK PLAY</Button>
                                        <Button variant={configs[activeConfigPlayerId]?.mode === 'recharge' ? 'default' : 'outline'} className="flex-1 h-10 uppercase text-xs font-bold gap-2 border-2" onClick={() => handleSetPlayerMode(activeConfigPlayerId, 'recharge')}><Zap className="h-4 w-4" /> RECHARGE</Button>
                                    </div>
                                    <ScrollArea className="flex-1 bg-zinc-950/60 rounded-xl border border-zinc-800 min-h-0">
                                        <div className="p-2.5 space-y-2.5 pb-12 font-body">
                                            {configs[activeConfigPlayerId]?.mode === 'recharge' ? (
                                                <div className="space-y-4">
                                                    {(() => {
                                                        const activeRecharges = getMemberActiveRecharges(activeConfigPlayerId);
                                                        const totalBalance = activeRecharges.reduce((sum, r) => sum + r.remainingDuration, 0);
                                                        const isSelected = configs[activeConfigPlayerId]?.rechargeId === 'pool';
                                                        if (totalBalance <= 0) return null;
                                                        return (
                                                             <div className={cn("p-4 rounded-xl border-2 bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/30 transition-all shadow-md", isSelected ? "border-yellow-500 ring-2 ring-yellow-500/20" : "border-yellow-500/10")}>
                                                                 <div className="flex justify-between items-center">
                                                                     <div className="min-w-0">
                                                                         <p className="text-xs font-bold uppercase text-yellow-500/80 tracking-normal">TOTAL COMBINED BALANCE</p>
                                                                         <div className="flex items-center gap-2 text-2xl font-bold text-yellow-500 font-mono tracking-tight"><Zap className="h-5 w-5 fill-current" /> {formatPackageDuration(totalBalance)}</div>
                                                                     </div>
                                                                     {!isSelected ? (
                                                                         <Button size="sm" onClick={() => handlePickConfig(activeConfigPlayerId, 'pool', true)} className="h-9 px-5 text-xs font-bold bg-yellow-500 text-black uppercase shadow-lg hover:bg-yellow-600">
                                                                             Use Pool
                                                                         </Button>
                                                                     ) : (
                                                                         <Badge className="bg-green-600 text-white text-xs font-bold uppercase h-6 shadow-sm">
                                                                             <CheckCircle2 className="h-4 w-4 mr-1.5"/> Selected
                                                                         </Badge>
                                                                     )}
                                                                 </div>

                                                                 {isSelected && (
                                                                     <div className="mt-4 pt-4 border-t border-yellow-500/20 space-y-3 animate-in slide-in-from-top-2 duration-300">
                                                                         <p className="text-xs font-bold uppercase text-yellow-500/80 tracking-normal px-1">Duration to Deduct</p>
                                                                         <div className="grid grid-cols-4 gap-1.5">
                                                                             {[1800, 3600, 7200].map(s => {
                                                                                 const isCurrent = configs[activeConfigPlayerId].reminderDuration === s;
                                                                                 return (
                                                                                     <Button 
                                                                                         key={s} 
                                                                                         variant="outline" 
                                                                                         size="sm" 
                                                                                         className={cn(
                                                                                             "h-8 text-xs font-bold border-yellow-500/20 text-yellow-500 hover:bg-yellow-500 hover:text-black transition-all",
                                                                                             isCurrent && "bg-yellow-500 text-black border-yellow-500"
                                                                                         )}
                                                                                         onClick={() => handleSetPoolDuration(activeConfigPlayerId, s)}
                                                                                         disabled={s > totalBalance}
                                                                                     >
                                                                                         {formatPackageDuration(s)}
                                                                                     </Button>
                                                                                 );
                                                                             })}
                                                                             <Button 
                                                                                 variant="outline" 
                                                                                 size="sm" 
                                                                                 className={cn(
                                                                                     "h-8 text-xs font-bold border-yellow-500/20 text-yellow-500 hover:bg-yellow-500 hover:text-black transition-all",
                                                                                     configs[activeConfigPlayerId].reminderDuration === totalBalance && "bg-yellow-500 text-black border-yellow-500"
                                                                                 )}
                                                                                 onClick={() => handleSetPoolDuration(activeConfigPlayerId, totalBalance)}
                                                                             >
                                                                                 FULL
                                                                             </Button>
                                                                         </div>
                                                                     </div>
                                                                 )}
                                                             </div>
                                                        );
                                                    })()}
                                                    <div className="space-y-2.5">
                                                        <p className="text-xs font-bold uppercase text-zinc-400 px-1 tracking-normal">INDIVIDUAL PACKS</p>
                                                        {getMemberActiveRecharges(activeConfigPlayerId).map((r, rIdx) => {
                                                            const isSelected = configs[activeConfigPlayerId]?.rechargeId === r.id;
                                                            return (
                                                                <div 
                                                                    key={`${r.id}-${rIdx}`} 
                                                                    className={cn(
                                                                        "p-3 rounded-lg border-2 transition-all", 
                                                                        isSelected 
                                                                            ? "border-primary bg-primary/10 ring-1 ring-primary shadow-md" 
                                                                            : "border-zinc-800 bg-zinc-900 opacity-70 hover:opacity-100"
                                                                    )}
                                                                >
                                                                    <div className="flex justify-between items-center">
                                                                        <div className="min-w-0">
                                                                            <p className="text-xs font-bold uppercase truncate text-white">{r.packageName}</p>
                                                                            <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase mt-0.5"><Clock className="h-3 w-3" /> {formatPackageDuration(r.remainingDuration)} LEFT</div>
                                                                        </div>
                                                                        <Button size="sm" variant="ghost" onClick={() => handlePickConfig(activeConfigPlayerId, r, true)} className="h-7 px-3 text-xs font-bold uppercase hover:bg-primary/10">Select</Button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <div className="pt-3">
                                                        <p className="text-xs font-bold uppercase text-zinc-500 text-center mb-3 tracking-normal border-t border-zinc-800 pt-3">--- BUY NEW PACK ---</p>
                                                        <div className="space-y-2">
                                                             {rechargePackages.map(pkg => {
                                                                const isSelected = configs[activeConfigPlayerId]?.packageId === pkg.id && configs[activeConfigPlayerId]?.mode === 'buy-recharge';
                                                                return (
                                                                    <div 
                                                                        key={pkg.id} 
                                                                        onClick={() => handlePickConfig(activeConfigPlayerId, pkg, false, true)} 
                                                                        className={cn(
                                                                            "p-3 rounded-xl border-2 border-dashed transition-all cursor-pointer flex justify-between items-center shadow-sm group",
                                                                            isSelected 
                                                                                ? "border-yellow-500 bg-yellow-500/10 ring-1 ring-yellow-500 shadow-md" 
                                                                                : "border-zinc-800 bg-zinc-900 hover:border-yellow-500/50"
                                                                        )}
                                                                    >
                                                                        <div className="min-w-0">
                                                                            <div className="flex items-center gap-2">
                                                                                <p className={cn("text-xs font-bold uppercase truncate text-white group-hover:text-yellow-400", isSelected && "text-yellow-400 font-bold")}>{pkg.name}</p>
                                                                                {isSelected && (
                                                                                    <Badge className="h-4 px-1.5 text-[9px] bg-emerald-500 text-white font-bold uppercase flex items-center gap-1">
                                                                                        <CheckCircle2 className="h-2.5 w-2.5" /> SELECTED
                                                                                    </Badge>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                                <p className="text-xs font-bold text-zinc-400 uppercase">{formatPackageDuration(pkg.duration)} &bull; {pkg.validity} Days</p>
                                                                            </div>
                                                                        </div>
                                                                        <span className={cn(
                                                                            "text-xs font-bold transition-colors",
                                                                            isSelected ? "text-yellow-400 font-bold" : "text-primary"
                                                                        )}>
                                                                            ₹{pkg.price}
                                                                        </span>
                                                                    </div>
                                                                );
                                                             })}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : configs[activeConfigPlayerId]?.mode === 'walkin' ? (
                                                <div className="space-y-2.5">
                                                    {walkInPackages.map(pkg => {
                                                        const isSelected = configs[activeConfigPlayerId]?.packageId === pkg.id && configs[activeConfigPlayerId]?.mode === 'walkin';
                                                        return (
                                                            <div 
                                                                key={pkg.id} 
                                                                onClick={() => handlePickConfig(activeConfigPlayerId, pkg, false)} 
                                                                className={cn(
                                                                    "p-3.5 rounded-xl border-2 transition-all cursor-pointer group shadow-md flex justify-between items-center",
                                                                    isSelected 
                                                                        ? "border-primary bg-primary/15 ring-1 ring-primary scale-[1.01]" 
                                                                        : "border-zinc-800 bg-zinc-900/80 hover:border-primary/50"
                                                                )}
                                                            >
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className={cn(
                                                                            "text-sm font-extrabold uppercase truncate text-white group-hover:text-primary", 
                                                                            isSelected && "text-primary"
                                                                        )}>
                                                                            {pkg.name}
                                                                        </p>
                                                                        {isSelected && (
                                                                            <Badge className="h-4 px-1.5 text-[9px] bg-emerald-500 text-white font-bold uppercase flex items-center gap-1">
                                                                                <CheckCircle2 className="h-2.5 w-2.5" /> SELECTED
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs font-bold text-primary mt-1 uppercase flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {formatPackageDuration(pkg.duration)}</p>
                                                                </div>
                                                                <div className="text-right font-mono">
                                                                    <span className={cn(
                                                                        "font-bold text-base transition-colors block",
                                                                        isSelected ? "text-primary font-bold" : "text-white"
                                                                    )}>
                                                                        ₹{pkg.price * validPlayers.length}
                                                                    </span>
                                                                    {validPlayers.length > 1 && (
                                                                        <span className="text-[11px] text-zinc-400 font-semibold block">
                                                                            ₹{pkg.price} / player
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    <div className="pt-3">
                                                        <p className="text-xs font-bold uppercase text-zinc-500 text-center mb-3 tracking-normal border-t border-zinc-800 pt-3">--- CUSTOM QUICK PLAY ---</p>
                                                        <div className="p-3 rounded-xl border-2 border-dashed border-zinc-800 bg-zinc-900/60 shadow-sm space-y-3">
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div className="space-y-1">
                                                                    <Label className="text-xs font-bold uppercase text-zinc-400">Minutes</Label>
                                                                    <Input 
                                                                        type="number" 
                                                                        placeholder="e.g. 60" 
                                                                        value={customMinutes} 
                                                                        onChange={(e) => setCustomMinutes(e.target.value)}
                                                                        className="h-10 text-xs font-bold font-mono bg-zinc-950 border-zinc-800"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <Label className="text-xs font-bold uppercase text-zinc-400">Charge (₹)</Label>
                                                                    <Input 
                                                                        type="number" 
                                                                        placeholder="e.g. 100" 
                                                                        value={customPrice} 
                                                                        onChange={(e) => setCustomPrice(e.target.value)}
                                                                        className="h-10 text-xs font-bold font-mono bg-zinc-950 border-zinc-800"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <Button 
                                                                onClick={() => handlePickCustomWalkin(activeConfigPlayerId)} 
                                                                className="w-full h-10 text-xs font-bold uppercase bg-primary text-primary-foreground hover:bg-primary/90"
                                                                disabled={!customMinutes}
                                                            >
                                                                Set Custom Time
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : <div className="h-40 flex items-center justify-center opacity-40 italic text-xs font-bold uppercase tracking-normal text-center px-10 text-zinc-400">Choose a login type above</div>}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="p-4 shrink-0 bg-zinc-950 border-t border-zinc-800 flex flex-col sm:flex-row-reverse gap-3">
                        <Button 
                            onClick={handleApplyAllAndStart} 
                            disabled={!activeConfigPlayerId || !configs[activeConfigPlayerId]?.name}
                            className="flex-1 font-headline text-sm font-extrabold h-13 uppercase tracking-wide shadow-2xl transition-all active:scale-[0.98] gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            APPLY TO ALL AND START &rarr;
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={handleConfirmAll}
                            disabled={!allPlayersConfigured}
                            className="flex-1 font-headline text-sm font-extrabold h-13 uppercase tracking-wide shadow-sm transition-all active:scale-[0.98] border-2 border-zinc-700 text-white hover:bg-zinc-800"
                        >
                            START SESSION &rarr;
                        </Button>
                    </div>
                </div>
            )}
        </div>
      </DialogContent>

      {/* CONFIRM ADD GUEST MODAL */}
      <Dialog open={showGuestConfirmModal} onOpenChange={setShowGuestConfirmModal}>
        <DialogContent className="sm:max-w-md font-body border-2 border-amber-500/40 bg-zinc-950 text-white p-6 shadow-2xl rounded-2xl">
          <DialogTitle className="text-lg font-extrabold uppercase tracking-wide font-headline text-white flex items-center gap-2">
            <User className="h-5 w-5 text-amber-400" />
            Why are you adding a Guest?
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-300 leading-relaxed pt-1">
            Guests should only be used as an exception. Please specify why the customer's name/details are not being recorded:
          </DialogDescription>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirmAddGuest();
            }}
            className="space-y-4 pt-3"
          >
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-zinc-300">
                Reason for Guest Player <span className="text-primary">*</span>
              </Label>
              <Input
                autoFocus
                required
                value={guestReason}
                onChange={(e) => setGuestReason(e.target.value)}
                placeholder="e.g. Refused to give details, quick 5 min trial, employee family..."
                className="h-12 text-sm font-semibold bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:border-amber-500 rounded-xl"
              />

              {/* QUICK REASON CHIPS / PRESETS FOR FAST SELECTION */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  "Lady customer",
                  "Child customer",
                  "Refused to give details"
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setGuestReason(preset)}
                    className={cn(
                      "text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg border transition-all cursor-pointer",
                      guestReason === preset
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-sm"
                        : "bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700"
                    )}
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800/80">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowGuestConfirmModal(false)}
                className="h-11 px-4 text-xs font-extrabold uppercase border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl"
              >
                CANCEL
              </Button>
              <Button
                type="submit"
                disabled={!guestReason.trim()}
                className="h-11 px-5 text-xs font-extrabold uppercase bg-amber-500 hover:bg-amber-600 text-black shadow-lg rounded-xl gap-1.5 transition-all"
              >
                <User className="h-4 w-4" /> CONFIRM GUEST &rarr;
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DUPLICATE NAME GAMER TAG MODAL */}
      <Dialog 
        open={duplicatePromptState.isOpen} 
        onOpenChange={(open) => setDuplicatePromptState(prev => ({ ...prev, isOpen: open }))}
      >
        <DialogContent className="sm:max-w-md font-body border-2 border-amber-500/40 bg-zinc-950 text-white p-6 shadow-2xl rounded-2xl">
          <DialogTitle className="text-lg font-extrabold uppercase tracking-wide font-headline text-white flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-amber-400" />
            Duplicate Customer Name Found
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-300 leading-relaxed pt-1">
            A customer named <strong className="text-amber-400">"{duplicatePromptState.originalName}"</strong> is already registered. Enter a gamer name or handle to append to their profile:
          </DialogDescription>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirmDuplicateGamerTag();
            }}
            className="space-y-4 pt-3"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-zinc-300">
                Gamer Name / Handle <span className="text-amber-400">*</span>
              </Label>
              <Input
                autoFocus
                required
                value={duplicatePromptState.gamerTag}
                onChange={(e) => setDuplicatePromptState(prev => ({ ...prev, gamerTag: e.target.value }))}
                placeholder="e.g. Shadow, Slayer99, Jr, 07"
                className="h-12 text-base font-bold bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:border-amber-500 rounded-xl"
              />
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-400 space-y-1">
              <span className="font-bold uppercase text-[10px] text-zinc-400 block">Name Preview:</span>
              <p className="font-mono font-bold text-sm text-emerald-400">
                {duplicatePromptState.originalName} ({duplicatePromptState.gamerTag.trim() || 'GamerName'})
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800/80">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDuplicatePromptState(prev => ({ ...prev, isOpen: false }))}
                className="h-11 px-4 text-xs font-extrabold uppercase border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl"
              >
                CANCEL
              </Button>
              <Button
                type="submit"
                disabled={!duplicatePromptState.gamerTag.trim()}
                className="h-11 px-5 text-xs font-extrabold uppercase bg-amber-500 hover:bg-amber-600 text-black shadow-lg rounded-xl gap-2 transition-all"
              >
                <UserPlus className="h-4 w-4" /> SAVE WITH GAMER NAME &rarr;
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
