const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  projectId: "museview-gag3p",
  appId: "1:529984145400:web:1fef8c161e5b2ca229b80d",
  apiKey: "AIzaSyCmN6MkteozF-6OCk8OJ8Pk_J42-pkGUZg",
  authDomain: "museview-gag3p.firebaseapp.com",
  storageBucket: "museview-gag3p.firebasestorage.app",
  messagingSenderId: "529984145400"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function inspect() {
  try {
    const empSnap = await getDocs(collection(db, 'employees'));
    const employees = empSnap.docs.map(d => d.data());
    const adminEmp = employees.find(e => e.role === 'admin' || e.username === 'Viren') || employees[0];
    await signInWithEmailAndPassword(auth, `${adminEmp.username.toLowerCase()}@8bitbistro.local`, `${adminEmp.pin}-8bit`);

    console.log("=== INSPECTING OCTOBER 2026 MEMBERS & BILLS ===");

    // Fetch members
    const membersSnap = await getDocs(collection(db, 'members'));
    const allMembers = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filter members joined since Oct 1, 2026
    const octMembers = allMembers.filter(m => {
      if (!m.joinDate) return false;
      const jDate = new Date(m.joinDate);
      return jDate >= new Date('2026-10-01T00:00:00.000Z');
    }).sort((a, b) => new Date(a.joinDate).getTime() - new Date(b.joinDate).getTime());

    console.log(`Total members joined since Oct 1, 2026: ${octMembers.length}`);

    // Fetch all bills
    const billsSnap = await getDocs(collection(db, 'bills'));
    const allBills = billsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`Total bills in system: ${allBills.length}`);

    const report = [];

    for (const member of octMembers) {
      // 1. Transactions on their profile
      const txSnap = await getDocs(collection(db, `members/${member.id}/transactions`));
      const transactions = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const txBillIds = new Set(transactions.map(t => t.billId).filter(Boolean));

      // 2. Bills where member.id is in bill.members
      const billsWithMemberId = allBills.filter(b => 
        (b.members || []).some(m => m.id === member.id)
      );

      // 3. Potential bills where member's phone or name matched a guest or unlinked member
      const cleanPhone = (member.phone || '').replace(/\D/g, '').slice(-10);
      const memberNameLower = (member.name || '').trim().toLowerCase();
      const memberUsernameLower = (member.username || '').trim().toLowerCase();

      const possibleUnlinkedBills = allBills.filter(b => {
        // Exclude if already in billsWithMemberId
        if (billsWithMemberId.some(bm => bm.id === b.id)) return false;

        // Check if any member entry on this bill matches by phone or exact name
        return (b.members || []).some(m => {
          const mName = (m.name || '').trim().toLowerCase();
          const mPhone = (m.phone || '').replace(/\D/g, '').slice(-10);
          if (cleanPhone && mPhone && cleanPhone === mPhone) return true;
          if (mName && mName === memberNameLower && (m.id.startsWith('guest-') || !m.id)) return true;
          return false;
        });
      });

      // Check if any bill in billsWithMemberId is missing from transactions
      const unlinkedFromTransactions = billsWithMemberId.filter(b => !txBillIds.has(b.id));

      report.push({
        id: member.id,
        name: member.name,
        username: member.username,
        phone: member.phone || 'N/A',
        joinDate: member.joinDate,
        tier: member.tier,
        bitsBalance: member.bitsBalance ?? 0,
        totalSpent: member.totalSpent ?? 0,
        transactionsCount: transactions.length,
        billsPaidCount: billsWithMemberId.length,
        unlinkedFromTransactions: unlinkedFromTransactions.map(b => ({
          billId: b.id,
          totalAmount: b.totalAmount,
          timestamp: b.timestamp,
          stationName: b.stationName
        })),
        possibleUnlinkedBills: possibleUnlinkedBills.map(b => ({
          billId: b.id,
          totalAmount: b.totalAmount,
          timestamp: b.timestamp,
          stationName: b.stationName,
          matchedMembers: b.members
        }))
      });
    }

    console.log(JSON.stringify(report, null, 2));

  } catch (err) {
    console.error("Inspection error:", err);
  }
  process.exit(0);
}

inspect();
