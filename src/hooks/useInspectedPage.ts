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

/** The core rejects range_preview requests spanning more than 20 pages.
 *  Suggested fetch targets can exceed this (a section hit's coverage plus
 *  the navigator's window expansion), so requests must be clamped. */
const RANGE_PREVIEW_MAX_PAGES = 20;

interface InspectedPage {
  selectedPage: PagePreview | null;
  selectedRange: PageRangePreview | null;
  pageError: string;
  /** Non-error context about the current preview (e.g. a clamped range). */
  pageNotice: string;
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
  const [pageNotice, setPageNotice] = useState("");

  const selectEvidence = useCallback(
    async (hit: EvidenceHit) => {
      if (!api) return;
      setPageError("");
      setPageNotice("");
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
      setPageNotice("");
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
      setPageNotice("");
      const pageEnd = Math.min(
        target.page_end,
        target.page_start + RANGE_PREVIEW_MAX_PAGES - 1
      );
      try {
        const range = await api.rangePreview(target.doc_id, target.page_start, pageEnd);
        setSelectedRange(range);
        const first = range.pages[0] ?? null;
        setSelectedPage(first);
        if (!first) {
          setPageError(
            `No previewable pages in ${target.page_start}–${pageEnd} — page text payloads are unavailable.`
          );
        } else if (pageEnd < target.page_end) {
          setPageNotice(
            `Loaded pages ${target.page_start}–${pageEnd} of the suggested ${target.page_start}–${target.page_end} ` +
              `(previews load at most ${RANGE_PREVIEW_MAX_PAGES} pages at once). Step forward to keep reading.`
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
      setPageNotice("");
      try {
        // Jump to the entry's first page — same semantics as selectNav.
        // Multi-page entries are no longer fetched as a range: sections now
        // cover whole chapters, which would trip the core's 20-page
        // range_preview cap, and a single page keeps clicks fast.
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
        // The notice describes the loaded range; once stepping leaves it,
        // the context is gone too.
        setPageNotice("");
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
    setPageNotice("");
  }, []);

  return {
    selectedPage,
    selectedRange,
    pageError,
    pageNotice,
    selectEvidence,
    selectNav,
    selectFetch,
    selectToc,
    stepSelectedPage,
    copyCitation,
    clearSelection,
  };
}
