"use client";
import { useRef, type ReactNode } from "react";
import { Cpu, Info, Sun, Wifi } from "lucide-react";
import Card from "@/components/ui/Card";
import { usePageEntrance } from "@/lib/entrance";
import { agoFromSeconds, formatWhen, systemLevel, timeAgo, uvTone } from "@/lib/suraksha";
import PageHeader from "@/components/suraksha/PageHeader";
import StatusPill from "@/components/suraksha/StatusPill";
import DeviceSelector from "@/components/suraksha/DeviceSelector";
import { useDeviceState } from "@/components/suraksha/useDeviceState";

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-[12px] border-b border-black/[.06] py-[9px] text-[11.5px] last:border-0 dark:border-white/[.08]">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium text-ink">{children}</dd>
    </div>
  );
}

function CardTitle({ icon: Icon, title, sub }: { icon: typeof Cpu; title: string; sub: string }) {
  return (
    <div data-fill className="mb-[8px] flex items-center gap-[10px]">
      <span className="flex h-[32px] w-[32px] items-center justify-center rounded-[8px] bg-mint-2/70 text-forest-2 dark:bg-mint-3/20 dark:text-mint">
        <Icon size={16} />
      </span>
      <div>
        <h3 className="text-[13.5px] font-medium text-ink">{title}</h3>
        <p className="text-[10px] text-muted">{sub}</p>
      </div>
    </div>
  );
}

/** Blueprint section 15 - what each sensor can and cannot establish. */
const LIMITS = [
  ["Magnetic reed switch", "Whether the door is physically open or closed.", "Whether the mechanical lock is locked, picked or secure."],
  ["Vibration sensor", "That an impact or knock above the threshold occurred.", "That a forced entry happened, or who caused it."],
  ["Analog UV sensor (environmental)", "Ambient solar ultraviolet radiation levels.", "Cannot detect human motion, presence, or intrusion events."],
  ["Proximity sensor (optional)", "That an object is within a measured distance.", "That it is a person, who they are, or what they intend."],
  ["Wi-Fi dashboard", "Remote visibility while device, network and backend are up.", "Guaranteed delivery during power/network outages."],
];

