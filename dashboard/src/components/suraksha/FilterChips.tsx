"use client";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";

/** Filter pills with the sliding layoutId background used across the template. */
export default function FilterChips<T extends string>({
  id,
  options,
  value,
  onChange,
}: {
  id: string;
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-[6px]">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              "relative rounded-full px-[14px] py-[5px] text-[10px] font-medium transition-colors",
              active ? "text-white dark:text-forest" : "text-muted hover:text-ink"
            )}
          >
            {active && (
              <motion.span
                layoutId={`chip-${id}`}
                className="absolute inset-0 rounded-full bg-forest-2 dark:bg-mint"
                transition={{ type: "spring", stiffness: 440, damping: 32, mass: 0.72 }}
              />
            )}
            <span className="relative">
              {o.label}
              {o.count !== undefined ? ` (${o.count})` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
