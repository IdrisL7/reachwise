export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 bg-zinc-800 rounded mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <div className="h-3 w-20 bg-zinc-800 rounded mb-3" />
            <div className="h-7 w-16 bg-zinc-800 rounded" />
          </div>
        ))}
      </div>
      <div className="h-6 w-32 bg-zinc-800 rounded mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <div className="h-5 w-32 bg-zinc-800 rounded mb-2" />
            <div className="h-4 w-full bg-zinc-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
