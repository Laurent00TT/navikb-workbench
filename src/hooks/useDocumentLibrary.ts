import { useCallback, useEffect, useState } from "react";

import { createApiClient } from "../api";
import type { DocumentItem, TocEntry } from "../types";

type ApiClient = ReturnType<typeof createApiClient>;

interface DocumentLibrary {
  documents: DocumentItem[];
  selectedDoc: DocumentItem | null;
  toc: TocEntry[];
  tocLoading: boolean;
  refreshDocuments: () => Promise<void>;
  selectDocument: (doc: DocumentItem) => void;
  /** Soft-delete one or more documents, then refresh the active list once.
   *  Never rejects: per-doc outcomes are returned so the caller can report
   *  partial failures (e.g. 403 for a non-owner inside a bulk selection). */
  deleteDocuments: (docIds: string[]) => Promise<{ ok: string[]; failed: { id: string; error: string }[] }>;
  /** Restore one or more soft-deleted documents (best-effort), then refresh. */
  restoreDocuments: (docIds: string[]) => Promise<void>;
}

/** Owns: document list, selection, and TOC for the selected doc.
 *  Loads documents asynchronously after auth so the main shell can
 *  render the moment identity is known. */
export function useDocumentLibrary(api: ApiClient | null): DocumentLibrary {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [tocLoading, setTocLoading] = useState(false);

  const refreshDocuments = useCallback(async () => {
    if (!api) return;
    try {
      const body = await api.documents();
      setDocuments(body.documents);
      setSelectedDoc((current) => current ?? body.documents[0] ?? null);
    } catch {
      // Don't kick the user out of the workbench just because /documents
      // is slow or failing — they can still navigate via search.
    }
  }, [api]);

  const deleteDocuments = useCallback(
    async (docIds: string[]) => {
      const ok: string[] = [];
      const failed: { id: string; error: string }[] = [];
      if (api) {
        // Sequential: soft-delete is cheap and this keeps a clear per-doc
        // outcome without hammering the server with N concurrent writes.
        for (const id of docIds) {
          try {
            await api.deleteDocument(id);
            ok.push(id);
          } catch (error) {
            failed.push({ id, error: error instanceof Error ? error.message : "Delete failed" });
          }
        }
        // Drop selection if the viewed doc was among the deleted ones, then
        // refresh ONCE for the whole batch.
        setSelectedDoc((current) => (current && ok.includes(current.doc_id) ? null : current));
        await refreshDocuments();
      }
      return { ok, failed };
    },
    [api, refreshDocuments]
  );

  const restoreDocuments = useCallback(
    async (docIds: string[]) => {
      if (!api) return;
      for (const id of docIds) {
        try {
          await api.restoreDocument(id);
        } catch {
          // Best-effort: a failed restore leaves that doc deleted (safe state).
        }
      }
      await refreshDocuments();
    },
    [api, refreshDocuments]
  );

  // Initial load — phase 2 of boot (identity already validated in useAuthSession).
  useEffect(() => {
    refreshDocuments();
  }, [refreshDocuments]);

  // TOC follows selected document.
  useEffect(() => {
    if (!api || !selectedDoc) {
      setToc([]);
      return;
    }
    let cancelled = false;
    setTocLoading(true);
    api
      .toc(selectedDoc.doc_id)
      .then((body) => {
        if (!cancelled) setToc(body.entries);
      })
      .catch(() => {
        if (!cancelled) setToc([]);
      })
      .finally(() => {
        if (!cancelled) setTocLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, selectedDoc]);

  return {
    documents,
    selectedDoc,
    toc,
    tocLoading,
    refreshDocuments,
    selectDocument: setSelectedDoc,
    deleteDocuments,
    restoreDocuments,
  };
}
