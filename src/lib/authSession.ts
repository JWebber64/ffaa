import type { User } from "firebase/auth";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
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
