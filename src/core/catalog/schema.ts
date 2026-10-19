import { z } from "zod";
import { buildPublicUrl, stripAt } from "@/core/telegram/urls";

/**
 * Unified record model for catalog entries (channels and groups share one shape;
 * the `type` field discriminates them).
 *
 * The catalog is the ONLY data source for the search engine in Phase 1, so this
 * schema is the trust boundary for all search data.
 */

const HANDLE_RE = /^@?[A-Za-z0-9_]{4,64}$/;

const entryBase = z.object({
  id: z.string().trim().min(1).max(64),
  type: z.enum(["channel", "group"]),
  title: z.string().trim().min(1).max(128),
  username: z
    .string()
    .trim()
    .min(5)
    .max(65)
    .regex(HANDLE_RE, "must be a valid Telegram public handle"),
  description: z.string().trim().max(600).default(""),
  category: z.string().trim().min(1).max(48).default("general"),
  language: z.string().trim().min(2).max(8).default("en"),
  country: z.string().trim().min(2).max(8).optional(),
  publicUrl: z.string().trim().url(),
  verified: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

/**
 * Cross-field rule: the public URL must be exactly the canonical t.me URL for
 * the declared username. This guarantees the catalog cannot carry arbitrary or
 * unverified links next to a handle.
 *
 * NOTE: superRefine returns a new schema, so the refined instance must be the
 * one exported and reused by catalogFileSchema.
 */
export const catalogEntrySchema = entryBase.superRefine((value, ctx) => {
  const expected = buildPublicUrl(value.username);
  if (value.publicUrl !== expected) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["publicUrl"],
      message: `publicUrl must be "${expected}" for username @${stripAt(
        value.username,
      )} (received "${value.publicUrl}")`,
    });
  }
});

export const catalogFileSchema = z.object({
  /**
   * Arbitrary metadata slot for the catalog file (notes, version, provenance).
   * Prefixed with "_" so the loader can carry it without exposing it as data.
   */
  _meta: z.record(z.unknown()).optional(),
  entries: z.array(catalogEntrySchema).min(1),
});

export type CatalogEntryRecord = z.infer<typeof catalogEntrySchema>;
export type CatalogFile = z.infer<typeof catalogFileSchema>;
