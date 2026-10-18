'use client';

import { useState, useEffect } from 'react';
import type { RawMaterial, RawMaterialFormData } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Package, Save } from 'lucide-react';

interface RawMaterialFormModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  material: RawMaterial | null;
  onSave: (data: RawMaterialFormData) => void;
}

const CATEGORIES = [
  'Dairy',
  'Kitchen & Food',
  'Beverages',
  'Packaging & Supplies',
  'Gaming & Tech',
  'Cleaning & Housekeeping',
  'Other'
];

const COMMON_UNITS = [
  'Packets',
  'Litres',
  'Kg',
  'Pieces',
  'Cans',
  'Boxes',
  'Bottles',
  'Rolls',
  'Pairs',
  'Jars'
];

export function RawMaterialFormModal({
  isOpen,
  onOpenChange,
  material,
  onSave
}: RawMaterialFormModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Dairy');
  const [unit, setUnit] = useState('Packets');
  const [customUnit, setCustomUnit] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('3');
  const [preferredSupplier, setPreferredSupplier] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (material) {
      setName(material.name || '');
      setCategory(material.category || 'Dairy');
      if (COMMON_UNITS.includes(material.unit)) {
        setUnit(material.unit);
        setCustomUnit('');
      } else {
        setUnit('custom');
        setCustomUnit(material.unit || '');
      }
      setLowStockThreshold(material.lowStockThreshold != null ? String(material.lowStockThreshold) : '3');
      setPreferredSupplier(material.preferredSupplier || '');
      setNotes(material.notes || '');
    } else {
      setName('');
      setCategory('Dairy');
      setUnit('Packets');
      setCustomUnit('');
      setLowStockThreshold('3');
      setPreferredSupplier('');
      setNotes('');
    }
  }, [material, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalUnit = unit === 'custom' ? (customUnit.trim() || 'Units') : unit;

    const data: RawMaterialFormData = {
      name: name.trim(),
      category,
      unit: finalUnit,
      lowStockThreshold: parseInt(lowStockThreshold, 10) || 1,
      preferredSupplier: preferredSupplier.trim() || undefined,
      notes: notes.trim() || undefined,
      isActive: true,
    };

    onSave(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden font-body bg-zinc-950 border-2 border-zinc-800 text-white">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-6 pb-3 border-b border-zinc-800/80 bg-zinc-900/60">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="font-headline tracking-wide text-xl uppercase">
                  {material ? 'Edit Raw Material' : 'Add Raw Material'}
                </DialogTitle>
                <DialogDescription className="font-bold text-xs uppercase text-zinc-400">
                  {material ? `Update details for ${material.name}` : 'Register a supply item for employee low-stock reporting'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
            {/* Item Name */}
            <div className="space-y-1.5">
              <Label htmlFor="raw-name" className="text-xs font-bold uppercase text-zinc-300">
                Material / Item Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="raw-name"
                placeholder="e.g. Amul Taaza Milk, Mozzarella Cheese, French Fries"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-10 border-zinc-800 bg-zinc-900 font-bold uppercase text-sm"
              />
            </div>

            {/* Category & Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="raw-category" className="text-xs font-bold uppercase text-zinc-300">
                  Category
                </Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="raw-category" className="h-10 border-zinc-800 bg-zinc-900 font-bold text-xs uppercase">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat} className="font-bold text-xs uppercase">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="raw-unit" className="text-xs font-bold uppercase text-zinc-300">
                  Unit of Measurement
                </Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger id="raw-unit" className="h-10 border-zinc-800 bg-zinc-900 font-bold text-xs uppercase">
                    <SelectValue placeholder="Select Unit" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    {COMMON_UNITS.map(u => (
                      <SelectItem key={u} value={u} className="font-bold text-xs uppercase">
                        {u}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom" className="font-bold text-xs uppercase">
                      Custom Unit...
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {unit === 'custom' && (
              <div className="space-y-1.5">
                <Label htmlFor="custom-unit" className="text-xs font-bold uppercase text-zinc-300">
                  Specify Custom Unit
                </Label>
                <Input
                  id="custom-unit"
                  placeholder="e.g. Bundles, Strips, Sacks"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  className="h-10 border-zinc-800 bg-zinc-900 font-bold text-sm uppercase"
                  required
                />
              </div>
            )}

            {/* Low Stock Alert Threshold & Preferred Supplier */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="raw-threshold" className="text-xs font-bold uppercase text-zinc-300">
                  Low Stock Alert (Units)
                </Label>
                <Input
                  id="raw-threshold"
                  type="number"
                  min="1"
                  placeholder="e.g. 3"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  className="h-10 border-zinc-800 bg-zinc-900 font-mono font-bold text-sm"
                />
                <p className="text-[10px] text-zinc-500 font-bold uppercase">When count drops below this</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="raw-supplier" className="text-xs font-bold uppercase text-zinc-300">
                  Preferred Vendor / App
                </Label>
                <Input
                  id="raw-supplier"
                  placeholder="e.g. Blinkit, Instamart, Metro"
                  value={preferredSupplier}
                  onChange={(e) => setPreferredSupplier(e.target.value)}
                  className="h-10 border-zinc-800 bg-zinc-900 font-bold text-xs uppercase"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="raw-notes" className="text-xs font-bold uppercase text-zinc-300">
                Staff Note / Brand Instructions (Optional)
              </Label>
              <Textarea
                id="raw-notes"
                placeholder="e.g. Only buy blue Amul packet, or check expiry before accepting delivery."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="border-zinc-800 bg-zinc-900 text-xs font-medium resize-none"
              />
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-zinc-800 bg-zinc-900/40 flex items-center justify-between sm:justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="font-bold uppercase text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold uppercase text-xs gap-1.5 shadow-md h-10 px-5"
            >
              <Save className="h-4 w-4" />
              {material ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
