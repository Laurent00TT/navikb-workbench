import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { ReactNode } from "react";

export type BannerKind = "error" | "warning" | "info" | "success";

interface BannerProps {
  kind?: BannerKind;
  title?: string;
  children?: ReactNode;
  /** Optional dismiss handler; when present a close button is rendered. */
  onDismiss?: () => void;
  /** Visual scale. Small for inline help, regular for surface-level. */
  size?: "sm" | "md";
}

const ICONS: Record<BannerKind, typeof AlertCircle> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

/** Single banner component that replaces the historical four-way split
 *  (auth-error / search-error / upload-error / page-error). Color, icon,
 *  and aria-role flow from `kind` so callers only think about meaning. */
export function Banner({
  kind = "info",
  title,
  children,
  onDismiss,
  size = "md",
}: BannerProps) {
  const Icon = ICONS[kind];
  const role = kind === "error" ? "alert" : "status";
  const className = ["banner", `banner-${kind}`, size === "sm" ? "banner-sm" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={className} role={role}>
      <Icon size={size === "sm" ? 14 : 16} className="banner-icon" />
      <div className="banner-body">
        {title ? <strong>{title}</strong> : null}
        {children ? <span>{children}</span> : null}
      </div>
      {onDismiss ? (
        <button type="button" className="banner-dismiss" onClick={onDismiss} title="Dismiss">
          <X size={13} />
        </button>
      ) : null}
    </div>
  );
}
