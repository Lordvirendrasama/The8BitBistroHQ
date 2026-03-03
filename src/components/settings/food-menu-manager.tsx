'use client';
import { useState, useMemo } from 'react';
import type { FoodItem, FoodItemFormData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Trash, Edit, IndianRupee, Utensils, Search } from 'lucide-react';
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
import { addFoodItem, updateFoodItem, deleteFoodItem } from '@/firebase/firestore/food-items';
import { FoodItemFormModal } from './food-item-form-modal';
import { logUserAction } from '@/firebase/firestore/logs';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';

export function FoodMenuManager() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FoodItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const itemsCollection = useMemo(() => {
    if (!db) return null;
    return collection(db, 'foodItems');
  }, [db]);

  const { data: items, loading, error } = useCollection<FoodItem>(itemsCollection);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    let list = [...items];
    
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        list = list.filter(i => i.name.toLowerCase().includes(term) || i.category.toLowerCase().includes(term));
    }

    return list.sort((a, b) => {
      if (a.category < b.category) return -1;
      if (a.category > b.category) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [items, searchTerm]);

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
  }

  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-none overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="font-headline tracking-wide text-2xl flex items-center gap-2">
                <Utensils className="h-6 w-6 text-primary" />
                Manage Menu Catalog
            </CardTitle>
            <CardDescription className="font-bold text-xs uppercase tracking-widest">Organize and edit your bistro offerings ({filteredItems.length} items)</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Filter by name/category..." 
                    className="pl-10 h-10 font-bold text-xs uppercase bg-muted/20 border-none"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <Button onClick={handleAdd} className="font-black uppercase tracking-tight h-10 shadow-lg">
                <PlusCircle className="mr-2 h-4 w-4" />
                New Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-20 text-center font-headline text-xs animate-pulse opacity-50">Loading Menu...</div>
          ) : (
            <ScrollArea className="h-[600px] rounded-xl border-2 border-dashed">
                <Table>
                    <TableHeader className="bg-muted/30 sticky top-0 z-10 shadow-sm">
                    <TableRow>
                        <TableHead className="font-black uppercase text-[10px] bg-muted/30">Item Name</TableHead>
                        <TableHead className="font-black uppercase text-[10px] bg-muted/30">Category</TableHead>
                        <TableHead className="text-center font-black uppercase text-[10px] bg-muted/30">Price</TableHead>
                        <TableHead className="text-right font-black uppercase text-[10px] bg-muted/30">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {filteredItems.map((item) => (
                        <TableRow key={item.id} className="hover:bg-muted/20">
                        <TableCell className="font-black uppercase text-xs sm:text-sm">{item.name}</TableCell>
                        <TableCell>
                            <Badge variant="outline" className="font-black uppercase text-[9px] bg-primary/5 text-primary border-primary/20">
                                {item.category}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1 font-mono font-black text-sm">
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
                                <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50">Catalog Actions</DropdownMenuLabel>
                                <DropdownMenuItem onSelect={() => handleEdit(item)}><Edit className="mr-2 h-4 w-4" /> Edit Details</DropdownMenuItem>
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
                    ))}
                    {filteredItems.length === 0 && !loading && (
                        <TableRow>
                            <TableCell colSpan={4} className="h-48 text-center bg-muted/5">
                                <div className="flex flex-col items-center justify-center opacity-30">
                                    <Utensils className="h-10 w-10 mb-2" />
                                    <p className="font-headline text-xs tracking-widest">No items found</p>
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
