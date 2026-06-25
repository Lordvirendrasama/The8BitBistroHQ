const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, getDocs, writeBatch } = require('firebase/firestore');

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

async function migrateTasks() {
  try {
    console.log("Fetching employees to authenticate...");
    const empSnap = await getDocs(collection(db, 'employees'));
    const employees = empSnap.docs.map(d => d.data());
    
    // Find an employee (preferably admin or Viren)
    const adminEmp = employees.find(e => e.role === 'admin' || e.username === 'Viren') || employees[0];
    if (!adminEmp) {
      throw new Error("No employees found to authenticate with.");
    }
    
    const email = `${adminEmp.username.toLowerCase()}@8bitbistro.local`;
    const password = `${adminEmp.pin}-8bit`;
    console.log(`Authenticating as ${email}...`);
    
    await signInWithEmailAndPassword(auth, email, password);
    console.log("Authentication successful.");

    console.log("Migrating tasks in museview-gag3p...");
    const tasksSnapshot = await getDocs(collection(db, 'tasks'));
    console.log(`Found ${tasksSnapshot.size} tasks to process.`);

    if (tasksSnapshot.size === 0) {
      console.log("No tasks found to migrate.");
      process.exit(0);
    }

    const batch = writeBatch(db);
    let migratedCount = 0;

    tasksSnapshot.docs.forEach(taskDoc => {
      const taskData = taskDoc.data();
      const currentType = taskData.type;
      let newShiftType = 'both';

      if (currentType === 'start-of-day') {
        newShiftType = 'opening';
      } else if (currentType === 'end-of-day') {
        newShiftType = 'closing';
      }

      console.log(`Task "${taskData.name}": converting type "${currentType}" -> shift_type "${newShiftType}"`);
      batch.update(taskDoc.ref, {
        shift_type: newShiftType
      });
      migratedCount++;
    });

    await batch.commit();
    console.log(`Successfully migrated ${migratedCount} tasks.`);
  } catch (error) {
    console.error("Error during migration:", error);
  }
  process.exit(0);
}

migrateTasks();
