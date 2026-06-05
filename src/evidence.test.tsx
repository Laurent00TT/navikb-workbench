import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EvidenceInspector } from "./views/EvidenceInspector";

afterEach(() => cleanup());

describe("EvidenceInspector", () => {
  it("keeps citable evidence visually separate from generated hints", () => {
    render(
      <EvidenceInspector
        selectedPage={{
          status: "ok",
          doc_id: "doc-1",
          doc_name: "manual.pdf",
          page_num: 2,
          page_type: "mixed",
          heading_path: ["Approval", "Flow"],
          resource_uri: "kb://documents/doc-1/pages/2",
          image_resource_uri: "kb://documents/doc-1/pages/2/image",
          evidence: {
            text: "Original approval evidence.",
            text_truncated: false,
            figure_caption: "Approval table",
            figure_index: "fig-1",
            image_url: "local://page.png"
          },
          hints: {
            generated_description: "Generated hint only."
          },
          evidence_fields: ["text", "figure_caption"],
          hint_fields: ["generated_description"]
        }}
        onPageStep={() => undefined}
        onCopyCitation={() => undefined}
      />
    );

    expect(screen.getByText("Evidence")).toBeInTheDocument();
    // The "Hint" header is rendered only when a generated description exists.
    expect(screen.getByText("Hint")).toBeInTheDocument();
    expect(screen.getAllByText("Original approval evidence.").length).toBeGreaterThan(0);
    expect(screen.getByText("Generated hint only.")).toBeInTheDocument();
    // Citable / recall-aid badges keep evidence and LLM hint visually separated.
    expect(screen.getByText("Citable")).toBeInTheDocument();
    expect(screen.getByText("Recall aid only")).toBeInTheDocument();
  });

  it("wires visible page tools to real actions", () => {
    const onPageStep = vi.fn();
    const onCopyCitation = vi.fn();
    const view = render(
      <EvidenceInspector
        selectedPage={{
          status: "ok",
          doc_id: "doc-1",
          doc_name: "manual.pdf",
          page_num: 2,
          page_type: "text",
          heading_path: ["Approval"],
          resource_uri: "kb://documents/doc-1/pages/2",
          image_resource_uri: "",
          evidence: {
            text: "Original approval evidence.",
            text_truncated: false,
            figure_caption: "",
            figure_index: null,
            image_url: ""
          },
          hints: {
            generated_description: ""
          },
          evidence_fields: ["text"],
          hint_fields: []
        }}
        onPageStep={onPageStep}
        onCopyCitation={onCopyCitation}
      />
    );

    fireEvent.click(view.getByTitle("Next page"));
    fireEvent.click(view.getByText("Copy cite"));

    expect(onPageStep).toHaveBeenCalledWith(1);
    expect(onCopyCitation).toHaveBeenCalledWith(expect.stringContaining("manual.pdf p2"));
  });
});
