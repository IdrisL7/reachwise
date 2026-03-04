import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-7xl font-bold text-violet-500 mb-4">404</p>
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">
          Page not found
        </h1>
        <p className="text-zinc-500 mb-8 max-w-sm mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/"
            className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            Go home
          </Link>
          <Link
            href="/app"
            className="border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
