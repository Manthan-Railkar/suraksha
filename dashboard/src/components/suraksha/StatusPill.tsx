import { cn } from "@/lib/cn";

type Tone = "ok" | "warn" | "alarm" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  ok: "bg-mint-2/70 dark:bg-mint/20 text-mint-4 dark:text-mint",
  warn: "bg-peach-3 dark:bg-peach/20 text-peach",
  alarm: "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400",
  neutral: "bg-black/[.05] dark:bg-white/[.08] text-muted",
};

/** Always text + color - never color alone (blueprint section 10). */
export default function StatusPill({ label, tone, className }: { label: string; tone: Tone; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-[11px] py-[4px] text-[10.5px] font-medium", TONE_CLASSES[tone], className)}>
      {label}
    </span>
  );
}
