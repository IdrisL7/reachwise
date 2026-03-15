# OpenClaw Setup-as-a-Service Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone SaaS site that sells managed OpenClaw deployment — customers pay via Stripe, fill an intake form, and get a fully provisioned OpenClaw instance on a Hetzner VPS automatically.

**Architecture:** Next.js 16 App Router site on Vercel. Stripe Checkout for payments (one-time setup + monthly subscription). Post-payment intake form collects API keys and preferences. Provisioning API SSHs into a shared Hetzner VPS, creates a Docker Compose stack per customer, and configures Caddy reverse proxy for subdomain routing. Turso DB stores customers, intake responses, and instance state.

**Tech Stack:** Next.js 16, Tailwind CSS v4, Turso/libsql + Drizzle ORM, Stripe, SendGrid, ssh2, Caddy, Docker

---

## Task 1: Scaffold Next.js Project

**Files:**
- Create: `/home/idris/clawsetup/` (entire project)

**Step 1: Create the Next.js project**

```bash
cd /home/idris
pnpm create next-app@latest clawsetup --typescript --tailwind --eslint --app --turbopack --use-pnpm
```

Accept all defaults. This creates the project with App Router, TypeScript, Tailwind, ESLint.

**Step 2: Install dependencies**

```bash
cd /home/idris/clawsetup
pnpm add @libsql/client drizzle-orm stripe @sendgrid/mail ssh2 uuid bcryptjs
pnpm add -D drizzle-kit @types/ssh2 @types/bcryptjs @types/uuid vitest
```

**Step 3: Initialize git and commit**

```bash
cd /home/idris/clawsetup
git init
git add -A
git commit -m "chore: scaffold Next.js project with dependencies"
```

---

## Task 2: Design System — Dark Theme + Global Styles

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Step 1: Replace globals.css with dark theme tokens**

Replace the contents of `src/app/globals.css` with:

```css
@import "tailwindcss";

@theme {
  --radius-default: 0.5rem;
  --font-sans: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

:root {
  --background: 220 6% 10%;
  --foreground: 210 6% 93%;
  --card: 220 6% 13%;
  --card-foreground: 210 6% 93%;
  --primary: 213 100% 48%;
  --primary-foreground: 210 6% 93%;
  --secondary: 220 5% 15%;
  --secondary-foreground: 215 4% 55%;
  --muted: 220 5% 15%;
  --muted-foreground: 215 4% 58%;
  --accent: 220 5% 17%;
  --accent-foreground: 210 6% 93%;
  --border: 220 5% 18%;
  --input: 220 5% 18%;
  --ring: 213 100% 48%;
  --success: 160 72% 40%;
  --success-foreground: 160 59% 52%;
  --warning: 38 92% 50%;
  --warning-foreground: 43 96% 56%;
  --danger: 0 84% 60%;
  --danger-foreground: 0 94% 82%;
  --surface-1: 220 6% 11%;
  --surface-2: 220 6% 14%;
  --surface-1-border: 220 5% 17%;
  --surface-2-border: 220 5% 18%;
  color-scheme: dark;
}

body {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  font-size: 14px;
  letter-spacing: -0.011em;
  line-height: 1.5;
}
```

**Step 2: Update layout.tsx**

Replace `src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "ClawSetup — Run OpenClaw in the Cloud",
  description:
    "Managed OpenClaw hosting. We deploy, host, and manage your AI agent instance. No Docker, no DevOps, no headaches.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: dark design system with HSL tokens and Geist font"
```

---

## Task 3: Landing Page — Navbar + Hero Section

