
'use client';
import { useState, useMemo } from 'react';
import type { GamingPackage, GamingPackageFormData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Trash, Edit, Clock, IndianRupee, Gamepad2, Search, ArrowUpDown, Sparkles, RefreshCw, Layers, Zap, ZapOff, CheckSquare, Plus } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import { 
  addGamingPackage, 
  updateGamingPackage, 
  deleteGamingPackage, 
  seedDefaultRateCardPackages, 
  convertAllGamingPackagesToRechargePacks,
  bulkUpdatePackageRechargeStatus,
  bulkUpdatePackageValidity,
  togglePackageRecharge
} from '@/firebase/firestore/gaming-packages';
import { GamingPackageFormModal } from './gaming-package-form-modal';
import { logUserAction } from '@/firebase/firestore/logs';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';

type SortKey = 'name' | 'purpose' | 'duration' | 'price';
type CategoryFilter = 'all' | 'ps5' | 'ps4' | 'retrogaming' | 'boardgame' | 'recharge';

export function GamingPackagesManager() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<GamingPackage | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  
  // Filter & Sort State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
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

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const count = await seedDefaultRateCardPackages();
      toast({
        title: 'Rate Card Populated!',
        description: `Successfully created ${count} rate packages for PS5, PS4, Board Games, and Retro Gaming.`,
      });
      logUserAction("Populated default rate card packages");
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Population Failed',
        description: 'Failed to populate default packages. Please try again.',
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const [isConverting, setIsConverting] = useState(false);

  const handleConvertAll = async () => {
    setIsConverting(true);
    try {
      const count = await convertAllGamingPackagesToRechargePacks();
      toast({
        title: 'Packages Converted!',
        description: `Successfully converted ${count} gaming packages to prepaid Recharge Packs (24-hour validity).`,
      });
      logUserAction("Converted gaming packages to recharge packs", { count });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Conversion Failed',
        description: 'Failed to convert packages to recharge packs.',
      });
    } finally {
      setIsConverting(false);
    }
  };

  const filteredAndSortedPackages = useMemo(() => {
    if (!packages) return [];
    
    let list = packages.filter(pkg => 
        pkg.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Category Filter
    if (selectedCategory === 'ps5') {
      list = list.filter(pkg => pkg.stationType === 'ps5' || pkg.name.toLowerCase().includes('ps5'));
    } else if (selectedCategory === 'ps4') {
      list = list.filter(pkg => pkg.stationType === 'ps4' || pkg.name.toLowerCase().includes('ps4'));
    } else if (selectedCategory === 'retrogaming') {
      list = list.filter(pkg => pkg.stationType === 'retrogaming' || pkg.isRetroGamePass || pkg.name.toLowerCase().includes('retro'));
    } else if (selectedCategory === 'boardgame') {
      list = list.filter(pkg => pkg.stationType === 'boardgame' || pkg.isBoardGamePass || pkg.name.toLowerCase().includes('board'));
    } else if (selectedCategory === 'recharge') {
      list = list.filter(pkg => pkg.isRechargePack);
    }

    if (sortConfig) {
        list.sort((a, b) => {
            let aValue: any;
            let bValue: any;

            if (sortConfig.key === 'purpose') {
                const getPurposeRank = (p: GamingPackage) => {
                    if (p.isPriorityOffer) return 1;
                    if (p.stationType === 'ps5') return 2;
                    if (p.stationType === 'ps4') return 3;
                    if (p.isBoardGamePass) return 4;
                    if (p.isRetroGamePass) return 5;
                    if (p.isRechargePack) return 6;
                    return 7;
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
        // Default sort: Priority first, then name
        list.sort((a, b) => {
            if (a.isPriorityOffer && !b.isPriorityOffer) return -1;
            if (!a.isPriorityOffer && b.isPriorityOffer) return 1;
            return a.name.localeCompare(b.name);
        });
    }

    return list;
  }, [packages, searchTerm, selectedCategory, sortConfig]);

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);

  // Quick Validity Dialog State
  const [validityModalState, setValidityModalState] = useState<{
    isOpen: boolean;
    packageIds: string[];
    currentValidity: number;
    title: string;
  }>({
    isOpen: false,
    packageIds: [],
    currentValidity: 1,
    title: '',
  });
  const [validityInput, setValidityInput] = useState('1');

  const isAllSelected = useMemo(() => {
    if (filteredAndSortedPackages.length === 0) return false;
    return filteredAndSortedPackages.every(p => selectedIds.has(p.id));
  }, [filteredAndSortedPackages, selectedIds]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedPackages.map(p => p.id)));
    }
  };

  const handleBulkSetRecharge = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsUpdatingBulk(true);
    try {
      await bulkUpdatePackageRechargeStatus(ids, true, 1);
      toast({
        title: 'Recharge Mode Enabled',
        description: `Marked ${ids.length} package(s) as Recharge Packs (24-hour validity).`,
      });
      setSelectedIds(new Set());
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Failed to update recharge status.',
      });
    } finally {
      setIsUpdatingBulk(false);
    }
  };

  const handleBulkRemoveRecharge = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsUpdatingBulk(true);
    try {
      await bulkUpdatePackageRechargeStatus(ids, false);
      toast({
        title: 'Recharge Mode Removed',
        description: `Removed ${ids.length} package(s) from Recharge Packs.`,
      });
      setSelectedIds(new Set());
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Failed to update recharge status.',
      });
    } finally {
      setIsUpdatingBulk(false);
    }
  };

  const handleToggleSingleRecharge = async (pkg: GamingPackage) => {
    try {
      const newStatus = await togglePackageRecharge(pkg.id, pkg.isRechargePack || false, pkg.validity || 1);
      toast({
        title: newStatus ? 'Recharge Enabled (24h)' : 'Recharge Disabled',
        description: `${pkg.name} is now ${newStatus ? 'a Recharge Pack (24h validity)' : 'a standard session package'}.`,
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Failed to toggle recharge status.',
      });
    }
  };

  const handleOpenValidityModal = (packageIds: string[], defaultValidity: number = 1, title?: string) => {
    setValidityInput(String(defaultValidity || 1));
    setValidityModalState({
      isOpen: true,
      packageIds,
      currentValidity: defaultValidity || 1,
      title: title || '',
    });
  };

  const handleSaveValidity = async () => {
    const days = parseFloat(validityInput);
    if (isNaN(days) || days <= 0 || validityModalState.packageIds.length === 0) return;
    setIsUpdatingBulk(true);
    try {
      await bulkUpdatePackageValidity(validityModalState.packageIds, days);
      toast({
        title: 'Validity Updated',
        description: `Set validity to ${days} day(s) (${Math.round(days * 24)}h) for ${validityModalState.packageIds.length} package(s).`,
      });
      setValidityModalState(prev => ({ ...prev, isOpen: false }));
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Failed to update validity.',
      });
    } finally {
      setIsUpdatingBulk(false);
    }
  };

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
            className="w-full h-full px-4 py-3 flex items-center justify-start gap-2 hover:bg-primary/5 transition-colors font-bold uppercase text-sm"
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
                Session Packages & Rates
            </CardTitle>
            <CardDescription className="font-bold text-sm uppercase tracking-normal">Manage PS5, PS4, Board Games, Retro Gaming rates, and recharge offers.</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search packages..." 
                    className="pl-9 h-10 border-2 font-bold text-sm uppercase bg-background"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <Button 
                size="sm" 
                variant={isAllSelected ? 'default' : 'outline'} 
                className="w-full sm:w-auto font-bold uppercase tracking-tight h-10 border-2" 
                onClick={handleToggleSelectAll}
            >
                <CheckSquare className="mr-2 h-4 w-4" />
                {isAllSelected ? 'Deselect All' : selectedIds.size > 0 ? `Select All (${filteredAndSortedPackages.length})` : 'Select All'}
            </Button>
            <Button size="sm" variant="outline" className="w-full sm:w-auto font-bold uppercase tracking-tight h-10 border-2" onClick={handleSeed} disabled={isSeeding}>
                <Sparkles className="mr-2 h-4 w-4 text-emerald-500" />
                {isSeeding ? 'Populating...' : 'Populate Rates'}
            </Button>
            <Button size="sm" variant="outline" className="w-full sm:w-auto font-bold uppercase tracking-tight h-10 border-2 border-yellow-500/40 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10" onClick={handleConvertAll} disabled={isConverting}>
                <Zap className="mr-2 h-4 w-4 text-yellow-500 fill-current" />
                {isConverting ? 'Converting...' : 'Make All Recharges'}
            </Button>
            <Button size="sm" className="w-full sm:w-auto font-bold uppercase tracking-tight h-10 shadow-lg" onClick={handleAdd}>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Package
            </Button>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 pt-4 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All Packages' },
            { id: 'ps5', label: 'PS5 Rates' },
            { id: 'ps4', label: 'PS4 Rates' },
            { id: 'retrogaming', label: 'Retro Gaming' },
            { id: 'boardgame', label: 'Board Games' },
            { id: 'recharge', label: 'Recharge Packs' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id as any)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap border-2",
                selectedCategory === tab.id
                  ? "bg-primary border-primary text-primary-foreground shadow-md"
                  : "bg-background border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* STICKY BULK ACTIONS BAR */}
        {selectedIds.size > 0 && (
          <div className="p-3 bg-yellow-500/10 border-b-2 border-yellow-500/30 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <Badge className="bg-yellow-500 text-black font-extrabold text-xs uppercase px-2.5 py-1 shadow-sm">
                {selectedIds.size} SELECTED
              </Badge>
              <span className="text-xs font-bold uppercase text-muted-foreground hidden md:inline">
                Decide recharge mode &amp; validity for selected packages
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                disabled={isUpdatingBulk}
                onClick={handleBulkSetRecharge}
                className="h-8 text-xs font-bold uppercase bg-yellow-500 hover:bg-yellow-600 text-black shadow-sm gap-1.5"
              >
                <Zap className="h-3.5 w-3.5 fill-current" /> Set as Recharge (24h)
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isUpdatingBulk}
                onClick={handleBulkRemoveRecharge}
                className="h-8 text-xs font-bold uppercase border-zinc-700 hover:border-destructive hover:text-destructive gap-1.5 bg-background"
              >
                <ZapOff className="h-3.5 w-3.5" /> Remove Recharge
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isUpdatingBulk}
                onClick={() => handleOpenValidityModal(Array.from(selectedIds), 1)}
                className="h-8 text-xs font-bold uppercase border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/10 gap-1.5 bg-background"
              >
                <Clock className="h-3.5 w-3.5" /> Edit Validity
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
                className="h-8 text-xs font-bold uppercase text-muted-foreground hover:text-foreground"
              >
                Deselect All
              </Button>
            </div>
          </div>
        )}

        {loading && (
            <div className="py-20 text-center opacity-50 font-bold uppercase tracking-normal animate-pulse">
                Loading Catalog...
            </div>
        )}
        {error && <div className="p-8 text-destructive text-center font-bold">Error loading packages: {error.message}</div>}
        
        {!loading && !error && (
          <ScrollArea className="h-[600px]">
            <Table>
                <TableHeader className="sticky top-0 z-10 shadow-sm">
                <TableRow>
                    <TableHead className="w-12 px-3 py-3 bg-muted/30 text-center">
                      <Checkbox 
                        checked={isAllSelected} 
                        onCheckedChange={handleToggleSelectAll} 
                        aria-label="Select all packages" 
                      />
                    </TableHead>
                    <SortableHeader label="Package Name" sortKey="name" />
                    <SortableHeader label="Category & Attributes" sortKey="purpose" />
                    <SortableHeader label="Duration" sortKey="duration" className="text-center" />
                    <SortableHeader label="Price" sortKey="price" className="text-center" />
                    <TableHead className="text-center font-bold uppercase text-sm bg-muted/30">Recharge &amp; Validity</TableHead>
                    <TableHead className="text-right font-bold uppercase text-sm bg-muted/30 pr-6">Actions</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {filteredAndSortedPackages.map((pkg) => {
                    const isSelected = selectedIds.has(pkg.id);
                    return (
                    <TableRow key={pkg.id} className={cn("hover:bg-muted/20 transition-colors", isSelected && "bg-yellow-500/5")}>
                    <TableCell className="px-3 py-4 text-center">
                      <Checkbox 
                        checked={isSelected} 
                        onCheckedChange={() => handleToggleSelect(pkg.id)} 
                        aria-label={`Select ${pkg.name}`} 
                      />
                    </TableCell>
                    <TableCell className="font-bold uppercase text-sm sm:text-sm py-4">
                      <div>
                        <p>{pkg.name}</p>
                        {pkg.startTime && pkg.endTime && (
                          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide">
                            Happy Hour ({pkg.startTime} - {pkg.endTime})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                            {pkg.stationType === 'ps5' && <Badge variant="outline" className="text-xs h-5 uppercase bg-indigo-500/10 text-indigo-500 border-indigo-500/20 font-bold">PS5</Badge>}
                            {pkg.stationType === 'ps4' && <Badge variant="outline" className="text-xs h-5 uppercase bg-cyan-500/10 text-cyan-500 border-cyan-500/20 font-bold">PS4</Badge>}
                            {(pkg.stationType === 'boardgame' || pkg.isBoardGamePass) && <Badge variant="outline" className="text-xs h-5 uppercase bg-blue-500/10 text-blue-500 border-blue-500/20 font-bold">BOARD GAME</Badge>}
                            {(pkg.stationType === 'retrogaming' || pkg.isRetroGamePass) && <Badge variant="outline" className="text-xs h-5 uppercase bg-purple-500/10 text-purple-500 border-purple-500/20 font-bold">RETRO GAME</Badge>}
                            {pkg.isPriorityOffer && <Badge variant="outline" className="text-xs h-5 uppercase bg-amber-500/10 text-amber-500 border-amber-500/20 font-bold">PRIORITY</Badge>}
                            {pkg.isRechargePack && <Badge variant="outline" className="text-xs h-5 uppercase bg-yellow-500/10 text-yellow-500 border-yellow-500/20 font-bold">RECHARGE</Badge>}
                            {pkg.isAddTimePackage && <Badge variant="outline" className="text-xs h-5 uppercase bg-primary/10 text-primary border-primary/20 font-bold">ADD TIME</Badge>}
                            {pkg.playerCapacity === 2 && <Badge variant="outline" className="text-xs h-5 uppercase bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-bold">DUO (2P)</Badge>}
                        </div>
                    </TableCell>
                    <TableCell className="text-center">
                        <span className="font-mono font-bold text-sm">{formatDuration(pkg.duration)}</span>
                    </TableCell>
                    <TableCell className="text-center">
                        <span className="font-mono font-bold text-sm text-primary">₹{pkg.price.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {pkg.isRechargePack ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleSingleRecharge(pkg)}
                                className="h-7 px-2.5 text-xs font-bold uppercase bg-yellow-500/15 text-yellow-500 hover:bg-yellow-500/25 border-yellow-500/40 gap-1.5 shadow-sm active:scale-95 transition-all"
                                title="Click to disable recharge mode"
                              >
                                <Zap className="h-3.5 w-3.5 fill-current" />
                                RECHARGE
                              </Button>
                              <button
                                type="button"
                                onClick={() => handleOpenValidityModal([pkg.id], pkg.validity || 1, pkg.name)}
                                title="Click to edit recharge validity"
                                className="h-7 px-2 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-mono font-bold border transition-colors flex items-center gap-1"
                              >
                                <Clock className="h-3 w-3 text-yellow-500" />
                                {pkg.validity || 1}d ({(pkg.validity || 1) * 24}h)
                                <Edit className="h-2.5 w-2.5 opacity-60 ml-0.5" />
                              </button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleSingleRecharge(pkg)}
                              className="h-7 px-2.5 text-xs font-bold uppercase text-zinc-400 hover:text-yellow-400 border-dashed border-zinc-700 hover:border-yellow-500/50 hover:bg-yellow-500/10 gap-1 active:scale-95 transition-all"
                              title="Click to make this a recharge pack"
                            >
                              <Plus className="h-3 w-3" /> Make Recharge (24h)
                            </Button>
                          )}
                        </div>
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
                            <DropdownMenuContent align="end" className="w-48 font-body">
                            <DropdownMenuLabel className="text-sm uppercase font-bold opacity-50">Actions</DropdownMenuLabel>
                            <DropdownMenuItem onSelect={() => handleEdit(pkg)} className="font-bold text-sm">
                                <Edit className="mr-2 h-3.5 w-3.5" /> Edit Package
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleOpenValidityModal([pkg.id], pkg.validity || 1, pkg.name)} className="font-bold text-sm">
                                <Clock className="mr-2 h-3.5 w-3.5 text-yellow-500" /> Set Validity ({pkg.validity || 1}d)
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleToggleSingleRecharge(pkg)} className="font-bold text-sm">
                                <Zap className="mr-2 h-3.5 w-3.5 text-yellow-500" /> {pkg.isRechargePack ? 'Disable Recharge' : 'Make Recharge (24h)'}
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive font-bold text-sm" onSelect={() => logUserAction(`Opened delete for ${pkg.name}`)}>
                                    <Trash className="mr-2 h-3.5 w-3.5" /> Remove
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <AlertDialogContent className="border-4 border-destructive font-body">
                            <AlertDialogHeader>
                            <AlertDialogTitle className="font-headline text-lg text-destructive uppercase tracking-tight">Delete Package?</AlertDialogTitle>
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
                    );
                })}
                {filteredAndSortedPackages.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={7} className="h-64 text-center bg-muted/5">
                            <div className="flex flex-col items-center justify-center p-6 space-y-3">
                                <Gamepad2 className="h-10 w-10 text-primary opacity-40 animate-pulse" />
                                <p className="font-headline text-base tracking-tight">No Packages Configured Yet</p>
                                <p className="text-xs font-bold text-muted-foreground uppercase max-w-sm">
                                  Populate all standard rate card packages for PS5, PS4, Board Games, and Retro Gaming in one click.
                                </p>
                                <Button onClick={handleSeed} disabled={isSeeding} className="font-bold uppercase tracking-wide h-10 px-5 shadow-lg mt-2">
                                  <Sparkles className="mr-2 h-4 w-4 text-amber-300" />
                                  {isSeeding ? 'Populating Rates...' : 'Populate All Rate Packages'}
                                </Button>
                            </div>
                        </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>

      {/* QUICK VALIDITY EDIT DIALOG */}
      <Dialog open={validityModalState.isOpen} onOpenChange={(open) => setValidityModalState(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="sm:max-w-md font-body">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-headline tracking-wide text-xl">
              <Clock className="h-5 w-5 text-yellow-500" />
              Edit Recharge Validity
            </DialogTitle>
            <DialogDescription className="font-bold text-xs uppercase tracking-normal">
              {validityModalState.title 
                ? `Set validity period for ${validityModalState.title}`
                : `Set validity period for ${validityModalState.packageIds.length} selected packages`}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2 p-4 rounded-xl bg-yellow-500/5 border-2 border-yellow-500/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase text-yellow-500 tracking-wide">Validity Period (Days)</Label>
                <span className="text-xs font-mono font-bold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                  {Math.round((parseFloat(validityInput) || 1) * 24)} Hours
                </span>
              </div>
              <Input
                type="number"
                step="any"
                min="0.1"
                value={validityInput}
                onChange={(e) => setValidityInput(e.target.value)}
                placeholder="1 (24 hours)"
                className="font-mono font-bold text-lg h-11 border-yellow-500/30 bg-background"
              />
              <p className="text-[11px] text-muted-foreground font-semibold">
                Any leftover minutes from a session will remain banked in the member&apos;s account for this duration. Default is 1 day (24 hours).
              </p>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Quick Presets</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: '24 Hours (1 Day)', value: '1' },
                  { label: '48 Hours (2 Days)', value: '2' },
                  { label: '72 Hours (3 Days)', value: '3' },
                  { label: '7 Days (1 Week)', value: '7' },
                  { label: '15 Days', value: '15' },
                  { label: '30 Days (1 Month)', value: '30' },
                ].map(preset => (
                  <Button
                    key={preset.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setValidityInput(preset.value)}
                    className={cn(
                      "h-9 text-xs font-bold uppercase border transition-all",
                      validityInput === preset.value
                        ? "bg-yellow-500 text-black border-yellow-500 font-extrabold shadow-sm"
                        : "border-border hover:border-yellow-500/50"
                    )}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setValidityModalState(prev => ({ ...prev, isOpen: false }))}
              className="font-bold text-xs uppercase"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveValidity}
              disabled={isUpdatingBulk || !validityInput || parseFloat(validityInput) <= 0}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-extrabold text-xs uppercase shadow-md"
            >
              {isUpdatingBulk ? 'Saving...' : 'Apply Validity'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <GamingPackageFormModal 
        isOpen={modalOpen} 
        onOpenChange={setModalOpen}
        onSave={handleSave}
        pkg={selectedPackage}
      />
    </Card>
  );
}
