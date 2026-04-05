export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  onConfirm,
  onCancel,
  danger = false,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="rounded-2xl shadow-lg bg-white p-6 max-w-sm w-full mx-4">
        <h3 className="font-black text-on-surface">{title}</h3>
        <p className="text-sm text-on-surface-variant mt-1 mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="border border-outline-variant text-on-surface rounded-full px-5 py-2.5 text-sm"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-full px-5 py-2.5 text-sm font-bold text-white ${
              danger ? "bg-red-600" : "bg-primary"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
