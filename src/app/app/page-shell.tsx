"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Action = {
  href?: string;
  label: string;
  icon: LucideIcon;
  variant?: "primary" | "secondary";
  onClick?: () => void;
  disabled?: boolean;
};

type Stat = {
  label: string;
  value: string;
  tone?: "violet" | "teal" | "amber" | "slate";
};

const toneClasses: Record<NonNullable<Stat["tone"]>, string> = {
  violet: "border-violet-500/20 bg-violet-500/[0.08] text-violet-200",
  teal: "border-teal-500/20 bg-teal-500/[0.08] text-teal-200",
  amber: "border-amber-500/20 bg-amber-500/[0.08] text-amber-200",
  slate: "border-white/10 bg-white/[0.03] text-slate-200",
};

function ActionButton({ action }: { action: Action }) {
  const Icon = action.icon;
  const className =
    action.variant === "primary"
      ? "inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
      : "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50";

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        <Icon size={16} />
        {action.label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className={className}
    >
      <Icon size={16} />
      {action.label}
    </button>
  );
}

export function AppPageShell({
  eyebrow,
  title,
  description,
  stats,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  stats?: Stat[];
  actions?: Action[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#030014] px-6 py-8 text-white sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.18),_transparent_34%),linear-gradient(135deg,_rgba(13,15,26,0.98),_rgba(9,11,20,0.98))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-violet-300/80">
                {eyebrow}
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                {description}
              </p>
            </div>
            {actions && actions.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {actions.map((action) => (
                  <ActionButton key={action.label} action={action} />
                ))}
              </div>
            )}
          </div>

          {stats && stats.length > 0 && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className={`rounded-2xl border p-4 ${
                    toneClasses[stat.tone ?? "slate"]
                  }`}
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-inherit/70">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {children}
      </div>
    </div>
  );
}

export function SurfaceCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/5 bg-[#0B0F1A] p-6 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-slate-400">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyStatePanel({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actions: Action[];
}) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400">
        <Icon size={28} />
      </div>
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
        {description}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {actions.map((action) => (
          <ActionButton key={action.label} action={action} />
        ))}
      </div>
    </div>
  );
}