**Files:**
- Create: `src/components/navbar.tsx`
- Create: `src/components/hero-section.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create Navbar**

Create `src/components/navbar.tsx`:

```tsx
import Link from "next/link";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))/0.8] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-lg font-bold text-[hsl(var(--foreground))]">
          ClawSetup
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]">
            Features
          </a>
          <a href="#pricing" className="text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]">
            Pricing
          </a>
          <a href="#faq" className="text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]">
            FAQ
          </a>
          <a
            href="#pricing"
            className="rounded-lg bg-[hsl(var(--primary))] px-5 py-2 text-sm font-semibold text-white transition-all hover:opacity-90"
          >
            Get Started
          </a>
        </div>
      </div>
    </nav>
  );
}
```

**Step 2: Create Hero Section**

Create `src/components/hero-section.tsx`:

```tsx
export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-[hsl(var(--primary))/0.06] blur-[120px]" />
      <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 text-center lg:pt-32">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--primary))/0.2] bg-[hsl(var(--primary))/0.08] px-4 py-1.5 text-sm font-medium text-[hsl(var(--primary))]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[hsl(var(--primary))]" />
          Managed OpenClaw Hosting
        </span>
        <h1 className="mx-auto max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight text-[hsl(var(--foreground))] lg:text-7xl">
          Run OpenClaw in the Cloud — Zero DevOps Required
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[hsl(var(--muted-foreground))]">
          We deploy, host, and manage your OpenClaw instance. You get a running
          AI agent in under 5 minutes. No Docker, no terminals, no headaches.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <a
            href="#pricing"
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-8 text-base font-semibold text-white shadow-[0_0_24px_hsl(var(--primary)/0.25)] transition-all hover:opacity-90 hover:shadow-[0_0_36px_hsl(var(--primary)/0.35)]"
          >
            Get Started
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </a>
          <a
            href="#how-it-works"
            className="inline-flex h-12 items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-8 text-base font-semibold text-[hsl(var(--foreground))] transition-all hover:border-[hsl(var(--primary))/0.4]"
          >
            See how it works
          </a>
        </div>

        {/* Terminal mockup */}
        <div className="mx-auto mt-16 max-w-2xl overflow-hidden rounded-xl border border-[hsl(var(--surface-2-border))] bg-[hsl(var(--surface-1))] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-[hsl(var(--danger))]" />
            <span className="h-3 w-3 rounded-full bg-[hsl(var(--warning))]" />
            <span className="h-3 w-3 rounded-full bg-[hsl(var(--success))]" />
            <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">terminal</span>
          </div>
          <div className="p-6 font-mono text-sm leading-relaxed">
            <p className="text-[hsl(var(--muted-foreground))]">$ clawsetup deploy --plan pro</p>
            <p className="mt-2 text-[hsl(var(--success-foreground))]">✓ Instance provisioned</p>
            <p className="text-[hsl(var(--success-foreground))]">✓ Docker container running</p>
            <p className="text-[hsl(var(--success-foreground))]">✓ HTTPS configured</p>
            <p className="text-[hsl(var(--success-foreground))]">✓ Health check passed</p>
            <p className="mt-2 text-[hsl(var(--foreground))]">
              Your instance is live at{" "}
              <span className="text-[hsl(var(--primary))]">https://acme.clawsetup.com</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
```

**Step 3: Update page.tsx**

Replace `src/app/page.tsx` with:

```tsx
import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/hero-section";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
      </main>
    </>
  );
}
```

**Step 4: Verify it renders**

```bash
cd /home/idris/clawsetup && pnpm dev
```

Open http://localhost:3000 — verify dark theme, navbar, hero, terminal mockup render correctly.

**Step 5: Commit**

```bash
git add src/components/navbar.tsx src/components/hero-section.tsx src/app/page.tsx
git commit -m "feat: landing page navbar and hero section with terminal mockup"
```

---

## Task 4: Landing Page — Features Grid

**Files:**
- Create: `src/components/features-section.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create Features Section**

Create `src/components/features-section.tsx`:

```tsx
const features = [
  {
    title: "Instant Deployment",
    description: "Your OpenClaw instance provisioned automatically in under 5 minutes.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    title: "Messaging Integrations",
    description: "WhatsApp, Telegram, Discord — connect your agents to any channel.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
  },
  {
    title: "Web Browsing Built-in",
    description: "Agents can browse, research, and extract data from the web.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
  },
  {
    title: "24/7 Uptime",
    description: "Always-on hosting with monitoring and automatic restarts.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Isolated & Secure",
    description: "Each instance runs in an isolated Docker container with encrypted secrets.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    title: "No DevOps Required",
    description: "No Docker, no SSH, no terminal. Just fill a form and go.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
      </svg>
    ),
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-24">
      <div className="mb-16 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))] lg:text-4xl">
          Everything you need to run AI agents
        </h2>
        <p className="mt-4 text-lg text-[hsl(var(--muted-foreground))]">
          Focus on building agents, not managing infrastructure.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-[hsl(var(--surface-2-border))] bg-[hsl(var(--surface-1))] p-6 transition-all hover:border-[hsl(var(--primary))/0.3] hover:shadow-[0_0_20px_hsl(var(--primary))/0.05]"
          >
            <div className="mb-4 inline-flex rounded-lg bg-[hsl(var(--primary))/0.1] p-2.5 text-[hsl(var(--primary))]">
              {f.icon}
            </div>
            <h3 className="mb-2 text-base font-semibold text-[hsl(var(--foreground))]">{f.title}</h3>
            <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{f.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

**Step 2: Add to page.tsx**

Add `import { FeaturesSection } from "@/components/features-section";` and `<FeaturesSection />` after `<HeroSection />`.

**Step 3: Commit**

```bash
git add src/components/features-section.tsx src/app/page.tsx
git commit -m "feat: features grid with 6 benefit-oriented cards"
```

---

## Task 5: Landing Page — How It Works + Pricing + FAQ + Footer

**Files:**
- Create: `src/components/how-it-works-section.tsx`
- Create: `src/components/pricing-section.tsx`
- Create: `src/components/faq-section.tsx`
- Create: `src/components/footer.tsx`
- Create: `src/components/final-cta-section.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create How It Works**

