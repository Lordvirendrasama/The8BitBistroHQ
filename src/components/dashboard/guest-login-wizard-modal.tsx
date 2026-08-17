'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  Sparkles, Users, Phone, Gamepad2, Utensils, CheckCircle2, ChevronRight, ChevronLeft, 
  Search, UserPlus, Dice5, Coffee, RotateCcw, X, MessageSquare, PlayCircle, Plus, Loader2 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirebase } from '@/firebase/provider';
import { collection } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { addMember } from '@/firebase/firestore/members';
import { useToast } from '@/hooks/use-toast';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { Member, Station, MemberTier } from '@/lib/types';

export type ExperienceChoice = 'ps5' | 'fnb' | 'boardgame';

interface GuestLoginWizardModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  stations?: Station[];
  onOpenSelectMemberModal?: () => void;
  onOpenAddMemberModal?: () => void;
  onAssignStation: (station: Station, guestInfo: { name: string; phone: string; groupSize: string; member: Member | null; experience: ExperienceChoice }) => void;
}

export function GuestLoginWizardModal({
  isOpen,
  onOpenChange,
  stations = [],
  onAssignStation,
}: GuestLoginWizardModalProps) {
  const { db } = useFirebase();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [groupSize, setGroupSize] = useState('1');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedExperience, setSelectedExperience] = useState<ExperienceChoice>('ps5');
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  // Sub-views inside wizard
  const [showSearchDirectory, setShowSearchDirectory] = useState(false);
  const [showQuickRegister, setShowQuickRegister] = useState(false);

  // Search directory internal query
  const [directorySearchQuery, setDirectorySearchQuery] = useState('');

  // Quick register form state
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Real-time listener for all members directory
  const allMembersCollection = useMemo(() => (!db ? null : collection(db, 'members')), [db]);
  const { data: allMembers, loading: membersLoading } = useCollection<Member>(allMembersCollection);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setSelectedStation(null);
      setShowSearchDirectory(false);
      setShowQuickRegister(false);
    }
  }, [isOpen]);

  // Compute live matching members as staff types name or phone
  const matchingMembers = useMemo(() => {
    if (!allMembers || allMembers.length === 0) return [];
    const nameTerm = (customerName || '').trim().toLowerCase();
    const phoneTerm = (customerPhone || '').replace(/\D/g, '');

    if (nameTerm.length < 2 && phoneTerm.length < 3) return [];

    return allMembers
      .filter((m) => {
        const nameMatch = nameTerm.length >= 2 && m.name && m.name.toLowerCase().includes(nameTerm);
        const phoneMatch = phoneTerm.length >= 3 && m.phone && m.phone.replace(/\D/g, '').includes(phoneTerm);
        return nameMatch || phoneMatch;
      })
      .slice(0, 4);
  }, [allMembers, customerName, customerPhone]);

  // Full Directory search filter
  const directoryFilteredMembers = useMemo(() => {
    if (!allMembers || allMembers.length === 0) return [];
    const term = directorySearchQuery.trim().toLowerCase();
    if (!term) return allMembers.slice(0, 15);

    return allMembers
      .filter((m) => {
        const nameMatch = m.name && m.name.toLowerCase().includes(term);
        const phoneMatch = m.phone && m.phone.replace(/\D/g, '').includes(term);
        const usernameMatch = m.username && m.username.toLowerCase().includes(term);
        return nameMatch || phoneMatch || usernameMatch;
      })
      .slice(0, 20);
  }, [allMembers, directorySearchQuery]);

  // Filter stations based on chosen experience on Step 3
  const filteredStations = useMemo(() => {
    if (!stations || stations.length === 0) return [];
    if (selectedExperience === 'ps5') {
      return stations.filter((s) => s.type === 'ps5');
    }
    if (selectedExperience === 'boardgame') {
      return stations.filter((s) => s.type === 'boardgame');
    }
    // 'fnb' (Food and Beverage) - return all stations / dining tables
    return stations;
  }, [stations, selectedExperience]);

  if (!isOpen) return null;

  const scripts = {
    en: {
      step1: {
        tag: "STEP 1 OF 4",
        title: "Ask Customer Name",
        dialogue: '"Welcome to The 8 Bit Bistro! May I have your Name and how many people are in your group today?"',
        hint: "Type customer's name below. Any registered member will appear instantly."
      },
      step2: {
        tag: "STEP 2 OF 4",
        title: "Ask Mobile Number",
        dialogue: '"Could you please share your Mobile Number for your WhatsApp bill and member rewards?"',
        hint: "Type 10-digit mobile number for WhatsApp billing."
      },
      step3: {
        tag: "STEP 3 OF 4",
        title: "Select Experience: PS5, FnB, or Board/Retrogames",
        dialogue: '"Awesome! Are you guys here for PS5 Gaming, FnB (Food & Drinks), or Board/Retro Games today?"',
        hint: "Select 1 of the 3 experience options to proceed to seat selection."
      },
      step4: {
        tag: "STEP 4 OF 4",
        title: "Choose Table / Seat",
        dialogue: '"Great! Please pick your preferred seat/table, and we will get your session and orders started!"',
        hint: "Click on an available station or table to seat the guest and launch session."
      },
    },
    hi: {
      step1: {
        tag: "STEP 1 OF 4",
        title: "Customer Ka Name Pucho",
        dialogue: '"8 Bit Bistro me aapka welcome hai! Kya me aapka Name aur aapke sath kitne log hain, jaan sakta hu?"',
        hint: "Neeche diye gaye box me customer ka naam likhein. Match niche dikhega."
      },
      step2: {
        tag: "STEP 2 OF 4",
        title: "Mobile Number Pucho",
        dialogue: '"Kya aap apna Mobile Number share kar sakte hain, WhatsApp billing aur reward points ke liye?"',
        hint: "Billing aur rewards ke liye 10-digit phone number likhein."
      },
      step3: {
        tag: "STEP 3 OF 4",
        title: "PS5, FnB ya Board/Retrogames Choose Karo",
        dialogue: '"Bahut badiya! Aaj aap log PS5 Gaming, FnB (Food & Drinks), ya Board/Retro Games ke liye aaye hain?"',
        hint: "3 options me se 1 choose karein taaki table/seat select kar sakein."
      },
      step4: {
        tag: "STEP 4 OF 4",
        title: "Table / Seat Choose Karo",
        dialogue: '"Great! Aap apna pasandeeda table/seat choose karein, aur hum aapka session start karte hain!"',
        hint: "Available table/seat par click karein aur session start karein."
      },
    }
  };

  const activeScript = scripts[lang];

  const handleSelectMember = (member: Member) => {
    setSelectedMember(member);
    setCustomerName(member.name);
    if (member.phone) {
      setCustomerPhone(member.phone);
    }
    setShowSearchDirectory(false);
    toast({
      title: "Member Selected",
      description: `${member.name} (${member.tier || 'Member'}) has been selected.`,
    });
  };

  const handleOpenSearchDirectory = () => {
    setDirectorySearchQuery(customerName || customerPhone || '');
    setShowSearchDirectory(true);
  };

  const handleOpenQuickRegister = () => {
    setRegName(customerName || '');
    setRegPhone(customerPhone || '');
    setRegEmail('');
    setShowQuickRegister(true);
  };

  const handleExecuteQuickRegister = async () => {
    if (!regName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Name Required',
        description: 'Please enter the customer full name.',
      });
      return;
    }

    setIsRegistering(true);
    try {
      const generatedUsername = `${regName.toLowerCase().replace(/[^a-z0-9]/g, '')}${Math.floor(100 + Math.random() * 900)}`;
      const tier: MemberTier = regPhone.trim() ? 'Green' : 'Red';
      const avatarUrl = PlaceHolderImages[Math.floor(Math.random() * PlaceHolderImages.length)]?.imageUrl || 'https://picsum.photos/seed/guest/100/100';

      const newMemberData: Omit<Member, 'id'> = {
        name: regName.trim(),
        username: generatedUsername,
        phone: regPhone.trim() || undefined,
        email: regEmail.trim() || undefined,
        tier,
        level: 1,
        xp: 0,
        points: 0,
        totalSpent: 0,
        joinDate: new Date().toISOString(),
        avatarUrl,
      };

      const newId = await addMember(newMemberData);
      
      const createdMember: Member = {
        id: newId || `member-${Date.now()}`,
        ...newMemberData,
      };

      setSelectedMember(createdMember);
      setCustomerName(createdMember.name);
      if (createdMember.phone) {
        setCustomerPhone(createdMember.phone);
      }

      setShowQuickRegister(false);
      toast({
        title: "Member Registered!",
        description: `${createdMember.name} is now a registered member and selected!`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Registration Error',
        description: error.message || 'Failed to create new member.',
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setCustomerName('');
    setCustomerPhone('');
    setGroupSize('1');
    setSelectedMember(null);
    setSelectedExperience('ps5');
    setSelectedStation(null);
    setShowSearchDirectory(false);
    setShowQuickRegister(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    handleReset();
  };

  const handleConfirmStationAssignment = (station: Station) => {
    onAssignStation(station, {
      name: customerName || selectedMember?.name || 'Walk-in Guest',
      phone: customerPhone || selectedMember?.phone || '',
      groupSize,
      member: selectedMember,
      experience: selectedExperience,
    });
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      
      {/* Centered Focused Popup Box */}
      <div className="relative w-full max-w-2xl bg-zinc-950 border-2 border-primary/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="bg-zinc-900/90 border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary text-primary-foreground shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-headline text-lg sm:text-xl uppercase tracking-wider text-white">
                Guest Check-in &amp; Login Wizard
              </h2>
              <p className="text-xs font-bold uppercase text-zinc-400 tracking-wide">
                Staff Hospitality Assistant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="flex items-center bg-zinc-900 p-1 rounded-lg border border-zinc-800">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLang('en')}
                className={cn(
                  "h-7 px-3 font-bold uppercase text-xs rounded-md transition-all",
                  lang === 'en' ? "bg-primary text-primary-foreground shadow-xs" : "text-zinc-400 hover:text-white"
                )}
              >
                🇬🇧 English
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLang('hi')}
                className={cn(
                  "h-7 px-3 font-bold uppercase text-xs rounded-md transition-all",
                  lang === 'hi' ? "bg-primary text-primary-foreground shadow-xs" : "text-zinc-400 hover:text-white"
                )}
              >
                🇮🇳 Hinglish
              </Button>
            </div>

            {/* Close Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* SUB-VIEW 1: SEARCH MEMBER DIRECTORY MODAL */}
        {showSearchDirectory ? (
          <div className="p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-base uppercase text-white">Search Member Directory</h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowSearchDirectory(false)}
                className="h-8 px-3 text-xs text-zinc-400 hover:text-white uppercase font-bold"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back to Wizard
              </Button>
            </div>

            <div className="space-y-2">
              <Input
                autoFocus
                value={directorySearchQuery}
                onChange={(e) => setDirectorySearchQuery(e.target.value)}
                placeholder="Search by Name, Phone Number, or Username..."
                className="h-12 bg-zinc-900 border-2 border-zinc-700 focus:border-primary text-white text-base rounded-xl"
              />
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {directoryFilteredMembers.length > 0 ? (
                directoryFilteredMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleSelectMember(member)}
                    className="w-full p-3 rounded-xl border-2 border-zinc-800 bg-zinc-900/90 hover:border-emerald-500 hover:bg-zinc-800 text-left flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-zinc-700">
                        <AvatarImage src={member.avatarUrl} alt={member.name} />
                        <AvatarFallback className="font-bold text-xs bg-zinc-800 text-white">
                          {member.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-sm text-white">{member.name}</p>
                        <p className="text-xs font-mono text-zinc-400">{member.phone || 'No phone'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-bold uppercase",
                          member.tier === 'Gold' ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                          member.tier === 'Green' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                          "bg-red-500/20 text-red-400 border-red-500/30"
                        )}
                      >
                        {member.tier || 'Member'}
                      </Badge>
                      <Button size="sm" className="h-7 text-[11px] font-bold uppercase bg-emerald-500 hover:bg-emerald-600 text-black">
                        Select
                      </Button>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-zinc-400 text-xs bg-zinc-900 rounded-xl">
                  No members found matching "{directorySearchQuery}".
                </div>
              )}
            </div>
          </div>
        ) : showQuickRegister ? (
          /* SUB-VIEW 2: QUICK MEMBER REGISTRATION FORM */
          <div className="p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-emerald-400" />
                <h3 className="font-bold text-base uppercase text-white">Quick Member Registration</h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowQuickRegister(false)}
                className="h-8 px-3 text-xs text-zinc-400 hover:text-white uppercase font-bold"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back to Wizard
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-zinc-300">Customer Full Name *</label>
                <Input
                  autoFocus
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="h-12 bg-zinc-900 border-2 border-zinc-700 focus:border-emerald-500 text-white rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-zinc-300">Mobile Number (For WhatsApp Bill &amp; Rewards) *</label>
                <Input
                  type="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="h-12 bg-zinc-900 border-2 border-zinc-700 focus:border-emerald-500 text-white rounded-xl font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-zinc-400">Email Address (Optional)</label>
                <Input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="e.g. rahul@gmail.com"
                  className="h-12 bg-zinc-900 border-2 border-zinc-700 focus:border-emerald-500 text-white rounded-xl"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowQuickRegister(false)}
                  className="flex-1 h-12 font-bold uppercase text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={isRegistering || !regName.trim()}
                  onClick={handleExecuteQuickRegister}
                  className="flex-1 h-12 font-bold uppercase text-xs bg-emerald-500 hover:bg-emerald-600 text-black shadow-lg gap-2"
                >
                  {isRegistering ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Register &amp; Select Member
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* REGULAR WIZARD STEP-BY-STEP FLOW */
          <>
            {/* Stepper Progress Bar */}
            <div className="px-6 pt-4 pb-2 bg-zinc-900/40 border-b border-zinc-800">
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((stepNum) => {
                  const isDone = currentStep > stepNum;
                  const isActive = currentStep === stepNum;
                  const stepLabels = ["1. Name", "2. Number", "3. Experience", "4. Seat"];
                  return (
                    <button
                      key={stepNum}
                      type="button"
                      onClick={() => setCurrentStep(stepNum as 1 | 2 | 3 | 4)}
                      className="flex flex-col items-center gap-1 group text-left"
                    >
                      <div
                        className={cn(
                          "h-2 w-full rounded-full transition-all",
                          isActive
                            ? "bg-primary shadow-sm"
                            : isDone
                            ? "bg-emerald-500"
                            : "bg-zinc-800"
                        )}
                      />
                      <span
                        className={cn(
                          "text-[11px] font-bold uppercase tracking-tight",
                          isActive
                            ? "text-primary font-extrabold"
                            : isDone
                            ? "text-emerald-500"
                            : "text-zinc-500"
                        )}
                      >
                        {stepLabels[stepNum - 1]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Body: Active Step */}
            <div className="p-6 sm:p-8 space-y-6">
              
              {/* STEP 1: Customer Name */}
              {currentStep === 1 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs font-bold uppercase tracking-wider px-3 py-1">
                        <Users className="h-3.5 w-3.5 mr-1.5" />
                        {activeScript.step1.tag}
                      </Badge>
                      <span className="text-xs font-extrabold uppercase text-primary tracking-widest flex items-center gap-1.5">
                        <MessageSquare className="h-4 w-4" /> SAY THIS OUT LOUD TO GUEST:
                      </span>
                    </div>

                    {/* Big Script Text */}
                    <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900 border-2 border-primary/40 shadow-inner">
                      <h3 className="text-xl sm:text-2xl font-extrabold tracking-wide text-white leading-snug">
                        {activeScript.step1.dialogue}
                      </h3>
                    </div>
                  </div>

                  {/* Customer Name Input Box */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center justify-between">
                      <span>Type Customer's Name:</span>
                      {selectedMember && (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Member Selected ({selectedMember.tier || 'Member'})
                        </span>
                      )}
                    </label>
                    <Input 
                      autoFocus
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        if (selectedMember && selectedMember.name !== e.target.value) {
                          setSelectedMember(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setCurrentStep(2);
                        }
                      }}
                      placeholder="e.g. Rahul Sharma"
                      className="h-14 text-lg font-bold bg-zinc-900 border-2 border-zinc-700 focus:border-primary text-white px-4 rounded-xl shadow-inner placeholder:text-zinc-600"
                    />
                  </div>

                  {/* LIVE MATCHING MEMBERS SECTION */}
                  {matchingMembers.length > 0 && (
                    <div className="space-y-2 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
                      <p className="text-[11px] font-bold uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Member Match Found ({matchingMembers.length}) • Click to select:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {matchingMembers.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => handleSelectMember(member)}
                            className={cn(
                              "p-3 rounded-xl border-2 text-left flex items-center justify-between gap-3 transition-all",
                              selectedMember?.id === member.id
                                ? "border-emerald-500 bg-emerald-500/10 shadow-md ring-1 ring-emerald-500"
                                : "border-zinc-800 bg-zinc-900/80 hover:border-primary/50 hover:bg-zinc-800"
                            )}
                          >
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <Avatar className="h-9 w-9 border border-zinc-700 shrink-0">
                                <AvatarImage src={member.avatarUrl} alt={member.name} />
                                <AvatarFallback className="font-bold text-xs bg-zinc-800 text-white">
                                  {member.name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="truncate">
                                <p className="font-bold text-sm text-white truncate">{member.name}</p>
                                <p className="text-xs font-mono text-zinc-400">{member.phone || 'No phone'}</p>
                              </div>
                            </div>

                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-bold uppercase px-2 shrink-0",
                                member.tier === 'Gold'
                                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                  : member.tier === 'Green'
                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                  : "bg-red-500/20 text-red-400 border-red-500/30"
                              )}
                            >
                              {member.tier || 'Member'}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Group Size Selector */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
                    <span className="text-xs font-bold uppercase text-zinc-400">How Many People in Group?</span>
                    <div className="flex gap-1.5">
                      {['1', '2', '3', '4', '5+'].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setGroupSize(num)}
                          className={cn(
                            "h-8 w-10 rounded-lg text-xs font-bold transition-all border",
                            groupSize === num
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700"
                          )}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* STEP 2: Mobile Number */}
              {currentStep === 2 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs font-bold uppercase tracking-wider px-3 py-1">
                        <Phone className="h-3.5 w-3.5 mr-1.5" />
                        {activeScript.step2.tag}
                      </Badge>
                      <span className="text-xs font-extrabold uppercase text-emerald-400 tracking-widest flex items-center gap-1.5">
                        <MessageSquare className="h-4 w-4" /> SAY THIS OUT LOUD TO GUEST:
                      </span>
                    </div>

                    {/* Big Script Text */}
                    <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900 border-2 border-emerald-500/40 shadow-inner">
                      <h3 className="text-xl sm:text-2xl font-extrabold tracking-wide text-white leading-snug">
                        {activeScript.step2.dialogue}
                      </h3>
                    </div>
                  </div>

                  {/* Mobile Number Input Box */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center justify-between">
                      <span>Type Mobile Number (For WhatsApp Bill &amp; Points):</span>
                      {customerName && <span className="text-emerald-400 font-bold">Customer: {customerName}</span>}
                    </label>
                    <Input 
                      type="tel"
                      autoFocus
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setCurrentStep(3);
                        }
                      }}
                      placeholder="e.g. 9876543210"
                      className="h-14 text-lg font-mono font-bold bg-zinc-900 border-2 border-zinc-700 focus:border-emerald-500 text-white px-4 rounded-xl shadow-inner placeholder:text-zinc-600"
                    />
                  </div>

                  {/* LIVE MATCHING MEMBERS BY PHONE */}
                  {matchingMembers.length > 0 && (
                    <div className="space-y-2 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
                      <p className="text-[11px] font-bold uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Member Match Found ({matchingMembers.length}) • Click to select:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {matchingMembers.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => handleSelectMember(member)}
                            className={cn(
                              "p-3 rounded-xl border-2 text-left flex items-center justify-between gap-3 transition-all",
                              selectedMember?.id === member.id
                                ? "border-emerald-500 bg-emerald-500/10 shadow-md ring-1 ring-emerald-500"
                                : "border-zinc-800 bg-zinc-900/80 hover:border-primary/50 hover:bg-zinc-800"
                            )}
                          >
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <Avatar className="h-9 w-9 border border-zinc-700 shrink-0">
                                <AvatarImage src={member.avatarUrl} alt={member.name} />
                                <AvatarFallback className="font-bold text-xs bg-zinc-800 text-white">
                                  {member.name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="truncate">
                                <p className="font-bold text-sm text-white truncate">{member.name}</p>
                                <p className="text-xs font-mono text-zinc-400">{member.phone || 'No phone'}</p>
                              </div>
                            </div>

                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-bold uppercase px-2 shrink-0",
                                member.tier === 'Gold'
                                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                  : member.tier === 'Green'
                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                  : "bg-red-500/20 text-red-400 border-red-500/30"
                              )}
                            >
                              {member.tier || 'Member'}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ACTION BUTTONS FOR DIRECTORY SEARCH & QUICK REGISTER */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      onClick={handleOpenSearchDirectory}
                      className="h-12 font-bold uppercase text-xs border-2 border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-400 gap-2"
                    >
                      <Search className="h-4 w-4" />
                      <span>Search Member Directory</span>
                    </Button>

                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      onClick={handleOpenQuickRegister}
                      className="h-12 font-bold uppercase text-xs border-2 border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-400 gap-2"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>+ Quick Member Registration</span>
                    </Button>
                  </div>

                </div>
              )}

              {/* STEP 3: 3 Options: PS5, FnB, Board/Retrogames */}
              {currentStep === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs font-bold uppercase tracking-wider px-3 py-1">
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                        {activeScript.step3.tag}
                      </Badge>
                      <span className="text-xs font-extrabold uppercase text-purple-400 tracking-widest flex items-center gap-1.5">
                        <MessageSquare className="h-4 w-4" /> SAY THIS OUT LOUD TO GUEST:
                      </span>
                    </div>

                    {/* Big Script Text */}
                    <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900 border-2 border-purple-500/40 shadow-inner">
                      <h3 className="text-xl sm:text-2xl font-extrabold tracking-wide text-white leading-snug">
                        {activeScript.step3.dialogue}
                      </h3>
                    </div>
                  </div>

                  {/* 3 DISTINCT EXPERIENCE OPTIONS */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    
                    {/* OPTION 1: PS5 */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedExperience('ps5');
                        setCurrentStep(4);
                      }}
                      className={cn(
                        "p-4 rounded-xl border-2 text-left flex flex-col justify-between h-28 transition-all relative overflow-hidden group shadow-lg",
                        selectedExperience === 'ps5'
                          ? "border-purple-500 bg-purple-500/20 ring-2 ring-purple-500 shadow-purple-500/20"
                          : "border-zinc-800 bg-zinc-900/90 hover:border-purple-500/50 hover:bg-zinc-800"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-headline text-lg uppercase tracking-wide text-purple-400 font-extrabold">
                          1. PS5
                        </span>
                        <Gamepad2 className="h-6 w-6 text-purple-400 group-hover:scale-110 transition-transform" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white uppercase">Console Gaming</p>
                        <p className="text-[11px] text-zinc-400">PlayStation 5 Stations &amp; Packs</p>
                      </div>
                    </button>

                    {/* OPTION 2: FnB */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedExperience('fnb');
                        setCurrentStep(4);
                      }}
                      className={cn(
                        "p-4 rounded-xl border-2 text-left flex flex-col justify-between h-28 transition-all relative overflow-hidden group shadow-lg",
                        selectedExperience === 'fnb'
                          ? "border-amber-500 bg-amber-500/20 ring-2 ring-amber-500 shadow-amber-500/20"
                          : "border-zinc-800 bg-zinc-900/90 hover:border-amber-500/50 hover:bg-zinc-800"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-headline text-lg uppercase tracking-wide text-amber-400 font-extrabold">
                          2. FnB
                        </span>
                        <Utensils className="h-6 w-6 text-amber-400 group-hover:scale-110 transition-transform" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white uppercase">Food &amp; Beverages</p>
                        <p className="text-[11px] text-zinc-400">Cold Coffee, Snacks &amp; Drinks</p>
                      </div>
                    </button>

                    {/* OPTION 3: Board/Retrogames */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedExperience('boardgame');
                        setCurrentStep(4);
                      }}
                      className={cn(
                        "p-4 rounded-xl border-2 text-left flex flex-col justify-between h-28 transition-all relative overflow-hidden group shadow-lg",
                        selectedExperience === 'boardgame'
                          ? "border-emerald-500 bg-emerald-500/20 ring-2 ring-emerald-500 shadow-emerald-500/20"
                          : "border-zinc-800 bg-zinc-900/90 hover:border-emerald-500/50 hover:bg-zinc-800"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-headline text-lg uppercase tracking-wide text-emerald-400 font-extrabold">
                          3. Board/Retrogames
                        </span>
                        <Dice5 className="h-6 w-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white uppercase">Board &amp; Retro</p>
                        <p className="text-[11px] text-zinc-400">Table Pass, Board Games &amp; Arcade</p>
                      </div>
                    </button>

                  </div>

                </div>
              )}

              {/* STEP 4: Choose Table / Seat Based on Page 3 Selection */}
              {currentStep === 4 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={cn(
                          "text-xs font-bold uppercase tracking-wider px-3 py-1",
                          selectedExperience === 'ps5' ? "bg-purple-500/20 text-purple-400 border-purple-500/30" :
                          selectedExperience === 'fnb' ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                          "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        )}>
                          {selectedExperience === 'ps5' ? 'PS5 Stations' : selectedExperience === 'fnb' ? 'FnB Dining Tables' : 'Board / Retro Tables'}
                        </Badge>
                        <span className="text-xs font-extrabold uppercase text-primary tracking-widest flex items-center gap-1.5">
                          <MessageSquare className="h-4 w-4" /> SAY OUT LOUD:
                        </span>
                      </div>

                      <span className="text-xs font-bold text-zinc-400">
                        Guest: <span className="text-white font-extrabold">{customerName || 'Guest'}</span> ({groupSize}p)
                      </span>
                    </div>

                    {/* Big Script Text */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900 border-2 border-primary/40 shadow-inner">
                      <h3 className="text-lg sm:text-xl font-extrabold tracking-wide text-white leading-snug">
                        {activeScript.step4.dialogue}
                      </h3>
                    </div>
                  </div>

                  {/* Dynamic Seat / Table Selection Grid */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                        Select Table / Seat to Assign:
                      </label>
                      <span className="text-[11px] text-zinc-500">Tap table to confirm check-in</span>
                    </div>

                    {filteredStations.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                        {filteredStations.map((station) => {
                          const isAvailable = station.status === 'available';
                          const isSelected = selectedStation?.id === station.id;

                          return (
                            <button
                              key={station.id}
                              type="button"
                              onClick={() => setSelectedStation(station)}
                              className={cn(
                                "p-3 rounded-xl border-2 text-left flex flex-col justify-between h-24 transition-all relative",
                                isSelected
                                  ? "border-primary bg-primary/20 ring-2 ring-primary shadow-lg"
                                  : isAvailable
                                  ? "border-zinc-800 bg-zinc-900/90 hover:border-zinc-600 hover:bg-zinc-800"
                                  : "border-zinc-800/60 bg-zinc-900/40 opacity-75 hover:opacity-100"
                              )}
                            >
                              <div className="flex items-start justify-between">
                                <span className="font-bold text-sm text-white truncate pr-1">
                                  {station.name}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[9px] uppercase font-bold px-1.5 py-0 shrink-0",
                                    isAvailable
                                      ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                                      : "border-amber-500/40 text-amber-400 bg-amber-500/10"
                                  )}
                                >
                                  {isAvailable ? 'AVAILABLE' : 'IN USE'}
                                </Badge>
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                <span>{station.members?.length || 0} Players</span>
                                {isSelected ? (
                                  <CheckCircle2 className="h-4 w-4 text-primary" />
                                ) : (
                                  <PlayCircle className="h-4 w-4 text-zinc-500 opacity-50" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-6 text-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs">
                        No stations found for this category.
                      </div>
                    )}
                  </div>

                  {/* Bottom Confirm Action for Selected Seat */}
                  {selectedStation && (
                    <div className="p-3.5 rounded-xl border-2 border-primary/50 bg-primary/10 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <div>
                        <p className="text-xs uppercase font-bold text-zinc-400">Selected Station</p>
                        <p className="text-base font-extrabold text-white">{selectedStation.name} • {customerName || 'Walk-in Guest'}</p>
                      </div>

                      <Button
                        type="button"
                        onClick={() => handleConfirmStationAssignment(selectedStation)}
                        className="h-11 px-5 font-bold uppercase text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg gap-1.5"
                      >
                        <PlayCircle className="h-4 w-4" /> Start Session Now
                      </Button>
                    </div>
                  )}

                </div>
              )}

            </div>

            {/* Footer Navigation (Back / Next / Finish) */}
            <div className="px-6 py-4 bg-zinc-900/90 border-t border-zinc-800 flex items-center justify-between">
              <div>
                {currentStep > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4)}
                    className="font-bold uppercase text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="text-xs text-zinc-500 uppercase font-bold gap-1 hover:text-white"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {currentStep < 4 ? (
                  <Button
                    type="button"
                    onClick={() => setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3 | 4)}
                    className="h-11 px-6 font-bold uppercase text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg gap-1.5"
                  >
                    Next Step <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : selectedStation ? (
                  <Button
                    type="button"
                    onClick={() => handleConfirmStationAssignment(selectedStation)}
                    className="h-11 px-6 font-bold uppercase text-xs bg-emerald-500 hover:bg-emerald-600 text-black shadow-lg gap-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Assign {selectedStation.name} &amp; Launch
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleClose}
                    className="h-11 px-6 font-bold uppercase text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 shadow-md gap-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Complete &amp; Close
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

      </div>

    </div>
  );
}
