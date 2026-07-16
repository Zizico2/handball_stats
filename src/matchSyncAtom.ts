import { atom, getDefaultStore } from "jotai";

export type MatchSyncStatus = "idle" | "saving" | "saved" | "failed";

export interface MatchSyncState {
  status: MatchSyncStatus;
  message: string | null;
  retry: (() => void) | null;
}

export const initialMatchSyncState: MatchSyncState = {
  status: "idle",
  message: null,
  retry: null,
};

export const matchSyncAtom = atom<MatchSyncState>(initialMatchSyncState);

const SAVED_FLASH_MS = 1500;

let savedTimeout: ReturnType<typeof setTimeout> | null = null;

function clearSavedTimeout() {
  if (savedTimeout !== null) {
    clearTimeout(savedTimeout);
    savedTimeout = null;
  }
}

export function beginMatchSaving() {
  clearSavedTimeout();
  getDefaultStore().set(matchSyncAtom, {
    status: "saving",
    message: null,
    retry: null,
  });
}

export function markMatchSaved() {
  const store = getDefaultStore();
  clearSavedTimeout();
  store.set(matchSyncAtom, {
    status: "saved",
    message: null,
    retry: null,
  });
  savedTimeout = setTimeout(() => {
    store.set(matchSyncAtom, (prev) =>
      prev.status === "saved" ? initialMatchSyncState : prev,
    );
    savedTimeout = null;
  }, SAVED_FLASH_MS);
}

export function markMatchFailed(
  message: string,
  retry: (() => void) | null = null,
) {
  clearSavedTimeout();
  getDefaultStore().set(matchSyncAtom, {
    status: "failed",
    message,
    retry,
  });
}

export function clearMatchSync() {
  clearSavedTimeout();
  getDefaultStore().set(matchSyncAtom, initialMatchSyncState);
}
