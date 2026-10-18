'use client';

import { useState, useMemo } from 'react';
import type { Booking, Station, Member } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { startBookingSession, cancelBooking, markBookingNoShow, deleteBooking } from '@/firebase/firestore/bookings';
import { playCoinSound, playWarningSound } from '@/lib/audio/chiptune';
import { 
  Gamepad2, Calendar, Clock, Plus, Play, XCircle, UserX, Trash2, 
  CheckCircle2, AlertTriangle, Phone, Coins, Sparkles, Filter, Edit2 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isFuture, isPast } from 'date-fns';
import { NewBookingModal } from './new-booking-modal';
import { BookingsCalendarView } from './bookings-calendar-view';
import { getSyncedNow } from '@/lib/synced-time';

interface BookingsManagerModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  bookings: Booking[];
  stations: Station[];
  members: Member[];
}

export function BookingsManagerModal({
  isOpen,
  onOpenChange,
  bookings = [],
  stations = [],
  members = [],
}: BookingsManagerModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'today' | 'calendar' | 'upcoming' | 'active' | 'history'>('today');
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [selectedSlotForNewBooking, setSelectedSlotForNewBooking] = useState<{
    stationId: string;
    date: string;
    time: string;
  } | null>(null);
  const [selectedBookingForAction, setSelectedBookingForAction] = useState<Booking | null>(null);
  const [actionType, setActionType] = useState<'cancel' | 'delete' | null>(null);
  const [cancelKeepAdvance, setCancelKeepAdvance] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const ps5Stations = useMemo(() => stations.filter(s => s.type === 'ps5'), [stations]);

  // Filter bookings based on activeTab
  const filteredBookings = useMemo(() => {
    const sorted = [...bookings].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    
    if (activeTab === 'active') {
      return sorted.filter(b => b.status === 'active');
    }
    if (activeTab === 'today') {
      return sorted.filter(b => {
        try {
          return isToday(new Date(b.startTime)) && (b.status === 'confirmed' || b.status === 'active');
        } catch {
          return false;
        }
      });
    }
    if (activeTab === 'upcoming') {
      return sorted.filter(b => b.status === 'confirmed');
    }
    // History
    return sorted.filter(b => ['completed', 'cancelled', 'no-show'].includes(b.status));
  }, [bookings, activeTab]);

  const handleStartNow = async (booking: Booking) => {
    const station = stations.find(s => s.id === booking.stationId);
    if (!station) {
      toast({ variant: 'destructive', title: 'Station Not Found', description: 'Could not find the assigned console.' });
      return;
    }

    if (station.status !== 'available') {
      toast({
        variant: 'destructive',
        title: 'Console Occupied',
        description: `${station.name} is currently ${station.status}. Please check out the current player first.`
      });
      playWarningSound();
      return;
    }

    setIsProcessing(true);
    const success = await startBookingSession(booking, station);
    setIsProcessing(false);

    if (success) {
      playCoinSound();
      toast({
        title: 'Session Started',
        description: `Started reservation on ${station.name} for ${booking.customerName}.`
      });
      onOpenChange(false);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to start session.' });
    }
  };

  const handleConfirmAction = async () => {
    if (!selectedBookingForAction || !actionType) return;
    setIsProcessing(true);

    if (actionType === 'cancel') {
      const ok = await cancelBooking(selectedBookingForAction.id, cancelKeepAdvance);
      if (ok) {
        toast({
          title: 'Booking Cancelled',
          description: `Booking cancelled. Advance ${cancelKeepAdvance ? 'kept' : 'refunded'}.`
        });
      }
    } else if (actionType === 'delete') {
      const ok = await deleteBooking(selectedBookingForAction.id);
      if (ok) {
        toast({ title: 'Booking Deleted' });
      }
    }

    setIsProcessing(false);
    setSelectedBookingForAction(null);
    setActionType(null);
  };

  const handleMarkNoShow = async (booking: Booking) => {
    setIsProcessing(true);
    const ok = await markBookingNoShow(booking.id);
    setIsProcessing(false);
    if (ok) {
      toast({
        title: 'Marked as No-Show',
        description: `Marked ${booking.customerName} as no-show. Advance payment retained.`
      });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl sm:max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 border-2 border-primary/30">
          <DialogHeader className="flex flex-row items-center justify-between gap-3 pb-3 border-b pr-10 sm:pr-12">
            <div>
              <DialogTitle className="flex items-center gap-2 font-headline text-lg sm:text-xl text-sky-400">
                <Calendar className="h-5 w-5" />
                Console Bookings (PS5 & PS4)
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage PS5 and PS4 reservations, time slots, and advance payments
              </p>
            </div>
            <Button
              onClick={() => setIsNewBookingOpen(true)}
              className="h-8 sm:h-9 px-3 text-xs font-bold uppercase bg-sky-500 hover:bg-sky-600 text-black shadow-md gap-1.5 shrink-0"
            >
              <Plus className="h-4 w-4" />
              New Booking
            </Button>
          </DialogHeader>

          {/* Filter Tabs */}
          <div className="flex rounded-lg border p-1 bg-muted/40 gap-1 mt-3 overflow-x-auto">
            {[
              { id: 'today', label: "Today's List" },
              { id: 'calendar', label: '📅 Time Slots' },
              { id: 'upcoming', label: 'All Upcoming' },
              { id: 'active', label: 'In Progress' },
              { id: 'history', label: 'Past / History' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex-1 py-1.5 px-2 text-xs font-bold uppercase rounded-md transition-all text-center whitespace-nowrap",
                  activeTab === tab.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'calendar' ? (
            <div className="py-2">
              <BookingsCalendarView
                bookings={bookings}
                stations={stations}
                members={members}
                onSelectSlot={(stationId, date, time) => {
                  setSelectedSlotForNewBooking({ stationId, date, time });
                  setIsNewBookingOpen(true);
                }}
                onStartBookingNow={handleStartNow}
                onEditBooking={(booking) => {
                  setEditingBooking(booking);
                  setIsNewBookingOpen(true);
                }}
              />
            </div>
          ) : (
            /* Bookings List */
            <div className="space-y-3 py-2">
              {filteredBookings.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                  <Gamepad2 className="h-10 w-10 mx-auto opacity-30 mb-2" />
                  <p className="text-sm font-semibold">No bookings found for this view.</p>
                  <p className="text-xs text-muted-foreground mt-1">Click &quot;New Booking&quot; above to reserve a PS5 console.</p>
                </div>
              ) : (
                filteredBookings.map(booking => {
                  const startObj = new Date(booking.startTime);
                  const endObj = new Date(booking.endTime);
                  const isConfirmed = booking.status === 'confirmed';
                  const isActive = booking.status === 'active';
                  const station = stations.find(s => s.id === booking.stationId);
                  const isStationAvailable = station?.status === 'available';

                  return (
                    <div
                      key={booking.id}
                      className={cn(
                        "p-3.5 rounded-lg border-2 transition-all space-y-2.5",
                        isActive ? "border-emerald-500/50 bg-emerald-500/5" :
                        isConfirmed ? "border-sky-500/40 bg-sky-500/5" : "border-muted bg-card opacity-75"
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono uppercase font-bold text-xs bg-background">
                            {booking.stationName}
                          </Badge>
                          <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                            {booking.customerName}
                            {booking.customerType === 'member' ? (
                              <Badge className="text-[10px] h-4 bg-primary/20 text-primary uppercase font-bold">Member</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] h-4 text-muted-foreground uppercase">Guest</Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {booking.hasAdvance ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold flex items-center gap-1">
                              <Coins className="h-3 w-3" />
                              Adv: ₹{booking.advancePaid} ({booking.advancePaymentMethod?.toUpperCase() || 'CASH'})
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-xs font-medium">
                              No Advance
                            </Badge>
                          )}

                          <Badge 
                            className={cn(
                              "text-xs uppercase font-bold",
                              booking.status === 'active' ? 'bg-emerald-500 text-black' :
                              booking.status === 'confirmed' ? 'bg-sky-500 text-black' :
                              booking.status === 'completed' ? 'bg-muted text-foreground' :
                              booking.status === 'cancelled' ? 'bg-destructive text-destructive-foreground' : 'bg-purple-500 text-white'
                            )}
                          >
                            {booking.status}
                          </Badge>
                        </div>
                      </div>

                      {/* Time & Details */}
                      <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2 pt-1 border-t border-border/50">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 font-semibold text-foreground">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {format(startObj, 'EEE, dd MMM')}
                          </span>
                          <span className="flex items-center gap-1 font-bold text-sky-400">
                            <Clock className="h-3.5 w-3.5 text-sky-400" />
                            {format(startObj, 'hh:mm a')} – {format(endObj, 'hh:mm a')} ({booking.durationMinutes}m)
                          </span>
                          {booking.customerPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {booking.customerPhone}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] font-mono text-muted-foreground">
                          Est. Total: <strong className="text-foreground">₹{booking.estimatedTotal}</strong>
                        </div>
                      </div>

                      {booking.notes && (
                        <p className="text-xs text-muted-foreground italic bg-muted/20 p-1.5 rounded">
                          &quot;{booking.notes}&quot;
                        </p>
                      )}

                      {/* Action Buttons for Confirmed Bookings */}
                      {isConfirmed ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                          <div className="text-[11px] text-muted-foreground">
                            {isStationAvailable ? (
                              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Console is Available (Auto-starts at +5 mins)
                              </span>
                            ) : (
                              <span className="text-amber-400 font-semibold flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Console is currently in-use
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingBooking(booking);
                                setIsNewBookingOpen(true);
                              }}
                              className="h-7 text-xs font-bold uppercase gap-1 border-sky-500/40 text-sky-400 hover:bg-sky-500/10"
                            >
                              <Edit2 className="h-3 w-3" />
                              Edit
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => handleStartNow(booking)}
                              disabled={isProcessing}
                              className="h-7 text-xs font-bold uppercase bg-emerald-500 hover:bg-emerald-600 text-black gap-1 shadow-xs"
                            >
                              <Play className="h-3 w-3 fill-current" />
                              Start Now
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedBookingForAction(booking);
                                setActionType('cancel');
                                setCancelKeepAdvance(true);
                              }}
                              className="h-7 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                            >
                              Cancel
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleMarkNoShow(booking)}
                              className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            >
                              No-Show
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedBookingForAction(booking);
                                setActionType('delete');
                              }}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Delete Booking Record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* Action Buttons for Past / History or Cancelled / No-Show Bookings */
                        <div className="flex items-center justify-between pt-2 border-t text-xs">
                          <span className="text-[11px] text-muted-foreground italic">
                            Status: <strong className="capitalize">{booking.status}</strong>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingBooking(booking);
                                setIsNewBookingOpen(true);
                              }}
                              className="h-7 text-xs font-bold uppercase gap-1 border-sky-500/40 text-sky-400 hover:bg-sky-500/10"
                            >
                              <Edit2 className="h-3 w-3" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedBookingForAction(booking);
                                setActionType('delete');
                              }}
                              className="h-7 text-xs text-destructive hover:bg-destructive/10 gap-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          <DialogFooter className="border-t pt-3 flex justify-between items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              Total Bookings: <strong className="text-foreground">{bookings.length}</strong>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="h-8 text-xs font-bold uppercase">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancellation / Delete Confirmation Overlay */}
      {selectedBookingForAction && actionType && (
        <Dialog open={true} onOpenChange={() => { setSelectedBookingForAction(null); setActionType(null); }}>
          <DialogContent className="max-w-md border-2 border-destructive/30">
            <DialogHeader>
              <DialogTitle className="text-destructive font-headline text-lg">
                {actionType === 'delete' 
                  ? `Delete Booking for ${selectedBookingForAction.customerName}?`
                  : `Cancel Booking for ${selectedBookingForAction.customerName}?`}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-sm">
              <p className="text-muted-foreground text-xs">
                Console: <strong>{selectedBookingForAction.stationName}</strong> on {format(new Date(selectedBookingForAction.startTime), 'PPp')}.
              </p>

              {actionType === 'delete' ? (
                <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs space-y-1">
                  <p className="font-bold">This will permanently remove this booking record from your database history.</p>
                  <p className="text-muted-foreground text-[11px]">This action cannot be undone.</p>
                </div>
              ) : (
                selectedBookingForAction.hasAdvance && selectedBookingForAction.advancePaid > 0 && (
                  <div className="p-3 rounded-lg border bg-muted/40 space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span>Advance Collected:</span>
                      <span className="text-emerald-400 font-mono">₹{selectedBookingForAction.advancePaid}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t">
                      <span>Advance Handling:</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setCancelKeepAdvance(true)}
                          className={cn(
                            "px-2 py-1 text-xs font-bold rounded",
                            cancelKeepAdvance ? "bg-primary text-primary-foreground" : "bg-card border text-foreground"
                          )}
                        >
                          Keep Advance
                        </button>
                        <button
                          type="button"
                          onClick={() => setCancelKeepAdvance(false)}
                          className={cn(
                            "px-2 py-1 text-xs font-bold rounded",
                            !cancelKeepAdvance ? "bg-muted text-foreground font-bold" : "bg-card border text-muted-foreground"
                          )}
                        >
                          Refund
                        </button>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setSelectedBookingForAction(null); setActionType(null); }}>
                Go Back
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleConfirmAction} 
                disabled={isProcessing} 
                className="font-bold text-xs uppercase"
              >
                {isProcessing 
                  ? 'Processing...' 
                  : (actionType === 'delete' ? 'Delete Permanently' : 'Confirm Cancellation')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* New / Edit Booking Sub-Modal */}
      {isNewBookingOpen && (
        <NewBookingModal
          isOpen={isNewBookingOpen}
          onOpenChange={(open) => {
            setIsNewBookingOpen(open);
            if (!open) {
              setSelectedSlotForNewBooking(null);
              setEditingBooking(null);
            }
          }}
          stations={stations}
          members={members}
          existingBookings={bookings}
          editingBooking={editingBooking}
          preselectedStationId={selectedSlotForNewBooking?.stationId}
          initialDate={selectedSlotForNewBooking?.date}
          initialStartTime={selectedSlotForNewBooking?.time}
          onBookingCreated={() => {
            setIsNewBookingOpen(false);
            setSelectedSlotForNewBooking(null);
            setEditingBooking(null);
          }}
          onBookingUpdated={() => {
            setIsNewBookingOpen(false);
            setSelectedSlotForNewBooking(null);
            setEditingBooking(null);
          }}
        />
      )}
    </>
  );
}
