
'use client';

import { useState, useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy, where, limit } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { Member, LogEntry } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Zap, Clock, User, ArrowRight, History, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { RechargeModal } from '@/components/dashboard/recharge-modal';
import { format, formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export default function RechargesPage() {
  const { db } = useFirebase();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isRechargeOpen, setIsRechargeOpen] = useState(false);

  // 1. Fetch Members
  const membersQuery = useMemo(() => !db ? null : query(collection(db, 'members'), orderBy('name')), [db]);
  const { data: members, loading: membersLoading } = useCollection<Member>(membersQuery);

  // 2. Fetch Recent Recharge Logs
  const logsQuery = useMemo(() => !db ? null : query(
    collection(db, 'logs'),
    where('type', '==', 'MEMBER_RECHARGED')
  ), [db]);
  const { data: unsortedLogs, loading: logsLoading } = useCollection<LogEntry>(logsQuery);

  // Sort logs by timestamp descending and limit to 10 on the client
  const recentLogs = useMemo(() => {
    if (!unsortedLogs) return [];
    return [...unsortedLogs]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  }, [unsortedLogs]);

  const filteredMembers = useMemo(() => {
    if (!members) return [];
    if (!searchTerm) return members.slice(0, 12); // Show first 12 by default
    const term = searchTerm.toLowerCase();
    return members.filter(m => 
      m.name.toLowerCase().includes(term) || 
      m.username.toLowerCase().includes(term)
    ).slice(0, 20);
  }, [members, searchTerm]);

  const formatDuration = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins > 0 ? mins + 'm' : ''}`;
    return `${mins}m`;
  };

  const handleOpenRecharge = (member: Member) => {
    setSelectedMember(member);
    setIsRechargeOpen(true);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="font-headline text-4xl tracking-wider text-foreground flex items-center gap-4">
          <Zap className="h-10 w-10 text-yellow-500 fill-current" />
          RECHARGE HUB
        </h1>
        <p className="text-muted-foreground font-black uppercase tracking-[0.2em] text-xs pl-1">
          Manage member time balances and prepaid transactions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT & CENTER: MEMBER SELECTION */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-2 shadow-none bg-muted/5">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-xl font-black uppercase">Find Member</CardTitle>
                  <CardDescription className="font-bold text-[10px] uppercase tracking-widest">Search by name or username to start a recharge.</CardDescription>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="SEARCH MEMBERS..." 
                    className="pl-10 h-12 bg-background border-2 font-black uppercase tracking-tight text-xs"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="h-64 flex items-center justify-center font-headline text-xs animate-pulse opacity-30">Accessing Member Database...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredMembers.map(member => {
                    const activeRecharges = (member.recharges || []).filter(r => new Date(r.expiryDate) > new Date() && r.remainingDuration > 0);
                    const totalBalanceSeconds = activeRecharges.reduce((sum, r) => sum + r.remainingDuration, 0);
                    
                    return (
                      <Card key={member.id} className="group hover:border-primary/50 transition-all cursor-default border-2 bg-card">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-12 w-12 border-2 border-primary/20 shrink-0">
                              <AvatarImage src={member.avatarUrl} />
                              <AvatarFallback>{member.name[0]}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-black uppercase text-sm truncate leading-tight">{member.name}</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">@{member.username}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="h-4 text-[8px] font-black uppercase bg-primary/5 text-primary border-primary/10">Lvl {member.level}</Badge>
                                {totalBalanceSeconds > 0 && (
                                  <div className="flex items-center gap-1 text-[10px] font-black text-yellow-600">
                                    <Zap className="h-2.5 w-2.5 fill-current" />
                                    <span>{formatDuration(totalBalanceSeconds)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button 
                            onClick={() => handleOpenRecharge(member)}
                            size="sm" 
                            className="h-10 px-4 font-black uppercase tracking-tight bg-yellow-500 hover:bg-yellow-600 text-black shadow-lg shrink-0 ml-2"
                          >
                            Recharge
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {filteredMembers.length === 0 && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed rounded-xl bg-background/50">
                      <p className="font-headline text-[10px] tracking-widest opacity-30">No members match your search</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: RECENT LOGS */}
        <div className="space-y-6">
          <Card className="border-2 shadow-none h-full bg-card overflow-hidden flex flex-col">
            <CardHeader className="bg-muted/30 border-b shrink-0">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg font-black uppercase tracking-tight">Recent Activity</CardTitle>
              </div>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Latest recharge transactions recorded.</CardDescription>
            </CardHeader>
            <ScrollArea className="flex-1 min-h-0 bg-muted/5">
              <CardContent className="p-0">
                {logsLoading ? (
                  <div className="p-12 text-center text-[10px] font-bold uppercase animate-pulse">Syncing Logs...</div>
                ) : (
                  <div className="divide-y">
                    {recentLogs.map(log => {
                      const method = log.details?.paymentMethod || 'cash';
                      return (
                        <div key={log.id} className="p-4 hover:bg-muted/20 transition-colors">
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-2">
                              {method === 'cash' ? <Banknote className="h-3 w-3 text-green-600" /> : <Smartphone className="h-3 w-3 text-primary" />}
                              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{method}</span>
                            </div>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase">{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}</span>
                          </div>
                          <p className="text-xs leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: log.description }} />
                          <div className="flex items-center gap-1 mt-2">
                            <Badge variant="outline" className="h-4 text-[8px] font-bold uppercase opacity-60">Processed by {log.user?.displayName || 'System'}</Badge>
                          </div>
                        </div>
                      );
                    })}
                    {(!recentLogs || recentLogs.length === 0) && (
                      <div className="p-12 text-center text-xs italic text-muted-foreground opacity-50">No recent recharges found.</div>
                    )}
                  </div>
                )}
              </CardContent>
            </ScrollArea>
          </Card>
        </div>
      </div>

      {selectedMember && (
        <RechargeModal 
          isOpen={isRechargeOpen} 
          onOpenChange={setIsRechargeOpen} 
          member={selectedMember} 
        />
      )}
    </div>
  );
}
