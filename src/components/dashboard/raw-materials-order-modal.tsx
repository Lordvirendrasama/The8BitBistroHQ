'use client';

import { useState, useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Package, 
  Search, 
  AlertTriangle, 
  Check, 
  Clock, 
  Plus, 
  Minus, 
  ShoppingBag, 
  Sparkles, 
  Flame, 
  Trash2,
  Calendar,
  User,
  CheckCircle2,
  ListFilter
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuth } from '@/firebase/auth/use-user';
import type { RawMaterial, RawMaterialRequestItem, RawMaterialRequest } from '@/lib/types';
import { createRawMaterialRequest, DEFAULT_RAW_MATERIALS, seedDefaultRawMaterials } from '@/firebase/firestore/raw-materials';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface RawMaterialsOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SelectedItemState {
  rawMaterialId?: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  isUrgent: boolean;
  notes?: string;
}

const CATEGORIES = [
  'All',
  'Dairy',
  'Kitchen & Food',
  'Beverages',
  'Packaging & Supplies',
  'Gaming & Tech',
  'Cleaning & Housekeeping'
];

export function RawMaterialsOrderModal({ isOpen, onClose }: RawMaterialsOrderModalProps) {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'select' | 'history'>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedItems, setSelectedItems] = useState<Record<string, SelectedItemState>>({});
  const [orderUrgency, setOrderUrgency] = useState<'normal' | 'urgent'>('normal');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom ad-hoc item entry
  const [showCustomItemForm, setShowCustomItemForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('Kitchen & Food');
  const [customUnit, setCustomUnit] = useState('Packets');
  const [customQty, setCustomQty] = useState('1');

  // Firestore collections
  const rawMaterialsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'rawMaterials'), orderBy('name', 'asc'));
  }, [db]);

  const requestsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'rawMaterialRequests'), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: rawMaterialsData, loading: loadingMaterials } = useCollection<RawMaterial>(rawMaterialsQuery);
  const { data: allRequestsData, loading: loadingRequests } = useCollection<RawMaterialRequest>(requestsQuery);

  const rawMaterials = useMemo(() => rawMaterialsData || [], [rawMaterialsData]);
  const allRequests = useMemo(() => allRequestsData || [], [allRequestsData]);

  // Pending requests for visibility
  const pendingRequests = useMemo(() => {
    if (!allRequests || !Array.isArray(allRequests)) return [];
    return allRequests.filter(r => r.status === 'pending' || r.status === 'ordered');
  }, [allRequests]);

  // Filter materials based on search and category
  const filteredMaterials = useMemo(() => {
    if (!rawMaterials || !Array.isArray(rawMaterials)) return [];
    return rawMaterials.filter(item => {
      if (item.isActive === false) return false;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [rawMaterials, searchQuery, selectedCategory]);

  const selectedCount = Object.keys(selectedItems).length;

  const toggleItemSelection = (item: RawMaterial) => {
    setSelectedItems(prev => {
      const next = { ...prev };
      if (next[item.id]) {
        delete next[item.id];
      } else {
        next[item.id] = {
          rawMaterialId: item.id,
          name: item.name,
          category: item.category,
          unit: item.unit,
          quantity: item.lowStockThreshold ? Math.max(1, item.lowStockThreshold) : 1,
          isUrgent: false
        };
      }
      return next;
    });
  };

  const updateQuantity = (itemId: string, change: number) => {
    setSelectedItems(prev => {
      const current = prev[itemId];
      if (!current) return prev;
      const newQty = Math.max(1, current.quantity + change);
      return {
        ...prev,
        [itemId]: { ...current, quantity: newQty }
      };
    });
  };

  const setExactQuantity = (itemId: string, val: string) => {
    const num = parseInt(val, 10);
    setSelectedItems(prev => {
      const current = prev[itemId];
      if (!current) return prev;
      return {
        ...prev,
        [itemId]: { ...current, quantity: isNaN(num) || num < 1 ? 1 : num }
      };
    });
  };

  const toggleItemUrgency = (itemId: string) => {
    setSelectedItems(prev => {
      const current = prev[itemId];
      if (!current) return prev;
      return {
        ...prev,
        [itemId]: { ...current, isUrgent: !current.isUrgent }
      };
    });
  };

  const handleAddCustomItem = () => {
    if (!customName.trim()) {
      toast({
        title: 'Item name required',
        description: 'Please enter a name for the custom raw material.',
        variant: 'destructive'
      });
      return;
    }

    const customId = `custom-${Date.now()}`;
    const qty = parseInt(customQty, 10) || 1;

    setSelectedItems(prev => ({
      ...prev,
      [customId]: {
        name: customName.trim(),
        category: customCategory,
        unit: customUnit || 'Pieces',
        quantity: Math.max(1, qty),
        isUrgent: orderUrgency === 'urgent'
      }
    }));

    setCustomName('');
    setCustomQty('1');
    setShowCustomItemForm(false);

    toast({
      title: 'Custom Item Added',
      description: `Added "${customName.trim()}" to order selection.`
    });
  };

  const handleQuickSeed = async () => {
    try {
      const count = await seedDefaultRawMaterials(user?.displayName || 'Staff');
      toast({
        title: 'Catalog Seeded',
        description: `Successfully added ${count} standard bistro supplies to the raw materials catalog.`
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to seed default catalog.',
        variant: 'destructive'
      });
    }
  };

  const handleSubmitRequest = async () => {
    if (selectedCount === 0) {
      toast({
        title: 'No items selected',
        description: 'Please select at least one raw material to report low stock.',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsList: RawMaterialRequestItem[] = Object.values(selectedItems).map(item => ({
        rawMaterialId: item.rawMaterialId,
        name: item.name,
        category: item.category,
        unit: item.unit,
        quantityRequested: item.quantity,
        isUrgent: item.isUrgent || orderUrgency === 'urgent'
      }));

      const isAnyUrgent = orderUrgency === 'urgent' || itemsList.some(i => i.isUrgent);

      const requestId = await createRawMaterialRequest({
        items: itemsList,
        requestedBy: {
          uid: user?.username || 'staff',
          displayName: user?.displayName || user?.username || 'Staff Member',
          role: user?.role || 'staff'
        },
        notes: orderNotes.trim() || undefined,
        urgency: isAnyUrgent ? 'urgent' : 'normal',
        status: 'pending'
      });

      if (requestId) {
        toast({
          title: 'Order Request Sent! 📦',
          description: `${itemsList.length} item(s) logged. Management has been notified for procurement.`
        });
        setSelectedItems({});
        setOrderNotes('');
        setOrderUrgency('normal');
        setActiveTab('history');
      } else {
        throw new Error('Failed to create request');
      }
    } catch (err) {
      console.error(err);
      toast({
        title: 'Submission Failed',
        description: 'Unable to submit your request. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border">
        {/* Modal Header */}
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-white/10 bg-muted/20 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-headline tracking-wide flex items-center gap-2">
                  Order Raw Materials
                  {pendingRequests.length > 0 && (
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30">
                      {pendingRequests.length} active
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Select items running low so the owner can order fresh stock immediately.
                </DialogDescription>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="mt-3">
            <TabsList className="grid grid-cols-2 h-9 p-1 bg-muted/40">
              <TabsTrigger value="select" className="text-xs font-bold uppercase gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-black">
                <ShoppingBag className="h-3.5 w-3.5" />
                Select Materials
                {selectedCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px] bg-black text-amber-400">
                    {selectedCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs font-bold uppercase gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-black">
                <Clock className="h-3.5 w-3.5" />
                Pending & Recent Orders
                {pendingRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/40">
                    {pendingRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </DialogHeader>

        {/* Tab 1: Selection View */}
        {activeTab === 'select' && (
          <div className="flex-1 overflow-y-auto flex flex-col p-4 sm:p-6 space-y-4">
            {/* Filter and Search Bar */}
            <div className="space-y-2 shrink-0">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search milk, bread, cheese, cups, beans..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs sm:text-sm bg-muted/30 border-white/10"
                  />
                  {searchQuery && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-1 top-1 h-7 px-2 text-xs"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowCustomItemForm(!showCustomItemForm)}
                  className="h-9 px-3 text-xs font-bold uppercase border-dashed border-amber-500/50 hover:border-amber-500 text-amber-400 gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Add Custom Item</span>
                  <span className="sm:hidden">Custom</span>
                </Button>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-2.5 py-1 rounded-full whitespace-nowrap text-[11px] font-semibold transition-all border",
                      selectedCategory === cat 
                        ? "bg-amber-500 text-black border-amber-500 shadow-sm" 
                        : "bg-muted/40 text-muted-foreground border-white/5 hover:border-white/20 hover:text-foreground"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Item Quick Form Drawer */}
            {showCustomItemForm && (
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Quick Custom Low-Stock Item
                  </h4>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowCustomItemForm(false)} 
                    className="h-6 px-2 text-[10px]"
                  >
                    Cancel
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="sm:col-span-2">
                    <Input 
                      placeholder="Item name (e.g. Sugar Cubes, Tissue paper)"
                      value={customName}
                      onChange={e => setCustomName(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div>
                    <Input 
                      placeholder="Unit (e.g. Packets, Kg, L)"
                      value={customUnit}
                      onChange={e => setCustomUnit(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <Input 
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={customQty}
                      onChange={e => setCustomQty(e.target.value)}
                      className="h-8 text-xs bg-background w-16"
                    />
                    <Button 
                      size="sm" 
                      onClick={handleAddCustomItem}
                      className="h-8 flex-1 text-xs font-bold uppercase bg-amber-500 hover:bg-amber-600 text-black"
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Catalog Grid / List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span>Available Catalog Items ({filteredMaterials.length})</span>
                {selectedCount > 0 && (
                  <span className="font-semibold text-amber-400">
                    {selectedCount} item{selectedCount > 1 ? 's' : ''} checked
                  </span>
                )}
              </div>

              {loadingMaterials ? (
                <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
                  Loading supplies catalog...
                </div>
              ) : rawMaterials.length === 0 ? (
                <div className="text-center py-10 px-4 rounded-xl border border-dashed border-white/10 bg-muted/10 space-y-3">
                  <Package className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
                  <div>
                    <h3 className="font-bold text-sm">Supplies Catalog is Empty</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      Load standard cafe, kitchen, and gaming supplies to make it fast for employees to click and order.
                    </p>
                  </div>
                  <Button 
                    onClick={handleQuickSeed} 
                    size="sm" 
                    className="font-bold uppercase text-xs bg-amber-500 hover:bg-amber-600 text-black gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Initialize Bistro Materials
                  </Button>
                </div>
              ) : filteredMaterials.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No materials match &ldquo;{searchQuery}&rdquo; in {selectedCategory}.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filteredMaterials.map(item => {
                    const isSelected = !!selectedItems[item.id];
                    const selectedData = selectedItems[item.id];

                    return (
                      <div 
                        key={item.id}
                        className={cn(
                          "relative p-3 rounded-xl border transition-all duration-150 flex flex-col justify-between gap-2.5",
                          isSelected 
                            ? "bg-amber-500/10 border-amber-500/50 shadow-sm" 
                            : "bg-card/60 border-white/5 hover:border-white/15 hover:bg-card"
                        )}
                      >
                        <div 
                          className="flex items-start gap-3 cursor-pointer select-none"
                          onClick={() => toggleItemSelection(item)}
                        >
                          <div className={cn(
                            "h-5 w-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                            isSelected 
                              ? "bg-amber-500 border-amber-500 text-black" 
                              : "border-white/20 bg-background"
                          )}>
                            {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-xs sm:text-sm text-foreground leading-tight">
                                {item.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                              <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-[10px]">
                                {item.category}
                              </span>
                              <span>Unit: <strong className="text-foreground">{item.unit}</strong></span>
                              {item.lowStockThreshold && (
                                <span className="opacity-70">
                                  Min: {item.lowStockThreshold}
                                </span>
                              )}
                            </div>
                            {item.notes && (
                              <p className="text-[10px] text-muted-foreground/80 mt-1 italic line-clamp-1">
                                {item.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* If Selected, Show Quantity & Urgency Controls */}
                        {isSelected && selectedData && (
                          <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between gap-2 animate-in fade-in duration-150">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-medium text-amber-300">Need:</span>
                              <div className="flex items-center border border-white/10 rounded-lg bg-background overflow-hidden h-7">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, -1)}
                                  className="h-full px-2 hover:bg-muted text-muted-foreground hover:text-foreground"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={selectedData.quantity}
                                  onChange={e => setExactQuantity(item.id, e.target.value)}
                                  className="w-12 h-full text-center text-xs font-mono font-bold bg-transparent focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, 1)}
                                  className="h-full px-2 hover:bg-muted text-muted-foreground hover:text-foreground"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                              <span className="text-[11px] text-muted-foreground font-mono">
                                {item.unit}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleItemUrgency(item.id)}
                              className={cn(
                                "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase transition-all",
                                selectedData.isUrgent
                                  ? "bg-red-500/20 text-red-400 border border-red-500/40"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                              )}
                            >
                              <Flame className={cn("h-3 w-3", selectedData.isUrgent ? "text-red-400 fill-current" : "")} />
                              {selectedData.isUrgent ? 'Critical' : 'Normal'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Custom items added that are not in catalog */}
            {Object.entries(selectedItems)
              .filter(([id]) => id.startsWith('custom-'))
              .length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Custom Low-Stock Additions
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(selectedItems)
                    .filter(([id]) => id.startsWith('custom-'))
                    .map(([customId, item]) => (
                      <div key={customId} className="p-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-xs text-foreground">{item.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {item.quantity} {item.unit} &bull; {item.category}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setSelectedItems(prev => {
                              const next = { ...prev };
                              delete next[customId];
                              return next;
                            });
                          }}
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Overall Order Urgency & Shift Notes */}
            <div className="p-3.5 rounded-xl border border-white/10 bg-muted/20 space-y-3 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Order Priority:</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOrderUrgency('normal')}
                      className={cn(
                        "px-2.5 py-1 rounded text-xs font-bold uppercase transition-all",
                        orderUrgency === 'normal' 
                          ? "bg-slate-700 text-white shadow-sm" 
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      Regular Restock
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderUrgency('urgent')}
                      className={cn(
                        "px-2.5 py-1 rounded text-xs font-bold uppercase flex items-center gap-1 transition-all",
                        orderUrgency === 'urgent' 
                          ? "bg-red-600 text-white shadow-sm shadow-red-500/20 animate-pulse" 
                          : "text-muted-foreground hover:bg-muted hover:text-red-400"
                      )}
                    >
                      <Flame className="h-3.5 w-3.5 fill-current" />
                      Urgent / Running Out Today
                    </button>
                  </div>
                </div>
                {user && (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Reporting as: <strong className="text-foreground">{user.displayName || user.username}</strong>
                  </div>
                )}
              </div>

              <div>
                <Textarea 
                  placeholder="Optional shift notes for the owner (e.g. Milk will finish by evening peak, or buy from local dairy if vendor delayed)..."
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  className="text-xs min-h-[55px] bg-background border-white/10"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Recent / Active Requests History */}
        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-blue-300 flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />
              <div>
                <p className="font-semibold">Review Existing Procurement Requests</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Items listed below have already been reported by staff. Check them before submitting duplicates.
                </p>
              </div>
            </div>

            {loadingRequests ? (
              <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
                Loading request log...
              </div>
            ) : allRequests.length === 0 ? (
              <div className="text-center py-12 text-xs text-muted-foreground">
                No raw material requests submitted yet.
              </div>
            ) : (
              <div className="space-y-3">
                {allRequests.slice(0, 15).map(req => {
                  const isPending = req.status === 'pending';
                  const isOrdered = req.status === 'ordered';
                  const isReceived = req.status === 'received';

                  return (
                    <div 
                      key={req.id} 
                      className={cn(
                        "p-4 rounded-xl border space-y-3 transition-all",
                        isPending 
                          ? "bg-amber-500/5 border-amber-500/30" 
                          : isOrdered 
                            ? "bg-blue-500/5 border-blue-500/30" 
                            : isReceived 
                              ? "bg-emerald-500/5 border-emerald-500/30 opacity-75"
                              : "bg-card border-white/5 opacity-60"
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs font-bold uppercase",
                              isPending && "bg-amber-500/10 text-amber-400 border-amber-500/40",
                              isOrdered && "bg-blue-500/10 text-blue-400 border-blue-500/40",
                              isReceived && "bg-emerald-500/10 text-emerald-400 border-emerald-500/40",
                              req.status === 'cancelled' && "bg-zinc-800 text-zinc-400 border-zinc-700"
                            )}
                          >
                            {req.status}
                          </Badge>

                          {req.urgency === 'urgent' && (
                            <Badge className="bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-bold uppercase gap-1">
                              <Flame className="h-3 w-3 fill-current" /> Urgent
                            </Badge>
                          )}

                          <span className="text-xs text-muted-foreground">
                            by <strong className="text-foreground">{req.requestedBy?.displayName || 'Staff'}</strong>
                          </span>
                        </div>

                        <span className="text-[11px] text-muted-foreground font-mono">
                          {req.createdAt ? formatDistanceToNow(parseISO(req.createdAt), { addSuffix: true }) : ''}
                        </span>
                      </div>

                      {/* Items requested */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {req.items.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-background/60 border border-white/5">
                            <span className="font-medium text-foreground truncate pr-2">
                              {it.name}
                            </span>
                            <Badge variant="secondary" className="font-mono text-xs shrink-0 bg-muted">
                              {it.quantityRequested} {it.unit}
                            </Badge>
                          </div>
                        ))}
                      </div>

                      {req.notes && (
                        <p className="text-xs text-muted-foreground italic bg-muted/20 p-2 rounded border border-white/5">
                          &ldquo;{req.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal Sticky Footer */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {activeTab === 'select' ? (
                <>
                  Selected: <strong className="text-amber-400 font-mono text-sm">{selectedCount}</strong> supplies
                </>
              ) : (
                <>
                  Active queue: <strong className="text-amber-400 font-mono text-sm">{pendingRequests.length}</strong> requests
                </>
              )}
            </span>
            {activeTab === 'select' && selectedCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedItems({})}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-red-400"
              >
                Clear
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onClose}
              className="text-xs font-bold uppercase h-9"
            >
              Cancel
            </Button>
            {activeTab === 'select' && (
              <Button 
                size="sm" 
                disabled={selectedCount === 0 || isSubmitting}
                onClick={handleSubmitRequest}
                className="text-xs font-bold uppercase h-9 px-4 bg-amber-500 hover:bg-amber-600 text-black shadow-md gap-1.5"
              >
                {isSubmitting ? (
                  <>Submitting...</>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4" />
                    Submit Request ({selectedCount})
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
