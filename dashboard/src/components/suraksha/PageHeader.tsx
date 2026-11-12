import type { ReactNode } from "react";
import Split from "@/components/ui/Split";

/** Same header pattern as the Settings screen: typed-in title, muted subtitle, actions on the right. */
export default function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-[16px] sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-display text-[31px] font-normal leading-none tracking-[-0.8px] text-ink">
          <Split label={title}>{title}</Split>
        </h1>
        <p data-fill className="mt-[10px] text-[11px] text-muted">
          {subtitle}
        </p>
      </div>
      {children && (
        <div data-fill className="flex flex-wrap items-center gap-[8px]">
          {children}
        </div>
      )}
    </div>
  );
}
