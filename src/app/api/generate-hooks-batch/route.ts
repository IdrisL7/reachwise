import { NextResponse } from "next/server";
import { generateHooksForUrl, type Hook } from "@/lib/hooks";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BatchItemInput = {
  url: string;
  pitchContext?: string;
};

type BatchRequest = {
  items: BatchItemInput[];
  maxHooksPerUrl?: number;
};

type BatchItemResult = {
  url: string;
  hooks: Hook[];
  error: string | null;
};

type BatchResponse = {
  results: BatchItemResult[];
};

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as BatchRequest | null;

    if (!body || !Array.isArray(body.items)) {
      return NextResponse.json(
        { error: "Missing 'items' array in request body." },
        { status: 400 },
      );
    }

    const maxHooksPerUrl = body.maxHooksPerUrl;

    const results: BatchItemResult[] = await Promise.all(
      body.items.map(async (item): Promise<BatchItemResult> => {
        const url = item.url?.trim();

        if (!url) {
          return { url: "", hooks: [], error: "Missing url" };
        }

        try {
          const result = await generateHooksForUrl({
            url,
            pitchContext: item.pitchContext,
            count: maxHooksPerUrl,
          });
          return { url, hooks: result.hooks, error: null };
        } catch (err) {
          console.error(`generate-hooks-batch: failed for ${url}`, err);
          return { url, hooks: [], error: "Failed to generate hooks" };
        }
      }),
    );

    const response: BatchResponse = { results };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error in /api/generate-hooks-batch", error);
    return NextResponse.json(
      { error: "Unexpected server error while generating hooks batch." },
      { status: 500 },
    );
  }
}
