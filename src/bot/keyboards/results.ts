import { InlineKeyboard } from "grammy";
import {
  encodePageCallback,
  truncateText,
} from "@/core/telegram/format";
import { stripAt } from "@/core/telegram/urls";
import type { SearchResult } from "@/types";

/**
 * Builds the inline keyboard for a page of results:
 * one "Open" URL button per result, then a Previous / Menu / Next row.
 */
export function buildResultsKeyboard(result: SearchResult): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const entry of result.entries) {
    const label = truncateText(`🔗 @${stripAt(entry.username)}`, 48);
    keyboard.url(label, entry.publicUrl).row();
  }

  if (result.offset > 0) {
    keyboard.text(
      "◀️ Previous",
      encodePageCallback({
        query: result.query,
        offset: Math.max(0, result.offset - result.limit),
        type: "all",
      }),
    );
  }

  keyboard.text("🏠 Menu", "menu");

  if (result.hasMore) {
    keyboard.text(
      "Next ▶️",
      encodePageCallback({
        query: result.query,
        offset: result.offset + result.limit,
        type: "all",
      }),
    );
  }

  return keyboard;
}
