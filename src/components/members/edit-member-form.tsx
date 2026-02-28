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
  const { toast } = useToast();

  const handleUpdate = () => {
    const levelNum = parseInt(level, 10);
    const xpNum = parseInt(xp, 10);
    const pointsNum = parseInt(points, 10);

    if (!name || !username || isNaN(levelNum) || isNaN(xpNum) || isNaN(pointsNum)) {
      toast({
        variant: 'destructive',
        title: 'Invalid Information',
        description: 'Please ensure all fields are filled out correctly.',
      });
      return;
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
