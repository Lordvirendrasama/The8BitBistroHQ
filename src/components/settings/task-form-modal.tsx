'use client';

import { useState, useEffect } from 'react';
import type { Task, TaskFormData, Employee } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
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
  employees: Employee[];
}

export function TaskFormModal({ isOpen, onOpenChange, onSave, task, employees }: TaskFormModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'start-of-day' | 'end-of-day' | 'strategic'>('start-of-day');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (task) {
      setName(task.name);
      setType(task.type);
      setAssignedTo(task.assignedTo || []);
    } else {
      setName('');
      setType('start-of-day');
      setAssignedTo([]);
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
        assignedTo,
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
            <RadioGroup value={type} onValueChange={(value) => setType(value as 'start-of-day' | 'end-of-day' | 'strategic')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="start-of-day" id="start-of-day" />
                <Label htmlFor="start-of-day">Start of Day</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="end-of-day" id="end-of-day" />
                <Label htmlFor="end-of-day">End of Day</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="strategic" id="strategic" />
                <Label htmlFor="strategic">Strategic</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label>Assign to Employees</Label>
            <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2 bg-background">
              <div className="flex items-center space-x-2 pb-1 border-b">
                <Checkbox 
                  id="assign-all" 
                  checked={assignedTo.length === 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setAssignedTo([]);
                    }
                  }}
                  className="h-4 w-4 border-2"
                />
                <Label htmlFor="assign-all" className="text-xs font-bold uppercase cursor-pointer text-muted-foreground">
                  All Employees (No Restrictions)
                </Label>
              </div>
              {employees.map((emp) => {
                const isChecked = assignedTo.includes(emp.username);
                return (
                  <div key={emp.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`emp-${emp.id}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setAssignedTo(prev => [...prev, emp.username]);
                        } else {
                          setAssignedTo(prev => prev.filter(username => username !== emp.username));
                        }
                      }}
                      className="h-4 w-4 border-2"
                    />
                    <Label htmlFor={`emp-${emp.id}`} className="text-xs font-bold cursor-pointer">
                      {emp.displayName} ({emp.username})
                    </Label>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
              If no employees are selected, the task is visible to everyone.
            </p>
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
