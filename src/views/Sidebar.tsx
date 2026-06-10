import {
  Database,
  File,
  Filter,
  ListChecks,
  Plus,
  RotateCcw,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Banner } from "../components/Banner";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useDocDeletion } from "../hooks/useDocDeletion";
import type { DocumentItem, ServerStatus } from "../types";
import type { TabKey } from "./Topbar";

interface SidebarProps {
  documents: DocumentItem[];
  status: ServerStatus | null;
  selectedDocId: string | null;
  onTabChange: (tab: TabKey) => void;
  onSelectDocument: (doc: DocumentItem) => void;
  onDeleteDocuments: (
    docIds: string[]
  ) => Promise<{ ok: string[]; failed: { id: string; error: string }[] }>;
  onRestoreDocuments: (docIds: string[]) => Promise<void>;
}

/** Strip the "_NNN.pdf" suffix some corpora use to encode page-split files
 *  back into a shared prefix. Returns the prefix used for soft grouping. */
function groupKey(name: string): string {
  return name.replace(/_(\d{1,5})\.pdf$/i, "");
}

export function Sidebar({
  documents,
  status,
  selectedDocId,
  onTabChange,
  onSelectDocument,
  onDeleteDocuments,
  onRestoreDocuments
}: SidebarProps) {
  const [filter, setFilter] = useState("");
  const [navOnly, setNavOnly] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  // Bulk-select is opt-in: checkboxes + the select-all bar only appear after
  // the user clicks "Select". Keeps the default list a clean navigator.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const del = useDocDeletion(onDeleteDocuments, onRestoreDocuments);

  const filteredDocuments = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return documents.filter((doc) => {
      if (navOnly && !doc.nav_indexed) return false;
      if (!needle) return true;
      return doc.doc_name.toLowerCase().includes(needle);
    });
  }, [documents, filter, navOnly]);

  // Soft-group documents whose names share a prefix (e.g. book-page splits).
  const groups = useMemo(() => {
    const map = new Map<string, DocumentItem[]>();
    for (const doc of filteredDocuments) {
      const k = groupKey(doc.doc_name);
      const list = map.get(k);
      if (list) list.push(doc);
      else map.set(k, [doc]);
    }
    return Array.from(map.entries()).map(([prefix, docs]) => ({ prefix, docs }));
  }, [filteredDocuments]);

  // Select-all operates on the CURRENT filter. The header checkbox reflects
  // only what's visible; selections of now-filtered-out docs are preserved.
  const visibleSelectedCount = useMemo(
    () => filteredDocuments.reduce((n, d) => (selected.has(d.doc_id) ? n + 1 : n), 0),
    [filteredDocuments, selected]
  );
  const allVisibleSelected =
    filteredDocuments.length > 0 && visibleSelectedCount === filteredDocuments.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;
  const selectedDocs = useMemo(
    () => documents.filter((d) => selected.has(d.doc_id)),
    [documents, selected]
  );

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  function toggleGroup(prefix: string) {
    setCollapsedGroups((prev) => ({ ...prev, [prefix]: !prev[prefix] }));
  }

  function toggleSelect(docId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filteredDocuments.forEach((d) => next.delete(d.doc_id));
      else filteredDocuments.forEach((d) => next.add(d.doc_id));
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function confirmBulkDelete() {
    const ok = await del.confirmDelete();
    setSelected((prev) => {
      const next = new Set(prev);
      ok.forEach((id) => next.delete(id));
      return next;
    });
  }

  return (
    <aside className="sidebar">
      <div className="doc-list">
        <div className="list-title-row">
          <span className="list-title">
            Documents <small>{filteredDocuments.length}</small>
          </span>
          <button
            className={selectMode ? "chip-button active" : "chip-button"}
            type="button"
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            title={selectMode ? "Exit selection" : "Select multiple"}
          >
            <ListChecks size={13} />
            {selectMode ? "Done" : "Select"}
          </button>
          <button
            className="square-button"
            title="Upload PDF"
            type="button"
            onClick={() => onTabChange("ingest")}
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="filter-row">
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter documents..."
          />
          <button
            className={navOnly ? "square-button active" : "square-button"}
            title={navOnly ? "Showing nav-indexed documents" : "Show only nav-indexed documents"}
            type="button"
            onClick={() => setNavOnly((value) => !value)}
            aria-pressed={navOnly}
          >
            <Filter size={15} />
          </button>
        </div>

        {selectMode ? (
          <div className="sidebar-select-bar">
            <label className="select-all">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allVisibleSelected}
                disabled={filteredDocuments.length === 0}
                onChange={toggleSelectAll}
              />
              <span>{visibleSelectedCount > 0 ? `${visibleSelectedCount} selected` : "Select all"}</span>
            </label>
            {selectedDocs.length > 0 ? (
              <button type="button" className="bulk-delete" onClick={() => del.requestDelete(selectedDocs)}>
                <Trash2 size={13} /> Delete {selectedDocs.length}
              </button>
            ) : null}
          </div>
        ) : null}

        {del.justDeleted.length > 0 ? (
          <div className="sidebar-undo">
            <span>
              Deleted{" "}
              {del.justDeleted.length === 1 ? (
                <strong>{del.justDeleted[0].docName}</strong>
              ) : (
                <strong>{del.justDeleted.length} documents</strong>
              )}
            </span>
            <button type="button" onClick={del.handleUndo}>
              <RotateCcw size={12} /> Undo
            </button>
          </div>
        ) : null}
        {del.actionError ? (
          <Banner kind="error" size="sm" onDismiss={del.dismissError}>
            {del.actionError}
          </Banner>
        ) : null}

        <div className="doc-scroll">
          {groups.map(({ prefix, docs }) => {
            if (docs.length === 1) {
              return (
                <DocRow
                  key={docs[0].doc_id}
                  doc={docs[0]}
                  viewing={selectedDocId === docs[0].doc_id}
                  selectMode={selectMode}
                  checked={selected.has(docs[0].doc_id)}
                  onSelect={onSelectDocument}
                  onToggle={toggleSelect}
                />
              );
            }
            const collapsed = collapsedGroups[prefix];
            return (
              <div className="doc-group" key={prefix}>
                <button className="doc-group-head" onClick={() => toggleGroup(prefix)} type="button">
                  <span className="doc-group-prefix" title={prefix}>
                    {prefix}
                  </span>
                  <span className="doc-group-count">{docs.length}</span>
                  <span className={collapsed ? "doc-group-caret collapsed" : "doc-group-caret"}>▾</span>
                </button>
                {!collapsed &&
                  docs.map((doc) => (
                    <DocRow
                      key={doc.doc_id}
                      doc={doc}
                      viewing={selectedDocId === doc.doc_id}
                      selectMode={selectMode}
                      checked={selected.has(doc.doc_id)}
                      onSelect={onSelectDocument}
                      onToggle={toggleSelect}
                      indent
                      suffixOnly
                    />
                  ))}
              </div>
            );
          })}
          {filteredDocuments.length === 0 ? (
            <p className="muted tiny">No documents match this filter.</p>
          ) : null}
        </div>
      </div>

      <section className="local-index">
        <Database size={18} />
        <div className="local-index-text">
          <strong>Local index</strong>
          <small>
            {status
              ? `${status.nav_doc_count} docs · ${status.nav_entry_count.toLocaleString()} pointers`
              : "loading…"}
          </small>
        </div>
        <span
          className={status?.hybrid_ready ? "dot ok" : "dot warn"}
          title={status?.hybrid_ready ? "Hybrid navigator ready" : "Hybrid navigator not ready"}
        />
      </section>

      {del.pendingDelete ? (
        <ConfirmDialog
          title={
            del.pendingDelete.length === 1
              ? "Delete document"
              : `Delete ${del.pendingDelete.length} documents`
          }
          danger
          busy={del.working}
          confirmLabel={del.pendingDelete.length === 1 ? "Delete" : `Delete ${del.pendingDelete.length}`}
          onConfirm={confirmBulkDelete}
          onCancel={del.cancelDelete}
        >
          {del.pendingDelete.length === 1 ? (
            <p>
              Soft-delete <strong>{del.pendingDelete[0].doc_name}</strong>? It is hidden from search
              and the library, but can be restored from the Undo prompt.
            </p>
          ) : (
            <p>
              Soft-delete <strong>{del.pendingDelete.length} documents</strong>? They are hidden from
              search and the library, but can be restored from the Undo prompt.
            </p>
          )}
        </ConfirmDialog>
      ) : null}
    </aside>
  );
}

