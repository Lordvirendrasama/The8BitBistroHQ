
'use client';
import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import type { Member, MemberTier, Transaction, ClaimedReward, MemberRecharge } from '@/lib/types';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useCollection } from '@/firebase/firestore/use-collection';
import { doc, collection } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import Link from 'next/link';
import Image from 'next/image';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { settings } from '@/lib/data';
import { ArrowLeft, Coins, Edit, Gift, Star, Utensils, Zap, Clock } from 'lucide-react';
import { format } from 'date-fns';

const tierColors: Record<MemberTier, string> = {
    Red: 'bg-red-500/20 text-red-500 border-red-500/50',
    Green: 'bg-green-500/20 text-green-500 border-green-500/50',
    Gold: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50',
}

export default function MemberProfilePage() {
  const router = useRouter();
  const params = useParams();
  const memberId = params.memberId as string;
  const { db } = useFirebase();

  const memberRef = useMemo(() => {
    if (!db || !memberId) return null;
    return doc(db, 'members', memberId);
  }, [db, memberId]);
  
  const transactionsRef = useMemo(() => {
    if (!db || !memberId) return null;
    return collection(db, `members/${memberId}/transactions`);
  }, [db, memberId]);

  const claimedRewardsRef = useMemo(() => {
    if (!db || !memberId) return null;
    return collection(db, `members/${memberId}/claimedRewards`);
  }, [db, memberId]);


  const { data: member, loading, error } = useDoc<Member>(memberRef);
  const { data: transactions, loading: transactionsLoading } = useCollection<Transaction>(transactionsRef);
  const { data: claimedRewards, loading: rewardsLoading } = useCollection<ClaimedReward>(claimedRewardsRef);

  if (loading || transactionsLoading || rewardsLoading) {
    return <div className="flex h-screen items-center justify-center">Loading member profile...</div>;
  }

  if (error) {
    return <div>Error loading member.</div>
  }

  if (!member) {
    return <div>Member not found</div>;
  }

  const xpPerLevel = settings.xpPerLevel;
  const currentLevelXp = member.xp - ((member.level - 1) * xpPerLevel);
  const progressPercentage = (currentLevelXp / xpPerLevel) * 100;

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="font-headline text-4xl tracking-wider text-foreground">
            {member.name}
          </h1>
          <p className="mt-1 text-muted-foreground">
            @{member.username} &bull; Joined {new Date(member.joinDate).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-8">
            <Card>
                <CardContent className="pt-6 text-center flex flex-col items-center">
                    <Avatar className="h-32 w-32 border-4 border-primary/50 mb-4">
                        <Image src={member.avatarUrl} alt={member.name} width={128} height={128} />
                        <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <Badge variant="outline" className={cn("text-lg font-bold my-2", tierColors[member.tier])}>
                        {member.tier} Tier
                    </Badge>
                    <div className="flex items-center gap-4 text-muted-foreground text-lg">
                        <span>Level {member.level}</span>
                    </div>
                     <div className="flex items-center gap-2 text-2xl font-bold text-yellow-500 pt-2">
                        <Coins className="h-7 w-7" />
                        <span>{member.points.toLocaleString()} Points</span>
                    </div>
                     <div className="flex items-center gap-2 text-2xl font-bold text-green-500 pt-2">
                        <Star className="h-7 w-7" />
                        <span>{member.xp.toLocaleString()} XP</span>
                    </div>
                </CardContent>
                 <CardFooter className="flex-col gap-2">
                    <div>
                        <div className="mb-1 flex justify-between text-sm text-muted-foreground">
                            <span>Progress to Level {member.level + 1}</span>
                            <span>{currentLevelXp.toLocaleString()} / {xpPerLevel.toLocaleString()}</span>
                        </div>
                        <Progress value={progressPercentage} className="h-4" indicatorClassName="bg-green-500" />
                    </div>
                    <Button asChild variant="secondary" className="w-full font-bold mt-4">
                        <Link href={`/members/${member.id}/edit`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Member Details
                        </Link>
                    </Button>
                </CardFooter>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                    <CardTitle className="font-headline tracking-wide text-xl flex items-center gap-2 text-primary">
                        <Zap className="h-5 w-5 fill-current" />
                        Active recharges
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {member.recharges && member.recharges.length > 0 ? (
                        member.recharges.filter(r => new Date(r.expiryDate) > new Date() && r.remainingDuration > 0).map(r => (
                            <div key={r.id} className="p-3 rounded-lg border bg-background space-y-2">
                                <div className="flex justify-between items-start">
                                    <p className="font-black text-xs uppercase">{r.packageName}</p>
                                    <Badge variant="outline" className="text-[10px] h-5 font-mono">{formatDuration(r.remainingDuration)} left</Badge>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold">
                                    <Clock className="h-3 w-3" /> Purchased: {format(new Date(r.purchaseDate), 'PP')}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-destructive uppercase font-black">
                                    <Zap className="h-3 w-3" /> Expiry: {format(new Date(r.expiryDate), 'PP')}
                                </div>
                                <Progress value={(r.remainingDuration / r.totalDuration) * 100} className="h-1.5" />
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4 italic">No active time packs.</p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="font-headline tracking-wide text-2xl flex items-center gap-2"><Utensils /> Bills Paid</CardTitle>
                </CardHeader>
                <CardContent>
                     <p className="text-4xl font-bold text-primary">₹{member.totalSpent.toLocaleString()}</p>
                     <p className="text-sm text-muted-foreground">Total amount spent at the bistro.</p>
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-2 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline tracking-wide text-2xl flex items-center gap-2"><Star /> XP History</CardTitle>
                    <CardDescription>Recent transactions and XP earned.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Bill Amount</TableHead>
                                <TableHead className="text-right">XP Gained</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions && transactions.length > 0 ? (
                                transactions.map(tx => (
                                    <TableRow key={tx.id}>
                                        <TableCell>{new Date(tx.date).toLocaleDateString()}</TableCell>
                                        <TableCell>₹{tx.amount.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-green-500 font-bold">+{tx.xpGained.toLocaleString()} XP</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-muted-foreground">No transactions recorded yet.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="font-headline tracking-wide text-2xl flex items-center gap-2"><Gift /> Claimed Rewards</CardTitle>
                    <CardDescription>Rewards redeemed using loyalty points.</CardDescription>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Reward</TableHead>
                                <TableHead className="text-right">Points Cost</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {claimedRewards && claimedRewards.length > 0 ? (
                                claimedRewards.map(cr => (
                                    <TableRow key={cr.id}>
                                        <TableCell>{new Date(cr.date).toLocaleDateString()}</TableCell>
                                        <TableCell>{cr.rewardName}</TableCell>
                                        <TableCell className="text-right text-yellow-500 font-bold">-{cr.pointsCost.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))
                             ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-muted-foreground">No rewards claimed yet.</TableCell>
                                </TableRow>
                             )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
