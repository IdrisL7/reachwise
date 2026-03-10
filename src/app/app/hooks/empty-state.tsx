"use client";

interface ExampleCompany {
  url: string;
  name: string;
  role: string;
}

interface EmptyStateProps {
  onTryExample: (url: string, role: string) => void;
  examples: ExampleCompany[];
}

export function EmptyState({ onTryExample, examples }: EmptyStateProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center animate-fade-in">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/10">
        <svg className="h-7 w-7 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-zinc-200 mb-2">
        Generate your first hooks
      </h2>
      <p className="text-sm text-zinc-500 max-w-md mx-auto mb-5">
        Paste a company URL, pick a role, and we&apos;ll turn public signals into evidence-backed hooks you can copy into outbound.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs text-zinc-600">Try an example:</span>
        {examples.map((ex) => (
          <button
            key={ex.url}
            type="button"
            onClick={() => onTryExample(ex.url, ex.role)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-violet-400 transition-colors"
          >
            {ex.name} <span className="text-zinc-500">({ex.role})</span>
          </button>
        ))}
      </div>
    </div>
  );
}
