'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  Sparkles, Users, Gamepad2, Utensils, CheckCircle2, ChevronRight, ChevronLeft, 
  Search, Dice5, RotateCcw, X, MessageSquare, PlayCircle, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirebase } from '@/firebase/provider';
import { collection } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useToast } from '@/hooks/use-toast';
import type { Member, Station } from '@/lib/types';

export type ExperienceChoice = 'ps5' | 'ps4' | 'boardgame' | 'fnb';

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
  const [groupSize, setGroupSize] = useState('1');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedExperiences, setSelectedExperiences] = useState<ExperienceChoice[]>(['ps5']);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  // Sub-views inside wizard
  const [showSearchDirectory, setShowSearchDirectory] = useState(false);
  const [directorySearchQuery, setDirectorySearchQuery] = useState('');

  // Real-time listener for all members directory
  const allMembersCollection = useMemo(() => (!db ? null : collection(db, 'members')), [db]);
  const { data: allMembers } = useCollection<Member>(allMembersCollection);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setCustomerName('');
      setGroupSize('1');
      setSelectedMember(null);
      setSelectedExperiences(['ps5']);
      setSelectedStation(null);
      setShowSearchDirectory(false);
    }
  }, [isOpen]);

  // Compute live matching members as staff types name
  const matchingMembers = useMemo(() => {
    if (!allMembers || allMembers.length === 0) return [];
    const nameTerm = (customerName || '').trim().toLowerCase();

    if (nameTerm.length < 2) return [];

    return allMembers
      .filter((m) => m.name && m.name.toLowerCase().includes(nameTerm))
      .slice(0, 4);
  }, [allMembers, customerName]);

  // Directory search filter
  const directoryFilteredMembers = useMemo(() => {
    if (!allMembers || allMembers.length === 0) return [];
    const term = directorySearchQuery.trim().toLowerCase();
    if (!term) return allMembers.slice(0, 15);

    return allMembers
      .filter((m) => {
        const nameMatch = m.name && m.name.toLowerCase().includes(term);
        const usernameMatch = m.username && m.username.toLowerCase().includes(term);
        const phoneMatch = m.phone && m.phone.replace(/\D/g, '').includes(term);
        return nameMatch || usernameMatch || phoneMatch;
      })
      .slice(0, 20);
  }, [allMembers, directorySearchQuery]);

  // Filter stations based on chosen experiences on Step 3
  const filteredStations = useMemo(() => {
    if (!stations || stations.length === 0) return [];
    
    const matching = stations.filter((s) => {
      if (selectedExperiences.includes('ps5') && s.type === 'ps5') return true;
      if (selectedExperiences.includes('ps4') && s.type === 'ps4') return true;
      if (selectedExperiences.includes('boardgame') && s.type === 'boardgame') return true;
      return false;
    });

    return matching.length > 0 ? matching : stations;
  }, [stations, selectedExperiences]);

  if (!isOpen) return null;

  const scripts = {
    en: {
      step1: {
        tag: "STEP 1 OF 4",
        title: "Guest Details",
        dialogue: '"Welcome to The 8 Bit Bistro! May I have your Name and how many people are in your group today?"',
        hint: "Type customer's name below. Any registered member will appear instantly."
      },
      step2: {
        tag: "STEP 2 OF 4",
        title: "What are you here for?",
        dialogue: '"Awesome! Are you guys here for PS5, PS4, Board Games, or Cafe today?"',
        hint: "Select one or more activities to proceed to table/seat selection."
      },
      step3: {
        tag: "STEP 3 OF 4",
        title: "Select Table / Station",
        dialogue: '"Great! Please pick your preferred seat/table, and we will get your session setup!"',
        hint: "Click on an available station or table to seat the guest."
      },
      step4: {
        tag: "STEP 4 OF 4",
        title: "Confirm & Start",
        dialogue: '"All set! Review your details and let\'s start your session!"',
        hint: "Review details below and click Start Session."
      },
    },
    hi: {
      step1: {
        tag: "STEP 1 OF 4",
        title: "Guest Ki Details",
        dialogue: '"8 Bit Bistro me aapka welcome hai! Kya me aapka Name aur aapke sath kitne log hain, jaan sakta hu?"',
        hint: "Neeche diye gaye box me customer ka naam likhein."
      },
      step2: {
        tag: "STEP 2 OF 4",
        title: "Aaj kya plan hai?",
        dialogue: '"Bahut badiya! Aaj aap log PS5, PS4, Board Games, ya Cafe ke liye aaye hain?"',
        hint: "Aap multiple activities bhi select kar sakte hain."
      },
      step3: {
        tag: "STEP 3 OF 4",
        title: "Table / Seat Choose Karo",
        dialogue: '"Great! Aap apna pasandeeda table/seat choose karein!"',
        hint: "Available table/seat par click karein."
      },
      step4: {
        tag: "STEP 4 OF 4",
        title: "Session Start Karo",
        dialogue: '"Sab ready hai! Details check karein aur session start karein!"',
        hint: "Start Session button dabayein."
      },
    }
  };

  const activeScript = scripts[lang];

  const handleSelectMember = (member: Member) => {
    setSelectedMember(member);
    setCustomerName(member.name);
    setShowSearchDirectory(false);
    toast({
      title: "Member Selected",
      description: `${member.name} (${member.tier || 'Member'}) has been selected.`,
    });
  };

  const handleToggleExperience = (exp: ExperienceChoice) => {
    setSelectedExperiences((prev) => {
      if (prev.includes(exp)) {
        if (prev.length === 1) return prev; // Keep at least one selected
        return prev.filter((e) => e !== exp);
      }
      return [...prev, exp];
    });
  };

  const handleReset = () => {
    setCurrentStep(1);
    setCustomerName('');
    setGroupSize('1');
    setSelectedMember(null);
    setSelectedExperiences(['ps5']);
    setSelectedStation(null);
    setShowSearchDirectory(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    handleReset();
  };

  const handleConfirmStationAssignment = (station: Station) => {
    const primaryExp = selectedExperiences[0] || 'ps5';
    onAssignStation(station, {
      name: customerName || selectedMember?.name || 'Walk-in Guest',
      phone: selectedMember?.phone || '',
      groupSize,
      member: selectedMember,
      experience: primaryExp,
    });
    handleClose();
  };

  const formatActivitySummary = () => {
    const labels: string[] = [];
    if (selectedExperiences.includes('ps5')) labels.push('🎮 PS5');
    if (selectedExperiences.includes('ps4')) labels.push('🎮 PS4');
    if (selectedExperiences.includes('boardgame')) labels.push('🎲 Board Games');
    if (selectedExperiences.includes('fnb')) labels.push('☕ Cafe');
    return labels.join(' + ') || 'General';
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      
      {/* Centered Popup Card */}
      <div className="relative w-full max-w-2xl bg-zinc-950/95 border border-zinc-800/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-lg tracking-wide text-zinc-100 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              GUEST CHECK-IN
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="flex items-center bg-zinc-900/50 rounded-full p-0.5 border border-zinc-800/50">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={cn(
                  "px-3 py-1 text-[10px] font-bold uppercase rounded-full transition-all",
                  lang === 'en' ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('hi')}
                className={cn(
                  "px-3 py-1 text-[10px] font-bold uppercase rounded-full transition-all",
                  lang === 'hi' ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                HI
              </button>
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

        {/* SUB-VIEW: SEARCH MEMBER DIRECTORY MODAL */}
        {showSearchDirectory ? (
          <div className="p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-base uppercase text-white">Search Regular Member</h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowSearchDirectory(false)}
                className="h-8 px-3 text-xs text-zinc-400 hover:text-white uppercase font-bold"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            </div>

            <div className="space-y-2">
              <Input
                autoFocus
                value={directorySearchQuery}
                onChange={(e) => setDirectorySearchQuery(e.target.value)}
                placeholder="Search by Member Name or Username..."
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
                        <p className="text-xs text-zinc-400">{member.tier || 'Member'}</p>
                      </div>
                    </div>

                    <span className="inline-flex items-center justify-center h-7 px-3 text-[11px] font-bold uppercase bg-emerald-500 text-black rounded-md">
                      Select Member
                    </span>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-zinc-400 text-xs bg-zinc-900 rounded-xl">
                  No members found matching "{directorySearchQuery}".
                </div>
              )}
            </div>
          </div>
        ) : (
          /* REGULAR 4-STEP WIZARD FLOW */
          <>
            {/* Stepper Progress Bar */}
            <div className="px-6 pt-4 pb-0">
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((stepNum) => {
                  const isDone = currentStep > stepNum;
                  const isActive = currentStep === stepNum;
                  return (
                    <button
                      key={stepNum}
                      type="button"
                      onClick={() => setCurrentStep(stepNum as 1 | 2 | 3 | 4)}
                      className="flex-1 group"
                    >
                      <div
                        className={cn(
                          "h-1.5 w-full rounded-full transition-all duration-300",
                          isActive
                            ? "bg-primary/80"
                            : isDone
                            ? "bg-zinc-600"
                            : "bg-zinc-800/50 group-hover:bg-zinc-700"
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Body: Active Step */}
            <div className="p-6 sm:p-8 space-y-6">
              
              {/* STEP 1: Guest Name & Players */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  
                  {/* Elegant Script Typography */}
                  <div className="px-2 pb-2">
                    <p className="text-xl sm:text-2xl font-light tracking-wide text-zinc-200 leading-relaxed italic border-l-2 border-primary/40 pl-4">
                      "{activeScript.step1.dialogue}"
                    </p>
                  </div>

                  {/* Customer Name Input */}
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-zinc-400 tracking-wide">
                        Guest Name
                      </label>
                      <div className="flex items-center gap-4">
                        {selectedMember && (
                          <span className="text-emerald-400 text-xs font-medium flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Member: {selectedMember.name}
                          </span>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDirectorySearchQuery(customerName || '');
                            setShowSearchDirectory(true);
                          }}
                          className="h-6 text-xs text-zinc-500 hover:text-white px-2"
                        >
                          <Search className="h-3.5 w-3.5 mr-1.5" /> Lookup Member
                        </Button>
                      </div>
                    </div>
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
                        if (e.key === 'Enter' && customerName.trim()) {
                          setCurrentStep(2);
                        }
                      }}
                      placeholder="Enter guest name..."
                      className="h-12 text-lg bg-transparent border-0 border-b border-zinc-800 focus-visible:border-primary focus-visible:ring-0 rounded-none px-0 text-white placeholder:text-zinc-700 transition-colors"
                    />
                  </div>

                  {/* LIVE MATCHING MEMBERS BY NAME */}
                  {matchingMembers.length > 0 && (
                    <div className="space-y-2 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
                      <p className="text-[11px] font-bold uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Existing Member Found ({matchingMembers.length}) • Click to select:
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
                                <p className="text-xs text-zinc-400">{member.tier || 'Member'}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-zinc-400 tracking-wide">Group Size</span>
                      <div className="flex gap-2">
                        {['1', '2', '3', '4', '5+'].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setGroupSize(num)}
                            className={cn(
                              "h-10 w-12 rounded-lg text-sm font-medium transition-all duration-200",
                              groupSize === num
                                ? "bg-white text-black shadow-lg shadow-white/10"
                                : "bg-zinc-900/50 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                            )}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* STEP 2: What are you here for? (Multi-Select) */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  
                  {/* Elegant Script Typography */}
                  <div className="px-2 pb-2">
                    <p className="text-xl sm:text-2xl font-light tracking-wide text-zinc-200 leading-relaxed italic border-l-2 border-primary/40 pl-4">
                      "{activeScript.step2.dialogue}"
                    </p>
                  </div>

                  {/* 4 MULTI-SELECT EXPERIENCE OPTIONS */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    
                    {/* OPTION 1: PS5 Gaming */}
                    <button
                      type="button"
                      onClick={() => handleToggleExperience('ps5')}
                      className={cn(
                        "p-4 rounded-2xl text-left flex flex-col justify-between h-32 transition-all relative overflow-hidden group border",
                        selectedExperiences.includes('ps5')
                          ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                          : "border-zinc-800/50 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <span className={cn("text-base tracking-wide font-medium", selectedExperiences.includes('ps5') ? "text-primary" : "text-white")}>
                          PS5
                        </span>
                        {selectedExperiences.includes('ps5') && (
                          <div className="bg-primary text-primary-foreground rounded-full p-0.5">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                    </button>

                    {/* OPTION 2: PS4 Gaming */}
                    <button
                      type="button"
                      onClick={() => handleToggleExperience('ps4')}
                      className={cn(
                        "p-4 rounded-2xl text-left flex flex-col justify-between h-32 transition-all relative overflow-hidden group border",
                        selectedExperiences.includes('ps4')
                          ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10"
                          : "border-zinc-800/50 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <span className={cn("text-base tracking-wide font-medium", selectedExperiences.includes('ps4') ? "text-blue-400" : "text-white")}>
                          PS4
                        </span>
                        {selectedExperiences.includes('ps4') && (
                          <div className="bg-blue-500 text-white rounded-full p-0.5">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                    </button>

                    {/* OPTION 3: Board Games */}
                    <button
                      type="button"
                      onClick={() => handleToggleExperience('boardgame')}
                      className={cn(
                        "p-4 rounded-2xl text-left flex flex-col justify-between h-32 transition-all relative overflow-hidden group border",
                        selectedExperiences.includes('boardgame')
                          ? "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                          : "border-zinc-800/50 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <span className={cn("text-base tracking-wide font-medium leading-tight", selectedExperiences.includes('boardgame') ? "text-emerald-500" : "text-white")}>
                          Board Games
                        </span>
                        {selectedExperiences.includes('boardgame') && (
                          <div className="bg-emerald-500 text-black rounded-full p-0.5">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                    </button>

                    {/* OPTION 4: Cafe */}
                    <button
                      type="button"
                      onClick={() => handleToggleExperience('fnb')}
                      className={cn(
                        "p-4 rounded-2xl text-left flex flex-col justify-between h-32 transition-all relative overflow-hidden group border",
                        selectedExperiences.includes('fnb')
                          ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10"
                          : "border-zinc-800/50 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <span className={cn("text-base tracking-wide font-medium", selectedExperiences.includes('fnb') ? "text-amber-500" : "text-white")}>
                          Cafe
                        </span>
                        {selectedExperiences.includes('fnb') && (
                          <div className="bg-amber-500 text-black rounded-full p-0.5">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                    </button>

                  </div>

                </div>
              )}

              {/* STEP 3: Setup - Select Table / Seat */}
              {currentStep === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  
                  {/* Elegant Script Typography */}
                  <div className="px-2 pb-2">
                    <p className="text-xl sm:text-2xl font-light tracking-wide text-zinc-200 leading-relaxed italic border-l-2 border-primary/40 pl-4">
                      "{activeScript.step3.dialogue}"
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 pb-4">
                    <span className="text-sm font-semibold text-zinc-400 tracking-wide">
                      Select Station
                    </span>
                    <span className="text-xs font-medium text-white bg-zinc-800 px-3 py-1 rounded-full">
                      {customerName || 'Guest'} ({groupSize}p)
                    </span>
                  </div>

                  {/* Seat / Table Grid */}
                  <div className="space-y-4">

                    {filteredStations.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                        {filteredStations.map((station) => {
                          const isAvailable = station.status === 'available';
                          const isSelected = selectedStation?.id === station.id;

                          return (
                            <button
                              key={station.id}
                              type="button"
                              onClick={() => {
                                setSelectedStation(station);
                                setCurrentStep(4);
                              }}
                              className={cn(
                                "p-3 rounded-xl border-2 text-left flex flex-col justify-between h-24 transition-all relative cursor-pointer",
                                isSelected
                                  ? "border-primary bg-primary/20 ring-2 ring-primary shadow-lg"
                                  : isAvailable
                                  ? "border-zinc-800 bg-zinc-900/90 hover:border-zinc-500 hover:bg-zinc-800"
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

                              <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium">
                                <span>{station.members?.length || 0} p</span>
                                {isSelected && (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-6 text-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs">
                        No stations available for this selection.
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* STEP 4: Start - Simple Summary & 1-Click Launch */}
              {currentStep === 4 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  
                  <div className="flex items-center justify-between">
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs font-bold uppercase tracking-wider px-3 py-1">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      {activeScript.step4.tag}
                    </Badge>
                  </div>

                  {/* Summary Card */}
                  <div className="p-5 rounded-2xl bg-zinc-900 border-2 border-emerald-500/40 space-y-4 shadow-xl">
                    <h3 className="text-lg font-extrabold text-white uppercase tracking-wide border-b border-zinc-800 pb-2">
                      Session Summary
                    </h3>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs uppercase font-bold text-zinc-400">Guest Name</p>
                        <p className="text-base font-extrabold text-white">{customerName || 'Walk-in Guest'}</p>
                      </div>

                      <div>
                        <p className="text-xs uppercase font-bold text-zinc-400">Players</p>
                        <p className="text-base font-extrabold text-white">{groupSize} Person(s)</p>
                      </div>

                      <div>
                        <p className="text-xs uppercase font-bold text-zinc-400">Activities</p>
                        <p className="text-sm font-bold text-purple-400">{formatActivitySummary()}</p>
                      </div>

                      <div>
                        <p className="text-xs uppercase font-bold text-zinc-400">Assigned Station / Table</p>
                        <p className="text-base font-extrabold text-emerald-400">
                          {selectedStation ? selectedStation.name : 'Not Selected'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ONE CLEAR BUTTON: START SESSION */}
                  {selectedStation ? (
                    <Button
                      type="button"
                      onClick={() => handleConfirmStationAssignment(selectedStation)}
                      className="w-full h-14 text-base font-extrabold uppercase bg-emerald-500 hover:bg-emerald-600 text-black shadow-xl gap-2 rounded-xl transition-transform active:scale-[0.99]"
                    >
                      <PlayCircle className="h-6 w-6" /> START SESSION NOW
                    </Button>
                  ) : (
                    <div className="p-4 text-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase">
                      Please go back to Step 3 and select a station to start.
                    </div>
                  )}

                </div>
              )}

            </div>

            {/* Footer Navigation */}
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
                {currentStep === 1 && (
                  <Button
                    type="button"
                    disabled={!customerName.trim()}
                    onClick={() => setCurrentStep(2)}
                    className="h-11 px-6 font-bold uppercase text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg gap-1.5"
                  >
                    Next: Activity <ChevronRight className="h-4 w-4" />
                  </Button>
                )}

                {currentStep === 2 && (
                  <Button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="h-11 px-6 font-bold uppercase text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg gap-1.5"
                  >
                    Next: Select Station <ChevronRight className="h-4 w-4" />
                  </Button>
                )}

                {currentStep === 3 && (
                  <Button
                    type="button"
                    disabled={!selectedStation}
                    onClick={() => setCurrentStep(4)}
                    className="h-11 px-6 font-bold uppercase text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg gap-1.5"
                  >
                    Next: Review <ChevronRight className="h-4 w-4" />
                  </Button>
                )}

                {currentStep === 4 && selectedStation && (
                  <Button
                    type="button"
                    onClick={() => handleConfirmStationAssignment(selectedStation)}
                    className="h-11 px-6 font-bold uppercase text-xs bg-emerald-500 hover:bg-emerald-600 text-black shadow-lg gap-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Start Session
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
