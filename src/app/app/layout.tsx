import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { SignOutButton } from "@/components/sign-out-button";
import { MobileMoreMenu } from "./mobile-more-menu";

const primaryNav = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/hooks", label: "Hooks" },
  { href: "/app/batch", label: "Batch" },
  { href: "/app/leads", label: "Leads" },
];

const secondaryNav = [
  { href: "/app/inbox", label: "Inbox" },
  { href: "/app/sequences", label: "Sequences" },
  { href: "/app/templates", label: "Templates" },
  { href: "/app/analytics", label: "Analytics" },
  { href: "/app/settings", label: "Settings" },
  { href: "/app/integrations", label: "Integrations" },
];

const allNav = [...primaryNav, ...secondaryNav];

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
    <div className="min-h-screen bg-[#080808] text-zinc-100 font-[family-name:var(--font-geist-sans)]">
      {/* Top nav */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-14">
          <Link href="/app" className="text-lg font-bold text-emerald-400 mr-4 sm:mr-8 shrink-0">
            GSH
          </Link>

          {/* Desktop nav — all items */}
          <nav className="hidden sm:flex items-center gap-1">
            {allNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 rounded-md hover:bg-zinc-800 transition-colors whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Mobile nav — 4 primary + "More" */}
          <nav className="flex sm:hidden items-center gap-0.5">
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 rounded-md hover:bg-zinc-800 transition-colors whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
            <MobileMoreMenu items={secondaryNav} />
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="text-xs text-zinc-500 hidden sm:block">
              {session.user.email}
            </span>
            <span className="text-xs bg-emerald-900/50 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded capitalize">
              {tierId}
            </span>
            {tierId !== "concierge" && (
              <Link
                href="/#pricing"
                className="text-xs bg-violet-600 hover:bg-violet-500 text-white px-2.5 py-0.5 rounded transition-colors"
              >
                Upgrade
              </Link>
            )}
            <SignOutButton />
          </div>
        </div>
      </header>

      {!(session.user as any).isEmailVerified && (
        <Suspense>
          <VerifyEmailBanner />
        </Suspense>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
    </div>
  );
}
