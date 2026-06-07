import { initializeFirebase } from '../src/firebase/init';
import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';

async function check() {
  const { db } = initializeFirebase();
  console.log("Fetching recent bills...");
  const snap = await getDocs(query(collection(db, 'bills'), orderBy('timestamp', 'desc'), limit(5)));
  snap.forEach(doc => {
      console.log(doc.id, "=>", JSON.stringify(doc.data()));
  });
  process.exit(0);
}

check().catch(console.error);
