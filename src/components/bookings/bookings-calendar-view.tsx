'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import type { Booking, Station, Member } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, 
  Gamepad2, Plus, Play, Coins, User, Sparkles, CheckCircle2 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays, subDays, isSameDay, isToday } from 'date-fns';
import { getSyncedNow } from '@/lib/synced-time';

interface BookingsCalendarViewProps {
  bookings: Booking[];
  stations: Station[];
  members: Member[];
  onSelectSlot: (stationId: string, date: string, time: string) => void;
  onStartBookingNow: (booking: Booking) => void;
  onEditBooking?: (booking: Booking) => void;
}

// 24-hour slots from 00:00 to 23:00
const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

export function BookingsCalendarView({
  bookings = [],
  stations = [],
  members = [],
  onSelectSlot,
  onStartBookingNow,
}: BookingsCalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [consoleFilter, setConsoleFilter] = useState<'all' | 'ps5' | 'ps4'>('all');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const displayedStations = useMemo(() => {
    return stations.filter(s => {
      if (consoleFilter === 'ps5') return s.type === 'ps5';
      if (consoleFilter === 'ps4') return s.type === 'ps4';
      return s.type === 'ps5' || s.type === 'ps4';
    });
  }, [stations, consoleFilter]);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const isSelectedToday = isToday(selectedDate);
  const currentHour = new Date().getHours();

  // Scroll to current hour or 10:00 AM on initial load
  useEffect(() => {
    if (scrollContainerRef.current) {
      const targetHour = isSelectedToday ? Math.max(0, currentHour - 1) : 10;
      const targetRow = scrollContainerRef.current.querySelector(`[data-hour="${targetHour}"]`) as HTMLElement;
      if (targetRow) {
        scrollContainerRef.current.scrollTo({
          top: targetRow.offsetTop - 50,
          behavior: 'smooth'
        });
      }
    }
  }, [selectedDate, isSelectedToday, currentHour]);

  // Filter bookings for the selected date
  const dayBookings = useMemo(() => {
    return bookings.filter(b => {
      if (b.status === 'cancelled') return false;
      try {
        return isSameDay(new Date(b.startTime), selectedDate);
      } catch {
        return false;
      }
    });
  }, [bookings, selectedDate]);

  const handlePrevDay = () => setSelectedDate(prev => subDays(prev, 1));
  const handleNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const handleToday = () => setSelectedDate(new Date());

  // Helper to check if a station has a booking overlapping a specific time slot
  const getBookingForSlot = (stationId: string, slotTimeStr: string) => {
    const [h, m] = slotTimeStr.split(':').map(Number);
    const slotStart = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime();
    const slotEnd = slotStart + (60 * 60 * 1000); // 1-hour window

    return dayBookings.find(b => {
      if (b.stationId !== stationId) return false;
      const bStart = new Date(b.startTime).getTime();
      const bEnd = new Date(b.endTime).getTime();
      return Math.max(slotStart, bStart) < Math.min(slotEnd, bEnd);
    });
  };

  return (
    <div className="space-y-3 font-body">
      {/* Date Navigation & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-card border-2 border-primary/20">
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrevDay}
            className="h-7 w-7 p-0"
            title="Previous Day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleToday}
            className={cn("h-7 px-2.5 text-xs font-bold uppercase", isSelectedToday && "border-sky-500 text-sky-400 bg-sky-500/10")}
          >
            Today
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleNextDay}
            className="h-7 w-7 p-0"
            title="Next Day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1.5 ml-2 font-bold text-xs sm:text-sm text-foreground">
            <CalendarIcon className="h-4 w-4 text-sky-400" />
            <span>{format(selectedDate, 'EEEE, dd MMMM yyyy')}</span>
            {isSelectedToday && (
              <Badge className="bg-sky-500 text-black text-[10px] h-4 font-bold ml-1">
                TODAY
              </Badge>
            )}
          </div>
        </div>

        {/* Console Filter Pills & Legend */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex rounded-md border p-0.5 bg-background gap-1">
            {[
              { id: 'all', label: 'All Consoles' },
              { id: 'ps5', label: 'PS5' },
              { id: 'ps4', label: 'PS4' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setConsoleFilter(tab.id as any)}
                className={cn(
                  "px-2 py-1 text-[11px] font-bold uppercase rounded transition-all",
                  consoleFilter === tab.id 
                    ? "bg-primary text-primary-foreground shadow-xs" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[11px] font-semibold text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-xs bg-sky-500"></span> Confirmed
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500"></span> In Progress
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-xs border border-dashed border-muted-foreground"></span> Free Slot
            </span>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="border-2 rounded-xl overflow-hidden bg-card shadow-md">
        <div ref={scrollContainerRef} className="overflow-x-auto max-h-[58vh]">
          <table className="w-full border-collapse text-left text-xs min-w-[650px]">
            {/* Header: PS5 & PS4 Consoles */}
            <thead className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b-2">
              <tr>
                <th className="p-2.5 w-20 text-center font-bold text-muted-foreground uppercase tracking-wider border-r bg-muted/40 sticky left-0 z-30">
                  Time
                </th>
                {displayedStations.map(station => {
                  const isPs4 = station.type === 'ps4';
                  return (
                    <th key={station.id} className="p-2.5 text-center font-display tracking-tight uppercase border-r last:border-r-0 min-w-[150px]">
                      <div className="flex items-center justify-center gap-1.5 font-bold">
                        <Gamepad2 className={cn("h-4 w-4", isPs4 ? "text-blue-400" : "text-sky-400")} />
                        <span className={isPs4 ? "text-blue-300" : "text-sky-400"}>{station.name}</span>
                        <Badge variant="outline" className={cn("text-[9px] h-3.5 px-1 uppercase font-bold", isPs4 ? "border-blue-400/30 text-blue-400 bg-blue-500/10" : "border-sky-400/30 text-sky-400 bg-sky-500/10")}>
                          {isPs4 ? 'PS4' : 'PS5'}
                        </Badge>
                      </div>
                      {isSelectedToday && (
                        <span className={cn(
                          "text-[10px] font-mono lowercase block font-semibold mt-0.5",
                          station.status === 'available' ? 'text-emerald-400' : 'text-amber-400'
                        )}>
                          {station.status === 'available' ? '● available' : '● in-use'}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Body: Time Rows */}
            <tbody className="divide-y">
              {TIME_SLOTS.map(timeStr => {
                const [h] = timeStr.split(':').map(Number);
                const displayTime = format(new Date().setHours(h, 0, 0, 0), 'hh:mm a');
                const isCurrentHourRow = isSelectedToday && currentHour === h;

                return (
                  <tr 
                    key={timeStr} 
                    data-hour={h}
                    className={cn(
                      "hover:bg-muted/10 transition-colors",
                      isCurrentHourRow && "bg-sky-500/5 font-semibold"
                    )}
                  >
                    {/* Time Label */}
                    <td className={cn(
                      "p-2 text-center font-mono text-[11px] border-r bg-muted/20 sticky left-0 z-10 whitespace-nowrap",
                      isCurrentHourRow ? "text-sky-400 font-bold bg-sky-500/10 border-r-sky-500/30" : "text-muted-foreground font-bold"
                    )}>
                      {displayTime}
                      {isCurrentHourRow && (
                        <span className="block text-[8px] text-sky-400 uppercase tracking-tighter">NOW</span>
                      )}
                    </td>

                    {/* Console Columns */}
                    {displayedStations.map(station => {
                      const booking = getBookingForSlot(station.id, timeStr);

                      if (booking) {
                        const isConfirmed = booking.status === 'confirmed';
                        const isActive = booking.status === 'active';
                        const isCompleted = booking.status === 'completed';

                        return (
                          <td 
                            key={station.id} 
                            className="p-1.5 border-r last:border-r-0 align-top"
                          >
                            <div 
                              className={cn(
                                "p-2 rounded-lg border text-xs space-y-1 shadow-xs transition-all",
                                isActive ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300" :
                                isConfirmed ? "bg-sky-500/15 border-sky-500/50 text-sky-300" :
                                "bg-muted/40 border-muted text-muted-foreground"
                              )}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold truncate text-foreground flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {booking.customerName}
                                </span>
                                <Badge 
                                  className={cn(
                                    "text-[9px] h-3.5 px-1 uppercase font-bold",
                                    isActive ? "bg-emerald-500 text-black" :
                                    isConfirmed ? "bg-sky-500 text-black" : "bg-muted text-foreground"
                                  )}
                                >
                                  {booking.status}
                                </Badge>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-0.5 font-mono">
                                  <Clock className="h-2.5 w-2.5" />
                                  {format(new Date(booking.startTime), 'hh:mm')}–{format(new Date(booking.endTime), 'hh:mm a')}
                                </span>
                                {booking.hasAdvance ? (
                                  <span className="text-emerald-400 font-bold">
                                    ₹{booking.advancePaid}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-[9px]">No Adv</span>
                                )}
                              </div>

                              {/* Quick Actions if confirmed */}
                              {isConfirmed && (
                                <div className="flex items-center gap-1 mt-1">
                                  {onEditBooking && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => onEditBooking(booking)}
                                      className="flex-1 h-5 text-[9px] font-bold uppercase border-sky-500/40 text-sky-400 hover:bg-sky-500/10 py-0"
                                    >
                                      Edit
                                    </Button>
                                  )}
                                  {isSelectedToday && station.status === 'available' && (
                                    <Button
                                      size="sm"
                                      onClick={() => onStartBookingNow(booking)}
                                      className="flex-1 h-5 text-[9px] font-bold uppercase bg-emerald-500 hover:bg-emerald-600 text-black gap-0.5 py-0 shadow-xs"
                                    >
                                      <Play className="h-2 w-2 fill-current" />
                                      Start
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      }

                      // Empty Free Slot: Interactive Booking Trigger
                      return (
                        <td 
                          key={station.id} 
                          className="p-1 border-r last:border-r-0 text-center align-middle group cursor-pointer hover:bg-sky-500/5 transition-colors"
                          onClick={() => onSelectSlot(station.id, dateStr, timeStr)}
                          title={`Click to book ${station.name} at ${displayTime}`}
                        >
                          <div className="h-10 rounded-md border border-dashed border-border/60 hover:border-sky-500/70 hover:bg-sky-500/10 flex items-center justify-center gap-1 text-[11px] text-muted-foreground group-hover:text-sky-400 transition-all font-semibold">
                            <Plus className="h-3 w-3 opacity-40 group-hover:opacity-100" />
                            <span className="opacity-40 group-hover:opacity-100">Book</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
