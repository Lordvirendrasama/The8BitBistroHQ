const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, updatePassword } = require('firebase/auth');
const { getFirestore, collection, getDocs, query, where, doc, updateDoc } = require('firebase/firestore');

const firebaseConfig = {
  "projectId": "museview-gag3p",
  "appId": "1:529984145400:web:1fef8c161e5b2ca229b80d",
  "apiKey": "AIzaSyCmN6MkteozF-6OCk8OJ8Pk_J42-pkGUZg",
  "authDomain": "museview-gag3p.firebaseapp.com",
  "storageBucket": "museview-gag3p.firebasestorage.app",
  "messagingSenderId": "529984145400"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const args = process.argv.slice(2);
if (args.length < 3) {
  console.log("Usage: node scripts/change-pin.js <username> <old-pin> <new-pin>");
  process.exit(1);
}

const username = args[0].toLowerCase();
const oldPin = args[1];
const newPin = args[2];

async function run() {
  const email = `${username}@8bitbistro.local`;
  const oldPassword = `${oldPin}-8bit`;
  const newPassword = `${newPin}-8bit`;

  try {
    console.log(`Logging in as ${email}...`);
    await signInWithEmailAndPassword(auth, email, oldPassword);
    
    console.log(`Updating password to new PIN...`);
    await updatePassword(auth.currentUser, newPassword);

    console.log(`Updating employee profile pin in Firestore...`);
    const snap = await getDocs(query(collection(db, 'employees'), where('username', '==', username)));
    if (snap.empty) {
      // Try with capitalized username
      const capSnap = await getDocs(query(collection(db, 'employees'), where('username', '==', args[0])));
      for (const d of capSnap.docs) {
        await updateDoc(doc(db, 'employees', d.id), { pin: newPin });
      }
    } else {
      for (const d of snap.docs) {
        await updateDoc(doc(db, 'employees', d.id), { pin: newPin });
      }
    }

    console.log(`PIN successfully updated in Auth and Firestore to ${newPin}!`);
    process.exit(0);
  } catch (err) {
    console.error("Error updating credentials:", err.message);
    process.exit(1);
  }
}

run();
