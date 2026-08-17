'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Users, Gamepad2, Sparkles, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, UserPlus, Search, Utensils, Dice5, CheckCircle2, Languages, Coffee, ExternalLink, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GreetingScriptCardProps {
  onOpenSelectMemberModal: () => void;
  onOpenAddMemberModal: () => void;
  onManagePS5: () => void;
  onManageBoardGame: () => void;
  onOpenWizardModal?: () => void;
}

export function GreetingScriptCard({
  onOpenSelectMemberModal,
  onOpenAddMemberModal,
  onManagePS5,
  onManageBoardGame,
  onOpenWizardModal,
}: GreetingScriptCardProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [isExpanded, setIsExpanded] = useState(true);

  const scripts = {
    en: {
      step1: {
        tag: "STEP 1 OF 4",
        title: "Collect Name, Phone & Group Size",
        dialogue: '"Welcome to The 8 Bit Bistro! May I have your Name, Mobile Number, and how many people are in your group today?"',
        hint: "Get the customer's name and mobile number for WhatsApp billing and account lookup."
      },
      step2: {
        tag: "STEP 2 OF 4",
        title: "Ask Experience Interest",
        dialogue: '"Awesome! Are you guys here for PS5 Gaming, Coffee & Snacks, or Board Games today?"',
        hint: "Find out what they want to do so you can guide them to the right zone."
      },
      step3: {
        tag: "STEP 3 OF 4",
        title: "Assign Station & Setup Order",
        dialogue: '"Great! Let\'s get your station or table set up with your time package and orders!"',
        hint: "Select an available PS5 console, board game table, or log initial snacks."
      },
      step4: {
        tag: "STEP 4 OF 4",
        title: "Seat & Enjoy",
        dialogue: '"You\'re all set! Head on over to your station and enjoy your time at The 8 Bit Bistro!"',
        hint: "Direct them to their station number and let them know you are here to assist."
      },
    },
    hi: {
      step1: {
        tag: "STEP 1 OF 4",
        title: "Name, Phone & Group Size",
        dialogue: '"8 Bit Bistro me aapka welcome hai! Kya me aapka Name, Mobile Number aur aapke sath kitne log hain, jaan sakta hu?"',
        hint: "Billing aur account search ke liye customer ka naam aur mobile number lein."
      },
      step2: {
        tag: "STEP 2 OF 4",
        title: "Experience Interest Pucho",
        dialogue: '"Bahut badiya! Aaj aap log PS5 Gaming, Coffee & Snacks, ya Board Games ke liye aaye hain?"',
        hint: "Customer se pucho ki wo PS5 khelenge, snacks lenge ya board games."
      },
      step3: {
        tag: "STEP 3 OF 4",
        title: "Station & Order Setup",
        dialogue: '"Great! Chaliye aapka station/table set karte hain aur time package & order add karte hain!"',
        hint: "Available PS5 station ya Board Game table assign karo aur food order add karo."
      },
      step4: {
        tag: "STEP 4 OF 4",
        title: "Seat & Enjoy",
        dialogue: '"Aap bilkul set hain! Apne station par jaakar game enjoy karein! 8 Bit Bistro me aapka swagat hai!"',
        hint: "Customer ko station par bhejo aur session launch karo."
      },
    }
  };

  const activeScript = scripts[lang];

  return (
    <Card className="border-2 border-primary/30 bg-card/95 shadow-xl overflow-hidden transition-all">
      {/* Top Header Bar */}
      <div className="bg-gradient-to-r from-primary/20 via-background to-primary/10 px-4 py-2.5 flex items-center justify-between border-b-2 border-primary/20">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-headline text-sm sm:text-base tracking-wide uppercase text-foreground flex items-center gap-2">
              Customer Check-in &amp; Hospitality Assistant
            </h2>
            <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider hidden sm:block">
              Sequential 4-step hospitality guide for staff
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Full Wizard Modal Trigger Button */}
          {onOpenWizardModal && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenWizardModal}
              className="h-7 px-2.5 font-bold uppercase text-[11px] border-primary/30 text-primary hover:bg-primary/10 gap-1 hidden md:flex"
            >
              <ExternalLink className="h-3 w-3" /> Popup Wizard
            </Button>
          )}

          {/* Language Switcher */}
          <div className="flex items-center bg-muted/40 p-0.5 rounded-lg border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setLang('en')}
              className={cn(
                "h-7 px-2.5 font-bold uppercase text-xs rounded-md transition-all",
                lang === 'en' ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
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
                "h-7 px-2.5 font-bold uppercase text-xs rounded-md transition-all",
                lang === 'hi' ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              🇮🇳 Hinglish
            </Button>
          </div>

          {/* Toggle Expand/Collapse */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Sequential One-After-Another Stepped View */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4 bg-muted/5 animate-in fade-in duration-300">
          
          {/* Step Progress Indicators */}
          <div className="flex items-center justify-between gap-2 border-b pb-3">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((stepNum) => {
                const isDone = currentStep > stepNum;
                const isActive = currentStep === stepNum;
                return (
                  <button
                    key={stepNum}
                    type="button"
                    onClick={() => setCurrentStep(stepNum as 1 | 2 | 3 | 4)}
                    className={cn(
                      "h-8 px-3 rounded-lg font-bold text-xs uppercase transition-all flex items-center gap-1.5 border",
                      isActive
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : isDone
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                        : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
                    )}
                  >
                    {isDone ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : null}
                    Step {stepNum}
                  </button>
                );
              })}
            </div>

            <div className="text-xs font-mono font-bold text-muted-foreground">
              STEP {currentStep} OF 4
            </div>
          </div>

          {/* ACTIVE STEP CARD (ONE AT A TIME) */}
          <div className="transition-all duration-300">
            
            {/* STEP 1: Details & Check-in */}
            {currentStep === 1 && (
              <div className="bg-card border-2 rounded-xl p-4 sm:p-5 space-y-4 border-blue-500/40 shadow-sm animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs uppercase font-bold border-blue-500/40 text-blue-600 bg-blue-500/10 px-3 py-1">
                    <Users className="h-3.5 w-3.5 mr-1.5" />
                    {activeScript.step1.tag}: {activeScript.step1.title}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Ask name &amp; phone for WhatsApp bill</span>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-muted-foreground uppercase opacity-70">
                    🗣️ STAFF SAYS OUT LOUD TO GUEST:
                  </p>
                  <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20 italic text-sm sm:text-base font-semibold text-foreground leading-relaxed">
                    {activeScript.step1.dialogue}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={onOpenSelectMemberModal}
                      className="h-9 px-4 font-bold uppercase text-xs border-2 border-blue-500/40 hover:bg-blue-500/10 text-blue-600 gap-1.5"
                    >
                      <Search className="h-3.5 w-3.5" /> Find Member
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={onOpenAddMemberModal}
                      className="h-9 px-4 font-bold uppercase text-xs border-2 border-blue-500/40 hover:bg-blue-500/10 text-blue-600 gap-1.5"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> + New Registration
                    </Button>
                  </div>

                  <Button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="h-9 px-5 font-bold uppercase text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm gap-1.5"
                  >
                    Next: Experience Interest <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: Experience Interest */}
            {currentStep === 2 && (
              <div className="bg-card border-2 rounded-xl p-4 sm:p-5 space-y-4 border-purple-500/40 shadow-sm animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs uppercase font-bold border-purple-500/40 text-purple-600 bg-purple-500/10 px-3 py-1">
                    <Gamepad2 className="h-3.5 w-3.5 mr-1.5" />
                    {activeScript.step2.tag}: {activeScript.step2.title}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Find out their primary interest</span>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-muted-foreground uppercase opacity-70">
                    🗣️ STAFF SAYS OUT LOUD TO GUEST:
                  </p>
                  <div className="bg-purple-500/10 p-4 rounded-xl border border-purple-500/20 italic text-sm sm:text-base font-semibold text-foreground leading-relaxed">
                    {activeScript.step2.dialogue}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-lg border bg-purple-500/5 text-center flex items-center justify-center gap-1.5">
                    <Gamepad2 className="h-4 w-4 text-purple-500" />
                    <span className="text-xs font-bold uppercase">PS5 Gaming</span>
                  </div>
                  <div className="p-2.5 rounded-lg border bg-purple-500/5 text-center flex items-center justify-center gap-1.5">
                    <Coffee className="h-4 w-4 text-purple-500" />
                    <span className="text-xs font-bold uppercase">Cafe &amp; Snacks</span>
                  </div>
                  <div className="p-2.5 rounded-lg border bg-purple-500/5 text-center flex items-center justify-center gap-1.5">
                    <Dice5 className="h-4 w-4 text-purple-500" />
                    <span className="text-xs font-bold uppercase">Board Games</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentStep(1)}
                    className="font-bold uppercase text-xs gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>

                  <Button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="h-9 px-5 font-bold uppercase text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm gap-1.5"
                  >
                    Next: Station &amp; Order Setup <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: Station & Order Setup */}
            {currentStep === 3 && (
              <div className="bg-card border-2 rounded-xl p-4 sm:p-5 space-y-4 border-amber-500/40 shadow-sm animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs uppercase font-bold border-amber-500/40 text-amber-600 bg-amber-500/10 px-3 py-1">
                    <Utensils className="h-3.5 w-3.5 mr-1.5" />
                    {activeScript.step3.tag}: {activeScript.step3.title}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Select console or table number</span>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-muted-foreground uppercase opacity-70">
                    🗣️ STAFF SAYS OUT LOUD TO GUEST:
                  </p>
                  <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20 italic text-sm sm:text-base font-semibold text-foreground leading-relaxed">
                    {activeScript.step3.dialogue}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={onManagePS5}
                      className="h-9 px-4 font-bold uppercase text-xs border-2 border-amber-500/40 hover:bg-amber-500/10 text-amber-600 gap-1.5"
                    >
                      <Gamepad2 className="h-3.5 w-3.5" /> Assign PS5
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={onManageBoardGame}
                      className="h-9 px-4 font-bold uppercase text-xs border-2 border-amber-500/40 hover:bg-amber-500/10 text-amber-600 gap-1.5"
                    >
                      <Dice5 className="h-3.5 w-3.5" /> Assign Table
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentStep(2)}
                      className="font-bold uppercase text-xs gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" /> Back
                    </Button>

                    <Button
                      type="button"
                      onClick={() => setCurrentStep(4)}
                      className="h-9 px-5 font-bold uppercase text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm gap-1.5"
                    >
                      Next: Seat &amp; Enjoy <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Seat & Enjoy */}
            {currentStep === 4 && (
              <div className="bg-card border-2 rounded-xl p-4 sm:p-5 space-y-4 border-emerald-500/40 shadow-sm animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs uppercase font-bold border-emerald-500/40 text-emerald-600 bg-emerald-500/10 px-3 py-1">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    {activeScript.step4.tag}: {activeScript.step4.title}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Session started &amp; guest seated</span>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-muted-foreground uppercase opacity-70">
                    🗣️ STAFF SAYS OUT LOUD TO GUEST:
                  </p>
                  <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 italic text-sm sm:text-base font-semibold text-foreground leading-relaxed">
                    {activeScript.step4.dialogue}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentStep(3)}
                    className="font-bold uppercase text-xs gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" /> Back
                  </Button>

                  <Button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="h-9 px-6 font-bold uppercase text-xs bg-emerald-500 hover:bg-emerald-600 text-black shadow-md gap-1.5"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Complete &amp; Reset to Step 1
                  </Button>
                </div>
              </div>
            )}

          </div>

        </div>
      )}
    </Card>
  );
}
