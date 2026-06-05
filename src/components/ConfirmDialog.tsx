import { ReactNode, useEffect, useRef } from "react";

interface ConfirmDialogProps {
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Render the confirm button in a destructive (red) style. */
  danger?: boolean;
  /** While true, both buttons are disabled and confirm shows a busy label. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Small modal confirmation. Closes on Escape or overlay click (unless busy);
 *  focuses the confirm button on mount for keyboard users. Reusable for any
 *  destructive-or-irreversible action, currently the document delete flow. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div className="modal-overlay" onClick={() => { if (!busy) onCancel(); }}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="modal-title">{title}</h3>
        {children ? <div className="modal-body">{children}</div> : null}
        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={danger ? "modal-confirm danger" : "modal-confirm"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
