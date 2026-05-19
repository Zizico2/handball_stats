// TODO: remove this
// import { useState } from "react";
// import { useStopwatch } from "react-timer-hook";
// import type { useStopwatchSettingsType } from "react-timer-hook/dist/types/src/useStopwatch";

// // The shape of our local storage payload
// interface StopwatchStorageState {
//   isRunning: boolean;
//   accumulatedMs: number;
//   lastStartTime: number;
// }

// // Infer the exact return type from the library
// type OriginalStopwatchResult = ReturnType<typeof useStopwatch>;

// // Extend the original return type to override the control functions
// export interface PersistentStopwatchResult
//   extends Omit<OriginalStopwatchResult, "start" | "pause" | "reset"> {
//   start: () => void;
//   pause: () => void;
//   reset: (offset: Date, autoStart?: boolean) => void;
// }

// export interface UsePersistentStopwatchOptions
//   extends useStopwatchSettingsType {
//   storageKey?: string;
// }

// export function usePersistentStopwatch(
//   options: UsePersistentStopwatchOptions = {},
// ): PersistentStopwatchResult {
//   const { storageKey = "persistentStopwatch" } = options;

//   // 1. Calculate the starting offset and state on the first render
//   const [initialState] = useState<{
//     autoStart: boolean;
//     offsetTimestamp: Date;
//   }>(() => {
//     if (typeof window === "undefined") {
//       return { autoStart: false, offsetTimestamp: new Date() };
//     }

//     const savedState = localStorage.getItem(storageKey);

//     if (savedState) {
//       try {
//         const parsed: StopwatchStorageState = JSON.parse(savedState);
//         let totalElapsed = parsed.accumulatedMs;

//         // If it was left running, add the time that passed while the page was closed/refreshing
//         if (parsed.isRunning) {
//           totalElapsed += Date.now() - parsed.lastStartTime;
//         }

//         // react-timer-hook uses a future Date object to offset the start time
//         const offsetDate = new Date(Date.now() + totalElapsed);

//         return { autoStart: parsed.isRunning, offsetTimestamp: offsetDate };
//       } catch (error) {
//         console.error("Failed to parse stopwatch state", error);
//       }
//     }

//     return { autoStart: false, offsetTimestamp: new Date() };
//   });

//   // 2. Initialize react-timer-hook
//   const stopwatch = useStopwatch({
//     autoStart: initialState.autoStart,
//     offsetTimestamp: initialState.offsetTimestamp,
//   });

//   // 3. Helper to get the current storage state safely
//   const getStorageState = (): StopwatchStorageState => {
//     if (typeof window !== "undefined") {
//       const saved = localStorage.getItem(storageKey);
//       if (saved) {
//         try {
//           return JSON.parse(saved);
//         } catch {
//           /* ignore */
//         }
//       }
//     }
//     return { isRunning: false, accumulatedMs: 0, lastStartTime: Date.now() };
//   };

//   // 4. Overridden actions that sync to localStorage
//   const startStopwatch = (): void => {
//     if (typeof window !== "undefined") {
//       const currentState = getStorageState();
//       const newState: StopwatchStorageState = {
//         isRunning: true,
//         accumulatedMs: currentState.accumulatedMs, // Keep previously accumulated time
//         lastStartTime: Date.now(),
//       };
//       localStorage.setItem(storageKey, JSON.stringify(newState));
//     }
//     stopwatch.start();
//   };

//   const pauseStopwatch = (): void => {
//     if (typeof window !== "undefined") {
//       const currentState = getStorageState();
//       let newAccumulated = currentState.accumulatedMs;

//       // Calculate how much time passed since the last start
//       if (currentState.isRunning) {
//         newAccumulated += Date.now() - currentState.lastStartTime;
//       }

//       const newState: StopwatchStorageState = {
//         isRunning: false,
//         accumulatedMs: newAccumulated,
//         lastStartTime: Date.now(),
//       };
//       localStorage.setItem(storageKey, JSON.stringify(newState));
//     }
//     stopwatch.pause();
//   };

//   const resetStopwatch = (offset: Date, autoStart: boolean = false): void => {
//     if (typeof window !== "undefined") {
//       const offsetMs = offset.getTime() - Date.now();
//       const newState: StopwatchStorageState = {
//         isRunning: autoStart,
//         accumulatedMs: Math.max(0, offsetMs),
//         lastStartTime: Date.now(),
//       };
//       localStorage.setItem(storageKey, JSON.stringify(newState));
//     }
//     stopwatch.reset(offset, autoStart);
//   };

//   return {
//     ...stopwatch,
//     start: startStopwatch,
//     pause: pauseStopwatch,
//     reset: resetStopwatch,
//   };
// }
