'use client';

import { useState } from 'react';
import type { Member, MemberTier } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Save, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logUserAction } from '@/firebase/firestore/logs';

interface EditMemberFormProps {
  member: Member;
  onUpdate: (member: Member) => void;
  onDelete: (memberId: string) => void;
}

export function EditMemberForm({ member, onUpdate, onDelete }: EditMemberFormProps) {
  const [name, setName] = useState(member.name);
  const [username, setUsername] = useState(member.username);
  const [phone, setPhone] = useState(member.phone || '');
  const [email, setEmail] = useState(member.email || '');
  const [tier, setTier] = useState<MemberTier>(member.tier);
  const [level, setLevel] = useState(String(member.level));
  const [xp, setXp] = useState(String(member.xp));
  const [points, setPoints] = useState(String(member.points));
  const initialTotalSeconds = (member.recharges || []).reduce((acc, r) => acc + r.remainingDuration, 0);
  const [rechargeHours, setRechargeHours] = useState(String(Math.floor(initialTotalSeconds / 3600)));
  const [rechargeMinutes, setRechargeMinutes] = useState(String(Math.floor((initialTotalSeconds % 3600) / 60)));
  const { toast } = useToast();



  const handleUpdate = () => {
    const levelNum = parseInt(level, 10);
    const xpNum = parseInt(xp, 10);
    const pointsNum = parseInt(points, 10);
    
    const h = parseInt(rechargeHours, 10) || 0;
    const m = parseInt(rechargeMinutes, 10) || 0;
    const newTotalSeconds = (h * 3600) + (m * 60);

    if (!name || !username || isNaN(levelNum) || isNaN(xpNum) || isNaN(pointsNum) || isNaN(newTotalSeconds)) {

      toast({
        variant: 'destructive',
        title: 'Invalid Information',
        description: 'Please ensure all fields are filled out correctly.',
      });
      return;
    }

    // Handle Recharge duration adjustments
    let updatedRecharges = (member.recharges || []).map(r => ({ ...r }));
    const currentTotalSeconds = updatedRecharges.reduce((acc, r) => acc + r.remainingDuration, 0);
    const diff = newTotalSeconds - currentTotalSeconds;

    if (diff > 0) {
      // Add a manual adjustment pack
      updatedRecharges.push({
          id: `manual-${Date.now()}`,
          packageId: 'manual',
          packageName: 'Manual Adjustment',
          totalDuration: diff,
          remainingDuration: diff,
          purchaseDate: new Date().toISOString(),
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          pricePaid: 0
      });
    } else if (diff < 0) {
      // Subtract from recharges starting from last
      let toSubtract = Math.abs(diff);
      for (let i = updatedRecharges.length - 1; i >= 0 && toSubtract > 0; i--) {
          const deduct = Math.min(updatedRecharges[i].remainingDuration, toSubtract);
          updatedRecharges[i] = {
            ...updatedRecharges[i],
            remainingDuration: updatedRecharges[i].remainingDuration - deduct
          };
          toSubtract -= deduct;
      }
    }

    const updatedMember = { 
        ...member, 
        name, 
        username, 
        phone, 
        email, 
        tier,
        level: levelNum,
        xp: xpNum,
        points: pointsNum,
        recharges: updatedRecharges,
    };

    onUpdate(updatedMember);
    logUserAction(`Updated member profile for ${member.name}.`, { memberId: member.id, updates: updatedMember });
    toast({
      title: 'Member Updated',
      description: `Details for ${name} have been saved.`,
    });
  };

  const handleDelete = () => {
    onDelete(member.id);
    logUserAction(`Deleted member ${member.name}.`, { memberId: member.id, memberName: member.name });
    toast({
      variant: 'destructive',
      title: 'Member Deleted',
      description: `${member.name} has been removed from the system.`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline tracking-wide text-2xl">Member Information</CardTitle>
        <CardDescription>Update the member's details below.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
        </div>
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="level">Level</Label>
                <Input id="level" type="number" value={level} onChange={(e) => setLevel(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="xp">Experience Points (XP)</Label>
                <Input id="xp" type="number" value={xp} onChange={(e) => setXp(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="points">Loyalty Points</Label>
                <Input id="points" type="number" value={points} onChange={(e) => setPoints(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Gaming Balance</Label>
                <div className="flex gap-2">
                    <div className="flex-1">
                        <Input 
                            id="rechargeHours" 
                            type="number" 
                            placeholder="Hours" 
                            value={rechargeHours} 
                            onChange={(e) => setRechargeHours(e.target.value)} 
                        />
                        <p className="text-[9px] font-bold uppercase text-muted-foreground mt-1 text-center">Hours</p>
                    </div>
                    <div className="flex-1">
                        <Input 
                            id="rechargeMinutes" 
                            type="number" 
                            placeholder="Mins" 
                            value={rechargeMinutes} 
                            onChange={(e) => setRechargeMinutes(e.target.value)} 
                        />
                        <p className="text-[9px] font-bold uppercase text-muted-foreground mt-1 text-center">Minutes</p>
                    </div>
                </div>
            </div>


            <div className="space-y-2">
                <Label htmlFor="tier">Membership Tier</Label>
                <Select value={tier} onValueChange={(value) => setTier(value as MemberTier)}>
                    <SelectTrigger id="tier">
                        <SelectValue placeholder="Select tier" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Red">Red (1x XP)</SelectItem>
                        <SelectItem value="Green">Green (1.5x XP)</SelectItem>
                        <SelectItem value="Gold">Gold (2x XP)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
                variant="destructive" 
                className="font-bold"
                onClick={() => logUserAction(`Opened 'Delete Member' dialog for ${member.name}.`)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Member
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                member and remove their data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => logUserAction('Cancelled member deletion.')}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                Yes, delete member
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button onClick={handleUpdate} className="font-bold">
          <Save className="mr-2 h-4 w-4" />
          Update Member
        </Button>
      </CardFooter>
    </Card>
  );
}
