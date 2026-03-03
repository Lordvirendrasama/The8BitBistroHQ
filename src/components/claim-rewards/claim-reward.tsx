'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Member, Reward, MemberTier, ClaimedReward } from '@/lib/types';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';
import { updateMember, recordClaimedReward } from '@/firebase/firestore/members';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coins, Gift, Star, CheckCircle2, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase/provider';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { logUserAction } from '@/firebase/firestore/logs';

interface ClaimRewardProps {
  initialMemberId?: string | null;
}


const tierColors: Record<MemberTier, string> = {
    Red: 'bg-red-500/20 text-red-500 border-red-500/50',
    Green: 'bg-green-500/20 text-green-500 border-green-500/50',
    Gold: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50',
}

export function ClaimReward({ initialMemberId }: ClaimRewardProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(initialMemberId || null);
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);
  const { toast } = useToast();
  const { db } = useFirebase();

  const membersCollection = useMemo(() => {
    if (!db) return null;
    return collection(db, 'members');
  }, [db]);
  
  const rewardsCollection = useMemo(() => {
    if (!db) return null;
    return collection(db, 'rewards');
  }, [db]);
  
  const claimedRewardsCollection = useMemo(() => {
    if (!db || !selectedMemberId) return null;
    return collection(db, 'members', selectedMemberId, 'claimedRewards');
  }, [db, selectedMemberId]);


  const { data: members, loading: membersLoading } = useCollection<Member>(membersCollection);
  const { data: rewards, loading: rewardsLoading } = useCollection<Reward>(rewardsCollection);
  const { data: claimedRewards } = useCollection<ClaimedReward>(claimedRewardsCollection);

  useEffect(() => {
    if (initialMemberId) {
      setSelectedMemberId(initialMemberId);
    }
  }, [initialMemberId]);

  const selectedMember = members?.find(m => m.id === selectedMemberId);
  const selectedReward = rewards?.find(r => r.id === selectedRewardId);

  const canClaim = selectedMember && selectedReward && selectedMember.points >= selectedReward.pointsCost;

  const handleClaim = () => {
    if (!selectedMember || !selectedReward) return;

    if (!canClaim) {
      toast({
        variant: 'destructive',
        title: 'Unable to Claim',
        description: `${selectedMember.name} does not meet the requirements to claim ${selectedReward.name}.`,
      });
      return;
    }
    
    const updatedPoints = selectedMember.points - selectedReward.pointsCost;
    updateMember(selectedMember.id, { points: updatedPoints });
    recordClaimedReward(selectedMember, selectedReward);

    logUserAction(`Claimed reward '${selectedReward.name}' for ${selectedMember.name}.`, {
        memberId: selectedMember.id,
        memberName: selectedMember.name,
        rewardId: selectedReward.id,
        rewardName: selectedReward.name,
        pointsCost: selectedReward.pointsCost
    });

    toast({
      title: 'Reward Claimed!',
      description: `${selectedMember.name} has redeemed ${selectedReward.name} for ${selectedReward.pointsCost} points.`,
    });
    
    setSelectedRewardId(null);
  };

  const handleSelectReward = (reward: Reward) => {
    logUserAction(`Selected reward '${reward.name}' to claim for ${selectedMember?.name}.`, {
      rewardId: reward.id,
      rewardName: reward.name,
    });
    setSelectedRewardId(reward.id)
  }
  
  if (membersLoading || rewardsLoading) return <Card><CardHeader><CardTitle>Claim Rewards</CardTitle></CardHeader><CardContent>Loading...</CardContent></Card>;

  return (
    <>
    {!initialMemberId && (
        <Card className="mb-8">
            <CardHeader>
                <CardTitle className="font-headline tracking-wide text-2xl">Select Member</CardTitle>
            </CardHeader>
            <CardContent>
                <Select value={selectedMemberId || ''} onValueChange={setSelectedMemberId}>
                    <SelectTrigger>
                    <SelectValue placeholder="Select a member to claim rewards for" />
                    </SelectTrigger>
                    <SelectContent>
                    {members?.map(member => (
                        <SelectItem key={member.id} value={member.id}>
                        <div className="flex items-center justify-between w-full">
                            <span>{member.name}</span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Coins className="h-3 w-3 text-yellow-500" />
                                {member.points.toLocaleString()}
                            </span>
                        </div>
                        </SelectItem>
                    ))}
                    </SelectContent>
                </Select>
            </CardContent>
        </Card>
    )}
    
    {selectedMember && (
      <Card>
        <CardHeader>
          <div className="flex flex-col items-center sm:flex-row sm:gap-6">
              <Avatar className="h-24 w-24 border-4 border-primary/50">
                  <Image src={selectedMember.avatarUrl} alt={selectedMember.name} width={96} height={96} />
                  <AvatarFallback>{selectedMember.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="text-center sm:text-left mt-4 sm:mt-0">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <CardTitle className="font-headline tracking-wider text-3xl">{selectedMember.name}</CardTitle>
                    <Badge variant="outline" className={cn("text-sm font-bold", tierColors[selectedMember.tier])}>
                        {selectedMember.tier} Tier
                    </Badge>
                  </div>
                  <CardDescription className="text-lg">
                      Level {selectedMember.level} &bull; @{selectedMember.username}
                  </CardDescription>
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-2xl font-bold text-yellow-500 pt-2">
                      <Coins className="h-7 w-7" />
                      <span>{selectedMember.points.toLocaleString()} Points Available</span>
                  </div>
              </div>
          </div>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(rewards || []).map(reward => {
                    const isSelected = reward.id === selectedRewardId;
                    const canAfford = selectedMember.points >= reward.pointsCost;
                    const levelMet = selectedMember.level >= reward.levelRequired;
                    const alreadyClaimed = reward.limitOnePerUser && claimedRewards?.some(cr => cr.rewardId === reward.id);
                    const isAvailable = canAfford && levelMet && !alreadyClaimed;

                    return (
                        <button
                            key={reward.id}
                            disabled={!isAvailable}
                            onClick={() => handleSelectReward(reward)}
                            className={cn(
                                "text-left p-0 rounded-lg border bg-card text-card-foreground shadow-sm transition-all relative overflow-hidden",
                                isSelected && "ring-4 ring-primary",
                                !isAvailable && "opacity-50 bg-muted",
                                isAvailable && "hover:shadow-md hover:scale-105"
                            )}
                        >
                            <Card className="border-0 shadow-none flex flex-col h-full">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle>{reward.name}</CardTitle>
                                            <CardDescription>{reward.description}</CardDescription>
                                        </div>
                                        {reward.limitOnePerUser && <Badge variant="outline"><RotateCcw className="w-3 h-3 mr-1"/>Once</Badge>}
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow flex items-end justify-between">
                                    <div className="flex items-center gap-2 text-lg font-bold text-yellow-500">
                                        <Coins className="h-5 w-5" />
                                        <span>{reward.pointsCost.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-lg font-bold text-primary">
                                        <Star className="h-5 w-5" />
                                        <span>Lvl {reward.levelRequired}+</span>
                                    </div>
                                </CardContent>
                                {isSelected && (
                                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                        <CheckCircle2 className="h-16 w-16 text-primary" />
                                    </div>
                                )}
                                {!isAvailable && (
                                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                                        <div className="text-center font-bold text-destructive p-2">
                                            {alreadyClaimed && <p>Already Claimed</p>}
                                            {!alreadyClaimed && !canAfford && <p>Not Enough Points</p>}
                                            {!alreadyClaimed && !levelMet && <p>Level {reward.levelRequired} Required</p>}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        </button>
                    )
                })}
            </div>
        </CardContent>
        {selectedReward && (
            <CardFooter className="flex-col items-stretch gap-4 p-4 mt-4 bg-muted/50 rounded-b-lg">
                <p className="text-center text-lg">
                    Confirm claiming <span className="font-bold text-primary">{selectedReward.name}</span> for <span className="font-bold text-yellow-500">{selectedReward.pointsCost}</span> points?
                </p>
                <Button onClick={handleClaim} disabled={!canClaim} className="w-full font-bold text-lg p-6">
                    <Gift className="mr-2 h-5 w-5" />
                    {canClaim ? 'Confirm & Claim Reward' : 'Cannot Claim'}
                </Button>
            </CardFooter>
        )}
      </Card>
    )}
    </>
  );
}
