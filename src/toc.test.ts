import { describe, expect, it } from "vitest";

import { buildTocTree } from "./views/LibraryView";
import type { TocEntry } from "./types";

function entry(overrides: Partial<TocEntry> & Pick<TocEntry, "entry_id">): TocEntry {
  return {
    label: overrides.entry_id,
    entry_type: "page",
    page_start: 0,
    page_end: 0,
    resource_uris: [],
    parent_entry_id: null,
    order_index: 0,
    ...overrides
  };
}

describe("buildTocTree", () => {
  it("nests a multi-level chapter/section/page TOC by parent_entry_id", () => {
    // Mirrors the core's active-stack builder output:
    // document -> section (chapter) -> section (subsection) -> pages.
    const flat: TocEntry[] = [
      entry({ entry_id: "doc", entry_type: "document", page_start: 0, page_end: 60 }),
      entry({ entry_id: "ch3", entry_type: "section", parent_entry_id: "doc", page_start: 10, page_end: 60 }),
      entry({ entry_id: "s3.1", entry_type: "section", parent_entry_id: "ch3", page_start: 10, page_end: 24 }),
      entry({ entry_id: "p10", parent_entry_id: "s3.1", page_start: 10, page_end: 10 }),
      entry({ entry_id: "p11", parent_entry_id: "s3.1", page_start: 11, page_end: 11 })
    ];

    const roots = buildTocTree(flat);

    expect(roots).toHaveLength(1);
    const doc = roots[0];
    expect(doc.entry.entry_id).toBe("doc");
    expect(doc.children.map((n) => n.entry.entry_id)).toEqual(["ch3"]);
    const ch3 = doc.children[0];
    expect(ch3.children.map((n) => n.entry.entry_id)).toEqual(["s3.1"]);
    expect(ch3.children[0].children.map((n) => n.entry.entry_id)).toEqual(["p10", "p11"]);
  });

  it("promotes entries with dangling parents to roots", () => {
    const flat: TocEntry[] = [
      entry({ entry_id: "orphan", parent_entry_id: "missing-parent" }),
      entry({ entry_id: "doc", entry_type: "document" })
    ];

    const roots = buildTocTree(flat);

    expect(roots.map((n) => n.entry.entry_id)).toEqual(["orphan", "doc"]);
  });

  it("keeps siblings in input order", () => {
    const flat: TocEntry[] = [
      entry({ entry_id: "doc", entry_type: "document" }),
      entry({ entry_id: "a", parent_entry_id: "doc", order_index: 1 }),
      entry({ entry_id: "b", parent_entry_id: "doc", order_index: 2 }),
      entry({ entry_id: "c", parent_entry_id: "doc", order_index: 3 })
    ];

    const roots = buildTocTree(flat);

    expect(roots[0].children.map((n) => n.entry.entry_id)).toEqual(["a", "b", "c"]);
  });
});
