"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getState, type StateResponse, ApiError, DEFAULT_DEVICE_ID } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useActiveDevice } from "@/lib/device-context";

/**
 * Polls GET /api/state for the active device.
 * Shared by the overview, device and alerts screens.
 */
export function useDeviceState(intervalMs = 3000, overrideDeviceId?: string) {
  const { deviceId: contextDeviceId } = useActiveDevice();
  const targetId = overrideDeviceId || contextDeviceId || DEFAULT_DEVICE_ID;

  const [data, setData] = useState<StateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { signOut } = useAuth();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await getState(targetId);
      setData(res);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut();
        return;
      }
      setError(err instanceof Error ? err.message : "Could not reach the backend");
    }
  }, [targetId, signOut]);

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, intervalMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh, intervalMs]);

  return { data, error, refresh, deviceId: targetId };
}
