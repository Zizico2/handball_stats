import { atom } from "jotai";

export type MatchStatus = "firstHalf" | "halftime" | "secondHalf";

interface InGameControlActions {
  onEndMatch: () => void;
  onStartFirstHalf: () => void;
  onStartSecondHalf: () => void;
  onStartHalftime: () => void;
  onTogglePause: () => void;
}

export interface InGameControlsState extends InGameControlActions {
  hasActiveGame: boolean;
  matchStatus: MatchStatus | null;
  isRunning: boolean;
  disableStartFirstHalf: boolean;
  disableStartSecondHalf: boolean;
}

const noop = () => {};

export const initialInGameControlsState: InGameControlsState = {
  hasActiveGame: false,
  matchStatus: null,
  isRunning: false,
  disableStartFirstHalf: true,
  disableStartSecondHalf: true,
  onEndMatch: noop,
  onStartFirstHalf: noop,
  onStartSecondHalf: noop,
  onStartHalftime: noop,
  onTogglePause: noop,
};

export const inGameControlsAtom = atom<InGameControlsState>(
  initialInGameControlsState,
);
