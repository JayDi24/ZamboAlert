import { useEffect, useId, useState } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";

const CONFIRM_WORD = "DELETE";

/**
 * Confirmation popup shown before a rescuer account is deleted.
 * The admin must type DELETE before the delete button is enabled.
 * `onConfirm` resolves on success (parent then unmounts this modal)
 * and throws an Error whose message is shown inside the modal on failure.
 */
export default function ConfirmDeleteRescuerModal({ rescuer, onCancel, onConfirm }) {
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const titleId = useId();

  const name = rescuer?.name || "";
  const email = rescuer?.email || "";
  const isValid = confirmText.trim() === CONFIRM_WORD;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !submitting) onCancel?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submitting, onCancel]);

  const handleDelete = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onConfirm?.();
    } catch (err) {
      setError(err?.message || "Failed to delete rescuer account.");
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (!submitting) onCancel?.();
  };

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
      >
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trash2 size={16} className="text-red-500" />
            <h3 id={titleId} className="text-xs font-bold uppercase tracking-wider font-mono">
              Delete Rescuer Account
            </h3>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            aria-label="Close"
            className="text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <span className="text-[9px] font-bold text-slate-400 uppercase block">Rescuer</span>
            <div className="text-sm font-bold text-slate-900">{name || "—"}</div>
            <div className="text-xs font-mono text-slate-500 break-all">{email || "—"}</div>
          </div>

          <ul className="text-xs text-slate-600 list-disc pl-4 space-y-1">
            <li>They are signed out of the ZamboAlert app.</li>
            <li>They can register again with the same email.</li>
            <li>Their field logs are kept.</li>
          </ul>

          <div className="flex items-start gap-1.5 p-2.5 bg-red-50 border border-red-100 rounded-lg text-[11px] text-red-700">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <p>This permanently deletes the account and cannot be undone.</p>
          </div>

          <div>
            <label
              htmlFor={`${titleId}-confirm`}
              className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block mb-1.5"
            >
              Type <span className="text-red-700">{CONFIRM_WORD}</span> to confirm
            </label>
            <input
              id={`${titleId}-confirm`}
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleDelete();
                }
              }}
              placeholder={CONFIRM_WORD}
              autoComplete="off"
              spellCheck={false}
              autoFocus
              disabled={submitting}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 placeholder:text-slate-400 px-3 py-2.5 outline-none focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/10 transition-all"
            />
          </div>

          {error && (
            <p role="alert" className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 flex gap-2 justify-end">
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-[10px] font-bold uppercase rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!isValid || submitting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 size={10} className="animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={10} />
                Delete Account
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
