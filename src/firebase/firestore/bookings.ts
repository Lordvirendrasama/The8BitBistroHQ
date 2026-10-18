'use client';

import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import type { Booking, BookingStatus, Station, AssignedMember, BillItem } from '@/lib/types';
import { getSettings } from './settings';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const GUEST_AVATAR = PlaceHolderImages.find(img => img.id === 'avatar-6')?.imageUrl || 'https://picsum.photos/seed/guest/100/100';

const sanitize = (data: any): any => {
  if (data === undefined || data === null) return null;
  if (Array.isArray(data)) return data.map(v => sanitize(v));
  if (typeof data === 'object') {
    const clean: any = {};
    Object.keys(data).forEach(key => {
      const val = data[key];
      if (val !== undefined) clean[key] = sanitize(val);
    });
    return clean;
  }
  return data;
};

/**
 * Creates a new PS5 booking.
 */
export const createBooking = async (
  bookingData: Omit<Booking, 'id' | 'createdAt' | 'status' | 'autoStarted' | 'cycle'>
): Promise<string | null> => {
  const db = getFirestore();
  const settings = await getSettings();
  const batch = writeBatch(db);

  const bookingsCol = collection(db, 'bookings');
  const newBookingRef = doc(bookingsCol);

  const newBooking: Omit<Booking, 'id'> = {
    ...bookingData,
    status: 'confirmed',
    autoStarted: false,
    createdAt: new Date().toISOString(),
    cycle: settings.activeCycle || 'Live Cycle',
  };

  batch.set(newBookingRef, sanitize(newBooking));

  // Create audit log
  const logRef = doc(collection(db, 'logs'));
  const advText = bookingData.hasAdvance 
    ? `Advance: ₹${bookingData.advancePaid} via ${(bookingData.advancePaymentMethod || 'cash').toUpperCase()}`
    : 'No advance paid';

  batch.set(logRef, sanitize({
    type: 'BOOKING_CREATED',
    description: `Booking created for <strong>${bookingData.customerName}</strong> on <strong>${bookingData.stationName}</strong> (${advText}).`,
    details: { bookingId: newBookingRef.id, ...newBooking },
    timestamp: new Date().toISOString(),
    user: { uid: bookingData.createdBy.uid, displayName: bookingData.createdBy.displayName },
    cycle: settings.activeCycle || 'Live Cycle'
  }));

  try {
    await batch.commit();
    return newBookingRef.id;
  } catch (error) {
    console.error("Error creating booking:", error);
    return null;
  }
};

/**
 * Starts a session on a station for a booked customer.
 */
export const startBookingSession = async (
  booking: Booking,
  station: Station
): Promise<boolean> => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const now = new Date();
  const end = new Date(now.getTime() + (booking.durationMinutes * 60 * 1000));

  const memberId = booking.memberId || `guest-booking-${booking.id}`;
  const assignedPlayer: AssignedMember = {
    id: memberId,
    name: booking.customerName,
    avatarUrl: GUEST_AVATAR,
    status: 'active',
    startTime: now.toISOString(),
    endTime: end.toISOString()
  };

  const consoleLabel = station.type === 'ps4' ? 'PS4' : 'PS5';
  const initialBill: BillItem[] = [{
    itemId: `booking-time-${booking.id}`,
    name: `${consoleLabel} Booking (${booking.durationMinutes} Min) - ${booking.customerName}`,
    price: booking.estimatedTotal,
    quantity: 1,
    addedAt: now.toISOString()
  }];

  const stationRef = doc(db, 'stations', station.id);
  batch.update(stationRef, sanitize({
    status: 'in-use',
    startTime: now.toISOString(),
    endTime: end.toISOString(),
    packageName: `Booking (${booking.durationMinutes}m)`,
    members: [assignedPlayer],
    currentBill: initialBill,
    discount: 0,
    advancePaid: booking.hasAdvance ? booking.advancePaid : 0,
    bookingId: booking.id
  }));

  const bookingRef = doc(db, 'bookings', booking.id);
  batch.update(bookingRef, {
    status: 'active',
    autoStarted: true,
  });

  const logRef = doc(collection(db, 'logs'));
  batch.set(logRef, sanitize({
    type: 'BOOKING_STARTED',
    description: `Session started for booking on <strong>${station.name}</strong> (${booking.customerName}).`,
    details: { bookingId: booking.id, stationId: station.id, advancePaid: booking.advancePaid },
    timestamp: now.toISOString(),
    user: { uid: booking.createdBy.uid || 'system', displayName: booking.createdBy.displayName || 'System' }
  }));

  try {
    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error starting booking session:", error);
    return false;
  }
};

/**
 * Cancels a booking, recording whether advance was kept or refunded.
 */
export const cancelBooking = async (
  bookingId: string,
  keepAdvance: boolean = true,
  reason?: string
): Promise<boolean> => {
  const db = getFirestore();
  const bookingRef = doc(db, 'bookings', bookingId);
  try {
    await updateDoc(bookingRef, sanitize({
      status: 'cancelled',
      notes: reason ? `${reason} (Advance ${keepAdvance ? 'Kept' : 'Refunded'})` : `Advance ${keepAdvance ? 'Kept' : 'Refunded'}`
    }));
    return true;
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return false;
  }
};

/**
 * Marks a booking as no-show (advance is kept).
 */
export const markBookingNoShow = async (bookingId: string): Promise<boolean> => {
  const db = getFirestore();
  const bookingRef = doc(db, 'bookings', bookingId);
  try {
    await updateDoc(bookingRef, {
      status: 'no-show',
      notes: 'Customer did not show up. Advance retained.'
    });
    return true;
  } catch (error) {
    console.error("Error marking no-show:", error);
    return false;
  }
};

/**
 * Marks a booking as completed upon checkout.
 */
export const completeBooking = async (bookingId: string): Promise<boolean> => {
  const db = getFirestore();
  const bookingRef = doc(db, 'bookings', bookingId);
  try {
    await updateDoc(bookingRef, { status: 'completed' });
    return true;
  } catch (error) {
    console.error("Error completing booking:", error);
    return false;
  }
};

/**
 * Updates an existing booking.
 */
export const updateBooking = async (
  bookingId: string,
  updates: Partial<Booking>,
  editor?: { uid: string; displayName: string }
): Promise<boolean> => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const bookingRef = doc(db, 'bookings', bookingId);

  batch.update(bookingRef, sanitize(updates));

  const logRef = doc(collection(db, 'logs'));
  batch.set(logRef, sanitize({
    type: 'BOOKING_UPDATED',
    description: `Booking updated for <strong>${updates.customerName || 'Customer'}</strong> on <strong>${updates.stationName || 'Console'}</strong>.`,
    details: { bookingId, updates },
    timestamp: new Date().toISOString(),
    user: editor || { uid: 'staff', displayName: 'Staff' }
  }));

  try {
    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error updating booking:", error);
    return false;
  }
};

/**
 * Deletes a booking document permanently.
 */
export const deleteBooking = async (bookingId: string): Promise<boolean> => {
  const db = getFirestore();
  const bookingRef = doc(db, 'bookings', bookingId);
  try {
    await deleteDoc(bookingRef);
    return true;
  } catch (error) {
    console.error("Error deleting booking:", error);
    return false;
  }
};
