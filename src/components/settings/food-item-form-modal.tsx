
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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Save, Plus, Boxes, AlertTriangle } from 'lucide-react';
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
  const [trackInventory, setTrackInventory] = useState(false);
  const [stock, setStock] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
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
      setTrackInventory(Boolean(item.trackInventory));
      setStock(item.stock !== undefined ? String(item.stock) : '0');
      setLowStockThreshold(item.lowStockThreshold !== undefined ? String(item.lowStockThreshold) : '5');
    } else {
      setName('');
      setCategory('');
      setPrice('');
      setTrackInventory(false);
      setStock('0');
      setLowStockThreshold('5');
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

    const parsedStock = Math.max(0, parseInt(stock, 10) || 0);
    const parsedThreshold = Math.max(1, parseInt(lowStockThreshold, 10) || 5);

    const formData: FoodItemFormData = {
        name: name.trim(),
        category,
        price: numPrice,
        trackInventory,
        stock: trackInventory ? parsedStock : undefined,
        lowStockThreshold: trackInventory ? parsedThreshold : undefined,
    };

    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="font-headline tracking-wide text-2xl">
            {item ? 'Edit Menu Item' : 'Add New Menu Item'}
          </DialogTitle>
          <DialogDescription>
            {item ? `Editing details and inventory for ${item.name}.` : 'Enter the details and inventory settings for the menu item.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Item Name</Label>
            <Input
              id="name"
              placeholder="e.g., Campa Cola"
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
                            <div className="p-2 text-center text-sm text-muted-foreground">
                                No categories found. 
                                <Link href="/settings/menu?tab=categories" className="text-primary block font-bold mt-1">Manage Categories</Link>
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
                placeholder="e.g., 30"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                />
            </div>
          </div>

          {/* INVENTORY TRACKING SECTION */}
          <div className="rounded-xl border-2 border-border/60 bg-muted/20 p-3.5 space-y-3">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="trackInventory"
                checked={trackInventory}
                onCheckedChange={(checked) => setTrackInventory(Boolean(checked))}
              />
              <div className="grid gap-0.5 leading-none">
                <label
                  htmlFor="trackInventory"
                  className="text-xs font-bold uppercase tracking-wide cursor-pointer flex items-center gap-1.5 text-foreground"
                >
                  <Boxes className="h-3.5 w-3.5 text-primary" />
                  Track Inventory / Stock Count
                </label>
                <p className="text-[11px] text-muted-foreground font-medium">
                  Automatically count down stock when ordered at stations.
                </p>
              </div>
            </div>

            {trackInventory && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="space-y-1.5">
                  <Label htmlFor="stock" className="text-xs font-bold uppercase">
                    Units In Stock
                  </Label>
                  <Input
                    id="stock"
                    type="number"
                    min="0"
                    placeholder="e.g. 24"
                    className="font-mono font-bold"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground font-mono">Current available units</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lowStockThreshold" className="text-xs font-bold uppercase flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    Low Alert At
                  </Label>
                  <Input
                    id="lowStockThreshold"
                    type="number"
                    min="1"
                    placeholder="e.g. 5"
                    className="font-mono font-bold"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground font-mono">Triggers Owner Hub warning</p>
                </div>
              </div>
            )}
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
