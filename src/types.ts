export type UserRole = "member" | "admin";

export interface CurrentUser {
  user_id: string;
  username: string;
  role: UserRole;
  key_prefix: string;
  created_at: string | null;
}

export interface ServerStatus {
  meta_db_ready: boolean;
  evidence_ready: boolean;
  nav_ready: boolean;
  hybrid_ready: boolean;
  document_count: number;
  nav_entry_count: number;
  nav_doc_count: number;
  mcp_write_tools_enabled: boolean;
  maintenance: null | {
    on: boolean;
    set_at: string | null;
    set_by_user_id: string | null;
  };
}

export interface DocumentItem {
  doc_id: string;
  doc_name: string;
  version: string | null;
  status: string;
  owner_id: string | null;
  nav_indexed: boolean;
  nav_entry_count: number;
  resource_uri: string;
  ingested_at: string | null;
  /** Whether the original source PDF was retained at ingest. */
  has_source?: boolean;
  source_bytes?: number | null;
}

export interface TocEntry {
  entry_id: string;
  label: string;
  entry_type: string;
  page_start: number;
  page_end: number;
  resource_uris: string[];
  parent_entry_id: string | null;
  order_index: number;
}

export interface EvidenceHit {
  doc_id: string;
  doc_name: string;
  page_num: number;
  resource_uri: string;
  score: number;
  section?: string;
  text_preview?: string;
  heading_path?: string[];
  match_channels?: string[];
  page_type?: string;
}

export interface NavHit {
  entry_id: string;
  label: string;
  entry_type: string;
  score: number;
  doc_id: string;
  doc_name: string;
  page_start: number;
  page_end: number;
  resource_uris: string[];
  match_channels: string[];
  contains_generated_content: boolean;
}

export interface FetchTarget {
  reason: string;
  resource_uri: string;
  doc_id: string;
  page_start: number;
  page_end: number;
}

export interface HybridSearchResponse {
  query: string;
  evidence_hits: EvidenceHit[];
  nav_hits: NavHit[];
  suggested_fetches: FetchTarget[];
  routing_reason: string;
  contains_generated_content: boolean;
}

export interface PagePreview {
  status: string;
  safety?: string;
  doc_id: string;
  doc_name: string;
  page_num: number;
  page_type: string;
  heading_path: string[];
  resource_uri: string;
  image_resource_uri: string;
  evidence: {
    text: string;
    text_truncated: boolean;
    figure_caption: string;
    figure_index: string | null;
    image_url: string;
  };
  hints: {
    generated_description: string;
  };
  evidence_fields: string[];
  hint_fields: string[];
}

export interface PageRangePreview {
  doc_id: string;
  page_start: number;
  page_end: number;
  pages: PagePreview[];
}

export interface IngestionJob {
  job_id: string;
  status: string;
  total_items: number;
  succeeded_items: number;
  failed_items: number;
  skipped_items: number;
  cancel_requested: boolean;
  config: Record<string, unknown>;
  owner_id: string | null;
}

export interface IngestionItem {
  item_id: string;
  job_id: string;
  path: string;
  status: string;
  attempt: number;
  max_attempts: number;
  claimed_at: string | null;
}

export interface IngestionEvent {
  event_id: number;
  job_id: string;
  item_id: string | null;
  ts: string;
  level: string;
  event: string;
  message: string;
  payload: Record<string, unknown>;
}

export interface JobDetail {
  job: IngestionJob;
  items: IngestionItem[];
}
