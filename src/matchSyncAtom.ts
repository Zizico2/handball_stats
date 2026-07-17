import { atom, getDefaultStore } from "jotai";

export type MatchSyncStatus = "idle" | "saving" | "saved" | "failed";

export interface MatchSyncState {
  status: MatchSyncStatus;
  /** True only after Saving… has been delayed long enough to show in the header. */
  savingVisible: boolean;
  message: string | null;
  retry: (() => void) | null;
}

export const initialMatchSyncState: MatchSyncState = {
  status: "idle",
  savingVisible: false,
  message: null,
  retry: null,
};

export const matchSyncAtom = atom<MatchSyncState>(initialMatchSyncState);

/** Delay before the header shows Saving… (guards still flip immediately). */
export const SAVING_DELAY_MS = 300;
/** How long Saved stays visible after a slow (chip-shown) success. */
export const SAVED_FLASH_MS = 1500;

/** Whether MatchSyncStatus should render for this state. */
export function isMatchSyncChipVisible(sync: MatchSyncState): boolean {
  return (
    (sync.status === "saving" && sync.savingVisible) ||
    sync.status === "saved" ||
    sync.status === "failed"
  );
}

let savingDelayTimeout: ReturnType<typeof setTimeout> | null = null;
let savedTimeout: ReturnType<typeof setTimeout> | null = null;

function clearSavingDelayTimeout() {
  if (savingDelayTimeout !== null) {
    clearTimeout(savingDelayTimeout);
    savingDelayTimeout = null;
  }
}

function clearSavedTimeout() {
  if (savedTimeout !== null) {
    clearTimeout(savedTimeout);
    savedTimeout = null;
  }
}

function clearAllTimeouts() {
  clearSavingDelayTimeout();
  clearSavedTimeout();
}

export function beginMatchSaving() {
  clearAllTimeouts();
  getDefaultStore().set(matchSyncAtom, {
    status: "saving",
    savingVisible: false,
    message: null,
    retry: null,
  });
  savingDelayTimeout = setTimeout(() => {
    savingDelayTimeout = null;
    getDefaultStore().set(matchSyncAtom, (prev) =>
      prev.status === "saving" ? { ...prev, savingVisible: true } : prev,
    );
  }, SAVING_DELAY_MS);
}

export function markMatchSaved() {
  const store = getDefaultStore();
  const { savingVisible } = store.get(matchSyncAtom);
  clearAllTimeouts();

  if (!savingVisible) {
    store.set(matchSyncAtom, initialMatchSyncState);
    return;
  }

  store.set(matchSyncAtom, {
    status: "saved",
    savingVisible: false,
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
  clearAllTimeouts();
  getDefaultStore().set(matchSyncAtom, {
    status: "failed",
    savingVisible: false,
    message,
    retry,
  });
}

export function clearMatchSync() {
  clearAllTimeouts();
  getDefaultStore().set(matchSyncAtom, initialMatchSyncState);
}
