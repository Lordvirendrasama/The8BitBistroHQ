import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, updatePassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

const firebaseConfig = {
  "projectId": "museview-gag3p",
  "appId": "1:529984145400:web:1fef8c161e5b2ca229b80d",
  "apiKey": "AIzaSyCmN6MkteozF-6OCk8OJ8Pk_J42-pkGUZg",
  "authDomain": "museview-gag3p.firebaseapp.com",
  "storageBucket": "museview-gag3p.firebasestorage.app",
  "messagingSenderId": "529984145400"
};

async function testSecondaryAuth() {
  const tempAppName = `test-app-${Date.now()}`;
  const tempApp = initializeApp(firebaseConfig, tempAppName);
  const tempAuth = getAuth(tempApp);

  const testUser = "testemp_" + Math.floor(Math.random()*1000);
  const email = `${testUser}@8bitbistro.local`;
  const initialPin = "1111";
  const newPin = "2222";

  console.log(`1. Creating user ${email} with PIN ${initialPin}...`);
  const cred = await createUserWithEmailAndPassword(tempAuth, email, `${initialPin}-8bit`);
  console.log("Created UID:", cred.user.uid);

  console.log(`2. Updating PIN to ${newPin}...`);
  await updatePassword(cred.user, `${newPin}-8bit`);
  console.log("Password updated!");

  await signOut(tempAuth);
  await deleteApp(tempApp);

  console.log(`3. Testing login with new PIN ${newPin} on a fresh auth instance...`);
  const checkApp = initializeApp(firebaseConfig, `check-app-${Date.now()}`);
  const checkAuth = getAuth(checkApp);
  const loginRes = await signInWithEmailAndPassword(checkAuth, email, `${newPin}-8bit`);
  console.log("Login successful! UID matches:", loginRes.user.uid === cred.user.uid);

  await signOut(checkAuth);
  await deleteApp(checkApp);
}

testSecondaryAuth().catch(console.error);
