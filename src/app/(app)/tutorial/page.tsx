'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { 
  HelpCircle, 
  Clock, 
  Gamepad2, 
  Utensils, 
  Zap, 
  FileSpreadsheet, 
  Pause, 
  Play,
  StopCircle, 
  PlusCircle, 
  ArrowRightLeft, 
  LogOut, 
  Receipt,
  Search,
  Gift,
  Plane,
  MousePointerClick,
  CheckCircle2,
  Sparkles,
  Users,
  User,
  UserPlus,
  UserPlus2
} from 'lucide-react';

export default function TutorialPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('shift');
  const [stepIndex, setStepIndex] = useState(0);
  
  const defaultSimulatedState = {
    // Tab 1
    pinEntered: false,
    // Tab 2
    searchVal: '',
    passType: 'MEMBER',
    selectedPackage: '',
    // Tab 3
    timerText: '59:48',
    timerStatus: 'IN USE',
    timerStatusColor: 'emerald',
    playersCount: 0,
    stationName: 'PS5 1',
    // Tab 4
    discountApplied: false,
  };
  const [simulatedState, setSimulatedState] = useState(defaultSimulatedState);

  const handleLaunchLiveTour = () => {
    if (activeTab === 'shift') {
      if (stepIndex === 3) {
        router.push('/profile?tour=leaves');
      } else {
        router.push('/profile?tour=shift');
      }
    } else if (activeTab === 'checkin') {
      router.push('/dashboard?tour=checkin');
    } else if (activeTab === 'controls') {
      router.push('/dashboard?tour=controls');
    } else if (activeTab === 'food') {
      router.push('/dashboard?tour=checkout');
    } else if (activeTab === 'credits') {
      router.push('/dashboard?tour=perks');
    }
  };

  // -------------------------------------------------------------
  // TAB 1: Shift Lifecycle Steps
  // -------------------------------------------------------------
  const shiftSteps = [
    {
      title: "1. PIN Verification Login",
      desc: "Type your username and 4-digit PIN into the login console to verify authorization.",
      highlight: "pin-pad",
      actionText: "Click the 'OK' button on the PIN pad to simulate login.",
      postActionDesc: "PIN verified successfully. Access granted to Bistro OS."
    },
    {
      title: "2. Initialize Shift Timer",
      desc: "Click 'Initialize Shift' to start your duty cycle. Bistro OS starts tracking shift duration.",
      highlight: "init-btn",
      actionText: "Click the 'Initialize Shift' button.",
      postActionDesc: "Shift initialized! Your duty hours are now being recorded."
    },
    {
      title: "3. Shift Checkout Settlement",
      desc: "At the end of the day, audit registers. Count physical cash, enter UPI collections, and log expenses.",
      highlight: "settle-form",
      actionText: "Click 'Settle Drawer & Log Out' to complete.",
      postActionDesc: "Cash drawer settled and variances verified. Shift ended safely."
    },
    {
      title: "4. Apply for Leave (PTO)",
      desc: "Submit casual, sick, or paid leave applications and track roster approval outcomes.",
      highlight: "leaves-form",
      actionText: "Click 'Submit Leave Request' to finish this tutorial flow.",
      postActionDesc: "Leave request submitted to the owner for approval."
    }
  ];

  // -------------------------------------------------------------
  // TAB 2: Player Check-In Steps
  // -------------------------------------------------------------
  const checkinSteps = [
    {
      title: "1. Member Search & Selection",
      desc: "Search database profiles by typing usernames or display names.",
      highlight: "search-box",
      actionText: "Click the search box to simulate finding a player.",
      postActionDesc: "The system found 'John Doe (VIP)' and loaded their profile."
    },
    {
      title: "2. Toggle Pass Classifications",
      desc: "Assign a standard 'MEMBER' pass to load billing rates or tap 'GUEST' to bypass.",
      highlight: "toggle-btn",
      actionText: "Click the 'GUEST' button.",
      postActionDesc: "Pass classification switched to GUEST, loading guest pricing rates."
    },
    {
      title: "3. Choose Pricing Package",
      desc: "Select a package slot (e.g. 1 hour, half hour, or special promotions).",
      highlight: "package-list",
      actionText: "Click the '1 HOUR (1H)' package to select it.",
      postActionDesc: "1 Hour package selected. ₹150 will be tracked in the session ledger."
    },
    {
      title: "4. Start Session",
      desc: "Tap 'Start Session' to configure active timers and assign the station.",
      highlight: "start-btn",
      actionText: "Click 'START SESSION' to finalize check-in.",
      postActionDesc: "Session started successfully! The console timer is now active."
    }
  ];

  // -------------------------------------------------------------
  // TAB 3: Station Controls Steps
  // -------------------------------------------------------------
  const controlsSteps = [
    {
      title: "1. Session Pause Control",
      desc: "Freeze active timers by clicking 'Pause'. Stops time deductions.",
      highlight: "pause-btn",
      actionText: "Click 'PAUSE'.",
      postActionDesc: "Timer paused. The display turns yellow and deductions freeze."
    },
    {
      title: "2. Adjust Time Balance",
      desc: "Add or reduce play duration using the 'Time' tool.",
      highlight: "time-btn",
      actionText: "Click 'TIME'.",
      postActionDesc: "Added 30 minutes! Timer balance updated to 01:29:48."
    },
    {
      title: "3. Join / Multiplayer Add-on",
      desc: "Add co-players (up to 4 members) to a console. Splits time accounting.",
      highlight: "join-btn",
      actionText: "Click 'JOIN'.",
      postActionDesc: "Player added! Station now reads '2 PLAYERS' and costs will split."
    },
    {
      title: "4. Move Session Roster",
      desc: "Click 'Move' to shift active sessions to another console.",
      highlight: "move-btn",
      actionText: "Click 'MOVE'.",
      postActionDesc: "Session moved successfully from PS5 1 to PS5 2."
    },
    {
      title: "5. Stop All (Session End)",
      desc: "Shut down active sessions. Triggers time checkout settlement.",
      highlight: "stop-btn",
      actionText: "Click 'STOP ALL'.",
      postActionDesc: "All players stopped. Generating final bill..."
    }
  ];

  // -------------------------------------------------------------
  // TAB 4: Food Orders & Invoicing Steps
  // -------------------------------------------------------------
  const foodSteps = [
    {
      title: "1. Add Food Items",
      desc: "Click 'Food' on a station card to open the kitchen cart. Adjust quantities directly.",
      highlight: "food-drawer",
      actionText: "Click 'Add Items & Save'.",
      postActionDesc: "Items pushed to kitchen display and added to the station's ongoing tab."
    },
    {
      title: "2. Apply Discount Codes",
      desc: "Apply flat discount overrides for vouchers or promotional codes.",
      highlight: "discount-box",
      actionText: "Click on the Discount input to apply a voucher.",
      postActionDesc: "Voucher applied! ₹20 deducted from the total payable amount."
    },
    {
      title: "3. Checkout Bill Review",
      desc: "Review final summaries. The Bill Auditor verifies total time play packages.",
      highlight: "pay-btn",
      actionText: "Click 'CONTINUE TO PAYMENT' to settle the bill.",
      postActionDesc: "Bill confirmed. Proceeding to payment gateway."
    }
  ];

  // -------------------------------------------------------------
  // TAB 5: Recharges & Perks Steps
  // -------------------------------------------------------------
  const creditSteps = [
    {
      title: "1. Redeem Member Perks",
      desc: "Click 'Redeem Perks' to claim accumulated vouchers, rewards, or tier bonuses.",
      highlight: "perks-btn",
      actionText: "Click 'Redeem Perks'.",
      postActionDesc: "Perks scanner opened. Ready to scan member QR code."
    },
    {
      title: "2. Quick Recharge Pool",
      desc: "Recharge time balance pools for registered customer accounts.",
      highlight: "recharge-btn",
      actionText: "Click 'Quick Recharge'.",
      postActionDesc: "Recharge portal active. Awaiting payment method selection."
    }
  ];

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setStepIndex(0);
    setSimulatedState(defaultSimulatedState);
  };

  const currentSteps = 
    activeTab === 'shift' ? shiftSteps :
    activeTab === 'checkin' ? checkinSteps :
    activeTab === 'controls' ? controlsSteps :
    activeTab === 'food' ? foodSteps : creditSteps;

  const isCompleted = stepIndex >= currentSteps.length;

  // Handles clicking the interactive elements to proceed to the next step
  const advanceStep = (highlightId: string) => {
    if (!isCompleted && currentSteps[stepIndex].highlight === highlightId) {
      
      setSimulatedState(prev => {
        let nextState = { ...prev };
        
        switch (highlightId) {
          case 'pin-pad':
            nextState.pinEntered = true;
            break;
          case 'search-box':
            nextState.searchVal = 'John Doe (VIP)';
            break;
          case 'toggle-btn':
            nextState.passType = 'GUEST';
            break;
          case 'package-list':
            nextState.selectedPackage = '1H';
            break;
          case 'pause-btn':
            nextState.timerStatus = 'PAUSED';
            nextState.timerStatusColor = 'yellow';
            break;
          case 'time-btn':
            nextState.timerText = '01:29:48';
            break;
          case 'join-btn':
            nextState.playersCount = 2;
            break;
          case 'move-btn':
            nextState.stationName = 'PS5 2';
            break;
          case 'discount-box':
            nextState.discountApplied = true;
            break;
        }
        return nextState;
      });

      setStepIndex(prev => prev + 1);
    }
  };

  const getHighlightProps = (id: string, customClasses?: string) => {
    const isActive = !isCompleted && currentSteps[stepIndex].highlight === id;
    
    return {
      className: cn(
        "relative transition-all duration-300",
        isActive ? "z-10 ring-4 ring-primary ring-offset-2 ring-offset-background rounded-lg cursor-pointer shadow-lg" : "pointer-events-none",
        customClasses
      ),
      onClick: isActive ? (e: React.MouseEvent) => { e.stopPropagation(); advanceStep(id); } : undefined
    };
  };

  const InteractivePointer = ({ id, position = 'bottom' }: { id: string, position?: 'top' | 'bottom' | 'left' | 'right' }) => {
    const isActive = !isCompleted && currentSteps[stepIndex].highlight === id;
    if (!isActive) return null;

    const positions = {
      top: "bottom-full mb-2 left-1/2 -translate-x-1/2 flex-col-reverse",
      bottom: "top-full mt-2 left-1/2 -translate-x-1/2 flex-col",
      left: "right-full mr-2 top-1/2 -translate-y-1/2 flex-row-reverse",
      right: "left-full ml-2 top-1/2 -translate-y-1/2 flex-row"
    };

    return (
      <div className={cn("absolute z-50 flex items-center justify-center animate-bounce gap-1 pointer-events-none", positions[position])}>
        {position === 'bottom' && <MousePointerClick className="h-6 w-6 text-primary drop-shadow-[0_0_10px_rgba(236,72,153,1)]" />}
        {position === 'top' && <MousePointerClick className="h-6 w-6 text-primary drop-shadow-[0_0_10px_rgba(236,72,153,1)] rotate-180" />}
        {position === 'left' && <MousePointerClick className="h-6 w-6 text-primary drop-shadow-[0_0_10px_rgba(236,72,153,1)] rotate-90" />}
        {position === 'right' && <MousePointerClick className="h-6 w-6 text-primary drop-shadow-[0_0_10px_rgba(236,72,153,1)] -rotate-90" />}
        <Badge className="bg-primary text-primary-foreground font-bold uppercase tracking-wider text-[10px] whitespace-nowrap shadow-lg">Click Here</Badge>
      </div>
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8 font-body">
      <div>
        <div className="flex items-center gap-3">
          <HelpCircle className="h-9 w-9 text-primary animate-pulse" />
          <h1 className="font-headline text-3xl sm:text-4xl tracking-wider text-foreground">POS Tutorial</h1>
        </div>
        <p className="mt-1 sm:mt-2 text-sm text-muted-foreground uppercase font-bold tracking-normal opacity-60">
          Interactive POS & Terminal Walkthrough for Staff.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="flex flex-row overflow-x-auto justify-start items-center border-b border-zinc-800 bg-transparent rounded-none h-auto w-full p-0 gap-6 scrollbar-none mb-6">
          <TabsTrigger value="shift" className="bg-transparent hover:text-primary data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-1 py-3 text-xs font-bold uppercase tracking-wider transition-all h-auto shadow-none">Roster & Shift</TabsTrigger>
          <TabsTrigger value="checkin" className="bg-transparent hover:text-primary data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-1 py-3 text-xs font-bold uppercase tracking-wider transition-all h-auto shadow-none">Check-in System</TabsTrigger>
          <TabsTrigger value="controls" className="bg-transparent hover:text-primary data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-1 py-3 text-xs font-bold uppercase tracking-wider transition-all h-auto shadow-none">Station Controls</TabsTrigger>
          <TabsTrigger value="food" className="bg-transparent hover:text-primary data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-1 py-3 text-xs font-bold uppercase tracking-wider transition-all h-auto shadow-none">Food & Checkout</TabsTrigger>
          <TabsTrigger value="credits" className="bg-transparent hover:text-primary data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-1 py-3 text-xs font-bold uppercase tracking-wider transition-all h-auto shadow-none">Perks & Recharges</TabsTrigger>
        </TabsList>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4">
          
          {/* Left panel: Steps Selector Guide */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="border bg-card shadow-sm">
              <CardHeader className="p-4 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" /> Operational Guide
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="pb-3 border-b border-dashed border-border">
                  <Button
                    onClick={handleLaunchLiveTour}
                    className="w-full bg-primary hover:bg-primary/90 font-bold uppercase text-xs h-10 shadow-sm"
                  >
                    <Play className="h-4 w-4 mr-1.5 fill-current" /> Start Live Application Tour
                  </Button>
                </div>
                
                {isCompleted ? (
                  <div className="text-center py-8 space-y-3 animate-in fade-in zoom-in duration-500">
                    <Sparkles className="h-12 w-12 text-yellow-500 mx-auto" />
                    <h3 className="text-lg font-headline text-primary uppercase">Tutorial Completed!</h3>
                    <p className="text-xs text-muted-foreground font-semibold uppercase">You have successfully mastered this operational flow.</p>
                    <Button variant="outline" size="sm" onClick={() => setStepIndex(0)} className="mt-4 uppercase text-xs font-bold">
                      Restart Tutorial
                    </Button>
                  </div>
                ) : (
                  currentSteps.map((step, idx) => {
                    const isPast = idx < stepIndex;
                    const isCurrent = idx === stepIndex;
                    
                    return (
                      <div 
                        key={idx}
                        className={cn(
                          "p-3 rounded-lg border transition-all duration-300 select-none relative overflow-hidden",
                          isCurrent ? "border-primary bg-primary/5 shadow-sm" : 
                          isPast ? "border-emerald-500/30 bg-emerald-500/5 opacity-80" :
                          "border-border bg-card opacity-50"
                        )}
                      >
                        {isCurrent && (
                          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                        )}
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold border-2 shrink-0 transition-colors",
                            isCurrent ? "border-primary text-primary" : 
                            isPast ? "border-emerald-500 text-emerald-500" :
                            "border-muted-foreground/30 text-muted-foreground"
                          )}>
                            {isPast ? <CheckCircle2 className="h-3 w-3" /> : (idx + 1)}
                          </span>
                          <h4 className={cn(
                            "text-xs font-bold uppercase tracking-wider transition-colors",
                            isCurrent ? "text-primary" : 
                            isPast ? "text-emerald-500" :
                            "text-foreground"
                          )}>
                            {step.title}
                          </h4>
                        </div>
                        {isCurrent && (
                          <div className="animate-in slide-in-from-top-2 fade-in duration-300">
                            <p className="text-[11px] text-muted-foreground font-semibold uppercase leading-relaxed mt-2 pl-7">
                              {step.desc}
                            </p>
                            <div className="mt-3 pl-7 flex items-center gap-2">
                              <MousePointerClick className="h-4 w-4 text-primary animate-pulse" />
                              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{step.actionText}</span>
                            </div>
                          </div>
                        )}
                        {isPast && step.postActionDesc && (
                          <div className="mt-2 pl-7 flex items-start gap-1.5 animate-in slide-in-from-top-1 fade-in duration-300">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span className="text-[10px] font-bold text-emerald-500 uppercase leading-relaxed">{step.postActionDesc}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right panel: Standard UI mockup */}
          <div className="lg:col-span-8 flex flex-col items-center justify-center p-6 border rounded-xl bg-muted/20 relative min-h-[500px] overflow-hidden">
            
            {isCompleted ? (
              <div className="text-center animate-in zoom-in duration-500 space-y-4">
                <CheckCircle2 className="h-24 w-24 text-emerald-500 mx-auto" />
                <h2 className="text-2xl font-headline uppercase text-emerald-500 tracking-widest">Simulation Success</h2>
                <p className="text-muted-foreground text-sm font-bold uppercase">Flow Executed Flawlessly</p>
              </div>
            ) : (
              <>
                {/* TAB CONTENT: SHIFT LIFECYCLE MOCKUPS */}
                {activeTab === 'shift' && (
                  <div className="w-full max-w-sm space-y-6">
                    {stepIndex === 0 && (
                      <Card className="max-w-xs mx-auto shadow-md">
                        <CardHeader className="text-center pb-2 border-b">
                          <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">SYSTEM SECURITY</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                          <div className="h-12 bg-muted border rounded flex items-center justify-center font-mono font-bold text-xl tracking-widest text-primary">
                            {simulatedState.pinEntered ? '••••' : '    '}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center font-mono font-bold text-sm">
                            {[1,2,3,4,5,6,7,8,9].map(n => (
                              <Button key={n} variant="outline" className="py-6">{n}</Button>
                            ))}
                            <Button variant="outline" className="py-6">C</Button>
                            <Button variant="outline" className="py-6">0</Button>
                            <div {...getHighlightProps('pin-pad')}>
                              <Button className="w-full h-full py-6 font-bold" variant="default">OK</Button>
                              <InteractivePointer id="pin-pad" position="bottom" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {stepIndex === 1 && (
                      <Card className="max-w-xs mx-auto shadow-md p-6 space-y-6">
                        <div className="text-center space-y-2">
                          <Clock className="h-8 w-8 text-emerald-500 mx-auto" />
                          <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-500">START DUTY CYCLE</h4>
                        </div>
                        <div {...getHighlightProps('init-btn')}>
                          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase h-12 text-sm">
                            Initialize Shift
                          </Button>
                          <InteractivePointer id="init-btn" position="bottom" />
                        </div>
                      </Card>
                    )}

                    {stepIndex === 2 && (
                      <Card className="max-w-sm mx-auto shadow-md p-5 space-y-4">
                        <div className="flex items-center gap-2 pb-3 border-b">
                          <LogOut className="h-5 w-5 text-rose-500" />
                          <h4 className="text-sm font-bold uppercase tracking-wider text-rose-500">SHIFT SETTLEMENT</h4>
                        </div>
                        <div className="space-y-3 text-xs font-bold uppercase">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-[10px] text-muted-foreground block mb-1">Physical Cash</span>
                              <Input type="number" className="h-10 text-sm font-mono font-bold" disabled value="4080" />
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground block mb-1">UPI Collected</span>
                              <Input type="number" className="h-10 text-sm font-mono font-bold" disabled value="1375" />
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block mb-1">Drawer Expense</span>
                            <Input type="number" className="h-10 text-sm font-mono font-bold" disabled value="120" />
                          </div>
                        </div>
                        <div {...getHighlightProps('settle-form', 'mt-4')}>
                          <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase h-12 text-sm">
                            Settle Drawer & Log Out
                          </Button>
                          <InteractivePointer id="settle-form" position="bottom" />
                        </div>
                      </Card>
                    )}

                    {stepIndex === 3 && (
                      <Card className="max-w-sm mx-auto shadow-md p-5 space-y-4">
                        <div className="flex items-center gap-2 pb-3 border-b">
                          <Plane className="h-5 w-5 text-primary" />
                          <h4 className="text-sm font-bold uppercase tracking-wider text-primary">FILE LEAVE REQUEST</h4>
                        </div>
                        <div className="space-y-3 text-xs font-bold uppercase">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-[10px] text-muted-foreground block mb-1">Start Date</span>
                              <Input type="date" className="h-10 text-sm font-mono font-bold" disabled value="2026-07-20" />
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground block mb-1">End Date</span>
                              <Input type="date" className="h-10 text-sm font-mono font-bold" disabled value="2026-07-22" />
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block mb-1">Leave Reason</span>
                            <Input className="h-10 text-sm font-bold" disabled value="Medical checkup" />
                          </div>
                        </div>
                        <div {...getHighlightProps('leaves-form', 'mt-4')}>
                          <Button className="w-full font-bold uppercase h-12 text-sm">
                            Submit Leave Request
                          </Button>
                          <InteractivePointer id="leaves-form" position="bottom" />
                        </div>
                      </Card>
                    )}
                  </div>
                )}

                {/* TAB CONTENT: PLAYER CHECK-IN (Standard UI Match) */}
                {activeTab === 'checkin' && (
                  <div className="w-full max-w-md">
                    {/* The Check-in modal uses a standard DialogContent design which looks like a white/black card depending on theme */}
                    <div className="border bg-background rounded-lg shadow-lg p-6 space-y-6">
                      <div className="flex flex-col space-y-1.5 pb-4 border-b">
                        <h2 className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2">
                          <UserPlus className="h-5 w-5" />
                          Assign Players
                        </h2>
                        <p className="text-sm text-muted-foreground">Select member profiles or assign a guest pass to activate the console timer.</p>
                      </div>

                      <div className="space-y-5">
                        {/* Search Input */}
                        <div {...getHighlightProps('search-box')}>
                          <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                              placeholder="Search by username, phone, or name..." 
                              className="pl-8" 
                              disabled={stepIndex !== 0} 
                              value={simulatedState.searchVal}
                              readOnly
                            />
                          </div>
                          <InteractivePointer id="search-box" position="right" />
                        </div>

                        {/* Guest/Member Toggle */}
                        <div {...getHighlightProps('toggle-btn')}>
                          <div className="flex gap-2">
                            <Button 
                              variant={simulatedState.passType === 'MEMBER' ? 'default' : 'outline'}
                              className="flex-1 uppercase text-sm font-bold gap-2" 
                              disabled={stepIndex !== 1}
                            >
                              <User className="h-4 w-4" /> MEMBER
                            </Button>
                            <Button 
                              variant={simulatedState.passType === 'GUEST' ? 'default' : 'outline'}
                              className="flex-1 uppercase text-sm font-bold gap-2" 
                              disabled={stepIndex !== 1}
                            >
                              <UserPlus2 className="h-4 w-4" /> GUEST
                            </Button>
                          </div>
                          <InteractivePointer id="toggle-btn" position="right" />
                        </div>

                        {/* Package List */}
                        <div className="space-y-3 pt-2 border-t">
                          <p className="text-sm font-bold uppercase text-muted-foreground">Select Package</p>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between border bg-muted/5 p-3 rounded-lg opacity-60">
                              <span className="text-sm font-bold uppercase">HALF AN HOUR (30M)</span>
                              <span className="font-mono text-sm">₹75</span>
                            </div>
                            <div {...getHighlightProps('package-list')}>
                              <div className={cn("flex items-center justify-between border p-3 rounded-lg transition-all", simulatedState.selectedPackage === '1H' ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/50 bg-background")}>
                                <span className="text-sm font-bold uppercase">1 HOUR (1H)</span>
                                <span className="font-mono text-sm font-bold">₹150</span>
                              </div>
                              <InteractivePointer id="package-list" position="left" />
                            </div>
                          </div>
                        </div>

                        {/* Start Button */}
                        <div {...getHighlightProps('start-btn', 'mt-6 pt-4')}>
                          <Button className="w-full font-bold uppercase">
                            Start Session
                          </Button>
                          <InteractivePointer id="start-btn" position="bottom" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB CONTENT: ACTIVE STATION CONTROLS (Standard UI Match) */}
                {activeTab === 'controls' && (
                  <div className="w-full max-w-sm">
                    <Card className="shadow-sm font-body">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold uppercase flex items-center gap-2">
                          <Gamepad2 className="h-4 w-4" /> 
                          {simulatedState.stationName}
                        </CardTitle>
                        <Badge className={cn("font-bold uppercase text-[10px]", 
                          simulatedState.timerStatusColor === 'emerald' ? "bg-emerald-500 text-white hover:bg-emerald-600" :
                          simulatedState.timerStatusColor === 'yellow' ? "bg-amber-500 text-white hover:bg-amber-600" :
                          "bg-rose-500 text-white hover:bg-rose-600"
                        )}>
                          {simulatedState.timerStatus}
                        </Badge>
                      </CardHeader>

                      <CardContent>
                        <div className="text-center py-4 space-y-1 transition-all">
                          <p className={cn("text-5xl font-mono font-bold tracking-tight transition-colors", simulatedState.timerStatus === 'PAUSED' ? "text-amber-500" : "text-primary")}>{simulatedState.timerText}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{simulatedState.timerStatus === 'PAUSED' ? 'TIMER FROZEN' : 'REMAINING TIME'}</p>
                          
                          {simulatedState.playersCount > 0 && (
                            <div className="flex justify-center mt-2 animate-in fade-in zoom-in">
                              <Badge variant="outline" className="text-xs bg-muted"><Users className="h-3 w-3 mr-1" /> {simulatedState.playersCount} PLAYERS</Badge>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-4">
                          <div {...getHighlightProps('pause-btn')}>
                            <Button variant={simulatedState.timerStatus === 'PAUSED' ? 'default' : 'outline'} className="w-full text-xs font-bold uppercase">
                              {simulatedState.timerStatus === 'PAUSED' ? <Play className="h-3 w-3 mr-1" /> : <Pause className="h-3 w-3 mr-1" />} 
                              {simulatedState.timerStatus === 'PAUSED' ? 'RESUME' : 'PAUSE'}
                            </Button>
                            <InteractivePointer id="pause-btn" position="bottom" />
                          </div>
                          
                          <div {...getHighlightProps('time-btn')}>
                            <Button variant="outline" className="w-full text-xs font-bold uppercase">
                              <Clock className="h-3 w-3 mr-1" /> TIME
                            </Button>
                            <InteractivePointer id="time-btn" position="bottom" />
                          </div>
                          
                          <div {...getHighlightProps('join-btn')}>
                            <Button variant="outline" className="w-full text-xs font-bold uppercase">
                              <PlusCircle className="h-3 w-3 mr-1" /> JOIN
                            </Button>
                            <InteractivePointer id="join-btn" position="bottom" />
                          </div>
                          
                          <div {...getHighlightProps('move-btn')}>
                            <Button variant="outline" className="w-full text-xs font-bold uppercase">
                              <ArrowRightLeft className="h-3 w-3 mr-1" /> MOVE
                            </Button>
                            <InteractivePointer id="move-btn" position="bottom" />
                          </div>
                          
                          <div {...getHighlightProps('stop-btn', 'col-span-2')}>
                            <Button variant="destructive" className="w-full text-xs font-bold uppercase">
                              <StopCircle className="h-3 w-3 mr-1" /> STOP ALL
                            </Button>
                            <InteractivePointer id="stop-btn" position="bottom" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* TAB CONTENT: FOOD DRAWER & CHECKOUT (Standard UI Match) */}
                {activeTab === 'food' && (
                  <div className="w-full max-w-sm space-y-6">
                    {stepIndex === 0 && (
                      <Card className="max-w-xs mx-auto shadow-md p-5 space-y-4">
                        <div className="flex items-center gap-2 pb-3 border-b font-semibold text-sm">
                          <Utensils className="h-4 w-4 text-primary" />
                          FOOD DRAWER
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between border bg-muted/20 p-2.5 rounded-lg">
                            <span className="font-semibold">Cold Coffee (Bev)</span>
                            <span className="font-bold text-primary font-mono text-[11px]">₹120 x 1</span>
                          </div>
                          <div className="flex items-center justify-between border bg-muted/20 p-2.5 rounded-lg">
                            <span className="font-semibold">Salted Fries (Snack)</span>
                            <span className="font-bold text-primary font-mono text-[11px]">₹80 x 1</span>
                          </div>
                        </div>
                        <div {...getHighlightProps('food-drawer', 'mt-4')}>
                          <Button className="w-full font-bold text-xs h-10">
                            Add Items & Save
                          </Button>
                          <InteractivePointer id="food-drawer" position="bottom" />
                        </div>
                      </Card>
                    )}

                    {(stepIndex === 1 || stepIndex === 2) && (
                      <div className="border bg-background rounded-lg shadow-lg p-6 space-y-5">
                        <div className="flex flex-col space-y-1.5 pb-4 border-b">
                          <h2 className="text-lg font-semibold leading-none tracking-tight flex items-center justify-between">
                            <span className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /> Bill Review</span>
                            <Badge variant="outline" className="text-[10px] font-normal">PS5 1</Badge>
                          </h2>
                          <p className="text-sm text-muted-foreground">Verify charges and proceed to final payment settlement.</p>
                        </div>
                        
                        <div className="space-y-2 border rounded-lg p-4 bg-muted/10">
                          <p className="text-xs text-muted-foreground font-semibold mb-2">Auditor Summary</p>
                          <div className="space-y-2 font-mono text-xs">
                            <div className="flex justify-between">
                              <span>PREPAID 1H (GUEST)</span>
                              <span>₹150</span>
                            </div>
                            <div className="flex justify-between">
                              <span>COLD COFFEE</span>
                              <span>₹120</span>
                            </div>
                            {simulatedState.discountApplied && (
                              <div className="flex justify-between text-green-600 animate-in fade-in">
                                <span>VOUCHER APPLIED</span>
                                <span>-₹20</span>
                              </div>
                            )}
                            <div className="flex justify-between border-t pt-2 text-sm font-bold mt-2">
                              <span>TOTAL PAYABLE</span>
                              <span className="text-primary">{simulatedState.discountApplied ? '₹250' : '₹270'}</span>
                            </div>
                          </div>
                        </div>

                        <div {...getHighlightProps('discount-box', 'space-y-1.5')}>
                          <span className="text-xs font-medium block">Override Discount</span>
                          <Input 
                            placeholder="Apply discount..." 
                            className="cursor-pointer pointer-events-none font-mono" 
                            readOnly 
                            value={simulatedState.discountApplied ? "20" : ""}
                          />
                          <InteractivePointer id="discount-box" position="right" />
                        </div>

                        <div {...getHighlightProps('pay-btn', 'mt-6 pt-4')}>
                          <Button className="w-full font-bold uppercase">
                            Continue to Payment ({simulatedState.discountApplied ? '₹250' : '₹270'})
                          </Button>
                          <InteractivePointer id="pay-btn" position="bottom" />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB CONTENT: PREPAID & RECHARGES (Standard UI Match) */}
                {activeTab === 'credits' && (
                  <div className="w-full max-w-sm space-y-6">
                    <Card className="shadow-md">
                      <CardHeader className="text-center pb-3 border-b">
                        <CardTitle className="text-sm font-bold text-muted-foreground uppercase">QUICK OPERATIONS</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        <div {...getHighlightProps('perks-btn')}>
                          <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase text-sm">
                            <Gift className="h-4 w-4 mr-2" /> Redeem Perks
                          </Button>
                          <InteractivePointer id="perks-btn" position="left" />
                        </div>

                        <div {...getHighlightProps('recharge-btn')}>
                          <Button className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-black font-bold uppercase text-sm">
                            <Zap className="h-4 w-4 mr-2" /> Quick Recharge
                          </Button>
                          <InteractivePointer id="recharge-btn" position="right" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Tabs>
    </div>
  );
}
