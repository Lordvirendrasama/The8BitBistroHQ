const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = { projectId: 'demo-bistro-os' };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const querySnapshot = await getDocs(collection(db, 'stations'));
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.status === 'in-use') {
      console.log(`Station: ${data.name}`);
      console.log(`StartTime: ${data.startTime}`);
      console.log(`EndTime: ${data.endTime}`);
      console.log(`Package: ${data.packageName}`);
      console.log('---');
    }
  });
}
check().catch(console.error);