export default function DeviceView() {
  const ref = useRef<HTMLDivElement>(null);
  usePageEntrance(ref);

  const { data, error, deviceId } = useDeviceState();
  const device = data?.device ?? null;
  const state = data?.state ?? null;
  const online = !!device?.is_online;
  const level = systemLevel(data);
  const serverTime = data?.server_time;
  const cmd = data?.last_command ?? null;

  const isSim = deviceId.includes("wokwi") || deviceId.includes("sim");
  const uvInfo = uvTone(state?.uv_index);

  return (
    <div ref={ref} data-page className="absolute inset-0 overflow-y-auto overflow-x-hidden">
      <div className="relative flex min-h-full w-full flex-col gap-[20px]" style={{ padding: "24px 32px 32px 110px" }}>
        <PageHeader title="Device Health" subtitle="Connection, telemetry, and sensor status reported by the ESP32.">
          <DeviceSelector />
          <StatusPill label={online ? "ONLINE" : device ? "OFFLINE" : "NO REPORT"} tone={online ? "ok" : "alarm"} />
        </PageHeader>

        {error && (
          <p className="rounded-[12px] bg-red-100 px-[14px] py-[8px] text-[11px] text-red-600 dark:bg-red-500/20 dark:text-red-400">
            Dashboard can&apos;t reach the backend ({error}).
          </p>
        )}

        <div className="grid grid-cols-1 gap-[20px] lg:grid-cols-2">
          {/* Identity & Hardware Card */}
          <Card className="p-[20px]">
            <CardTitle icon={Cpu} title="Device & Hardware" sub="Identity as registered with the backend" />
            <dl data-fill>
              <Row k="Name">{device?.device_name ?? "-"}</Row>
              <Row k="Device ID">{device?.device_id ?? deviceId}</Row>
              <Row k="Environment">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-mint">
                  {isSim ? "Wokwi / Virtual Simulator" : "Physical EDU-ROBO V14 PCB"}
                </span>
              </Row>
              <Row k="Firmware">{device?.firmware_version ?? "not reported"}</Row>
              <Row k="Active Mode">{state?.mode ?? "-"}</Row>
              <Row k="Overall status">
                <StatusPill label={level.label} tone={level.tone} />
              </Row>
            </dl>
          </Card>

          {/* Connectivity Card */}
          <Card className="p-[20px]">
            <CardTitle icon={Wifi} title="Connectivity" sub="Wi-Fi to backend, as seen by the backend" />
            <dl data-fill>
              <Row k="Connection">
                <StatusPill label={online ? "ONLINE" : device ? "OFFLINE" : "NO REPORT"} tone={online ? "ok" : "alarm"} />
              </Row>
              <Row k="Last seen">{device ? `${agoFromSeconds(device.seconds_since_seen)} (${formatWhen(device.last_seen_at)})` : "-"}</Row>
              <Row k="Last state sync">{state ? `${timeAgo(state.updated_at, serverTime)} (${formatWhen(state.updated_at)})` : "-"}</Row>
              <Row k="Last command">
                {cmd ? `${cmd.command_type} - ${cmd.status}${cmd.applied_at ? `, ${timeAgo(cmd.applied_at, serverTime)}` : ""}` : "none"}
              </Row>
              <Row k="Backend link from dashboard">
                <StatusPill label={error ? "UNREACHABLE" : data ? "OK" : "CONNECTING"} tone={error ? "alarm" : data ? "ok" : "neutral"} />
              </Row>
            </dl>
            {device && !online && (
              <p className="mt-[10px] text-[10.5px] leading-[15px] text-peach">
                The device has stopped reporting. It keeps sensing and sounding its local alarm without Wi-Fi, but events will
                only appear here after it reconnects.
              </p>
            )}
          </Card>
        </div>

        {/* Environmental & Sensor Telemetry Card */}
        <Card className="p-[20px]">
          <CardTitle icon={Sun} title="Environmental Telemetry (UV Sensor)" sub="Physical analog sensor on GPIO35 - strictly non-intrusion" />
          <dl data-fill className="grid grid-cols-1 sm:grid-cols-2 gap-x-[24px]">
            <Row k="UV Index (WHO Scale)">
              <span className="font-semibold text-mint">
                {state && state.uv_index !== null && state.uv_index !== undefined ? `${state.uv_index.toFixed(1)} UV` : "Not reported"}
              </span>
            </Row>
            <Row k="Exposure Hazard Rating">
              <StatusPill label={uvInfo.label} tone={uvInfo.tone} />
            </Row>
            <Row k="Classification Guide">{uvInfo.desc}</Row>
            <Row k="Security Rule Role">
              <span className="text-[10px] text-muted">Independent environmental telemetry (never triggers alarms)</span>
            </Row>
          </dl>
        </Card>

        {/* Blueprint Capabilities & Constraints */}
        <Card className="p-[20px]">
          <CardTitle icon={Info} title="What the sensors can and can't tell you" sub="Suraksha is a monitoring prototype, not a certified alarm system" />
          <div data-fill className="mt-[4px] overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[11px]">
              <thead>
                <tr className="text-[9.5px] uppercase tracking-wide text-muted">
                  <th className="py-[8px] pr-[12px] font-medium">Sensor</th>
                  <th className="py-[8px] pr-[12px] font-medium">Can tell us</th>
                  <th className="py-[8px] font-medium">Cannot establish</th>
                </tr>
              </thead>
              <tbody>
                {LIMITS.map(([s, can, cannot]) => (
                  <tr key={s} className="border-t border-black/[.06] align-top dark:border-white/[.08]">
                    <td className="py-[9px] pr-[12px] font-medium text-ink">{s}</td>
                    <td className="py-[9px] pr-[12px] text-muted">{can}</td>
                    <td className="py-[9px] text-muted">{cannot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p data-fill className="mt-[10px] text-[10px] text-muted">
            Suraksha only monitors the door. It does not lock, unlock or actuate the existing mechanical lock.
          </p>
        </Card>
      </div>
    </div>
  );
}
