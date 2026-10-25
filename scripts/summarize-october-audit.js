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

async function summarize() {
  try {
    const empSnap = await getDocs(collection(db, 'employees'));
    const employees = empSnap.docs.map(d => d.data());
    const adminEmp = employees.find(e => e.role === 'admin' || e.username === 'Viren') || employees[0];
    await signInWithEmailAndPassword(auth, `${adminEmp.username.toLowerCase()}@8bitbistro.local`, `${adminEmp.pin}-8bit`);

    const membersSnap = await getDocs(collection(db, 'members'));
    const allMembers = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const octMembers = allMembers.filter(m => {
      if (!m.joinDate) return false;
      const jDate = new Date(m.joinDate);
      return jDate >= new Date('2026-10-01T00:00:00.000Z');
    });

    const billsSnap = await getDocs(collection(db, 'bills'));
    const allBills = billsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`=== OCTOBER AUDIT SUMMARY ===`);
    console.log(`Total members joined since Oct 1, 2026: ${octMembers.length}`);

    let membersWithBills = 0;
    let membersWithoutBills = 0;
    const membersWithPossibleGuestBills = [];
    const membersWithUnlinkedTransactions = [];

    for (const m of octMembers) {
      const txSnap = await getDocs(collection(db, `members/${m.id}/transactions`));
      const txBillIds = new Set(txSnap.docs.map(d => d.data().billId).filter(Boolean));

      const linkedBills = allBills.filter(b => (b.members || []).some(bm => bm.id === m.id));
      
      if (linkedBills.length > 0) {
        membersWithBills++;
      } else {
        membersWithoutBills++;
      }

      // Check if any linked bill is not in transactions
      const uncredited = linkedBills.filter(b => !txBillIds.has(b.id));
      if (uncredited.length > 0) {
        membersWithUnlinkedTransactions.push({
          member: m.name,
          username: m.username,
          uncreditedBills: uncredited.map(b => ({ id: b.id, amount: b.totalAmount, date: b.timestamp }))
        });
      }

      // Check if they have guest bills matching their phone or name
      const cleanPhone = (m.phone || '').replace(/\D/g, '').slice(-10);
      const mName = (m.name || '').trim().toLowerCase();

      if (cleanPhone.length >= 10 || mName.length > 3) {
        const matchingGuestBills = allBills.filter(b => {
          if (linkedBills.some(lb => lb.id === b.id)) return false;
          return (b.members || []).some(bm => {
            const bPhone = (bm.phone || '').replace(/\D/g, '').slice(-10);
            const bName = (bm.name || '').trim().toLowerCase();
            if (cleanPhone.length >= 10 && bPhone === cleanPhone) return true;
            if (mName.length > 3 && bName === mName && (bm.id.startsWith('guest-') || !bm.id)) return true;
            return false;
          });
        });

        if (matchingGuestBills.length > 0) {
          membersWithPossibleGuestBills.push({
            member: m.name,
            username: m.username,
            phone: m.phone,
            joinDate: m.joinDate,
            guestBills: matchingGuestBills.map(b => ({
              id: b.id,
              date: b.timestamp,
              amount: b.totalAmount,
              station: b.stationName,
              membersOnBill: (b.members || []).map(x => ({ id: x.id, name: x.name, phone: x.phone }))
            }))
          });
        }
      }
    }

    console.log(`Members who have paid linked bills: ${membersWithBills}`);
    console.log(`Members with no linked bills: ${membersWithoutBills}`);
    console.log(`Members with linked bills missing from their profile: ${membersWithUnlinkedTransactions.length}`);
    if (membersWithUnlinkedTransactions.length > 0) {
      console.log(JSON.stringify(membersWithUnlinkedTransactions, null, 2));
    }
    console.log(`Members with possible guest/unlinked bills by phone/name: ${membersWithPossibleGuestBills.length}`);
    if (membersWithPossibleGuestBills.length > 0) {
      console.log(JSON.stringify(membersWithPossibleGuestBills, null, 2));
    }

  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}

summarize();
