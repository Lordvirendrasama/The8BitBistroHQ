'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { createAdminNotification } from '@/firebase/firestore/notifications';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StickyNote, Send, History, PencilLine, Clock, CheckCircle2, Circle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import type { AdminNotification } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export function StaffNotepad() {
  const { user } = useAuth();
  const { db } = useFirebase();
  const { toast } = useToast();
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('write');

  // Fetch history of notes sent by THIS user
  const historyQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'adminNotifications'),
      where('triggeredBy.username', '==', user.username),
      where('type', '==', 'STAFF_NOTE')
    );
  }, [db, user]);

  const { data: rawHistory, loading: loadingHistory } = useCollection<AdminNotification>(historyQuery);

  const history = useMemo(() => {
    if (!rawHistory) return [];
    return [...rawHistory].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [rawHistory]);

  const handleSendNote = async () => {
    if (!note.trim() || !user) return;

    setIsSubmitting(true);
    try {
      await createAdminNotification(
        `<strong>${user.displayName}</strong> left a briefing note: <br/><em>"${note}"</em>`,
        user,
        'STAFF_NOTE'
      );
      toast({
        title: "Note Sent",
        description: "Your briefing has been sent to the owner.",
      });
      setNote('');
      setActiveTab('history');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send the note.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-primary/20 shadow-sm">
          <StickyNote className="h-5 w-5 text-primary" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md font-body p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 pb-2 bg-muted/10 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl font-display uppercase tracking-tight">
            <StickyNote className="text-primary h-6 w-6" />
            Staff Notepad
          </DialogTitle>
          <DialogDescription className="font-bold text-[10px] uppercase text-muted-foreground mt-1 tracking-widest">
            OPERATIONAL LOG & BRIEFING TOOL
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-none bg-background border-b h-12 p-0">
            <TabsTrigger value="write" className="rounded-none h-full font-black uppercase text-[10px] tracking-widest data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-primary/5 transition-all gap-2">
              <PencilLine className="h-3.5 w-3.5" /> Compose
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-none h-full font-black uppercase text-[10px] tracking-widest data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-primary/5 transition-all gap-2">
              <History className="h-3.5 w-3.5" /> History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="write" className="p-6 m-0 space-y-4 animate-in fade-in-50 slide-in-from-left-2 duration-300">
            <div className="space-y-2">
              <Label htmlFor="staff-note" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Message Body</Label>
              <Textarea
                id="staff-note"
                placeholder="Report an issue, suggest a change, or provide a shift update..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-[150px] font-medium border-2 focus-visible:ring-primary text-sm leading-relaxed"
              />
            </div>
            <Button 
              onClick={handleSendNote} 
              disabled={isSubmitting || !note.trim()} 
              className="w-full font-black uppercase h-14 shadow-xl tracking-widest text-sm"
            >
              <Send className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Sending...' : 'Send Briefing'}
            </Button>
          </TabsContent>

          <TabsContent value="history" className="m-0 animate-in fade-in-50 slide-in-from-right-2 duration-300">
            <ScrollArea className="h-[350px] w-full">
              <div className="p-4 space-y-3">
                {history.length > 0 ? (
                  history.map((item) => {
                    // Extract text from the formatted HTML message
                    const cleanMessage = item.message.split('<em>"')[1]?.split('"</em>')[0] || item.message;
                    
                    return (
                      <div key={item.id} className="p-4 rounded-xl border-2 bg-card shadow-sm space-y-2 group relative overflow-hidden">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2 text-[9px] font-black uppercase text-muted-foreground tracking-tighter">
                            <Clock className="h-3 w-3" />
                            {format(new Date(item.timestamp), 'MMM d, h:mm a')}
                          </div>
                          {item.isRead ? (
                            <Badge variant="outline" className="h-4 text-[7px] bg-emerald-50 text-emerald-600 border-emerald-200 uppercase font-black px-1.5">
                              <CheckCircle2 className="h-2 w-2 mr-1" /> Seen
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="h-4 text-[7px] bg-primary/5 text-primary border-primary/20 uppercase font-black px-1.5">
                              <Circle className="h-2 w-2 mr-1 fill-current" /> Sent
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs font-medium text-foreground leading-relaxed">
                          {cleanMessage}
                        </p>
                        <div className="absolute right-0 bottom-0 p-1 opacity-0 group-hover:opacity-10 transition-opacity">
                           <StickyNote className="h-8 w-8 text-primary" />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-20 text-center space-y-3 opacity-30">
                    <History className="h-10 w-10 mx-auto text-muted-foreground" />
                    <p className="font-headline text-[10px] tracking-widest uppercase">No previous notes</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
        
        <div className="h-2 bg-muted/5 border-t shrink-0" />
      </DialogContent>
    </Dialog>
  );
}
