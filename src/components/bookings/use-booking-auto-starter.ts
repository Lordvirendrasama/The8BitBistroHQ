'use client';

import { useEffect, useRef } from 'react';
import type { Booking, Station } from '@/lib/types';
import { startBookingSession } from '@/firebase/firestore/bookings';
import { playCoinSound, playWarningSound } from '@/lib/audio/chiptune';
import { useToast } from '@/hooks/use-toast';
import { getSyncedNow } from '@/lib/synced-time';

interface UseBookingAutoStarterProps {
  bookings: Booking[];
  stations: Station[];
  enabled?: boolean;
}

export function useBookingAutoStarter({
  bookings,
  stations,
  enabled = true,
}: UseBookingAutoStarterProps) {
  const { toast } = useToast();
  const notifiedConflictsRef = useRef<Set<string>>(new Set());
  const startingBookingsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !bookings || bookings.length === 0) return;

    const interval = setInterval(async () => {
      const now = getSyncedNow();
      const fiveMinutesMs = 5 * 60 * 1000;

      for (const booking of bookings) {
        if (booking.status !== 'confirmed' || booking.autoStarted) continue;
        if (startingBookingsRef.current.has(booking.id)) continue;

        const bookingStartMs = new Date(booking.startTime).getTime();
        const autoStartThreshold = bookingStartMs + fiveMinutesMs;

        // Auto-start condition reached (5 minutes after booking time)
        if (now >= autoStartThreshold) {
          const station = stations.find(s => s.id === booking.stationId);
          if (!station) continue;

          if (station.status === 'available') {
            // Auto-start the booked session!
            startingBookingsRef.current.add(booking.id);
            try {
              const success = await startBookingSession(booking, station);
              if (success) {
                playCoinSound();
                toast({
                  title: '🎮 Reservation Auto-Started!',
                  description: `${booking.stationName} session automatically started for ${booking.customerName} (5-min grace elapsed).`,
                });
              }
            } catch (err) {
              console.error('Error auto-starting booking:', err);
            } finally {
              startingBookingsRef.current.delete(booking.id);
            }
          } else {
            // Station is currently occupied or finishing
            if (!notifiedConflictsRef.current.has(booking.id)) {
              notifiedConflictsRef.current.add(booking.id);
              playWarningSound();
              toast({
                variant: 'destructive',
                title: '⚠️ Reservation Overdue!',
                description: `${booking.stationName} has an auto-start reservation for ${booking.customerName}, but console is currently ${station.status.toUpperCase()}!`,
              });
            }
          }
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [bookings, stations, enabled, toast]);
}
