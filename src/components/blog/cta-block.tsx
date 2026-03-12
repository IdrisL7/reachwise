import Link from "next/link";
import { Button } from "@/components/ui/button"; // Assuming a Button component
import { Card } from "@/components/ui/card"; // Assuming a Card component

export function CTABlock() {
  return (
    <Card className="not-prose my-8 p-8 bg-zinc-900 border border-zinc-700 relative overflow-hidden group hover:shadow-violet-500/30 hover:shadow-2xl transition-all duration-300 ease-in-out">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between text-center md:text-left">
        <div className="mb-6 md:mb-0 md:mr-8">
          <h3 className="text-2xl font-bold text-white mb-2">Ready to supercharge your cold emails?</h3>
          <p className="text-zinc-400 text-base">Get started with GetSignalHooks today and craft compelling hooks that convert.</p>
        </div>
        <Link href="/register" passHref>
          <Button className="bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2 px-6 rounded-md transition-colors duration-200">
            Try GetSignalHooks free
          </Button>
        </Link>
      </div>
    </Card>
  );
}
