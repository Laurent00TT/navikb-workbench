import { useEffect, useState } from "react";

import type { DocumentItem } from "../types";

type DeleteFn = (
  ids: string[]
) => Promise<{ ok: string[]; failed: { id: string; error: string }[] }>;
type RestoreFn = (ids: string[]) => Promise<void>;

interface JustDeleted {
  docId: string;
  docName: string;
}

/** Shared soft-delete state machine: a confirm-dialog queue, a busy flag, a
 *  transient Undo (restore) prompt, and partial-failure messaging. Used by
 *  BOTH the Sidebar (bulk select) and the Library action bar (single doc) so
 *  the confirm + Undo behaviour stays identical wherever a delete is started. */
export function useDocDeletion(onDelete: DeleteFn, onRestore: RestoreFn) {
  const [pendingDelete, setPendingDelete] = useState<DocumentItem[] | null>(null);
  const [justDeleted, setJustDeleted] = useState<JustDeleted[]>([]);
  const [actionError, setActionError] = useState("");
  const [working, setWorking] = useState(false);

  // The Undo prompt is transient — a generous window, then it fades. Restoring
  // after that needs the API directly (no deleted-docs browser yet).
  useEffect(() => {
    if (justDeleted.length === 0) return;
    const timer = window.setTimeout(() => setJustDeleted([]), 12000);
    return () => window.clearTimeout(timer);
  }, [justDeleted]);

  function requestDelete(docs: DocumentItem[]) {
    if (docs.length === 0) return;
    setActionError("");
    setPendingDelete(docs);
  }

  /** Resolves with the ids actually deleted, so a bulk caller can prune its
   *  selection set. */
  async function confirmDelete(): Promise<string[]> {
    if (!pendingDelete) return [];
    const docs = pendingDelete;
    setWorking(true);
    const { ok, failed } = await onDelete(docs.map((d) => d.doc_id));
    setWorking(false);
    setPendingDelete(null);
    setJustDeleted(
      docs
        .filter((d) => ok.includes(d.doc_id))
        .map((d) => ({ docId: d.doc_id, docName: d.doc_name }))
    );
    setActionError(
      failed.length === 0
        ? ""
        : ok.length === 0
          ? `Could not delete: ${failed[0].error}`
          : `Deleted ${ok.length}, ${failed.length} failed (${failed[0].error})`
    );
    return ok;
  }

  async function handleUndo() {
    const items = justDeleted;
    setJustDeleted([]);
    setActionError("");
    try {
      await onRestore(items.map((i) => i.docId));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Restore failed");
    }
  }

  return {
    pendingDelete,
    justDeleted,
    actionError,
    working,
    requestDelete,
    confirmDelete,
    cancelDelete: () => setPendingDelete(null),
    handleUndo,
    dismissError: () => setActionError(""),
  };
}
