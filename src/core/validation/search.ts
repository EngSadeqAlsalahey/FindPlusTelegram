import { z } from "zod";

/**
 * Input limits shared by every entry point (web API + bot).
 * These are deliberately conservative to keep requests cheap and safe.
 */
export const MAX_QUERY_LENGTH = 100;
export const DEFAULT_SEARCH_LIMIT = 20;
export const MAX_SEARCH_LIMIT = 50;
export const MAX_SEARCH_OFFSET = 5000;

/**
 * Schema for search requests coming from any interface.
 *
 * `q` may be empty, which means "browse the whole (enabled) directory" — this is
 * how the landing page renders a first page without a query. Anything else
 * (type / category / language / limit / offset) is optional with safe defaults.
 */
export const searchRequestSchema = z.object({
  q: z.string().trim().max(MAX_QUERY_LENGTH).default(""),
  type: z.enum(["all", "channel", "group"]).default("all"),
  category: z.string().trim().min(1).optional(),
  language: z.string().trim().min(1).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_SEARCH_LIMIT)
    .default(DEFAULT_SEARCH_LIMIT),
  offset: z.coerce.number().int().min(0).max(MAX_SEARCH_OFFSET).default(0),
});

export type SearchRequestInput = z.infer<typeof searchRequestSchema>;
