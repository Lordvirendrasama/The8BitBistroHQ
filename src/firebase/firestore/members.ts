
'use client';

import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, writeBatch, WriteBatch, getDoc, runTransaction, where, query, getDocs, limit } from 'firebase/firestore';
import type { Member, ClaimedReward, Reward, Transaction, LogEntry, LogEntryType, GamingPackage, MemberRecharge, Bill } from '@/lib/types';
import { getSettings } from './settings';
import { addMonths, isAfter } from 'date-fns';
import { getTierMultiplier } from '@/lib/pricing';

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
  const currentUserJson = typeof window !== 'undefined' ? sessionStorage.getItem('user') : null;
  const currentUser = currentUserJson ? JSON.parse(currentUserJson) : { uid: 'system', displayName: 'System' };
  
  batch.set(logRef, sanitize({
    ...entry,
    timestamp: new Date().toISOString(),
    user: { uid: currentUser.username || currentUser.uid, displayName: currentUser.displayName }
  }));
};

export const migrateMembersToBits = async (): Promise<{ count: number; success: boolean }> => {
  const db = getFirestore();
  const membersRef = collection(db, 'members');
  try {
    const snapshot = await getDocs(membersRef);
    let migratedCount = 0;
    
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const chunk = docs.slice(i, i + 400);
      const batch = writeBatch(db);
      let batchCount = 0;
      
      chunk.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (data.isBitsMigrated === true) {
          return;
        }

        const legacyPoints = typeof data.points === 'number' ? data.points : 0;
        const currentBitsBalance = typeof data.bitsBalance === 'number' ? data.bitsBalance : legacyPoints;
        const currentLifetimeBits = typeof data.lifetimeBitsEarned === 'number' ? data.lifetimeBitsEarned : legacyPoints;

        batch.update(docSnap.ref, {
          bitsBalance: currentBitsBalance,
          lifetimeBitsEarned: currentLifetimeBits,
          isBitsMigrated: true
        });
        batchCount++;
      });

      if (batchCount > 0) {
        await batch.commit();
        migratedCount += batchCount;
      }
    }

    const rewardsRef = collection(db, 'rewards');
    const rewardsSnap = await getDocs(rewardsRef);
    const rewardBatch = writeBatch(db);
    let rewardBatchCount = 0;
    rewardsSnap.docs.forEach((rSnap) => {
      const rData = rSnap.data() as any;
      if (rData.bitsCost === undefined) {
        const cost = rData.pointsCost ?? 0;
        rewardBatch.update(rSnap.ref, { bitsCost: cost });
        rewardBatchCount++;
      }
    });
    if (rewardBatchCount > 0) {
      await rewardBatch.commit();
    }

    return { count: migratedCount, success: true };
  } catch (error) {
    console.error("Migration to Bits failed:", error);
    return { count: 0, success: false };
  }
};

