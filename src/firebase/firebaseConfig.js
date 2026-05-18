import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";

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
export const auth = getAuth(app);

// ✅ Fix blank screen on iOS Safari after login
// iOS Safari can fail silently with default indexedDB persistence
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn("Auth persistence error:", err);
});