Create `src/components/how-it-works-section.tsx`:

```tsx
const steps = [
  { number: "1", title: "Pick a plan", description: "Choose Basic or Pro based on your needs. Pay once for setup, then monthly for hosting." },
  { number: "2", title: "Tell us about your setup", description: "Fill the intake form with your API keys, preferred subdomain, and what you want your agents to do." },
  { number: "3", title: "Start building", description: "Your instance is live in minutes. We email you the URL and credentials. Start building agents immediately." },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="border-t border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))] lg:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-lg text-[hsl(var(--muted-foreground))]">
            Three steps to a running AI agent. Under 5 minutes total.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.number} className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-lg font-bold text-white">
                {s.number}
              </div>
              <h3 className="mb-2 text-lg font-semibold text-[hsl(var(--foreground))]">{s.title}</h3>
              <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**Step 2: Create Pricing Section**

Create `src/components/pricing-section.tsx`:

```tsx
const tiers = [
  {
    name: "Basic",
    setup: 200,
    monthly: 49,
    features: [
      "1 OpenClaw agent",
      "£15/mo API credit included",
      "Email support (48h response)",
      "Weekly backups",
      "Standard security",
      "Shared subdomain",
    ],
    cta: "Get Started",
    href: "/checkout/basic",
    highlighted: false,
  },
  {
    name: "Pro",
    setup: 500,
    monthly: 149,
    features: [
      "5 OpenClaw agents",
      "£50/mo API credit included",
      "Priority support (24h response)",
      "Daily backups",
      "Advanced security (firewall + fail2ban)",
      "Custom domain support",
    ],
    cta: "Get Started",
    href: "/checkout/pro",
    highlighted: true,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
      <div className="mb-16 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))] lg:text-4xl">
          Simple, transparent pricing
        </h2>
        <p className="mt-4 text-lg text-[hsl(var(--muted-foreground))]">
          One-time setup fee + monthly hosting. No contracts, cancel anytime.
        </p>
      </div>
      <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`relative rounded-xl border p-8 ${
              t.highlighted
                ? "border-[hsl(var(--primary))/0.5] bg-[hsl(var(--surface-2))] shadow-[0_0_30px_hsl(var(--primary))/0.08)]"
                : "border-[hsl(var(--surface-2-border))] bg-[hsl(var(--surface-1))]"
            }`}
          >
            {t.highlighted && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[hsl(var(--primary))] px-4 py-1 text-xs font-semibold text-white">
                Most Popular
              </span>
            )}
            <h3 className="text-xl font-bold text-[hsl(var(--foreground))]">{t.name}</h3>
            <div className="mt-4">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Setup: </span>
              <span className="text-2xl font-bold text-[hsl(var(--foreground))]">£{t.setup}</span>
              <span className="text-sm text-[hsl(var(--muted-foreground))]"> one-time</span>
            </div>
            <div className="mt-1">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Then </span>
              <span className="text-3xl font-bold text-[hsl(var(--foreground))]">£{t.monthly}</span>
              <span className="text-sm text-[hsl(var(--muted-foreground))]">/month</span>
            </div>
            <ul className="mt-8 space-y-3">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--success))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href={t.href}
              className={`mt-8 block rounded-lg py-3 text-center text-sm font-semibold transition-all ${
                t.highlighted
                  ? "bg-[hsl(var(--primary))] text-white hover:opacity-90"
                  : "border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))/0.4]"
              }`}
            >
              {t.cta}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
```

**Step 3: Create FAQ Section**

Create `src/components/faq-section.tsx`:

```tsx
"use client";

import { useState } from "react";

