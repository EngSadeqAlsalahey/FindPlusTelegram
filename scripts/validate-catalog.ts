/**
 * Catalog sanity check: loads and validates data/catalog.json, printing a
 * summary. Run with `npm run check:catalog`.
 */
import {
  getCategories,
  getEnabledEntries,
  getLanguages,
  loadCatalog,
} from "@/core/catalog/loader";

function main(): void {
  try {
    const file = loadCatalog();
    const enabled = getEnabledEntries();
    const disabled = file.entries.length - enabled.length;

    console.info("✓ catalog.json is valid");
    console.info(`  entries:      ${file.entries.length} (${disabled} disabled)`);
    console.info(`  channels:     ${enabled.filter((e) => e.type === "channel").length}`);
    console.info(`  groups:       ${enabled.filter((e) => e.type === "group").length}`);
    console.info(`  categories:   ${getCategories().join(", ")}`);
    console.info(`  languages:    ${getLanguages().join(", ")}`);
  } catch (error) {
    console.error("✗ catalog check failed:", error);
    process.exit(1);
  }
}

main();
