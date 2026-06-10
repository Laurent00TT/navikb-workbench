import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createApiClient } from "./api";
import { useInspectedPage } from "./hooks/useInspectedPage";
import type { DocumentItem, FetchTarget, TocEntry } from "./types";

const doc: DocumentItem = {
  doc_id: "doc-1",
  doc_name: "manual.pdf",
  version: null,
  status: "active",
  owner_id: null,
  nav_indexed: true,
  nav_entry_count: 5,
  resource_uri: "kb://documents/doc-1",
  ingested_at: null
};

function tocEntry(overrides: Partial<TocEntry>): TocEntry {
  return {
    entry_id: "ch3",
    label: "Chapter 3",
    entry_type: "section",
    page_start: 10,
    page_end: 60,
    resource_uris: [],
    parent_entry_id: "doc",
    order_index: 1,
    ...overrides
  };
}

/** Routes pagePreview and rangePreview requests to canned payloads. */
function makeFetchMock() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/range_preview")) {
      const body = JSON.parse(String(init?.body)) as { page_start: number; page_end: number };
      return new Response(
        JSON.stringify({
          doc_id: "doc-1",
          page_start: body.page_start,
          page_end: body.page_end,
          pages: [{ doc_id: "doc-1", page_num: body.page_start, status: "ok" }]
        }),
        { status: 200 }
      );
    }
    const pageNum = Number(url.split("/").pop());
    return new Response(
      JSON.stringify({ doc_id: "doc-1", page_num: pageNum, status: "ok" }),
      { status: 200 }
    );
  });
}

describe("useInspectedPage selectToc", () => {
  it("previews the first page of a multi-page section instead of fetching the span", async () => {
    const fetchMock = makeFetchMock();
    const api = createApiClient("kb_token", fetchMock);
    const { result } = renderHook(() => useInspectedPage(api));

    await act(async () => {
      await result.current.selectToc(tocEntry({ page_start: 10, page_end: 60 }), doc);
    });

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls).toEqual(["/ui/api/documents/doc-1/pages/10"]);
    expect(result.current.selectedPage?.page_num).toBe(10);
    expect(result.current.selectedRange).toBeNull();
    expect(result.current.pageError).toBe("");
  });

  it("previews single-page entries directly", async () => {
    const fetchMock = makeFetchMock();
    const api = createApiClient("kb_token", fetchMock);
    const { result } = renderHook(() => useInspectedPage(api));

    await act(async () => {
      await result.current.selectToc(
        tocEntry({ entry_type: "page", page_start: 7, page_end: 7 }),
        doc
      );
    });

    expect(result.current.selectedPage?.page_num).toBe(7);
    expect(result.current.selectedRange).toBeNull();
  });
});

describe("useInspectedPage selectFetch", () => {
  it("clamps over-limit fetch targets to 20 pages and surfaces a notice", async () => {
    const fetchMock = makeFetchMock();
    const api = createApiClient("kb_token", fetchMock);
    const { result } = renderHook(() => useInspectedPage(api));
    const target: FetchTarget = {
      reason: "section hit",
      resource_uri: "kb://documents/doc-1/pages/10-60",
      doc_id: "doc-1",
      page_start: 10,
      page_end: 60
    };

    await act(async () => {
      await result.current.selectFetch(target);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/ui/api/documents/doc-1/range_preview",
      expect.objectContaining({
        body: JSON.stringify({ page_start: 10, page_end: 29 })
      })
    );
    expect(result.current.selectedRange?.page_end).toBe(29);
    expect(result.current.pageNotice).toContain("10–29");
    expect(result.current.pageError).toBe("");
  });

  it("fetches in-limit targets unchanged with no notice", async () => {
    const fetchMock = makeFetchMock();
    const api = createApiClient("kb_token", fetchMock);
    const { result } = renderHook(() => useInspectedPage(api));
    const target: FetchTarget = {
      reason: "page hit",
      resource_uri: "kb://documents/doc-1/pages/2-4",
      doc_id: "doc-1",
      page_start: 2,
      page_end: 4
    };

    await act(async () => {
      await result.current.selectFetch(target);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/ui/api/documents/doc-1/range_preview",
      expect.objectContaining({
        body: JSON.stringify({ page_start: 2, page_end: 4 })
      })
    );
    expect(result.current.pageNotice).toBe("");
  });
});
