
'use client';
import { useState, useMemo } from 'react';
import type { GamingPackage, GamingPackageFormData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Trash, Edit, Clock, IndianRupee, Gamepad2, Search, ArrowUpDown } from 'lucide-react';
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
import { addGamingPackage, updateGamingPackage, deleteGamingPackage } from '@/firebase/firestore/gaming-packages';
import { GamingPackageFormModal } from './gaming-package-form-modal';
import { logUserAction } from '@/firebase/firestore/logs';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';

type SortKey = 'name' | 'purpose' | 'duration' | 'price';

export function GamingPackagesManager() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<GamingPackage | null>(null);
  
  // Filter & Sort State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

  const packagesCollection = useMemo(() => {
    if (!db) return null;
    return collection(db, 'gamingPackages');
  }, [db]);

  const { data: packages, loading, error } = useCollection<GamingPackage>(packagesCollection);

  const handleSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedPackages = useMemo(() => {
    if (!packages) return [];
    
    let list = packages.filter(pkg => 
        pkg.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortConfig) {
        list.sort((a, b) => {
            let aValue: any;
            let bValue: any;

            if (sortConfig.key === 'purpose') {
                const getPurposeRank = (p: GamingPackage) => {
                    if (p.isPriorityOffer) return 1;
                    if (p.isBoardGamePass) return 2;
                    if (p.isRechargePack) return 3;
                    if (p.isAddTimePackage) return 4;
                    return 5;
                };
                aValue = getPurposeRank(a);
                bValue = getPurposeRank(b);
            } else {
                aValue = a[sortConfig.key as keyof GamingPackage];
                bValue = b[sortConfig.key as keyof GamingPackage];
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    } else {
        // Default sort: Priority first, then Board Games, then name
        list.sort((a, b) => {
            if (a.isPriorityOffer && !b.isPriorityOffer) return -1;
            if (!a.isPriorityOffer && b.isPriorityOffer) return 1;
            if (a.isBoardGamePass && !b.isBoardGamePass) return -1;
            if (!a.isBoardGamePass && b.isBoardGamePass) return 1;
            return a.name.localeCompare(b.name);
        });
    }

    return list;
  }, [packages, searchTerm, sortConfig]);

  const handleAdd = () => {
    setSelectedPackage(null);
    setModalOpen(true);
    logUserAction("Clicked 'Add Gaming Package' button.");
  };

  const handleEdit = (pkg: GamingPackage) => {
    setSelectedPackage(pkg);
    setModalOpen(true);
    logUserAction(`Clicked 'Edit' for gaming package '${pkg.name}'.`, { packageId: pkg.id });
  };

  const handleDelete = (pkg: GamingPackage) => {
    deleteGamingPackage(pkg.id, pkg.name);
    toast({
      variant: 'destructive',
      title: 'Package Deleted',
      description: `${pkg.name} has been removed.`,
    });
  };
  
  const handleSave = (formData: GamingPackageFormData) => {
    if(selectedPackage) {
      updateGamingPackage(selectedPackage.id, formData);
       toast({
        title: 'Package Updated',
        description: `${formData.name} has been successfully updated.`,
      });
    } else {
      addGamingPackage(formData);
      toast({
        title: 'Package Added',
        description: `${formData.name} has been successfully created.`,
      });
    }
  }

  const formatDuration = (totalSeconds: number) => {
    if (!totalSeconds || totalSeconds < 0) return '0s';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes > 0 ? minutes + 'm' : ''}`;
    return `${minutes}m`;
  };

  const SortableHeader = ({ label, sortKey, className }: { label: string, sortKey: SortKey, className?: string }) => (
    <TableHead className={cn("p-0 bg-muted/30", className)}>
        <button 
            onClick={() => handleSort(sortKey)}
            className="w-full h-full px-4 py-3 flex items-center justify-start gap-2 hover:bg-primary/5 transition-colors font-black uppercase text-[10px]"
        >
            {label}
            <ArrowUpDown className={cn(
                "h-3 w-3 transition-opacity", 
                sortConfig?.key === sortKey ? "opacity-100" : "opacity-20"
            )} />
        </button>
    </TableHead>
  );

  return (
    <Card className="border-2 shadow-none overflow-hidden font-body">
      <CardHeader className="bg-muted/10 border-b">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="font-headline tracking-wide text-2xl flex items-center gap-2">
                <Gamepad2 className="h-6 w-6 text-primary" />
                Session Packages
            </CardTitle>
            <CardDescription className="font-bold text-xs uppercase tracking-widest">Manage console rates, table passes, and add-time offers.</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search packages..." 
                    className="pl-10 h-10 border-2 font-bold text-xs uppercase bg-background"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <Button size="sm" className="w-full sm:w-auto font-black uppercase tracking-tight h-10 shadow-lg" onClick={handleAdd}>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Package
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading && (
            <div className="py-20 text-center opacity-50 font-bold uppercase tracking-widest animate-pulse">
                Loading Catalog...
            </div>
        )}
        {error && <div className="p-8 text-destructive text-center font-bold">Error loading packages: {error.message}</div>}
        
        {!loading && !error && (
          <ScrollArea className="h-[600px]">
            <Table>
                <TableHeader className="sticky top-0 z-10 shadow-sm">
                <TableRow>
                    <SortableHeader label="Package Name" sortKey="name" />
                    <SortableHeader label="Purpose" sortKey="purpose" />
                    <SortableHeader label="Duration" sortKey="duration" className="text-center" />
                    <SortableHeader label="Price" sortKey="price" className="text-center" />
                    <TableHead className="text-right font-black uppercase text-[10px] bg-muted/30 pr-6">Actions</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {filteredAndSortedPackages.map((pkg) => (
                    <TableRow key={pkg.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="font-black uppercase text-xs sm:text-sm py-4">{pkg.name}</TableCell>
                    <TableCell>
                        <div className="flex gap-1.5">
                            {pkg.isPriorityOffer && <Badge variant="outline" className="text-[8px] h-4 uppercase bg-amber-500/10 text-amber-600 border-amber-500/20">PRIORITY</Badge>}
                            {pkg.isBoardGamePass && <Badge variant="outline" className="text-[8px] h-4 uppercase bg-blue-500/10 text-blue-600 border-blue-500/20">BOARD GAME</Badge>}
                            {pkg.isRechargePack && <Badge variant="outline" className="text-[8px] h-4 uppercase bg-yellow-500/10 text-yellow-600 border-yellow-500/20">RECHARGE</Badge>}
                            {pkg.isAddTimePackage && <Badge variant="outline" className="text-[8px] h-4 uppercase bg-primary/10 text-primary border-primary/20">ADD TIME</Badge>}
                            {!pkg.isBoardGamePass && !pkg.isRechargePack && !pkg.isAddTimePackage && <Badge variant="outline" className="text-[8px] h-4 uppercase bg-green-500/10 text-green-600 border-green-500/20">WALK-IN</Badge>}
                        </div>
                    </TableCell>
                    <TableCell className="text-center">
                        <span className="font-mono font-bold text-xs">{formatDuration(pkg.duration)}</span>
                    </TableCell>
                    <TableCell className="text-center">
                        <span className="font-mono font-black text-sm text-primary">₹{pkg.price.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                        <AlertDialog>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Toggle menu</span>
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 font-body">
                            <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50">Actions</DropdownMenuLabel>
                            <DropdownMenuItem onSelect={() => handleEdit(pkg)} className="font-bold text-xs">
                                <Edit className="mr-2 h-3.5 w-3.5" /> Edit Details
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive font-bold text-xs" onSelect={() => logUserAction(`Opened delete for ${pkg.name}`)}>
                                    <Trash className="mr-2 h-3.5 w-3.5" /> Remove
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <AlertDialogContent className="border-4 border-destructive font-body">
                            <AlertDialogHeader>
                            <AlertDialogTitle className="font-headline text-lg text-destructive uppercase tracking-tighter">Delete Package?</AlertDialogTitle>
                            <AlertDialogDescription className="font-bold text-foreground">
                                This will permanently delete <strong>{pkg.name}</strong> from the system.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2">
                            <AlertDialogCancel className="font-bold">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(pkg)} className="bg-destructive hover:bg-destructive/90 font-bold uppercase shadow-lg">Confirm Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                    </TableRow>
                ))}
                {filteredAndSortedPackages.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={5} className="h-48 text-center bg-muted/5">
                            <div className="flex flex-col items-center justify-center opacity-30">
                                <Search className="h-10 w-10 mb-2" />
                                <p className="font-headline text-xs tracking-widest">No matching packages found</p>
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
