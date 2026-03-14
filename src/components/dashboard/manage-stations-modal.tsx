
'use client';

import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, GripVertical, Save, X, AlertTriangle, Gamepad2, Users, Plus } from 'lucide-react';
import type { Station } from '@/lib/types';
import { updateStationsBatch, removeStation } from '@/firebase/firestore/stations';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';

interface ManageStationsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  stations: Station[];
  type: 'ps5' | 'boardgame';
  onAdd: () => void;
}

export function ManageStationsModal({ isOpen, onOpenChange, stations, type, onAdd }: ManageStationsModalProps) {
  const { toast } = useToast();
  const [localStations, setLocalStations] = useState<Station[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalStations([...stations].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    }
  }, [isOpen, stations]);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(localStations);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setLocalStations(items);
  };

  const handleRename = (id: string, newName: string) => {
    setLocalStations(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
  };

  const handleDelete = async (id: string) => {
    const station = localStations.find(s => s.id === id);
    if (station?.status !== 'available') {
      toast({ variant: 'destructive', title: "Cannot Delete", description: "Station must be Available before removal." });
      return;
    }
    
    setLocalStations(prev => prev.filter(s => s.id !== id));
    await removeStation(id);
    toast({ title: "Station Deleted" });
  };

  const handleApply = async () => {
    setIsSubmitting(true);
    const updatedWithOrder = localStations.map((s, idx) => ({ ...s, order: idx * 100 }));
    const success = await updateStationsBatch(updatedWithOrder);
    
    if (success) {
      toast({ title: "Organization Saved", description: "Station names and order updated." });
      onOpenChange(false);
    } else {
      toast({ variant: 'destructive', title: "Sync Error" });
    }
    setIsSubmitting(false);
  };

  const Icon = type === 'ps5' ? Gamepad2 : Users;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl font-body">
        <DialogHeader className="p-6 pb-2 bg-muted/10 border-b">
          <div className="flex justify-between items-center w-full pr-8">
            <div className="flex items-center gap-3">
              <Icon className="text-primary h-6 w-6" />
              <div className="min-w-0">
                <DialogTitle className="text-xl font-display uppercase tracking-tight truncate">
                  Manage {type === 'ps5' ? 'Consoles' : 'Tables'}
                </DialogTitle>
                <DialogDescription className="font-bold text-[9px] uppercase text-muted-foreground mt-0.5">
                  Rename or reorder units. Drag to rearrange.
                </DialogDescription>
              </div>
            </div>
            <Button size="sm" onClick={onAdd} variant="outline" className="h-8 border-2 font-black uppercase text-[9px] gap-1.5 shrink-0 bg-background hover:bg-primary hover:text-white transition-all">
              <Plus className="h-3 w-3" /> Add Unit
            </Button>
          </div>
        </DialogHeader>

        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="stations-list">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                  {localStations.map((station, index) => (
                    <Draggable key={station.id} draggableId={station.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border-2 transition-all bg-card",
                            snapshot.isDragging ? "shadow-2xl ring-2 ring-primary/20 border-primary" : "border-muted"
                          )}
                        >
                          <div {...provided.dragHandleProps} className="opacity-30 hover:opacity-100 cursor-grab active:cursor-grabbing">
                            <GripVertical className="h-5 w-5" />
                          </div>
                          
                          <div className="flex-1 space-y-1">
                            <Input 
                              value={station.name} 
                              onChange={(e) => handleRename(station.id, e.target.value)}
                              className="h-9 font-bold uppercase text-xs border-none bg-muted/20 focus-visible:ring-primary"
                            />
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className={cn(
                                    "h-4 text-[7px] uppercase font-black",
                                    station.status === 'available' ? "text-emerald-600 border-emerald-500/20" : "text-destructive border-destructive/20"
                                )}>
                                    {station.status}
                                </Badge>
                            </div>
                          </div>

                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                            onClick={() => handleDelete(station.id)}
                            disabled={station.status !== 'available'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {localStations.length === 0 && (
            <div className="py-12 text-center opacity-30 italic text-xs uppercase font-bold">No units found</div>
          )}
        </div>

        <DialogFooter className="p-4 bg-muted/5 border-t">
          <Button 
            onClick={handleApply} 
            disabled={isSubmitting} 
            className="w-full h-12 font-black uppercase tracking-widest shadow-xl"
          >
            {isSubmitting ? "Syncing..." : "Apply Organization"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
