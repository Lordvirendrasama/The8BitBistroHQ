'use client';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, writeBatch, runTransaction } from 'firebase/firestore';
import type { LiabilityState, LiabilityPayment, LogEntry } from '@/lib/types';
import type { CustomUser } from '../auth/use-user';
import { differenceInCalendarMonths, addMonths, startOfMonth, format } from 'date-fns';

const LIABILITY_DOC_ID = 'main_liability_state';

/**
 * Robustly sanitizes data for Firestore by removing any 'undefined' values.
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
      if (val !== undefined) {
        clean[key] = sanitize(val);
      }
    });
    return clean;
  }
  
  return data;
};

/**
 * Retrieves the global liability state. Initializes if not exists.
 */
export const getLiabilityState = async (): Promise<LiabilityState> => {
  const db = getFirestore();
  const docRef = doc(db, 'liabilities', LIABILITY_DOC_ID);
  const snap = await getDoc(docRef);

  const defaultState: Omit<LiabilityState, 'id'> = {
    loanPrincipalStart: 2500000,
    loanBalance: 2500000,
    annualInterestRate: 9,
    loanStartDate: new Date('2025-01-01T00:00:00Z').toISOString(),
    totalLoanPaid: 0,
    totalInterestPaid: 0,
    monthlyRent: 50000,
    rentBalance: 50000, 
    totalRentPaid: 0,
    lastLiabilityCycleUpdate: new Date('2025-01-01T00:00:00Z').toISOString(),
    trackingStartDate: new Date().toISOString()
  };

  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as LiabilityState;
  } else {
    await setDoc(docRef, defaultState);
    return { id: docRef.id, ...defaultState } as LiabilityState;
  }
};

/**
 * Automated logic to apply missing monthly interest and rent cycles.
 */
export const processLiabilityCycles = async (user: CustomUser) => {
  const db = getFirestore();
  const docRef = doc(db, 'liabilities', LIABILITY_DOC_ID);
  
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists()) return;
      
      const state = snap.data() as LiabilityState;
      const lastUpdate = new Date(state.lastLiabilityCycleUpdate);
      const now = new Date();
      
      const currentMonthStart = startOfMonth(now);
      const lastUpdateStart = startOfMonth(lastUpdate);
      
      const monthsToApply = differenceInCalendarMonths(currentMonthStart, lastUpdateStart);
      
      if (monthsToApply <= 0) return;

      let currentBalance = state.loanBalance;
      let currentRentBalance = state.rentBalance;
      let totalInt = state.totalInterestPaid || 0;
      let cycleTracker = lastUpdateStart;

      const monthlyInterestRate = (state.annualInterestRate || 9) / 100 / 12;

      for (let i = 0; i < monthsToApply; i++) {
        cycleTracker = addMonths(cycleTracker, 1);
        
        // 1. Apply Rent for the month
        currentRentBalance += state.monthlyRent;
        
        // 2. Apply Loan Interest for the month
        const interest = currentBalance * monthlyInterestRate;
        currentBalance += interest;
        totalInt += interest;

        // Log the automated cycle
        const logRef = doc(collection(db, 'logs'));
        transaction.set(logRef, sanitize({
          type: 'LIABILITY_CYCLE_APPLIED',
          description: `Applied monthly liability cycle for <strong>${format(cycleTracker, 'MMMM yyyy')}</strong>. Added ₹${state.monthlyRent.toLocaleString()} Rent and ₹${Math.round(interest).toLocaleString()} Loan Interest.`,
          timestamp: new Date().toISOString(),
          user: { uid: 'system', displayName: 'Automated Cycle' },
          details: { interestApplied: interest, rentApplied: state.monthlyRent, month: format(cycleTracker, 'yyyy-MM') }
        }));
      }

      transaction.update(docRef, {
        loanBalance: currentBalance,
        rentBalance: currentRentBalance,
        totalInterestPaid: totalInt,
        lastLiabilityCycleUpdate: currentMonthStart.toISOString()
      });
    });
    return true;
  } catch (e) {
    console.error("Error processing liability cycles:", e);
    return false;
  }
};

