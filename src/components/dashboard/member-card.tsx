
'use client';

import { useState } from 'react';
import type { Member, MemberTier } from '@/lib/types';
import { settings } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { GrantXpModal } from './grant-xp-modal';
import Image from 'next/image';
import { Coins, Eye, Phone, User, FileWarning, Zap, Clock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { useToast } from '@/hooks/use-toast';
import { logUserAction } from '@/firebase/firestore/logs';
import { AddPendingModal } from './add-pending-modal';
import { updateMember } from '@/firebase/firestore/members';
import { RechargeModal } from './recharge-modal';


interface MemberCardProps {
  member: Member;
  onGrantXp?: (memberId: string, xpGained: number, billAmount: number) => void;
}

const tierColors: Record<MemberTier, string> = {
    Red: 'bg-red-500/20 text-red-500 border-red-500/50',
    Green: 'bg-green-500/20 text-green-500 border-green-500/50',
    Gold: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50',
}

export function MemberCard({ 
  member, 
  onGrantXp, 
}: MemberCardProps) {
  const { toast } = useToast();
  const [isRechargeOpen, setIsRechargeOpen] = useState(false);

  const xpPerLevel = settings.xpPerLevel;
  const currentLevelXp = member.xp - ((member.level - 1) * xpPerLevel);
  const progressPercentage = (currentLevelXp / xpPerLevel) * 100;

  const handleCopy = (text: string, type: string) => {
    if (!text) {
        toast({
            variant: 'destructive',
            title: `No ${type} available`,
            description: `${member.name} does not have a ${type.toLowerCase()} saved.`,
        });
        return;
    }
    navigator.clipboard.writeText(text);
    logUserAction(`Copied ${type} for ${member.name}.`, { memberId: member.id, [`copied${type}`]: text });
    toast({
        title: `${type} Copied!`,
        description: `Copied: ${text}`,
    });
  }

  const handleAddPending = (memberId: string, amount: number) => {
    updateMember(memberId, { pendingAmount: amount });
    logUserAction(`Added pending amount of ₹${amount} for ${member.name}.`, { memberId, amount });
    toast({
      title: 'Pending Amount Added',
      description: `${member.name} now has a pending balance of ₹${amount}.`,
    });
  };

  const handleClearPending = (memberId: string) => {
    updateMember(memberId, { pendingAmount: 0 });
    logUserAction(`Cleared pending balance for ${member.name}.`, { memberId });
    toast({
      title: 'Pending Balance Cleared',
      description: `The pending balance for ${member.name} has been cleared.`,
    });
  };
  
  const isGold = member.tier === 'Gold';
  const hasPending = member.pendingAmount && member.pendingAmount > 0;

  // Calculate total prepaid balance with exact formatting
  const activeRecharges = (member.recharges || []).filter(r => new Date(r.expiryDate) > new Date() && r.remainingDuration > 0);
  const totalBalanceSeconds = activeRecharges.reduce((sum, r) => sum + r.remainingDuration, 0);
  
  const formatBalance = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <Card 
        id={`member-card-${member.id}`}
        className={cn(
            "flex flex-col transition-all duration-300 relative w-full",
            isGold && "bg-gradient-to-b from-yellow-300/20 to-yellow-600/20 border-yellow-500/80 text-foreground",
            hasPending && "border-destructive ring-2 ring-destructive/50"
        )}
    >
      <CardHeader className={cn("flex flex-col items-center text-center p-3 pb-2")}>
        <Avatar className={cn(
            "border-2 border-primary/50 mb-2", 
            "h-14 w-14",
            isGold && "border-yellow-400"
        )}>
           <Image src={member.avatarUrl} alt={member.name} width={56} height={56} data-ai-hint="pixel avatar" />
          <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col items-center gap-1">
            <CardTitle className={cn("font-black tracking-tight", "text-xl")}>{member.name}</CardTitle>
            <Badge variant="outline" className={cn("text-[10px] font-black uppercase px-2", tierColors[member.tier])}>
                {member.tier} Tier
            </Badge>
        </div>
        <CardDescription className={cn('text-xs font-medium', isGold && 'text-foreground/80')}>@{member.username} &bull; Level {member.level}</CardDescription>
        <div className="flex items-center gap-4 mt-1">
            <div className={cn("flex items-center gap-1", isGold ? "text-yellow-600 dark:text-yellow-400" : "text-yellow-500")}>
                <Coins className="h-4 w-4" />
                <span className="font-black text-lg">{member.points.toLocaleString()}</span>
            </div>
            {totalBalanceSeconds > 0 && (
                <div className="flex items-center gap-1 text-primary">
                    <Zap className="h-4 w-4 fill-current" />
                    <span className="font-black text-lg">{formatBalance(totalBalanceSeconds)}</span>
                </div>
            )}
        </div>
      </CardHeader>
      <CardContent className={cn("px-3 pb-2 pt-0")}>
        {hasPending && (
          <div className="mb-2 text-center font-bold text-destructive flex items-center justify-center gap-2 bg-destructive/10 py-1 rounded">
            <FileWarning className="h-4 w-4" />
            PENDING: ₹{member.pendingAmount?.toLocaleString()}
          </div>
        )}
        <div>
          <div className="mb-1 flex justify-between text-[10px] uppercase font-bold text-muted-foreground">
            <span>Level {member.level + 1} Progress</span>
            <span>
              {currentLevelXp.toLocaleString()} / {xpPerLevel.toLocaleString()} XP
            </span>
          </div>
          <Progress value={progressPercentage} className={cn("h-2")} indicatorClassName="bg-green-500" />
        </div>
      </CardContent>
      {onGrantXp && (
        <CardFooter className="flex-col gap-2 p-2 pt-0">
          <div className="w-full flex text-[10px] font-bold text-muted-foreground justify-between px-1 mb-1 uppercase tracking-tighter">
            <span>Joined {new Date(member.joinDate).toLocaleDateString()}</span>
            <span>Spent ₹{member.totalSpent.toLocaleString()}</span>
          </div>
          <div className="w-full grid grid-cols-2 gap-2">
            <Button 
                variant="secondary" 
                className="font-black uppercase text-[10px] tracking-widest bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 border border-yellow-500/20"
                onClick={() => setIsRechargeOpen(true)}
            >
                <Zap className="mr-1.5 h-3.5 w-3.5" /> Recharge
            </Button>
            <Button asChild variant="secondary" className="font-bold tracking-wider text-xs">
                <Link href={`/claim-rewards?memberId=${member.id}`}>
                    Rewards
                </Link>
            </Button>
            <Button variant="secondary" className="font-bold text-xs" onClick={() => handleCopy(member.name, 'Name')}>
                <User className="mr-2 h-3.5 w-3.5" />
                Name
            </Button>
            <Button variant="secondary" className="font-bold text-xs" onClick={() => handleCopy(member.phone || '', 'Number')}>
                <Phone className="mr-2 h-3.5 w-3.5" />
                Phone
            </Button>
            {hasPending ? (
              <Button variant="destructive" className="font-bold text-xs" onClick={() => handleClearPending(member.id)}>
                <FileWarning className="mr-2 h-3.5 w-3.5" />
                Clear Due
              </Button>
            ) : (
              <AddPendingModal member={member} onAddPending={handleAddPending} />
            )}
            <Button asChild variant="secondary" className="font-bold tracking-wider text-xs">
                <Link href={`/members/${member.id}`}>
                    <Eye className="mr-2 h-3.5 w-3.5" />
                    Profile
                </Link>
            </Button>
          </div>
        </CardFooter>
      )}
      
      <RechargeModal 
        isOpen={isRechargeOpen} 
        onOpenChange={setIsRechargeOpen} 
        member={member} 
      />
    </Card>
  );
}
