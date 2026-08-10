const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

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

async function run() {
  try {
    console.log("Attempting login for eshaan@8bitbistro.local...");
    const cred = await signInWithEmailAndPassword(auth, 'eshaan@8bitbistro.local', '8888-8bit');
    console.log("Login SUCCESSFUL! UID:", cred.user.uid);
  } catch (error) {
    console.error("Login FAILED:", error.code, "-", error.message);
  }
}

run().catch(console.error);
