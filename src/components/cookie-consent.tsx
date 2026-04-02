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
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-3 sm:p-6">
      <div className="mx-auto max-w-md rounded-[1.25rem] border border-zinc-700/50 bg-zinc-900/95 p-3.5 shadow-[0_-4px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:max-w-lg sm:p-4">
        <p className="mb-3 text-xs leading-5 text-zinc-300 sm:text-sm sm:leading-6">
          We use cookies for authentication, analytics, and to improve your experience.
          See our{" "}
          <Link href="/privacy" className="text-violet-400 hover:underline">
            Privacy Policy
          </Link>{" "}
          for details.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={accept}
            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-500"
          >
            Accept all
          </button>
          <button
            onClick={decline}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
          >
            Essential only
          </button>
        </div>
      </div>
    </div>
  );
}
