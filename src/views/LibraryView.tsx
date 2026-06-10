import { BookOpen, ChevronRight, ExternalLink, FileText, Layers, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Banner } from "../components/Banner";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useDocDeletion } from "../hooks/useDocDeletion";
import type { DocumentItem, TocEntry } from "../types";

interface LibraryViewProps {
  selectedDoc: DocumentItem | null;
  toc: TocEntry[];
  loading: boolean;
  onSelectToc: (entry: TocEntry) => void;
  /** Soft-delete a batch; resolves with per-doc outcomes (never rejects). */
  onDeleteDocuments: (
    docIds: string[]
  ) => Promise<{ ok: string[]; failed: { id: string; error: string }[] }>;
  /** Restore soft-deleted documents (used by the Undo affordance). */
  onRestoreDocuments: (docIds: string[]) => Promise<void>;
  /** Open a document's retained original PDF in a new tab. */
  onOpenSource: (docId: string) => void;
}

interface TocNode {
  entry: TocEntry;
  children: TocNode[];
}

/** Build a forest from the flat TOC. parent_entry_id may dangle (parent not
 *  in the list); those nodes become roots. order_index already gives a stable
 *  order within each parent. Exported for tests. */
export function buildTocTree(entries: TocEntry[]): TocNode[] {
  const byId = new Map<string, TocNode>();
  const roots: TocNode[] = [];
  for (const entry of entries) {
    byId.set(entry.entry_id, { entry, children: [] });
  }
  for (const entry of entries) {
    const node = byId.get(entry.entry_id)!;
    if (entry.parent_entry_id && byId.has(entry.parent_entry_id)) {
      byId.get(entry.parent_entry_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function pluralizePages(start: number, end: number): string {
  return start === end ? `p.${start}` : `pp.${start}–${end}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const sec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return `${Math.round(day / 30)}mo ago`;
}

export function LibraryView({
  selectedDoc,
  toc,
  loading,
  onSelectToc,
  onDeleteDocuments,
  onRestoreDocuments,
  onOpenSource
}: LibraryViewProps) {
  const del = useDocDeletion(onDeleteDocuments, onRestoreDocuments);
  const tocTree = useMemo(() => buildTocTree(toc), [toc]);

  return (
    <section className="workspace library-workspace">
      <div className="workspace-header">
        <div>
          <p className="eyebrow">Library</p>
          <h2>Browse by document structure</h2>
        </div>
      </div>

      {!selectedDoc ? (
        <p className="muted library-empty">
          Select a document from the sidebar to view its structure.
        </p>
      ) : (
        <>
          <div className="library-docbar">
            <h3 className="library-docname" title={selectedDoc.doc_name}>
              {selectedDoc.doc_name}
            </h3>
            <div className="library-docbar-acts">
              {selectedDoc.has_source ? (
                <button
                  type="button"
                  className="doc-action"
                  onClick={() => onOpenSource(selectedDoc.doc_id)}
                >
                  <ExternalLink size={14} /> Open PDF
                </button>
              ) : null}
              <button
                type="button"
                className="doc-action danger"
                onClick={() => del.requestDelete([selectedDoc])}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>

          <div className="library-chips">
            <span className="lchip">
              {selectedDoc.nav_indexed ? (
                <>
                  <b>{selectedDoc.nav_entry_count}</b> nav entries
                </>
              ) : (
                "no nav index"
              )}
            </span>
            {selectedDoc.has_source ? (
              <span className="lchip">
                source
                {selectedDoc.source_bytes ? ` · ${formatBytes(selectedDoc.source_bytes)}` : ""}
              </span>
            ) : null}
            {selectedDoc.ingested_at ? (
              <span className="lchip">ingested {relativeTime(selectedDoc.ingested_at)}</span>
            ) : null}
            {selectedDoc.version ? <span className="lchip">v{selectedDoc.version}</span> : null}
          </div>

          {del.justDeleted.length > 0 ? (
            <div className="library-undo">
              <span>
                Deleted <strong>{del.justDeleted[0].docName}</strong>
              </span>
              <button type="button" onClick={del.handleUndo}>
                <RotateCcw size={13} /> Undo
              </button>
            </div>
          ) : null}
          {del.actionError ? (
            <Banner kind="error" size="sm" onDismiss={del.dismissError}>
              {del.actionError}
            </Banner>
          ) : null}

          <div className="section-title toc-title">
            <Layers size={16} />
            <span>Document structure</span>
            <small className="toc-count">{toc.length} entries</small>
          </div>
          {loading ? <p className="muted">Loading TOC…</p> : null}
          {!loading && toc.length === 0 ? (
            <p className="muted">This document has no navigation entries yet.</p>
          ) : null}
          <div className="toc-tree library-toc">
            {tocTree.map((node) => (
              <TocBranch key={node.entry.entry_id} node={node} depth={0} onSelect={onSelectToc} />
            ))}
          </div>
        </>
      )}

      {del.pendingDelete ? (
        <ConfirmDialog
          title="Delete document"
          danger
          busy={del.working}
          confirmLabel="Delete"
          onConfirm={async () => {
            await del.confirmDelete();
          }}
          onCancel={del.cancelDelete}
        >
          <p>
            Soft-delete <strong>{del.pendingDelete[0].doc_name}</strong>? It is hidden from search
            and the library, but can be restored from the Undo prompt.
          </p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}

interface TocBranchProps {
  node: TocNode;
  depth: number;
  onSelect: (entry: TocEntry) => void;
}

function TocBranch({ node, depth, onSelect }: TocBranchProps) {
  // Document-level entries are header-like (no click action makes much sense —
  // they span the whole doc), but their children are pages and those are the
  // real navigation targets.
  const isDocRoot = node.entry.entry_type === "document";
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={isDocRoot ? "toc-branch root" : "toc-branch"}>
      <div
        className={isDocRoot ? "toc-row toc-doc-row" : "toc-row"}
        style={{ paddingLeft: 10 + depth * 14 }}
      >
        {node.children.length > 0 ? (
          <button
            type="button"
            className="toc-toggle"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expand" : "Collapse"}
          >
            <ChevronRight
              size={13}
              style={{ transform: collapsed ? "none" : "rotate(90deg)", transition: "transform 120ms" }}
            />
          </button>
        ) : (
          <span className="toc-toggle-spacer" />
        )}
        <button type="button" className="toc-label-btn" onClick={() => onSelect(node.entry)}>
          <span className="toc-icon">
            {isDocRoot ? <BookOpen size={13} /> : <FileText size={13} />}
          </span>
          <span className="toc-label">{node.entry.label || "(untitled)"}</span>
          <span className="toc-range">{pluralizePages(node.entry.page_start, node.entry.page_end)}</span>
          <small className="toc-type">{node.entry.entry_type}</small>
        </button>
      </div>
      {!collapsed && node.children.length > 0 ? (
        <div className="toc-children">
          {node.children.map((child) => (
            <TocBranch key={child.entry.entry_id} node={child} depth={depth + 1} onSelect={onSelect} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
