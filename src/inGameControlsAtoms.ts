import { atom } from "jotai";

export type MatchStatus = "firstHalf" | "halftime" | "secondHalf";

interface ActiveGameControlActions {
  onEndMatch: () => void;
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
}

const noop = () => {};

export const initialActiveGameControlsState: ActiveGameControlsState = {
  hasActiveGame: false,
  matchStatus: null,
  isRunning: false,
  isClockMutationPending: false,
  disableStartFirstHalf: true,
  disableStartSecondHalf: true,
  onEndMatch: noop,
  onStartFirstHalf: noop,
  onStartSecondHalf: noop,
  onStartHalftime: noop,
  onTogglePause: noop,
};

export const inGameControlsAtom = atom<ActiveGameControlsState>(
  initialActiveGameControlsState,
);
