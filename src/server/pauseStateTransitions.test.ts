import { describe, expect, test } from "bun:test";
import {
  decidePauseStateTransition,
  expectedParityForPauseInsert,
  pausedFromToggleCount,
} from "@/server/pauseStateTransitions";

describe("pauseStateTransitions", () => {
  test("decidePauseStateTransition is idempotent when already desired", () => {
    expect(decidePauseStateTransition(true, true)).toEqual({
      kind: "idempotent",
    });
    expect(decidePauseStateTransition(false, false)).toEqual({
      kind: "idempotent",
    });
  });

  test("decidePauseStateTransition applies when state differs", () => {
    expect(decidePauseStateTransition(false, true)).toEqual({ kind: "apply" });
    expect(decidePauseStateTransition(true, false)).toEqual({ kind: "apply" });
  });

  test("expectedParityForPauseInsert matches odd/even pause semantics", () => {
    expect(expectedParityForPauseInsert(true)).toBe(0);
    expect(expectedParityForPauseInsert(false)).toBe(1);
  });

  test("pausedFromToggleCount uses odd/even parity", () => {
    expect(pausedFromToggleCount(0)).toBe(false);
    expect(pausedFromToggleCount(1)).toBe(true);
    expect(pausedFromToggleCount(2)).toBe(false);
  });
});
