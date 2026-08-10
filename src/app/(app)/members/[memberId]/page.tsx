
'use client';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { Member, MemberTier, Transaction, ClaimedReward, MemberRecharge } from '@/lib/types';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useCollection } from '@/firebase/firestore/use-collection';
import { doc, collection, updateDoc } from 'firebase/firestore';
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
import { ArrowLeft, Coins, Edit, Gift, Star, Utensils, Zap, Clock, QrCode, RefreshCw, Eye, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';


const tierColors: Record<MemberTier, string> = {
    Red: 'bg-red-500/20 text-red-500 border-red-500/50',
    Green: 'bg-green-500/20 text-green-500 border-green-500/50',
    Gold: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50',
}

const generateSvgIdCard = (member: Member) => {
  const tierColorMap: Record<MemberTier, { color: string; bg: string; text: string }> = {
    Red: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', text: 'RED' },
    Green: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', text: 'GREEN' },
    Gold: { color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', text: 'GOLD' }
  };
  
  const tier = tierColorMap[member.tier] || tierColorMap.Red;
  
  return `<svg width="400" height="250" viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg">
  <style>
    .title { font-family: 'Courier New', monospace; font-weight: bold; fill: #00ffcc; font-size: 16px; }
    .name { font-family: 'Segoe UI', Roboto, sans-serif; font-weight: 800; fill: #ffffff; font-size: 20px; }
    .username { font-family: 'Segoe UI', Roboto, sans-serif; fill: #a0aec0; font-size: 13px; }
    .label { font-family: 'Segoe UI', Roboto, sans-serif; font-weight: bold; fill: #718096; font-size: 9px; letter-spacing: 1px; }
    .value { font-family: 'Segoe UI', Roboto, sans-serif; font-weight: bold; fill: #ffffff; font-size: 13px; }
    .tier-badge { font-family: 'Segoe UI', Roboto, sans-serif; font-weight: bold; font-size: 11px; }
  </style>
  
  <defs>
    <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f0c20" />
      <stop offset="100%" stop-color="#060210" />
    </linearGradient>
    <linearGradient id="borderGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ef4444" />
      <stop offset="50%" stop-color="#00ffcc" />
      <stop offset="100%" stop-color="#9d4edd" />
    </linearGradient>
    <clipPath id="avatarClip">
      <rect x="20" y="70" width="70" height="70" rx="15" />
    </clipPath>
  </defs>

  <!-- Background Card -->
  <rect x="5" y="5" width="390" height="240" rx="20" fill="url(#cardBg)" stroke="url(#borderGlow)" stroke-width="2.5" />
  
  <!-- Bistro Brand Logo -->
  <text x="20" y="40" class="title">THE 8-BIT BISTRO</text>
  
  <!-- Tier Badge -->
  <rect x="300" y="22" width="80" height="24" rx="12" fill="${tier.bg}" stroke="${tier.color}" stroke-width="1.5" />
  <text x="340" y="38" text-anchor="middle" class="tier-badge" fill="${tier.color}">${tier.text}</text>

  <!-- Avatar -->
  <image href="${member.avatarUrl || 'https://via.placeholder.com/150'}" x="20" y="70" width="70" height="70" clip-path="url(#avatarClip)" />
  <rect x="20" y="70" width="70" height="70" rx="15" fill="none" stroke="${tier.color}" stroke-width="1.5" />

  <!-- Info -->
  <text x="110" y="90" class="name">${member.name}</text>
  <text x="110" y="110" class="username">@${member.username}</text>

  <!-- Stats Grid -->
  <!-- Level -->
  <text x="20" y="180" class="label">LEVEL</text>
  <text x="20" y="198" class="value">${member.level}</text>
  
  <!-- Points -->
  <text x="110" y="180" class="label">LOYALTY POINTS</text>
  <text x="110" y="198" class="value">${member.points.toLocaleString()} pts</text>

  <!-- XP -->
  <text x="260" y="180" class="label">XP</text>
  <text x="260" y="198" class="value">${member.xp.toLocaleString()} xp</text>

  <!-- Scanner line decoration -->
  <line x1="20" y1="222" x2="380" y2="222" stroke="#ff007f" stroke-width="1" stroke-dasharray="4,4" opacity="0.4" />
</svg>`;
};

export default function MemberProfilePage() {
  const router = useRouter();
  const params = useParams();
  const memberId = params.memberId as string;
  const { db, storage } = useFirebase();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

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

  const handleGenerateId = async () => {
    if (!storage || !db || !member) return;
    setGenerating(true);
    try {
      const uuid = typeof window !== 'undefined' && window.crypto?.randomUUID 
        ? window.crypto.randomUUID() 
        : Math.random().toString(36).substring(2) + Date.now().toString(36);
      
      const storageRef = ref(storage, `digital-ids/${uuid}.svg`);
      const svgContent = generateSvgIdCard(member);
      
      await uploadString(storageRef, svgContent, 'raw', { contentType: 'image/svg+xml' });
      const downloadUrl = await getDownloadURL(storageRef);
      
      const mRef = doc(db, 'members', member.id);
      await updateDoc(mRef, {
        digitalIdUrl: downloadUrl,
      });
      
      toast({
        title: 'Success!',
        description: 'Digital ID Card has been generated.',
      });
    } catch (err: any) {
      console.error('Error generating Digital ID:', err);
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: err.message || 'Something went wrong.',
      });
    } finally {
      setGenerating(false);
    }
  };

  const xpPerLevel = settings.xpPerLevel;
  const currentLevelXp = member.xp - ((member.level - 1) * xpPerLevel);
  const progressPercentage = (currentLevelXp / xpPerLevel) * 100;
  const scanUrl = typeof window !== 'undefined' ? `${window.location.origin}/scan?memberId=${member.id}` : '';

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

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="font-headline tracking-wide text-xl flex items-center gap-2">
                        <QrCode className="h-5 w-5" />
                        Digital ID Card
                    </CardTitle>
                    <CardDescription>
                        Generate a secure, off-domain scannable ID card.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 flex flex-col items-center">
                    {member.digitalIdUrl ? (
                        <div className="flex flex-col items-center gap-4 w-full">
                            <div className="bg-white p-3 rounded-xl border-2 shadow-sm flex items-center justify-center">
                                <QRCodeSVG value={scanUrl} size={150} />
                            </div>
                            
                            <div className="flex gap-2 w-full">
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="flex-1 font-bold">
                                            <Eye className="mr-2 h-4 w-4" />
                                            Preview ID
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-[440px] p-6 bg-zinc-950 border-zinc-800 text-white rounded-2xl flex flex-col items-center">
                                        <DialogHeader className="w-full text-center">
                                            <DialogTitle className="font-headline tracking-widest text-lg text-primary text-center">
                                                MEMBER DIGITAL ID
                                            </DialogTitle>
                                        </DialogHeader>
                                        <div 
                                            className="w-full border border-white/10 rounded-2xl overflow-hidden shadow-2xl mt-4"
                                            dangerouslySetInnerHTML={{ __html: generateSvgIdCard(member) }}
                                        />
                                        <div className="mt-6 flex flex-col items-center gap-2">
                                            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Scan to load profile</p>
                                            <div className="bg-white p-2 rounded-lg">
                                                <QRCodeSVG value={scanUrl} size={100} />
                                            </div>
                                        </div>
                                    </DialogContent>
                                </Dialog>

                                <Button 
                                    variant="secondary" 
                                    className="flex-1 font-bold"
                                    onClick={handleGenerateId}
                                    disabled={generating}
                                >
                                    {generating ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Regenerate
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full text-center py-6">
                            <p className="text-sm text-muted-foreground mb-4">No Digital ID generated for this member yet.</p>
                            <Button 
                                className="w-full font-bold"
                                onClick={handleGenerateId}
                                disabled={generating}
                                variant="default"
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Generating ID...
                                    </>
                                ) : (
                                    <>
                                        <QrCode className="mr-2 h-4 w-4" />
                                        Generate Digital ID
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </CardContent>
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
                                    <p className="font-bold text-sm uppercase">{r.packageName}</p>
                                    <Badge variant="outline" className="text-sm h-5 font-mono">{formatDuration(r.remainingDuration)} left</Badge>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground uppercase font-bold">
                                    <Clock className="h-3 w-3" /> Purchased: {format(new Date(r.purchaseDate), 'PP')}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-destructive uppercase font-bold">
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
