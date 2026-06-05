import { useCallback, useState } from "react";

import { ApiError, createApiClient } from "../api";
import type { EvidenceHit, FetchTarget, HybridSearchResponse, NavHit } from "../types";

type ApiClient = ReturnType<typeof createApiClient>;

interface Search {
  query: string;
  topK: number;
  result: HybridSearchResponse | null;
  searchLoading: boolean;
  searchError: string;
  setQuery: (q: string) => void;
  setTopK: (k: number) => void;
  runSearch: () => Promise<{
    firstEvidence?: EvidenceHit;
    firstNav?: NavHit;
    firstFetch?: FetchTarget;
  } | null>;
}

function readableError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

/** Owns: hybrid search inputs and results. NaviKB is a navigation knowledge
 *  base — it surfaces pointers and citable evidence, it does NOT generate
 *  prose answers. Returns the top hit of each lane from runSearch so the
 *  caller can auto-pin the first hit into the EvidenceInspector. */
export function useSearch(api: ApiClient | null): Search {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(20);
  const [result, setResult] = useState<HybridSearchResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const runSearch = useCallback(async () => {
    if (!api || !query.trim()) return null;
    setSearchLoading(true);
    setSearchError("");
    try {
      const response = await api.hybridSearch(query.trim(), topK);
      setResult(response);
      return {
        firstEvidence: response.evidence_hits[0],
        firstNav: response.nav_hits[0],
        firstFetch: response.suggested_fetches[0],
      };
    } catch (error) {
      setSearchError(readableError(error));
      return null;
    } finally {
      setSearchLoading(false);
    }
  }, [api, query, topK]);

  return {
    query,
    topK,
    result,
    searchLoading,
    searchError,
    setQuery,
    setTopK,
    runSearch,
  };
}
