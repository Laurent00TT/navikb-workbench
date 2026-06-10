import { FileSearch, Library, LogOut, UploadCloud } from "lucide-react";

import type { CurrentUser, ServerStatus } from "../types";

export type TabKey = "explore" | "library" | "ingest";

interface TopbarProps {
  user: CurrentUser;
  activeTab: TabKey;
  status: ServerStatus | null;
  onTabChange: (tab: TabKey) => void;
  onLogout: () => void;
}

const tabs: Array<{ key: TabKey; label: string; icon: typeof FileSearch }> = [
  { key: "explore", label: "Explore", icon: FileSearch },
  { key: "library", label: "Library", icon: Library },
  { key: "ingest", label: "Ingest", icon: UploadCloud }
];

/** Top structural bar: wordmark, view tabs (Klein-blue underline slides in),
 *  and the connection/user strip on the right. */
export function Topbar({ user, activeTab, status, onTabChange, onLogout }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-mark">
        Navi<span>KB</span>
      </div>
      <nav className="topbar-tabs" aria-label="Workbench views">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? "top-tab active" : "top-tab"}
              onClick={() => onTabChange(tab.key)}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="topbar-status">
        <span>
          <span className={status?.meta_db_ready ? "dot ok" : "dot warn"} />{" "}
          {status ? `online · ${status.document_count} docs` : "connecting…"}
        </span>
        <span>
          {user.username} <span className="role-chip">{user.role}</span>
        </span>
        <button type="button" className="signout-button" onClick={onLogout}>
          <LogOut size={13} />
          <span>sign out</span>
        </button>
      </div>
    </header>
  );
}
