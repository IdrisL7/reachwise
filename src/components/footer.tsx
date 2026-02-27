import Image from "next/image";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-[90rem] flex-col items-center justify-between gap-5 px-6 py-10 sm:flex-row lg:px-10">
        <a href="#" className="flex items-center gap-2.5">
          <Image src="/logo-getsignalhooks.svg" alt="GetSignalHooks" width={28} height={28} />
          <span className="text-[0.875rem] font-semibold text-zinc-300">
            GetSignalHooks
          </span>
        </a>

        <div className="flex items-center gap-8 text-[0.875rem] text-zinc-500">
          <a
            href="#how-it-works"
            className="transition-colors duration-200 hover:text-zinc-300"
          >
            About
          </a>
          <a
            href="#pricing"
            className="transition-colors duration-200 hover:text-zinc-300"
          >
            Pricing
          </a>
          <a
            href="mailto:hello@getsignalhooks.com"
            className="transition-colors duration-200 hover:text-zinc-300"
          >
            Contact
          </a>
        </div>

        <p className="text-[0.75rem] text-zinc-600">
          &copy; {new Date().getFullYear()} GetSignalHooks. All rights
          reserved.
        </p>
      </div>
    </footer>
  );
}
