"use client";
import { motion } from "motion/react";
import { Check, DoorOpen, Info, Siren, TriangleAlert } from "lucide-react";
import type { EventRow } from "@/lib/api";
import { eventLabel, formatWhen, isAlert, severityTone, timeAgo } from "@/lib/suraksha";
import { cn } from "@/lib/cn";
import StatusPill from "./StatusPill";

const ICON_BOX = {
  alarm: "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400",
  warn: "bg-peach-3 dark:bg-peach/20 text-peach",
  neutral: "bg-mint-2/70 dark:bg-mint-3/20 text-mint-4 dark:text-mint",
  ok: "bg-mint-2/70 dark:bg-mint-3/20 text-mint-4 dark:text-mint",
} as const;

/** One event row. Shows both server time and the device's (approximate) clock - blueprint section 11. */
export default function EventItem({
  event,
  serverTime,
  onAck,
  busy,
}: {
  event: EventRow;
  serverTime?: string;
  onAck?: (id: number) => void;
  busy?: boolean;
}) {
  const tone = severityTone(event.severity);
  const Icon = event.severity === "HIGH" ? Siren : event.severity === "WARNING" ? TriangleAlert : event.event_type.startsWith("DOOR_") ? DoorOpen : Info;
  const canAck = isAlert(event) && !event.acknowledged && !!onAck;

  return (
    <div className="flex items-start gap-[12px] rounded-[14px] px-[12px] py-[10px] transition-colors hover:bg-black/[.03] dark:hover:bg-white/[.04]">
      <span className={cn("mt-[1px] flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[8px]", ICON_BOX[tone])}>
        <Icon size={16} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-[6px]">
          <p className="text-[12.5px] font-medium text-ink">{eventLabel(event.event_type)}</p>
          <StatusPill label={event.severity} tone={tone} />
          {event.acknowledged && <StatusPill label="ACKNOWLEDGED" tone="neutral" />}
        </div>
        <p className="mt-[3px] text-[10.5px] leading-[15px] text-muted">{event.message}</p>
        <p className="mt-[4px] text-[9.5px] text-muted">
          {formatWhen(event.created_at)} · {timeAgo(event.created_at, serverTime)}
          {event.mode ? ` · ${event.mode}` : ""}
          {event.door_state ? ` · door ${event.door_state}` : ""}
        </p>
        {event.device_timestamp && (
          <p className="text-[9px] text-muted/80">Device clock (approximate): {formatWhen(event.device_timestamp)}</p>
        )}
        {event.acknowledged_at && (
          <p className="text-[9px] text-muted/80">Acknowledged {formatWhen(event.acknowledged_at)}</p>
        )}
      </div>

      {canAck && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          disabled={busy}
          onClick={() => onAck!(event.event_id)}
          className="flex h-[28px] shrink-0 items-center gap-[5px] rounded-full bg-forest-2 px-[12px] text-[10px] font-medium text-white shadow-sm disabled:opacity-60 dark:bg-mint dark:text-forest"
        >
          <Check size={12} /> Acknowledge
        </motion.button>
      )}
    </div>
  );
}
