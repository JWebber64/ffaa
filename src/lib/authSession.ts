import type { AuthError, User } from "firebase/auth";
import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signOut,
} from "firebase/auth";
import { firebaseAuth } from "./firebase";

export type AppSession = {
  user: User;
  provider: string | null;
};

type SessionListener = (session: AppSession | null) => void;

let cachedSession: AppSession | null | undefined;
let readSessionPromise: Promise<AppSession | null> | null = null;
let ensureSessionPromise: Promise<AppSession | null> | null = null;
let subscriptionStarted = false;
const listeners = new Set<SessionListener>();

function toSession(user: User | null): AppSession | null {
  if (!user) return null;
  return {
    user,
    provider: user.providerData[0]?.providerId ?? (user.isAnonymous ? "anonymous" : null),
  };
}

function emitSession(session: AppSession | null) {
  cachedSession = session;
  for (const listener of listeners) {
    listener(session);
  }
}

function ensureSessionSubscription() {
  if (subscriptionStarted) return;
  subscriptionStarted = true;

  onAuthStateChanged(firebaseAuth, (user) => {
    emitSession(toSession(user));
  });
}

export function getCachedFirebaseSession() {
  return cachedSession ?? null;
}

export function subscribeToFirebaseSession(listener: SessionListener) {
  ensureSessionSubscription();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function readFirebaseSession() {
  ensureSessionSubscription();

  if (cachedSession !== undefined) {
    return cachedSession;
  }

  if (firebaseAuth.currentUser) {
    const session = toSession(firebaseAuth.currentUser);
    emitSession(session);
    return session;
  }

  if (readSessionPromise) {
    return readSessionPromise;
  }

  readSessionPromise = new Promise<AppSession | null>((resolve) => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      unsubscribe();
      const session = toSession(user);
      emitSession(session);
      resolve(session);
    });
  }).finally(() => {
    readSessionPromise = null;
  });

  return readSessionPromise;
}

export async function ensureFirebaseSession() {
  ensureSessionSubscription();

  if (ensureSessionPromise) {
    return ensureSessionPromise;
  }

  ensureSessionPromise = (async () => {
    const existingSession = firebaseAuth.currentUser
      ? toSession(firebaseAuth.currentUser)
      : cachedSession ?? null;
    if (existingSession?.user?.uid) {
      emitSession(existingSession);
      return existingSession;
    }

    const credential = await signInAnonymously(firebaseAuth);
    const session = toSession(credential.user);
    if (!session?.user?.uid) {
      throw new Error("Anonymous Firebase session missing user id");
    }

    emitSession(session);
    return session;
  })().finally(() => {
    ensureSessionPromise = null;
  });

  return ensureSessionPromise;
}

export async function ensureFirebaseUserId() {
  const session = await ensureFirebaseSession();
  const userId = session?.user?.uid ?? null;
  if (!userId) {
    throw new Error("Session missing user id");
  }
  return userId;
}

export function isPermanentFirebaseSession(session: AppSession | null): session is AppSession {
  return Boolean(session?.user.uid && !session.user.isAnonymous);
}

export async function ensurePermanentFirebaseUserId() {
  const session = await ensureFirebaseSession();
  if (!isPermanentFirebaseSession(session)) {
    throw new Error("Sign in with Google before publishing, claiming, or managing a league team.");
  }
  return session!.user.uid;
}

export async function upgradeFirebaseSessionWithGoogle() {
  const session = await ensureFirebaseSession();
  if (isPermanentFirebaseSession(session)) return session;

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    const credential = await linkWithPopup(session!.user, provider);
    const upgraded = toSession(credential.user);
    emitSession(upgraded);
    return upgraded;
  } catch (error) {
    const authError = error as AuthError;
    if (authError.code !== "auth/credential-already-in-use") throw error;
    const googleCredential = GoogleAuthProvider.credentialFromError(authError);
    if (!googleCredential) throw error;
    const credential = await signInWithCredential(firebaseAuth, googleCredential);
    const restored = toSession(credential.user);
    emitSession(restored);
    return restored;
  }
}

export async function signOutFirebaseSession() {
  await signOut(firebaseAuth);
  emitSession(null);
  return ensureFirebaseSession();
}
