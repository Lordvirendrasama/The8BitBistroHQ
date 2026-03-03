
'use client';

import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, writeBatch, WriteBatch, getDoc, runTransaction, where, query, getDocs } from 'firebase/firestore';
import type { Member, ClaimedReward, Reward, Transaction, LogEntry, LogEntryType, GamingPackage, MemberRecharge } from '@/lib/types';
import { getSettings } from './settings';
import { addMonths, isAfter } from 'date-fns';

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

const createLogEntry = (
  db: ReturnType<typeof getFirestore>, 
  batch: WriteBatch,
  entry: Omit<LogEntry, 'id' | 'timestamp' | 'user'>
) => {
  const logRef = doc(collection(db, 'logs'));
  const currentUserJson = sessionStorage.getItem('user');
  const currentUser = currentUserJson ? JSON.parse(currentUserJson) : { uid: 'system', displayName: 'System' };
  
  batch.set(logRef, sanitize({
    ...entry,
    timestamp: new Date().toISOString(),
    user: { uid: currentUser.username || currentUser.uid, displayName: currentUser.displayName }
  }));
};

export const addMember = async (memberData: Omit<Member, 'id'>, referrerId?: string) => {
  const db = getFirestore();
  const settings = await getSettings();
  
  const dataToAdd: Partial<Omit<Member, 'id'>> = { 
    ...memberData,
    cycle: settings.activeCycle || 'Testing Data 1'
  };

  if (dataToAdd.email === undefined) delete dataToAdd.email;
  if (dataToAdd.phone === undefined) delete dataToAdd.phone;
  
  const newMemberRef = doc(collection(db, 'members'));

  try {
    await runTransaction(db, async (transaction) => {
        transaction.set(newMemberRef, sanitize(dataToAdd));

        const joinLogRef = doc(collection(db, 'logs'));
        const currentUser = { uid: 'system', displayName: 'System' };
        transaction.set(joinLogRef, sanitize({
            type: 'MEMBER_JOINED',
            description: `New member <strong>${dataToAdd.name}</strong> joined under cycle ${dataToAdd.cycle}.`,
            memberId: newMemberRef.id,
            details: { memberData: dataToAdd, referrerId: referrerId || null },
            timestamp: new Date().toISOString(),
            user: { uid: currentUser.uid, displayName: currentUser.displayName },
            cycle: dataToAdd.cycle
        }));

        if (referrerId && dataToAdd.email && dataToAdd.phone) {
            const referrerRef = doc(db, 'members', referrerId);
            const referrerDoc = await transaction.get(referrerRef);
            if (referrerDoc.exists()) {
                const referrerData = referrerDoc.data() as Member;
                const referralBonus = 500;
                transaction.update(referrerRef, { xp: (referrerData.xp || 0) + referralBonus });
                
                const referralLogRef = doc(collection(db, 'logs'));
                transaction.set(referralLogRef, sanitize({
                    type: 'XP_GAINED',
                    description: `<strong>${referrerData.name}</strong> earned <strong>${referralBonus} XP</strong> for referral.`,
                    memberId: referrerId,
                    details: { bonusXP: referralBonus },
                    timestamp: new Date().toISOString(),
                    user: { uid: currentUser.uid, displayName: currentUser.displayName },
                    cycle: dataToAdd.cycle
                }));
            }
        }
    });
    return newMemberRef.id;
  } catch (e) {
    console.error("Error adding member: ", e);
    return null;
  }
};

export const updateMember = async (memberId: string, memberData: Partial<Member>) => {
    const db = getFirestore();
    const batch = writeBatch(db);
    const memberRef = doc(db, 'members', memberId);
    try {
        batch.update(memberRef, sanitize(memberData));
        createLogEntry(db, batch, {
            type: 'MEMBER_UPDATED',
            description: `Updated details for member ID <strong>${memberId}</strong>.`,
            memberId: memberId,
            details: { updates: memberData }
        });
        await batch.commit();
    } catch (e) {
        console.error("Error updating member: ", e);
    }
}

