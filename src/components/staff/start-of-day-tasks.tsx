'use client';

import { useMemo } from 'react';
import type { ShiftTask } from '@/lib/types';
import { ShiftTaskWizardModal } from './shift-task-wizard-modal';
import { Button } from '@/components/ui/button';
import { ListChecks, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface StartOfDayTasksProps {
  tasks: ShiftTask[];
  onTaskToggle: (task: ShiftTask, result?: 'yes' | 'no') => Promise<void> | void;
  onMinimize: () => void;
  employees: { displayName: string, username: string }[];
  isOpen?: boolean;
}

export function StartOfDayTasks({ tasks, onTaskToggle, onMinimize, isOpen = true }: StartOfDayTasksProps) {
  const pendingCount = useMemo(() => 
    tasks.filter(t => !t.completed && (t.shiftType !== undefined || t.type === 'strategic')).length,
  [tasks]);

  if (pendingCount === 0) return null;

  return (
    <>
      <ShiftTaskWizardModal
        isOpen={isOpen}
        onClose={onMinimize}
        tasks={tasks}
        onTaskToggle={onTaskToggle}
      />

      {/* Floating launcher pill when popup is minimized */}
      {!isOpen && (
        <Button
          onClick={onMinimize}
          className="fixed bottom-6 right-6 z-50 shadow-2xl bg-primary text-primary-foreground font-bold uppercase tracking-normal h-12 px-5 rounded-full flex items-center gap-2.5 animate-bounce hover:animate-none border-2 border-primary-foreground/20"
        >
          <ListChecks className="h-5 w-5" />
          <span>Shift Tasks Wizard</span>
          <Badge className="bg-background text-foreground font-bold text-xs h-5 px-2 rounded-full border border-border">
            {pendingCount} Left
          </Badge>
        </Button>
      )}
    </>
  );
}
