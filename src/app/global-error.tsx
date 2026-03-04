"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen bg-[#080808] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-5xl font-bold text-red-500 mb-4">Error</p>
          <h1 className="text-2xl font-bold text-zinc-100 mb-2">
            Something went wrong
          </h1>
          <p className="text-zinc-500 mb-8 max-w-sm mx-auto">
            An unexpected error occurred. Our team has been notified.
          </p>
          <button
            onClick={reset}
            className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
