import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";

const navItems = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/hooks", label: "Hooks" },
  { href: "/app/leads", label: "Leads" },
  { href: "/app/analytics", label: "Analytics" },
  { href: "/app/settings", label: "Settings" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-[#080808] text-zinc-100 font-[family-name:var(--font-geist-sans)]">
      {/* Top nav */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 flex items-center h-14">
          <Link href="/app" className="text-lg font-bold text-emerald-400 mr-8">
            GSH
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 rounded-md hover:bg-zinc-800 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-zinc-500">
              {session.user.email}
            </span>
            <span className="text-xs bg-emerald-900/50 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded">
              {session.user.tierId}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
