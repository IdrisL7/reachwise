"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("gsh_cookie_consent");
    if (!consent) {
      // Small delay so it doesn't flash on page load
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  function accept() {
    localStorage.setItem("gsh_cookie_consent", "accepted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem("gsh_cookie_consent", "declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 sm:p-6">
      <div className="mx-auto max-w-lg rounded-xl border border-zinc-700/50 bg-zinc-900/95 backdrop-blur-xl p-4 shadow-[0_-4px_32px_rgba(0,0,0,0.4)]">
        <p className="text-sm text-zinc-300 mb-3">
          We use cookies for authentication, analytics, and to improve your experience.
          See our{" "}
          <Link href="/privacy" className="text-violet-400 hover:underline">
            Privacy Policy
          </Link>{" "}
          for details.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={accept}
            className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Accept all
          </button>
          <button
            onClick={decline}
            className="border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Essential only
          </button>
        </div>
      </div>
    </div>
  );
}
