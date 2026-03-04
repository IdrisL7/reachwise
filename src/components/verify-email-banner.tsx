"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export function VerifyEmailBanner() {
  const { update } = useSession();
  const searchParams = useSearchParams();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // If user just verified, trigger a session refresh and dismiss
  useEffect(() => {
    if (searchParams.get("verified") === "true") {
      update(); // Force JWT refresh from DB
      setDismissed(true);
    }
  }, [searchParams, update]);

  if (dismissed) return null;

  async function resend() {
    setLoading(true);
    try {
      await fetch("/api/auth/resend-verification", { method: "POST" });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-amber-900/20 border-b border-amber-800/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
        <p className="text-sm text-amber-300">
          Please verify your email address. Check your inbox for a verification link.
        </p>
        <div className="flex items-center gap-3 ml-4">
          {sent ? (
            <span className="text-xs text-amber-400/70">Sent!</span>
          ) : (
            <button
              onClick={resend}
              disabled={loading}
              className="text-xs text-amber-400 hover:text-amber-200 underline underline-offset-2 whitespace-nowrap disabled:opacity-50"
            >
              {loading ? "Sending..." : "Resend email"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
