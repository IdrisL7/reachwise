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
    <footer className="border-t border-white/[0.06] bg-[#070710]">
      <div className="mx-auto max-w-[90rem] px-6 py-14 lg:px-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link href="/" aria-label="GetSignalHooks home" className="flex items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070710]">
              <SignalHooksLogoCompact />
              <span className="text-[0.875rem] font-semibold text-zinc-300">
                GetSignalHooks
              </span>
            </Link>
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-zinc-500 max-w-xs">
              Signal-backed outbound with cited sources. Every message traces back to a real company signal.
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-zinc-400 mb-3">Product</p>
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
            <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-zinc-400 mb-3">Resources</p>
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
            <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-zinc-400 mb-3">Legal</p>
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

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 sm:flex-row">
          <p className="text-[0.75rem] text-zinc-600">
            &copy; {new Date().getFullYear()} GetSignalHooks. All rights reserved.
          </p>
          <a href="mailto:hello@getsignalhooks.com" className="text-[0.75rem] text-zinc-600 transition-colors hover:text-zinc-400 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500">
            hello@getsignalhooks.com
          </a>
        </div>
      </div>
    </footer>
  );
}
