"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { TIERS, type TierFeature } from "@/lib/tiers";
import { Reveal } from "./ui/reveal";

type Currency = "usd" | "gbp" | "eur";
const SYMBOLS: Record<Currency, string> = { usd: "$", gbp: "\u00a3", eur: "\u20ac" };

function detectCurrency(): Currency {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.startsWith("America/")) return "usd";
    if (tz === "Europe/London") return "gbp";
    if (tz.startsWith("Europe/")) return "eur";
  } catch {}
  return "usd";
}

function FeatureItem({ feature }: { feature: TierFeature }) {
  const content = (
    <>
      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" />
      {feature.text}
    </>
  );

  if (feature.link) {
    return (
      <li>
        <Link
          href={feature.link}
          className="flex items-start gap-2.5 text-zinc-400 underline decoration-zinc-600/40 underline-offset-2 transition-colors hover:text-zinc-200 hover:decoration-zinc-500/60 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500"
        >
          {content}
        </Link>
      </li>
    );
  }

  return <li className="flex items-start gap-2.5">{content}</li>;
}

export function PricingSection() {
  const { data: session, status } = useSession();
  const currentTier = session?.user?.tierId;
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState<Currency>(() => detectCurrency());

  async function handleCheckout(tierId: string, trial = false) {
    setCheckoutLoading(tierId);
    setError("");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId, trial }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url);
        return; // Don't reset loading — page is navigating
      } else {
        setError(data.error || "Failed to start checkout. Please try again.");
        setCheckoutLoading(null);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setCheckoutLoading(null);
    }
  }

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="relative overflow-hidden border-t border-white/[0.04] bg-[#0a0a0b]"
    >
      <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.12),transparent_58%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/25 to-transparent" />

      <div className="relative mx-auto max-w-[90rem] px-6 py-16 lg:px-10 lg:py-24">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-violet-200/70">
              Pricing
            </p>
            <h2 id="pricing-heading" className="font-[family-name:var(--font-display)] text-[clamp(2.4rem,3.8vw,4rem)] font-bold leading-[1.04] tracking-[-0.03em] text-white">
              Start free. Upgrade when better signals start saving time.
            </h2>
            <p className="mt-5 text-[1.0625rem] leading-8 text-zinc-400">
              Keep your existing lists and tools. Use GetSignalHooks as the
              signal-backed workflow layer that helps your team decide what to send, what to review, and what to work next.
            </p>
          </div>
        </Reveal>

        <div className="mx-auto mt-8 flex items-center justify-center gap-1 rounded-full border border-white/8 bg-zinc-900/60 p-1 w-fit backdrop-blur-sm">
          {(["usd", "gbp", "eur"] as Currency[]).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              aria-pressed={currency === c}
              className={`px-4 py-2.5 rounded-full text-[0.8125rem] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b] ${
                currency === c
                  ? "bg-violet-600 text-white shadow-[0_0_18px_rgba(139,92,246,0.25)]"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {c === "usd" ? "USD ($)" : c === "gbp" ? "GBP (\u00a3)" : "EUR (\u20ac)"}
            </button>
          ))}
        </div>

        {error && (
          <div className="mx-auto mt-8 max-w-md bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <div className="mx-auto mt-16 grid max-w-5xl gap-5 sm:grid-cols-2 lg:mt-20">
          {TIERS.map((tier, i) => (
            <Reveal key={tier.id} delay={i * 0.1}>
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={`rounded-[1.75rem] border p-7 transition-[border-color,box-shadow] duration-300 relative ${
                tier.highlighted
                  ? "border-zinc-300/60 bg-[#f5f4f0] shadow-[0_20px_60px_rgba(0,0,0,0.14)]"
                  : "border-zinc-700/30 bg-[linear-gradient(180deg,rgba(19,19,28,0.96),rgba(11,11,17,0.98))] shadow-[0_18px_50px_rgba(0,0,0,0.2)] hover:border-zinc-600/40"
              }`}
            >
              <div className={`absolute inset-0 ${
                tier.highlighted
                  ? "bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.08),transparent_38%)]"
                  : "bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.12),transparent_34%)]"
              }`} />
              {tier.highlighted && (
                <div className="absolute left-7 top-4 rounded-full bg-violet-600 px-3 py-1 text-[0.6875rem] font-bold text-white shadow-[0_10px_24px_rgba(139,92,246,0.22)]">
                  Popular
                </div>
              )}
              <div className="relative">
                <h3 className={`text-[1.1875rem] font-bold ${tier.highlighted ? "pt-8 text-zinc-900" : "text-white"}`}>
                  {tier.name}
                </h3>
                <div className="mt-3 flex min-h-[3.75rem] items-end gap-1">
                  <span className={`text-[2.9rem] font-bold tracking-tight ${tier.highlighted ? "text-zinc-900" : "text-white"}`}>
                    {tier.price ? `${SYMBOLS[currency]}${tier.price[currency]}` : "Free"}
                  </span>
                  <span className={`text-[0.875rem] ${tier.highlighted ? "text-zinc-600" : "text-zinc-500"}`}>
                    {tier.price ? "/month" : ""}
                  </span>
                </div>
                <p className={`mt-3 text-[0.9375rem] leading-[1.7] ${tier.highlighted ? "text-zinc-700" : "text-zinc-400"}`}>
                  {tier.description}
                </p>
                <ul className={`mt-6 space-y-3 text-[0.875rem] leading-[1.55] ${tier.highlighted ? "text-zinc-700" : "text-zinc-400"}`}>
                  {tier.features.map((feature) => (
                    <FeatureItem key={feature.text} feature={feature} />
                  ))}
                </ul>
                <p className={`mt-6 rounded-[1rem] border px-4 py-3 text-[0.8125rem] leading-[1.6] ${
                  tier.highlighted
                    ? "border-zinc-300/70 bg-white/40 text-zinc-700"
                    : "border-white/[0.07] bg-white/[0.02] text-zinc-400"
                }`}>
                  {tier.bestFor}
                </p>
                {currentTier === tier.id ? (
                  <div className="mt-6 flex h-11 items-center justify-center rounded-full text-[0.875rem] font-semibold border border-emerald-600/40 text-emerald-400">
                    Current Plan
                  </div>
                ) : (
                  <div className="mt-6 flex flex-col gap-2">
                    <button
                      disabled={checkoutLoading === tier.id}
                      onClick={() => {
                        if (status === "loading") return;
                        if (!session) {
                          window.location.href = `/register?tier=${tier.id}`;
                        } else {
                          handleCheckout(tier.id);
                        }
                      }}
                      className={`flex h-11 items-center justify-center rounded-full text-[0.875rem] font-semibold transition-colors duration-150 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
                        tier.highlighted
                          ? "bg-violet-600 text-white hover:bg-violet-500 focus-visible:ring-offset-[#f5f4f0]"
                          : "border border-zinc-600/40 text-zinc-300 hover:border-violet-500/40 hover:text-white focus-visible:ring-offset-[#0a0a0b]"
                      }`}
                    >
                      {checkoutLoading === tier.id ? "Redirecting..." : tier.cta}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
            </Reveal>
          ))}
        </div>

      </div>
    </section>
  );
}
