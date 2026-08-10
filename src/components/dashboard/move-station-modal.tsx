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
  allStations: Station[];
}

export function MoveStationModal({ isOpen, onOpenChange, sourceStation, allStations }: MoveStationModalProps) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [moveMode, setMoveMode] = useState<'move' | 'merge' | 'swap'>('move');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  if (!sourceStation) return null;

  // Filter out the source station itself
  const validTargets = allStations.filter(s => s.id !== sourceStation.id);
  const targetStation = validTargets.find(s => s.id === targetId);
  const isTargetOccupied = targetStation && targetStation.status !== 'available';

  const handleMove = async () => {
    if (!targetId) return;
    
    setIsSubmitting(true);
    
    // Pass the selected move mode
    const result = await moveStationSession(sourceStation.id, targetId, moveMode);
    
    if (result.success) {
      toast({
        title: modeSuccessTitle(moveMode),
        description: modeSuccessDesc(moveMode, sourceStation, targetStation),
      });
      onOpenChange(false);
    } else {
      toast({
        variant: "destructive",
        title: "Operation Failed",
        description: result.message || "An unexpected error occurred.",
      });
    }
    setIsSubmitting(false);
  };

  const modeSuccessTitle = (mode: string) => {
    if (mode === 'merge') return "Sessions Merged";
    if (mode === 'swap') return "Sessions Swapped";
    return "Session Moved";
  };

  const modeSuccessDesc = (mode: string, src: Station, tgt: Station | undefined) => {
    if (mode === 'merge') return `Successfully merged ${src.name} into ${tgt?.name}.`;
    if (mode === 'swap') return `Successfully swapped sessions between ${src.name} and ${tgt?.name}.`;
    return `Successfully moved from ${src.name} to ${tgt?.name}.`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="text-primary h-5 w-5" />
            Move / Relocate Session
          </DialogTitle>
          <DialogDescription>
            Shift players from <strong>{sourceStation.name}</strong> to any console or table.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4 flex-1 overflow-y-auto pr-1">
          {/* Summary Route */}
          <div className="bg-muted/30 p-3 rounded-lg border-2 border-dashed flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-sm">FROM</Badge>
              <span className="font-bold uppercase">{sourceStation.name}</span>
            </div>
            <ArrowRightLeft className="h-4 w-4 opacity-30" />
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-sm border-primary/50 text-primary">TO</Badge>
              <span className="font-bold uppercase">{targetStation?.name || '...'}</span>
            </div>
          </div>

          {/* Merge / Swap Options (only when occupied) */}
          {isTargetOccupied && (
            <div className="bg-primary/5 border-2 border-primary/25 p-4 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <Label className="text-xs font-bold uppercase tracking-wider text-primary">Target station is occupied!</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={moveMode === 'merge' ? 'default' : 'outline'}
                  className="flex-1 font-bold uppercase text-xs h-10"
                  onClick={() => setMoveMode('merge')}
                >
                  Merge Sessions
                </Button>
                <Button
                  type="button"
                  variant={moveMode === 'swap' ? 'default' : 'outline'}
                  className="flex-1 font-bold uppercase text-xs h-10"
                  onClick={() => setMoveMode('swap')}
                >
                  Swap Tables
                </Button>
              </div>
              <p className="text-xs text-muted-foreground leading-normal font-medium">
                {moveMode === 'merge' 
                  ? "Combine all players and logged bills from both stations into the target station. The source station will become empty."
                  : "Exchanges sessions completely. Roster details, active packages, start times, and bills will swap places."}
              </p>
            </div>
          )}

          {/* Grid Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-bold uppercase tracking-normal text-muted-foreground pl-1">
              Select Console or Table
            </Label>
            <RadioGroup 
              value={targetId || ''} 
              onValueChange={(val) => {
                setTargetId(val);
                const tgt = validTargets.find(s => s.id === val);
                if (tgt && tgt.status !== 'available') {
                  setMoveMode('merge'); // default to merge if occupied
                } else {
                  setMoveMode('move');
                }
              }} 
              className="grid grid-cols-2 gap-2"
            >
              {validTargets.map((station) => {
                const isOccupied = station.status !== 'available';
                const activePlayerNames = (station.members || [])
                  .map(m => m.name.split(' ')[0])
                  .join(', ');

                return (
                  <Label
                    key={station.id}
                    htmlFor={`target-${station.id}`}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden",
                      targetId === station.id 
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                        : isOccupied 
                          ? "border-amber-500/25 hover:border-amber-500/40 bg-zinc-900/40"
                          : "border-muted hover:border-primary/20 bg-card"
                    )}
                  >
                    <RadioGroupItem value={station.id} id={`target-${station.id}`} className="sr-only" />
                    <div className="flex flex-col items-center gap-1.5 text-center w-full">
                      {station.type === 'ps5' ? <Gamepad2 className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                      <span className="font-bold text-sm uppercase">{station.name}</span>
                      {isOccupied ? (
                        <div className="flex flex-col items-center gap-0.5 mt-0.5">
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-amber-500/50 text-amber-500 font-mono font-bold uppercase">
                            {station.status === 'paused' ? 'PAUSED' : 'IN USE'}
                          </Badge>
                          {activePlayerNames && (
                            <span className="text-[10px] text-muted-foreground font-semibold truncate max-w-[120px] uppercase">
                              {activePlayerNames}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-emerald-500/50 text-emerald-500 font-mono font-bold uppercase mt-0.5">
                          AVAILABLE
                        </Badge>
                      )}
                    </div>
                    {targetId === station.id && (
                      <div className="absolute top-1.5 right-1.5">
                        <CheckCircle2 className="h-4 w-4 text-primary fill-background" />
                      </div>
                    )}
                  </Label>
                );
              })}
              {validTargets.length === 0 && (
                <div className="col-span-2 py-8 text-center text-sm text-muted-foreground border-2 border-dashed rounded-xl italic">
                  No other consoles or tables found in network.
                </div>
              )}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t border-border mt-auto">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 font-bold">Cancel</Button>
          <Button 
            disabled={!targetId || isSubmitting} 
            onClick={handleMove}
            className="flex-[2] font-bold uppercase tracking-tight h-12 shadow-lg"
          >
            {isSubmitting ? 'Processing...' : (
              moveMode === 'merge' ? 'Confirm Merge' :
              moveMode === 'swap' ? 'Confirm Swap' : 'Confirm Move'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
