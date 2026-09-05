import { useEffect, useState } from "react";

// Provides a "current time" value that updates on a fixed interval.
// Components can use this as a render trigger for time-based UI.
export function useNow(
  isActive: boolean,
  intervalMs: number = 1000,
  offsetMs: number = 0,
  initialNowMs?: number,
): number {
  // Keep the latest current timestamp in milliseconds.
  const [nowMs, setNowMs] = useState(
    () => (initialNowMs ?? Date.now()) + offsetMs,
  );

  useEffect(() => {
    // Pause ticking entirely when not active.
    if (!isActive) {
      return;
    }

    // Update the timestamp periodically so consumers re-render.
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now() + offsetMs);
    }, intervalMs);

    // Always clear the interval when dependencies change or on unmount
    // to avoid duplicate timers and memory leaks.
    return () => {
      window.clearInterval(intervalId);
    };
  }, [intervalMs, isActive, offsetMs]);

  useEffect(() => {
    setNowMs(Date.now() + offsetMs);
  }, [offsetMs]);

  return nowMs;
}
