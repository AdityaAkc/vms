"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ServiceError } from "../services/core";

/**
 * Wraps an async service call with a pending flag and consistent error
 * toasts. Returns `undefined` when the call failed.
 */
export function useAction<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  opts: { success?: string | ((r: R) => string); silentCodes?: string[] } = {},
) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ServiceError | null>(null);

  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setPending(true);
      setError(null);
      try {
        const result = await fn(...args);
        if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(result) : opts.success);
        return result;
      } catch (e) {
        const err = e instanceof ServiceError ? e : new ServiceError("Something went wrong. Please try again.", "unknown");
        if (!(e instanceof ServiceError)) console.error(e);
        setError(err);
        if (!opts.silentCodes?.includes(err.code)) toast.error(err.message);
        return undefined;
      } finally {
        setPending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn],
  );

  return { run, pending, error, clearError: () => setError(null) };
}