export const addMember = async (memberData: Omit<Member, 'id'>, referrerId?: string) => {
  const db = getFirestore();
  const settings = await getSettings();
  
  const dataToAdd: Partial<Omit<Member, 'id'>> = { 
    ...memberData,
    bitsBalance: memberData.bitsBalance ?? (memberData as any).points ?? 0,
    lifetimeBitsEarned: memberData.lifetimeBitsEarned ?? (memberData as any).points ?? 0,
    isBitsMigrated: true,
    cycle: settings.activeCycle || 'Testing Data 1'
  };

  if (dataToAdd.email === undefined) delete dataToAdd.email;
  if (dataToAdd.phone === undefined) delete dataToAdd.phone;
  if (dataToAdd.birthday === undefined) delete dataToAdd.birthday;
  
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
                const currentBits = referrerData.bitsBalance ?? (referrerData.points || 0);
                const currentLifetime = referrerData.lifetimeBitsEarned ?? currentBits;
                const newLifetime = currentLifetime + referralBonus;
                const newLevel = Math.max(referrerData.level || 1, Math.floor(newLifetime / 100) + 1);

                transaction.update(referrerRef, { 
                  bitsBalance: currentBits + referralBonus,
                  lifetimeBitsEarned: newLifetime,
                  level: newLevel,
                  isBitsMigrated: true
                });

                const txRef = doc(collection(db, 'members', referrerId, 'transactions'));
                transaction.set(txRef, sanitize({
                    date: new Date().toISOString(),
                    amount: 0,
                    bitsGained: referralBonus,
                    cycle: dataToAdd.cycle
                }));
                
                const referralLogRef = doc(collection(db, 'logs'));
                transaction.set(referralLogRef, sanitize({
                    type: 'BITS_EARNED',
                    description: `<strong>${referrerData.name}</strong> earned <strong>${referralBonus} Bits</strong> for referral.`,
                    memberId: referrerId,
                    details: { bonusBits: referralBonus, referredMemberId: newMemberRef.id },
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

  const bitsEarned = transactionData.bitsGained ?? transactionData.xpGained ?? 0;

  createLogEntry(db, batch, {
    type: 'BITS_EARNED',
    description: `<strong>${member.name}</strong> earned <strong>${bitsEarned} Bits</strong>.`,
    memberId: member.id,
    details: { amount: transactionData.amount, bitsGained: bitsEarned },
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
    const cost = reward.bitsCost ?? reward.pointsCost ?? 0;

    const claimedRewardsRef = doc(collection(db, 'members', member.id, 'claimedRewards'));
    batch.set(claimedRewardsRef, sanitize({
        rewardId: reward.id,
        rewardName: reward.name,
        bitsCost: cost,
        pointsCost: cost,
        date: new Date().toISOString(),
        cycle: settings.activeCycle || 'Live Cycle'
    }));

    createLogEntry(db, batch, {
      type: 'REWARD_CLAIMED',
      description: `<strong>${member.name}</strong> claimed "<strong>${reward.name}</strong>" for ${cost} Bits.`,
      memberId: member.id,
      details: { rewardId: reward.id, rewardName: reward.name, bitsCost: cost },
      cycle: settings.activeCycle || 'Live Cycle'
    });

    const recentClaimRef = doc(collection(db, 'recentRewardClaims'));
    batch.set(recentClaimRef, sanitize({
        memberId: member.id,
        memberName: member.name,
        memberAvatarUrl: member.avatarUrl,
        rewardName: reward.name,
        bitsCost: cost,
        pointsCost: cost,
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
    const now = new Date();
    
    const memberRef = doc(db, 'members', memberId);
    const memberSnap = await getDoc(memberRef);
    if (!memberSnap.exists()) return null;
    
    const member = memberSnap.data() as Member;
    const validityDays = (pkg.validity && pkg.validity > 0) ? pkg.validity : 1;
    const expiry = new Date(now.getTime() + (validityDays * 24 * 60 * 60 * 1000));
    
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

    if (!options?.skipBill) {
        const tierMultiplier = getTierMultiplier(member.tier);
        const bitsEarned = Math.floor((pkg.price / 10) * tierMultiplier);
        const currentBits = member.bitsBalance ?? (member as any).points ?? 0;
        const currentLifetime = member.lifetimeBitsEarned ?? currentBits;
        const newBitsBalance = currentBits + bitsEarned;
        const newLifetimeBits = currentLifetime + bitsEarned;
        const newLevel = Math.max(member.level || 1, Math.floor(newLifetimeBits / 100) + 1);

        batch.update(memberRef, sanitize({ 
            recharges: updatedRecharges,
            totalSpent: (member.totalSpent || 0) + pkg.price,
            bitsBalance: newBitsBalance,
            lifetimeBitsEarned: newLifetimeBits,
            level: newLevel,
            isBitsMigrated: true
        }));

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

        const txRef = doc(collection(db, 'members', member.id, 'transactions'));
        batch.set(txRef, sanitize({
            date: now.toISOString(),
            amount: pkg.price,
            bitsGained: bitsEarned,
            billId: billRef.id,
            cycle: settings.activeCycle || 'Live Cycle'
        }));

        createLogEntry(db, batch, {
            type: 'BITS_EARNED',
            description: `<strong>${member.name}</strong> earned <strong>${bitsEarned} Bits</strong> for purchasing <strong>${pkg.name}</strong> recharge pack.`,
            memberId: member.id,
            details: { amount: pkg.price, bitsGained: bitsEarned, billId: billRef.id },
            cycle: settings.activeCycle || 'Live Cycle'
        });
    } else {
        batch.update(memberRef, sanitize({ 
            recharges: updatedRecharges
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

/**
 * Adjusts a member's total pool by either adding or removing time.
 * If positive: Adds time to the newest active recharge, or creates a dummy one.
 * If negative: Removes time from the soonest to expire.
 */
export const adjustMemberBalancePool = async (memberId: string, durationSeconds: number) => {
    if (durationSeconds === 0) return true;
    if (durationSeconds < 0) return consumeMemberBalancePool(memberId, Math.abs(durationSeconds));

    const db = getFirestore();
    const memberRef = doc(db, 'members', memberId);
    try {
        await runTransaction(db, async (transaction) => {
            const memberSnap = await transaction.get(memberRef);
            if (!memberSnap.exists()) throw "Member not found";
            
            const member = memberSnap.data() as Member;
            const recharges = member.recharges || [];
            
            // Try to find any active recharge to dump time into (prefer furthest expiry)
            let updatedRecharges = [...recharges];
            const activeIndexes = updatedRecharges
                .map((r, i) => ({r, i}))
                .filter(x => new Date(x.r.expiryDate).getTime() > Date.now())
                .sort((a, b) => new Date(b.r.expiryDate).getTime() - new Date(a.r.expiryDate).getTime());

            if (activeIndexes.length > 0) {
                const targetIdx = activeIndexes[0].i;
                updatedRecharges[targetIdx].remainingDuration += durationSeconds;
                updatedRecharges[targetIdx].totalDuration += durationSeconds;
            } else {
                // Generate a dummy recharge if they have nothing active
                const dummyId = doc(collection(db, 'dummy')).id;
                updatedRecharges.push({
                    id: dummyId,
                    packageId: 'manual',
                    packageName: 'Manual Time Transfer',
                    totalDuration: durationSeconds,
                    remainingDuration: durationSeconds,
                    purchaseDate: new Date().toISOString(),
                    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    pricePaid: 0
                });
            }

            transaction.update(memberRef, sanitize({ recharges: updatedRecharges }));
        });
        return true;
    } catch (e) {
        console.error("Pool adjustment failed:", e);
        return false;
    }
};

/**
 * Searches members in Firestore on-demand to avoid fetching the entire collection.
 * Uses case-variations (original, capitalized, lowercase) prefix matches in parallel for names and usernames.
 */
export const searchMembers = async (searchTerm: string): Promise<Member[]> => {
    const db = getFirestore();
    const membersRef = collection(db, 'members');
    
    // If search term is empty, fetch a default list of 30 members
    if (!searchTerm) {
        const q = query(membersRef, limit(30));
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
    }
    
    const term = searchTerm.trim();
    const termCapitalized = term.charAt(0).toUpperCase() + term.slice(1);
    
    // Prefix queries for name as typed, capitalized name, and lowercase username
    const q1 = query(membersRef, where('name', '>=', term), where('name', '<=', term + '\uf8ff'), limit(30));
    const q2 = query(membersRef, where('name', '>=', termCapitalized), where('name', '<=', termCapitalized + '\uf8ff'), limit(30));
    const q3 = query(membersRef, where('username', '>=', term.toLowerCase()), where('username', '<=', term.toLowerCase() + '\uf8ff'), limit(30));
    
    const [snap1, snap2, snap3] = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);
    
    // Merge and deduplicate results
    const map = new Map<string, Member>();
    snap1.docs.forEach(doc => map.set(doc.id, { id: doc.id, ...doc.data() } as Member));
    snap2.docs.forEach(doc => map.set(doc.id, { id: doc.id, ...doc.data() } as Member));
    snap3.docs.forEach(doc => map.set(doc.id, { id: doc.id, ...doc.data() } as Member));
    
    return Array.from(map.values()).slice(0, 30);
};

/**
 * Retroactively scans all bills and credits missing Bits and Total Spent to members.
 * Checks members/{memberId}/transactions to ensure idempotent, safe execution without duplicate credits.
 */
export const syncMissingMemberBitsFromBills = async (): Promise<{
  success: boolean;
  updatedMembersCount: number;
  totalBitsAwarded: number;
  totalSpentAwarded: number;
  details: Array<{ memberId: string; name: string; bitsAdded: number; spentAdded: number; billsCount: number }>;
}> => {
  const db = getFirestore();
  const settings = await getSettings();
  
  try {
    // 1. Fetch all bills
    const billsSnap = await getDocs(collection(db, 'bills'));
    const bills = billsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bill));
    
    // 2. Fetch all members
    const membersSnap = await getDocs(collection(db, 'members'));
    const members = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
    const memberMap = new Map<string, Member>();
    members.forEach(m => memberMap.set(m.id, m));

    // 3. Find all member IDs that appear in at least one bill
    const memberIdsInBills = new Set<string>();
    bills.forEach(bill => {
      (bill.members || []).forEach(m => {
        if (m.id && !m.id.startsWith('guest-') && memberMap.has(m.id)) {
          memberIdsInBills.add(m.id);
        }
      });
    });

    // 4. For each relevant member, fetch their existing transactions to find already credited bills
    const memberCreditedBills = new Map<string, Set<string>>();
    for (const memberId of memberIdsInBills) {
      const txSnap = await getDocs(collection(db, `members/${memberId}/transactions`));
      const billIds = new Set<string>();
      txSnap.docs.forEach(d => {
        const data = d.data();
        if (data.billId) billIds.add(data.billId);
      });
      memberCreditedBills.set(memberId, billIds);
    }

    // 5. Calculate missing rewards per member
    const memberAdjustments = new Map<string, {
      member: Member;
      missingBits: number;
      missingSpent: number;
      billsCount: number;
      newTransactions: Array<{
        date: string;
        amount: number;
        bitsGained: number;
        billId: string;
        cycle: string;
      }>;
    }>();

    for (const bill of bills) {
      if (!bill.members || bill.members.length === 0 || !bill.totalAmount || bill.totalAmount <= 0) {
        continue;
      }

      const realMembers = bill.members.filter(m => m.id && !m.id.startsWith('guest-') && memberMap.has(m.id));
      if (realMembers.length === 0) continue;

      const totalPlayers = bill.members.length;
      const billPerMember = totalPlayers > 0 ? bill.totalAmount / totalPlayers : 0;
      if (billPerMember <= 0) continue;

      for (const assignedMember of realMembers) {
        const memberId = assignedMember.id;
        const credited = memberCreditedBills.get(memberId);
        
        if (!credited || !credited.has(bill.id)) {
          const currentMemberData = memberMap.get(memberId)!;
          const tierMultiplier = getTierMultiplier(currentMemberData.tier);
          const bitsEarned = Math.floor((billPerMember / 10) * tierMultiplier);

          if (!memberAdjustments.has(memberId)) {
            memberAdjustments.set(memberId, {
              member: currentMemberData,
              missingBits: 0,
              missingSpent: 0,
              billsCount: 0,
              newTransactions: []
            });
          }

          const adj = memberAdjustments.get(memberId)!;
          adj.missingBits += bitsEarned;
          adj.missingSpent += billPerMember;
          adj.billsCount += 1;
          adj.newTransactions.push({
            date: bill.timestamp || new Date().toISOString(),
            amount: billPerMember,
            bitsGained: bitsEarned,
            billId: bill.id,
            cycle: bill.cycle || settings.activeCycle || 'Live Cycle'
          });

          if (credited) credited.add(bill.id);
        }
      }
    }

    // 6. Commit adjustments in Firestore chunks to respect batch operation limits
    let updatedMembersCount = 0;
    let totalBitsAwarded = 0;
    let totalSpentAwarded = 0;
    const summaryDetails: Array<{ memberId: string; name: string; bitsAdded: number; spentAdded: number; billsCount: number }> = [];

    let currentBatch = writeBatch(db);
    let currentBatchOps = 0;

    const commitBatchIfNeeded = async (force = false) => {
      if (currentBatchOps > 0 && (force || currentBatchOps >= 400)) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        currentBatchOps = 0;
      }
    };

    for (const [memberId, adj] of memberAdjustments.entries()) {
      if (adj.missingBits === 0 && adj.missingSpent === 0) continue;

      const memberRef = doc(db, 'members', memberId);
      const currentBits = adj.member.bitsBalance ?? adj.member.points ?? 0;
      const currentLifetime = adj.member.lifetimeBitsEarned ?? currentBits;
      const newBitsBalance = currentBits + adj.missingBits;
      const newLifetime = currentLifetime + adj.missingBits;
      const newTotalSpent = (adj.member.totalSpent || 0) + adj.missingSpent;
      const newLevel = Math.max(adj.member.level || 1, Math.floor(newLifetime / 100) + 1);

      currentBatch.update(memberRef, sanitize({
        bitsBalance: newBitsBalance,
        lifetimeBitsEarned: newLifetime,
        totalSpent: newTotalSpent,
        level: newLevel,
        isBitsMigrated: true
      }));
      currentBatchOps++;
      await commitBatchIfNeeded();

      for (const tx of adj.newTransactions) {
        const txRef = doc(collection(db, `members/${memberId}/transactions`));
        currentBatch.set(txRef, sanitize(tx));
        currentBatchOps++;
        await commitBatchIfNeeded();
      }

      const logRef = doc(collection(db, 'logs'));
      currentBatch.set(logRef, sanitize({
        type: 'BITS_EARNED',
        description: `<strong>${adj.member.name}</strong> retroactively credited with <strong>${adj.missingBits} Bits</strong> from ${adj.billsCount} bill(s).`,
        memberId: memberId,
        details: { amount: adj.missingSpent, bitsGained: adj.missingBits },
        timestamp: new Date().toISOString(),
        user: { uid: 'system', displayName: 'Bits Sync Repair' },
        cycle: settings.activeCycle || 'Live Cycle'
      }));
      currentBatchOps++;
      await commitBatchIfNeeded();

      updatedMembersCount++;
      totalBitsAwarded += adj.missingBits;
      totalSpentAwarded += adj.missingSpent;
      summaryDetails.push({
        memberId,
        name: adj.member.name,
        bitsAdded: adj.missingBits,
        spentAdded: adj.missingSpent,
        billsCount: adj.billsCount
      });
    }

    await commitBatchIfNeeded(true);

    return {
      success: true,
      updatedMembersCount,
      totalBitsAwarded,
      totalSpentAwarded,
      details: summaryDetails
    };
  } catch (error) {
    console.error("Sync missing member bits failed:", error);
    return {
      success: false,
      updatedMembersCount: 0,
      totalBitsAwarded: 0,
      totalSpentAwarded: 0,
      details: []
    };
  }
};
