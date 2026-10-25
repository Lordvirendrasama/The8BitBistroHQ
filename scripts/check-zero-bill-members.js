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

const zeroBillUsernames = [
  "rahulud_2413",
  "ranbeer_2250",
  "maazmemon_7139",
  "zaidsayyed_9845",
  "anshumankushwaha_3409",
  "9307623688_8024",
  "ashutosh_3605",
  "abdullashaikh_7196",
  "ahmedshaikh_2056"
];

async function checkZeroBills() {
  try {
    const empSnap = await getDocs(collection(db, 'employees'));
    const employees = empSnap.docs.map(d => d.data());
    const adminEmp = employees.find(e => e.role === 'admin' || e.username === 'Viren') || employees[0];
    await signInWithEmailAndPassword(auth, `${adminEmp.username.toLowerCase()}@8bitbistro.local`, `${adminEmp.pin}-8bit`);

    const membersSnap = await getDocs(collection(db, 'members'));
    const members = membersSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(m => zeroBillUsernames.includes(m.username));

    const billsSnap = await getDocs(collection(db, 'bills'));
    const allBills = billsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`Checking ${members.length} members with zero linked bills...`);

    for (const m of members) {
      const cleanPhone = (m.phone || '').replace(/\D/g, '').slice(-10);
      const nameParts = m.name.toLowerCase().split(/\s+/).filter(p => p.length > 2);

      // Check all bills for any occurrence of phone, username, or partial name
      const matches = [];
      allBills.forEach(b => {
        const bStr = JSON.stringify(b).toLowerCase();
        let matchedReason = null;

        if (cleanPhone.length >= 10 && bStr.includes(cleanPhone)) {
          matchedReason = `Phone match (${cleanPhone})`;
        } else if (bStr.includes(m.username.toLowerCase())) {
          matchedReason = `Username match (${m.username})`;
        }

        if (matchedReason) {
          matches.push({
            billId: b.id,
            date: b.timestamp,
            station: b.stationName,
            totalAmount: b.totalAmount,
            reason: matchedReason
          });
        }
      });

      console.log(`\nMember: ${m.name} (@${m.username}, phone: ${m.phone || 'None'}, joined: ${m.joinDate?.slice(0, 10)})`);
      if (matches.length > 0) {
        console.log(`  FOUND MATCHING BILLS:`, matches);
      } else {
        console.log(`  No bills found under phone or username (just registered, never played / checked out).`);
      }
    }

  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}

checkZeroBills();
