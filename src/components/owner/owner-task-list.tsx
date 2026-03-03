'use client';
import { useMemo, useState, useEffect } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query } from 'firebase/firestore';
import type { OwnerTask, OwnerTaskFormData } from '@/lib/types';
import { useFirebase } from '@/firebase/provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, isPast, isToday } from 'date-fns';
import { CheckCircle2, Clock, AlertCircle, Trash2, Plus, GripVertical, Search, ChevronRight, ChevronDown, ListPlus } from 'lucide-react';
import { useAuth } from '@/firebase/auth/use-user';
import { updateOwnerTask, deleteOwnerTask, addOwnerTask, reorderOwnerTasks } from '@/firebase/firestore/owner-tasks';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

export function OwnerTaskList() {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSeparatorMode, setIsSeparatorMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [formData, setFormData] = useState<OwnerTaskFormData & { isRecurring: boolean }>({
    title: '',
    description: '',
    dueDateTime: new Date().toISOString().slice(0, 16),
    priority: 'medium',
    category: 'strategic',
    isRecurring: false,
    isSeparator: false
  });

  const tasksQuery = useMemo(() => !db ? null : collection(db, 'ownerTasks'), [db]);
  const { data: tasks, loading, error } = useCollection<OwnerTask>(tasksQuery);

  const handleToggleComplete = async (task: OwnerTask) => {
    if (!user) return;
    const newStatus = task.status === 'pending' ? 'completed' : 'pending';
    await updateOwnerTask(task.id, { status: newStatus, title: task.title }, user);
    toast({ title: newStatus === 'completed' ? "Task Done!" : "Task Reopened" });
  };

  const handleSave = async () => {
    if (!user || !formData.title) return;
    const success = await addOwnerTask({ ...formData, isSeparator: isSeparatorMode }, user);
    if (success) {
      toast({ title: "Task Saved" });
      setIsModalOpen(false);
      setFormData({ title: '', description: '', dueDateTime: new Date().toISOString().slice(0, 16), priority: 'medium', category: 'strategic', isRecurring: false, isSeparator: false });
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination || !filteredTasks || !user) return;
    
    const items = Array.from(filteredTasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    await reorderOwnerTasks(items, user);
    toast({ title: "Checklist Reordered" });
  };

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    
    const sorted = [...tasks].sort((a, b) => (a.order || 0) - (b.order || 0));

    return sorted.filter(t => {
      if (t.isSeparator && !searchQuery) return true;
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && (t.isSeparator || matchesStatus);
    });
  }, [tasks, searchQuery, statusFilter]);

  if (loading) return <div className="p-12 text-center text-xs uppercase tracking-tight animate-pulse">Syncing Strategic Roadmap...</div>;
  if (error) return <div className="p-12 text-center text-destructive font-bold">Error connecting to mission control.</div>;
  if (!isMounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-normal uppercase tracking-tight flex items-center gap-2">
            <AlertCircle className="text-primary h-6 w-6" />
            Strategic Checklist
          </h2>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => { setIsSeparatorMode(true); setIsModalOpen(true); }} className="flex-1 font-normal uppercase tracking-tight h-10 px-3 text-[10px] border-2 border-dashed">
            <ListPlus className="mr-2 h-4 w-4" /> Add Header
          </Button>
          <Button onClick={() => { setIsSeparatorMode(false); setIsModalOpen(true); }} className="flex-1 font-normal uppercase tracking-tight h-10 px-4 text-[10px] shadow-lg">
            <Plus className="mr-2 h-4 w-4" /> New Action
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Filter tasks..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-10 text-xs font-normal uppercase" />
        </div>
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-full sm:w-[180px] h-10 text-[10px] font-normal uppercase">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending" className="text-[10px] uppercase font-normal">Pending</SelectItem>
            <SelectItem value="completed" className="text-[10px] uppercase font-normal">Completed</SelectItem>
            <SelectItem value="all" className="text-[10px] uppercase font-normal">All Items</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-2 shadow-none overflow-hidden">
        <CardContent className="p-0">
          <div className="hidden sm:grid grid-cols-[40px_50px_1fr_80px_140px_60px] bg-muted/30 border-b py-3 px-4 text-[10px] font-normal uppercase tracking-tight text-muted-foreground">
            <div className="text-center">Pos</div>
            <div className="text-center">Done</div>
            <div>Task</div>
            <div className="text-center">Priority</div>
            <div>Due Date</div>
            <div className="text-right">Actions</div>
          </div>

          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="owner-tasks">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="divide-y">
                  {filteredTasks.map((task, idx) => (
                    <Draggable key={task.id} draggableId={task.id} index={idx}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn(
                            "group transition-colors",
                            snapshot.isDragging ? "bg-muted shadow-2xl z-50 ring-2 ring-primary/20" : "bg-card hover:bg-muted/5",
                            task.isSeparator && "bg-primary/[0.03] border-y border-primary/10"
                          )}
                        >
                          <div className={cn(
                            "flex flex-col sm:grid sm:grid-cols-[40px_50px_1fr_80px_140px_60px] items-center p-4 sm:py-3",
                            task.isSeparator && "sm:grid-cols-[40px_50px_1fr_60px]"
                          )}>
                            {/* HANDLE */}
                            <div {...provided.dragHandleProps} className="hidden sm:flex justify-center cursor-grab active:cursor-grabbing opacity-30 group-hover:opacity-100 transition-opacity">
                              <GripVertical className="h-4 w-4" />
                            </div>

                            {/* DONE */}
                            <div className="flex sm:justify-center mb-2 sm:mb-0">
                              {!task.isSeparator && (
                                <Checkbox checked={task.status === 'completed'} onCheckedChange={() => handleToggleComplete(task)} className="h-5 w-5 border-primary/50" />
                              )}
                            </div>

                            {/* TASK / TITLE */}
                            <div className="w-full min-w-0 mb-3 sm:mb-0">
                              <div className="flex flex-col">
                                <span className={cn(
                                  "font-normal uppercase text-xs sm:text-sm tracking-tight",
                                  task.isSeparator ? "text-primary font-bold" : "text-foreground",
                                  task.status === 'completed' && "line-through opacity-50"
                                )}>
                                  {task.title}
                                </span>
                                {!task.isSeparator && task.description && (
                                  <span className="text-[10px] text-muted-foreground line-clamp-1 italic font-normal">{task.description}</span>
                                )}
                              </div>
                            </div>

                            {/* PRIORITY */}
                            {!task.isSeparator && (
                              <div className="hidden sm:flex justify-center">
                                <div className={cn(
                                  "h-2 w-2 rounded-full",
                                  task.priority === 'high' ? "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]" : 
                                  task.priority === 'medium' ? "bg-amber-500" : 
                                  "bg-blue-500"
                                )} />
                              </div>
                            )}

                            {/* DUE */}
                            {!task.isSeparator && (
                              <div className="w-full sm:w-auto mb-3 sm:mb-0">
                                <span className={cn(
                                  "text-[10px] font-mono px-2 py-1 rounded bg-muted text-muted-foreground font-normal uppercase whitespace-nowrap",
                                  task.status === 'pending' && isPast(new Date(task.dueDateTime)) && !isToday(new Date(task.dueDateTime)) && "bg-destructive text-white"
                                )}>
                                  {format(new Date(task.dueDateTime), 'MMM d, p')}
                                </span>
                              </div>
                            )}

                            {/* ACTIONS */}
                            <div className="w-full sm:w-auto flex justify-end gap-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteOwnerTask(task.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {filteredTasks.length === 0 && (
            <div className="h-48 flex flex-col items-center justify-center opacity-30">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p className="font-normal uppercase text-[10px] tracking-widest">Clear Horizons: No Tasks Found</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-normal uppercase tracking-tight text-xl">
              {isSeparatorMode ? 'Create Header' : 'New Strategic Action'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-normal uppercase tracking-widest text-muted-foreground">Title</Label>
              <Input value={formData.title} onChange={e => setFormData(p => ({...p, title: e.target.value}))} placeholder="e.g. MARKETING GOALS" className="font-normal h-12 text-lg uppercase border-2" />
            </div>
            {!isSeparatorMode && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-normal uppercase tracking-widest text-muted-foreground">Focus Area</Label>
                    <Select value={formData.category} onValueChange={(v: any) => setFormData(p => ({...p, category: v}))}>
                      <SelectTrigger className="h-10 text-xs font-normal uppercase"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="strategic" className="text-xs uppercase font-normal">Strategic</SelectItem>
                        <SelectItem value="bill" className="text-xs uppercase font-normal">Financial</SelectItem>
                        <SelectItem value="maintenance" className="text-xs uppercase font-normal">Operations</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-normal uppercase tracking-widest text-muted-foreground">Priority</Label>
                    <Select value={formData.priority} onValueChange={(v: any) => setFormData(p => ({...p, priority: v}))}>
                      <SelectTrigger className="h-10 text-xs font-normal uppercase"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low" className="text-xs uppercase font-normal">Low</SelectItem>
                        <SelectItem value="medium" className="text-xs uppercase font-normal">Medium</SelectItem>
                        <SelectItem value="high" className="text-xs uppercase font-normal">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-normal uppercase tracking-widest text-muted-foreground">Due By</Label>
                  <Input type="datetime-local" value={formData.dueDateTime} onChange={e => setFormData(p => ({...p, dueDateTime: e.target.value}))} className="h-10 font-normal border-2" />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSave} className="w-full font-normal uppercase h-14 text-lg shadow-xl tracking-widest">
              Add to Roadmap
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}