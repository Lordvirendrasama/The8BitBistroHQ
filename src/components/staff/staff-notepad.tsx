'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { createAdminNotification, dismissAdminNotification } from '@/firebase/firestore/notifications';
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
import { StickyNote, Send, History, PencilLine, Clock, CheckCircle2, Circle, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';
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

  const isOwner = user?.username === 'Viren';

  // Fetch history of notes
  const historyQuery = useMemo(() => {
    if (!db || !user) return null;
    
    const baseQuery = collection(db, 'adminNotifications');
    
    if (isOwner) {
      // Viren sees ALL staff briefings
      return query(
        baseQuery,
        where('type', '==', 'STAFF_NOTE')
      );
    } else {
      // Staff see only their own history
      return query(
        baseQuery,
        where('triggeredBy.username', '==', user.username),
        where('type', '==', 'STAFF_NOTE')
      );
    }
  }, [db, user, isOwner]);

  const { data: rawHistory } = useCollection<AdminNotification>(historyQuery);

  const history = useMemo(() => {
    if (!rawHistory) return [];
    return [...rawHistory].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [rawHistory]);

  const unreadCount = useMemo(() => {
    if (!isOwner) return 0;
    return history.filter(h => !h.isRead).length;
  }, [history, isOwner]);

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

  const handleAcknowledge = async (id: string) => {
    if (!isOwner) return;
    await dismissAdminNotification(id);
    toast({
      title: "Note Acknowledged",
      description: "Marked as seen."
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="relative h-8 w-8 rounded-lg border-primary/20 shadow-sm">
          <StickyNote className="h-4 w-4 text-primary" />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="absolute -right-1.5 -top-1.5 h-5 min-w-[20px] px-1 flex items-center justify-center text-xs rounded-full ring-2 ring-background font-bold">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md font-body p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-6 pb-2 bg-muted/10 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl font-display uppercase tracking-tight">
            <StickyNote className="text-primary h-6 w-6" />
            Staff Notepad
          </DialogTitle>
          <DialogDescription className="font-bold text-sm uppercase text-muted-foreground mt-1 tracking-normal">
            OPERATIONAL LOG & BRIEFING TOOL
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-none bg-background border-b h-12 p-0">
            <TabsTrigger value="write" className="rounded-none h-full font-bold uppercase text-sm tracking-normal data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-primary/5 transition-all gap-2">
              <PencilLine className="h-3.5 w-3.5" /> Compose
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-none h-full font-bold uppercase text-sm tracking-normal data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-primary/5 transition-all gap-2">
              <History className="h-3.5 w-3.5" /> History
              {unreadCount > 0 && <Badge className="ml-1 h-3.5 px-1 bg-primary text-sm">{unreadCount}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="write" className="p-6 m-0 space-y-4 animate-in fade-in-50 slide-in-from-left-2 duration-300">
            <div className="space-y-2">
              <Label htmlFor="staff-note" className="text-sm font-bold uppercase tracking-normal text-muted-foreground pl-1">Message Body</Label>
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
              className="w-full font-bold uppercase h-14 shadow-xl tracking-normal text-sm"
            >
              <Send className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Sending...' : 'Send Briefing'}
            </Button>
          </TabsContent>

          <TabsContent value="history" className="m-0 animate-in fade-in-50 slide-in-from-right-2 duration-300">
            <ScrollArea className="h-[400px] w-full">
              <div className="p-4 space-y-3">
                {history.length > 0 ? (
                  history.map((item) => {
                    const cleanMessage = item.message.split('<em>"')[1]?.split('"</em>')[0] || item.message;
                    
                    return (
                      <div key={item.id} className={cn(
                        "p-4 rounded-xl border-2 shadow-sm space-y-2 group relative overflow-hidden transition-all",
                        !item.isRead && isOwner ? "border-primary/30 bg-primary/[0.02]" : "bg-card"
                      )}>
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2 text-sm font-bold uppercase text-muted-foreground tracking-tight">
                            <Clock className="h-3 w-3" />
                            {format(new Date(item.timestamp), 'MMM d, h:mm a')}
                            <span className="opacity-40">•</span>
                            <span className="text-primary/80">{item.triggeredBy?.displayName}</span>
                          </div>
                          {item.isRead ? (
                            <Badge variant="outline" className="h-4 text-sm bg-emerald-50 text-emerald-600 border-emerald-200 uppercase font-bold px-1.5">
                              <CheckCircle2 className="h-2 w-2 mr-1" /> Seen
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="h-4 text-sm bg-primary/5 text-primary border-primary/20 uppercase font-bold px-1.5">
                              <Circle className="h-2 w-2 mr-1 fill-current" /> New
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground leading-relaxed">
                          {cleanMessage}
                        </p>
                        {isOwner && !item.isRead && (
                          <div className="pt-2 border-t border-dashed mt-2 flex justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleAcknowledge(item.id)}
                              className="h-7 px-2 text-sm font-bold uppercase tracking-normal text-primary hover:bg-primary/10"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Acknowledge
                            </Button>
                          </div>
                        )}
                        <div className="absolute right-0 bottom-0 p-1 opacity-[0.03] pointer-events-none">
                           <StickyNote className="h-12 w-12 text-primary" />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-20 text-center space-y-3 opacity-30">
                    <History className="h-10 w-10 mx-auto text-muted-foreground" />
                    <p className="font-headline text-sm tracking-normal uppercase">No previous notes</p>
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