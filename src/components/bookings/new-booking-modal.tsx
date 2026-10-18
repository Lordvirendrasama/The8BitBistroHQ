'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Station, Member, Booking } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createBooking, updateBooking } from '@/firebase/firestore/bookings';
import { searchMembers } from '@/firebase/firestore/members';
import { calculateGroupPrice } from '@/lib/pricing';
import { playCoinSound } from '@/lib/audio/chiptune';
import { Gamepad2, Calendar, Clock, User, Phone, Coins, Check, AlertCircle, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/firebase/auth/use-user';
import { format, addMinutes } from 'date-fns';

interface NewBookingModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  stations: Station[];
  members: Member[];
  existingBookings?: Booking[];
  editingBooking?: Booking | null;
  onBookingCreated?: (bookingId: string) => void;
  onBookingUpdated?: (bookingId: string) => void;
  preselectedStationId?: string;
  initialDate?: string;
  initialStartTime?: string;
}

export function NewBookingModal({
  isOpen,
  onOpenChange,
  stations,
  members,
  existingBookings = [],
  editingBooking = null,
  onBookingCreated,
  onBookingUpdated,
  preselectedStationId,
  initialDate,
  initialStartTime,
}: NewBookingModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const consoleStations = useMemo(() => {
    return stations.filter(s => s.type === 'ps5' || s.type === 'ps4');
  }, [stations]);

  // Form State
  const [selectedStationId, setSelectedStationId] = useState<string>(preselectedStationId || '');
  const [customerType, setCustomerType] = useState<'member' | 'guest'>('guest');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [memberSearch, setMemberSearch] = useState<string>('');
  const [guestName, setGuestName] = useState<string>('');
  const [guestPhone, setGuestPhone] = useState<string>('');
  const [bookingDate, setBookingDate] = useState<string>(initialDate || format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState<string>(initialStartTime || '18:00');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [playerCount, setPlayerCount] = useState<number>(1);
  const [hasAdvance, setHasAdvance] = useState<boolean>(true);
  const [advanceAmount, setAdvanceAmount] = useState<string>('100');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi'>('cash');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingBooking) {
      setSelectedStationId(editingBooking.stationId);
      setCustomerType(editingBooking.customerType);
      if (editingBooking.memberId) {
        setSelectedMemberId(editingBooking.memberId);
        setMemberSearch(editingBooking.customerName);
      } else {
        setGuestName(editingBooking.customerName);
      }
      setGuestPhone(editingBooking.customerPhone || '');
      setBookingDate(editingBooking.date);
      try {
        const startObj = new Date(editingBooking.startTime);
        setStartTime(format(startObj, 'HH:mm'));
      } catch {}
      setDurationMinutes(editingBooking.durationMinutes);
      setPlayerCount(editingBooking.playerCount || 1);
      setHasAdvance(editingBooking.hasAdvance);
      setAdvanceAmount(String(editingBooking.advancePaid || 0));
      setPaymentMethod(editingBooking.advancePaymentMethod || 'cash');
      setNotes(editingBooking.notes || '');
      return;
    }

    if (preselectedStationId) {
      setSelectedStationId(preselectedStationId);
    } else if (consoleStations.length > 0 && !selectedStationId) {
      setSelectedStationId(consoleStations[0].id);
    }
    if (initialDate) setBookingDate(initialDate);
    if (initialStartTime) setStartTime(initialStartTime);
  }, [editingBooking, preselectedStationId, initialDate, initialStartTime, consoleStations, selectedStationId]);

  const selectedStation = useMemo(() => {
    return consoleStations.find(s => s.id === selectedStationId);
  }, [consoleStations, selectedStationId]);

  // Selected member entity (from preloaded list or searched members)
  const [extraLoadedMembers, setExtraLoadedMembers] = useState<Record<string, Member>>({});
  const [guestMatchingMembers, setGuestMatchingMembers] = useState<Member[]>([]);
  const [isSearchingGuestMember, setIsSearchingGuestMember] = useState(false);

  // Search members on-demand from Firestore as the user types
  useEffect(() => {
    const qName = guestName.trim();
    const qPhone = guestPhone.trim();

    if (!qName && (!qPhone || qPhone.length < 3)) {
      setGuestMatchingMembers([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingGuestMember(true);
      try {
        const queryTerm = qName || qPhone;
        const results = await searchMembers(queryTerm);
        // Also perform case-insensitive local match on returned results + preloaded members
        const combined = [...results, ...members];
        const dedupeMap = new Map<string, Member>();
        
        combined.forEach(m => {
          if (!m.id) return;
          const matchName = qName && m.name.toLowerCase().includes(qName.toLowerCase());
          const matchPhone = qPhone && m.phone && m.phone.includes(qPhone);
          if (matchName || matchPhone) {
            dedupeMap.set(m.id, m);
          }
        });

        const list = Array.from(dedupeMap.values()).slice(0, 5);
        setGuestMatchingMembers(list);

        // Cache any found members
        setExtraLoadedMembers(prev => {
          const next = { ...prev };
          list.forEach(m => { next[m.id] = m; });
          return next;
        });
      } catch (err) {
        console.error("Error searching members:", err);
      } finally {
        setIsSearchingGuestMember(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [guestName, guestPhone, members]);

  // Filter members based on search (in Member tab)
  const [memberTabResults, setMemberTabResults] = useState<Member[]>([]);
  useEffect(() => {
    if (!memberSearch.trim()) {
      setMemberTabResults(members.slice(0, 10));
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await searchMembers(memberSearch.trim());
        const combined = [...res, ...members];
        const dedupeMap = new Map<string, Member>();
        const q = memberSearch.toLowerCase();
        combined.forEach(m => {
          if (m.name.toLowerCase().includes(q) || (m.phone && m.phone.includes(q))) {
            dedupeMap.set(m.id, m);
          }
        });
        const list = Array.from(dedupeMap.values()).slice(0, 10);
        setMemberTabResults(list);
        setExtraLoadedMembers(prev => {
          const next = { ...prev };
          list.forEach(m => { next[m.id] = m; });
          return next;
        });
      } catch (err) {
        console.error("Member search error:", err);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [memberSearch, members]);

  const selectedMember = useMemo(() => {
    return members.find(m => m.id === selectedMemberId) || extraLoadedMembers[selectedMemberId];
  }, [members, extraLoadedMembers, selectedMemberId]);

  // Compute End Time
  const computedTimes = useMemo(() => {
    try {
      const [h, m] = startTime.split(':').map(Number);
      const startObj = new Date(`${bookingDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
      const endObj = addMinutes(startObj, durationMinutes);
      return {
        startIso: startObj.toISOString(),
        endIso: endObj.toISOString(),
        formattedStart: format(startObj, 'hh:mm a'),
        formattedEnd: format(endObj, 'hh:mm a'),
      };
    } catch {
      return null;
    }
  }, [bookingDate, startTime, durationMinutes]);

  // Price Calculation - accurately handles PS5 vs PS4 rates and Happy Hours
  const { estimatedPrice, isHappyHourRate } = useMemo(() => {
    try {
      const [h, m] = startTime.split(':').map(Number);
      const startObj = new Date(`${bookingDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
      const targetType = selectedStation?.type === 'ps4' ? 'ps4' : 'ps5';
      const price = calculateGroupPrice(targetType, playerCount, durationMinutes, startObj);
      const hour = startObj.getHours();
      const happy = hour >= 8 && hour < 13;
      return { estimatedPrice: price, isHappyHourRate: happy };
    } catch {
      return { estimatedPrice: 150, isHappyHourRate: false };
    }
  }, [bookingDate, startTime, durationMinutes, playerCount, selectedStation]);

  // Overlap Detection
  const hasConflict = useMemo(() => {
    if (!computedTimes || !selectedStationId) return false;
    const reqStart = new Date(computedTimes.startIso).getTime();
    const reqEnd = new Date(computedTimes.endIso).getTime();

    return existingBookings.some(b => {
      // Exclude self if editing
      if (editingBooking && b.id === editingBooking.id) return false;
      if (b.stationId !== selectedStationId) return false;
      if (b.status === 'cancelled' || b.status === 'completed' || b.status === 'no-show') return false;
      const bStart = new Date(b.startTime).getTime();
      const bEnd = new Date(b.endTime).getTime();
      // Overlap condition
      return Math.max(reqStart, bStart) < Math.min(reqEnd, bEnd);
    });
  }, [computedTimes, selectedStationId, existingBookings, editingBooking]);

  const handleSubmit = async () => {
    const station = consoleStations.find(s => s.id === selectedStationId);
    if (!station) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a console.' });
      return;
    }

    const customerName = customerType === 'member' ? (selectedMember?.name || '') : guestName.trim();
    if (!customerName) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please provide customer/member name.' });
      return;
    }

    if (!computedTimes) {
      toast({ variant: 'destructive', title: 'Error', description: 'Invalid date or time.' });
      return;
    }

    if (hasConflict) {
      toast({ variant: 'destructive', title: 'Time Conflict', description: 'This console already has a booking overlapping this time slot.' });
      return;
    }

    const parsedAdvance = hasAdvance ? (parseFloat(advanceAmount) || 0) : 0;
    if (hasAdvance && parsedAdvance <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Advance', description: 'Please enter a valid advance amount or choose "No Advance".' });
      return;
    }

    setIsSubmitting(true);
    try {
      const consoleType = (station.type === 'ps4' ? 'ps4' : 'ps5') as 'ps5' | 'ps4';

      if (editingBooking) {
        // Edit Mode
        const success = await updateBooking(editingBooking.id, {
          stationId: station.id,
          stationName: station.name,
          stationType: consoleType,
          customerType,
          memberId: customerType === 'member' ? selectedMemberId : undefined,
          customerName,
          customerPhone: customerType === 'member' ? selectedMember?.phone : (guestPhone.trim() || undefined),
          playerCount,
          date: bookingDate,
          startTime: computedTimes.startIso,
          endTime: computedTimes.endIso,
          durationMinutes,
          hasAdvance,
          advancePaid: parsedAdvance,
          advancePaymentMethod: hasAdvance ? paymentMethod : undefined,
          estimatedTotal: estimatedPrice,
          notes: notes.trim() || undefined,
        }, {
          uid: user?.username || user?.uid || 'staff',
          displayName: user?.displayName || 'Staff'
        });

        if (success) {
          playCoinSound();
          toast({
            title: 'Booking Updated!',
            description: `Reservation updated for ${customerName} on ${station.name}.`
          });
          onOpenChange(false);
          if (onBookingUpdated) onBookingUpdated(editingBooking.id);
        } else {
          toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update booking.' });
        }
      } else {
        // Create Mode
        const createdId = await createBooking({
          stationId: station.id,
          stationName: station.name,
          stationType: consoleType,
          customerType,
          memberId: customerType === 'member' ? selectedMemberId : undefined,
          customerName,
          customerPhone: customerType === 'member' ? selectedMember?.phone : (guestPhone.trim() || undefined),
          playerCount,
          date: bookingDate,
          startTime: computedTimes.startIso,
          endTime: computedTimes.endIso,
          durationMinutes,
          hasAdvance,
          advancePaid: parsedAdvance,
          advancePaymentMethod: hasAdvance ? paymentMethod : undefined,
          estimatedTotal: estimatedPrice,
          notes: notes.trim() || undefined,
          createdBy: {
            uid: user?.username || user?.uid || 'staff',
            displayName: user?.displayName || 'Staff',
            role: user?.role || 'staff'
          }
        });

        if (createdId) {
          playCoinSound();
          const consoleLabel = station.type === 'ps4' ? 'PS4' : 'PS5';
          toast({
            title: 'Booking Confirmed!',
            description: `${consoleLabel} (${station.name}) booked for ${customerName} at ${computedTimes.formattedStart}. ${hasAdvance ? `Advance: ₹${parsedAdvance}` : 'No advance'}.`
          });
          onOpenChange(false);
          if (onBookingCreated) onBookingCreated(createdId);
        } else {
          toast({ variant: 'destructive', title: 'Failed', description: 'Could not create booking.' });
        }
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message || 'Operation failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg max-h-[92vh] overflow-y-auto border-2 border-primary/30 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-headline text-lg sm:text-xl tracking-normal text-sky-400">
            <Gamepad2 className="h-5 w-5" />
            {editingBooking ? 'Edit Console Booking' : 'Book a Console (PS5 / PS4)'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Console Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Console</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {consoleStations.map(s => {
                const isSelected = selectedStationId === s.id;
                const isPs4 = s.type === 'ps4';
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStationId(s.id)}
                    className={cn(
                      "p-2.5 rounded-lg border-2 text-center font-bold text-xs transition-all uppercase relative",
                      isSelected 
                        ? (isPs4 ? "border-blue-400 bg-blue-500/15 text-blue-300 shadow-sm ring-1 ring-blue-400" : "border-sky-500 bg-sky-500/15 text-sky-400 shadow-sm ring-1 ring-sky-500")
                        : "border-muted bg-card hover:border-primary/50 text-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={cn("text-[9px] px-1 py-0.2 rounded font-extrabold", isPs4 ? "bg-blue-500/20 text-blue-400" : "bg-sky-500/20 text-sky-400")}>
                        {isPs4 ? 'PS4' : 'PS5'}
                      </span>
                    </div>
                    <div className="truncate">{s.name}</div>
                    <div className={cn("text-[10px] lowercase", s.status === 'available' ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold')}>
                      {s.status}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customer Type Tabs */}
          <div className="space-y-2">
            <div className="flex rounded-lg border p-1 bg-muted/40 gap-1">
              <button
                type="button"
                onClick={() => setCustomerType('guest')}
                className={cn(
                  "flex-1 py-1.5 text-xs font-bold uppercase rounded-md transition-all",
                  customerType === 'guest' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Enter Name
              </button>
              <button
                type="button"
                onClick={() => setCustomerType('member')}
                className={cn(
                  "flex-1 py-1.5 text-xs font-bold uppercase rounded-md transition-all",
                  customerType === 'member' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Search Member Directory
              </button>
            </div>

            {customerType === 'guest' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Member&apos;s Name *</Label>
                      {isSearchingGuestMember && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-2.5 w-2.5 animate-spin" /> Checking...
                        </span>
                      )}
                    </div>
                    <Input 
                      placeholder="Type name (e.g. Saad, Rahul)" 
                      value={guestName} 
                      onChange={e => setGuestName(e.target.value)} 
                      className="h-9 font-medium mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Phone (Optional)</Label>
                    <Input 
                      placeholder="10-digit number" 
                      value={guestPhone} 
                      onChange={e => setGuestPhone(e.target.value)} 
                      className="h-9 font-medium mt-1 text-sm"
                    />
                  </div>
                </div>

                {/* Instant Member Detection in Member's Name area */}
                {guestMatchingMembers.length > 0 && (
                  <div className="p-2.5 rounded-lg border-2 border-emerald-500/50 bg-emerald-500/15 space-y-1.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                        Found Registered Member:
                      </span>
                      <span className="text-[10px] text-emerald-400/80 font-medium">Click to select</span>
                    </div>
                    <div className="space-y-1">
                      {guestMatchingMembers.map(m => (
                        <div
                          key={m.id}
                          onClick={() => {
                            setCustomerType('member');
                            setSelectedMemberId(m.id);
                            setMemberSearch(m.name);
                            if (m.phone) setGuestPhone(m.phone);
                          }}
                          className="flex items-center justify-between p-2 rounded-md bg-background/90 hover:bg-emerald-500/25 border border-emerald-500/40 cursor-pointer transition-all group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground group-hover:text-emerald-300">
                              {m.name}
                            </span>
                            <Badge variant="outline" className="text-[9px] h-3.5 px-1 font-mono uppercase bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                              {m.tier}
                            </Badge>
                            {m.phone && (
                              <span className="text-[11px] text-muted-foreground font-mono">
                                {m.phone}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tight group-hover:underline flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Select Member
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Search Member</Label>
                <Input 
                  placeholder="Type name or phone number..." 
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  className="h-9 text-sm font-medium"
                />
                {memberTabResults.length > 0 && !selectedMemberId && (
                  <div className="border rounded-lg max-h-36 overflow-y-auto divide-y bg-card text-xs">
                    {memberTabResults.map(m => (
                      <div 
                        key={m.id}
                        onClick={() => {
                          setSelectedMemberId(m.id);
                          setMemberSearch(m.name);
                        }}
                        className="p-2 hover:bg-muted cursor-pointer flex justify-between items-center"
                      >
                        <span className="font-bold">{m.name}</span>
                        <span className="text-muted-foreground">{m.phone || 'No phone'}</span>
                      </div>
                    ))}
                  </div>
                )}
                {selectedMember && (
                  <div className="flex items-center justify-between p-2 rounded-md bg-primary/10 border border-primary/20 text-xs">
                    <span className="font-bold text-primary">{selectedMember.name} ({selectedMember.tier} Tier)</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-xs text-muted-foreground hover:text-foreground" 
                      onClick={() => { setSelectedMemberId(''); setMemberSearch(''); }}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Date & Start Time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Date
              </Label>
              <Input 
                type="date" 
                value={bookingDate} 
                onChange={e => setBookingDate(e.target.value)} 
                className="h-9 text-xs font-bold mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Start Time
              </Label>
              <Input 
                type="time" 
                value={startTime} 
                onChange={e => setStartTime(e.target.value)} 
                className="h-9 text-xs font-bold mt-1"
              />
            </div>
          </div>

          {/* Duration & Players */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Duration</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {[30, 60, 90, 120].map(mins => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMinutes(mins)}
                  className={cn(
                    "py-1.5 text-xs font-bold rounded border transition-all",
                    durationMinutes === mins ? "border-primary bg-primary text-primary-foreground shadow-xs" : "border-muted hover:border-primary/50 text-foreground"
                  )}
                >
                  {mins >= 60 ? `${mins / 60} Hr` : `${mins}m`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between p-2.5 rounded-lg bg-muted/40 border text-xs gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold">Players:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setPlayerCount(num)}
                    className={cn(
                      "h-6 w-6 rounded text-xs font-bold transition-all",
                      playerCount === num ? "bg-primary text-primary-foreground shadow-xs" : "bg-card border text-foreground hover:bg-muted"
                    )}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
            {computedTimes && (
              <div className="text-right">
                <div className="font-bold text-sky-400 flex items-center justify-end gap-1.5">
                  {computedTimes.formattedStart} – {computedTimes.formattedEnd}
                  {isHappyHourRate && (
                    <Badge variant="outline" className="text-[9px] h-4 font-mono uppercase bg-amber-500/10 text-amber-400 border-amber-500/30">
                      Happy Hour
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-end gap-1 mt-0.5">
                  <span>{selectedStation?.type === 'ps4' ? 'PS4 Rate' : 'PS5 Rate'}:</span>
                  <span className="font-bold text-foreground">₹{estimatedPrice}</span>
                  {playerCount > 1 && (
                    <span className="text-[10px] text-muted-foreground">
                      (₹{Math.round(estimatedPrice / playerCount)}/p)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {hasConflict && (
            <div className="p-2.5 rounded-lg bg-destructive/15 border border-destructive/40 text-destructive text-xs flex items-center gap-2 font-bold animate-pulse">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Conflict: This console already has a booking overlapping this time!</span>
            </div>
          )}

          {/* Advance Paid Section */}
          <div className="p-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-primary">Advance Payment</Label>
                <p className="text-[11px] text-muted-foreground">Option to collect advance now or at session end</p>
              </div>
              <div className="flex rounded-md border p-0.5 bg-background gap-0.5">
                <button
                  type="button"
                  onClick={() => setHasAdvance(true)}
                  className={cn(
                    "px-2 py-1 text-[11px] font-bold uppercase rounded transition-all",
                    hasAdvance ? "bg-emerald-500 text-black shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Paid
                </button>
                <button
                  type="button"
                  onClick={() => setHasAdvance(false)}
                  className={cn(
                    "px-2 py-1 text-[11px] font-bold uppercase rounded transition-all",
                    !hasAdvance ? "bg-muted text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Not Paid
                </button>
              </div>
            </div>

            {hasAdvance && (
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-primary/20">
                <div>
                  <Label className="text-xs font-semibold">Advance Amount (₹)</Label>
                  <Input 
                    type="number" 
                    value={advanceAmount} 
                    onChange={e => setAdvanceAmount(e.target.value)} 
                    placeholder="e.g. 100" 
                    className="h-8 font-bold mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Payment Mode</Label>
                  <div className="flex gap-1 mt-1">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={cn(
                        "flex-1 h-8 rounded text-xs font-bold uppercase border transition-all",
                        paymentMethod === 'cash' ? "bg-emerald-500 text-black border-emerald-600 shadow-xs" : "bg-card border-muted hover:border-emerald-500"
                      )}
                    >
                      Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('upi')}
                      className={cn(
                        "flex-1 h-8 rounded text-xs font-bold uppercase border transition-all",
                        paymentMethod === 'upi' ? "bg-sky-500 text-black border-sky-600 shadow-xs" : "bg-card border-muted hover:border-sky-500"
                      )}
                    >
                      UPI
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs font-semibold">Notes (Optional)</Label>
            <Input 
              placeholder="e.g. Birthday booking, wants FIFA 24" 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              className="h-8 text-xs font-medium mt-1"
            />
          </div>
        </div>

        <DialogFooter className="pt-2 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9 text-xs font-bold uppercase">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || hasConflict} 
            className="h-9 px-4 text-xs font-bold uppercase bg-sky-500 hover:bg-sky-600 text-black shadow-md gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isSubmitting 
              ? (editingBooking ? 'Saving...' : 'Booking...') 
              : (editingBooking ? 'Save Changes' : 'Confirm Booking')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
