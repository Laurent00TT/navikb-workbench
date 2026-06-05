import { useCallback, useEffect, useState } from "react";

import { ApiError, createApiClient } from "../api";
import type { IngestionEvent, JobDetail } from "../types";

type ApiClient = ReturnType<typeof createApiClient>;

export interface RejectedFile {
  filename: string;
  error: string;
}

interface Ingestion {
  uploading: boolean;
  uploadError: string;
  currentJob: JobDetail | null;
  events: IngestionEvent[];
  rejected: RejectedFile[];
  uploadBatchPdfs: (files: File[]) => Promise<void>;
  refreshJob: () => Promise<void>;
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

/** Owns: batch upload, current job state, event log, rejected-file list, and
 *  the 3-second polling lifecycle. A batch upload creates ONE job with one
 *  item per file; the queue UI renders job.items directly. Polling stops
 *  automatically when the job reaches a terminal state. Events are pulled
 *  incrementally via after_id so we don't refetch the whole history each tick. */
export function useIngestion(
  api: ApiClient | null,
  onJobAdvanced?: () => void
): Ingestion {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [currentJob, setCurrentJob] = useState<JobDetail | null>(null);
  const [events, setEvents] = useState<IngestionEvent[]>([]);
  const [rejected, setRejected] = useState<RejectedFile[]>([]);

  const refreshJob = useCallback(async () => {
    if (!api || !currentJob) return;
    const lastEventId = events.length ? events[events.length - 1].event_id : 0;
    try {
      const [detail, eventBody] = await Promise.all([
        api.job(currentJob.job.job_id),
        api.events(currentJob.job.job_id, lastEventId),
      ]);
      setCurrentJob(detail);
      if (eventBody.events.length) {
        setEvents((prev) => [...prev, ...eventBody.events]);
      }
      // Surface library refresh only when a doc was actually committed.
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
        const detail = await api.job(created.job.job_id);
        setCurrentJob(detail);
        const eventBody = await api.events(created.job.job_id);
        setEvents(eventBody.events);
        if (onJobAdvanced) onJobAdvanced();
      } catch (error) {
        setUploadError(readableError(error));
      } finally {
        setUploading(false);
      }
    },
    [api, onJobAdvanced]
  );

  // Polling lifecycle: tick every 3 s only while the job is non-terminal.
  useEffect(() => {
    if (!api || !currentJob) return;
    if (TERMINAL_STATUSES.has(currentJob.job.status)) return;
    const interval = window.setInterval(() => {
      refreshJob();
    }, 3000);
    return () => window.clearInterval(interval);
  }, [api, currentJob?.job.job_id, currentJob?.job.status, refreshJob]);

  return { uploading, uploadError, currentJob, events, rejected, uploadBatchPdfs, refreshJob };
}
