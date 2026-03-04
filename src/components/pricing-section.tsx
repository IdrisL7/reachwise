"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { TIERS, type TierFeature } from "@/lib/tiers";

function FeatureItem({ feature }: { feature: TierFeature }) {
  const content = (
    <>
      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
      {feature.text}
    </>
  );

  if (feature.link) {
    return (
      <li>
        <Link
          href={feature.link}
          className="flex items-start gap-2.5 text-violet-300/90 underline decoration-violet-500/30 underline-offset-2 transition-colors hover:text-violet-300 hover:decoration-violet-500/60"
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
  const currentTier = (session?.user as any)?.tierId;
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

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
        window.location.href = data.url;
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
      className="border-t border-white/[0.06] bg-[#0b0b10]"
    >
      <div className="mx-auto max-w-[90rem] px-6 py-28 lg:px-10 lg:py-40">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-4 text-[0.9375rem] font-semibold text-violet-400">
            Pricing
          </p>
          <h2 className="text-[clamp(2.25rem,3.5vw,3.75rem)] font-bold leading-[1.04] tracking-[-0.02em] text-white">
            Pricing that fits how you already do outbound
          </h2>
          <p className="mt-5 text-[1.0625rem] leading-[1.6] text-zinc-400">
            Keep your existing lists and tools. Use GetSignalHooks as the
            evidence-first layer that makes your messages worth sending.
          </p>
        </div>

        {error && (
          <div className="mx-auto mt-8 max-w-md bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <div className="mx-auto mt-16 grid max-w-5xl gap-5 sm:grid-cols-3 lg:mt-20">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`group rounded-xl border p-7 transition-all duration-300 hover:-translate-y-0.5 relative ${
                tier.highlighted
                  ? "border-violet-500/30 bg-gradient-to-br from-[#15132a]/80 to-[#0f0f18]/60 shadow-[0_2px_24px_rgba(139,92,246,0.08)] hover:border-violet-500/50 hover:shadow-[0_4px_32px_rgba(139,92,246,0.12)]"
                  : "border-zinc-700/30 bg-gradient-to-br from-[#131320]/60 to-[#0f0f16]/40 shadow-[0_2px_16px_rgba(0,0,0,0.2)] hover:border-violet-500/20 hover:shadow-[0_4px_24px_rgba(139,92,246,0.06)]"
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-7 rounded-full bg-violet-600 px-3 py-0.5 text-[0.6875rem] font-bold text-white shadow-[0_0_12px_rgba(139,92,246,0.3)]">
                  Popular
                </div>
              )}
              <h3 className="text-[1.1875rem] font-bold text-white">
                {tier.name}
              </h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-[2.75rem] font-bold tracking-tight text-white">
                  £{tier.price}
                </span>
                <span className="text-[0.875rem] text-zinc-500">/month</span>
              </div>
              <p className="mt-3 text-[0.9375rem] leading-[1.6] text-zinc-400">
                {tier.description}
              </p>
              <ul className="mt-6 space-y-3 text-[0.875rem] leading-[1.5] text-zinc-400">
                {tier.features.map((feature) => (
                  <FeatureItem key={feature.text} feature={feature} />
                ))}
              </ul>
              <p className="mt-6 text-[0.8125rem] leading-[1.5] text-zinc-500">
                {tier.bestFor}
              </p>
              {currentTier === tier.id ? (
                <div className="mt-6 flex h-11 items-center justify-center rounded-lg text-[0.875rem] font-semibold border border-emerald-600/40 text-emerald-400">
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
                        handleCheckout(tier.id, tier.id === "starter");
                      }
                    }}
                    className={`flex h-11 items-center justify-center rounded-lg text-[0.875rem] font-semibold transition-all duration-200 hover:scale-[1.02] cursor-pointer disabled:opacity-50 disabled:hover:scale-100 ${
                      tier.highlighted
                        ? "bg-violet-600 text-white shadow-[0_0_16px_rgba(139,92,246,0.2)] hover:bg-violet-500 hover:shadow-[0_0_24px_rgba(139,92,246,0.35)] active:scale-[0.97]"
                        : "border border-zinc-600/40 text-zinc-300 hover:border-violet-500/40 hover:text-white hover:shadow-[0_2px_12px_rgba(139,92,246,0.06)]"
                    }`}
                  >
                    {checkoutLoading === tier.id ? "Redirecting..." : tier.cta}
                  </button>
                  {tier.id === "concierge" && (
                    <Link
                      href="/contact"
                      className="flex h-9 items-center justify-center rounded-lg text-[0.8125rem] font-medium border border-zinc-600/40 text-zinc-400 hover:text-white hover:border-violet-500/40 transition-all duration-200"
                    >
                      or Book a call
                    </Link>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mx-auto mt-8 max-w-5xl rounded-xl border border-zinc-700/30 bg-gradient-to-br from-[#131320]/60 to-[#0f0f16]/40 p-7 shadow-[0_2px_16px_rgba(0,0,0,0.2)]">
          <h3 className="text-[1.0625rem] font-bold text-white mb-3">
            All plans include
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2 text-[0.9375rem] leading-[1.6] text-zinc-400">
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
              Evidence-first hooks anchored on real public signals
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
              Signal, Implication, Question structure baked in
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
              Angle tags (trigger / risk / tradeoff) and confidence levels
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
              Evidence snippets and source titles for every hook
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
