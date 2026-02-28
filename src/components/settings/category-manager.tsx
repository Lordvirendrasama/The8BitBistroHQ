'use client';
import { useState, useMemo } from 'react';
import type { Category, CategoryFormData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Trash, Edit, Tag, Search } from 'lucide-react';
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
import { addCategory, updateCategory, deleteCategory } from '@/firebase/firestore/categories';
import { CategoryFormModal } from './category-form-modal';
import { logUserAction } from '@/firebase/firestore/logs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '../ui/scroll-area';

export function CategoryManager() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const categoriesCollection = useMemo(() => {
    if (!db) return null;
    return collection(db, 'categories');
  }, [db]);

  const { data: categories, loading } = useCollection<Category>(categoriesCollection);

  const filteredCategories = useMemo(() => {
    if (!categories) return [];
    let list = [...categories];
    
    if (searchTerm) {
        list = list.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, searchTerm]);

  const handleAdd = () => {
    setSelectedCategory(null);
    setModalOpen(true);
    logUserAction("Clicked 'Add Category' button.");
  };

  const handleEdit = (category: Category) => {
    setSelectedCategory(category);
    setModalOpen(true);
    logUserAction(`Clicked 'Edit' for category '${category.name}'.`, { categoryId: category.id });
  };

  const handleDelete = (category: Category) => {
    deleteCategory(category.id, category.name);
    toast({ variant: 'destructive', title: 'Category Deleted', description: `${category.name} removed.` });
  };
  
  const handleSave = (formData: CategoryFormData) => {
    if(selectedCategory) {
      updateCategory(selectedCategory.id, formData);
       toast({ title: 'Category Updated', description: `${formData.name} saved.` });
    } else {
      addCategory(formData);
      toast({ title: 'Category Added', description: `${formData.name} created.` });
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-none overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="font-headline tracking-wide text-2xl flex items-center gap-2">
                <Tag className="h-6 w-6 text-primary" />
                Manage Categories
            </CardTitle>
            <CardDescription className="font-bold text-xs uppercase tracking-widest">Create and organize your menu categories ({filteredCategories.length} total)</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search categories..." 
                    className="pl-10 h-10 font-bold text-xs uppercase bg-muted/20 border-none"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <Button onClick={handleAdd} className="font-black uppercase tracking-tight h-10 shadow-lg">
                <PlusCircle className="mr-2 h-4 w-4" />
                New Category
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-20 text-center font-headline text-xs animate-pulse opacity-50">Loading Categories...</div>
          ) : (
            <ScrollArea className="h-[600px] rounded-xl border-2 border-dashed">
                <Table>
                    <TableHeader className="bg-muted/30 sticky top-0 z-10 shadow-sm">
                    <TableRow>
                        <TableHead className="font-black uppercase text-[10px] bg-muted/30">Category Name</TableHead>
                        <TableHead className="text-right font-black uppercase text-[10px] bg-muted/30">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {filteredCategories.map((category) => (
                        <TableRow key={category.id} className="hover:bg-muted/20">
                        <TableCell className="font-black uppercase text-xs sm:text-sm">{category.name}</TableCell>
                        <TableCell className="text-right">
                            <AlertDialog>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50">Actions</DropdownMenuLabel>
                                <DropdownMenuItem onSelect={() => handleEdit(category)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem className="text-destructive font-bold"><Trash className="mr-2 h-4 w-4" /> Remove</DropdownMenuItem>
                                </AlertDialogTrigger>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle className="font-headline text-lg">Delete Category?</AlertDialogTitle>
                                <AlertDialogDescription className="font-medium">
                                    Deleting <strong>{category.name}</strong> will remove it from the list. Existing items in this category will keep their label but won't be associated with a managed category.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel className="font-bold">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(category)} className="bg-destructive hover:bg-destructive/90 font-bold uppercase">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                            </AlertDialog>
                        </TableCell>
                        </TableRow>
                    ))}
                    {filteredCategories.length === 0 && !loading && (
                        <TableRow>
                            <TableCell colSpan={2} className="h-48 text-center bg-muted/5">
                                <div className="flex flex-col items-center justify-center opacity-30">
                                    <Tag className="h-10 w-10 mb-2" />
                                    <p className="font-headline text-xs tracking-widest">No categories found</p>
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
      <CategoryFormModal isOpen={modalOpen} onOpenChange={setModalOpen} onSave={handleSave} category={selectedCategory} />
    </div>
  );
}
