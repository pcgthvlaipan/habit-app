// ─────────────────────────────────────────────────────────────────────────────
// src/firebase/firebaseConfig.js
//
// 🔑 HOW TO GET YOUR KEYS:
//    1. Go to https://console.firebase.google.com/
//    2. Select your project (or create one)
//    3. Click the gear icon → "Project settings"
//    4. Scroll to "Your apps" → click your web app (or add one)
//    5. Copy the firebaseConfig object shown there
//    6. Paste the values below, replacing each "YOUR_..." placeholder
//
// ⚠️  Never commit this file to a public Git repo with real keys.
//     Use environment variables (REACT_APP_*) for production.
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 🔑 Replace every value below with your actual Firebase project credentials
const firebaseConfig = {
  apiKey: "AIzaSyCcsD8hnpCD4ntSEkGJgEejD-WEqei5BEo",
  authDomain: "habit-app-by-tam.firebaseapp.com",
  projectId: "habit-app-by-tam",
  storageBucket: "habit-app-by-tam.firebasestorage.app",
  messagingSenderId: "14572483488",
  appId: "1:14572483488:web:554382611a410eb2eeeac5"
};

// Initialize Firebase (singleton — safe to import anywhere in the app)
const app = initializeApp(firebaseConfig);

// Export the Firestore database instance used by habitService.js
export const db = getFirestore(app);
