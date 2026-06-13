import { FileText, RefreshCw, RotateCcw, UploadCloud } from "lucide-react";
import { ChangeEvent, DragEvent, useRef, useState } from "react";

import { Banner } from "../components/Banner";
import type { RejectedFile } from "../hooks/useIngestion";
import type { IngestionEvent, IngestionItem, ItemStage, JobDetail } from "../types";

interface IngestViewProps {
  uploading: boolean;
  uploadError: string;
  jobs: JobDetail[];
  currentJob: JobDetail | null;
  events: IngestionEvent[];
  stages: Record<string, ItemStage>;
  rejected: RejectedFile[];
  onUploadBatch: (files: File[]) => void;
  onRefreshJob: () => void;
  onRetryJob: (jobId: string) => void;
  onRetryAllFailed: () => void;
  onSelectJob: (jobId: string) => void;
}

/** Last path segment — items carry a server path like
 *  ``…/ui_uploads/<uuid>/name.pdf``; the basename is what the user uploaded. */
function baseName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

/** Queue-row presentation for one item: stage-aware label + color class.
 *  Falls back to the raw backend status when no stage signal exists yet. */
function describeItem(
  item: IngestionItem,
  stage: ItemStage | undefined
): { cls: string; label: string; pct: number | null } {
  if (stage) {
    switch (stage.phase) {
      case "parsing":
        return { cls: "parse", label: "Parsing (MinerU)", pct: null };
      case "embedding": {
        const pageInfo =
          stage.pageNum && stage.pagesTotal
            ? ` ${stage.pageNum}/${stage.pagesTotal}`
            : "";
        const pct =
          stage.pageNum && stage.pagesTotal
            ? Math.round((stage.pageNum / stage.pagesTotal) * 100)
            : null;
        return { cls: "parse", label: `Embedding pages${pageInfo}`, pct };
      }
      case "finalizing":
        return { cls: "parse", label: "Finalizing (metadata + nav)", pct: 100 };
      case "done":
        return { cls: "ok", label: "Indexed", pct: null };
      case "skipped":
        return { cls: "skip", label: "Skipped · unchanged", pct: null };
      case "failed":
        return { cls: "err", label: "Failed", pct: null };
      case "queued":
        if (stage.error) {
          // Requeued after a retryable failure — keep the cause on screen.
          return { cls: "queued", label: "Queued · will retry", pct: null };
        }
        return { cls: "queued", label: "Queued", pct: null };
    }
  }
  switch (item.status) {
    case "succeeded":
      return { cls: "ok", label: "Indexed", pct: null };
    case "claimed":
    case "running":
      return { cls: "parse", label: "Processing", pct: null };
    case "failed":
      return { cls: "err", label: "Failed", pct: null };
    case "skipped":
      return { cls: "skip", label: "Skipped · unchanged", pct: null };
    case "cancelled":
      return { cls: "skip", label: "Cancelled", pct: null };
    default:
      return { cls: "queued", label: "Queued", pct: null };
  }
}

function jobChipLabel(detail: JobDetail): string {
  const first = detail.items[0] ? baseName(detail.items[0].path) : detail.job.job_id.slice(0, 8);
  return detail.items.length > 1 ? `${first} +${detail.items.length - 1}` : first;
}

export function IngestView({
  uploading,
  uploadError,
  jobs,
  currentJob,
  events,
  stages,
  rejected,
  onUploadBatch,
  onRefreshJob,
  onRetryJob,
  onRetryAllFailed,
  onSelectJob
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
  const pct = job && job.total_items
    ? Math.round(((job.succeeded_items + job.skipped_items) / job.total_items) * 100)
    : 0;
  const totalFailedAcrossJobs = jobs.reduce((n, j) => n + j.job.failed_items, 0);

  return (
    <section className="workspace ingest-workspace">
      <div className="workspace-header">
        <div>
          <p className="eyebrow">Ingest</p>
          <h2>Upload PDFs into the pointer graph</h2>
        </div>
        {totalFailedAcrossJobs > 0 ? (
          <button
            type="button"
            className="chip-button retry-all"
            onClick={onRetryAllFailed}
            title="Requeue every failed file across all your jobs"
          >
            <RotateCcw size={13} /> Retry all failed ({totalFailedAcrossJobs})
          </button>
        ) : null}
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

      {jobs.length > 1 ? (
        <div className="job-history" aria-label="Recent ingest jobs">
          {jobs.slice(0, 8).map((detail) => (
            <button
              key={detail.job.job_id}
              type="button"
              className={
                detail.job.job_id === job?.job_id
                  ? "job-chip active"
                  : "job-chip"
              }
              onClick={() => onSelectJob(detail.job.job_id)}
              title={`${detail.job.status} · ${detail.job.total_items} files`}
            >
              {jobChipLabel(detail)}
              {detail.job.failed_items > 0 ? (
                <span className="job-chip-fail">{detail.job.failed_items}✕</span>
              ) : null}
            </button>
          ))}
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
            {job.failed_items > 0 ? (
              <button
                className="chip-button"
                type="button"
                onClick={() => onRetryJob(job.job_id)}
                title="Requeue this job's failed files"
              >
                <RotateCcw size={13} /> Retry
              </button>
            ) : null}
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
              const stage = stages[item.item_id];
              const meta = describeItem(item, stage);
              return (
                <div className="ingest-qrow" key={item.item_id}>
                  <FileText size={15} className="qrow-fic" />
                  <span className="qrow-name" title={baseName(item.path)}>
                    {baseName(item.path)}
                  </span>
                  {meta.pct !== null ? (
                    <span className="qrow-track" aria-hidden="true">
                      <i style={{ width: `${meta.pct}%` }} />
                    </span>
                  ) : null}
                  <span className={`qrow-status st-${meta.cls}`}>
                    <span className="st-dot" />
                    {meta.label}
                    {item.attempt > 1 || (item.status === "failed" && item.attempt > 0)
                      ? ` · attempt ${item.attempt}/${item.max_attempts}`
                      : ""}
                  </span>
                </div>
              );
            })}
            {items.length === 0 ? <p className="muted tiny">Queue is empty.</p> : null}
          </div>

          {/* Failures stay on screen with their cause — nothing silently
              drops out of the queue (that was exactly the old bug). */}
          {items.some((i) => stages[i.item_id]?.error) ? (
            <div className="ingest-failures">
              {items
                .filter((i) => stages[i.item_id]?.error)
                .map((i) => (
                  <div className="failure-row" key={i.item_id}>
                    <span className="failure-name">{baseName(i.path)}</span>
                    <span className="failure-msg">{stages[i.item_id]?.error}</span>
                  </div>
                ))}
            </div>
          ) : null}

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
