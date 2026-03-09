'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Member } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Search, Gift, ChevronRight, Coins, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ClaimReward } from '../claim-rewards/claim-reward';

interface GlobalRewardsModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  members: Member[];
}

export function GlobalRewardsModal({ isOpen, onOpenChange, members }: GlobalRewardsModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedMemberId(null);
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

  const handleSelectMember = (id: string) => {
    setSelectedMemberId(id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl font-body">
        <DialogHeader className="p-6 pb-2 bg-emerald-600 text-white shrink-0">
          <DialogTitle className="flex items-center gap-3 text-xl font-display uppercase tracking-tight">
            <Gift className="h-6 w-6" />
            Member Rewards
          </DialogTitle>
          <DialogDescription className="text-white/70 font-bold text-[10px] uppercase tracking-widest mt-1">
            Redeem points for perks. Pick a member to view eligibility.
          </DialogDescription>
        </DialogHeader>

        {!selectedMemberId ? (
          <div className="flex-1 flex flex-col min-h-0">
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
                {filteredMembers.map(member => (
                  <div 
                    key={member.id} 
                    onClick={() => handleSelectMember(member.id)}
                    className="p-3 rounded-xl hover:bg-emerald-500/10 cursor-pointer flex items-center justify-between transition-all group border border-transparent hover:border-emerald-500/20 active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-12 w-12 border-2 border-muted shrink-0 group-hover:border-emerald-500/30">
                        <AvatarImage src={member.avatarUrl} />
                        <AvatarFallback>{member.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-black uppercase text-sm truncate leading-tight">{member.name}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">@{member.username}</p>
                        <div className="flex items-center gap-3 mt-1 uppercase text-[10px] font-bold">
                          <span className="flex items-center gap-1 text-yellow-600">
                            <Coins className="h-3 w-3" /> {member.points.toLocaleString()} PTS
                          </span>
                          <span className="flex items-center gap-1 text-primary">
                            <Star className="h-3 w-3" /> LVL {member.level}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                ))}
                {filteredMembers.length === 0 && (
                  <div className="py-20 text-center opacity-30 italic font-bold uppercase text-[10px] tracking-widest">
                    No members match your search
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
            <div className="absolute top-4 left-4 z-50">
                <Button variant="ghost" size="sm" onClick={() => setSelectedMemberId(null)} className="h-8 font-black uppercase text-[10px] tracking-tight bg-background/80 backdrop-blur-sm border shadow-sm">
                    Back to search
                </Button>
            </div>
            <ScrollArea className="flex-1">
                <div className="p-6 pt-14">
                    <ClaimReward initialMemberId={selectedMemberId} />
                </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