export const deleteMember = async (memberId: string) => {
    const db = getFirestore();
    const batch = writeBatch(db);
    const memberRef = doc(db, 'members', memberId);
    try {
        batch.delete(memberRef);
        createLogEntry(db, batch, {
            type: 'MEMBER_DELETED',
            description: `Deleted member with ID <strong>${memberId}</strong>.`,
            memberId: memberId
        });
        await batch.commit();
    } catch (e) {
        console.error("Error deleting member: ", e);
    }
}

export const recordTransaction = async (member: Member, updates: Partial<Member>, transactionData: Omit<Transaction, 'id' | 'date'>) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const settings = await getSettings();

  const memberRef = doc(db, 'members', member.id);
  batch.update(memberRef, sanitize(updates));

  const transactionRef = doc(collection(db, `members/${member.id}/transactions`));
  batch.set(transactionRef, sanitize({
    ...transactionData,
    date: new Date().toISOString(),
    cycle: settings.activeCycle || 'Live Cycle'
  }));

  createLogEntry(db, batch, {
    type: 'XP_GAINED',
    description: `<strong>${member.name}</strong> gained <strong>${transactionData.xpGained} XP</strong>.`,
    memberId: member.id,
    details: { amount: transactionData.amount, xpGained: transactionData.xpGained },
    cycle: settings.activeCycle || 'Live Cycle'
  });

  try {
    await batch.commit();
  } catch (e) {
    console.error("Error recording transaction: ", e);
  }
};

export const recordClaimedReward = async (member: Member, reward: Reward) => {
    const db = getFirestore();
    const batch = writeBatch(db);
    const settings = await getSettings();

    const claimedRewardsRef = doc(collection(db, 'members', member.id, 'claimedRewards'));
    batch.set(claimedRewardsRef, sanitize({
        rewardId: reward.id,
        rewardName: reward.name,
        pointsCost: reward.pointsCost,
        date: new Date().toISOString(),
        cycle: settings.activeCycle || 'Live Cycle'
    }));

    createLogEntry(db, batch, {
      type: 'REWARD_CLAIMED',
      description: `<strong>${member.name}</strong> claimed "<strong>${reward.name}</strong>".`,
      memberId: member.id,
      details: { rewardId: reward.id, rewardName: reward.name },
      cycle: settings.activeCycle || 'Live Cycle'
    });

    const recentClaimRef = doc(collection(db, 'recentRewardClaims'));
    batch.set(recentClaimRef, sanitize({
        memberId: member.id,
        memberName: member.name,
        memberAvatarUrl: member.avatarUrl,
        rewardName: reward.name,
        pointsCost: reward.pointsCost,
        timestamp: new Date().toISOString()
    }));

    try {
        await batch.commit();
    } catch (e) {
        console.error("Error recording reward claim: ", e);
    }
};

/**
 * Purchases a prepaid recharge pack for a member.
 */
