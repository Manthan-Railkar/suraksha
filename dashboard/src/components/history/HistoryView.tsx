"use client";
import { useMemo, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import { notify } from "@/components/ui/Toast";
import { usePageEntrance } from "@/lib/entrance";
import { HISTORY_FILTERS, matchesFilter, type HistoryFilter } from "@/lib/suraksha";
import PageHeader from "@/components/suraksha/PageHeader";
import FilterChips from "@/components/suraksha/FilterChips";
import EventItem from "@/components/suraksha/EventItem";
import { useEvents } from "@/components/suraksha/useEvents";

export default function HistoryView() {
  const ref = useRef<HTMLDivElement>(null);
  usePageEntrance(ref);

  const { events, loaded, error, hasMore, loadingMore, loadMore, acknowledge } = useEvents({ limit: 50 });
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [busy, setBusy] = useState(false);

  const shown = useMemo(() => events.filter((e) => matchesFilter(e, filter)), [events, filter]);
  const options = useMemo(
    () => HISTORY_FILTERS.map((f) => ({ ...f, count: events.filter((e) => matchesFilter(e, f.value)).length })),
    [events]
  );

  async function ack(id: number) {
    setBusy(true);
    try {
      await acknowledge(id);
      notify({ title: "Alert acknowledged", description: "The event stays in history.", type: "success" });
    } catch (err) {
      notify({ title: "Could not acknowledge", description: err instanceof Error ? err.message : "Backend unreachable", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} data-page className="absolute inset-0 overflow-y-auto overflow-x-hidden">
      <div className="relative flex min-h-full w-full flex-col gap-[20px]" style={{ padding: "24px 32px 32px 110px" }}>
        <PageHeader
          title="Event History"
          subtitle="Every event the device has reported, newest first. Times are when the backend received them."
        />

        <div data-fill>
          <FilterChips<HistoryFilter> id="history-filter" value={filter} onChange={setFilter} options={options} />
        </div>

        {error && (
          <p className="rounded-[12px] bg-red-100 px-[14px] py-[8px] text-[11px] text-red-600 dark:bg-red-500/20 dark:text-red-400">
            Can&apos;t reach the backend ({error}). The list below may be out of date.
          </p>
        )}

        <Card className="p-[16px]">
          {shown.length === 0 ? (
            <p data-fill className="px-[6px] py-[18px] text-[11px] text-muted">
              {!loaded ? "Loading events..." : events.length === 0 ? "No events recorded yet." : "No loaded events match this filter."}
            </p>
          ) : (
            shown.map((e) => <EventItem key={e.event_id} event={e} onAck={ack} busy={busy} />)
          )}

          {hasMore && (
            <div className="flex justify-center pt-[10px]">
              <button
                disabled={loadingMore}
                onClick={loadMore}
                className="h-[32px] rounded-full bg-black/[.05] px-[18px] text-[11px] font-medium text-ink transition-colors hover:bg-black/[.08] disabled:opacity-60 dark:bg-white/[.08] dark:hover:bg-white/[.12]"
              >
                {loadingMore ? "Loading..." : "Load older events"}
              </button>
            </div>
          )}
        </Card>

        <p data-fill className="text-[10px] text-muted">
          Showing {shown.length} of {events.length} loaded events. Acknowledging an alert never removes it from this list.
        </p>
      </div>
    </div>
  );
}
