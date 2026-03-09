'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Member } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Search, Zap, ChevronRight, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RechargeModal } from './recharge-modal';

interface GlobalRechargeModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  members: Member[];
}

export function GlobalRechargeModal({ isOpen, onOpenChange, members }: GlobalRechargeModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isInnerOpen, setIsInnerOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedMember(null);
    }
  }, [isOpen]);

  const filteredMembers = useMemo(() => {
    if (!searchTerm) return members.slice(0, 10);
    const term = searchTerm.toLowerCase();
    return members.filter(m => 
      m.name.toLowerCase().includes(term) || 
      m.username.toLowerCase().includes(term)
    ).slice(0, 20);
  }, [members, searchTerm]);

  const handleSelectMember = (member: Member) => {
    setSelectedMember(member);
    setIsInnerOpen(true);
  };

  const formatDuration = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins > 0 ? mins + 'm' : ''}`;
    return `${mins}m`;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md h-[80vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl font-body">
          <DialogHeader className="p-6 pb-2 bg-yellow-500 text-black shrink-0">
            <DialogTitle className="flex items-center gap-3 text-xl font-display uppercase tracking-tight">
              <Zap className="h-6 w-6 fill-current" />
              Member Recharge
            </DialogTitle>
            <DialogDescription className="text-black/70 font-bold text-[10px] uppercase tracking-widest mt-1">
              Select a member to add prepaid time.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 bg-muted/20 border-b shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="SEARCH MEMBERS..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 h-12 bg-background border-2 font-black uppercase text-[10px] tracking-tight"
                autoFocus
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredMembers.map(member => {
                const activeRecharges = (member.recharges || []).filter(r => new Date(r.expiryDate) > new Date() && r.remainingDuration > 0);
                const totalBalanceSeconds = activeRecharges.reduce((sum, r) => sum + r.remainingDuration, 0);
                
                return (
                  <div 
                    key={member.id} 
                    onClick={() => handleSelectMember(member)}
                    className="p-3 rounded-xl hover:bg-yellow-500/10 cursor-pointer flex items-center justify-between transition-all group border border-transparent hover:border-yellow-500/20 active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-12 w-12 border-2 border-muted shrink-0 group-hover:border-yellow-500/30">
                        <AvatarImage src={member.avatarUrl} />
                        <AvatarFallback>{member.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-black uppercase text-sm truncate leading-tight">{member.name}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">@{member.username}</p>
                        {totalBalanceSeconds > 0 && (
                          <div className="flex items-center gap-1 text-[10px] font-black text-yellow-600 mt-1 uppercase">
                            <Zap className="h-2.5 w-2.5 fill-current" />
                            <span>{formatDuration(totalBalanceSeconds)} Balance</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                );
              })}
              {filteredMembers.length === 0 && (
                <div className="py-20 text-center opacity-30 italic font-bold uppercase text-[10px] tracking-widest">
                  No members match your search
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {selectedMember && (
        <RechargeModal 
          isOpen={isInnerOpen} 
          onOpenChange={(open) => {
            setIsInnerOpen(open);
            if (!open) onOpenChange(false);
          }} 
          member={selectedMember} 
        />
      )}
    </>
  );
}