const NAV_BASE = [
  { id: "home",      icon: "🏠", label: "الرئيسية" },
  { id: "diagnosis", icon: "🔬", label: "التشخيص"  },
  { id: "education", icon: "📚", label: "التثقيف"  },
  { id: "medicines", icon: "💊", label: "الأدوية"  },
  { id: "records",   icon: "📁", label: "السجلات"  },
];

export default function BottomNav({ page, setPage, role }) {
  const items = [
    ...NAV_BASE,
    ...(["Supervisor", "Admin"].includes(role) ? [{ id: "supervisor", icon: "📊", label: "المتابعة" }] : []),
    ...(role === "Admin" ? [{ id: "admin", icon: "⚙️", label: "الإدارة" }] : []),
  ];

  return (
    <nav className="fixed bottom-0 right-0 left-0 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-outline-variant/30 flex z-20 rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-safe">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => setPage(item.id)}
          className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-all active:scale-90 ${page === item.id ? "text-primary" : "text-on-surface-variant/50"}`}
        >
          <div className={`flex items-center justify-center rounded-2xl transition-all ${page === item.id ? "bg-primary-light px-3 py-1" : "px-3 py-1"}`}>
            <span className="text-lg leading-none">{item.icon}</span>
          </div>
          <span className={`text-[10px] leading-none mt-0.5 ${page === item.id ? "font-black" : "font-medium"}`}>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
