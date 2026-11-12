"use client";
import { useRef, useState, type ElementType } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Activity, ArrowRight, Check, DoorClosed, DoorOpen, Radio, ShieldCheck, Siren } from "lucide-react";
import Card from "@/components/ui/Card";
import { notify } from "@/components/ui/Toast";
import { usePageEntrance } from "@/lib/entrance";
import { acknowledgeEvent } from "@/lib/api";
import { agoFromSeconds, eventLabel, formatWhen, severityTone, systemLevel, timeAgo, type Tone } from "@/lib/suraksha";
import { cn } from "@/lib/cn";
import PageHeader from "@/components/suraksha/PageHeader";
import StatusPill from "@/components/suraksha/StatusPill";
import ArmControl from "@/components/suraksha/ArmControl";
import EventItem from "@/components/suraksha/EventItem";
import { useDeviceState } from "@/components/suraksha/useDeviceState";
import { useEvents } from "@/components/suraksha/useEvents";

const BANNER_NEUTRAL = "bg-white/10 dark:bg-white/10 text-[#a9cfc2] dark:text-[#a9cfc2]";

function Tile({
  icon: Icon,
  label,
  value,
  pill,
  tone,
  hint,
}: {
  icon: ElementType;
  label: string;
  value: string;
  pill: string;
  tone: Tone;
  hint: string;
}) {
  return (
    <Card className="min-w-[200px] flex-1 px-[18px] pb-[16px] pt-[16px]">
      <div data-fill className="flex items-center justify-between text-[11px] text-muted">
        <span>{label}</span>
        <Icon size={15} className="text-ink" />
      </div>
      <p data-fill className="mt-[14px] font-display text-[28px] font-medium tracking-[-0.6px] text-ink">
        {value}
      </p>
      <div data-fill className="mt-[10px] flex flex-wrap items-center gap-[8px]">
        <StatusPill label={pill} tone={tone} />
        <span className="text-[10px] text-muted">{hint}</span>
      </div>
    </Card>
  );
}

