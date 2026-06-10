import { useState } from "react";

import { useAuthSession } from "./hooks/useAuthSession";
import { useDocumentLibrary } from "./hooks/useDocumentLibrary";
import { useIngestion } from "./hooks/useIngestion";
import { useInspectedPage } from "./hooks/useInspectedPage";
import { useSearch } from "./hooks/useSearch";
import { EvidenceInspector } from "./views/EvidenceInspector";
import { ExploreView } from "./views/ExploreView";
import { IngestView } from "./views/IngestView";
import { LibraryView } from "./views/LibraryView";
import { LoginScreen } from "./views/LoginScreen";
import { Sidebar, type TabKey } from "./views/Sidebar";

import type { DocumentItem, TocEntry } from "./types";

export function App() {
  const session = useAuthSession();
  const library = useDocumentLibrary(session.api);
  const search = useSearch(session.api);
  const inspected = useInspectedPage(session.api, library.selectDocument, library.documents);
  const ingestion = useIngestion(session.api, library.refreshDocuments);
  const [activeTab, setActiveTab] = useState<TabKey>("explore");

  if (!session.token || !session.user) {
    return <LoginScreen error={session.authError} onSubmit={session.setToken} />;
  }

  async function runSearchAndPinFirstHit() {
    const top = await search.runSearch();
    if (!top) {
      inspected.clearSelection();
      return;
    }
    if (top.firstEvidence) {
      await inspected.selectEvidence(top.firstEvidence);
    } else if (top.firstNav) {
      await inspected.selectNav(top.firstNav);
    } else if (top.firstFetch) {
      await inspected.selectFetch(top.firstFetch);
    } else {
      inspected.clearSelection();
    }
  }

  function selectDocumentAndOpenLibrary(doc: DocumentItem) {
    library.selectDocument(doc);
    setActiveTab("library");
  }

  function onSelectToc(entry: TocEntry) {
    if (library.selectedDoc) inspected.selectToc(entry, library.selectedDoc);
  }

  async function openSourceDoc(docId: string) {
    if (!session.api) return;
    // Open the tab synchronously inside the click gesture so the popup blocker
    // doesn't eat it; fill it once the auth'd PDF blob is ready.
    const tab = window.open("", "_blank");
    try {
      const url = await session.api.sourceBlobUrl(docId);
      if (tab) tab.location.href = url;
      else window.open(url, "_blank");
    } catch {
      if (tab) tab.close();
    }
  }

  const inspectedHasSource = Boolean(
    inspected.selectedPage &&
      library.documents.find((d) => d.doc_id === inspected.selectedPage!.doc_id)?.has_source
  );

  return (
    <div className="app-shell">
      <Sidebar
        user={session.user}
        activeTab={activeTab}
        documents={library.documents}
        status={session.status}
        selectedDocId={library.selectedDoc?.doc_id ?? null}
        onTabChange={setActiveTab}
        onSelectDocument={selectDocumentAndOpenLibrary}
        onLogout={session.logout}
        onDeleteDocuments={library.deleteDocuments}
        onRestoreDocuments={library.restoreDocuments}
      />
      <main className="main-surface">
        {activeTab === "explore" ? (
          <ExploreView
            query={search.query}
            topK={search.topK}
            result={search.result}
            loading={search.searchLoading}
            error={search.searchError}
            onQueryChange={search.setQuery}
            onTopKChange={search.setTopK}
            onSearch={runSearchAndPinFirstHit}
            onSelectEvidence={inspected.selectEvidence}
            onSelectNav={inspected.selectNav}
            onSelectFetch={inspected.selectFetch}
          />
        ) : null}
        {activeTab === "library" ? (
          <LibraryView
            selectedDoc={library.selectedDoc}
            toc={library.toc}
            loading={library.tocLoading}
            onSelectToc={onSelectToc}
            onDeleteDocuments={library.deleteDocuments}
            onRestoreDocuments={library.restoreDocuments}
            onOpenSource={openSourceDoc}
          />
        ) : null}
        {activeTab === "ingest" ? (
          <IngestView
            uploading={ingestion.uploading}
            uploadError={ingestion.uploadError}
            currentJob={ingestion.currentJob}
            events={ingestion.events}
            rejected={ingestion.rejected}
            onUploadBatch={ingestion.uploadBatchPdfs}
            onRefreshJob={ingestion.refreshJob}
          />
        ) : null}
      </main>
      <EvidenceInspector
        selectedPage={inspected.selectedPage}
        selectedRange={inspected.selectedRange}
        pageError={inspected.pageError}
        pageNotice={inspected.pageNotice}
        onPageStep={inspected.stepSelectedPage}
        onCopyCitation={inspected.copyCitation}
        loadPageImage={session.api ? (id, n) => session.api!.pageImageBlobUrl(id, n) : undefined}
        hasSource={inspectedHasSource}
        onOpenSource={openSourceDoc}
      />
    </div>
  );
}
