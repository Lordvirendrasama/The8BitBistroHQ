'use client';

import { useState } from 'react';
import type { Member, MemberTier } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from '@/hooks/use-toast';
import { UserPlus, UserPlus2 } from 'lucide-react';
import { logUserAction } from '@/firebase/firestore/logs';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { PlaceHolderImages } from '@/lib/placeholder-images';

interface AddMemberModalProps {
  onAddMember: (formData: { memberData: Omit<Member, 'id' | 'level' | 'xp' | 'points' | 'totalSpent' | 'joinDate' | 'avatarUrl'>, avatarUrl: string, referrerId?: string }) => void;
  buttonClassName?: string;
  triggerButton?: React.ReactNode;
  referrerId?: string;
}

export function AddMemberModal({ onAddMember, buttonClassName, triggerButton, referrerId }: AddMemberModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [noContact, setNoContact] = useState(false);
  const [consent, setConsent] = useState(false);
  const { toast } = useToast();

  const handleAddMember = () => {
    if (!name || !username) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please enter a full name and username.',
      });
      return;
    }
    
    let tier: MemberTier;
    let memberEmail: string | undefined = email.trim() !== '' ? email : undefined;
    let memberPhone: string | undefined = phone.trim() !== '' ? phone : undefined;

    if (noContact) {
        tier = 'Red';
        memberEmail = undefined;
        memberPhone = undefined;
    } else {
        if (memberEmail && memberPhone) {
            tier = 'Green';
        } else {
            tier = 'Red';
        }
    }
    
    const memberData = { 
        name, 
        username,
        email: memberEmail,
        phone: memberPhone,
        tier
    };

    const randomAvatar = PlaceHolderImages[Math.floor(Math.random() * PlaceHolderImages.length)];

    onAddMember({ memberData, avatarUrl: randomAvatar.imageUrl, referrerId });
    
    const logDetails: Record<string, any> = { name, username, tier };
    if (referrerId) {
      logDetails.referrerId = referrerId;
    }
    logUserAction(`Clicked 'Create Member' button.`, logDetails);

    toast({
      title: 'Member Added',
      description: `${name} has been successfully added.`,
    });
    
    // Reset form
    setName('');
    setUsername('');
    setEmail('');
    setPhone('');
    setNoContact(false);
    setConsent(false);
    setIsOpen(false);
  };
  
  const handleNoContactChange = (checked: boolean) => {
    setNoContact(checked);
    if (checked) {
      setConsent(false);
    }
  };

  const handleConsentChange = (checked: boolean) => {
    setConsent(checked);
    if (checked) {
      setNoContact(false);
    }
  };

  const defaultTrigger = (
    <Button 
      className={cn("bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground font-bold h-full", buttonClassName)}
      onClick={() => logUserAction("Clicked 'Add Member' dialog trigger.")}
    >
      <UserPlus className="mr-2 h-4 w-4" />
      Add Member
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        { triggerButton ? triggerButton : defaultTrigger }
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl flex items-center gap-2">
            <UserPlus2 />
            {referrerId ? 'Refer a New Member' : 'Add New Member'}
          </DialogTitle>
          <DialogDescription className="text-xs font-medium">
            {referrerId 
              ? 'Enter the details for the new member being referred.'
              : 'Enter the details for the new member to enroll them in the loyalty program.'
            }
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] -mx-6 px-6">
            <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-bold uppercase text-muted-foreground">Full Name</Label>
                <Input 
                id="name" 
                placeholder="e.g., John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="font-medium"
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="username" className="text-xs font-bold uppercase text-muted-foreground">Username</Label>
                <Input 
                id="username" 
                placeholder="e.g., NewPlayer99"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="font-medium"
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold uppercase text-muted-foreground">Email Address</Label>
                <Input 
                id="email" 
                type="email"
                placeholder="e.g., john.d@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={noContact}
                className="font-medium"
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs font-bold uppercase text-muted-foreground">Phone Number</Label>
                <Input 
                id="phone" 
                type="tel" 
                placeholder="e.g., 9876543210" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={noContact}
                className="font-medium"
                />
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg border-2 border-dashed bg-muted/5">
                <Checkbox id="no-contact" checked={noContact} onCheckedChange={handleNoContactChange} />
                <Label htmlFor="no-contact" className="text-xs font-semibold leading-tight cursor-pointer">
                Member does not wish to provide contact information (Red Tier).
                </Label>
            </div>
            </div>
        </ScrollArea>
        <DialogFooter className="flex-col gap-4 !mt-2 pt-4 border-t">
          <div className="flex items-start space-x-2">
            <Checkbox id="consent" checked={consent} onCheckedChange={handleConsentChange} disabled={noContact} />
            <Label htmlFor="consent" className={cn(
                "text-[10px] font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                noContact && "opacity-50"
            )}>
              I agree to receive promotional offers and updates from The 8 Bit Bistro on WhatsApp.
            </Label>
          </div>
          <Button onClick={handleAddMember} className="w-full font-bold h-12 shadow-lg" disabled={!consent && !noContact}>
            Agree and Create Member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}