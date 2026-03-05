"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated" && !!session?.user;

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#080808]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[4.25rem] max-w-[90rem] items-center justify-between px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo-getsignalhooks.svg" alt="GetSignalHooks" width={32} height={32} />
          <span className="text-[1rem] font-bold tracking-[-0.01em] text-white">
            GetSignalHooks
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-8">
          <Link
            href="/#how-it-works"
            className="text-[0.875rem] font-medium text-zinc-400 transition-colors duration-200 hover:text-white"
          >
            How it works
          </Link>
          <Link
            href="/#demo"
            className="text-[0.875rem] font-medium text-zinc-400 transition-colors duration-200 hover:text-white"
          >
            Demo
          </Link>
          <Link
            href="/#pricing"
            className="text-[0.875rem] font-medium text-zinc-400 transition-colors duration-200 hover:text-white"
          >
            Pricing
          </Link>
          {isLoggedIn ? (
            <>
              <span className="text-[0.875rem] text-zinc-500">
                {session.user.name || session.user.email}
              </span>
              <Link
                href="/app"
                className="group inline-flex h-10 items-center gap-1.5 rounded-lg bg-violet-600 px-5 text-[0.875rem] font-semibold tracking-[-0.01em] text-white shadow-[0_0_12px_rgba(139,92,246,0.15)] transition-all duration-200 hover:bg-violet-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.25)] hover:scale-[1.02] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808]"
              >
                Dashboard
                <svg
                  className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-[0.875rem] font-medium text-zinc-400 transition-colors duration-200 hover:text-white"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="group inline-flex h-10 items-center gap-1.5 rounded-lg bg-violet-600 px-5 text-[0.875rem] font-semibold tracking-[-0.01em] text-white shadow-[0_0_12px_rgba(139,92,246,0.15)] transition-all duration-200 hover:bg-violet-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.25)] hover:scale-[1.02] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808]"
              >
                Try it free
                <svg
                  className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="sm:hidden p-2 text-zinc-400 hover:text-white transition-colors"
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-white/[0.06] bg-[#080808]/95 backdrop-blur-xl px-6 py-4 space-y-3">
          <Link href="/#how-it-works" onClick={() => setMobileOpen(false)} className="block text-sm text-zinc-400 hover:text-white py-1">
            How it works
          </Link>
          <Link href="/#demo" onClick={() => setMobileOpen(false)} className="block text-sm text-zinc-400 hover:text-white py-1">
            Demo
          </Link>
          <Link href="/#pricing" onClick={() => setMobileOpen(false)} className="block text-sm text-zinc-400 hover:text-white py-1">
            Pricing
          </Link>
          {isLoggedIn ? (
            <>
              <p className="text-sm text-zinc-500 py-1">{session.user.name || session.user.email}</p>
              <Link
                href="/app"
                onClick={() => setMobileOpen(false)}
                className="block w-full text-center bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors mt-2"
              >
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMobileOpen(false)} className="block text-sm text-zinc-400 hover:text-white py-1">
                Log in
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileOpen(false)}
                className="block w-full text-center bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors mt-2"
              >
                Try it free
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
