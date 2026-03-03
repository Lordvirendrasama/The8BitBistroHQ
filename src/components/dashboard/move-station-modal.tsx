'use client';

import { useState } from 'react';
import type { Station } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, Gamepad2, Users, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { moveStationSession } from '@/firebase/firestore/stations';

interface MoveStationModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  sourceStation: Station | null;
  availableStations: Station[];
}

export function MoveStationModal({ isOpen, onOpenChange, sourceStation, availableStations }: MoveStationModalProps) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  if (!sourceStation) return null;

  // Filter available stations of the same type
  const validTargets = availableStations.filter(s => s.type === sourceStation.type && s.id !== sourceStation.id);

  const handleMove = async () => {
    if (!targetId) return;
    
    setIsSubmitting(true);
    const targetStation = validTargets.find(s => s.id === targetId);
    
    const result = await moveStationSession(sourceStation.id, targetId);
    
    if (result.success) {
      toast({
        title: "Session Moved",
        description: `Successfully moved from ${sourceStation.name} to ${targetStation?.name}.`,
      });
      onOpenChange(false);
    } else {
      toast({
        variant: "destructive",
        title: "Move Failed",
        description: result.message || "An unexpected error occurred.",
      });
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="text-primary h-5 w-5" />
            Move Session
          </DialogTitle>
          <DialogDescription>
            Shift players from <strong>{sourceStation.name}</strong> to another console or table.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="bg-muted/30 p-3 rounded-lg border-2 border-dashed flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-[10px]">FROM</Badge>
              <span className="font-black uppercase">{sourceStation.name}</span>
            </div>
            <ArrowRightLeft className="h-4 w-4 opacity-30" />
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px] border-primary/50 text-primary">TO</Badge>
              <span className="font-black uppercase">{validTargets.find(s => s.id === targetId)?.name || '...'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Available {sourceStation.type === 'ps5' ? 'Consoles' : 'Tables'}</Label>
            <RadioGroup value={targetId || ''} onValueChange={setTargetId} className="grid grid-cols-2 gap-2">
              {validTargets.map((station) => (
                <Label
                  key={station.id}
                  htmlFor={`target-${station.id}`}
                  className={cn(
                    "flex items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden",
                    targetId === station.id 
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                      : "border-muted hover:border-primary/20 bg-card"
                  )}
                >
                  <RadioGroupItem value={station.id} id={`target-${station.id}`} className="sr-only" />
                  <div className="flex flex-col items-center gap-1.5">
                    {station.type === 'ps5' ? <Gamepad2 className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                    <span className="font-black text-sm uppercase">{station.name}</span>
                  </div>
                  {targetId === station.id && (
                    <div className="absolute top-1 right-1">
                      <CheckCircle2 className="h-4 w-4 text-primary fill-background" />
                    </div>
                  )}
                </Label>
              ))}
              {validTargets.length === 0 && (
                <div className="col-span-2 py-8 text-center text-xs text-muted-foreground border-2 border-dashed rounded-xl italic">
                  No other {sourceStation.type === 'ps5' ? 'PS5s' : 'tables'} are currently available.
                </div>
              )}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 font-bold">Cancel</Button>
          <Button 
            disabled={!targetId || isSubmitting} 
            onClick={handleMove}
            className="flex-[2] font-black uppercase tracking-tight h-12 shadow-lg"
          >
            {isSubmitting ? 'Moving...' : 'Confirm Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
