"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { acknowledgeEvent, getEvents, ApiError, type EventRow } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

/**
 * Polls GET /api/events (newest page) and can page further back with `loadMore`.
 * Shared by the overview, alerts and history screens.
 */
export function useEvents({ limit = 50, intervalMs = 5000 }: { limit?: number; intervalMs?: number } = {}) {
  const [latest, setLatest] = useState<EventRow[]>([]);
  const [older, setOlder] = useState<EventRow[]>([]);
  const [exhausted, setExhausted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signOut } = useAuth();

  const fail = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        signOut();
        return;
      }
      setError(err instanceof Error ? err.message : "Could not reach the backend");
    },
    [signOut]
  );

  const refresh = useCallback(async () => {
    try {
      const res = await getEvents({ limit });
      setLatest(res.events);
      setLoaded(true);
      setError(null);
    } catch (err) {
      fail(err);
    }
  }, [limit, fail]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, intervalMs);
    return () => clearInterval(t);
  }, [refresh, intervalMs]);

  // Newest page + older pages, de-duplicated (the newest page can overlap older ones as new events arrive).
  const events = useMemo(() => {
    const byId = new Map<number, EventRow>();
    for (const e of [...older, ...latest]) byId.set(e.event_id, e);
    return Array.from(byId.values()).sort((a, b) => b.event_id - a.event_id);
  }, [latest, older]);

  const hasMore = !exhausted && latest.length >= limit;

  const loadMore = useCallback(async () => {
    const last = events[events.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const res = await getEvents({ limit, beforeId: last.event_id });
      setOlder((prev) => [...prev, ...res.events]);
      if (res.events.length < limit) setExhausted(true);
    } catch (err) {
      fail(err);
    } finally {
      setLoadingMore(false);
    }
  }, [events, limit, fail]);

  /** Marks an alert acknowledged. The event is never removed - only its acknowledged state changes. */
  const acknowledge = useCallback(async (eventId: number) => {
    const row = await acknowledgeEvent(eventId);
    const patch = (list: EventRow[]) => list.map((e) => (e.event_id === row.event_id ? row : e));
    setLatest(patch);
    setOlder(patch);
    return row;
  }, []);

  return { events, loaded, error, hasMore, loadingMore, loadMore, refresh, acknowledge };
}
