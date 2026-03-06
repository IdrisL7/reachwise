"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center px-4 py-24">
      <div className="text-center">
        <p className="text-7xl font-bold text-violet-500 mb-4">500</p>
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">
          Something went wrong
        </h1>
        <p className="text-zinc-500 mb-8 max-w-sm mx-auto">
          An unexpected error occurred. Please try again or return to the
          dashboard.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            Try again
          </button>
          <Link
            href="/app"
            className="border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