interface DocRowProps {
  doc: DocumentItem;
  viewing: boolean;
  selectMode: boolean;
  checked: boolean;
  onSelect: (doc: DocumentItem) => void;
  onToggle: (docId: string) => void;
  indent?: boolean;
  /** When inside a multi-doc group, show only the diff'ing suffix. */
  suffixOnly?: boolean;
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
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

function DocRow({ doc, viewing, selectMode, checked, onSelect, onToggle, indent, suffixOnly }: DocRowProps) {
  const ago = relativeTime(doc.ingested_at);
  let displayName = doc.doc_name;
  if (suffixOnly) {
    const m = doc.doc_name.match(/_(\d{1,5})\.pdf$/i);
    displayName = m ? `_${m[1]}.pdf` : doc.doc_name;
  }
  return (
    <div className={["doc-row-wrap", checked ? "checked" : "", indent ? "indented" : ""].filter(Boolean).join(" ")}>
      {selectMode ? (
        <input
          type="checkbox"
          className="doc-check"
          checked={checked}
          onChange={() => onToggle(doc.doc_id)}
          aria-label={`Select ${doc.doc_name}`}
        />
      ) : null}
      <button
        className={[
          "doc-row",
          viewing ? "selected" : "",
          suffixOnly ? "compact" : "",
        ].filter(Boolean).join(" ")}
        onClick={() => (selectMode ? onToggle(doc.doc_id) : onSelect(doc))}
        title={doc.doc_name}
      >
        <File size={16} />
        <span className="doc-main">
          <span className="doc-name">{displayName}</span>
          <span className="doc-row-meta">
            <span className={doc.nav_indexed ? "mini-tag" : "mini-tag muted-tag"}>
              {doc.nav_indexed ? `nav · ${doc.nav_entry_count}` : "no nav"}
            </span>
            {ago ? <small className="doc-when">{ago}</small> : null}
          </span>
        </span>
      </button>
    </div>
  );
}