export default function OverviewView() {
  const ref = useRef<HTMLDivElement>(null);
  usePageEntrance(ref);

  const { data, error, refresh } = useDeviceState();
  const { events: recent, loaded: recentLoaded, refresh: refreshEvents } = useEvents({ limit: 6 });
  const [acking, setAcking] = useState(false);

  const device = data?.device ?? null;
  const state = data?.state ?? null;
  const online = !!device?.is_online;
  const level = systemLevel(data);
  const alert = data?.latest_alert ?? null;
  const serverTime = data?.server_time;
  // If the device is offline the numbers below are the last thing it told us - say so.
  const stale = !!device && !online;

  async function ack(id: number) {
    setAcking(true);
    try {
      await acknowledgeEvent(id);
      notify({ title: "Alert acknowledged", description: "It stays in the event history.", type: "success" });
      refresh();
      refreshEvents();
    } catch (err) {
      notify({ title: "Could not acknowledge", description: err instanceof Error ? err.message : "Backend unreachable", type: "error" });
    } finally {
      setAcking(false);
    }
  }

  const doorOpen = state?.door_state === "OPEN";
  const vibTriggered = state?.vibration_state === "TRIGGERED";

  let headline = "Connecting to backend...";
  let subline = "Fetching the latest report from your device.";
  if (data && !device) {
    headline = "Waiting for the device";
    subline = "No report has arrived yet. Power the ESP32 and check its Wi-Fi and token settings.";
  } else if (device && state) {
    headline = stale ? "Device offline" : doorOpen ? "Door is open" : "Door is closed";
    subline = stale
      ? `Last heard from the device ${agoFromSeconds(device.seconds_since_seen)}. Showing its last known state: door ${state.door_state}, ${state.mode}.`
      : state.mode === "ARMED"
      ? "Monitoring is armed. Door opening or repeated vibration will raise an alert."
      : "Monitoring is disarmed. Door state is still tracked, but intrusion alerts are off.";
  } else if (error && !data) {
    headline = "Backend unreachable";
    subline = error;
  }

  return (
    <div ref={ref} data-page className="absolute inset-0 overflow-y-auto overflow-x-hidden">
      <div className="relative flex min-h-full w-full flex-col gap-[20px]" style={{ padding: "24px 32px 32px 110px" }}>
        <PageHeader
          title="Door Overview"
          subtitle={device ? `${device.device_name} · last seen ${agoFromSeconds(device.seconds_since_seen)}` : "Live status of your Suraksha device."}
        >
          <StatusPill label={online ? "ONLINE" : "OFFLINE"} tone={online ? "ok" : "alarm"} />
          {state && <StatusPill label={state.mode} tone={state.mode === "ARMED" ? "ok" : "neutral"} />}
          <StatusPill label={level.label} tone={level.tone} />
        </PageHeader>

        {/* Status banner */}
        <div
          data-skel
          className="relative flex min-h-[127px] w-full flex-col justify-between gap-[16px] overflow-hidden rounded-[20px] px-[24px] py-[20px] md:flex-row md:items-center"
          style={{
            background: "linear-gradient(100deg,#103a30 0%,#1a4a3d 62%,#164237 100%)",
            boxShadow: "0 18px 34px -18px rgba(8,40,31,.6), inset 0 1px 0 rgba(255,255,255,.08)",
          }}
        >
          <div className="max-w-[560px] flex-1">
            <h2 data-fill className="font-display text-[26px] font-light leading-none tracking-[-0.2px] text-[#e8f6f1]">
              {headline}
            </h2>
            <p data-fill className="mt-[12px] text-[11px] leading-[16px] text-[#86b0a3]">
              {subline}
            </p>
          </div>
          <div data-fill className="flex flex-wrap items-center gap-[8px]">
            <StatusPill label={online ? "ONLINE" : "OFFLINE"} tone={online ? "ok" : "alarm"} />
            {state && (
              <StatusPill label={state.mode} tone={state.mode === "ARMED" ? "ok" : "neutral"} className={state.mode === "ARMED" ? "" : BANNER_NEUTRAL} />
            )}
            {state && <StatusPill label={doorOpen ? "DOOR OPEN" : "DOOR CLOSED"} tone={doorOpen ? "warn" : "neutral"} className={doorOpen ? "" : BANNER_NEUTRAL} />}
            <StatusPill label={level.label} tone={level.tone} />
          </div>
        </div>

        {error && data && (
          <p className="rounded-[12px] bg-red-100 px-[14px] py-[8px] text-[11px] text-red-600 dark:bg-red-500/20 dark:text-red-400">
            Dashboard can&apos;t reach the backend right now ({error}). Values below may be out of date.
          </p>
        )}

        {/* Live status */}
        <div className="flex flex-wrap gap-[20px] lg:flex-nowrap">
          <Tile
            icon={doorOpen ? DoorOpen : DoorClosed}
            label="Door"
            value={state ? (doorOpen ? "DOOR OPEN" : "DOOR CLOSED") : "-"}
            pill={state ? state.door_state : "UNKNOWN"}
            tone={!state ? "neutral" : doorOpen ? "warn" : "ok"}
            hint={stale ? "last known" : "reed switch"}
          />
          <Tile
            icon={Activity}
            label="Vibration"
            value={state ? (vibTriggered ? "TRIGGERED" : "IDLE") : "-"}
            pill={state ? (vibTriggered ? "VIBRATION" : "QUIET") : "UNKNOWN"}
            tone={!state ? "neutral" : vibTriggered ? "warn" : "ok"}
            hint={stale ? "last known" : "knock sensor"}
          />
          <Tile
            icon={Siren}
            label="Local alarm"
            value={state ? (state.alarm_active ? "SOUNDING" : "SILENT") : "-"}
            pill={state ? (state.alarm_active ? "ALARM" : "NORMAL") : "UNKNOWN"}
            tone={!state ? "neutral" : state.alarm_active ? "alarm" : "ok"}
            hint="buzzer and LEDs"
          />
          {state && state.proximity_cm !== null && (
            <Tile
              icon={Radio}
              label="Proximity (optional)"
              value={`${Math.round(state.proximity_cm)} cm`}
              pill="NEARBY OBJECT"
              tone="neutral"
              hint="not person detection"
            />
          )}
        </div>

        {/* Controls + latest alert */}
        <div className="flex flex-wrap gap-[20px] lg:flex-nowrap">
          <ArmControl
            mode={state?.mode}
            online={online}
            hasDevice={!!device}
            lastCommand={data?.last_command ?? null}
            serverTime={serverTime}
            onChanged={refresh}
          />

          <Card className="min-w-0 flex-1 p-[20px]">
            <div data-fill className="flex items-center justify-between">
              <h3 className="font-display text-[16px] font-medium text-ink">Latest alert</h3>
              <Link href="/alerts" className="flex items-center gap-[4px] text-[10px] text-muted transition-colors hover:text-ink">
                All alerts <ArrowRight size={12} />
              </Link>
            </div>
            {alert ? (
              <div data-fill className="mt-[12px]">
                <div className="flex flex-wrap items-center gap-[8px]">
                  <StatusPill label={alert.severity} tone={severityTone(alert.severity)} />
                  <p className="text-[14px] font-medium text-ink">{eventLabel(alert.event_type)}</p>
                </div>
                <p className="mt-[8px] text-[11.5px] leading-[17px] text-muted">{alert.message}</p>
                <p className="mt-[8px] text-[10px] text-muted">
                  {formatWhen(alert.created_at)} · {timeAgo(alert.created_at, serverTime)}
                  {data && data.unacknowledged_alerts > 1 ? ` · ${data.unacknowledged_alerts} unacknowledged in total` : ""}
                </p>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  disabled={acking}
                  onClick={() => ack(alert.event_id)}
                  className="mt-[14px] flex h-[32px] items-center gap-[6px] rounded-full bg-forest-2 px-[16px] text-[11px] font-medium text-white shadow-sm disabled:opacity-60 dark:bg-mint dark:text-forest"
                >
                  <Check size={13} /> Acknowledge
                </motion.button>
              </div>
            ) : (
              <div data-fill className="mt-[14px] flex items-center gap-[12px]">
                <span className="flex h-[40px] w-[40px] items-center justify-center rounded-[12px] bg-mint-2/70 text-mint-4 dark:bg-mint-3/20 dark:text-mint">
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <p className="text-[13px] font-medium text-ink">No active alerts</p>
                  <p className="text-[10.5px] text-muted">Everything the device reported has been acknowledged or was routine.</p>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Recent events + device health */}
        <div className="flex flex-wrap gap-[20px] lg:flex-nowrap">
          <Card className="min-w-0 flex-1 p-[16px]">
            <div data-fill className="flex items-center justify-between px-[6px]">
              <h3 className="font-display text-[16px] font-medium text-ink">Recent events</h3>
              <Link href="/history" className="flex items-center gap-[4px] text-[10px] text-muted transition-colors hover:text-ink">
                Full history <ArrowRight size={12} />
              </Link>
            </div>
            <div className="mt-[8px]">
              {recent.length === 0 ? (
                <p className="px-[6px] py-[18px] text-[11px] text-muted">
                  {recentLoaded ? "No events recorded yet." : "Loading events..."}
                </p>
              ) : (
                recent.map((e) => <EventItem key={e.event_id} event={e} serverTime={serverTime} />)
              )}
            </div>
          </Card>

          <Card className="w-full shrink-0 p-[20px] lg:w-[320px]">
            <div data-fill className="flex items-center justify-between">
              <h3 className="font-display text-[16px] font-medium text-ink">Device health</h3>
              <Link href="/device" className="flex items-center gap-[4px] text-[10px] text-muted transition-colors hover:text-ink">
                Details <ArrowRight size={12} />
              </Link>
            </div>
            <dl data-fill className="mt-[10px] text-[11.5px]">
              {[
                ["Connection", device ? (online ? "Online" : "Offline") : "No report yet"],
                ["Last seen", device ? agoFromSeconds(device.seconds_since_seen) : "-"],
                ["Last state sync", state ? timeAgo(state.updated_at, serverTime) : "-"],
                ["Firmware", device?.firmware_version ?? "not reported"],
              ].map(([k, v]) => (
                <div key={k} className={cn("flex items-center justify-between border-b border-black/[.06] py-[9px] last:border-0 dark:border-white/[.08]")}>
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
