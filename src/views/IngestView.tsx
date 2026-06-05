import { FileText, RefreshCw, UploadCloud } from "lucide-react";
import { ChangeEvent, DragEvent, useRef, useState } from "react";

import { Banner } from "../components/Banner";
import type { RejectedFile } from "../hooks/useIngestion";
import type { IngestionEvent, JobDetail } from "../types";

interface IngestViewProps {
  uploading: boolean;
  uploadError: string;
  currentJob: JobDetail | null;
  events: IngestionEvent[];
  rejected: RejectedFile[];
  onUploadBatch: (files: File[]) => void;
  onRefreshJob: () => void;
}

/** Last path segment — items carry a server path like
 *  ``…/ui_uploads/<uuid>/name.pdf``; the basename is what the user uploaded. */
function baseName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

/** Map an item's backend status to a queue-row class + label. */
function itemStatus(status: string): { cls: string; label: string } {
  switch (status) {
    case "succeeded":
      return { cls: "ok", label: "Indexed" };
    case "claimed":
    case "running":
      return { cls: "parse", label: "Processing" };
    case "failed":
      return { cls: "err", label: "Failed" };
    case "skipped":
      return { cls: "skip", label: "Skipped · unchanged" };
    case "cancelled":
      return { cls: "skip", label: "Cancelled" };
    case "queued":
    default:
      return { cls: "queued", label: "Queued" };
  }
}

export function IngestView({
  uploading,
  uploadError,
  currentJob,
  events,
  rejected,
  onUploadBatch,
  onRefreshJob
}: IngestViewProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(list: FileList | null) {
    if (!list || list.length === 0) return;
    onUploadBatch(Array.from(list));
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    submit(event.target.files);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    submit(event.dataTransfer.files);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!dragging) setDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
  }

  const job = currentJob?.job ?? null;
  const items = currentJob?.items ?? [];
  const processing = items.filter((i) => i.status === "claimed" || i.status === "running").length;
  const queued = items.filter((i) => i.status === "queued").length;
  const pct = job && job.total_items ? Math.round((job.succeeded_items / job.total_items) * 100) : 0;

  return (
    <section className="workspace ingest-workspace">
      <div className="workspace-header">
        <div>
          <p className="eyebrow">Ingest</p>
          <h2>Upload PDFs into the pointer graph</h2>
        </div>
      </div>

      {/* Candidate B: compact drop tray — does not eat vertical space. */}
      <div
        className={dragging ? "ingest-tray drag" : "ingest-tray"}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <UploadCloud size={20} className="tray-ic" />
        <span className="tray-text">
          {uploading
            ? "Uploading…"
            : dragging
              ? "Drop to upload"
              : "Drag PDFs here, or select several at once. Same-name files replace the prior version; non-PDFs are skipped."}
        </span>
        <button
          type="button"
          className="tray-pick"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={handleInput}
        />
      </div>

      {uploadError ? (
        <Banner kind="error" title="Upload failed">
          {uploadError}
        </Banner>
      ) : null}

      {rejected.length > 0 ? (
        <div className="ingest-rejected">
          ⚠ {rejected.length} file{rejected.length > 1 ? "s" : ""} skipped:
          {rejected.map((r) => ` ${r.filename} (${r.error})`).join(",")}
        </div>
      ) : null}

      {job ? (
        <>
          <div className="ingest-batch">
            <strong className="batch-count">{job.total_items} files</strong>
            <span className="batch-breakdown">
              {job.succeeded_items} indexed
              {processing ? ` · ${processing} processing` : ""}
              {queued ? ` · ${queued} queued` : ""}
              {job.failed_items ? (
                <span className="batch-fail"> · {job.failed_items} failed</span>
              ) : null}
              {job.skipped_items ? ` · ${job.skipped_items} skipped` : ""}
            </span>
            <span className="batch-track">
              <i style={{ width: `${pct}%` }} />
            </span>
            <button
              className="batch-refresh"
              type="button"
              onClick={onRefreshJob}
              title="Refresh progress"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="ingest-queue">
            {items.map((item) => {
              const meta = itemStatus(item.status);
              return (
                <div className="ingest-qrow" key={item.item_id}>
                  <FileText size={15} className="qrow-fic" />
                  <span className="qrow-name" title={baseName(item.path)}>
                    {baseName(item.path)}
                  </span>
                  <span className={`qrow-status st-${meta.cls}`}>
                    <span className="st-dot" />
                    {meta.label}
                    {item.status === "failed" && item.attempt < item.max_attempts
                      ? ` · retry ${item.attempt}/${item.max_attempts}`
                      : ""}
                  </span>
                </div>
              );
            })}
            {items.length === 0 ? <p className="muted tiny">Queue is empty.</p> : null}
          </div>

          {events.length > 0 ? (
            <details className="ingest-events">
              <summary>Event log ({events.length})</summary>
              <div className="event-list">
                {events.map((event) => (
                  <div className="event-row" key={event.event_id}>
                    <span>{event.event}</span>
                    <p>{event.message}</p>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </>
      ) : (
        <p className="muted ingest-empty">
          No upload yet. Drop or choose PDFs to see per-file progress for the whole batch here.
        </p>
      )}
    </section>
  );
}
