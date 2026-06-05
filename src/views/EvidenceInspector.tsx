import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Maximize2,
  Sparkles,
  X,
  ZoomIn
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Banner } from "../components/Banner";
import type { PageRangePreview, PagePreview } from "../types";

interface EvidenceInspectorProps {
  selectedPage: PagePreview | null;
  onPageStep: (delta: number) => void;
  onCopyCitation: (citation: string) => void;
  /** Async loader for the page PNG. Returns an object URL the caller is
   *  responsible for revoking. Kept as a prop so the component is easy
   *  to test without an api client. */
  loadPageImage?: (docId: string, pageNum: number) => Promise<string>;
  selectedRange?: PageRangePreview | null;
  pageError?: string;
  /** Whether the inspected page's document has a retained source PDF. */
  hasSource?: boolean;
  /** Open that source PDF in a new tab. */
  onOpenSource?: (docId: string) => void;
}

/** Collapse the raw evidence.text into something a human can read.
 *
 *  Cases observed in the wild:
 *  - Plain prose             → return as-is, just collapse whitespace.
 *  - JSON envelope (parser)  → pick text|caption|title|heading|html in
 *    order; if html, strip tags.
 *  - Raw HTML fragments      → strip tags (MinerU table dumps).
 *  - Empty / null            → empty string.
 */
function readableEvidenceText(raw: string | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  // JSON envelope
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      for (const key of ["text", "caption", "title", "heading"]) {
        const value = parsed[key];
        if (typeof value === "string" && value.trim()) {
          return collapse(value);
        }
      }
      const html = parsed.html;
      if (typeof html === "string" && html.trim()) {
        return collapse(stripHtml(html));
      }
      return "";
    } catch {
      // fall through to HTML / plain handling
    }
  }
  // Heuristic: anything with a '<' followed by alpha is probably HTML
  if (/<[a-z!\/][^>]*>/i.test(trimmed)) {
    return collapse(stripHtml(trimmed));
  }
  return collapse(trimmed);
}

function stripHtml(html: string): string {
  // Replace common block-level tags with newlines so paragraphs survive.
  let s = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  // Decode the handful of named entities MinerU emits without pulling
  // a full HTML parser into the bundle.
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return s;
}

