
'use client';

import { useState, useEffect, useMemo } from 'react';
import type { FoodItem, FoodItemFormData, Category } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save, Plus } from 'lucide-react';
import { useFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from 'next/link';

interface FoodItemFormModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (formData: FoodItemFormData) => void;
  item: FoodItem | null;
}

export function FoodItemFormModal({ isOpen, onOpenChange, onSave, item }: FoodItemFormModalProps) {
  const { db } = useFirebase();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const { toast } = useToast();

  const categoriesCollection = useMemo(() => {
    if (!db) return null;
    return collection(db, 'categories');
  }, [db]);

  const { data: categories } = useCollection<Category>(categoriesCollection);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategory(item.category);
      setPrice(String(item.price));
    } else {
      setName('');
      setCategory('');
      setPrice('');
    }
  }, [item, isOpen]);

  const handleSave = () => {
    const numPrice = parseFloat(price);

    if (!name || !category || isNaN(numPrice) || numPrice < 0) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please fill out all fields with valid values. Make sure a category is selected.',
      });
      return;
    }

    const formData: FoodItemFormData = {
        name,
        category,
        price: numPrice,
    };

    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline tracking-wide text-2xl">
            {item ? 'Edit Menu Item' : 'Add New Menu Item'}
          </DialogTitle>
          <DialogDescription>
            {item ? `Editing details for ${item.name}.` : 'Enter the details for the new food or beverage item.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Item Name</Label>
            <Input
              id="name"
              placeholder="e.g., Masala Fries"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category">
                        <SelectValue placeholder="Pick category" />
                    </SelectTrigger>
                    <SelectContent>
                        {categories?.map((cat) => (
                            <SelectItem key={cat.id} value={cat.name}>
                                {cat.name}
                            </SelectItem>
                        ))}
                        {(!categories || categories.length === 0) && (
                            <div className="p-2 text-center text-xs text-muted-foreground">
                                No categories found. 
                                <Link href="/settings/categories" className="text-primary block font-bold mt-1">Manage Categories</Link>
                            </div>
                        )}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="price">Price (₹)</Label>
                <Input
                id="price"
                type="number"
                placeholder="e.g., 120"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} className="w-full font-bold">
            <Save className="mr-2 h-4 w-4" />
            Save Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
