"use client";
import { useMemo, useRef, useState } from "react";
import { CheckCheck, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import Card from "@/components/ui/Card";
import { notify } from "@/components/ui/Toast";
import { usePageEntrance } from "@/lib/entrance";
import { isAlert } from "@/lib/suraksha";
import PageHeader from "@/components/suraksha/PageHeader";
import FilterChips from "@/components/suraksha/FilterChips";
import EventItem from "@/components/suraksha/EventItem";
import DeviceSelector from "@/components/suraksha/DeviceSelector";
import { useEvents } from "@/components/suraksha/useEvents";

type Tab = "active" | "acknowledged";

export default function AlertsView() {
  const ref = useRef<HTMLDivElement>(null);
  usePageEntrance(ref);

  const { events, loaded, error, acknowledge, deviceId } = useEvents({ limit: 200, intervalMs: 4000 });
  const [tab, setTab] = useState<Tab>("active");
  const [busy, setBusy] = useState(false);

  const alerts = useMemo(() => events.filter(isAlert), [events]);
  const active = useMemo(() => alerts.filter((e) => !e.acknowledged), [alerts]);
  const done = useMemo(() => alerts.filter((e) => e.acknowledged), [alerts]);
  const list = tab === "active" ? active : done;

  async function ack(id: number) {
    setBusy(true);
    try {
      await acknowledge(id);
      notify({ title: "Alert acknowledged", description: "It stays in the event history.", type: "success" });
    } catch (err) {
      notify({ title: "Could not acknowledge", description: err instanceof Error ? err.message : "Backend unreachable", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function ackAll() {
    setBusy(true);
    try {
      for (const e of active) await acknowledge(e.event_id);
      notify({ title: `${active.length} alerts acknowledged`, description: "They stay in the event history.", type: "success" });
    } catch (err) {
      notify({ title: "Stopped part-way", description: err instanceof Error ? err.message : "Backend unreachable", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} data-page className="absolute inset-0 overflow-y-auto overflow-x-hidden">
      <div className="relative flex min-h-full w-full flex-col gap-[20px]" style={{ padding: "24px 32px 32px 110px" }}>
        <PageHeader
          title="Security Alerts"
          subtitle={`Warnings and alarms reported by ${deviceId}. Acknowledging marks an alert as resolved without deleting it.`}
        >
          <DeviceSelector />
          {active.length > 1 && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              disabled={busy}
              onClick={ackAll}
              className="flex h-[32px] items-center gap-[6px] rounded-full bg-forest-2 px-[16px] text-[11px] font-medium text-white shadow-sm disabled:opacity-60 dark:bg-mint dark:text-forest"
            >
              <CheckCheck size={13} /> Acknowledge all ({active.length})
            </motion.button>
          )}
        </PageHeader>

        <div data-fill>
          <FilterChips<Tab>
            id="alerts-tab"
            value={tab}
            onChange={setTab}
            options={[
              { value: "active", label: "Active", count: active.length },
              { value: "acknowledged", label: "Acknowledged", count: done.length },
            ]}
          />
        </div>

        {error && (
          <p className="rounded-[12px] bg-red-100 px-[14px] py-[8px] text-[11px] text-red-600 dark:bg-red-500/20 dark:text-red-400">
            Can&apos;t reach the backend ({error}). The list below may be out of date.
          </p>
        )}

        <Card className="p-[16px]">
          {list.length === 0 ? (
            <div data-fill className="flex items-center gap-[12px] px-[6px] py-[16px]">
              <span className="flex h-[40px] w-[40px] items-center justify-center rounded-[12px] bg-mint-2/70 text-mint-4 dark:bg-mint-3/20 dark:text-mint">
                <ShieldCheck size={20} />
              </span>
              <div>
                <p className="text-[13px] font-medium text-ink">
                  {!loaded ? "Loading alerts..." : tab === "active" ? "No active alerts" : "No acknowledged alerts yet"}
                </p>
                <p className="text-[10.5px] text-muted">
                  {tab === "active"
                    ? `Door openings while armed or repeated knocks on ${deviceId} will trigger an alert.`
                    : "Acknowledged alarms and warnings will remain archived here."}
                </p>
              </div>
            </div>
          ) : (
            list.map((e) => <EventItem key={e.event_id} event={e} onAck={ack} busy={busy} />)
          )}
        </Card>
      </div>
    </div>
  );
}
