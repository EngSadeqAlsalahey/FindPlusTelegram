/**
 * Text normalization and shaping shared by search and rendering.
 *
 * The goal is to make matching tolerant to the differences that do not change
 * meaning — especially between Arabic and English keyboards:
 * letter case, diacritics (tashkeel), tatweel, hamza/alef variants, and
 * stray punctuation or repeated whitespace.
 */

const ARABIC_DIACRITICS = /[\u064B-\u0652\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u0640]/g;

/** Letters, numbers, "@", ".", "_", "-" and whitespace are kept; everything else becomes a space. */
const NON_WORD_CHARS = /[^\p{L}\p{N}@._\s-]/gu;

const ARABIC_PRESENCE = /[\u0600-\u06FF\u0750-\u077F]/;

export function normalizeText(input: string | undefined | null): string {
  return (input ?? "")
    .toLowerCase()
    .normalize("NFC")
    .replace(ARABIC_DIACRITICS, "")
    // Unified Arabic letter forms so search is insensitive to spelling variants.
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(NON_WORD_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split a normalized query into meaningful tokens (length > 1). */
export function tokenize(normalizedQuery: string): string[] {
  return normalizedQuery
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

/** True when the string contains Arabic letters (used for RTL UI direction). */
export function containsArabic(input: string | undefined | null): boolean {
  return ARABIC_PRESENCE.test(input ?? "");
}
