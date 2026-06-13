import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, createApiClient } from "../api";
import type { IngestionEvent, IngestionItem, ItemStage, JobDetail } from "../types";

type ApiClient = ReturnType<typeof createApiClient>;

export interface RejectedFile {
  filename: string;
  error: string;
}

interface Ingestion {
  uploading: boolean;
  uploadError: string;
  /** Newest-first job history (queue survives page refresh). */
  jobs: JobDetail[];
  /** The job whose events are being followed (newest active, else newest). */
  currentJob: JobDetail | null;
  events: IngestionEvent[];
  /** item_id -> derived stage (parsing / embedding 7÷13 / failed + error …). */
  stages: Record<string, ItemStage>;
  rejected: RejectedFile[];
  uploadBatchPdfs: (files: File[]) => Promise<void>;
  refreshJob: () => Promise<void>;
  refreshJobs: () => Promise<void>;
  retryJob: (jobId: string) => Promise<void>;
  retryAllFailed: () => Promise<void>;
  selectJob: (jobId: string) => void;
}

const TERMINAL_STATUSES = new Set([
  "succeeded",
  "failed",
  "cancelled",
  "complete",
  "completed",
  "partially_succeeded",
]);

function readableError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

/** Fold the job event stream into a per-item stage. Pure — unit-testable.
 *  Event vocabulary (backend job_executor + pipeline progress hook):
 *    ingest.item.started            -> parsing
 *    ingest.stage.parse.done        -> embedding (pagesTotal known)
 *    ingest.stage.page.done         -> embedding pageNum/pagesTotal
 *    ingest.stage.metadata.done     -> finalizing
 *    ingest.stage.nav.done          -> finalizing
 *    ingest.item.finished           -> done (or skipped)
 *    ingest.item.failed             -> failed (+error, retryable)
 *  Item.status is overlaid last as ground truth — events can lag a poll. */
export function deriveItemStages(
  items: IngestionItem[],
  events: IngestionEvent[]
): Record<string, ItemStage> {
  const stages: Record<string, ItemStage> = {};
  for (const item of items) {
    stages[item.item_id] = { phase: "queued" };
  }
  for (const ev of events) {
    if (!ev.item_id || !(ev.item_id in stages)) continue;
    const stage = stages[ev.item_id];
    switch (ev.event) {
      case "ingest.item.started":
      case "ingest.stage.parse.start":
        stages[ev.item_id] = { phase: "parsing" };
        break;
      case "ingest.stage.parse.done":
        stages[ev.item_id] = {
          phase: "embedding",
          pagesTotal: Number(ev.payload.pages) || undefined,
        };
        break;
      case "ingest.stage.page.done":
        stages[ev.item_id] = {
          phase: "embedding",
          pageNum: Number(ev.payload.page_num) + 1,
          pagesTotal: Number(ev.payload.pages_total) || stage.pagesTotal,
        };
        break;
      case "ingest.stage.metadata.done":
      case "ingest.stage.nav.done":
        stages[ev.item_id] = { phase: "finalizing" };
        break;
      case "ingest.item.finished": {
        const result = ev.payload.result as { skipped?: boolean } | undefined;
        stages[ev.item_id] = { phase: result?.skipped ? "skipped" : "done" };
        break;
      }
      case "ingest.item.failed": {
        const error = ev.payload.error as
          | { message?: string; retryable?: boolean }
          | undefined;
        stages[ev.item_id] = {
          phase: "failed",
          error: error?.message ?? "Unknown error",
          retryable: error?.retryable,
        };
        break;
      }
      default:
        break;
    }
  }
  // Item status is authoritative for terminal states; a failed item that
  // was requeued for retry shows as queued again (attempt > 0 visible on
  // the item itself).
  for (const item of items) {
    const stage = stages[item.item_id];
    if (item.status === "succeeded") stages[item.item_id] = { phase: "done" };
    else if (item.status === "skipped") stages[item.item_id] = { phase: "skipped" };
    else if (item.status === "failed" && stage.phase !== "failed") {
      stages[item.item_id] = { phase: "failed", error: stage.error };
    } else if (item.status === "queued" && stage.phase === "failed") {
      // failure event exists but the item was already requeued (retry):
      // keep the error visible while signalling it will run again.
      stages[item.item_id] = { ...stage, phase: "queued" };
    }
  }
  return stages;
}

function pickCurrent(jobs: JobDetail[]): JobDetail | null {
  const active = jobs.find((j) => !TERMINAL_STATUSES.has(j.job.status));
  return active ?? jobs[0] ?? null;
}

/** Owns: job-history rehydration (mount), batch upload, current-job event
 *  follow with 3-second polling, per-job retry, and retry-all-failed.
 *  The queue is backend state — a page refresh re-lists jobs instead of
 *  forgetting them (the old hook kept everything in React state only). */
