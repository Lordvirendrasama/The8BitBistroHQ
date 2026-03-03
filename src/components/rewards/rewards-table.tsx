'use client';
import { useState, useMemo } from 'react';
import type { Reward } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Trash, Edit, Coins } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import { addReward, updateReward, deleteReward } from '@/firebase/firestore/rewards';
import { RewardFormModal } from './reward-form-modal';
import type { RewardFormData } from '@/lib/types';
import { logUserAction } from '@/firebase/firestore/logs';

export function RewardsTable() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);

  const rewardsCollection = useMemo(() => {
    if (!db) return null;
    return collection(db, 'rewards');
  }, [db]);

  const { data: rewards, loading, error } = useCollection<Reward>(rewardsCollection);

  const handleAdd = () => {
    setSelectedReward(null);
    setModalOpen(true);
    logUserAction("Clicked 'Add Reward' button.");
  };

  const handleEdit = (reward: Reward) => {
    setSelectedReward(reward);
    setModalOpen(true);
    logUserAction(`Clicked 'Edit' for reward '${reward.name}'.`, { rewardId: reward.id });
  };

  const handleDelete = (reward: Reward) => {
    deleteReward(reward.id, reward.name);
    toast({
      variant: 'destructive',
      title: 'Reward Deleted',
      description: `${reward.name} has been removed.`,
    });
  };
  
  const handleSave = (formData: RewardFormData) => {
    if(selectedReward) {
      updateReward(selectedReward.id, formData);
       toast({
        title: 'Reward Updated',
        description: `${formData.name} has been successfully updated.`,
      });
    } else {
      addReward(formData);
      toast({
        title: 'Reward Added',
        description: `${formData.name} has been successfully created.`,
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-headline tracking-wide text-2xl">Manage Rewards</CardTitle>
            <CardDescription>Add, edit, or remove rewards available to members.</CardDescription>
          </div>
          <Button size="sm" className="font-bold tracking-wider" onClick={handleAdd}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Reward
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && <p>Loading rewards...</p>}
        {error && <p className="text-destructive">Error loading rewards.</p>}
        {rewards && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reward Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Level Required</TableHead>
                <TableHead className="text-center">Points Cost</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rewards.map((reward) => (
                <TableRow key={reward.id}>
                  <TableCell className="font-medium">{reward.name}</TableCell>
                  <TableCell className="text-muted-foreground">{reward.description}</TableCell>
                  <TableCell className="text-center font-bold text-lg">{reward.levelRequired}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2 font-bold text-lg text-yellow-500">
                      <Coins className="h-5 w-5" />
                      <span>{reward.pointsCost}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => handleEdit(reward)}>
                            <Edit className="mr-2 h-4 w-4" />Edit
                          </DropdownMenuItem>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem 
                                className="text-destructive"
                                onSelect={() => logUserAction(`Opened 'Delete Reward' dialog for ${reward.name}.`)}
                            >
                              <Trash className="mr-2 h-4 w-4" />Delete
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the reward <strong>{reward.name}</strong>. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => logUserAction('Cancelled reward deletion.')}>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(reward)} className="bg-destructive hover:bg-destructive/90">
                            Yes, delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <RewardFormModal 
        isOpen={modalOpen} 
        onOpenChange={setModalOpen}
        onSave={handleSave}
        reward={selectedReward}
      />
    </Card>
  );
}
