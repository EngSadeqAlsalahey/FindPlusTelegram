import type { SearchApiResponse, SearchRequest } from "@/types";
import { getCategories, getLanguages } from "@/core/catalog/loader";
import { search } from "./engine";
import type { SearchRequestInput } from "@/core/validation/search";

/**
 * Pure, framework-agnostic handler that turns a validated search request into a
 * JSON-serializable API response. The Next.js route is a thin transport layer
 * over this, which keeps the web logic unit-testable without booting Next.
 */
export function buildSearchResponse(input: SearchRequestInput): SearchApiResponse {
  const request: SearchRequest = {
    query: input.q,
    type: input.type,
    category: input.category || undefined,
    language: input.language || undefined,
    limit: input.limit,
    offset: input.offset,
  };

  const result = search(request);

  return {
    ...result,
    facets: {
      categories: getCategories(),
      languages: getLanguages(),
    },
  };
}
