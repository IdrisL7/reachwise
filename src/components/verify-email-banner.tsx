"use client";

import { useState } from "react";

export function VerifyEmailBanner() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

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
        {sent ? (
          <span className="text-xs text-amber-400/70 ml-4">Sent!</span>
        ) : (
          <button
            onClick={resend}
            disabled={loading}
            className="text-xs text-amber-400 hover:text-amber-200 underline underline-offset-2 whitespace-nowrap ml-4 disabled:opacity-50"
          >
            {loading ? "Sending..." : "Resend email"}
          </button>
        )}
      </div>
    </div>
  );
}
