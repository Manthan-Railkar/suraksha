"use client";
import { useRef, useState, type ElementType } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Activity, ArrowRight, Check, DoorClosed, DoorOpen, Radio, ShieldCheck, Siren, Sun } from "lucide-react";
import Card from "@/components/ui/Card";
import { notify } from "@/components/ui/Toast";
import { usePageEntrance } from "@/lib/entrance";
import { acknowledgeEvent } from "@/lib/api";
import { agoFromSeconds, eventLabel, formatWhen, severityTone, systemLevel, timeAgo, uvTone, type Tone } from "@/lib/suraksha";
import PageHeader from "@/components/suraksha/PageHeader";
import StatusPill from "@/components/suraksha/StatusPill";
import ArmControl from "@/components/suraksha/ArmControl";
import EventItem from "@/components/suraksha/EventItem";
import DeviceSelector from "@/components/suraksha/DeviceSelector";
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
    <Card className="min-w-[190px] flex-1 px-[18px] pb-[16px] pt-[16px]">
      <div data-fill className="flex items-center justify-between text-[11px] text-muted">
        <span>{label}</span>
        <Icon size={15} className="text-ink" />
      </div>
      <p data-fill className="mt-[14px] font-display text-[26px] font-medium tracking-[-0.6px] text-ink">
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

  const { data, error, refresh, deviceId } = useDeviceState();
  const { events: recent, loaded: recentLoaded, refresh: refreshEvents } = useEvents({ limit: 6, deviceId });
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
    headline = "Waiting for device";
    subline = `No reports received yet from ${deviceId}. Power on the device or start the simulator.`;
  } else if (device && state) {
    headline = stale ? "Device offline" : doorOpen ? "Door is open" : "Door is closed";
    subline = stale
      ? `Last heard from ${device.device_name} ${agoFromSeconds(device.seconds_since_seen)}. Showing last known state: door ${state.door_state}, ${state.mode}.`
      : state.mode === "ARMED"
      ? "Monitoring is armed. Door opening or repeated vibration will raise an intrusion alert."
      : "Monitoring is disarmed. Door state and environmental sensors are tracked, but intrusion alarms are off.";
  } else if (error && !data) {
    headline = "Backend unreachable";
    subline = error;
  }

  const uvInfo = uvTone(state?.uv_index);

  return (
    <div ref={ref} data-page className="absolute inset-0 overflow-y-auto overflow-x-hidden">
      <div className="relative flex min-h-full w-full flex-col gap-[20px]" style={{ padding: "24px 32px 32px 110px" }}>
        <PageHeader
          title="Door Overview"
          subtitle={device ? `${device.device_name} · last seen ${agoFromSeconds(device.seconds_since_seen)}` : "Live status of your Suraksha device."}
        >
          <DeviceSelector />
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
        <div className="grid grid-cols-1 gap-[20px] sm:grid-cols-2 xl:grid-cols-4">
          <Tile
            icon={doorOpen ? DoorOpen : DoorClosed}
            label="Door Sensor"
            value={state ? (doorOpen ? "DOOR OPEN" : "DOOR CLOSED") : "-"}
            pill={state ? state.door_state : "UNKNOWN"}
            tone={!state ? "neutral" : doorOpen ? "warn" : "ok"}
            hint={stale ? "last known" : "reed switch"}
          />
          <Tile
            icon={Activity}
            label="Vibration Sensor"
            value={state ? (vibTriggered ? "TRIGGERED" : "IDLE") : "-"}
            pill={state ? (vibTriggered ? "VIBRATION" : "QUIET") : "UNKNOWN"}
            tone={!state ? "neutral" : vibTriggered ? "warn" : "ok"}
            hint={stale ? "last known" : "knock sensor"}
          />
          <Tile
            icon={Siren}
            label="Local Alarm"
            value={state ? (state.alarm_active ? "SOUNDING" : "SILENT") : "-"}
            pill={state ? (state.alarm_active ? "ALARM" : "NORMAL") : "UNKNOWN"}
            tone={!state ? "neutral" : state.alarm_active ? "alarm" : "ok"}
            hint="buzzer and LEDs"
          />
          <Tile
            icon={Sun}
            label="UV Telemetry (Environmental)"
            value={state && state.uv_index !== null && state.uv_index !== undefined ? `${state.uv_index.toFixed(1)} UV` : "OFFLINE"}
            pill={uvInfo.label}
            tone={uvInfo.tone}
            hint="non-intrusion telemetry"
          />
        </div>

        {/* Controls + latest alert */}
        <div className="flex flex-wrap gap-[20px] lg:flex-nowrap">
          <ArmControl
            mode={state?.mode}
            online={online}
            hasDevice={!!device}
            deviceId={deviceId}
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
                  <Check size={13} /> Acknowledge alert
                </motion.button>
              </div>
            ) : (
              <p data-fill className="mt-[14px] text-[11.5px] text-muted">
                No active warnings or alarms. Any door openings while armed or repeated knocks will appear here immediately.
              </p>
            )}
          </Card>
        </div>

        {/* Recent events stream */}
        <Card className="p-[20px]">
          <div data-fill className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-[16px] font-medium text-ink">Recent events</h3>
              <p className="text-[10px] text-muted">Live audit log from {deviceId}</p>
            </div>
            <Link href="/history" className="flex items-center gap-[4px] text-[10px] text-muted transition-colors hover:text-ink">
              Full history <ArrowRight size={12} />
            </Link>
          </div>
          <div className="mt-[14px]">
            {!recentLoaded ? (
              <p data-fill className="py-[12px] text-[11px] text-muted">
                Loading events...
              </p>
            ) : recent.length === 0 ? (
              <p data-fill className="py-[12px] text-[11px] text-muted">
                No events recorded yet. Open the door or knock on the sensor to generate an event.
              </p>
            ) : (
              recent.map((e) => <EventItem key={e.event_id} event={e} onAck={ack} busy={acking} />)
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
