// ═══════════════════════════════════════════════════════════════
// src/firebase/firebaseConfig.js
//
// 🔑 Your Firebase credentials are already filled in below.
//    Do NOT share this file publicly.
// ═══════════════════════════════════════════════════════════════

import { initializeApp } from "firebase/app";
import { getFirestore }  from "firebase/firestore";
import { getAuth }       from "firebase/auth";   // ← Auth added

const firebaseConfig = {
  apiKey:            "AIzaSyCcsD8hnpCD4ntSEkGJgEejD-WEqei5BEo",
  authDomain:        "habit-app-by-tam.firebaseapp.com",
  projectId:         "habit-app-by-tam",
  storageBucket:     "habit-app-by-tam.firebasestorage.app",
  messagingSenderId: "14572483488",
  appId:             "1:14572483488:web:554382611a410eb2eeeac5",
};

const app = initializeApp(firebaseConfig);

export const db   = getFirestore(app);
export const auth = getAuth(app);  // ← exported for use in habitService
