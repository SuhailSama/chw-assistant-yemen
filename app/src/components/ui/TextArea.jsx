export default function TextArea({ label, ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">{label}</label>}
      <textarea className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none bg-white text-on-surface placeholder:text-gray-400 transition" {...props} />
    </div>
  );
}