export function useIngestion(
  api: ApiClient | null,
  onJobAdvanced?: () => void
): Ingestion {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [jobs, setJobs] = useState<JobDetail[]>([]);
  const [currentJob, setCurrentJob] = useState<JobDetail | null>(null);
  const [events, setEvents] = useState<IngestionEvent[]>([]);
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  // Pinned by selectJob / upload so polling doesn't jump to another job.
  const pinnedJobId = useRef<string | null>(null);

  const stages = currentJob
    ? deriveItemStages(currentJob.items, events)
    : {};

  const switchCurrent = useCallback(
    async (detail: JobDetail | null) => {
      setCurrentJob(detail);
      if (!api || !detail) {
        setEvents([]);
        return;
      }
      try {
        const eventBody = await api.events(detail.job.job_id);
        setEvents(eventBody.events);
      } catch {
        setEvents([]);
      }
    },
    [api]
  );

  const refreshJobs = useCallback(async () => {
    if (!api) return;
    try {
      const body = await api.listJobs({ limit: 20 });
      setJobs(body.jobs);
      const pinned = pinnedJobId.current
        ? body.jobs.find((j) => j.job.job_id === pinnedJobId.current)
        : null;
      const next = pinned ?? pickCurrent(body.jobs);
      // Only switch (and refetch events) when the followed job changes.
      if (next?.job.job_id !== currentJob?.job.job_id) {
        await switchCurrent(next ?? null);
      }
    } catch {
      // Transient — keep last good list.
    }
  }, [api, currentJob?.job.job_id, switchCurrent]);

  // Mount / token change: rediscover jobs so an in-flight upload survives F5.
  useEffect(() => {
    pinnedJobId.current = null;
    void refreshJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const refreshJob = useCallback(async () => {
    if (!api || !currentJob) return;
    const lastEventId = events.length ? events[events.length - 1].event_id : 0;
    try {
      const [detail, eventBody] = await Promise.all([
        api.job(currentJob.job.job_id),
        api.events(currentJob.job.job_id, lastEventId),
      ]);
      setCurrentJob(detail);
      setJobs((prev) =>
        prev.map((j) => (j.job.job_id === detail.job.job_id ? detail : j))
      );
      if (eventBody.events.length) {
        setEvents((prev) => [...prev, ...eventBody.events]);
      }
      if (detail.job.succeeded_items > currentJob.job.succeeded_items && onJobAdvanced) {
        onJobAdvanced();
      }
    } catch {
      // Transient polling errors shouldn't kill the loop — the next tick
      // will try again. UI shows the last good state in the meantime.
    }
  }, [api, currentJob, events, onJobAdvanced]);

  const uploadBatchPdfs = useCallback(
    async (files: File[]) => {
      if (!api || files.length === 0) return;
      setUploading(true);
      setUploadError("");
      setRejected([]);
      try {
        const created = await api.uploadBatch(files);
        setRejected(created.rejected ?? []);
        pinnedJobId.current = created.job.job_id;
        const detail = await api.job(created.job.job_id);
        await switchCurrent(detail);
        setJobs((prev) => [detail, ...prev.filter((j) => j.job.job_id !== detail.job.job_id)]);
        if (onJobAdvanced) onJobAdvanced();
      } catch (error) {
        setUploadError(readableError(error));
      } finally {
        setUploading(false);
      }
    },
    [api, onJobAdvanced, switchCurrent]
  );

  const retryJob = useCallback(
    async (jobId: string) => {
      if (!api) return;
      try {
        await api.retryJob(jobId);
        pinnedJobId.current = jobId;
        const detail = await api.job(jobId);
        await switchCurrent(detail);
        setJobs((prev) =>
          prev.map((j) => (j.job.job_id === jobId ? detail : j))
        );
      } catch (error) {
        setUploadError(readableError(error));
      }
    },
    [api, switchCurrent]
  );

  const retryAllFailed = useCallback(async () => {
    if (!api) return;
    const failed = jobs.filter((j) => j.job.failed_items > 0);
    for (const j of failed) {
      try {
        await api.retryJob(j.job.job_id);
      } catch (error) {
        setUploadError(readableError(error));
      }
    }
    if (failed.length) {
      pinnedJobId.current = failed[0].job.job_id;
      await refreshJobs();
    }
  }, [api, jobs, refreshJobs]);

  const selectJob = useCallback(
    (jobId: string) => {
      pinnedJobId.current = jobId;
      const detail = jobs.find((j) => j.job.job_id === jobId) ?? null;
      void switchCurrent(detail);
    },
    [jobs, switchCurrent]
  );

  // Polling lifecycle: tick every 3 s only while the followed job is
  // non-terminal.
  useEffect(() => {
    if (!api || !currentJob) return;
    if (TERMINAL_STATUSES.has(currentJob.job.status)) return;
    const interval = window.setInterval(() => {
      refreshJob();
    }, 3000);
    return () => window.clearInterval(interval);
  }, [api, currentJob?.job.job_id, currentJob?.job.status, refreshJob]);

  return {
    uploading,
    uploadError,
    jobs,
    currentJob,
    events,
    stages,
    rejected,
    uploadBatchPdfs,
    refreshJob,
    refreshJobs,
    retryJob,
    retryAllFailed,
    selectJob,
  };
}
