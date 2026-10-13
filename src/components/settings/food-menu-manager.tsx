'use client';
import { useState, useMemo } from 'react';
import type { FoodItem, FoodItemFormData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Trash, Edit, IndianRupee, Utensils, Search, Boxes, AlertTriangle, Plus, Minus, PackagePlus } from 'lucide-react';
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
import { addFoodItem, updateFoodItem, deleteFoodItem, adjustFoodItemStock } from '@/firebase/firestore/food-items';
import { FoodItemFormModal } from './food-item-form-modal';
import { logUserAction } from '@/firebase/firestore/logs';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';

export function FoodMenuManager() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FoodItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'tracked' | 'low-stock'>('all');

  const itemsCollection = useMemo(() => {
    if (!db) return null;
    return collection(db, 'foodItems');
  }, [db]);

  const { data: items, loading, error } = useCollection<FoodItem>(itemsCollection);

  const lowStockCount = useMemo(() => {
    if (!items) return 0;
    return items.filter(i => i.trackInventory && (i.stock ?? 0) <= (i.lowStockThreshold ?? 5)).length;
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    let list = [...items];
    
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        list = list.filter(i => i.name.toLowerCase().includes(term) || i.category.toLowerCase().includes(term));
    }

    if (filterMode === 'tracked') {
      list = list.filter(i => i.trackInventory);
    } else if (filterMode === 'low-stock') {
      list = list.filter(i => i.trackInventory && (i.stock ?? 0) <= (i.lowStockThreshold ?? 5));
    }

    return list.sort((a, b) => {
      // If low stock filter is active, sort lowest stock first
      if (filterMode === 'low-stock') {
        return (a.stock ?? 0) - (b.stock ?? 0);
      }
      if (a.category < b.category) return -1;
      if (a.category > b.category) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [items, searchTerm, filterMode]);

  const handleAdd = () => {
    setSelectedItem(null);
    setModalOpen(true);
    logUserAction("Clicked 'Add Menu Item' button.");
  };

  const handleEdit = (item: FoodItem) => {
    setSelectedItem(item);
    setModalOpen(true);
    logUserAction(`Clicked 'Edit' for menu item '${item.name}'.`, { itemId: item.id });
  };

  const handleDelete = (item: FoodItem) => {
    deleteFoodItem(item.id, item.name);
    toast({ variant: 'destructive', title: 'Menu Item Deleted', description: `${item.name} removed.` });
  };
  
  const handleSave = (formData: FoodItemFormData) => {
    if(selectedItem) {
      updateFoodItem(selectedItem.id, formData);
       toast({ title: 'Menu Item Updated', description: `${formData.name} saved.` });
    } else {
      addFoodItem(formData);
      toast({ title: 'Menu Item Added', description: `${formData.name} created.` });
    }
  };

  const handleQuickAdjust = async (item: FoodItem, delta: number) => {
    const current = item.stock ?? 0;
    if (delta < 0 && current <= 0) return;
    await adjustFoodItemStock(item.id, delta, item.name);
    toast({
      title: delta > 0 ? "Stock Added" : "Stock Reduced",
      description: `${item.name}: ${current + delta} units remaining.`,
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-none overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="font-headline tracking-wide text-2xl flex items-center gap-2">
                <Utensils className="h-6 w-6 text-primary" />
                Manage Menu Catalog & Inventory
            </CardTitle>
            <CardDescription className="font-bold text-sm uppercase tracking-normal">
              Organize offerings, prices, and stock counts ({filteredItems.length} items)
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Filter by name/category..." 
                    className="pl-10 h-10 font-bold text-sm uppercase bg-muted/20 border-none"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <Button onClick={handleAdd} className="font-bold uppercase tracking-tight h-10 shadow-lg">
                <PlusCircle className="mr-2 h-4 w-4" />
                New Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* INVENTORY QUICK FILTER TABS */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant={filterMode === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterMode('all')}
                className="h-8 text-xs font-bold uppercase rounded-lg"
              >
                All Items ({(items || []).length})
              </Button>
              <Button
                size="sm"
                variant={filterMode === 'tracked' ? 'default' : 'outline'}
                onClick={() => setFilterMode('tracked')}
                className="h-8 text-xs font-bold uppercase rounded-lg gap-1.5"
              >
                <Boxes className="h-3.5 w-3.5" />
                Tracked Stock ({(items || []).filter(i => i.trackInventory).length})
              </Button>
              <Button
                size="sm"
                variant={filterMode === 'low-stock' ? 'default' : 'outline'}
                onClick={() => setFilterMode('low-stock')}
                className={cn(
                  "h-8 text-xs font-bold uppercase rounded-lg gap-1.5",
                  lowStockCount > 0 && filterMode !== 'low-stock' && "border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Low Stock Alert ({lowStockCount})
              </Button>
            </div>

            {lowStockCount > 0 && (
              <Badge variant="outline" className="text-xs font-mono font-bold uppercase bg-amber-500/10 border-amber-500/30 text-amber-500 animate-pulse">
                ⚠️ {lowStockCount} item{lowStockCount > 1 ? 's' : ''} running low!
              </Badge>
            )}
          </div>

          {loading ? (
            <div className="py-20 text-center font-headline text-sm animate-pulse opacity-50">Loading Menu...</div>
          ) : (
            <ScrollArea className="h-[600px] rounded-xl border-2 border-dashed">
                <Table>
                    <TableHeader className="bg-muted/30 sticky top-0 z-10 shadow-sm">
                    <TableRow>
                        <TableHead className="font-bold uppercase text-sm bg-muted/30">Item Name</TableHead>
                        <TableHead className="font-bold uppercase text-sm bg-muted/30">Category</TableHead>
                        <TableHead className="font-bold uppercase text-sm bg-muted/30">Stock / Inventory</TableHead>
                        <TableHead className="text-center font-bold uppercase text-sm bg-muted/30">Price</TableHead>
                        <TableHead className="text-right font-bold uppercase text-sm bg-muted/30">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {filteredItems.map((item) => {
                        const isTracked = Boolean(item.trackInventory);
                        const stockCount = item.stock ?? 0;
                        const threshold = item.lowStockThreshold ?? 5;
                        const isOut = isTracked && stockCount <= 0;
                        const isLow = isTracked && stockCount > 0 && stockCount <= threshold;

                        return (
                          <TableRow key={item.id} className="hover:bg-muted/20">
                            <TableCell className="font-bold uppercase text-sm sm:text-sm">
                              <div className="flex items-center gap-2">
                                <span>{item.name}</span>
                                {item.name.toLowerCase().includes('campa') && (
                                  <Badge variant="secondary" className="text-[9px] uppercase px-1.5 py-0 font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30">
                                    Campa
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className="font-bold uppercase text-sm bg-primary/5 text-primary border-primary/20">
                                    {item.category}
                                </Badge>
                            </TableCell>
                            <TableCell>
                              {isTracked ? (
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "font-mono font-bold uppercase text-xs px-2 py-0.5",
                                      isOut && "bg-rose-500/15 text-rose-400 border-rose-500/40 font-extrabold animate-pulse",
                                      isLow && "bg-amber-500/15 text-amber-400 border-amber-500/40 font-extrabold",
                                      !isOut && !isLow && "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                    )}
                                  >
                                    {isOut ? "OUT OF STOCK" : isLow ? `LOW: ${stockCount} LEFT` : `${stockCount} IN STOCK`}
                                  </Badge>

                                  {/* Quick Adjustment Controls */}
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      disabled={stockCount <= 0}
                                      onClick={() => handleQuickAdjust(item, -1)}
                                      className="h-6 w-6 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded"
                                      title="Deduct 1"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => handleQuickAdjust(item, 1)}
                                      className="h-6 w-6 text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 rounded"
                                      title="Add 1"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleQuickAdjust(item, 12)}
                                      className="h-6 px-1.5 text-[10px] font-mono font-bold text-muted-foreground hover:text-primary hover:border-primary/50"
                                      title="Add 12 (1 Crate)"
                                    >
                                      +12
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs font-medium text-muted-foreground/60 italic">Not Tracked</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1 font-mono font-bold text-sm">
                                    <span>₹{item.price.toLocaleString()}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                                <AlertDialog>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                    <DropdownMenuLabel className="text-sm uppercase font-bold opacity-50">Catalog Actions</DropdownMenuLabel>
                                    <DropdownMenuItem onSelect={() => handleEdit(item)}><Edit className="mr-2 h-4 w-4" /> Edit Details & Stock</DropdownMenuItem>
                                    {isTracked && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onSelect={() => handleQuickAdjust(item, 12)}>
                                          <PackagePlus className="mr-2 h-4 w-4 text-emerald-400" /> Restock +12 Crate
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => handleQuickAdjust(item, 24)}>
                                          <PackagePlus className="mr-2 h-4 w-4 text-emerald-400" /> Restock +24 Crate
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    <DropdownMenuSeparator />
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem className="text-destructive font-bold"><Trash className="mr-2 h-4 w-4" /> Remove Item</DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle className="font-headline text-lg">Permanent Removal?</AlertDialogTitle>
                                    <AlertDialogDescription className="font-medium">This will delete <strong>{item.name}</strong> from the catalog across all dashboards.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel className="font-bold">Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(item)} className="bg-destructive hover:bg-destructive/90 font-bold uppercase">Delete Item</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                          </TableRow>
                        );
                    })}
                    {filteredItems.length === 0 && !loading && (
                        <TableRow>
                            <TableCell colSpan={5} className="h-48 text-center bg-muted/5">
                                <div className="flex flex-col items-center justify-center opacity-30">
                                    <Utensils className="h-10 w-10 mb-2" />
                                    <p className="font-headline text-sm tracking-normal">No items found</p>
                                </div>
                            </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      <FoodItemFormModal isOpen={modalOpen} onOpenChange={setModalOpen} onSave={handleSave} item={selectedItem} />
    </div>
  );
}
