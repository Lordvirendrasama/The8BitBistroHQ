'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ShiftTask } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Zap, 
  Coffee, 
  Sparkles, 
  Sun, 
  Moon, 
  Grid, 
  Focus, 
  ArrowRight, 
  PartyPopper,
  ShieldCheck,
  RotateCcw,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShiftTaskWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: ShiftTask[];
  onTaskToggle: (task: ShiftTask, result?: 'yes' | 'no') => Promise<void> | void;
}

export function ShiftTaskWizardModal({ isOpen, onClose, tasks, onTaskToggle }: ShiftTaskWizardModalProps) {
  const [viewMode, setViewMode] = useState<'focus' | 'grid'>('focus');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVictory, setIsVictory] = useState(false);

  // Filter tasks to relevant operational tasks
  const operationalTasks = useMemo(() => 
    tasks.filter(t => t.shiftType !== undefined || t.type === 'strategic'),
  [tasks]);

  const pendingTasks = useMemo(() => 
    operationalTasks.filter(t => !t.completed),
  [operationalTasks]);

  const completedCount = operationalTasks.length - pendingTasks.length;
  const progressPercent = operationalTasks.length > 0 
    ? Math.round((completedCount / operationalTasks.length) * 100) 
    : 100;

  // Auto-clamp current index when pending list shortens
  useEffect(() => {
    if (currentIndex >= pendingTasks.length && pendingTasks.length > 0) {
      setCurrentIndex(pendingTasks.length - 1);
    }
  }, [pendingTasks.length, currentIndex]);

  // Handle completion and trigger victory state if all tasks are finished
  useEffect(() => {
    if (operationalTasks.length > 0 && pendingTasks.length === 0 && isOpen) {
      setIsVictory(true);
      const timer = setTimeout(() => {
        setIsVictory(false);
        onClose();
      }, 1800);
      return () => clearTimeout(timer);
    } else {
      setIsVictory(false);
    }
  }, [pendingTasks.length, operationalTasks.length, isOpen, onClose]);

  const currentTask = pendingTasks[currentIndex] || pendingTasks[0];

  const handleMarkCompleteAndNext = async (task: ShiftTask) => {
    await onTaskToggle(task);
    // Index will automatically update as currentTask is removed from pendingTasks
  };

  const handleNext = () => {
    if (currentIndex < pendingTasks.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else {
      setCurrentIndex(pendingTasks.length - 1);
    }
  };

  // Helper to pick contextual icon based on task title
  const getTaskIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('coffee') || lower.includes('grinder') || lower.includes('bean')) return <Coffee className="h-6 w-6 text-amber-500" />;
    if (lower.includes('electric') || lower.includes('power') || lower.includes('light')) return <Zap className="h-6 w-6 text-yellow-500" />;
    if (lower.includes('clean') || lower.includes('table') || lower.includes('chair')) return <Sparkles className="h-6 w-6 text-blue-400" />;
    return <ShieldCheck className="h-6 w-6 text-primary" />;
  };

  const shiftType = operationalTasks[0]?.shiftType;
  const isClosing = shiftType === 'closing';

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border-2 shadow-2xl bg-card">
        {isVictory ? (
          // Victory Screen Animation
          <div className="p-10 flex flex-col items-center justify-center text-center space-y-4 animate-in zoom-in-95 duration-300">
            <div className="h-20 w-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center text-emerald-500 animate-bounce">
              <PartyPopper className="h-10 w-10" />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-headline uppercase tracking-tight text-emerald-500">All Protocols Verified!</h2>
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-normal">Great job! Your shift checklist is 100% complete.</p>
            </div>
            <Badge className="bg-emerald-600 text-white font-bold text-sm uppercase px-4 py-1">
              100% Completed
            </Badge>
          </div>
        ) : (
          <>
            {/* Modal Header & Progress */}
            <DialogHeader className="p-5 pb-3 bg-muted/20 border-b border-border/50">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {isClosing ? <Moon className="h-5 w-5 text-indigo-400" /> : <Sun className="h-5 w-5 text-amber-500" />}
                  <DialogTitle className="font-headline text-lg uppercase tracking-tight">
                    {isClosing ? 'Closing Shift Protocols' : 'Opening Shift Protocols'}
                  </DialogTitle>
                </div>

                {/* View Mode Switcher */}
                <div className="flex items-center gap-1 bg-background/80 p-1 rounded-xl border border-border/60">
                  <Button
                    size="sm"
                    variant={viewMode === 'focus' ? 'secondary' : 'ghost'}
                    className={cn("h-7 text-xs font-bold uppercase px-2.5", viewMode === 'focus' && "bg-primary text-primary-foreground shadow-sm")}
                    onClick={() => setViewMode('focus')}
                  >
                    <Focus className="h-3.5 w-3.5 mr-1" /> Focus
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    className={cn("h-7 text-xs font-bold uppercase px-2.5", viewMode === 'grid' && "bg-primary text-primary-foreground shadow-sm")}
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid className="h-3.5 w-3.5 mr-1" /> Grid
                  </Button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5 mt-3">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Progress ({completedCount} / {operationalTasks.length} Done)</span>
                  <span className="font-mono text-primary">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-2 bg-muted/50" indicatorClassName="bg-primary transition-all duration-500" />
              </div>
            </DialogHeader>

            {/* Modal Content */}
            <div className="p-6">
              {viewMode === 'focus' ? (
                /* Focus Mode (1 Task at a time) */
                currentTask ? (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center justify-between text-xs font-bold uppercase text-muted-foreground">
                      <Badge variant="outline" className="font-mono text-xs uppercase bg-primary/5 text-primary border-primary/20">
                        Task {currentIndex + 1} of {pendingTasks.length} Pending
                      </Badge>
                      <span className="text-muted-foreground">{pendingTasks.length} remaining</span>
                    </div>

                    {/* Focused Task Card */}
                    <div className="bg-muted/10 border-2 border-primary/20 rounded-2xl p-6 flex flex-col items-center text-center gap-4 relative overflow-hidden shadow-inner">
                      <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        {getTaskIcon(currentTask.name)}
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-headline text-xl text-foreground uppercase tracking-tight">{currentTask.name}</h3>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-normal">
                          Verify condition and mark completed when ready.
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                      <Button
                        size="lg"
                        className="w-full h-14 text-base font-bold uppercase tracking-normal shadow-xl bg-primary hover:bg-primary/90 flex items-center justify-center gap-2 group"
                        onClick={() => handleMarkCompleteAndNext(currentTask)}
                      >
                        <CheckCircle2 className="h-5 w-5 text-primary-foreground group-hover:scale-110 transition-transform" />
                        Mark Done & Next
                        <ArrowRight className="h-5 w-5 ml-1 group-hover:translate-x-1 transition-transform" />
                      </Button>

                      <div className="flex justify-between items-center pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pendingTasks.length <= 1}
                          className="font-bold text-xs uppercase text-muted-foreground hover:text-foreground"
                          onClick={handlePrev}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pendingTasks.length <= 1}
                          className="font-bold text-xs uppercase text-muted-foreground hover:text-foreground"
                          onClick={handleNext}
                        >
                          Skip <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-muted-foreground font-bold uppercase text-sm">
                    No pending tasks.
                  </div>
                )
              ) : (
                /* Grid Mode (Fast Multi-Check View) */
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs font-bold uppercase text-muted-foreground mb-2">
                    <span>Back-to-Back Grid View</span>
                    <span>Tap items to check off</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                    {operationalTasks.map((t, idx) => (
                      <div
                        key={`${t.name}-${idx}`}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer select-none",
                          t.completed 
                            ? "bg-emerald-500/5 border-emerald-500/20 text-muted-foreground opacity-60" 
                            : "bg-muted/10 border-border/60 hover:border-primary/40 text-foreground"
                        )}
                        onClick={() => onTaskToggle(t)}
                      >
                        <Checkbox checked={t.completed} className="h-5 w-5 pointer-events-none" />
                        <span className={cn("text-xs font-bold uppercase leading-tight truncate", t.completed && "line-through")}>
                          {t.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