const faqs = [
  { q: "What is OpenClaw?", a: "OpenClaw is an open-source AI agent framework that lets you build and run autonomous AI agents. We handle the hosting and infrastructure so you can focus on building." },
  { q: "How long does setup take?", a: "Under 5 minutes. After payment, fill the intake form and your instance is provisioned automatically. You'll receive credentials by email." },
  { q: "What API keys do I need?", a: "You need at least one: an OpenAI API key or an Anthropic API key. You provide these during onboarding and we securely store them encrypted." },
  { q: "Can I migrate from self-hosted?", a: "Yes. Provide your existing configuration during onboarding and we'll set up your instance to match. Data migration support is available on Pro." },
  { q: "What happens if I cancel?", a: "Your instance runs until the end of the billing period. We export your data and delete the instance after 30 days. No lock-in." },
  { q: "Is my data secure?", a: "Each instance runs in an isolated Docker container. API keys are encrypted with AES-256-GCM at rest. Pro tier includes advanced firewall rules and fail2ban." },
  { q: "Do you store my API keys?", a: "Yes, encrypted at rest using AES-256-GCM. They're only decrypted inside your isolated container. We never log or access them." },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="border-t border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h2 className="mb-12 text-center text-3xl font-bold tracking-tight text-[hsl(var(--foreground))] lg:text-4xl">
          Frequently asked questions
        </h2>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-lg border border-[hsl(var(--surface-2-border))] bg-[hsl(var(--background))]">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-medium text-[hsl(var(--foreground))]"
              >
                {faq.q}
                <svg
                  className={`h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${open === i ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {open === i && (
                <div className="border-t border-[hsl(var(--border))] px-6 py-4 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**Step 4: Create Final CTA**

Create `src/components/final-cta-section.tsx`:

```tsx
export function FinalCtaSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 text-center">
      <h2 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))] lg:text-4xl">
        Ready to deploy your AI agent?
      </h2>
      <p className="mt-4 text-lg text-[hsl(var(--muted-foreground))]">
        Get started in under 5 minutes — no DevOps required.
      </p>
      <a
        href="#pricing"
        className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-8 text-base font-semibold text-white shadow-[0_0_24px_hsl(var(--primary)/0.25)] transition-all hover:opacity-90"
      >
        Get Started
      </a>
    </section>
  );
}
```

**Step 5: Create Footer**

Create `src/components/footer.tsx`:

```tsx
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[hsl(var(--border))]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 md:flex-row">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          © {new Date().getFullYear()} ClawSetup. All rights reserved.
        </p>
        <div className="flex items-center gap-6">
          <Link href="/terms" className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            Terms
          </Link>
          <Link href="/privacy" className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            Privacy
          </Link>
          <a href="mailto:support@clawsetup.com" className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}
```

**Step 6: Update page.tsx with all sections**

```tsx
import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/hero-section";
import { FeaturesSection } from "@/components/features-section";
import { HowItWorksSection } from "@/components/how-it-works-section";
import { PricingSection } from "@/components/pricing-section";
import { FaqSection } from "@/components/faq-section";
import { FinalCtaSection } from "@/components/final-cta-section";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </>
  );
}
```

**Step 7: Commit**

```bash
git add src/components/ src/app/page.tsx
git commit -m "feat: complete landing page — how it works, pricing, FAQ, CTA, footer"
```

---

## Task 6: Database Schema + Drizzle Setup

**Files:**
- Create: `src/lib/db/schema.ts`
- Create: `src/lib/db/index.ts`
- Create: `drizzle.config.ts`
- Create: `.env.example`

**Step 1: Create schema**

Create `src/lib/db/schema.ts`:

```ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  company: text("company"),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  tier: text("tier").notNull().default("basic"),
  status: text("status").notNull().default("active"),
  onboardingToken: text("onboarding_token"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const intakeResponses = sqliteTable("intake_responses", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => customers.id),
  subdomain: text("subdomain").notNull().unique(),
  instancePassword: text("instance_password").notNull(),
  openaiKeyEncrypted: text("openai_key_encrypted"),
  anthropicKeyEncrypted: text("anthropic_key_encrypted"),
  teamSize: text("team_size"),
  useCase: text("use_case"),
  onboardingPref: text("onboarding_pref"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const instances = sqliteTable("instances", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull().references(() => customers.id),
  subdomain: text("subdomain").notNull().unique(),
  port: integer("port").notNull().unique(),
  status: text("status").notNull().default("queued"),
  instanceUrl: text("instance_url"),
  errorMessage: text("error_message"),
  provisionedAt: text("provisioned_at"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});
```

**Step 2: Create db client**

Create `src/lib/db/index.ts`:

```ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
export { schema };
```

**Step 3: Create drizzle config**

Create `drizzle.config.ts`:

```ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
```

**Step 4: Create .env.example**

Create `.env.example`:

```
# Database (Turso)
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_BASIC_SETUP_PRICE_ID=price_...
STRIPE_BASIC_HOSTING_PRICE_ID=price_...
STRIPE_PRO_SETUP_PRICE_ID=price_...
STRIPE_PRO_HOSTING_PRICE_ID=price_...

# SendGrid
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=hello@clawsetup.com

# Hetzner VPS (for provisioning)
HETZNER_SSH_HOST=
HETZNER_SSH_USER=root
HETZNER_SSH_PRIVATE_KEY=

# Encryption
ENCRYPTION_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Step 5: Update .gitignore to allow .env.example**

Add `!.env.example` under the env section.

**Step 6: Commit**

```bash
git add src/lib/db/ drizzle.config.ts .env.example .gitignore
git commit -m "feat: database schema (customers, intake_responses, instances) + Drizzle config"
```

---

## Task 7: Stripe Checkout Routes

**Files:**
- Create: `src/lib/stripe.ts`
- Create: `src/app/checkout/[tier]/route.ts`
- Create: `src/app/api/webhooks/stripe/route.ts`

**Step 1: Create Stripe utility**

Create `src/lib/stripe.ts`:

```ts
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export function getPriceIds(tier: "basic" | "pro") {
  if (tier === "pro") {
    return {
      setup: process.env.STRIPE_PRO_SETUP_PRICE_ID!,
      hosting: process.env.STRIPE_PRO_HOSTING_PRICE_ID!,
    };
  }
  return {
    setup: process.env.STRIPE_BASIC_SETUP_PRICE_ID!,
    hosting: process.env.STRIPE_BASIC_HOSTING_PRICE_ID!,
  };
}
```

**Step 2: Create checkout route**

Create `src/app/checkout/[tier]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { stripe, getPriceIds } from "@/lib/stripe";
import { v4 as uuid } from "uuid";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tier: string }> }
) {
  const { tier } = await params;
  if (tier !== "basic" && tier !== "pro") {
    return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL!));
  }

  const prices = getPriceIds(tier);
  const onboardingToken = uuid();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      { price: prices.setup, quantity: 1 },
      { price: prices.hosting, quantity: 1 },
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?token=${onboardingToken}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/#pricing`,
    metadata: { tier, onboarding_token: onboardingToken },
  });

  return NextResponse.redirect(session.url!);
}
```

**Step 3: Create Stripe webhook**

Create `src/app/api/webhooks/stripe/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db, schema } from "@/lib/db";
import { v4 as uuid } from "uuid";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { tier, onboarding_token } = session.metadata || {};

    await db.insert(schema.customers).values({
      id: uuid(),
      email: session.customer_email || session.customer_details?.email || "",
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
      tier: tier || "basic",
      onboardingToken: onboarding_token || null,
    });
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const { eq } = await import("drizzle-orm");
    await db
      .update(schema.customers)
      .set({ status: "cancelled" })
      .where(eq(schema.customers.stripeSubscriptionId, sub.id));
  }

  return NextResponse.json({ received: true });
}
```

**Step 4: Commit**

```bash
git add src/lib/stripe.ts src/app/checkout/ src/app/api/webhooks/stripe/
git commit -m "feat: Stripe checkout flow (basic + pro) and webhook handler"
```

---

## Task 8: Onboarding Intake Form

**Files:**
- Create: `src/app/onboarding/page.tsx`
- Create: `src/app/api/onboarding/route.ts`
- Create: `src/lib/encryption.ts`

**Step 1: Create encryption utility**

Create `src/lib/encryption.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey() {
  const key = process.env.ENCRYPTION_KEY!;
  return Buffer.from(key, "hex");
}

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${tag}:${encrypted}`;
}

export function decrypt(data: string): string {
  const [ivHex, tagHex, encrypted] = data.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
```

