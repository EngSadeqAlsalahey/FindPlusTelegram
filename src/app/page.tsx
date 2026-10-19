"use client";

import { useCallback, useEffect, useState } from "react";
import { containsArabic } from "@/core/search/normalize";
import { EmptyState } from "@/components/results/EmptyState";
import { ErrorState } from "@/components/results/ErrorState";
import { FilterBar } from "@/components/search/FilterBar";
import { LoadingSkeleton } from "@/components/results/LoadingSkeleton";
import { Pagination } from "@/components/results/Pagination";
import { ResultCard } from "@/components/results/ResultCard";
import { SearchBar } from "@/components/search/SearchBar";
import { TypeTabs } from "@/components/search/TypeTabs";
import type { SearchApiResponse, SearchType } from "@/types";

const PAGE_SIZE = 20;

export default function SearchPage() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<SearchType>("all");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<SearchApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams();
    params.set("q", query);
    params.set("type", type);
    if (category) params.set("category", category);
    if (language) params.set("language", language);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));

    setLoading(true);
    setError(null);

    fetch(`/api/search?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
            message?: string;
          } | null;
          throw new Error(
            body?.message ?? body?.error ?? `Request failed (${response.status})`,
          );
        }
        return response.json() as Promise<SearchApiResponse>;
      })
      .then((json) => setData(json))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unexpected error");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [query, type, category, language, offset, retryToken]);

  const handleSubmit = useCallback(() => {
    setOffset(0);
    setQuery(input.trim());
  }, [input]);

  // Changing any filter should restart from page one.
  const withPageReset = useCallback(
    <T,>(setter: (value: T) => void) => (value: T) => {
      setOffset(0);
      setter(value);
    },
    [],
  );

  const handleResetFilters = useCallback(() => {
    setOffset(0);
    setType("all");
    setCategory("");
    setLanguage("");
  }, []);

  const handleBrowse = useCallback(() => {
    setOffset(0);
    setInput("");
    setQuery("");
    setType("all");
    setCategory("");
    setLanguage("");
  }, []);

  const isRtl = containsArabic(query);
  const hasFilters = type !== "all" || category !== "" || language !== "";
  const showingQuery = data?.query ?? query;

  return (
    <main dir={isRtl ? "rtl" : "ltr"} className="pb-12 pt-10 sm:pt-16">
      <section className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl">
          Discover public{" "}
          <span className="gradient-text">Telegram</span> channels &amp; groups
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400 sm:text-base">
          FindPulse searches a curated directory of public Telegram channels and
          groups.
        </p>
      </section>

      <section className="mx-auto mt-8 max-w-3xl">
        <SearchBar
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          isRtl={isRtl}
        />
      </section>

      <section className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <TypeTabs value={type} onChange={withPageReset(setType)} />
        <FilterBar
          categories={data?.facets.categories ?? []}
          languages={data?.facets.languages ?? []}
          category={category}
          language={language}
          onCategoryChange={withPageReset(setCategory)}
          onLanguageChange={withPageReset(setLanguage)}
          onReset={handleResetFilters}
          hasFilters={hasFilters}
        />
      </section>

      <section className="mt-8">
        {!loading && error ? (
          <ErrorState
            message={error}
            onRetry={() => setRetryToken((token) => token + 1)}
          />
        ) : null}

        {loading ? <LoadingSkeleton /> : null}

        {!loading && !error && data ? (
          <div className="space-y-6">
            <div className="flex items-baseline justify-between gap-3" dir="auto">
              <h2 className="text-sm font-medium text-slate-400">
                {showingQuery ? (
                  <>
                    <span className="font-semibold text-slate-100">
                      {data.total}
                    </span>{" "}
                    {data.total === 1 ? "result" : "results"} for{" "}
                    <span className="font-semibold text-slate-100">
                      “{showingQuery}”
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-slate-100">
                      {data.total}
                    </span>{" "}
                    entries in the directory
                  </>
                )}
              </h2>
              <span className="text-xs text-slate-600">
                {data.durationMs} ms
              </span>
            </div>

            {data.total === 0 ? (
              <EmptyState query={showingQuery} onBrowse={handleBrowse} />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  {data.entries.map((entry, index) => (
                    <ResultCard
                      key={entry.id}
                      entry={entry}
                      index={data.offset + index + 1}
                    />
                  ))}
                </div>
                <Pagination
                  offset={data.offset}
                  limit={data.limit}
                  total={data.total}
                  onPageChange={setOffset}
                />
              </>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
