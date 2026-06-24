const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, signOut } = require('firebase/auth');
const { getFirestore, collection, getDocs, doc, setDoc } = require('firebase/firestore');

// Use the museview config
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

async function migrate() {
    console.log("Fetching employees...");
    const snap = await getDocs(collection(db, 'employees'));
    const employees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`Found ${employees.length} employees.`);

    for (const emp of employees) {
        if (!emp.username || !emp.pin) {
            console.log(`Skipping employee ${emp.id} due to missing username or pin.`);
            continue;
        }

        const email = `${emp.username.toLowerCase()}@8bitbistro.local`;
        const password = `${emp.pin}-8bit`;

        try {
            console.log(`Creating auth user for ${email}...`);
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            const uid = userCred.user.uid;

            console.log(`Creating userRoles document for ${uid}...`);
            await setDoc(doc(db, 'userRoles', uid), {
                role: emp.role || 'staff',
                username: emp.username,
                employeeId: emp.id
            });

            await signOut(auth);
            console.log(`Successfully migrated ${emp.username}.`);
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') {
                console.log(`User ${email} already exists. Skipping.`);
            } else {
                console.error(`Failed to migrate ${emp.username}:`, error.message);
            }
        }
    }

    console.log("Migration complete. Exiting...");
    process.exit(0);
}

migrate().catch(console.error);
