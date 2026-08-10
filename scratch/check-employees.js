const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  "projectId": "museview-gag3p",
  "appId": "1:529984145400:web:1fef8c161e5b2ca229b80d",
  "apiKey": "AIzaSyCmN6MkteozF-6OCk8OJ8Pk_J42-pkGUZg",
  "authDomain": "museview-gag3p.firebaseapp.com",
  "storageBucket": "museview-gag3p.firebasestorage.app",
  "messagingSenderId": "529984145400"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("=== EMPLOYEES ===");
  const empSnap = await getDocs(collection(db, 'employees'));
  empSnap.forEach(doc => {
    console.log(doc.id, "=>", doc.data());
  });

  console.log("\n=== USER ROLES ===");
  const roleSnap = await getDocs(collection(db, 'userRoles'));
  roleSnap.forEach(doc => {
    console.log(doc.id, "=>", doc.data());
  });
}

run().catch(console.error);
