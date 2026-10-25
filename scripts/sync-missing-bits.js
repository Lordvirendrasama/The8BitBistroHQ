const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, getDocs, doc, writeBatch } = require('firebase/firestore');

const firebaseConfig = {
  projectId: "museview-gag3p",
  appId: "1:529984145400:web:1fef8c161e5b2ca229b80d",
  apiKey: "AIzaSyCmN6MkteozF-6OCk8OJ8Pk_J42-pkGUZg",
  authDomain: "museview-gag3p.firebaseapp.com",
  storageBucket: "museview-gag3p.firebasestorage.app",
  measurementId: "",
  messagingSenderId: "529984145400"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function getTierMultiplier(tier) {
  if (!tier) return 1;
  const normalized = String(tier).trim().toLowerCase();
  if (normalized === 'gold') return 2;
  if (normalized === 'green') return 1.5;
  return 1;
}

const sanitize = (data) => {
  if (data === undefined || data === null) return null;
  if (Array.isArray(data)) return data.map(v => sanitize(v));
  if (typeof data === 'object' && data !== null) {
    const clean = {};
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined) clean[key] = sanitize(data[key]);
    });
    return clean;
  }
  return data;
};

async function runSync() {
  try {
    console.log("=== STARTING RETROACTIVE BITS SYNC ===");

    console.log("Authenticating admin user for Firestore permissions...");
    const empSnap = await getDocs(collection(db, 'employees'));
    const employees = empSnap.docs.map(d => d.data());
    const adminEmp = employees.find(e => e.role === 'admin' || e.username === 'Viren') || employees[0];
    if (!adminEmp) {
      throw new Error("No employees found to authenticate with.");
    }
    const email = `${adminEmp.username.toLowerCase()}@8bitbistro.local`;
    const password = `${adminEmp.pin}-8bit`;
    await signInWithEmailAndPassword(auth, email, password);
    console.log(`Authenticated as ${email}`);

    // 1. Fetch bills
    console.log("Fetching bills...");
    const billsSnap = await getDocs(collection(db, 'bills'));
    const bills = billsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`Found ${bills.length} total bills.`);

    // 2. Fetch members
    console.log("Fetching members...");
    const membersSnap = await getDocs(collection(db, 'members'));
    const memberMap = new Map();
    membersSnap.docs.forEach(d => {
      memberMap.set(d.id, { id: d.id, ...d.data() });
    });
    console.log(`Found ${memberMap.size} total members.`);

    // 3. Find all member IDs listed on bills
    const memberIdsInBills = new Set();
    bills.forEach(bill => {
      (bill.members || []).forEach(m => {
        if (m.id && !m.id.startsWith('guest-') && memberMap.has(m.id)) {
          memberIdsInBills.add(m.id);
        }
      });
    });
    console.log(`Found ${memberIdsInBills.size} unique real members referenced across bills.`);

    // 4. Fetch existing transactions per member
    console.log("Checking transaction records to avoid double credits...");
    const memberCreditedBills = new Map();
    for (const memberId of memberIdsInBills) {
      const txSnap = await getDocs(collection(db, `members/${memberId}/transactions`));
      const billIds = new Set();
      txSnap.docs.forEach(d => {
        const data = d.data();
        if (data.billId) billIds.add(data.billId);
      });
      memberCreditedBills.set(memberId, billIds);
    }

    // 5. Calculate missing rewards
    const memberAdjustments = new Map();

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
          const currentMemberData = memberMap.get(memberId);
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

          const adj = memberAdjustments.get(memberId);
          adj.missingBits += bitsEarned;
          adj.missingSpent += billPerMember;
          adj.billsCount += 1;
          adj.newTransactions.push({
            date: bill.timestamp || new Date().toISOString(),
            amount: billPerMember,
            bitsGained: bitsEarned,
            billId: bill.id,
            cycle: bill.cycle || 'Live Cycle'
          });

          if (credited) credited.add(bill.id);
        }
      }
    }

    console.log(`Members with missing rewards to credit: ${memberAdjustments.size}`);

    if (memberAdjustments.size === 0) {
      console.log("No missing rewards found! All bills are already properly credited.");
      process.exit(0);
    }

    let currentBatch = writeBatch(db);
    let currentBatchOps = 0;

    const commitBatchIfNeeded = async (force = false) => {
      if (currentBatchOps > 0 && (force || currentBatchOps >= 400)) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        currentBatchOps = 0;
      }
    };

    let totalBits = 0;
    let totalSpent = 0;

    for (const [memberId, adj] of memberAdjustments.entries()) {
      if (adj.missingBits === 0 && adj.missingSpent === 0) continue;

      console.log(`-> Crediting ${adj.member.name} (@${adj.member.username || memberId}): +${adj.missingBits} Bits, +₹${adj.missingSpent} spent across ${adj.billsCount} bill(s).`);

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
        cycle: 'Live Cycle'
      }));
      currentBatchOps++;
      await commitBatchIfNeeded();

      totalBits += adj.missingBits;
      totalSpent += adj.missingSpent;
    }

    await commitBatchIfNeeded(true);

    console.log("=== BITS SYNC COMPLETE ===");
    console.log(`Successfully updated ${memberAdjustments.size} members.`);
    console.log(`Total Bits Awarded: ${totalBits}`);
    console.log(`Total Spend Recorded: ₹${totalSpent}`);

  } catch (err) {
    console.error("Sync failed with error:", err);
  }
  process.exit(0);
}

runSync();
