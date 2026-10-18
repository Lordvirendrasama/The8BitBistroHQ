'use client';

import { useState, useMemo } from 'react';
import type { RawMaterial, RawMaterialFormData, RawMaterialRequest } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package, 
  PlusCircle, 
  Trash2, 
  Edit, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Copy, 
  Sparkles, 
  Check, 
  ShoppingBag, 
  Send,
  MoreVertical,
  ExternalLink,
  Store,
  Filter
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuth } from '@/firebase/auth/use-user';
import { 
  addRawMaterial, 
  updateRawMaterial, 
  deleteRawMaterial, 
  seedDefaultRawMaterials,
  updateRawMaterialRequestStatus,
  deleteRawMaterialRequest
} from '@/firebase/firestore/raw-materials';
import { RawMaterialFormModal } from './raw-material-form-modal';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

const CATEGORY_COLORS: Record<string, string> = {
  'Dairy': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Kitchen & Food': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Beverages': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Packaging & Supplies': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Gaming & Tech': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Cleaning & Housekeeping': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'Other': 'bg-zinc-800 text-zinc-300 border-zinc-700'
};

export function RawMaterialsManager() {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'requests' | 'catalog'>('requests');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'ordered' | 'received'>('all');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [copied, setCopied] = useState(false);

  // Firestore Queries
  const materialsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'rawMaterials'), orderBy('name', 'asc'));
  }, [db]);
  const { data: rawMaterials, loading: loadingMaterials } = useCollection<RawMaterial>(materialsQuery);

  const requestsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'rawMaterialRequests'), orderBy('createdAt', 'desc'));
  }, [db]);
  const { data: rawRequests, loading: loadingRequests } = useCollection<RawMaterialRequest>(requestsQuery);

  // Calculations
  const pendingRequests = useMemo(() => {
    if (!rawRequests) return [];
    return rawRequests.filter(r => r.status === 'pending');
  }, [rawRequests]);

  const filteredRequests = useMemo(() => {
    if (!rawRequests) return [];
    let list = rawRequests;
    if (statusFilter !== 'all') {
      list = list.filter(r => r.status === statusFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(r => 
        r.items.some(i => i.name.toLowerCase().includes(term) || i.category.toLowerCase().includes(term)) ||
        r.requestedBy.displayName.toLowerCase().includes(term) ||
        (r.notes && r.notes.toLowerCase().includes(term))
      );
    }
    return list;
  }, [rawRequests, statusFilter, searchTerm]);

  const filteredMaterials = useMemo(() => {
    if (!rawMaterials) return [];
    let list = rawMaterials;
    if (categoryFilter !== 'All') {
      list = list.filter(m => m.category === categoryFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(m => 
        m.name.toLowerCase().includes(term) || 
        m.category.toLowerCase().includes(term) ||
        (m.notes && m.notes.toLowerCase().includes(term)) ||
        (m.preferredSupplier && m.preferredSupplier.toLowerCase().includes(term))
      );
    }
    return list;
  }, [rawMaterials, categoryFilter, searchTerm]);

  // Actions
  const handleSaveMaterial = async (data: RawMaterialFormData) => {
    if (editingMaterial) {
      await updateRawMaterial(editingMaterial.id, data, user?.displayName || user?.username);
      toast({ title: "Material Updated", description: `${data.name} updated successfully.` });
    } else {
      await addRawMaterial(data, user?.displayName || user?.username);
      toast({ title: "Material Added", description: `${data.name} added to catalog.` });
    }
  };

  const handleDeleteMaterial = async (mat: RawMaterial) => {
    await deleteRawMaterial(mat.id, mat.name, user?.displayName || user?.username);
    toast({ variant: "destructive", title: "Material Deleted", description: `${mat.name} removed from catalog.` });
  };

  const handleSeedDefaults = async () => {
    setIsSeeding(true);
    try {
      const count = await seedDefaultRawMaterials(user?.displayName || user?.username);
      if (count > 0) {
        toast({ title: "Catalog Seeded", description: `Added ${count} common raw materials into the catalog.` });
      } else {
        toast({ title: "Already Up to Date", description: "All common bistro materials already exist in your catalog." });
      }
    } catch {
      toast({ variant: "destructive", title: "Seeding Failed", description: "Could not seed default materials." });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleUpdateStatus = async (requestId: string, newStatus: 'pending' | 'ordered' | 'received' | 'cancelled') => {
    await updateRawMaterialRequestStatus(requestId, newStatus, user?.displayName || user?.username);
    const messages = {
      ordered: "Order marked as ORDERED. Items have been sent for purchase.",
      received: "Order marked as RECEIVED. Stock replenished.",
      pending: "Request marked back to PENDING.",
      cancelled: "Request marked as CANCELLED."
    };
    toast({ title: "Status Updated", description: messages[newStatus] });
  };

  const handleDeleteRequest = async (requestId: string) => {
    await deleteRawMaterialRequest(requestId, user?.displayName || user?.username);
    toast({ variant: "destructive", title: "Request Removed", description: "Procurement request has been deleted." });
  };

  const handleCopyWhatsAppList = () => {
    if (!pendingRequests || pendingRequests.length === 0) {
      toast({ title: "No Pending Items", description: "There are no pending order requests right now." });
      return;
    }

    const todayStr = format(new Date(), 'dd MMM yyyy, hh:mm a');
    let text = `🛒 *THE 8 BIT BISTRO - RAW MATERIALS NEEDED*\n📅 _Generated: ${todayStr}_\n\n`;

    // Deduplicate and aggregate pending items
    const itemMap = new Map<string, { name: string; quantity: string; unit: string; urgent: boolean; notes: string[] }>();

    pendingRequests.forEach(req => {
      req.items.forEach(item => {
        const key = item.name.toLowerCase().trim();
        const existing = itemMap.get(key);
        if (existing) {
          existing.urgent = existing.urgent || !!item.isUrgent || req.urgency === 'urgent';
          if (req.notes) existing.notes.push(req.notes);
        } else {
          itemMap.set(key, {
            name: item.name,
            quantity: String(item.quantityRequested),
            unit: item.unit,
            urgent: !!item.isUrgent || req.urgency === 'urgent',
            notes: req.notes ? [req.notes] : []
          });
        }
      });
    });

    let index = 1;
    itemMap.forEach(item => {
      text += `${index}. *${item.name}* - ${item.quantity} ${item.unit}${item.urgent ? ' ⚠️ *(URGENT)*' : ''}\n`;
      if (item.notes.length > 0) {
        text += `   ↳ Note: ${item.notes.join(', ')}\n`;
      }
      index++;
    });

    text += `\n_Please confirm delivery ETA._`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast({ title: "Order List Copied!", description: "WhatsApp procurement format copied to clipboard." });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-headline font-bold uppercase tracking-wide text-white">
                Raw Materials &amp; Supply Orders
              </h2>
              {pendingRequests.length > 0 && (
                <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold uppercase animate-pulse">
                  {pendingRequests.length} Needs Order
                </Badge>
              )}
            </div>
            <p className="text-xs font-bold uppercase text-zinc-400">
              Manage inventory master items and employee low-stock order requests
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pendingRequests.length > 0 && (
            <Button
              onClick={handleCopyWhatsAppList}
              variant="outline"
              size="sm"
              className="h-10 border-2 font-bold uppercase text-xs gap-1.5 bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied List!' : 'Copy for WhatsApp'}
            </Button>
          )}

          <Button
            onClick={() => {
              setEditingMaterial(null);
              setIsFormModalOpen(true);
            }}
            className="h-10 bg-amber-500 hover:bg-amber-600 text-black font-extrabold uppercase text-xs gap-1.5 shadow-md"
          >
            <PlusCircle className="h-4 w-4" />
            + Add Raw Material
          </Button>

          {(!rawMaterials || rawMaterials.length === 0) && (
            <Button
              onClick={handleSeedDefaults}
              disabled={isSeeding}
              variant="outline"
              size="sm"
              className="h-10 border-2 font-bold uppercase text-xs gap-1.5 border-zinc-700 text-zinc-300 hover:text-white"
            >
              <Sparkles className="h-4 w-4 text-yellow-400" />
              {isSeeding ? 'Seeding...' : 'Seed Defaults'}
            </Button>
          )}
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList className="bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
            <TabsTrigger 
              value="requests" 
              className="font-bold text-xs uppercase data-[state=active]:bg-amber-500 data-[state=active]:text-black gap-2 px-4 py-2"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Order Requests
              {pendingRequests.length > 0 && (
                <span className="h-5 px-1.5 rounded-full bg-red-600 text-white text-[10px] font-extrabold flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="catalog" 
              className="font-bold text-xs uppercase data-[state=active]:bg-amber-500 data-[state=active]:text-black gap-2 px-4 py-2"
            >
              <Package className="h-3.5 w-3.5" />
              Master Catalog
              {rawMaterials && (
                <span className="text-[10px] text-zinc-400 font-mono">
                  ({rawMaterials.length})
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder={activeTab === 'requests' ? "Filter requests or staff..." : "Search raw materials..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 border-zinc-800 bg-zinc-900 font-bold uppercase text-xs"
            />
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* TAB 1: ORDER REQUESTS (Items employees flagged as low) */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="requests" className="space-y-4 m-0">
          {/* Status Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pb-1">
            <span className="text-xs font-bold uppercase text-zinc-500 mr-1 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Status:
            </span>
            {[
              { id: 'all', label: 'All Requests' },
              { id: 'pending', label: `Pending (${pendingRequests.length})`, alert: pendingRequests.length > 0 },
              { id: 'ordered', label: 'Ordered' },
              { id: 'received', label: 'Received' },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id as any)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all border",
                  statusFilter === f.id
                    ? "bg-amber-500 text-black border-amber-500 shadow-sm"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700",
                  f.alert && statusFilter !== f.id && "border-red-500/40 text-red-400 bg-red-500/10"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loadingRequests ? (
            <div className="p-12 text-center text-sm font-bold uppercase text-zinc-500">
              Loading procurement requests...
            </div>
          ) : filteredRequests.length === 0 ? (
            <Card className="border-2 border-dashed border-zinc-800 bg-zinc-900/30">
              <CardContent className="p-12 text-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold uppercase text-white">No Pending Low Stock Requests</h3>
                <p className="text-xs font-medium text-zinc-400 max-w-sm mx-auto">
                  When employees notice any item running low, they can click "Need to Order" on the dashboard to log it here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRequests.map(req => {
                const isPending = req.status === 'pending';
                const isOrdered = req.status === 'ordered';
                const isReceived = req.status === 'received';
                const isUrgent = req.urgency === 'urgent' || req.items.some(i => i.isUrgent);

                return (
                  <Card 
                    key={req.id} 
                    className={cn(
                      "border-2 transition-all shadow-md relative overflow-hidden",
                      isUrgent && isPending ? "border-red-500/50 bg-red-950/10" : "border-zinc-800 bg-zinc-900/80",
                      isReceived && "opacity-70 bg-zinc-950/50 border-zinc-900"
                    )}
                  >
                    {isUrgent && isPending && (
                      <div className="absolute top-0 right-0 bg-red-600 text-white font-extrabold text-[10px] uppercase px-3 py-0.5 rounded-bl-lg shadow-sm flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> URGENT
                      </div>
                    )}

                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              className={cn(
                                "text-[10px] font-extrabold uppercase px-2 py-0.5",
                                isPending && "bg-amber-500/20 text-amber-400 border border-amber-500/30",
                                isOrdered && "bg-blue-500/20 text-blue-400 border border-blue-500/30",
                                isReceived && "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              )}
                            >
                              {req.status}
                            </Badge>
                            <span className="text-xs text-zinc-400 font-bold uppercase flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {req.createdAt ? formatDistanceToNow(new Date(req.createdAt), { addSuffix: true }) : 'Recently'}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-zinc-300 uppercase mt-1">
                            Requested by: <span className="text-white font-extrabold">{req.requestedBy.displayName}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-red-400">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-zinc-950 border-zinc-800 text-white">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="font-headline uppercase">Delete Request?</AlertDialogTitle>
                                <AlertDialogDescription className="text-zinc-400 font-bold uppercase text-xs">
                                  This will permanently remove this order request from system records.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="font-bold uppercase text-xs">Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteRequest(req.id)}
                                  className="bg-red-600 hover:bg-red-700 text-white font-bold uppercase text-xs"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-1 space-y-3">
                      {/* Items List */}
                      <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-1.5">
                        <span className="text-[10px] font-extrabold uppercase text-zinc-500 tracking-wider">Requested Items:</span>
                        <div className="space-y-1">
                          {req.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-extrabold text-white uppercase truncate">{item.name}</span>
                                {item.isUrgent && (
                                  <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] px-1 py-0 uppercase">
                                    ASAP
                                  </Badge>
                                )}
                              </div>
                              <span className="font-mono font-bold text-amber-400 shrink-0">
                                {item.quantityRequested} {item.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Notes if any */}
                      {req.notes && (
                        <div className="text-xs p-2 rounded-lg bg-zinc-950/40 border border-zinc-800 text-zinc-300 font-medium italic">
                          <span className="font-bold text-zinc-400 not-italic uppercase text-[10px] block">Staff Note:</span>
                          "{req.notes}"
                        </div>
                      )}

                      {/* Actions */}
                      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/60">
                        <div className="text-[10px] text-zinc-500 font-mono">
                          ID: #{req.id.substring(0, 6)}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isPending && (
                            <Button
                              size="sm"
                              onClick={() => handleUpdateStatus(req.id, 'ordered')}
                              className="h-8 px-3 text-xs font-extrabold uppercase bg-blue-600 hover:bg-blue-700 text-white gap-1 shadow-sm"
                            >
                              <ShoppingBag className="h-3.5 w-3.5" />
                              Mark Ordered
                            </Button>
                          )}

                          {isOrdered && (
                            <Button
                              size="sm"
                              onClick={() => handleUpdateStatus(req.id, 'received')}
                              className="h-8 px-3 text-xs font-extrabold uppercase bg-emerald-600 hover:bg-emerald-700 text-white gap-1 shadow-sm"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Mark Received
                            </Button>
                          )}

                          {isReceived && (
                            <Badge variant="outline" className="text-[10px] font-bold uppercase text-emerald-400 border-emerald-500/30">
                              Replenished
                            </Badge>
                          )}

                          {!isPending && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUpdateStatus(req.id, 'pending')}
                              className="h-8 text-[10px] font-bold uppercase text-zinc-400 hover:text-white"
                            >
                              Re-open
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* TAB 2: MASTER RAW MATERIALS CATALOG */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="catalog" className="space-y-4 m-0">
          {/* Category Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pb-1">
            <span className="text-xs font-bold uppercase text-zinc-500 mr-1 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Category:
            </span>
            {['All', 'Dairy', 'Kitchen & Food', 'Beverages', 'Packaging & Supplies', 'Gaming & Tech', 'Cleaning & Housekeeping'].map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all border",
                  categoryFilter === cat
                    ? "bg-amber-500 text-black border-amber-500 shadow-sm"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <Card className="border-2 border-zinc-800 bg-zinc-900/60 shadow-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-950 border-b border-zinc-800">
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="font-extrabold uppercase text-xs text-zinc-400">Material Name</TableHead>
                  <TableHead className="font-extrabold uppercase text-xs text-zinc-400">Category</TableHead>
                  <TableHead className="font-extrabold uppercase text-xs text-zinc-400">Unit</TableHead>
                  <TableHead className="font-extrabold uppercase text-xs text-zinc-400">Low Stock Alert</TableHead>
                  <TableHead className="font-extrabold uppercase text-xs text-zinc-400">Supplier / Brand</TableHead>
                  <TableHead className="font-extrabold uppercase text-xs text-zinc-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMaterials ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 font-bold uppercase text-xs text-zinc-500">
                      Loading raw materials catalog...
                    </TableCell>
                  </TableRow>
                ) : filteredMaterials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 space-y-3">
                      <Package className="h-8 w-8 text-zinc-600 mx-auto" />
                      <p className="font-bold uppercase text-xs text-zinc-400">No raw materials found matching filter.</p>
                      <Button
                        size="sm"
                        onClick={handleSeedDefaults}
                        variant="outline"
                        className="font-bold uppercase text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500 hover:text-black gap-1.5"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Seed Bistro Defaults
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMaterials.map(mat => (
                    <TableRow key={mat.id} className="border-zinc-800/80 hover:bg-zinc-800/40 transition-colors">
                      <TableCell className="font-extrabold uppercase text-sm text-white">
                        <div>
                          <span>{mat.name}</span>
                          {mat.notes && (
                            <p className="text-[11px] font-normal text-zinc-400 normal-case tracking-normal">{mat.notes}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-[10px] font-bold uppercase border", CATEGORY_COLORS[mat.category] || CATEGORY_COLORS['Other'])}>
                          {mat.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold text-xs uppercase text-zinc-300">
                        {mat.unit}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-bold text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          &lt; {mat.lowStockThreshold || 1} {mat.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-400 font-bold uppercase">
                        {mat.preferredSupplier || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingMaterial(mat);
                              setIsFormModalOpen(true);
                            }}
                            className="h-8 w-8 text-zinc-400 hover:text-amber-400"
                            title="Edit"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-zinc-400 hover:text-red-400"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-zinc-950 border-zinc-800 text-white">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="font-headline uppercase">Delete Material Item?</AlertDialogTitle>
                                <AlertDialogDescription className="text-zinc-400 font-bold uppercase text-xs">
                                  Are you sure you want to remove <strong>{mat.name}</strong> from the raw materials catalog?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="font-bold uppercase text-xs">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteMaterial(mat)}
                                  className="bg-red-600 hover:bg-red-700 text-white font-bold uppercase text-xs"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Form Modal for Add/Edit */}
      <RawMaterialFormModal
        isOpen={isFormModalOpen}
        onOpenChange={setIsFormModalOpen}
        material={editingMaterial}
        onSave={handleSaveMaterial}
      />
    </div>
  );
}
