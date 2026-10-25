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

async function check() {
  try {
    const empSnap = await getDocs(collection(db, 'employees'));
    const employees = empSnap.docs.map(d => d.data());
    const adminEmp = employees.find(e => e.role === 'admin' || e.username === 'Viren') || employees[0];
    await signInWithEmailAndPassword(auth, `${adminEmp.username.toLowerCase()}@8bitbistro.local`, `${adminEmp.pin}-8bit`);

    const membersSnap = await getDocs(collection(db, 'members'));
    const allMembers = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const octMembers = allMembers.filter(m => {
      if (!m.joinDate) return false;
      return new Date(m.joinDate) >= new Date('2026-10-01T00:00:00.000Z');
    }).sort((a, b) => new Date(a.joinDate).getTime() - new Date(b.joinDate).getTime());

    const billsSnap = await getDocs(collection(db, 'bills'));
    // Only care about bills from October 1 onwards
    const octBills = billsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(b => b.timestamp && new Date(b.timestamp) >= new Date('2026-10-01T00:00:00.000Z'));

    console.log(`October members count: ${octMembers.length}`);
    console.log(`October bills count: ${octBills.length}`);

    // Map each October member
    const results = [];

    for (const m of octMembers) {
      const txSnap = await getDocs(collection(db, `members/${m.id}/transactions`));
      const txs = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const txBillIds = new Set(txs.map(t => t.billId).filter(Boolean));

      // 1. Linked bills where member.id is in bill.members
      const linkedBills = octBills.filter(b => (b.members || []).some(bm => bm.id === m.id));

      // Uncredited linked bills (in bills collection, but missing from transactions subcollection)
      const missingFromProfile = linkedBills.filter(b => !txBillIds.has(b.id));

      // 2. Guest bills during October that might belong to this member (by phone or name)
      const cleanPhone = (m.phone || '').replace(/\D/g, '').slice(-10);
      const mName = (m.name || '').trim().toLowerCase();

      const potentialGuestBills = octBills.filter(b => {
        if (linkedBills.some(lb => lb.id === b.id)) return false;
        return (b.members || []).some(bm => {
          const bPhone = (bm.phone || '').replace(/\D/g, '').slice(-10);
          const bName = (bm.name || '').trim().toLowerCase();
          if (cleanPhone.length === 10 && bPhone === cleanPhone) return true;
          if (mName.length > 3 && bName === mName && (bm.id?.startsWith('guest-') || !bm.id)) return true;
          return false;
        });
      });

      results.push({
        name: m.name,
        username: m.username,
        joinDate: m.joinDate,
        tier: m.tier,
        bitsBalance: m.bitsBalance ?? 0,
        totalSpent: m.totalSpent ?? 0,
        transactionsCount: txs.length,
        linkedBillsCount: linkedBills.length,
        missingFromProfileCount: missingFromProfile.length,
        missingFromProfile: missingFromProfile.map(b => ({ id: b.id, amount: b.totalAmount, date: b.timestamp })),
        potentialGuestBillsCount: potentialGuestBills.length,
        potentialGuestBills: potentialGuestBills.map(b => ({ id: b.id, amount: b.totalAmount, date: b.timestamp, station: b.stationName }))
      });
    }

    console.log("\n=== FULL LIST OF OCTOBER MEMBERS ===");
    results.forEach((r, idx) => {
      console.log(`${idx + 1}. ${r.name} (@${r.username}) | Joined: ${r.joinDate?.slice(0, 10)} | Tier: ${r.tier} | Bits: ${r.bitsBalance} | Spent: ₹${r.totalSpent} | Linked Bills: ${r.linkedBillsCount} | Missing: ${r.missingFromProfileCount} | Guest Matches: ${r.potentialGuestBillsCount}`);
      if (r.missingFromProfileCount > 0) {
        console.log(`   -> MISSING LINKED BILLS:`, r.missingFromProfile);
      }
      if (r.potentialGuestBillsCount > 0) {
        console.log(`   -> POTENTIAL GUEST BILLS:`, r.potentialGuestBills);
      }
    });

  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}

check();
