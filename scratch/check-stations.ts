import { initializeFirebase } from '../src/firebase/init';
import { collection, getDocs } from 'firebase/firestore';

async function check() {
  const { db } = initializeFirebase();
  console.log("Fetching stations...");
  const snap = await getDocs(collection(db, 'stations'));
  snap.forEach(doc => {
      console.log(doc.id, "=>", JSON.stringify(doc.data()));
  });
  process.exit(0);
}

check().catch(console.error);
