import { Pause, Play, RefreshCw, ScrollText } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { createApiClient } from "../api";
import type { LogEntry } from "../types";

type ApiClient = ReturnType<typeof createApiClient>;

interface LogsViewProps {
  api: ApiClient | null;
}

type SourceFilter = "all" | "jobs" | "trace";
type LevelFilter = "" | "info" | "error";

/** Compact single-line summary of a log entry's payload. */
function payloadPreview(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined || value === "") continue;
    const text =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    parts.push(`${key}=${text.length > 60 ? `${text.slice(0, 60)}…` : text}`);
    if (parts.length >= 5) break;
  }
  return parts.join("  ");
}

function fmtTs(ts: string | null): string {
  if (!ts) return "—";
  // Job-event ts is naive UTC ("2026-06-11 12:46:20.93"), trace ts is ISO
  // with Z — normalise both to a local HH:MM:SS plus date when not today.
  const normalized = ts.includes("T") ? ts : `${ts.replace(" ", "T")}Z`;
  const date = new Date(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) return ts;
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const hms = date.toLocaleTimeString("en-GB", { hour12: false });
  return sameDay ? hms : `${date.toLocaleDateString("sv-SE")} ${hms}`;
}

/** Logs tab: one merged timeline over the job event table (ingest lifecycle,
 *  owner-scoped) and the structured trace tails of the serve + worker
 *  processes. Newest at the bottom, auto-refresh every 5 s while enabled. */
export function LogsView({ api }: LogsViewProps) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [source, setSource] = useState<SourceFilter>("all");
  const [level, setLevel] = useState<LevelFilter>("");
  const [search, setSearch] = useState("");
  const [auto, setAuto] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    try {
      const body = await api.logs({ source, level, limit: 300 });
      setEntries(body.entries);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [api, source, level]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!auto) return;
    const interval = window.setInterval(() => {
      void refresh();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [auto, refresh]);

  const visible = useMemo(() => {
    if (!search.trim()) return entries;
    const needle = search.trim().toLowerCase();
    return entries.filter((e) =>
      `${e.event} ${e.message} ${e.job_id ?? ""} ${payloadPreview(e.payload)}`
        .toLowerCase()
        .includes(needle)
    );
  }, [entries, search]);

  return (
    <section className="workspace logs-workspace">
      <div className="workspace-header">
        <div>
          <p className="eyebrow">Logs</p>
          <h2>Ingest events &amp; system traces</h2>
        </div>
      </div>

      <div className="logs-toolbar">
        <div className="logs-filters" role="group" aria-label="Log source">
          {(["all", "jobs", "trace"] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={source === key ? "filter-chip active" : "filter-chip"}
              onClick={() => setSource(key)}
            >
              {key === "all" ? "All" : key === "jobs" ? "Ingest jobs" : "Traces"}
            </button>
          ))}
        </div>
        <div className="logs-filters" role="group" aria-label="Log level">
          {([
            ["", "Every level"],
            ["error", "Errors only"],
          ] as const).map(([key, label]) => (
            <button
              key={key || "any"}
              type="button"
              className={level === key ? "filter-chip active" : "filter-chip"}
              onClick={() => setLevel(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          className="logs-search"
          type="search"
          placeholder="Filter by event / message / job id…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          className="square-button"
          onClick={() => setAuto((v) => !v)}
          title={auto ? "Pause auto-refresh" : "Resume auto-refresh (5s)"}
        >
          {auto ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button
          type="button"
          className="square-button"
          onClick={() => void refresh()}
          title="Refresh now"
        >
          <RefreshCw size={14} className={loading ? "spin" : undefined} />
        </button>
      </div>

      {error ? <p className="logs-error">{error}</p> : null}

      <div className="logs-table" role="log" aria-label="Log entries">
        {visible.length === 0 ? (
          <div className="logs-empty">
            <ScrollText size={22} />
            <p>{loading ? "Loading…" : "No log entries match the current filters."}</p>
          </div>
        ) : (
          visible.map((entry, idx) => (
            <div
              key={entry.event_id ?? `${entry.source}-${entry.ts}-${idx}`}
              className={
                entry.level === "error"
                  ? "log-row level-error"
                  : "log-row"
              }
            >
              <span className="log-ts">{fmtTs(entry.ts)}</span>
              <span className={`log-source src-${entry.source.replace(":", "-")}`}>
                {entry.source}
              </span>
              <span className="log-event" title={entry.event}>
                {entry.event}
              </span>
              <span className="log-detail">
                {entry.message ? <em>{entry.message} </em> : null}
                {payloadPreview(entry.payload)}
              </span>
            </div>
          ))
        )}
      </div>
      <p className="muted tiny logs-hint">
        Ingest job events are owner-scoped; traces are the structured tails of
        serve (kb_trace.jsonl) and worker (kb_trace_worker.jsonl).
      </p>
    </section>
  );
}
