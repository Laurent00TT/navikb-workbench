import { useCallback, useState } from "react";

import { ApiError, createApiClient } from "../api";
import type {
  DocumentItem,
  EvidenceHit,
  FetchTarget,
  NavHit,
  PagePreview,
  PageRangePreview,
  TocEntry,
} from "../types";

type ApiClient = ReturnType<typeof createApiClient>;

interface InspectedPage {
  selectedPage: PagePreview | null;
  selectedRange: PageRangePreview | null;
  pageError: string;
  selectEvidence: (hit: EvidenceHit) => Promise<void>;
  selectNav: (hit: NavHit) => Promise<void>;
  selectFetch: (target: FetchTarget) => Promise<void>;
  selectToc: (entry: TocEntry, doc: DocumentItem) => Promise<void>;
  stepSelectedPage: (delta: number) => Promise<void>;
  copyCitation: (citation: string) => Promise<void>;
  clearSelection: () => void;
}

function readableError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

/** Owns: which page is currently displayed in the EvidenceInspector,
 *  the various ways to select one (evidence / nav / fetch / TOC), and
 *  prev/next navigation. */
export function useInspectedPage(
  api: ApiClient | null,
  onDocumentInferred?: (doc: DocumentItem) => void,
  documentDictionary: DocumentItem[] = []
): InspectedPage {
  const [selectedPage, setSelectedPage] = useState<PagePreview | null>(null);
  const [selectedRange, setSelectedRange] = useState<PageRangePreview | null>(null);
  const [pageError, setPageError] = useState("");

  const selectEvidence = useCallback(
    async (hit: EvidenceHit) => {
      if (!api) return;
      setPageError("");
      try {
        const page = await api.pagePreview(hit.doc_id, hit.page_num);
        setSelectedPage(page);
        setSelectedRange(null);
      } catch (error) {
        setPageError(readableError(error));
      }
    },
    [api]
  );

  const selectNav = useCallback(
    async (hit: NavHit) => {
      if (!api) return;
      setPageError("");
      try {
        const page = await api.pagePreview(hit.doc_id, hit.page_start);
        setSelectedPage(page);
        setSelectedRange(null);
        const doc = documentDictionary.find((candidate) => candidate.doc_id === hit.doc_id);
        if (doc && onDocumentInferred) onDocumentInferred(doc);
      } catch (error) {
        setPageError(readableError(error));
      }
    },
    [api, documentDictionary, onDocumentInferred]
  );

  const selectFetch = useCallback(
    async (target: FetchTarget) => {
      if (!api) return;
      setPageError("");
      try {
        const range = await api.rangePreview(target.doc_id, target.page_start, target.page_end);
        setSelectedRange(range);
        const first = range.pages[0] ?? null;
        setSelectedPage(first);
        if (!first) {
          setPageError(
            `No previewable pages in ${target.page_start}–${target.page_end} — page text payloads are unavailable.`
          );
        }
      } catch (error) {
        setPageError(readableError(error));
      }
    },
    [api]
  );

  const selectToc = useCallback(
    async (entry: TocEntry, doc: DocumentItem) => {
      if (!api) return;
      setPageError("");
      try {
        if (entry.page_end > entry.page_start) {
          const range = await api.rangePreview(doc.doc_id, entry.page_start, entry.page_end);
          setSelectedRange(range);
          const first = range.pages[0] ?? null;
          setSelectedPage(first);
          if (!first) {
            setPageError(
              `No previewable pages in ${entry.page_start}–${entry.page_end} — page text payloads are unavailable.`
            );
          }
          return;
        }
        const page = await api.pagePreview(doc.doc_id, entry.page_start);
        setSelectedPage(page);
        setSelectedRange(null);
      } catch (error) {
        setPageError(readableError(error));
      }
    },
    [api]
  );

  const stepSelectedPage = useCallback(
    async (delta: number) => {
      if (!api || !selectedPage) return;
      const nextPageNum = selectedPage.page_num + delta;
      if (nextPageNum < 0) return;
      // Prefer the cached page inside the current range, if any — avoids
      // a needless network round-trip when stepping through a fetched range.
      const cachedPage = selectedRange?.pages.find((p) => p.page_num === nextPageNum);
      if (cachedPage) {
        setSelectedPage(cachedPage);
        setPageError("");
        return;
      }
      try {
        const page = await api.pagePreview(selectedPage.doc_id, nextPageNum);
        setSelectedPage(page);
        setSelectedRange(null);
        setPageError("");
      } catch (error) {
        setPageError(readableError(error));
      }
    },
    [api, selectedPage, selectedRange]
  );

  const copyCitation = useCallback(async (citation: string) => {
    try {
      await navigator.clipboard.writeText(citation);
      setPageError("");
    } catch {
      setPageError("Clipboard is unavailable in this browser context");
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPage(null);
    setSelectedRange(null);
    setPageError("");
  }, []);

  return {
    selectedPage,
    selectedRange,
    pageError,
    selectEvidence,
    selectNav,
    selectFetch,
    selectToc,
    stepSelectedPage,
    copyCitation,
    clearSelection,
  };
}
