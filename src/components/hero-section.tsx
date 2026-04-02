"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { Reveal } from "./ui/reveal";
import { ShinyText } from "./ui/shiny-text";

const heroVideoUrl =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_105406_16f4600d-7a92-4292-b96e-b19156c7830a.mp4";

export function HeroSection() {
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 120]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.72], [1, reduced ? 1 : 0.2]);
  const videoScale = useTransform(scrollYProgress, [0, 1], [1, reduced ? 1 : 1.08]);
  const videoSaturate = useTransform(scrollYProgress, [0, 1], [1, reduced ? 1 : 0.82]);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="hero-heading"
      className="relative min-h-screen overflow-hidden bg-[#000000]"
    >
      <div className="absolute inset-0">
        <motion.div style={{ scale: videoScale, filter: useTransform(videoSaturate, (value) => `saturate(${value})`) }} className="absolute inset-0">
          <video
            className="h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
          >
            <source src={heroVideoUrl} type="video/mp4" />
          </video>
        </motion.div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,2,6,0.54)_0%,rgba(5,5,10,0.62)_24%,rgba(7,7,12,0.7)_55%,rgba(8,8,11,0.92)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.34),transparent_38%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_34%)]" />
        <div className="absolute inset-y-0 left-0 w-[38%] bg-[linear-gradient(90deg,rgba(0,0,0,0.42),transparent)]" />
        <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/82 to-transparent" />
      </div>

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-6 pb-24 pt-28 sm:px-8 lg:px-10 lg:pb-28 lg:pt-32"
      >
        <div className="grid gap-8 text-sm text-white/80 md:text-base lg:grid-cols-2 lg:items-start">
          <Reveal delay={0.05}>
            <p className="max-w-md leading-6 md:leading-7">
              Turn live company signals into hooks, messages, and follow-up your outbound team can actually use.
            </p>
          </Reveal>

          <Reveal delay={0.12} className="lg:justify-self-end">
            <p className="max-w-xs leading-6 md:text-right md:leading-7">
              8,000+ signals processed into outreach-ready hooks.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 max-w-5xl">
          <Reveal delay={0.18}>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/80 md:text-sm">
              Live signal demo ready to explore
            </p>
          </Reveal>

          <Reveal delay={0.24}>
            <h1
              id="hero-heading"
              className="mt-5 font-[family-name:var(--font-display)] text-5xl font-medium leading-[0.85] tracking-[-0.06em] text-white sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl"
            >
              <span className="block">Catch</span>
              <ShinyText
                text="Signal Momentum."
                className="block"
                baseColor="#7c3aed"
                shineColor="#f8fafc"
                duration={3}
                spread={100}
              />
            </h1>
          </Reveal>

          <Reveal delay={0.32}>
            <p className="mt-8 max-w-2xl text-sm leading-7 text-white/80 md:text-base">
              Start with a company. GetSignalHooks finds the trigger, writes the hook, and keeps the proof attached through review and follow-up so reps can move faster without guessing.
            </p>
          </Reveal>

          <Reveal delay={0.4}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="#demo"
                className="group inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_60px_rgba(124,58,237,0.28)] transition-all duration-200 hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808] md:px-8 md:py-4 md:text-base"
              >
                Run the live demo
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>
          </Reveal>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.48 }}
            className="mt-14 max-w-xl lg:mt-16"
            aria-hidden="true"
          >
            <motion.div
              animate={reduced ? { y: 0 } : { y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: reduced ? 0 : Infinity, ease: [0.45, 0, 0.55, 1] }}
              className="overflow-hidden rounded-[1.75rem] border border-white/12 bg-black/45 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.52)] backdrop-blur-xl md:p-5"
            >
              <div className="flex items-center gap-2 border-b border-white/8 pb-3">
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-700/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-700/90" />
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-700/90" />
                <span className="ml-3 text-[0.7rem] uppercase tracking-[0.18em] text-white/45">
                  Live signal workflow
                </span>
              </div>

              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-violet-200/80">Detected signal</p>
                      <p className="mt-2 text-base font-semibold text-white">Product launch momentum at Gong</p>
                    </div>
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                      High intent
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-violet-200/80">Generated hook</p>
                  <p className="mt-2 text-sm leading-6 text-white/85">
                    Noticed Gong is leaning harder into AI forecasting. Curious whether your team is rethinking which revenue signals deserve a response first.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/50">Evidence attached</p>
                  <p className="mt-2 text-sm italic leading-6 text-white/70">
                    &ldquo;Gong Revenue Intelligence now includes AI-powered deal forecasting...&rdquo;
                  </p>
                  <p className="mt-2 truncate text-xs text-white/45">gong.io/blog/ai-deal-forecasting</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
          <div className="h-px bg-gradient-to-r from-transparent via-violet-400/45 to-transparent" />
        </div>
        <div className="h-20 bg-gradient-to-b from-transparent via-[#0a0a0b]/72 to-[#0a0a0b]" />
      </div>
    </section>
  );
}
