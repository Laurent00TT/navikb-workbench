import {
  ArrowRight,
  ChevronDown,
  FileText,
  LocateFixed,
  Map as MapIcon,
  Search,
  SlidersHorizontal
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { Banner } from "../components/Banner";
import type { EvidenceHit, FetchTarget, HybridSearchResponse, NavHit } from "../types";

interface ExploreViewProps {
  query: string;
  topK: number;
  result: HybridSearchResponse | null;
  loading: boolean;
  error: string;
  onQueryChange: (query: string) => void;
  onTopKChange: (topK: number) => void;
  onSearch: () => void;
  onSelectEvidence: (hit: EvidenceHit) => void;
  onSelectNav: (hit: NavHit) => void;
  onSelectFetch: (target: FetchTarget) => void;
}

type LaneKind = "pointer" | "evidence" | "suggested";
type ModeKey = "all" | LaneKind;

interface UnifiedHit {
  key: string;
  kind: LaneKind;
  doc_id: string;
  doc_name: string;
  page_label: string;
  pageStart: number;
  pageEnd: number;
  rawScore: number;
  /** Normalized 0..1 within this lane. Lanes are normalized independently
   *  because nav_hits use a TERM-COUNT score, evidence uses cross-encoder
   *  probabilities — they live on incomparable scales. */
  normScore: number;
  channels: string[];
  label: string;
  /** What to do when the user clicks. Closes over the original hit so the
   *  consumer doesn't have to re-find it. */
  onSelect: () => void;
}

function basename(name: string): string {
  return name.split(/[\\/]/).filter(Boolean).at(-1) || name;
}

function shortId(id: string, max = 12): string {
  return id.length <= max ? id : `${id.slice(0, max)}…`;
}

/** Normalize raw scores within a lane so the bar widths are visually
 *  comparable. Empty lanes degrade gracefully. */
function normalize<T>(items: T[], getScore: (t: T) => number): Map<T, number> {
  const out = new Map<T, number>();
  if (items.length === 0) return out;
  const scores = items.map(getScore);
  const max = Math.max(...scores);
  for (const it of items) {
    const s = getScore(it);
    out.set(it, max > 0 ? s / max : 0);
  }
  return out;
}

export function ExploreView({
  query,
  topK,
  result,
  loading,
  error,
  onQueryChange,
  onTopKChange,
  onSearch,
  onSelectEvidence,
  onSelectNav,
  onSelectFetch
}: ExploreViewProps) {
  const [mode, setMode] = useState<ModeKey>("all");
  const [showOptions, setShowOptions] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSearch();
  }

  const navHits = result?.nav_hits ?? [];
  const evidenceHits = result?.evidence_hits ?? [];
  const suggestedFetches = result?.suggested_fetches ?? [];

  // nav_hits and suggested_fetches are 1:1 (HybridNavigator derives the
  // latter from the former). Showing both makes the list noisy. We surface
  // nav_hits as the primary "pointer" lane; suggested fetches are kept as
  // an opt-in "suggested" lane for when the user wants to bulk-fetch ranges.
  const navByDocPage = useMemo(() => {
    const set = new Set<string>();
    for (const n of navHits) {
      set.add(`${n.doc_id}|${n.page_start}-${n.page_end}`);
    }
    return set;
  }, [navHits]);

  const dedupedSuggested = useMemo(
    () => suggestedFetches.filter(
      (t) => !navByDocPage.has(`${t.doc_id}|${t.page_start}-${t.page_end}`)
    ),
    [suggestedFetches, navByDocPage]
  );

  const navNorms = useMemo(() => normalize(navHits, (h) => h.score), [navHits]);
  const evidenceNorms = useMemo(
    () => normalize(evidenceHits, (h) => h.score),
    [evidenceHits]
  );

  const unified: UnifiedHit[] = useMemo(() => {
    const out: UnifiedHit[] = [];
    if (mode === "all" || mode === "evidence") {
      for (const h of evidenceHits) {
        out.push({
          key: `e-${h.doc_id}-${h.page_num}`,
          kind: "evidence",
          doc_id: h.doc_id,
          doc_name: h.doc_name,
          page_label: `p.${h.page_num}`,
          pageStart: h.page_num,
          pageEnd: h.page_num,
          rawScore: h.score,
          normScore: evidenceNorms.get(h) ?? 0,
          channels: h.match_channels ?? [],
          label:
            (h.heading_path && h.heading_path.length
              ? h.heading_path.join(" / ")
              : h.section || h.text_preview || ""),
          onSelect: () => onSelectEvidence(h),
        });
      }
    }
    if (mode === "all" || mode === "pointer") {
      for (const h of navHits) {
        out.push({
          key: `n-${h.entry_id}`,
          kind: "pointer",
          doc_id: h.doc_id,
          doc_name: h.doc_name,
          page_label:
            h.page_start === h.page_end ? `p.${h.page_start}` : `p.${h.page_start}-${h.page_end}`,
          pageStart: h.page_start,
          pageEnd: h.page_end,
          rawScore: h.score,
          normScore: navNorms.get(h) ?? 0,
          channels: [],
          label: h.label,
          onSelect: () => onSelectNav(h),
        });
      }
    }
    if (mode === "all" || mode === "suggested") {
      for (const t of dedupedSuggested) {
        out.push({
          key: `s-${t.resource_uri}`,
          kind: "suggested",
          doc_id: t.doc_id,
          doc_name: t.doc_id,
          page_label:
            t.page_start === t.page_end ? `p.${t.page_start}` : `p.${t.page_start}-${t.page_end}`,
          pageStart: t.page_start,
          pageEnd: t.page_end,
          rawScore: 0,
          normScore: 0,
          channels: [],
          label: t.reason,
          onSelect: () => onSelectFetch(t),
        });
      }
    }
    // Sort across lanes by normalized score desc; suggested fetches sort last.
    out.sort((a, b) => {
      if (a.kind === "suggested" && b.kind !== "suggested") return 1;
      if (b.kind === "suggested" && a.kind !== "suggested") return -1;
      return b.normScore - a.normScore;
    });
    return out;
  }, [mode, evidenceHits, navHits, dedupedSuggested, evidenceNorms, navNorms, onSelectEvidence, onSelectNav, onSelectFetch]);

  const hasResults = unified.length > 0;
  const counts = {
    pointer: navHits.length,
    evidence: evidenceHits.length,
    suggested: dedupedSuggested.length,
  };

  return (
    <section className="workspace">
      <form className="search-toolbar" onSubmit={handleSubmit}>
        <label className="search-field">
          <Search size={18} />
          <input
            placeholder="Search your library — e.g., working capital, supply chain"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <select value={topK} onChange={(event) => onTopKChange(Number(event.target.value))} title="Result limit">
          <option value={5}>Top 5</option>
          <option value={10}>Top 10</option>
          <option value={20}>Top 20</option>
        </select>
        <button className="primary-button" type="submit" disabled={loading || !query.trim()}>
          {loading ? "Searching" : "Search"}
        </button>
        <button
          className={showOptions ? "square-button active toolbar-settings" : "square-button toolbar-settings"}
          title="Search details"
          type="button"
          onClick={() => setShowOptions((v) => !v)}
          aria-pressed={showOptions}
        >
          <SlidersHorizontal size={17} />
        </button>
      </form>
      {showOptions ? (
        <div className="search-options-panel">
          <span>Routing</span>
          <strong>{result?.routing_reason ?? "Run a query to inspect routing."}</strong>
          <span className="dot-sep">·</span>
          <span>Pointer score uses term-match count; Evidence score uses cross-encoder (0–1).</span>
        </div>
      ) : null}
      {error ? <Banner kind="error" title="Search failed">{error}</Banner> : null}

      <section className="explore-results">
        <div className="explore-toolbar">
          <div className="lane-filters" role="tablist" aria-label="Filter by lane">
            <button
              type="button"
              className={mode === "all" ? "lane-filter active" : "lane-filter"}
              onClick={() => setMode("all")}
              role="tab"
              aria-selected={mode === "all"}
            >
              All <small>{counts.pointer + counts.evidence + counts.suggested}</small>
            </button>
            <button
              type="button"
              className={mode === "evidence" ? "lane-filter evidence active" : "lane-filter evidence"}
              onClick={() => setMode("evidence")}
              role="tab"
              aria-selected={mode === "evidence"}
            >
              <FileText size={13} /> Evidence <small>{counts.evidence}</small>
            </button>
            <button
              type="button"
              className={mode === "pointer" ? "lane-filter pointer active" : "lane-filter pointer"}
              onClick={() => setMode("pointer")}
              role="tab"
              aria-selected={mode === "pointer"}
            >
              <LocateFixed size={13} /> Nav pointers <small>{counts.pointer}</small>
            </button>
            <button
              type="button"
              className={mode === "suggested" ? "lane-filter suggested active" : "lane-filter suggested"}
              onClick={() => setMode("suggested")}
              role="tab"
              aria-selected={mode === "suggested"}
            >
              <ArrowRight size={13} /> Suggested <small>{counts.suggested}</small>
            </button>
          </div>
          <div className="result-legend">
            <span><MapIcon size={12} /> sorted by normalized score</span>
          </div>
        </div>

        {hasResults ? (
          <div className="hit-list" role="list">
            {unified.map((hit) => (
              <button
                key={hit.key}
                type="button"
                className={`hit-row hit-${hit.kind}`}
                role="listitem"
                onClick={hit.onSelect}
                title={`${hit.doc_name} ${hit.page_label}`}
              >
                <span className="hit-kind-icon">
                  {hit.kind === "evidence" ? <FileText size={14} /> :
                   hit.kind === "pointer" ? <LocateFixed size={14} /> :
                   <ArrowRight size={14} />}
                </span>
                <span className="hit-source">
                  <strong>{basename(hit.doc_name)}</strong>
                  <small>{shortId(hit.doc_id)}</small>
                </span>
                <span className="hit-page">{hit.page_label}</span>
                <span className="hit-label">{hit.label || (hit.kind === "suggested" ? "Suggested fetch" : "Original page")}</span>
                <span className="hit-channels">
                  {hit.channels.map((c) => (
                    <em key={c} className="channel-chip">{c}</em>
                  ))}
                </span>
                <span className="hit-score">
                  <i className="score-bar"><span style={{ width: `${Math.max(6, Math.round(hit.normScore * 100))}%` }} /></i>
                  <small>{hit.kind === "suggested" ? "—" : hit.rawScore.toFixed(2)}</small>
                </span>
                <ChevronDown size={14} className="hit-chevron" />
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-hit-list">
            <MapIcon size={28} />
            <p>
              {result
                ? "No hits for this query — try a different phrase, broaden the search, or upload more documents."
                : "Run a query to reveal pointers, evidence, and suggested page ranges."}
            </p>
          </div>
        )}
      </section>
    </section>
  );
}
