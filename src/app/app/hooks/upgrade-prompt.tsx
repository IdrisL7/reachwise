"use client";

import Link from "next/link";

interface UpgradePromptProps {
  title: string;
  message: string;
  cta: string;
  href: string;
}

export function UpgradePrompt({ title, message, cta, href }: UpgradePromptProps) {
  return (
    <div className="bg-violet-900/30 border border-violet-800 rounded-xl px-5 py-4 mb-6 animate-scale-in">
      <h3 className="text-sm font-semibold text-violet-200 mb-1">{title}</h3>
      <p className="text-sm text-violet-300/80 mb-3">{message}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-[0_0_16px_rgba(139,92,246,0.2)] hover:shadow-[0_0_24px_rgba(139,92,246,0.3)] transition-all duration-200"
      >
        {cta}
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </Link>
    </div>
  );
}
