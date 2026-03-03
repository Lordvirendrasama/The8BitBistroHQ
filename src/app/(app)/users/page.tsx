
'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Member } from '@/lib/types';
import { useFirebase } from '@/firebase/provider';
import { deleteMember } from '@/firebase/firestore/members';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Trash, Search, ArrowUpDown, MessageSquare, Zap, Clock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MemberTier } from '@/lib/types';
import { logUserAction, logDataAction } from '@/firebase/firestore/logs';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const tierColors: Record<MemberTier, string> = {
    Red: 'bg-red-500/20 text-red-500 border-red-500/50',
    Green: 'bg-green-500/20 text-green-500 border-green-500/50',
    Gold: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50',
}

type SortableKeys = keyof Member | 'name';

export default function UserManagementPage() {
  const router = useRouter();
  const { db } = useFirebase();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>({ key: 'joinDate', direction: 'descending' });
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  
  const membersQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'members'), orderBy('joinDate', 'desc'));
  }, [db]);
  

  const { data: members, loading, error } = useCollection<Member>(membersQuery);
  
  const filteredMembers = useMemo(() => {
    if (!members) return [];
    
    let sortableMembers = [...members];
    
    if (sortConfig !== null) {
      sortableMembers.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof Member];
        const bValue = b[sortConfig.key as keyof Member];

        if (aValue! < bValue!) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue! > bValue!) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    if (!searchTerm) return sortableMembers;
    
    return sortableMembers.filter(member =>
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.username.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [members, searchTerm, sortConfig]);

  const requestSort = (key: SortableKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: SortableKeys) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortConfig.direction === 'ascending' ? '▲' : '▼';
  };

  const handleToggleSelect = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMembers(filteredMembers.map(m => m.id));
    } else {
      setSelectedMembers([]);
    }
  };

  const handleDelete = (member: Member) => {
    deleteMember(member.id);
    logUserAction(`Deleted member ${member.name} from User Management.`, { memberId: member.id, memberName: member.name });
    toast({
      variant: 'destructive',
      title: 'Member Deleted',
      description: `${member.name} has been removed from the system.`,
    });
  };

  const handleEdit = (member: Member) => {
    logUserAction(`Clicked 'Edit' for member ${member.name} from User Management list.`, { memberId: member.id });
    router.push(`/members/${member.id}/edit`);
  }

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const handleSendBroadcast = async () => {
    if (broadcastMessage.trim() === '') {
      toast({
        variant: 'destructive',
        title: 'Empty Message',
        description: 'Please write a message to send.',
      });
      return;
    }
    
    logDataAction('Attempting WhatsApp broadcast', {
        memberCount: selectedMembers.length,
        memberIds: selectedMembers,
        message: broadcastMessage
    });

    try {
        const response = await fetch('/api/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                memberIds: selectedMembers, 
                message: broadcastMessage 
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to send broadcast.');
        }

        toast({
            title: 'Broadcast Queued!',
            description: `Your message has been sent to ${result.sentCount} members. Failures: ${result.failedCount}.`,
        });

    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Broadcast Failed',
            description: error.message || 'Could not send the message. Please check the server logs.',
        });
    }

    setIsBroadcastModalOpen(false);
    setBroadcastMessage('');
    setSelectedMembers([]);
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center font-headline text-xs animate-pulse opacity-30">Accessing Master Registry...</div>;
  }

  if (error) {
    return <div className="p-8 text-destructive text-center font-bold">Error loading members index.</div>
  }
  
  const SortableHeader = ({ sortKey, children }: { sortKey: SortableKeys, children: React.ReactNode }) => (
    <TableHead>
        <Button variant="ghost" onClick={() => requestSort(sortKey)} className="h-8 font-black uppercase text-[10px] tracking-widest px-2">
            {children}
            <span className="ml-2">{getSortIndicator(sortKey)}</span>
        </Button>
    </TableHead>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-4xl tracking-wider text-foreground">
          User Management
        </h1>
        <p className="mt-2 text-muted-foreground font-bold uppercase text-[10px] tracking-[0.2em]">
          VIEW, EDIT, AND AUDIT ALL LOYALTY PROGRAM MEMBERS.
        </p>
      </div>

      <Card className="border-2 shadow-none overflow-hidden">
        <CardHeader className="bg-muted/10 border-b">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <CardTitle className="text-lg font-black uppercase tracking-tight">Active Members Registry</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-1">
                    Total: <strong>{filteredMembers?.length || 0}</strong> &bull; Selected: <strong>{selectedMembers.length}</strong>
                </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                      placeholder="SEARCH BY NAME..."
                      className="pl-10 h-10 border-2 font-black uppercase text-[10px] tracking-tight bg-background"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
              {selectedMembers.length > 0 && (
                <Dialog open={isBroadcastModalOpen} onOpenChange={setIsBroadcastModalOpen}>
                  <DialogTrigger asChild>
                      <Button className="h-10 font-black uppercase tracking-tight gap-2 shadow-lg">
                          <MessageSquare className="h-4 w-4" />
                          Broadcast
                      </Button>
                  </DialogTrigger>
                  <DialogContent>
                      <DialogHeader>
                          <DialogTitle className="font-headline text-xl">WhatsApp Broadcast</DialogTitle>
                          <DialogDescription className="font-medium text-foreground/80">
                              Send a bulk message to {selectedMembers.length} selected members.
                          </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="broadcastMessage" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Message Body</Label>
                            <Textarea 
                                id="broadcastMessage"
                                placeholder="TYPE YOUR MESSAGE HERE..."
                                value={broadcastMessage}
                                onChange={(e) => setBroadcastMessage(e.target.value)}
                                rows={5}
                                className="font-bold border-2"
                            />
                          </div>
                      </div>
                      <DialogFooter className="gap-2">
                          <Button variant="outline" onClick={() => setIsBroadcastModalOpen(false)} className="font-bold uppercase">Cancel</Button>
                          <Button onClick={handleSendBroadcast} className="font-black uppercase tracking-tight shadow-xl">Send Now</Button>
                      </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/5">
                <TableHead className="w-[50px] text-center">
                    <Checkbox
                        checked={selectedMembers.length > 0 && selectedMembers.length === filteredMembers.length}
                        onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                        aria-label="Select all"
                    />
                </TableHead>
                <SortableHeader sortKey="name">Member Identity</SortableHeader>
                <SortableHeader sortKey="tier">Tier</SortableHeader>
                <TableHead className="font-black uppercase text-[10px] tracking-widest">Balance</TableHead>
                <SortableHeader sortKey="level">LVL</SortableHeader>
                <SortableHeader sortKey="points">PTS</SortableHeader>
                <SortableHeader sortKey="totalSpent">Total Spent</SortableHeader>
                <SortableHeader sortKey="joinDate">Joined</SortableHeader>
                <TableHead className="text-right pr-6 font-black uppercase text-[10px] tracking-widest">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(filteredMembers || []).map((member) => {
                const activeRecharges = (member.recharges || []).filter(r => new Date(r.expiryDate) > new Date() && r.remainingDuration > 0);
                const totalBalanceSeconds = activeRecharges.reduce((sum, r) => sum + r.remainingDuration, 0);

                return (
                    <TableRow key={member.id} data-state={selectedMembers.includes(member.id) && "selected"} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="text-center">
                        <Checkbox
                            checked={selectedMembers.includes(member.id)}
                            onCheckedChange={() => handleToggleSelect(member.id)}
                            aria-label={`Select ${member.name}`}
                        />
                    </TableCell>
                    <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-primary/10">
                            <Image src={member.avatarUrl} alt={member.name} width={40} height={40} data-ai-hint="pixel avatar" />
                            <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <span className="font-black uppercase text-xs sm:text-sm tracking-tight">{member.name}</span>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">@{member.username}</span>
                        </div>
                        </div>
                    </TableCell>
                    <TableCell>
                        <Badge variant="outline" className={cn("font-black uppercase text-[9px] px-2", tierColors[member.tier])}>{member.tier}</Badge>
                    </TableCell>
                    <TableCell>
                        {totalBalanceSeconds > 0 ? (
                            <div className="flex items-center gap-1.5 font-black text-xs text-yellow-600">
                                <Zap className="h-3.5 w-3.5 fill-current" />
                                <span className="font-mono">{formatDuration(totalBalanceSeconds)}</span>
                            </div>
                        ) : (
                            <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-tighter">0h 0m</span>
                        )}
                    </TableCell>
                    <TableCell className="font-black text-sm">{member.level}</TableCell>
                    <TableCell className="font-black text-sm text-yellow-500">{member.points.toLocaleString()}</TableCell>
                    <TableCell className="font-mono font-black text-sm">₹{member.totalSpent.toLocaleString()}</TableCell>
                    <TableCell className="text-[10px] font-bold text-muted-foreground uppercase whitespace-nowrap">
                        {new Date(member.joinDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                        <AlertDialog>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost" className="h-8 w-8 rounded-full">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Toggle menu</span>
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel className="text-[10px] font-black uppercase opacity-50">Identity Operations</DropdownMenuLabel>
                            <DropdownMenuItem onSelect={() => handleEdit(member)} className="font-bold text-xs gap-2">
                                <Edit className="h-3.5 w-3.5" /> Edit Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => router.push(`/members/${member.id}`)} className="font-bold text-xs gap-2">
                                <Clock className="h-3.5 w-3.5" /> View Activity
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem 
                                    className="text-destructive font-bold text-xs gap-2"
                                    onSelect={() => logUserAction(`Opened 'Delete Member' dialog for ${member.name} from User Management list.`)}
                                >
                                <Trash className="h-3.5 w-3.5" /> Remove Member
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <AlertDialogContent className="border-4 border-destructive">
                            <AlertDialogHeader>
                            <AlertDialogTitle className="font-headline text-destructive text-xl">PERMANENT DELETION?</AlertDialogTitle>
                            <AlertDialogDescription className="font-bold text-foreground">
                                This will erase <strong>{member.name}</strong> from the database. All XP, points, and recharges will be lost forever.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2">
                            <AlertDialogCancel onClick={() => logUserAction('Cancelled member deletion from User Management list.')} className="font-bold">ABORT</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(member)} className="bg-destructive hover:bg-destructive/90 font-black uppercase shadow-lg">YES, DESTROY DATA</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                    </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
