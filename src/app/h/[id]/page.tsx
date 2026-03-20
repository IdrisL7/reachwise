import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";
import { db, schema } from "@/lib/db";
import { SignalHooksLogo } from "@/components/ui/signalhooks-logo";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [shared] = await db
    .select({ hookText: schema.sharedHooks.hookText })
    .from(schema.sharedHooks)
    .where(eq(schema.sharedHooks.id, id))
    .limit(1);

  if (!shared) {
    return { title: "Hook not found — GetSignalHooks" };
  }

  return {
    title: shared.hookText.slice(0, 60) + (shared.hookText.length > 60 ? "…" : ""),
    description: "Evidence-backed outreach hook — powered by GetSignalHooks",
    openGraph: {
      title: shared.hookText.slice(0, 60),
      description: "Evidence-backed outreach hook — powered by GetSignalHooks",
      url: `https://getsignalhooks.com/h/${id}`,
    },
  };
}

const tierColors: Record<string, string> = {
  A: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  B: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  C: "bg-zinc-500/10 text-zinc-500 border-zinc-700/20",
};

const angleColors: Record<string, string> = {
  trigger: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  risk: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  tradeoff: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

export default async function SharedHookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [shared] = await db
    .select()
    .from(schema.sharedHooks)
    .where(eq(schema.sharedHooks.id, id))
    .limit(1);

  if (!shared) notFound();

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-[#eceae6] font-[family-name:var(--font-body)] flex flex-col">
      {/* Minimal header */}
      <header className="border-b border-white/[0.06] px-6 py-4 flex items-center gap-2.5">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <SignalHooksLogo />
          <span className="text-sm font-semibold text-[#eceae6]">SignalHooks</span>
        </Link>
      </header>

      <main className="flex-1 mx-auto max-w-2xl w-full px-6 py-12">
        <p className="text-[0.8125rem] font-semibold text-violet-400 mb-4 uppercase tracking-widest">
          Shared hook
        </p>

        {/* Hook card */}
        <div className="rounded-xl border border-[#252830] bg-[#14161a] p-6 mb-6">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            {shared.evidenceTier && (
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-bold ${tierColors[shared.evidenceTier] ?? tierColors["C"]}`}>
                Tier {shared.evidenceTier}
              </span>
            )}
            {shared.angle && (
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold ${angleColors[shared.angle] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-600/20"}`}>
                {shared.angle}
              </span>
            )}
            {shared.triggerType && (
              <span className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-blue-400">
                {shared.triggerType.replace(/_/g, " ")}
              </span>
            )}
          </div>

          {/* Hook text */}
          <p className="text-[1rem] leading-[1.65] text-zinc-100 mb-4">
            {shared.hookText}
          </p>

          {/* Promise */}
          {shared.promise && (
            <p className="text-[0.8125rem] text-zinc-400 mb-4">
              <span className="font-medium text-zinc-300">Promise:</span> {shared.promise}
            </p>
          )}

          {/* Evidence */}
          {shared.sourceSnippet && (
            <div className="rounded-lg border border-violet-500/10 bg-[#0e0d1a] px-4 py-3 text-[0.75rem] text-zinc-400">
              <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-violet-400/60">
                Evidence
              </p>
              <p className="text-[0.8125rem] leading-relaxed text-zinc-300/80 mb-1.5">
                {shared.sourceSnippet}
              </p>
              {shared.sourceTitle && (
                <div className="flex items-center gap-2 text-[0.75rem] text-zinc-500">
                  <span>Source:{" "}
                    {shared.sourceUrl ? (
                      <a
                        href={shared.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-400/70 underline decoration-violet-500/20 hover:text-violet-300 transition-colors"
                      >
                        {shared.sourceTitle}
                      </a>
                    ) : shared.sourceTitle}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Attribution */}
        <p className="text-center text-[0.75rem] text-zinc-600 mb-6">
          Generated with{" "}
          <Link href="/" className="text-zinc-500 hover:text-zinc-400 transition-colors underline underline-offset-2">
            GetSignalHooks
          </Link>
        </p>

        {/* CTA */}
        <div className="rounded-xl border border-violet-500/20 bg-violet-600/[0.06] px-6 py-5 text-center">
          <p className="text-[0.9375rem] font-semibold text-zinc-100 mb-1">
            {shared.targetCompanyName
              ? `Your contact generated this hook for ${shared.targetCompanyName}.`
              : "Generate hooks like this for your prospects."}
          </p>
          <p className="text-[0.8125rem] text-zinc-400 mb-4">
            Get evidence-backed opening lines for your own prospect list — 10 free hooks on signup.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-[0.875rem] font-semibold text-white hover:bg-violet-500 transition-colors"
          >
            Get 10 free hooks
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </main>
    </div>
  );
}
