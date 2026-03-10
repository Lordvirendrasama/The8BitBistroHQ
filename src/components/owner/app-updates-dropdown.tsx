
'use client';

import { useState, useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { useAuth } from '@/firebase/auth/use-user';
import type { AppUpdate } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Plus, Trash2, Clock, Send } from 'lucide-react';
import { addAppUpdate, deleteAppUpdate } from '@/firebase/firestore/app-updates';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export function AppUpdatesDropdown() {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  const [newUpdate, setNewUpdate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updatesQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'appUpdates'), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: updates, loading } = useCollection<AppUpdate>(updatesQuery);

  const handleAdd = async () => {
    if (!newUpdate.trim() || !user) return;
    setIsSubmitting(true);
    const success = await addAppUpdate(newUpdate.trim(), user);
    if (success) {
      setNewUpdate('');
      toast({ title: "Roadmap Updated", description: "Idea logged for implementation." });
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    await deleteAppUpdate(id);
    toast({ title: "Update Removed" });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="h-10 w-10 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all rounded-xl relative group">
          <Sparkles className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
          {updates && updates.length > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-white text-[8px] font-black flex items-center justify-center rounded-full ring-2 ring-background">
              {updates.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 overflow-hidden font-body border-2 shadow-2xl" align="start">
        <div className="p-4 bg-primary text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 fill-current" />
            <h4 className="font-black text-[10px] uppercase tracking-widest">Dev Roadmap</h4>
          </div>
          <span className="text-[8px] font-black uppercase opacity-60">Implement Later</span>
        </div>

        <div className="p-3 border-b bg-muted/20">
          <div className="flex gap-2">
            <Input 
              placeholder="TYPE APP UPDATE..." 
              value={newUpdate}
              onChange={(e) => setNewUpdate(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="h-9 font-black uppercase text-[10px] tracking-tight bg-background border-2 border-primary/10 focus-visible:ring-primary"
            />
            <Button 
              size="icon" 
              className="h-9 w-9 shrink-0" 
              onClick={handleAdd}
              disabled={isSubmitting || !newUpdate.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="h-64">
          <div className="divide-y">
            {updates && updates.length > 0 ? updates.map((item) => (
              <div key={item.id} className="p-3 hover:bg-muted/5 group relative transition-colors">
                <div className="pr-8 space-y-1">
                  <p className="text-xs font-bold uppercase tracking-tight leading-relaxed">{item.text}</p>
                  <p className="text-[8px] font-black uppercase text-muted-foreground flex items-center gap-1">
                    <Clock className="h-2 w-2" />
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )) : (
              <div className="py-12 text-center space-y-2 opacity-30">
                <Plus className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-[10px] font-black uppercase tracking-widest">No Pending Updates</p>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <div className="p-3 bg-muted/10 border-t border-dashed">
          <p className="text-[8px] font-black uppercase text-center text-muted-foreground tracking-[0.2em]">Strategic Build Tracker</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
