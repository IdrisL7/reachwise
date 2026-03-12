import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { compileMDX } from "next-mdx-remote/rsc";
import type { ReactNode } from "react";

export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: "comparison" | "how-to" | "guide";
  competitor?: string;
  image?: string;
};

export type Post = PostMeta & {
  source: string;
  compiledContent: ReactNode;
};

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

function getBlogFilePaths(): string[] {
  if (!fs.existsSync(BLOG_DIR)) {
    return [];
  }

  return fs
    .readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => path.join(BLOG_DIR, file));
}

function getSlugFromPath(filePath: string): string {
  return path.basename(filePath, ".mdx");
}

function parsePostMeta(filePath: string): PostMeta {
  const fileContents = fs.readFileSync(filePath, "utf8");
  const { data } = matter(fileContents);

  return {
    slug: getSlugFromPath(filePath),
    title: String(data.title ?? "Untitled"),
    description: String(data.description ?? ""),
    date: String(data.date ?? "1970-01-01"),
    category: (data.category as PostMeta["category"]) ?? "guide",
    competitor: data.competitor ? String(data.competitor) : undefined,
    image: data.image ? String(data.image) : undefined,
  };
}

export async function getAllPosts(): Promise<PostMeta[]> {
  const posts = getBlogFilePaths().map(parsePostMeta);

  return posts.sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

export async function getPostBySlug(slug: string): Promise<Post> {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Post not found: ${slug}`);
  }

  const source = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(source);

  const { content: compiledContent } = await compileMDX({
    source: content,
    options: {
      parseFrontmatter: false,
    },
  });

  return {
    slug,
    title: String(data.title ?? "Untitled"),
    description: String(data.description ?? ""),
    date: String(data.date ?? "1970-01-01"),
    category: (data.category as PostMeta["category"]) ?? "guide",
    competitor: data.competitor ? String(data.competitor) : undefined,
    image: data.image ? String(data.image) : undefined,
    source: content,
    compiledContent,
  };
}

export async function getAllSlugs(): Promise<string[]> {
  return getBlogFilePaths().map(getSlugFromPath);
}
