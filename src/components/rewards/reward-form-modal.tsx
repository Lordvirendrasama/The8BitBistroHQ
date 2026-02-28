'use client';

import { useState, useEffect } from 'react';
import type { Reward, RewardFormData } from '@/lib/types';
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
import { logUserAction } from '@/firebase/firestore/logs';
import { Checkbox } from '../ui/checkbox';

interface RewardFormModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (formData: RewardFormData) => void;
  reward: Reward | null;
}

export function RewardFormModal({ isOpen, onOpenChange, onSave, reward }: RewardFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [levelRequired, setLevelRequired] = useState('');
  const [pointsCost, setPointsCost] = useState('');
  const [limitOnePerUser, setLimitOnePerUser] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    if (reward) {
      setName(reward.name);
      setDescription(reward.description);
      setLevelRequired(String(reward.levelRequired));
      setPointsCost(String(reward.pointsCost));
      setLimitOnePerUser(reward.limitOnePerUser || false);
    } else {
      setName('');
      setDescription('');
      setLevelRequired('1');
      setPointsCost('100');
      setLimitOnePerUser(false);
    }
  }, [reward, isOpen]);

  const handleSave = () => {
    const level = parseInt(levelRequired, 10);
    const cost = parseInt(pointsCost, 10);

    if (!name || !description || isNaN(level) || isNaN(cost)) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please fill out all fields with valid values.',
      });
      return;
    }

    const formData: RewardFormData = {
        name,
        description,
        levelRequired: level,
        pointsCost: cost,
        limitOnePerUser,
    };

    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline tracking-wide text-2xl">
            {reward ? 'Edit Reward' : 'Add New Reward'}
          </DialogTitle>
          <DialogDescription>
            {reward ? `Editing details for ${reward.name}.` : 'Enter the details for the new reward.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Reward Name</Label>
            <Input 
              id="name" 
              placeholder="e.g., Free Coffee"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input 
              id="description" 
              placeholder="A short description of the reward"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="levelRequired">Level Required</Label>
                <Input 
                id="levelRequired" 
                type="number"
                placeholder="e.g., 5" 
                value={levelRequired}
                onChange={(e) => setLevelRequired(e.target.value)}
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="pointsCost">Points Cost</Label>
                <Input 
                id="pointsCost" 
                type="number" 
                placeholder="e.g., 500" 
                value={pointsCost}
                onChange={(e) => setPointsCost(e.target.value)}
                />
            </div>
          </div>
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox 
                id="limit-one" 
                checked={limitOnePerUser}
                onCheckedChange={(checked) => setLimitOnePerUser(checked as boolean)}
            />
            <Label htmlFor="limit-one" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Limit to one claim per user
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} className="w-full font-bold">
            <Save className="mr-2 h-4 w-4" />
            Save Reward
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
