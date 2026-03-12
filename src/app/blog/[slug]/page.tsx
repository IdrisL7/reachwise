import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllSlugs, getPostBySlug } from "@/lib/blog";

type BlogPostPageProps = {
  params: { slug: string };
};

export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = params;

  try {
    const post = await getPostBySlug(slug);
    const canonical = `https://www.getsignalhooks.com/blog/${post.slug}`;

    return {
      title: `${post.title} | GetSignalHooks Blog`,
      description: post.description,
      alternates: { canonical },
      openGraph: {
        title: post.title,
        description: post.description,
        url: canonical,
        type: "article",
        publishedTime: post.date,
        images: post.image ? [{ url: post.image }] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: post.title,
        description: post.description,
        images: post.image ? [post.image] : undefined,
      },
    };
  } catch {
    return {
      title: "Post Not Found | GetSignalHooks Blog",
      description: "The requested blog post could not be found.",
    };
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = params;

  let post;
  try {
    post = await getPostBySlug(slug);
  } catch {
    notFound();
  }

  const postUrl = `https://www.getsignalhooks.com/blog/${post.slug}`;
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      "@type": "Organization",
      name: "GetSignalHooks",
    },
    publisher: {
      "@type": "Organization",
      name: "GetSignalHooks",
    },
    mainEntityOfPage: postUrl,
    image: post.image ? [post.image] : undefined,
  };

  return (
    <main className="min-h-screen bg-[#080808] px-6 py-14 text-zinc-100 sm:px-8 lg:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />

      <article className="mx-auto max-w-3xl">
        <nav className="mb-8 flex items-center gap-2 text-sm text-zinc-400">
          <Link href="/" className="hover:text-zinc-200">
            Home
          </Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-zinc-200">
            Blog
          </Link>
          <span>/</span>
          <span className="truncate text-zinc-500">{post.title}</span>
        </nav>

        <header className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-300">{post.category}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">{post.title}</h1>
          <p className="mt-4 text-zinc-400">{post.description}</p>
          <time className="mt-5 block text-sm text-zinc-500" dateTime={post.date}>
            {post.date}
          </time>
        </header>

        <div className="prose prose-invert prose-zinc max-w-none prose-headings:text-zinc-100 prose-a:text-violet-300 hover:prose-a:text-violet-200 prose-strong:text-zinc-100">
          <MDXRemote source={post.source} />
        </div>
      </article>
    </main>
  );
}
