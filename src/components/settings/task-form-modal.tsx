'use client';

import { useState, useEffect } from 'react';
import type { Task, TaskFormData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface TaskFormModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (formData: TaskFormData) => void;
  task: Task | null;
}

export function TaskFormModal({ isOpen, onOpenChange, onSave, task }: TaskFormModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'start-of-day' | 'end-of-day'>('start-of-day');
  const { toast } = useToast();

  useEffect(() => {
    if (task) {
      setName(task.name);
      setType(task.type);
    } else {
      setName('');
      setType('start-of-day');
    }
  }, [task, isOpen]);

  const handleSave = () => {
    if (!name) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please provide a name for the task.',
      });
      return;
    }

    const formData: TaskFormData = {
        name,
        type,
    };

    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline tracking-wide text-2xl">
            {task ? 'Edit Task' : 'Add New Task'}
          </DialogTitle>
          <DialogDescription>
            {task ? `Editing details for ${task.name}.` : 'Enter the details for the new daily task.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Task Name</Label>
            <Input
              id="name"
              placeholder="e.g., Wipe down all gaming stations"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Task Type</Label>
            <RadioGroup value={type} onValueChange={(value) => setType(value as 'start-of-day' | 'end-of-day')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="start-of-day" id="start-of-day" />
                <Label htmlFor="start-of-day">Start of Day</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="end-of-day" id="end-of-day" />
                <Label htmlFor="end-of-day">End of Day</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} className="w-full font-bold">
            <Save className="mr-2 h-4 w-4" />
            Save Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
