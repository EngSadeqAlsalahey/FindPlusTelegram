import { NextResponse } from "next/server";
import { buildSearchResponse } from "@/core/search/web-handler";
import { searchRequestSchema } from "@/core/validation/search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/search?q=<query>&type=all|channel|group&category=&language=&limit=&offset=
 *
 * Thin transport layer over the shared search engine. Validation and response
 * shaping live in core, so the exact same logic is used by the bot.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Ignore empty params so `?category=` behaves as "no filter".
  const params: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (value !== "") params[key] = value;
  }

  const parsed = searchRequestSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: "The search request was rejected by validation.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(buildSearchResponse(parsed.data));
  } catch (error) {
    console.error("[api/search] failed:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Search is temporarily unavailable." },
      { status: 500 },
    );
  }
}
