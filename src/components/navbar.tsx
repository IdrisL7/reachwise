import Image from "next/image";
import Link from "next/link";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#080808]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[4.25rem] max-w-[90rem] items-center justify-between px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo-getsignalhooks.svg" alt="GetSignalHooks" width={32} height={32} />
          <span className="text-[1rem] font-bold tracking-[-0.01em] text-white">
            GetSignalHooks
          </span>
        </Link>

        <div className="flex items-center gap-8">
          <Link
            href="/#how-it-works"
            className="hidden text-[0.875rem] font-medium text-zinc-400 transition-colors duration-200 hover:text-white sm:block"
          >
            How it works
          </Link>
          <Link
            href="/#demo"
            className="hidden text-[0.875rem] font-medium text-zinc-400 transition-colors duration-200 hover:text-white sm:block"
          >
            Demo
          </Link>
          <Link
            href="/#pricing"
            className="hidden text-[0.875rem] font-medium text-zinc-400 transition-colors duration-200 hover:text-white sm:block"
          >
            Pricing
          </Link>
          <Link
            href="/#waitlist"
            className="group inline-flex h-10 items-center gap-1.5 rounded-lg bg-violet-600 px-5 text-[0.875rem] font-semibold tracking-[-0.01em] text-white shadow-[0_0_12px_rgba(139,92,246,0.15)] transition-all duration-200 hover:bg-violet-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.25)] hover:scale-[1.02] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808]"
          >
            Join waitlist
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
        </div>
      </div>
    </nav>
  );
}
