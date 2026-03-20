import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { SignOutButton } from "@/components/sign-out-button";
import { MobileMoreMenu } from "./mobile-more-menu";
import { SignalHooksLogo } from "@/components/ui/signalhooks-logo";

const navGroups = [
  {
    label: "Prospecting",
    items: [
      { href: "/app/hooks", label: "Hooks" },
      { href: "/app/batch", label: "Batch" },
      { href: "/app/discover", label: "Discover" },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/app/leads", label: "Leads" },
      { href: "/app/integrations", label: "Integrations" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/app/analytics", label: "Analytics" },
      { href: "/app/settings", label: "Settings" },
    ],
  },
];

const allNavItems = navGroups.flatMap((g) => g.items);
const primaryNav = [
  { href: "/app/hooks", label: "Hooks" },
  { href: "/app/batch", label: "Batch" },
  { href: "/app/discover", label: "Discover" },
  { href: "/app/leads", label: "Leads" },
];
const secondaryNav = allNavItems.filter((item) => !primaryNav.find((p) => p.href === item.href));

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [freshUser] = await db
    .select({ tierId: schema.users.tierId })
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .limit(1);
  const tierId = freshUser?.tierId || session.user.tierId;

  return (
    <div className="min-h-screen flex bg-canvas text-text-primary font-[family-name:var(--font-geist-sans)]">
      {/* Left sidebar — desktop only */}
      <aside className="hidden lg:flex flex-col w-[220px] fixed h-full bg-surface border-r border-white/[0.06] z-40">
        {/* Logo */}
        <div className="flex items-center h-12 px-4 border-b border-white/[0.04] shrink-0">
          <Link href="/app" className="flex items-center gap-2.5">
            <SignalHooksLogo />
            <span className="text-sm font-semibold text-text-primary">SignalHooks</span>
          </Link>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600 px-3 mb-1 mt-4 first:mt-2">
                {group.label}
              </p>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03] transition-colors aria-[current=page]:text-white aria-[current=page]:bg-white/[0.03] aria-[current=page]:before:absolute aria-[current=page]:before:left-0 aria-[current=page]:before:top-1/2 aria-[current=page]:before:-translate-y-1/2 aria-[current=page]:before:h-4 aria-[current=page]:before:w-0.5 aria-[current=page]:before:bg-violet-500 aria-[current=page]:before:rounded-full"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* User info */}
        <div className="border-t border-white/[0.04] px-4 py-3 shrink-0">
          <p className="text-xs text-zinc-500 truncate mb-1">{session.user.email}</p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded capitalize">
              {tierId}
            </span>
            {tierId !== "concierge" && (
              <Link
                href="/#pricing"
                className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
              >
                Upgrade →
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-[220px] flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="h-12 sticky top-0 z-30 backdrop-blur-md bg-canvas/80 border-b border-white/[0.06] flex items-center px-4 sm:px-6">
          {/* Mobile: logo + nav */}
          <div className="flex lg:hidden items-center gap-0.5 flex-1 min-w-0">
            <Link href="/app" className="mr-2 shrink-0">
              <SignalHooksLogo />
            </Link>
            <nav className="flex items-center gap-0.5 mr-3">
              {primaryNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary aria-[current=page]:text-white aria-[current=page]:bg-[#1c1e20] rounded-md hover:bg-zinc-800 transition-colors whitespace-nowrap"
                >
                  {item.label}
                </Link>
              ))}
              <MobileMoreMenu items={secondaryNav} />
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <span className="text-xs text-text-secondary hidden sm:block">
              {session.user.email}
            </span>
            <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded capitalize lg:px-2">
              {tierId}
            </span>
            <SignOutButton />
          </div>
        </header>

        {!(session.user as any).isEmailVerified && (
          <Suspense>
            <VerifyEmailBanner />
          </Suspense>
        )}

        <main className="px-4 sm:px-6 py-6 max-w-5xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
