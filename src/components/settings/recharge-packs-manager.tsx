'use client';
import { useState, useMemo } from 'react';
import type { GamingPackage, GamingPackageFormData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Trash, Edit, Clock, Calendar, IndianRupee, Zap } from 'lucide-react';
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
import { collection, query, where } from 'firebase/firestore';
import { addGamingPackage, updateGamingPackage, deleteGamingPackage } from '@/firebase/firestore/gaming-packages';
import { GamingPackageFormModal } from './gaming-package-form-modal';
import { logUserAction } from '@/firebase/firestore/logs';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';

export function RechargePacksManager() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<GamingPackage | null>(null);

  // Specifically fetch packages intended for Recharges
  const packagesQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'gamingPackages'), where('isRechargePack', '==', true));
  }, [db]);

  const { data: packages, loading, error } = useCollection<GamingPackage>(packagesQuery);

  const handleAdd = () => {
    setSelectedPackage(null);
    setModalOpen(true);
    logUserAction("Clicked 'Add Recharge Pack' button.");
  };

  const handleEdit = (pkg: GamingPackage) => {
    setSelectedPackage(pkg);
    setModalOpen(true);
    logUserAction(`Clicked 'Edit' for recharge pack '${pkg.name}'.`, { packageId: pkg.id });
  };

  const handleDelete = (pkg: GamingPackage) => {
    deleteGamingPackage(pkg.id, pkg.name);
    toast({
      variant: 'destructive',
      title: 'Recharge Pack Deleted',
      description: `${pkg.name} has been removed.`,
    });
  };
  
  const handleSave = (formData: GamingPackageFormData) => {
    const data = { ...formData, isRechargePack: true }; // Force recharge pack flag
    if(selectedPackage) {
      updateGamingPackage(selectedPackage.id, data);
       toast({
        title: 'Recharge Pack Updated',
        description: `${formData.name} has been successfully updated.`,
      });
    } else {
      addGamingPackage(data);
      toast({
        title: 'Recharge Pack Added',
        description: `${formData.name} has been successfully created.`,
      });
    }
  }

  const formatDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes > 0 ? minutes + 'm' : ''}`;
    return `${minutes}m`;
  };

  return (
    <Card className="border-2 shadow-none overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="font-headline tracking-wide text-2xl flex items-center gap-2">
                <Zap className="h-6 w-6 text-yellow-500 fill-current" />
                Manage Recharge Packs
            </CardTitle>
            <CardDescription className="font-bold text-xs uppercase tracking-widest">Configure prepaid time packages for the Recharge Hub.</CardDescription>
          </div>
          <Button size="sm" className="font-black uppercase tracking-tight h-10 shadow-lg" onClick={handleAdd}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Recharge Pack
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && <div className="py-12 text-center opacity-50 font-bold uppercase tracking-widest animate-pulse">Loading Packs...</div>}
        {error && <p className="text-destructive">Error loading packages.</p>}
        {packages && (
          <ScrollArea className="h-[600px] rounded-xl border-2 border-dashed">
            <Table>
                <TableHeader className="bg-muted/30 sticky top-0 z-10 shadow-sm">
                <TableRow>
                    <TableHead className="font-black uppercase text-[10px] bg-muted/30 px-6">Pack Name</TableHead>
                    <TableHead className="text-center font-black uppercase text-[10px] bg-muted/30">Time</TableHead>
                    <TableHead className="text-center font-black uppercase text-[10px] bg-muted/30">Price</TableHead>
                    <TableHead className="text-center font-black uppercase text-[10px] bg-muted/30">Rate/Hr</TableHead>
                    <TableHead className="text-center font-black uppercase text-[10px] bg-muted/30">Validity</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px] bg-muted/30 pr-6">Actions</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {packages.map((pkg) => {
                    const hours = pkg.duration / 3600;
                    const ratePerHour = hours > 0 ? pkg.price / hours : 0;

                    return (
                        <TableRow key={pkg.id} className="hover:bg-muted/20">
                        <TableCell className="font-black uppercase text-xs sm:text-sm px-6">{pkg.name}</TableCell>
                        <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2 font-mono font-bold text-xs">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span>{formatDuration(pkg.duration)}</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1 font-mono font-black text-sm text-primary">
                                <span>₹{pkg.price}</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-center">
                            <div className="flex flex-col items-center justify-center">
                                <span className="font-mono font-bold text-xs text-foreground">₹{Math.round(ratePerHour)}</span>
                                <span className="text-[7px] font-black text-muted-foreground uppercase opacity-50 tracking-tighter">/ HOUR</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-center">
                            <Badge variant="outline" className="font-black uppercase text-[9px] h-5 border-primary/20 bg-primary/5">
                                {pkg.validity} Days
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                            <AlertDialog>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50">Actions</DropdownMenuLabel>
                                <DropdownMenuItem onSelect={() => handleEdit(pkg)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem className="text-destructive font-bold"><Trash className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                                </AlertDialogTrigger>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle className="font-headline text-lg text-destructive">Delete Recharge Pack?</AlertDialogTitle>
                                <AlertDialogDescription className="font-medium">
                                    This will remove <strong>{pkg.name}</strong> from the Recharge Hub. Existing members who already bought this pack will keep their balance.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel className="font-bold">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(pkg)} className="bg-destructive hover:bg-destructive/90 font-bold uppercase">Confirm Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                            </AlertDialog>
                        </TableCell>
                        </TableRow>
                    );
                })}
                {packages.length === 0 && !loading && (
                    <TableRow>
                        <TableCell colSpan={6} className="h-48 text-center bg-muted/5">
                            <div className="flex flex-col items-center justify-center opacity-30">
                                <Zap className="h-10 w-10 mb-2" />
                                <p className="font-headline text-xs tracking-widest">No recharge packs configured</p>
                            </div>
                        </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
      <GamingPackageFormModal 
        isOpen={modalOpen} 
        onOpenChange={setModalOpen}
        onSave={handleSave}
        pkg={selectedPackage}
      />
    </Card>
  );
}
