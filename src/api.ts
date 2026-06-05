import type {
  CurrentUser,
  DocumentItem,
  HybridSearchResponse,
  IngestionEvent,
  JobDetail,
  PageRangePreview,
  PagePreview,
  ServerStatus,
  TocEntry
} from "./types";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail: unknown }).detail;
    if (typeof detail === "string") {
      return detail;
    }
    return JSON.stringify(detail);
  }
  if (typeof payload === "string") {
    return payload;
  }
  return fallback;
}

export function createApiClient(token: string, fetcher: FetchLike = fetch) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const body = init.body;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string> | undefined)
    };
    if (body !== undefined && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    const response = await fetcher(path, { ...init, headers });
    const payload = await readJson(response);
    if (!response.ok) {
      throw new ApiError(response.status, errorMessage(payload, response.statusText));
    }
    return payload as T;
  }

  return {
    me: () => request<CurrentUser>("/ui/api/me"),
    status: () => request<ServerStatus>("/ui/api/status"),
    documents: () => request<{ documents: DocumentItem[]; total: number }>("/ui/api/documents"),
    deleteDocument: (docId: string) => request<{ doc_id: string; status: string; deleted_at: string | null }>(
      `/ui/api/documents/${encodeURIComponent(docId)}`,
      { method: "DELETE" }
    ),
    restoreDocument: (docId: string) => request<{ doc_id: string; status: string }>(
      `/ui/api/documents/${encodeURIComponent(docId)}/restore`,
      { method: "POST" }
    ),
    toc: (docId: string) => request<{ entries: TocEntry[]; contains_generated_content: boolean }>(
      `/ui/api/documents/${encodeURIComponent(docId)}/toc`
    ),
    hybridSearch: (query: string, topK = 5) => request<HybridSearchResponse>(
      "/ui/api/hybrid_search",
      {
        method: "POST",
        body: JSON.stringify({ query, top_k: topK })
      }
    ),
    pagePreview: (docId: string, pageNum: number) => request<PagePreview>(
      `/ui/api/documents/${encodeURIComponent(docId)}/pages/${pageNum}`
    ),
    pageImageUrl: (docId: string, pageNum: number) =>
      `/ui/api/documents/${encodeURIComponent(docId)}/pages/${pageNum}/image`,
    pageImageBlobUrl: async (docId: string, pageNum: number) => {
      const response = await fetcher(
        `/ui/api/documents/${encodeURIComponent(docId)}/pages/${pageNum}/image`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) {
        const payload = await readJson(response);
        throw new ApiError(response.status, errorMessage(payload, response.statusText));
      }
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    },
    /** Fetch the retained original PDF (auth'd) as an object URL to open in a
     *  new tab. Throws ApiError(404) when no source was stored for the doc. */
    sourceBlobUrl: async (docId: string) => {
      const response = await fetcher(
        `/ui/api/documents/${encodeURIComponent(docId)}/source`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) {
        const payload = await readJson(response);
        throw new ApiError(response.status, errorMessage(payload, response.statusText));
      }
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    },
    rangePreview: (docId: string, pageStart: number, pageEnd: number) => request<PageRangePreview>(
      `/ui/api/documents/${encodeURIComponent(docId)}/range_preview`,
      {
        method: "POST",
        body: JSON.stringify({ page_start: pageStart, page_end: pageEnd })
      }
    ),
    upload: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<{ stored_path: string; job: JobDetail["job"] }>("/ui/api/upload", {
        method: "POST",
        body: form
      });
    },
    /** Upload many PDFs in one request → ONE job with one item per file.
     *  Invalid files come back in `rejected` rather than failing the batch. */
    uploadBatch: (files: File[]) => {
      const form = new FormData();
      for (const file of files) form.append("files", file);
      return request<{
        stored: { filename: string; stored_path: string }[];
        rejected: { filename: string; error: string }[];
        job: JobDetail["job"];
      }>("/ui/api/upload_batch", { method: "POST", body: form });
    },
    job: (jobId: string) => request<JobDetail>(`/ingestion/jobs/${encodeURIComponent(jobId)}`),
    events: (jobId: string, afterId = 0) => request<{ events: IngestionEvent[] }>(
      `/ingestion/jobs/${encodeURIComponent(jobId)}/events?after_id=${afterId}`
    )
  };
}
