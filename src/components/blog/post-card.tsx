import Link from "next/link";
import { Badge } from "@/components/ui/badge"; // Assuming a Badge component
import { Card } from "@/components/ui/card"; // Assuming a Card component

interface PostCardProps {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: "comparison" | "how-to";
}

export function PostCard({ slug, title, description, date, category }: PostCardProps) {
  const categoryColor = category === "comparison" ? "bg-violet-600" : "bg-blue-600"; // Violet for comparison, blue for how-to

  return (
    <Link href={`/blog/${slug}`} className="group block">
      <Card className="flex flex-col h-full border border-zinc-700 bg-zinc-900 overflow-hidden relative transition-all duration-300 ease-in-out group-hover:scale-[1.02] group-hover:shadow-violet-500/20 group-hover:shadow-2xl">
        <div className="p-6 flex flex-col justify-between flex-grow">
          <div className="mb-4">
            <Badge
              variant={category === "comparison" ? "psych" : "trigger"}
              className={`${categoryColor} text-white px-3 py-1 rounded-full text-xs font-medium`}
            >
              {category === "comparison" ? "Comparison" : "How-To"}
            </Badge>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-violet-400 transition-colors duration-200">
            {title}
          </h3>
          <p className="text-zinc-400 text-sm flex-grow mb-4">
            {description}
          </p>
          <div className="flex items-center justify-between text-zinc-500 text-xs mt-auto">
            <span>{date}</span>
            <span className="text-violet-400 group-hover:underline">Read more &rarr;</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
