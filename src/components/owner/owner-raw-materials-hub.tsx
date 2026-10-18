'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  ShoppingBag, 
  Copy, 
  Check, 
  ExternalLink, 
  Clock, 
  Flame, 
  Truck, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Send,
  MoreVertical,
  Trash2,
  Calendar,
  User,
  ArrowUpRight
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
} from '@/components/ui/alert-dialog';
import { useFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import { useAuth } from '@/firebase/auth/use-user';
import { useToast } from '@/hooks/use-toast';
import type { RawMaterialRequest } from '@/lib/types';
import { 
  updateRawMaterialRequestStatus, 
  deleteRawMaterialRequest 
} from '@/firebase/firestore/raw-materials';
import { RawMaterialsOrderModal } from '@/components/dashboard/raw-materials-order-modal';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function OwnerRawMaterialsHub() {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeFilter, setActiveFilter] = useState<'pending' | 'ordered' | 'all'>('pending');
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Firestore query for requests
  const requestsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'rawMaterialRequests'), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: rawRequestsData, loading } = useCollection<RawMaterialRequest>(requestsQuery);
  const allRequests = useMemo(() => rawRequestsData || [], [rawRequestsData]);

  // Status breakdown
  const pendingRequests = useMemo(() => {
    return allRequests.filter(r => r.status === 'pending');
  }, [allRequests]);

  const orderedRequests = useMemo(() => {
    return allRequests.filter(r => r.status === 'ordered');
  }, [allRequests]);

  const receivedRequests = useMemo(() => {
    return allRequests.filter(r => r.status === 'received');
  }, [allRequests]);

  // Filtered requests for current tab
  const displayedRequests = useMemo(() => {
    if (activeFilter === 'pending') return pendingRequests;
    if (activeFilter === 'ordered') return orderedRequests;
    return allRequests;
  }, [activeFilter, pendingRequests, orderedRequests, allRequests]);

  // Aggregate pending items count
  const totalPendingItemsCount = useMemo(() => {
    return pendingRequests.reduce((sum, req) => sum + (req.items?.length || 0), 0);
  }, [pendingRequests]);

  const urgentPendingCount = useMemo(() => {
    return pendingRequests.filter(r => r.urgency === 'urgent' || r.items?.some(i => i.isUrgent)).length;
  }, [pendingRequests]);

  // 1-Click WhatsApp / Vendor message formatter
  const handleCopyForVendor = (request?: RawMaterialRequest) => {
    const today = format(new Date(), 'dd MMM yyyy, h:mm a');
    let text = `📦 *THE 8 BIT BISTRO - SUPPLIES RE-ORDER*\n📅 *${today}*\n\n`;

    if (request) {
      text += `*Requested by:* ${request.requestedBy?.displayName || 'Staff'}\n`;
      if (request.notes) text += `*Notes:* ${request.notes}\n`;
      text += `\n*Items to order:*\n`;
      request.items.forEach((item, idx) => {
        text += `${idx + 1}. *${item.name}* - ${item.quantityRequested} ${item.unit} (${item.category})\n`;
      });
      text += `\nPlease confirm availability and dispatch time. Thank you!`;

      navigator.clipboard.writeText(text);
      setCopiedId(request.id);
      setTimeout(() => setCopiedId(null), 2500);

      toast({
        title: 'Copied Order to Clipboard 📋',
        description: 'Formatted message ready to paste directly into WhatsApp or email for the vendor.'
      });
    } else {
      // Copy all pending items combined
      if (pendingRequests.length === 0) {
        toast({ title: 'No pending items', description: 'There are no pending supplies to order.' });
        return;
      }

      text += `*Summary of all low-stock items to order:*\n\n`;
      let counter = 1;
      pendingRequests.forEach(req => {
        req.items.forEach(item => {
          text += `${counter}. *${item.name}* - ${item.quantityRequested} ${item.unit} (${item.category})\n`;
          counter++;
        });
      });

      text += `\nPlease deliver to: The 8 Bit Bistro, Brahma Majestic, NIBM Road, Pune.`;

      navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);

      toast({
        title: 'All Pending Supplies Copied! 🛒',
        description: `Copied ${totalPendingItemsCount} item(s) across ${pendingRequests.length} staff requests for vendor.`
      });
    }
  };

  const handleUpdateStatus = async (
    requestId: string, 
    newStatus: 'pending' | 'ordered' | 'received' | 'cancelled'
  ) => {
    try {
      const success = await updateRawMaterialRequestStatus(
        requestId, 
        newStatus, 
        user?.displayName || 'Owner'
      );
      if (success) {
        toast({
          title: `Status Updated: ${newStatus.toUpperCase()}`,
          description: `Order request has been marked as ${newStatus}.`
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update order status.',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteRawMaterialRequest(deleteTargetId, user?.displayName || 'Owner');
      toast({
        title: 'Request Removed',
        description: 'Procurement request has been deleted.'
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete request.',
        variant: 'destructive'
      });
    } finally {
      setDeleteTargetId(null);
    }
  };

  return (
    <section className="space-y-4">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              RAW MATERIALS &amp; RESTOCK ORDERS
              {pendingRequests.length > 0 && (
                <Badge className="bg-amber-500 text-black font-mono font-bold text-[10px] uppercase shadow-sm">
                  {pendingRequests.length} PENDING ({totalPendingItemsCount} ITEMS)
                </Badge>
              )}
              {urgentPendingCount > 0 && (
                <Badge className="bg-red-500 text-white font-mono font-bold text-[10px] uppercase gap-1 animate-pulse">
                  <Flame className="h-3 w-3 fill-current" /> {urgentPendingCount} URGENT
                </Badge>
              )}
            </h2>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground opacity-70">
              STAFF LOW-STOCK NOTIFICATIONS &bull; VENDOR RE-ORDERS &bull; PROCUREMENT LOG
            </p>
          </div>
        </div>

        {/* QUICK ACTION BUTTONS */}
        <div className="flex items-center gap-2 flex-wrap">
          {pendingRequests.length > 0 && (
            <Button
              size="sm"
              onClick={() => handleCopyForVendor()}
              className="h-8 text-xs font-bold uppercase bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-sm"
            >
              {copiedAll ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedAll ? 'Copied WhatsApp List' : 'Copy for WhatsApp'}
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsOrderModalOpen(true)}
            className="h-8 text-xs font-bold uppercase border-amber-500/40 text-amber-400 hover:bg-amber-500/10 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> + New Order
          </Button>

          <Button
            asChild
            size="sm"
            variant="ghost"
            className="h-8 text-xs font-bold uppercase text-muted-foreground hover:text-primary gap-1"
          >
            <Link href="/settings/raw-materials">
              Supplies Catalog <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => setActiveFilter('pending')}
          className={cn(
            "px-3 py-1.5 rounded-lg font-bold uppercase transition-all text-xs flex items-center gap-1.5 border",
            activeFilter === 'pending'
              ? "bg-amber-500 text-black border-amber-500 shadow-sm"
              : "bg-card text-muted-foreground border-border/40 hover:text-foreground"
          )}
        >
          Pending Orders
          <span className={cn(
            "ml-1 px-1.5 py-0.2 rounded-full font-mono text-[10px]",
            activeFilter === 'pending' ? "bg-black text-amber-400" : "bg-muted text-muted-foreground"
          )}>
            {pendingRequests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveFilter('ordered')}
          className={cn(
            "px-3 py-1.5 rounded-lg font-bold uppercase transition-all text-xs flex items-center gap-1.5 border",
            activeFilter === 'ordered'
              ? "bg-blue-600 text-white border-blue-500 shadow-sm"
              : "bg-card text-muted-foreground border-border/40 hover:text-foreground"
          )}
        >
          Ordered / In-Transit
          <span className={cn(
            "ml-1 px-1.5 py-0.2 rounded-full font-mono text-[10px]",
            activeFilter === 'ordered' ? "bg-black/40 text-blue-300" : "bg-muted text-muted-foreground"
          )}>
            {orderedRequests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveFilter('all')}
          className={cn(
            "px-3 py-1.5 rounded-lg font-bold uppercase transition-all text-xs flex items-center gap-1.5 border",
            activeFilter === 'all'
              ? "bg-zinc-700 text-white border-zinc-600 shadow-sm"
              : "bg-card text-muted-foreground border-border/40 hover:text-foreground"
          )}
        >
          All Activity Log ({allRequests.length})
        </button>
      </div>

      {/* REQUESTS CONTENT */}
      {loading ? (
        <div className="p-8 text-center text-xs text-muted-foreground animate-pulse rounded-xl border border-border/40 bg-card/40">
          Loading raw materials procurement requests...
        </div>
      ) : displayedRequests.length === 0 ? (
        <div className="p-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-emerald-400">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold uppercase tracking-wide">
                {activeFilter === 'pending' 
                  ? 'All Bistro Raw Materials In Stock' 
                  : activeFilter === 'ordered' 
                    ? 'No Active Orders Currently In-Transit' 
                    : 'No Raw Material Requests on Record'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Staff can report low stock directly from the cafe dashboard button at any time.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsOrderModalOpen(true)}
            className="h-8 text-xs font-bold uppercase border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          >
            Create Order Request
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {displayedRequests.map(req => {
            const isPending = req.status === 'pending';
            const isOrdered = req.status === 'ordered';
            const isReceived = req.status === 'received';
            const isUrgent = req.urgency === 'urgent' || req.items?.some(i => i.isUrgent);

            return (
              <div
                key={req.id}
                className={cn(
                  "p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between gap-3 shadow-md",
                  isPending 
                    ? isUrgent
                      ? "bg-gradient-to-br from-rose-950/20 via-card to-amber-950/20 border-rose-500/50 hover:border-rose-500"
                      : "bg-gradient-to-br from-amber-950/20 via-card to-background border-amber-500/30 hover:border-amber-500/60"
                    : isOrdered
                      ? "bg-gradient-to-br from-blue-950/20 via-card to-background border-blue-500/30"
                      : "bg-card/70 border-white/5 opacity-80"
                )}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-mono font-bold uppercase px-2 py-0.5",
                          isPending && "bg-amber-500/20 text-amber-400 border-amber-500/50",
                          isOrdered && "bg-blue-500/20 text-blue-400 border-blue-500/50",
                          isReceived && "bg-emerald-500/20 text-emerald-400 border-emerald-500/50",
                          req.status === 'cancelled' && "bg-zinc-800 text-zinc-400 border-zinc-700"
                        )}
                      >
                        {req.status}
                      </Badge>

                      {isUrgent && (
                        <Badge className="bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-bold uppercase gap-1 animate-pulse">
                          <Flame className="h-3 w-3 fill-current" /> Urgent
                        </Badge>
                      )}

                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground/60" />
                        by <strong className="text-foreground">{req.requestedBy?.displayName || 'Staff'}</strong>
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground font-mono mt-1">
                      {req.createdAt ? formatDistanceToNow(parseISO(req.createdAt), { addSuffix: true }) : ''}
                      {req.cycle && <span className="text-muted-foreground/50"> &bull; {req.cycle}</span>}
                    </p>
                  </div>

                  {/* Actions Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 text-xs font-semibold">
                      <DropdownMenuItem onClick={() => handleCopyForVendor(req)}>
                        <Copy className="mr-2 h-3.5 w-3.5" />
                        Copy Order (WhatsApp)
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {isPending && (
                        <DropdownMenuItem onClick={() => handleUpdateStatus(req.id, 'ordered')}>
                          <Truck className="mr-2 h-3.5 w-3.5 text-blue-400" />
                          Mark as Ordered
                        </DropdownMenuItem>
                      )}
                      {!isReceived && (
                        <DropdownMenuItem onClick={() => handleUpdateStatus(req.id, 'received')}>
                          <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-emerald-400" />
                          Mark as Received
                        </DropdownMenuItem>
                      )}
                      {isOrdered && (
                        <DropdownMenuItem onClick={() => handleUpdateStatus(req.id, 'pending')}>
                          <Clock className="mr-2 h-3.5 w-3.5 text-amber-400" />
                          Revert to Pending
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setDeleteTargetId(req.id)}
                        className="text-red-400 focus:text-red-300"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete Request
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Items list */}
                <div className="space-y-1.5 flex-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Items Requested ({req.items?.length || 0}):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {req.items?.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-background/80 border border-white/5 text-xs"
                      >
                        <div className="truncate pr-2">
                          <p className="font-semibold text-foreground truncate">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{item.category}</p>
                        </div>
                        <Badge variant="secondary" className="font-mono text-xs font-bold shrink-0 bg-muted">
                          {item.quantityRequested} {item.unit}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  {req.notes && (
                    <p className="text-xs text-muted-foreground italic bg-muted/30 p-2 rounded-lg border border-white/5 mt-2">
                      &ldquo;{req.notes}&rdquo;
                    </p>
                  )}
                </div>

                {/* Card Footer / Primary Action Bar */}
                <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopyForVendor(req)}
                    className="h-8 px-2 text-[11px] font-bold uppercase text-muted-foreground hover:text-emerald-400 gap-1"
                  >
                    {copiedId === req.id ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400 stroke-[3]" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </Button>

                  <div className="flex items-center gap-1.5">
                    {isPending && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(req.id, 'ordered')}
                        className="h-8 px-3 text-[11px] font-bold uppercase bg-blue-600 hover:bg-blue-500 text-white gap-1"
                      >
                        <Truck className="h-3.5 w-3.5" />
                        Mark Ordered
                      </Button>
                    )}

                    {isOrdered && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(req.id, 'received')}
                        className="h-8 px-3 text-[11px] font-bold uppercase bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark Received
                      </Button>
                    )}

                    {isReceived && (
                      <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Stock Received
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={open => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Procurement Request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this raw material request from the queue. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Order Modal Mount */}
      <RawMaterialsOrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
      />
    </section>
  );
}
