import { atom } from "jotai";

export type MatchStatus = "firstHalf" | "halftime" | "secondHalf";

interface InGameControlActions {
  onClearGame: () => void;
  onStartFirstHalf: () => void;
  onStartSecondHalf: () => void;
  onStartHalftime: () => void;
  onTogglePause: () => void;
}

export interface InGameControlsState extends InGameControlActions {
  matchStatus: MatchStatus | null;
  isRunning: boolean;
  disableStartFirstHalf: boolean;
  disableStartSecondHalf: boolean;
}

const noop = () => {};

export const initialInGameControlsState: InGameControlsState = {
  matchStatus: null,
  isRunning: false,
  disableStartFirstHalf: true,
  disableStartSecondHalf: true,
  onClearGame: noop,
  onStartFirstHalf: noop,
  onStartSecondHalf: noop,
  onStartHalftime: noop,
  onTogglePause: noop,
};

export const inGameControlsAtom = atom<InGameControlsState>(
  initialInGameControlsState,
);
