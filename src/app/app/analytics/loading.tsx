export default function AnalyticsLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-32 bg-zinc-800 rounded mb-6" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="h-3 w-16 bg-zinc-800 rounded mb-2" />
            <div className="h-6 w-10 bg-zinc-800 rounded" />
          </div>
        ))}
      </div>
      <div className="h-6 w-48 bg-zinc-800 rounded mb-4" />
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 bg-zinc-800 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
