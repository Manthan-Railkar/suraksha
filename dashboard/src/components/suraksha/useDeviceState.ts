"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getState, type StateResponse, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

/**
 * Polls GET /api/state. Shared by the overview, device and alerts screens so
 * they all agree on mode/door/connectivity without re-fetching separately.
 */
export function useDeviceState(intervalMs = 3000) {
  const [data, setData] = useState<StateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { signOut } = useAuth();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await getState();
      setData(res);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut();
        return;
      }
      setError(err instanceof Error ? err.message : "Could not reach the backend");
    }
  }, [signOut]);

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, intervalMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh, intervalMs]);

  return { data, error, refresh };
}
