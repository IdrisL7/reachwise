import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog | GetSignalHooks",
  description:
    "Guides, how-tos, and comparison content to help outbound teams write evidence-first hooks that convert.",
  alternates: {
    canonical: "https://www.getsignalhooks.com/blog",
  },
  openGraph: {
    title: "GetSignalHooks Blog",
    description:
      "Guides, how-tos, and comparison content to help outbound teams write evidence-first hooks that convert.",
    url: "https://www.getsignalhooks.com/blog",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GetSignalHooks Blog",
    description:
      "Guides and comparison articles for outbound teams using evidence-first hook strategies.",
  },
};

export default async function BlogIndexPage() {
  const posts = await getAllPosts();

  return (
    <main className="min-h-screen bg-[#080808] px-6 py-16 text-zinc-100 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-violet-300">
            GetSignalHooks Blog
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
            Outbound playbooks built on real buying signals
          </h1>
          <p className="mt-4 max-w-3xl text-zinc-400">
            Tactical guides, practical how-tos, and honest comparisons to help sales teams write hooks people actually reply to.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-10 text-zinc-400">
            No posts yet. Check back soon.
          </div>
        ) : (
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="group rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 transition hover:border-violet-500/40 hover:bg-zinc-900"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-violet-300">
                  {post.category}
                </p>
                <h2 className="mt-3 text-xl font-semibold text-zinc-100">
                  <Link href={`/blog/${post.slug}`} className="hover:text-violet-300">
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-3 line-clamp-3 text-sm text-zinc-400">
                  {post.description}
                </p>
                <div className="mt-5 flex items-center justify-between text-xs text-zinc-500">
                  <time dateTime={post.date}>{post.date}</time>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="font-medium text-violet-300 transition group-hover:text-violet-200"
                  >
                    Read article →
                  </Link>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
