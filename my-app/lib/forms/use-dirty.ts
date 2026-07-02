"use client";

import { useCallback, useReducer, useRef, useState } from "react";

/**
 * Structural equality for the plain data shapes used by our settings/edit
 * forms (primitives, arrays, and plain objects). Used to tell whether a form
 * still matches the values it was loaded with.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  ) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (k) => Object.hasOwn(bObj, k) && deepEqual(aObj[k], bObj[k]),
  );
}

/**
 * Form state that knows whether it differs from the last loaded/saved baseline.
 *
 * - `value` / `setValue` behave like `useState`.
 * - `load(next)` adopts freshly fetched data as the clean baseline.
 * - `markClean()` snapshots the current value as the new baseline (after save).
 * - `markFilesDirty()` flags out-of-band changes (e.g. a staged file upload)
 *   that aren't part of `value`.
 * - `dirty` is true when the form differs from the baseline or files changed.
 */
export function useDirtyState<T>(initial: T) {
  const [value, setValue] = useState<T>(initial);
  const baselineRef = useRef<T>(initial);
  const [filesDirty, setFilesDirty] = useState(false);
  const [, force] = useReducer((c: number) => c + 1, 0);

  const load = useCallback((next: T) => {
    baselineRef.current = next;
    setValue(next);
    setFilesDirty(false);
    force();
  }, []);

  const markClean = useCallback(() => {
    setValue((cur) => {
      baselineRef.current = cur;
      return cur;
    });
    setFilesDirty(false);
    force();
  }, []);

  const markFilesDirty = useCallback(() => setFilesDirty(true), []);

  const dirty = filesDirty || !deepEqual(value, baselineRef.current);

  return { value, setValue, load, markClean, dirty, markFilesDirty };
}
