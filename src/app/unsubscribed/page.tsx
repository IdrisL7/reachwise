import Link from "next/link";

export default function UnsubscribedPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">
          Unsubscribed
        </h1>
        <p className="text-zinc-500 text-sm mb-6">
          You&apos;ve been unsubscribed from marketing emails. You&apos;ll still receive
          essential account emails (password resets, billing receipts).
        </p>
        <Link
          href="/"
          className="text-emerald-400 hover:underline text-sm"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
