
'use client';

import { getFirestore, collection, collectionGroup, getDocs, writeBatch, doc, where, query } from 'firebase/firestore';
import type { Member, Transaction, ClaimedReward, LogEntry } from '@/lib/types';

export const seedInitialLogs = async () => {
    const db = getFirestore();
    const batch = writeBatch(db);
    let logCount = 0;
    const currentUser = { uid: 'admin_user', displayName: 'Viren' };

    // 1. Get all members
    const membersRef = collection(db, 'members');
    const membersSnapshot = await getDocs(membersRef);
    const members = membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));

    for (const member of members) {
        // Create MEMBER_JOINED log
        const joinLogRef = doc(collection(db, 'logs'));
        batch.set(joinLogRef, {
            type: 'MEMBER_JOINED',
            description: `New member <strong>${member.name}</strong> (@${member.username}) joined as a ${member.tier} tier member.`,
            memberId: member.id,
            timestamp: new Date(member.joinDate).toISOString(),
            user: { uid: currentUser.uid, displayName: currentUser.displayName },
        });
        logCount++;
    }

    // 2. Get all transactions across all members (for Bill Payments / XP Gained)
    const transactionsQuery = collectionGroup(db, 'transactions');
    const transactionsSnapshot = await getDocs(transactionsQuery);
    
    for (const transactionDoc of transactionsSnapshot.docs) {
        const transaction = { id: transactionDoc.id, ...transactionDoc.data() } as Transaction;
        const memberId = transactionDoc.ref.parent.parent?.id;
        const member = members.find(m => m.id === memberId);

        if (member) {
            const xpLogRef = doc(collection(db, 'logs'));
            batch.set(xpLogRef, {
                type: 'XP_GAINED',
                description: `<strong>${member.name}</strong> paid a bill of ₹${transaction.amount.toLocaleString()} and gained <strong>${transaction.xpGained} XP</strong>.`,
                memberId: member.id,
                details: {
                    amount: transaction.amount,
                    xpGained: transaction.xpGained,
                },
                timestamp: new Date(transaction.date).toISOString(),
                user: { uid: currentUser.uid, displayName: currentUser.displayName },
            });
            logCount++;
        }
    }

    // 3. Get all claimed rewards across all members
    const claimedRewardsQuery = collectionGroup(db, 'claimedRewards');
    const claimedRewardsSnapshot = await getDocs(claimedRewardsQuery);

    for (const rewardDoc of claimedRewardsSnapshot.docs) {
        const claimedReward = { id: rewardDoc.id, ...rewardDoc.data() } as ClaimedReward;
        const memberId = rewardDoc.ref.parent.parent?.id;
        const member = members.find(m => m.id === memberId);

        if (member) {
            const rewardLogRef = doc(collection(db, 'logs'));
            batch.set(rewardLogRef, {
                type: 'REWARD_CLAIMED',
                description: `<strong>${member.name}</strong> claimed the reward "<strong>${claimedReward.rewardName}</strong>" for ${claimedReward.pointsCost.toLocaleString()} points.`,
                memberId: member.id,
                details: {
                    rewardId: claimedReward.rewardId,
                    rewardName: claimedReward.rewardName,
                    pointsCost: claimedReward.pointsCost,
                },
                timestamp: new Date(claimedReward.date).toISOString(),
                user: { uid: currentUser.uid, displayName: currentUser.displayName },
            });
            logCount++;
        }
    }
    
    const dataBackfillRef = doc(collection(db, 'logs'));
    batch.set(dataBackfillRef, {
        type: 'DATA_BACKFILLED',
        description: `Backfilled <strong>${logCount}</strong> historical events into the master log.`,
        timestamp: new Date().toISOString(),
        user: { uid: currentUser.uid, displayName: currentUser.displayName },
    });
    logCount++;

    // Commit the batch
    await batch.commit();

    return logCount;
};
