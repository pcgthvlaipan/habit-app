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
  apiKey: "YOUR_API_KEY", // e.g. "AIzaSy..."
  authDomain: "habit-app-tam", // e.g. "habit-app-tam.firebaseapp.com"
  projectId: "YOUR_PROJECT_ID", // e.g. "habit-app-tam"
  storageBucket: "YOUR_STORAGE_BUCKET", // e.g. "habit-app-tam.appspot.com"
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // e.g. "123456789"
  appId: "YOUR_APP_ID", // e.g. "1:123456789:web:abc..."
};

// Initialize Firebase (singleton — safe to import anywhere in the app)
const app = initializeApp(firebaseConfig);

// Export the Firestore database instance used by habitService.js
export const db = getFirestore(app);