**Step 2: Create onboarding API route**

Create `src/app/api/onboarding/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { encrypt } from "@/lib/encryption";
import { v4 as uuid } from "uuid";
import { hash } from "bcryptjs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { token, password, openaiKey, anthropicKey, subdomain, company, teamSize, useCase, onboardingPref } = body;

  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  if (!password || password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  if (!openaiKey && !anthropicKey) return NextResponse.json({ error: "At least one API key required" }, { status: 400 });
  if (!subdomain || !/^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$/.test(subdomain)) {
    return NextResponse.json({ error: "Subdomain must be 3-30 chars, alphanumeric + hyphens" }, { status: 400 });
  }
  if (!company) return NextResponse.json({ error: "Company name required" }, { status: 400 });

  // Verify token matches a customer
  const [customer] = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.onboardingToken, token))
    .limit(1);

  if (!customer) return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });

  // Check subdomain uniqueness
  const [existing] = await db
    .select()
    .from(schema.intakeResponses)
    .where(eq(schema.intakeResponses.subdomain, subdomain))
    .limit(1);

  if (existing) return NextResponse.json({ error: "Subdomain already taken" }, { status: 409 });

  const hashedPassword = await hash(password, 10);
  const intakeId = uuid();

  await db.insert(schema.intakeResponses).values({
    id: intakeId,
    customerId: customer.id,
    subdomain,
    instancePassword: hashedPassword,
    openaiKeyEncrypted: openaiKey ? encrypt(openaiKey) : null,
    anthropicKeyEncrypted: anthropicKey ? encrypt(anthropicKey) : null,
    teamSize,
    useCase,
    onboardingPref,
  });

  // Create instance record (queued for provisioning)
  const nextPort = 10001; // TODO: query max port + 1
  const instanceId = uuid();

  await db.insert(schema.instances).values({
    id: instanceId,
    customerId: customer.id,
    subdomain,
    port: nextPort,
    status: "queued",
  });

  // Clear onboarding token (single use)
  await db
    .update(schema.customers)
    .set({ onboardingToken: null, company })
    .where(eq(schema.customers.id, customer.id));

  return NextResponse.json({ instanceId, subdomain });
}
```

**Step 3: Create onboarding page**

Create `src/app/onboarding/page.tsx`:

