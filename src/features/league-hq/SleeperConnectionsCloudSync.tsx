import { doc, onSnapshot, serverTimestamp, setDoc, type DocumentData } from "firebase/firestore";
import { useEffect, useRef } from "react";

import { firestore } from "../../lib/firebase";
import { isPermanentFirebaseSession } from "../../lib/authSession";
import { useFirebaseSession } from "../../lib/useFirebaseSession";
import {
  mergeSyncedSleeperLeagueConnections,
  parseSleeperLeagueConnections,
  replaceActiveSleeperLeague,
  replaceSleeperLeagueConnections,
  useSleeperLeagueConnections,
  type SleeperLeagueConnectionSummary,
} from "./sleeperConnections";

const PROFILE_VERSION = 1;

type SleeperConnectionProfile = {
  activeLeagueId: string;
  connections: SleeperLeagueConnectionSummary[];
};

function profileFingerprint(profile: SleeperConnectionProfile) {
  return JSON.stringify({
    activeLeagueId: profile.activeLeagueId,
    connections: profile.connections,
  });
}

function parseSleeperConnectionProfile(value: DocumentData | undefined): SleeperConnectionProfile {
  if (!value || Number(value.version) !== PROFILE_VERSION) {
    return { activeLeagueId: "", connections: [] };
  }
  const connections = parseSleeperLeagueConnections(String(value.connections_json ?? ""));
  const requestedActiveLeagueId = String(value.active_league_id ?? "").trim();
  return {
    connections,
    activeLeagueId: connections.some((connection) => connection.leagueId === requestedActiveLeagueId)
      ? requestedActiveLeagueId
      : connections[0]?.leagueId ?? "",
  };
}

async function writeProfile(userId: string, profile: SleeperConnectionProfile) {
  await setDoc(doc(firestore, "fantasyManagerProfiles", userId), {
    version: PROFILE_VERSION,
    user_id: userId,
    active_league_id: profile.activeLeagueId,
    connections_json: JSON.stringify(profile.connections),
    updated_at: serverTimestamp(),
  });
}

function chooseActiveLeague(
  localActiveLeagueId: string,
  remoteActiveLeagueId: string,
  connections: SleeperLeagueConnectionSummary[],
) {
  if (connections.some((connection) => connection.leagueId === localActiveLeagueId)) return localActiveLeagueId;
  if (connections.some((connection) => connection.leagueId === remoteActiveLeagueId)) return remoteActiveLeagueId;
  return connections[0]?.leagueId ?? "";
}

export function SleeperConnectionsCloudSync() {
  const session = useFirebaseSession();
  const { connections, activeLeagueId } = useSleeperLeagueConnections();
  const localProfileRef = useRef<SleeperConnectionProfile>({ connections, activeLeagueId });
  const hydratedUserIdRef = useRef("");
  const remoteFingerprintRef = useRef("");

  useEffect(() => {
    localProfileRef.current = { connections, activeLeagueId };
  }, [activeLeagueId, connections]);

  useEffect(() => {
    if (!isPermanentFirebaseSession(session)) {
      hydratedUserIdRef.current = "";
      remoteFingerprintRef.current = "";
      return;
    }

    const userId = session.user.uid;
    const reference = doc(firestore, "fantasyManagerProfiles", userId);
    let disposed = false;
    const unsubscribe = onSnapshot(reference, (snapshot) => {
      if (disposed) return;
      const remote = parseSleeperConnectionProfile(snapshot.data());
      const local = localProfileRef.current;
      const mergedConnections = mergeSyncedSleeperLeagueConnections(local.connections, remote.connections);
      const merged: SleeperConnectionProfile = {
        connections: mergedConnections,
        activeLeagueId: chooseActiveLeague(local.activeLeagueId, remote.activeLeagueId, mergedConnections),
      };
      const mergedFingerprint = profileFingerprint(merged);
      const localFingerprint = profileFingerprint(local);
      remoteFingerprintRef.current = profileFingerprint(remote);
      hydratedUserIdRef.current = userId;

      if (mergedFingerprint !== localFingerprint) {
        replaceSleeperLeagueConnections(merged.connections);
        replaceActiveSleeperLeague(merged.activeLeagueId);
      }
      if (mergedFingerprint !== remoteFingerprintRef.current) {
        void writeProfile(userId, merged)
          .then(() => {
            remoteFingerprintRef.current = mergedFingerprint;
          })
          .catch((error: unknown) => {
            console.warn("[fantasy-manager-profile] Cloud sync failed.", error);
          });
      }
    }, (error) => {
      console.warn("[fantasy-manager-profile] Cloud profile could not be read.", error);
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [session]);

  useEffect(() => {
    if (!isPermanentFirebaseSession(session) || hydratedUserIdRef.current !== session.user.uid) return;
    const profile = { connections, activeLeagueId };
    const fingerprint = profileFingerprint(profile);
    if (fingerprint === remoteFingerprintRef.current) return;
    const timeoutId = window.setTimeout(() => {
      void writeProfile(session.user.uid, profile)
        .then(() => {
          remoteFingerprintRef.current = fingerprint;
        })
        .catch((error: unknown) => {
          console.warn("[fantasy-manager-profile] Cloud sync failed.", error);
        });
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [activeLeagueId, connections, session]);

  return null;
}
