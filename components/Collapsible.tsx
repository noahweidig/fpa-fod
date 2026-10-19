"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";

/** Open/closed state survives tab switches (the panels unmount) for the session. */
const openState = new Map<string, boolean>();

export default function Collapsible({ id, title, Icon, badge, defaultOpen = false, children }: Readonly<{
  id: string;
  title: string;
  Icon?: LucideIcon;
  /** e.g. number of active filters in the section */
  badge?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}>) {
  return (
    <details
      className="group rounded-md border border-line"
      open={openState.get(id) ?? defaultOpen}
      onToggle={(e) => openState.set(id, e.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <ChevronRight size={14} aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-90" />
        {Icon && <Icon size={14} aria-hidden className="shrink-0 text-muted" />}
        <span className="flex-1">{title}</span>
        {!!badge && <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold tabular-nums text-accent-ink">{badge}</span>}
      </summary>
      <div className="space-y-5 border-t border-line p-3">{children}</div>
    </details>
  );
}
