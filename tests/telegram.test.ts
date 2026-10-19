import { describe, expect, it } from "vitest";
import {
  CALLBACK_DATA_MAX_BYTES,
  decodePageCallback,
  encodePageCallback,
  escapeHtml,
  truncateText,
  truncateToBytes,
} from "@/core/telegram/format";
import { stripAt, buildPublicUrl } from "@/core/telegram/urls";

describe("escapeHtml", () => {
  it("escapes the five significant HTML characters", () => {
    expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe(
      "&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;",
    );
  });
});

describe("truncateText", () => {
  it("leaves short strings untouched", () => {
    expect(truncateText("short", 20)).toBe("short");
  });

  it("appends an ellipsis when truncating", () => {
    expect(truncateText("abcdefghij", 5)).toBe("abcd…");
  });
});

describe("truncateToBytes", () => {
  it("keeps strings already within the byte budget", () => {
    expect(truncateToBytes("abc", 10)).toBe("abc");
  });

  it("cuts on a UTF-8 character boundary (Arabic)", () => {
    // Each Arabic letter is 2 bytes in UTF-8; 5 bytes fits 2 letters (4 bytes).
    const input = "تقنية";
    const truncated = truncateToBytes(input, 5);
    expect(Buffer.byteLength(truncated, "utf-8")).toBeLessThanOrEqual(5);
    expect(truncated).toBe("تق");
  });
});

describe("page callback encode/decode", () => {
  it("round-trips a query, offset and type", () => {
    const encoded = encodePageCallback({
      query: "tech",
      offset: 10,
      type: "all",
    });
    const decoded = decodePageCallback(encoded);
    expect(decoded).toEqual({ query: "tech", offset: 10, type: "all" });
  });

  it("round-trips Arabic text", () => {
    const encoded = encodePageCallback({
      query: "تقنية",
      offset: 5,
      type: "all",
    });
    expect(decodePageCallback(encoded)).toEqual({
      query: "تقنية",
      offset: 5,
      type: "all",
    });
  });

  it("preserves pipes inside the query", () => {
    const encoded = encodePageCallback({
      query: "a|b|c",
      offset: 0,
      type: "all",
    });
    expect(decodePageCallback(encoded)?.query).toBe("a|b|c");
  });

  it("never exceeds the Telegram 64-byte callback_data limit", () => {
    const long = "y".repeat(80);
    const encoded = encodePageCallback({ query: long, offset: 999, type: "all" });
    expect(Buffer.byteLength(encoded, "utf-8")).toBeLessThanOrEqual(
      CALLBACK_DATA_MAX_BYTES,
    );
  });

  it("returns null for foreign or malformed payloads", () => {
    expect(decodePageCallback(undefined)).toBeNull();
    expect(decodePageCallback("menu")).toBeNull();
    expect(decodePageCallback("pg:")).toBeNull();
    expect(decodePageCallback("pg:abc")).toBeNull();
  });
});

describe("url helpers", () => {
  it("strips leading @ characters", () => {
    expect(stripAt("@example")).toBe("example");
    expect(stripAt("@@example")).toBe("example");
    expect(stripAt("example")).toBe("example");
  });

  it("builds canonical t.me urls", () => {
    expect(buildPublicUrl("@findpulse_sample_tech")).toBe(
      "https://t.me/findpulse_sample_tech",
    );
  });
});
