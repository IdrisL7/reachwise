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
    <div className="px-4 sm:px-6 py-1.5 flex items-center gap-3 border-b border-amber-900/20 bg-amber-950/10">
      <p className="text-xs text-amber-400/70 leading-none">
        Verify your email to unlock all features.
      </p>
      {sent ? (
        <span className="text-xs text-amber-400/50">Sent!</span>
      ) : (
        <button
          onClick={resend}
          disabled={loading}
          className="text-xs text-amber-500/70 hover:text-amber-300 underline underline-offset-2 whitespace-nowrap disabled:opacity-50 transition-colors shrink-0"
        >
          {loading ? "Sending..." : "Resend"}
        </button>
      )}
    </div>
  );
}
