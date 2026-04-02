import Link from "next/link";
import { SignalHooksLogoCompact } from "@/components/ui/signalhooks-logo";

const productLinks = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#demo", label: "Live demo" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/followup-engine", label: "Follow-up engine" },
];

const resourceLinks = [
  { href: "/docs", label: "Documentation" },
  { href: "/contact", label: "Contact" },
  { href: "/setup", label: "Setup guide" },
];

const legalLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/[0.05] bg-[#070710]">
      <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.12),transparent_58%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/20 to-transparent" />

      <div className="relative mx-auto max-w-[90rem] px-6 py-14 lg:px-10 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
          {/* Brand */}
          <div className="max-w-sm">
            <Link href="/" aria-label="GetSignalHooks home" className="inline-flex items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070710]">
              <SignalHooksLogoCompact />
              <span className="text-[0.95rem] font-semibold text-zinc-200">
                GetSignalHooks
              </span>
            </Link>
            <p className="mt-4 text-[0.875rem] leading-7 text-zinc-400">
              Signal-backed outbound with cited sources. Every message traces back to a real company signal.
            </p>
            <p className="mt-5 text-[0.75rem] font-medium uppercase tracking-[0.18em] text-violet-300/65">
              Better signals. Better timing. Better outbound.
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="mb-4 text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-zinc-400">Product</p>
            <ul className="space-y-2">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[0.875rem] text-zinc-500 transition-colors hover:text-zinc-300 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <p className="mb-4 text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-zinc-400">Resources</p>
            <ul className="space-y-2">
              {resourceLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[0.875rem] text-zinc-500 transition-colors hover:text-zinc-300 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="mb-4 text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-zinc-400">Legal</p>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[0.875rem] text-zinc-500 transition-colors hover:text-zinc-300 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 sm:flex-row">
          <p className="text-[0.75rem] text-zinc-600">
            &copy; {new Date().getFullYear()} GetSignalHooks. All rights reserved.
          </p>
          <a href="mailto:contact@getsignalhooks.com" className="rounded-sm text-[0.75rem] text-zinc-600 transition-colors hover:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500">
            contact@getsignalhooks.com
          </a>
        </div>
      </div>
    </footer>
  );
}
