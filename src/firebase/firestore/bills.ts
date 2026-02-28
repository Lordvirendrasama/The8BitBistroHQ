
'use client';
import { getFirestore, collection, writeBatch, doc, query, where, getDocs, limit, runTransaction, getDoc } from 'firebase/firestore';
import type { Bill, LogEntry, Member, Transaction } from '@/lib/types';
import { getSettings } from './settings';
import type { CustomUser } from '../auth/use-user';
import { createAdminNotification } from './notifications';

/**
 * Robustly sanitizes data for Firestore by removing any 'undefined' values.
 * Firestore accepts 'null' but crashes on 'undefined'.
 */
const sanitize = (data: any): any => {
  if (data === undefined) return null;
  if (data === null) return null;
  
  if (Array.isArray(data)) {
    return data.map(v => sanitize(v));
  }
  
  if (typeof data === 'object' && data !== null) {
    const clean: any = {};
    Object.keys(data).forEach(key => {
      const val = data[key];
      // Skip undefined keys entirely to prevent Firestore crash
      if (val !== undefined) {
        clean[key] = sanitize(val);
      }
    });
    return clean;
  }
  
  return data;
};

const createLogEntry = (
  db: ReturnType<typeof getFirestore>, 
  transaction: any, 
  entry: Omit<LogEntry, 'id' | 'timestamp' | 'user'>
) => {
  const logRef = doc(collection(db, 'logs'));
  const currentUserJson = sessionStorage.getItem('user');
  const currentUser = currentUserJson ? JSON.parse(currentUserJson) : null;
  
  const rawLogData = {
    ...entry,
    timestamp: new Date().toISOString(),
    user: currentUser ? { uid: currentUser.username, displayName: currentUser.displayName } : { uid: 'system', displayName: 'System' }
  };

  transaction.set(logRef, sanitize(rawLogData));
};

export const archiveBill = async (billData: Omit<Bill, 'id' | 'shiftId'>): Promise<string | null> => {
    const db = getFirestore();
    const batch = writeBatch(db);
    const billRef = doc(collection(db, 'bills'));
    
    const settings = await getSettings();

    // Find active shift
    const shiftsRef = collection(db, 'shifts');
    const q = query(shiftsRef, where('endTime', '==', null), limit(1));
    const shiftSnapshot = await getDocs(q);
    const activeShiftId = shiftSnapshot.empty ? null : shiftSnapshot.docs[0].id;
    
    const billDocData: any = {
        stationId: billData.stationId ?? 'unknown',
        stationName: billData.stationName ?? 'Unknown Station',
        packageName: billData.packageName ?? null,
        members: billData.members ?? [],
        items: billData.items ?? [],
        initialPackagePrice: billData.initialPackagePrice ?? 0,
        foodSubtotal: billData.foodSubtotal ?? 0,
        discount: billData.discount ?? 0,
        totalAmount: billData.totalAmount ?? 0,
        timestamp: billData.timestamp ?? new Date().toISOString(),
        paymentMethod: billData.paymentMethod ?? 'cash',
        cycle: settings.activeCycle ?? 'Live Cycle',
        cashAmount: billData.cashAmount ?? 0,
        upiAmount: billData.upiAmount ?? 0,
        shiftId: activeShiftId ?? null,
        isRechargePurchase: billData.isRechargePurchase ?? false
    };

    // Deep sanitize to prevent "undefined" values
    batch.set(billRef, sanitize(billDocData));

    const logDetails: { [key: string]: any } = { 
        billId: billRef.id,
        ...billData 
    };

    if (activeShiftId) logDetails.shiftId = activeShiftId;

    createLogEntry(db, batch, {
        type: 'BILL_PAID',
        description: `Bill of <strong>₹${billData.totalAmount.toLocaleString()}</strong> paid via ${(billData.paymentMethod || 'cash').toUpperCase()}.`,
        details: logDetails,
        cycle: settings.activeCycle || 'Live Cycle'
    });

    try {
        await batch.commit();
        return billRef.id;
    } catch(e) {
        console.error("Error archiving bill:", e);
        return null;
    }
};

export const updateBill = async (billId: string, updates: Partial<Bill>, user: CustomUser) => {
    const db = getFirestore();
    const batch = writeBatch(db);
    const billRef = doc(db, 'bills', billId);
    
    try {
        batch.update(billRef, sanitize(updates));
        createLogEntry(db, batch, {
            type: 'BILL_UPDATED',
            description: `Updated bill <strong>${billId}</strong>.`,
            details: { billId, updates }
        });

        // Trigger owner notification if staff is editing
        if (user.role === 'staff') {
            const billSnap = await getDoc(billRef);
            const stationName = billSnap.exists() ? billSnap.data().stationName : 'Unknown';
            const updatedFields = Object.keys(updates).join(', ');
            await createAdminNotification(
                `<strong>${user.displayName}</strong> updated bill for <strong>${stationName}</strong>. Fields adjusted: ${updatedFields}.`,
                user,
                'BILL_MODIFIED'
            );
        }

        await batch.commit();
    } catch (e) {
        console.error("Error updating bill: ", e);
    }
};


export const deleteBill = async (billId: string, user: CustomUser): Promise<{success: boolean, message?: string}> => {
    const db = getFirestore();
    const billRef = doc(db, 'bills', billId);

    try {
        const billDoc = await getDoc(billRef);
        if (!billDoc.exists()) throw new Error("Bill not found!");
        
        const bill = billDoc.data() as Bill;
        const realMembers = bill.members.filter(m => m.id && !m.id.startsWith('guest-'));

        const memberUpdates: { memberRef: any, updates: any }[] = [];
        const transactionsToDelete: any[] = [];

        for (const assignedMember of realMembers) {
            const memberId = assignedMember.id;
            const transactionsRef = collection(db, `members/${memberId}/transactions`);
            const q = query(transactionsRef, where('billId', '==', billId), limit(1));
            const transactionSnapshot = await getDocs(q);

            if (!transactionSnapshot.empty) {
                const txDoc = transactionSnapshot.docs[0];
                transactionsToDelete.push(txDoc.ref);
                const txData = txDoc.data() as Transaction;
                const memberRef = doc(db, 'members', memberId);
                const memberDoc = await getDoc(memberRef);

                if (memberDoc.exists()) {
                    const memberData = memberDoc.data() as Member;
                    const newTotalSpent = Math.max(0, (memberData.totalSpent || 0) - txData.amount);
                    const newXp = Math.max(0, (memberData.xp || 0) - txData.xpGained);
                    memberUpdates.push({ memberRef, updates: { totalSpent: newTotalSpent, xp: newXp } });
                }
            }
        }
        
        await runTransaction(db, async (transaction) => {
            memberUpdates.forEach(mu => transaction.update(mu.memberRef, mu.updates));
            transactionsToDelete.forEach(txRef => transaction.delete(txRef));
            transaction.delete(billRef);

            createLogEntry(db, transaction, {
                type: 'BILL_DELETED',
                description: `Deleted bill for <strong>${bill.stationName}</strong>. Reverted member stats.`,
                details: { billId: billId, deletedBill: bill },
            });

            // Trigger owner notification if staff is deleting
            if (user.role === 'staff') {
                await createAdminNotification(
                    `<strong>${user.displayName}</strong> deleted a bill for <strong>${bill.stationName}</strong> (Total: ₹${bill.totalAmount.toLocaleString()}). XP for ${realMembers.length} members was automatically reverted.`,
                    user,
                    'BILL_DELETED'
                );
            }
        });

        return { success: true };
    } catch (e: any) {
        console.error("Error deleting bill: ", e);
        return { success: false, message: e.message };
    }
};
