const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDHN_5OdQ7Yyl7GUdzx4F8CbXbqlEzmQ2E",
  authDomain: "the-8-bit-hq-16379234-d1b08.firebaseapp.com",
  projectId: "the-8-bit-hq-16379234-d1b08",
  storageBucket: "the-8-bit-hq-16379234-d1b08.firebasestorage.app",
  messagingSenderId: "858051160002",
  appId: "1:858051160002:web:9884f4ee5d237b6ad3985b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkData() {
    try {
        console.log("Checking for data in the-8-bit-hq-16379234-d1b08...");
        const snap = await getDocs(collection(db, 'employees'));
        console.log(`Found ${snap.size} employees.`);
        if (snap.size > 0) {
            console.log("First employee:", snap.docs[0].data().username);
        }
    } catch (error) {
        console.error("Error reading database:", error.message);
    }
    process.exit(0);
}

checkData();