/**
 * Records a payment OR drawdown against loan or rent.
 */
export const recordLiabilityPayment = async (paymentData: Omit<LiabilityPayment, 'id' | 'addedBy'>, user: CustomUser) => {
  const db = getFirestore();
  const stateRef = doc(db, 'liabilities', LIABILITY_DOC_ID);
  const paymentRef = doc(collection(db, 'liabilityPayments'));
  
  const payment: Omit<LiabilityPayment, 'id'> = {
    ...paymentData,
    addedBy: { uid: user.username, displayName: user.displayName }
  };

  try {
    await runTransaction(db, async (transaction) => {
      const stateSnap = await transaction.get(stateRef);
      if (!stateSnap.exists()) throw "Liability state not found";
      
      const state = stateSnap.data() as LiabilityState;
      const updates: any = {};
      const isDrawdown = payment.type === 'drawdown';

      if (payment.target === 'loan') {
        if (isDrawdown) {
            updates.loanBalance = state.loanBalance + payment.amount;
            updates.totalLoanPaid = Math.max(0, (state.totalLoanPaid || 0) - payment.amount);
        } else {
            updates.loanBalance = Math.max(0, state.loanBalance - payment.amount);
            updates.totalLoanPaid = (state.totalLoanPaid || 0) + payment.amount;
        }
      } else {
        if (isDrawdown) {
            updates.rentBalance = state.rentBalance + payment.amount;
            updates.totalRentPaid = Math.max(0, (state.totalRentPaid || 0) - payment.amount);
        } else {
            updates.rentBalance = Math.max(0, state.rentBalance - payment.amount);
            updates.totalRentPaid = (state.totalRentPaid || 0) + payment.amount;
        }
      }

      transaction.set(paymentRef, sanitize(payment));
      transaction.update(stateRef, updates);

      const logRef = doc(collection(db, 'logs'));
      transaction.set(logRef, sanitize({
        type: 'LIABILITY_PAYMENT_RECORDED',
        description: `Recorded <strong>${payment.type?.toUpperCase() || 'PAYMENT'}</strong> of <strong>₹${payment.amount.toLocaleString()}</strong> toward <strong>${payment.target.toUpperCase()}</strong>.`,
        timestamp: new Date().toISOString(),
        user: { uid: user.username, displayName: user.displayName },
        details: { paymentId: paymentRef.id, target: payment.target, amount: payment.amount, type: payment.type || 'payment' }
      }));
    });
    return true;
  } catch (e) {
    console.error("Payment failed:", e);
    return false;
  }
};

/**
 * Updates core liability settings.
 */
export const updateLiabilityConfig = async (updates: Partial<LiabilityState>, user: CustomUser) => {
    const db = getFirestore();
    const docRef = doc(db, 'liabilities', LIABILITY_DOC_ID);
    
    try {
        await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(docRef);
            if (!snap.exists()) return;
            
            const current = snap.data() as LiabilityState;
            const finalUpdates = { ...updates };

            const hasManualBalance = updates.loanBalance !== undefined || updates.rentBalance !== undefined;
            const hasNewStartDate = updates.loanStartDate !== undefined && updates.loanStartDate !== current.loanStartDate;

            if (hasManualBalance) {
                finalUpdates.lastLiabilityCycleUpdate = startOfMonth(new Date()).toISOString();
            } else if (hasNewStartDate) {
                finalUpdates.lastLiabilityCycleUpdate = updates.loanStartDate;
            }

            transaction.update(docRef, sanitize(finalUpdates));

            const logRef = doc(collection(db, 'logs'));
            transaction.set(logRef, sanitize({
                type: 'SETTINGS_UPDATED',
                description: `Strategic Liability Configuration was updated.`,
                timestamp: new Date().toISOString(),
                user: { uid: user.username, displayName: user.displayName },
                details: { updates: finalUpdates }
            }));
        });
        return true;
    } catch (e) {
        console.error("Update config failed:", e);
        return false;
    }
};