```tsx
"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function OnboardingForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [form, setForm] = useState({
    password: "",
    openaiKey: "",
    anthropicKey: "",
    subdomain: "",
    company: "",
    teamSize: "",
    useCase: "",
    onboardingPref: "self-serve",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Invalid Link</h1>
        <p className="mt-2 text-[hsl(var(--muted-foreground))]">This onboarding link is invalid or has expired.</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      router.push(`/success?instance=${data.instanceId}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const inputClass =
    "w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-4 py-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]";
  const labelClass = "mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Set up your instance</h1>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          Fill in the details below and we&apos;ll provision your OpenClaw instance.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-[hsl(var(--danger))/0.3] bg-[hsl(var(--danger))/0.08] px-4 py-3 text-sm text-[hsl(var(--danger-foreground))]">
          {error}
        </div>
      )}

      {/* Account */}
      <fieldset className="space-y-4 rounded-xl border border-[hsl(var(--surface-2-border))] bg-[hsl(var(--surface-1))] p-6">
        <legend className="px-2 text-sm font-semibold text-[hsl(var(--foreground))]">Account</legend>
        <div>
          <label className={labelClass}>Instance Password *</label>
          <input type="password" required minLength={8} placeholder="Min 8 characters" className={inputClass} value={form.password} onChange={(e) => update("password", e.target.value)} />
        </div>
      </fieldset>

      {/* API Keys */}
      <fieldset className="space-y-4 rounded-xl border border-[hsl(var(--surface-2-border))] bg-[hsl(var(--surface-1))] p-6">
        <legend className="px-2 text-sm font-semibold text-[hsl(var(--foreground))]">API Keys (at least one required)</legend>
        <div>
          <label className={labelClass}>OpenAI API Key</label>
          <input type="password" placeholder="sk-..." className={inputClass} value={form.openaiKey} onChange={(e) => update("openaiKey", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Anthropic API Key</label>
          <input type="password" placeholder="sk-ant-..." className={inputClass} value={form.anthropicKey} onChange={(e) => update("anthropicKey", e.target.value)} />
        </div>
      </fieldset>

      {/* Instance */}
      <fieldset className="space-y-4 rounded-xl border border-[hsl(var(--surface-2-border))] bg-[hsl(var(--surface-1))] p-6">
        <legend className="px-2 text-sm font-semibold text-[hsl(var(--foreground))]">Instance</legend>
        <div>
          <label className={labelClass}>Subdomain *</label>
          <div className="flex items-center gap-2">
            <input type="text" required pattern="[a-z0-9][a-z0-9-]{1,28}[a-z0-9]" placeholder="acme" className={inputClass} value={form.subdomain} onChange={(e) => update("subdomain", e.target.value.toLowerCase())} />
            <span className="shrink-0 text-sm text-[hsl(var(--muted-foreground))]">.clawsetup.com</span>
          </div>
        </div>
        <div>
          <label className={labelClass}>Company Name *</label>
          <input type="text" required placeholder="Acme Corp" className={inputClass} value={form.company} onChange={(e) => update("company", e.target.value)} />
        </div>
      </fieldset>

      {/* About You */}
      <fieldset className="space-y-4 rounded-xl border border-[hsl(var(--surface-2-border))] bg-[hsl(var(--surface-1))] p-6">
        <legend className="px-2 text-sm font-semibold text-[hsl(var(--foreground))]">About You</legend>
        <div>
          <label className={labelClass}>Team Size</label>
          <div className="flex flex-wrap gap-2">
            {["Solo", "2-5", "6-20", "20+"].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => update("teamSize", size)}
                className={`rounded-lg border px-4 py-2 text-sm transition-all ${
                  form.teamSize === size
                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))/0.1] text-[hsl(var(--primary))]"
                    : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))/0.3]"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass}>What will your agents do?</label>
          <textarea rows={3} placeholder="e.g. Customer support, research, data extraction..." className={inputClass} value={form.useCase} onChange={(e) => update("useCase", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Onboarding Preference</label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "self-serve", label: "Self-serve docs" },
              { value: "email", label: "Guided walkthrough email" },
              { value: "call", label: "Quick call" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => update("onboardingPref", opt.value)}
                className={`rounded-lg border px-4 py-2 text-sm transition-all ${
                  form.onboardingPref === opt.value
                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))/0.1] text-[hsl(var(--primary))]"
                    : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))/0.3]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[hsl(var(--primary))] py-3 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Setting up your instance..." : "Provision My Instance"}
      </button>
    </form>
  );
}

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <Suspense fallback={<div className="text-center text-[hsl(var(--muted-foreground))]">Loading...</div>}>
        <OnboardingForm />
      </Suspense>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/lib/encryption.ts src/app/api/onboarding/ src/app/onboarding/
git commit -m "feat: onboarding intake form with encrypted API key storage"
```

---

## Task 9: Provisioning System

**Files:**
- Create: `src/lib/provision.ts`
- Create: `src/app/api/provision/route.ts`
- Create: `src/app/success/page.tsx`
- Create: `src/app/api/instances/[id]/status/route.ts`

**Step 1: Create provisioning utility**

Create `src/lib/provision.ts`:

```ts
import { Client } from "ssh2";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";

