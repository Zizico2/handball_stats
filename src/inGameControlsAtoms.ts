import { atom } from "jotai";
import type { ClientId } from "@/datamodel";

export type MatchStatus = "firstHalf" | "halftime" | "secondHalf";

export type PrimaryClockAction =
  | "start-first-half"
  | "start-halftime"
  | "start-second-half"
  | "toggle-pause"
  | null;

interface ActiveGameControlActions {
  onEndMatch: () => Promise<boolean>;
  onStartFirstHalf: () => void;
  onStartSecondHalf: () => void;
  onStartHalftime: () => void;
  onTogglePause: () => void;
}

export interface ActiveGameControlsState extends ActiveGameControlActions {
  hasActiveGame: boolean;
  matchStatus: MatchStatus | null;
  isRunning: boolean;
  isClockMutationPending: boolean;
  disableStartFirstHalf: boolean;
  disableStartSecondHalf: boolean;
  teamName: string | null;
  gameId: ClientId | null;
  clockMinutes: number;
  clockSeconds: number;
  teamScore: number;
  opponentScore: number;
  eventCount: number;
  primaryClockAction: PrimaryClockAction;
  primaryClockActionLabel: string | null;
  primaryClockActionDisabled: boolean;
}

const noop = () => {};
const asyncNoop = async () => false;

export function resolvePrimaryClockAction(params: {
  hasActiveGame: boolean;
  matchStatus: MatchStatus | null;
  isRunning: boolean;
  isClockMutationPending: boolean;
  disableStartFirstHalf: boolean;
  disableStartSecondHalf: boolean;
}): {
  action: PrimaryClockAction;
  label: string | null;
  disabled: boolean;
} {
  const {
    hasActiveGame,
    matchStatus,
    isRunning,
    isClockMutationPending,
    disableStartFirstHalf,
    disableStartSecondHalf,
  } = params;

  if (!hasActiveGame) {
    return { action: null, label: null, disabled: true };
  }

  if (matchStatus === null) {
    return {
      action: "start-first-half",
      label: "Start first half",
      disabled: disableStartFirstHalf || isClockMutationPending,
    };
  }

  if (matchStatus === "halftime") {
    return {
      action: "start-second-half",
      label: "Start second half",
      disabled: disableStartSecondHalf || isClockMutationPending,
    };
  }

  // firstHalf / secondHalf: pause and resume stay primary; phase changes live in overflow.
  return {
    action: "toggle-pause",
    label: isRunning ? "Pause" : "Resume",
    disabled: isClockMutationPending,
  };
}

export const initialActiveGameControlsState: ActiveGameControlsState = {
  hasActiveGame: false,
  matchStatus: null,
  isRunning: false,
  isClockMutationPending: false,
  disableStartFirstHalf: true,
  disableStartSecondHalf: true,
  teamName: null,
  gameId: null,
  clockMinutes: 0,
  clockSeconds: 0,
  teamScore: 0,
  opponentScore: 0,
  eventCount: 0,
  primaryClockAction: null,
  primaryClockActionLabel: null,
  primaryClockActionDisabled: true,
  onEndMatch: asyncNoop,
  onStartFirstHalf: noop,
  onStartSecondHalf: noop,
  onStartHalftime: noop,
  onTogglePause: noop,
};

export const inGameControlsAtom = atom<ActiveGameControlsState>(
  initialActiveGameControlsState,
);