export const rechargeMember = async (memberId: string, pkg: GamingPackage, paymentMethod: 'cash' | 'upi', options?: { skipBill?: boolean }) => {
    const db = getFirestore();
    const settings = await getSettings();
    const batch = writeBatch(db);
    
    const memberRef = doc(db, 'members', memberId);
    const memberSnap = await getDoc(memberRef);
    if (!memberSnap.exists()) return null;
    
    const member = memberSnap.data() as Member;
    const now = new Date();
    const expiry = new Date(now.getTime() + (pkg.validity * 24 * 60 * 60 * 1000));
    
    const newRechargeId = doc(collection(db, 'dummy')).id;
    const newRecharge: MemberRecharge = {
        id: newRechargeId,
        packageId: pkg.id,
        packageName: pkg.name,
        totalDuration: pkg.duration,
        remainingDuration: pkg.duration,
        purchaseDate: now.toISOString(),
        expiryDate: expiry.toISOString(),
        pricePaid: pkg.price
    };

    const updatedRecharges = [...(member.recharges || []), newRecharge];
    batch.update(memberRef, sanitize({ 
        recharges: updatedRecharges,
        totalSpent: (member.totalSpent || 0) + pkg.price
    }));

    if (!options?.skipBill) {
        // Record this as a special bill for accounting
        const billRef = doc(collection(db, 'bills'));
        batch.set(billRef, sanitize({
            timestamp: now.toISOString(),
            stationName: "OFF-STATION RECHARGE",
            packageName: pkg.name,
            totalAmount: pkg.price,
            foodSubtotal: 0,
            initialPackagePrice: pkg.price,
            discount: 0,
            paymentMethod: paymentMethod,
            members: [{ id: member.id, name: member.name, avatarUrl: member.avatarUrl }],
            items: [],
            cycle: settings.activeCycle || 'Live Cycle',
            isRechargePurchase: true
        }));
    }

    createLogEntry(db, batch, {
        type: 'MEMBER_RECHARGED',
        description: `Member <strong>${member.name}</strong> purchased <strong>${pkg.name}</strong> recharge pack for ₹${pkg.price}.`,
        memberId: member.id,
        details: { recharge: newRecharge, paymentMethod },
        cycle: settings.activeCycle || 'Live Cycle'
    });

    try {
        await batch.commit();
        return newRechargeId;
    } catch (e) {
        console.error("Recharge failed:", e);
        return null;
    }
};

/**
 * Deducts time from a specific recharge pack.
 */
export const consumeRechargeTime = async (memberId: string, rechargeId: string, durationSeconds: number) => {
    const db = getFirestore();
    const memberRef = doc(db, 'members', memberId);
    
    try {
        await runTransaction(db, async (transaction) => {
            const memberSnap = await transaction.get(memberRef);
            if (!memberSnap.exists()) throw "Member not found";
            
            const member = memberSnap.data() as Member;
            const updatedRecharges = (member.recharges || []).map(r => {
                if (r.id === rechargeId) {
                    return { ...r, remainingDuration: Math.max(0, r.remainingDuration - durationSeconds) };
                }
                return r;
            });
            
            transaction.update(memberRef, sanitize({ recharges: updatedRecharges }));
        });
        return true;
    } catch (e) {
        console.error("Deducting recharge time failed:", e);
        return false;
    }
};

/**
 * Deducts time from a member's total pool of valid recharges.
 * Prioritizes recharges that are expiring soonest.
 */
export const consumeMemberBalancePool = async (memberId: string, totalSecondsToDeduct: number) => {
    const db = getFirestore();
    const memberRef = doc(db, 'members', memberId);
    const now = new Date();

    try {
        await runTransaction(db, async (transaction) => {
            const memberSnap = await transaction.get(memberRef);
            if (!memberSnap.exists()) throw "Member not found";
            
            const member = memberSnap.data() as Member;
            if (!member.recharges || member.recharges.length === 0) return;

            // Sort by expiry date (ascending) to use the soonest-to-expire first
            const sortedRecharges = [...member.recharges].sort((a, b) => 
                new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
            );

            let remainingToDeduct = totalSecondsToDeduct;
            const updatedRecharges = sortedRecharges.map(r => {
                const isValid = isAfter(new Date(r.expiryDate), now) && r.remainingDuration > 0;
                
                if (isValid && remainingToDeduct > 0) {
                    const deduction = Math.min(r.remainingDuration, remainingToDeduct);
                    remainingToDeduct -= deduction;
                    return { ...r, remainingDuration: r.remainingDuration - deduction };
                }
                return r;
            });

            transaction.update(memberRef, sanitize({ recharges: updatedRecharges }));
        });
        return true;
    } catch (e) {
        console.error("Pool balance deduction failed:", e);
        return false;
    }
};