const DOCKER_COMPOSE_TEMPLATE = (port: number, envVars: Record<string, string>) => `
services:
  openclaw:
    image: openclaw/openclaw:latest
    restart: unless-stopped
    ports:
      - "${port}:3000"
    environment:
${Object.entries(envVars)
  .map(([k, v]) => `      - ${k}=${v}`)
  .join("\n")}
    volumes:
      - ./data:/app/data
`;

const CADDYFILE_ENTRY = (subdomain: string, port: number) =>
  `${subdomain}.clawsetup.com {\n  reverse_proxy localhost:${port}\n}\n`;

function sshExec(conn: Client, cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let output = "";
      stream.on("data", (data: Buffer) => { output += data.toString(); });
      stream.stderr.on("data", (data: Buffer) => { output += data.toString(); });
      stream.on("close", () => resolve(output));
    });
  });
}

export async function provisionInstance(instanceId: string) {
  // Get instance + intake data
  const [instance] = await db.select().from(schema.instances).where(eq(schema.instances.id, instanceId)).limit(1);
  if (!instance) throw new Error("Instance not found");

  const [intake] = await db.select().from(schema.intakeResponses).where(eq(schema.intakeResponses.customerId, instance.customerId)).limit(1);
  if (!intake) throw new Error("Intake not found");

  // Update status to provisioning
  await db.update(schema.instances).set({ status: "provisioning" }).where(eq(schema.instances.id, instanceId));

  const conn = new Client();

  try {
    await new Promise<void>((resolve, reject) => {
      conn.on("ready", resolve);
      conn.on("error", reject);
      conn.connect({
        host: process.env.HETZNER_SSH_HOST!,
        username: process.env.HETZNER_SSH_USER || "root",
        privateKey: process.env.HETZNER_SSH_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      });
    });

    const dir = `/opt/instances/${instance.subdomain}`;

    // Create directory
    await sshExec(conn, `mkdir -p ${dir}`);

    // Build env vars
    const envVars: Record<string, string> = { ADMIN_PASSWORD: intake.instancePassword };
    if (intake.openaiKeyEncrypted) envVars.OPENAI_API_KEY = decrypt(intake.openaiKeyEncrypted);
    if (intake.anthropicKeyEncrypted) envVars.ANTHROPIC_API_KEY = decrypt(intake.anthropicKeyEncrypted);

    // Write docker-compose.yml
    const compose = DOCKER_COMPOSE_TEMPLATE(instance.port, envVars);
    await sshExec(conn, `cat > ${dir}/docker-compose.yml << 'COMPOSEEOF'\n${compose}\nCOMPOSEEOF`);

    // Start container
    await sshExec(conn, `cd ${dir} && docker compose up -d`);

    // Add Caddy entry
    const caddyEntry = CADDYFILE_ENTRY(instance.subdomain, instance.port);
    await sshExec(conn, `cat >> /etc/caddy/Caddyfile << 'CADDYEOF'\n${caddyEntry}\nCADDYEOF`);
    await sshExec(conn, "caddy reload --config /etc/caddy/Caddyfile");

    // Health check (wait up to 30s)
    let healthy = false;
    for (let i = 0; i < 6; i++) {
      const result = await sshExec(conn, `curl -sf http://localhost:${instance.port}/health || echo FAIL`);
      if (!result.includes("FAIL")) { healthy = true; break; }
      await new Promise((r) => setTimeout(r, 5000));
    }

    const instanceUrl = `https://${instance.subdomain}.clawsetup.com`;
    await db.update(schema.instances).set({
      status: healthy ? "active" : "failed",
      instanceUrl: healthy ? instanceUrl : null,
      errorMessage: healthy ? null : "Health check failed after 30s",
      provisionedAt: healthy ? new Date().toISOString() : null,
    }).where(eq(schema.instances.id, instanceId));

    conn.end();
    return { status: healthy ? "active" : "failed", url: instanceUrl };
  } catch (err) {
    conn.end();
    const message = err instanceof Error ? err.message : "Unknown provisioning error";
    await db.update(schema.instances).set({ status: "failed", errorMessage: message }).where(eq(schema.instances.id, instanceId));
    throw err;
  }
}
```

**Step 2: Create provision API route**

Create `src/app/api/provision/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { provisionInstance } from "@/lib/provision";

