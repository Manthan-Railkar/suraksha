"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Lock, LockOpen } from "lucide-react";
import Card from "@/components/ui/Card";
import { notify } from "@/components/ui/Toast";
import { requestCommand, type CommandRow } from "@/lib/api";
import { timeAgo, type Tone } from "@/lib/suraksha";
import StatusPill from "./StatusPill";

const STATUS: Record<CommandRow["status"], { label: string; tone: Tone }> = {
  pending: { label: "PENDING", tone: "warn" },
  applied: { label: "CONFIRMED", tone: "ok" },
  failed: { label: "FAILED", tone: "alarm" },
  expired: { label: "NO RESPONSE", tone: "warn" },
  superseded: { label: "REPLACED", tone: "neutral" },
};

function statusText(c: CommandRow, serverTime?: string): string {
  const verb = c.command_type === "ARM" ? "arm" : "disarm";
  switch (c.status) {
    case "pending":
      return `Waiting for the device to confirm "${verb}". The mode above has not changed yet.`;
    case "applied":
      return `Device confirmed "${verb}" ${timeAgo(c.applied_at, serverTime)}.`;
    case "failed":
      return `Device could not apply "${verb}"${c.error ? `: ${c.error}` : "."} Mode unchanged.`;
    case "expired":
      return `The device did not pick up "${verb}" in time. Mode unchanged.`;
    case "superseded":
      return `"${verb}" was replaced by a newer request.`;
  }
}

/**
 * Arm / Disarm with confirmation. The mode shown always comes from the device's own report;
 * a request only ever shows as pending / confirmed / failed (blueprint section 11).
 */
export default function ArmControl({
  mode,
  online,
  hasDevice,
  lastCommand,
  serverTime,
  onChanged,
}: {
  mode: "ARMED" | "DISARMED" | undefined;
  online: boolean;
  hasDevice: boolean;
  lastCommand: CommandRow | null;
  serverTime?: string;
  onChanged: () => void;
}) {
  const [confirm, setConfirm] = useState<"ARM" | "DISARM" | null>(null);
  const [sending, setSending] = useState(false);
  const [localCmd, setLocalCmd] = useState<CommandRow | null>(null);

  // Show the freshest command; once the state poll catches up, its copy wins.
  const shown = localCmd && (!lastCommand || localCmd.command_id > lastCommand.command_id) ? localCmd : lastCommand;

  async function send(type: "ARM" | "DISARM") {
    setSending(true);
    try {
      const cmd = await requestCommand(type);
      setLocalCmd(cmd);
      setConfirm(null);
      notify({ title: `${type === "ARM" ? "Arm" : "Disarm"} requested`, description: "Waiting for the device to confirm.", type: "info" });
      onChanged();
    } catch (err) {
      notify({ title: "Command not sent", description: err instanceof Error ? err.message : "Backend unreachable", type: "error" });
    } finally {
      setSending(false);
    }
  }

  const disabled = !hasDevice || sending;

  return (
    <Card className="w-full shrink-0 p-[20px] lg:w-[360px]">
      <div data-fill className="flex items-center justify-between">
        <h3 className="font-display text-[16px] font-medium text-ink">Security controls</h3>
        <StatusPill label={mode ?? "UNKNOWN"} tone={mode === "ARMED" ? "ok" : "neutral"} />
      </div>
      <p data-fill className="mt-[6px] text-[10.5px] leading-[15px] text-muted">
        Arming makes door and vibration events raise alerts. Suraksha only monitors the door - it never locks or unlocks it.
      </p>

      <div data-fill className="mt-[16px] flex gap-[10px]">
        <motion.button
          whileTap={{ scale: 0.95 }}
          disabled={disabled || mode === "ARMED"}
          onClick={() => setConfirm("ARM")}
          className="flex h-[36px] flex-1 items-center justify-center gap-[7px] rounded-full bg-forest-2 text-[11px] font-medium text-white shadow-sm disabled:opacity-40 dark:bg-mint dark:text-forest"
        >
          <Lock size={13} /> Arm
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          disabled={disabled || mode === "DISARMED"}
          onClick={() => setConfirm("DISARM")}
          className="flex h-[36px] flex-1 items-center justify-center gap-[7px] rounded-full bg-peach text-[11px] font-medium text-forest shadow-[0_8px_18px_-8px_rgba(243,168,119,.8)] disabled:opacity-40"
        >
          <LockOpen size={13} /> Disarm
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {confirm && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 440, damping: 32, mass: 0.72 }}
            className="overflow-hidden"
          >
            <div className="mt-[12px] rounded-[14px] bg-black/[.04] p-[12px] dark:bg-white/[.06]">
              <p className="text-[11.5px] font-medium text-ink">
                {confirm === "ARM" ? "Arm Suraksha?" : "Disarm Suraksha?"}
              </p>
              <p className="mt-[2px] text-[10px] text-muted">
                {confirm === "ARM"
                  ? "Close the door first. Opening it afterwards will sound the local alarm."
                  : "Door opening will no longer raise an intrusion alarm."}
              </p>
              <div className="mt-[10px] flex gap-[8px]">
                <button
                  disabled={sending}
                  onClick={() => send(confirm)}
                  className="h-[28px] rounded-full bg-forest-2 px-[14px] text-[10.5px] font-medium text-white disabled:opacity-60 dark:bg-mint dark:text-forest"
                >
                  {sending ? "Sending..." : "Confirm"}
                </button>
                <button
                  disabled={sending}
                  onClick={() => setConfirm(null)}
                  className="h-[28px] rounded-full px-[12px] text-[10.5px] font-medium text-muted hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div data-fill className="mt-[14px] border-t border-black/[.06] pt-[12px] dark:border-white/[.08]">
        {!hasDevice ? (
          <p className="text-[10.5px] text-muted">No device has reported yet, so there is nothing to control.</p>
        ) : shown ? (
          <div className="flex items-start gap-[8px]">
            <StatusPill label={STATUS[shown.status].label} tone={STATUS[shown.status].tone} />
            <p className="text-[10.5px] leading-[15px] text-muted">{statusText(shown, serverTime)}</p>
          </div>
        ) : (
          <p className="text-[10.5px] text-muted">No commands sent yet.</p>
        )}
        {hasDevice && !online && (
          <p className="mt-[8px] text-[10px] text-peach">
            The device is offline. A command will wait for it to reconnect and expires after about a minute.
          </p>
        )}
      </div>
    </Card>
  );
}