function collapse(s: string): string {
  return s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function EvidenceInspector({
  selectedPage,
  onPageStep,
  onCopyCitation,
  loadPageImage,
  selectedRange = null,
  pageError = "",
  hasSource = false,
  onOpenSource
}: EvidenceInspectorProps) {
  const [zoom, setZoom] = useState(100);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string>("");
  // Full-screen image lightbox: the inspector panel is narrow (~390px), too
  // small to read a dense page; the lightbox shows the rendered PNG at up to
  // viewport size with its own zoom, so the source page is legible.
  const [lightbox, setLightbox] = useState(false);
  const [lbZoom, setLbZoom] = useState(100);

  const citableText = useMemo(
    () => readableEvidenceText(selectedPage?.evidence.text),
    [selectedPage?.evidence.text]
  );
  const figureCaption = selectedPage?.evidence.figure_caption?.trim() || "";
  const generatedHint = selectedPage?.hints.generated_description?.trim() || "";
  const citation = selectedPage
    ? `${selectedPage.doc_name || selectedPage.doc_id} p${selectedPage.page_num} ${selectedPage.resource_uri}`
    : "";

  // Load the real PNG whenever the selected page changes.
  useEffect(() => {
    if (!selectedPage || !loadPageImage) {
      setImageUrl(null);
      setImageError("");
      return;
    }
    let revoke: string | null = null;
    let cancelled = false;
    setImageLoading(true);
    setImageError("");
    loadPageImage(selectedPage.doc_id, selectedPage.page_num)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        revoke = url;
        setImageUrl(url);
      })
      .catch((err) => {
        if (cancelled) return;
        setImageUrl(null);
        setImageError(err?.message || "Failed to load page image");
      })
      .finally(() => {
        if (!cancelled) setImageLoading(false);
      });
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [selectedPage?.doc_id, selectedPage?.page_num, loadPageImage]);

  // Close the lightbox on Escape.
  useEffect(() => {
    if (!lightbox) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setLightbox(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  // A page change (prev/next, new selection) closes the lightbox so it never
  // shows a stale page.
  useEffect(() => {
    setLightbox(false);
  }, [selectedPage?.doc_id, selectedPage?.page_num]);

  function copyCitation() {
    if (!citation) return;
    onCopyCitation(citation);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <aside className={expanded ? "inspector expanded" : "inspector"}>
      <div className="inspector-topbar">
        <h2>Original page</h2>
        <div className="page-tools">
          <button
            type="button"
            title="Previous page"
            disabled={!selectedPage || selectedPage.page_num <= 0}
            onClick={() => onPageStep(-1)}
          >
            <ChevronLeft size={15} />
          </button>
          <span>{selectedPage?.page_num ?? "--"}</span>
          <small>{selectedRange ? `/ ${selectedRange.page_start}-${selectedRange.page_end}` : "/ --"}</small>
          <button
            type="button"
            title="Next page"
            disabled={!selectedPage}
            onClick={() => onPageStep(1)}
          >
            <ChevronRight size={15} />
          </button>
          <button
            type="button"
            title={expanded ? "Collapse preview" : "Expand preview"}
            disabled={!selectedPage}
            onClick={() => setExpanded((value) => !value)}
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>
      {pageError ? <Banner kind="error" size="sm">{pageError}</Banner> : null}

      {selectedPage ? (
        <div className="page-preview">
          <div className="source-line">
            <FileText size={16} />
            <span title={selectedPage.doc_name || selectedPage.doc_id}>
              {selectedPage.doc_name || selectedPage.doc_id}
            </span>
            <span className="page-chip">p{selectedPage.page_num}</span>
            {hasSource && onOpenSource ? (
              <button
                type="button"
                className="source-open"
                title="Open original PDF"
                onClick={() => onOpenSource(selectedPage.doc_id)}
              >
                <ExternalLink size={13} /> PDF
              </button>
            ) : null}
          </div>

          <div className="page-image-frame">
            {imageLoading ? (
              <div className="image-placeholder">
                <ImageIcon size={26} />
                <small>Loading page image…</small>
              </div>
            ) : imageUrl ? (
              <>
                <button
                  type="button"
                  className="image-enlarge"
                  title="View full size"
                  onClick={() => { setLbZoom(100); setLightbox(true); }}
                >
                  <ZoomIn size={15} />
                </button>
                <img
                  src={imageUrl}
                  alt={`${selectedPage.doc_name || selectedPage.doc_id} page ${selectedPage.page_num}`}
                  onClick={() => { setLbZoom(100); setLightbox(true); }}
                  style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center", cursor: "zoom-in" }}
                />
              </>
            ) : (
              <div className="image-placeholder">
                <ImageIcon size={26} />
                <small>{imageError || "No rendered image for this page"}</small>
              </div>
            )}
          </div>

          <div className="page-zoom">
            <button type="button" onClick={() => setZoom((value) => Math.max(50, value - 10))} title="Zoom out">-</button>
            <span>{zoom}%</span>
            <button type="button" onClick={() => setZoom((value) => Math.min(200, value + 10))} title="Zoom in">+</button>
            <button type="button" className="zoom-reset" onClick={() => setZoom(100)} title="Reset zoom">
              Reset
            </button>
          </div>

          <section className="evidence-block">
            <div className="block-title">
              <FileText size={15} />
              <span>Evidence</span>
              <span className="evidence-badge" title="Citable: comes from the parsed page, not an LLM">
                Citable
              </span>
              <button type="button" className="copy-cite" onClick={copyCitation}>
                <Copy size={13} /> {copied ? "Copied" : "Copy cite"}
              </button>
            </div>
            <div className="evidence-meta">
              <div>
                <label>Section</label>
                <span>
                  {selectedPage.heading_path.length
                    ? selectedPage.heading_path.join(" / ")
                    : "Original page"}
                </span>
              </div>
              <div>
                <label>Page type</label>
                <span>{selectedPage.page_type || "text"}</span>
              </div>
              {selectedPage.evidence.text_truncated ? (
                <div className="evidence-warning">
                  <AlertTriangle size={12} />
                  <span>Text truncated at 20,000 chars</span>
                </div>
              ) : null}
            </div>
            <div className="evidence-text">
              {citableText || <em className="muted">No parsed text for this page.</em>}
            </div>
            {figureCaption ? (
              <div className="evidence-figure">
                <strong>Figure caption</strong>
                <span>{figureCaption}</span>
              </div>
            ) : null}
          </section>

          {generatedHint ? (
            <section className="hint-block">
              <div className="block-title">
                <Sparkles size={15} />
                <span>Hint</span>
                <span className="hint-badge" title="LLM-generated description: NOT citable">
                  Recall aid only
                </span>
              </div>
              <p>{generatedHint}</p>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="empty-state">
          <FileText size={28} />
          <p>Select a nav pointer, evidence hit, or TOC entry to inspect the original page.</p>
        </div>
      )}

      {lightbox && imageUrl && selectedPage ? (
        <div className="image-lightbox" role="dialog" aria-modal="true" onClick={() => setLightbox(false)}>
          <div className="lightbox-toolbar" onClick={(event) => event.stopPropagation()}>
            <span className="lightbox-caption">
              {selectedPage.doc_name || selectedPage.doc_id} · p{selectedPage.page_num}
            </span>
            <div className="lightbox-zoom">
              <button type="button" onClick={() => setLbZoom((z) => Math.max(40, z - 25))} title="Zoom out">−</button>
              <span>{lbZoom}%</span>
              <button type="button" onClick={() => setLbZoom((z) => Math.min(500, z + 25))} title="Zoom in">+</button>
              <button type="button" className="lightbox-reset" onClick={() => setLbZoom(100)}>Reset</button>
            </div>
            <button type="button" className="lightbox-close" onClick={() => setLightbox(false)} title="Close (Esc)">
              <X size={18} />
            </button>
          </div>
          <div className="lightbox-stage" onClick={() => setLightbox(false)}>
            <img
              src={imageUrl}
              alt={`${selectedPage.doc_name || selectedPage.doc_id} page ${selectedPage.page_num} full size`}
              style={{ height: `${(88 * lbZoom) / 100}vh`, width: "auto", maxWidth: "none" }}
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        </div>
      ) : null}
    </aside>
  );
}
