import Link from "next/link";

export function CTABlock() {
  return (
    <div className="not-prose my-8 rounded-2xl border border-zinc-700 bg-zinc-900 p-8">
      <div className="flex flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
        <div>
          <h3 className="text-2xl font-bold text-white">Ready to supercharge your cold emails?</h3>
          <p className="mt-2 text-base text-zinc-400">Get started with GetSignalHooks today and craft compelling hooks that convert.</p>
        </div>
        <Link
          href="/register"
          className="inline-block shrink-0 rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
        >
          Try GetSignalHooks free
        </Link>
      </div>
    </div>
  );
}
