import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined) ?? "",
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) ?? "",
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) ?? "",
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined) ?? "",
  messagingSenderId:
    (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) ?? "",
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined) ?? "",
};

const missingFirebaseKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingFirebaseKeys.length > 0) {
  console.warn(
    `[firebase] Missing config values: ${missingFirebaseKeys.join(", ")}. ` +
      "Set the VITE_FIREBASE_* variables in .env for hosted multiplayer."
  );
}

export const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
