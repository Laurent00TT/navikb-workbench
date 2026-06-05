import { describe, expect, it, vi } from "vitest";

import { createApiClient } from "./api";

describe("createApiClient", () => {
  it("attaches bearer token to UI API requests", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      username: "alice",
      role: "member"
    }), { status: 200 }));
    const api = createApiClient("kb_token", fetchMock);

    const me = await api.me();

    expect(me.username).toBe("alice");
    expect(fetchMock).toHaveBeenCalledWith("/ui/api/me", expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer kb_token"
      })
    }));
  });

  it("throws a readable ApiError when the server rejects a request", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      detail: "invalid API key"
    }), { status: 401 }));
    const api = createApiClient("bad", fetchMock);

    await expect(api.me()).rejects.toMatchObject({
      status: 401,
      message: "invalid API key"
    });
  });

  it("requests page range previews with the browser token", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      doc_id: "doc-1",
      page_start: 2,
      page_end: 4,
      pages: []
    }), { status: 200 }));
    const api = createApiClient("kb_token", fetchMock);

    await api.rangePreview("doc-1", 2, 4);

    expect(fetchMock).toHaveBeenCalledWith(
      "/ui/api/documents/doc-1/range_preview",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ page_start: 2, page_end: 4 }),
        headers: expect.objectContaining({
          Authorization: "Bearer kb_token",
          "Content-Type": "application/json"
        })
      })
    );
  });
});