export async function POST(req: NextRequest) {
  const { instanceId } = await req.json();
  if (!instanceId) return NextResponse.json({ error: "Missing instanceId" }, { status: 400 });

  try {
    const result = await provisionInstance(instanceId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Provisioning failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const maxDuration = 60;
```

**Step 3: Create instance status route**

Create `src/app/api/instances/[id]/status/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [instance] = await db
    .select({ status: schema.instances.status, url: schema.instances.instanceUrl, error: schema.instances.errorMessage })
    .from(schema.instances)
    .where(eq(schema.instances.id, id))
    .limit(1);

  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(instance);
}
```

**Step 4: Create success page**

Create `src/app/success/page.tsx`:

```tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SuccessContent() {
  const searchParams = useSearchParams();
  const instanceId = searchParams.get("instance");
  const [status, setStatus] = useState<string>("queued");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!instanceId) return;

    // Trigger provisioning
    fetch("/api/provision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instanceId }),
    });

    // Poll status
    const interval = setInterval(async () => {
      const res = await fetch(`/api/instances/${instanceId}/status`);
      const data = await res.json();
      setStatus(data.status);
      if (data.url) setUrl(data.url);
      if (data.error) setError(data.error);
      if (data.status === "active" || data.status === "failed") {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [instanceId]);

  const steps = [
    { label: "Creating container", done: status !== "queued" },
    { label: "Configuring environment", done: status === "provisioning" || status === "active" },
    { label: "Starting services", done: status === "active" },
    { label: "Running health check", done: status === "active" },
  ];

  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
        {status === "active" ? "Your instance is live!" : status === "failed" ? "Provisioning failed" : "Setting up your instance..."}
      </h1>

      <div className="mx-auto mt-8 max-w-sm space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            {step.done ? (
              <svg className="h-5 w-5 text-[hsl(var(--success))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[hsl(var(--border))] border-t-[hsl(var(--primary))]" />
            )}
            <span className={step.done ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {url && (
        <div className="mt-8 rounded-xl border border-[hsl(var(--success))/0.3] bg-[hsl(var(--success))/0.08] p-6">
          <p className="text-sm text-[hsl(var(--success-foreground))]">Your instance is ready at:</p>
          <a href={url} target="_blank" className="mt-2 block text-lg font-semibold text-[hsl(var(--primary))] hover:underline">
            {url}
          </a>
          <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
            Credentials have been sent to your email.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-xl border border-[hsl(var(--danger))/0.3] bg-[hsl(var(--danger))/0.08] p-6">
          <p className="text-sm text-[hsl(var(--danger-foreground))]">{error}</p>
          <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
            Contact support@clawsetup.com for help.
          </p>
        </div>
      )}
    </div>
  );
}

export default function SuccessPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24">
      <Suspense fallback={<div className="text-center text-[hsl(var(--muted-foreground))]">Loading...</div>}>
        <SuccessContent />
      </Suspense>
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add src/lib/provision.ts src/app/api/provision/ src/app/api/instances/ src/app/success/
git commit -m "feat: automated provisioning via SSH + Docker Compose + real-time status page"
```

---

## Task 10: Terms + Privacy + Final Polish

**Files:**
- Create: `src/app/terms/page.tsx`
- Create: `src/app/privacy/page.tsx`

**Step 1: Create Terms page**

Create `src/app/terms/page.tsx` with basic terms of service covering: service description, billing (setup + monthly), cancellation (30-day data retention), acceptable use, data handling, liability limitation. Include the Navbar and Footer.

**Step 2: Create Privacy page**

Create `src/app/privacy/page.tsx` with privacy policy covering: data collected (email, company, API keys), encryption (AES-256-GCM), third parties (Stripe, SendGrid, Hetzner), data retention, user rights, contact info. Include the Navbar and Footer.

**Step 3: Build and verify**

```bash
cd /home/idris/clawsetup && pnpm build
```

Expected: Clean build, no errors.

**Step 4: Commit**

```bash
git add src/app/terms/ src/app/privacy/
git commit -m "feat: terms of service and privacy policy pages"
```

---

## Task 11: Deploy to Vercel

**Step 1: Create Vercel project**

```bash
cd /home/idris/clawsetup && npx vercel
```

Follow prompts — link to new project, accept defaults.

**Step 2: Set environment variables**

Set all env vars from `.env.example` in Vercel dashboard or via CLI.

**Step 3: Deploy**

```bash
npx vercel --prod
```

**Step 4: Verify**

- Landing page loads with dark theme
- All sections render correctly
- Pricing CTAs link to `/checkout/basic` and `/checkout/pro`
- Mobile responsive

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Scaffold project | New Next.js project |
| 2 | Design system | globals.css, layout.tsx |
| 3 | Hero + Navbar | navbar.tsx, hero-section.tsx, page.tsx |
| 4 | Features grid | features-section.tsx |
| 5 | How it works + Pricing + FAQ + Footer | 5 components, page.tsx |
| 6 | Database schema | schema.ts, db/index.ts, drizzle.config.ts |
| 7 | Stripe checkout | stripe.ts, checkout route, webhook |
| 8 | Onboarding form | encryption.ts, onboarding API + page |
| 9 | Provisioning system | provision.ts, API routes, success page |
| 10 | Terms + Privacy | Legal pages |
| 11 | Deploy | Vercel deployment |
