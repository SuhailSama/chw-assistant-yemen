import { URGENCY } from "../constants/urgency";

export default function HomePage({ user, visits, referrals, setPage, pending = [] }) {
  const todayStr = new Date().toLocaleDateString("ar-SA");
  const todayVisits = visits.filter(v => v.date === todayStr).length;
  const todayReferrals = referrals.filter(r => r.date === todayStr).length;
  const urgentCount = referrals.filter(r => r.urgency === "urgent").length;
  const recent = [
    ...visits.slice(0, 2).map(v => ({ type: "visit", name: v.name, sub: v.diagnosis || "زيارة", date: v.date })),
    ...referrals.slice(0, 2).map(r => ({ type: "ref", name: r.name, sub: URGENCY[r.urgency]?.label, date: r.date })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

  return <>
    <h2 className="text-xl font-black text-on-surface tracking-tight">مرحباً{user ? ` ${user.username}` : ""} 👋</h2>

    <div className="grid grid-cols-3 gap-2">
      {[
        { val: todayVisits,    label: "زيارات اليوم",  color: "text-primary"   },
        { val: todayReferrals, label: "إحالات اليوم",  color: "text-secondary" },
        { val: urgentCount,    label: "إحالات عاجلة",  color: "text-red-600"   },
      ].map(s => (
        <div key={s.label} className="bg-white rounded-2xl shadow-sm p-3 text-center">
          <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
          <p className="text-[10px] text-on-surface-variant mt-0.5 leading-tight">{s.label}</p>
        </div>
      ))}
    </div>

    {pending.length > 0 && (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <p className="text-sm font-black text-amber-800 mb-2">⏳ حالات في الانتظار ({pending.length})</p>
        <div className="space-y-1">
          {pending.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-amber-700">
              <span>•</span>
              <span className="font-semibold">{item.patientData?.name || "مريض"}</span>
              <span className="text-amber-500">{item.patientData?.complaint || ""}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-amber-600 mt-2">سيتم التحليل تلقائياً عند عودة الاتصال</p>
      </div>
    )}

    <div className="grid grid-cols-2 gap-3">
      <button onClick={() => setPage("diagnosis")}
        className="bg-gradient-to-l from-primary to-primary-container text-white py-4 rounded-2xl font-black text-sm shadow-md active:scale-95 transition-transform flex flex-col items-center gap-1">
        <span className="text-2xl">🔬</span>مريض جديد
      </button>
      <button onClick={() => setPage("records")}
        className="bg-white border border-outline-variant py-4 rounded-2xl font-bold text-sm text-on-surface active:scale-95 transition-transform flex flex-col items-center gap-1 shadow-sm">
        <span className="text-2xl">📁</span>السجلات
      </button>
    </div>

    {recent.length > 0 && <>
      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">آخر النشاطات</p>
      <div className="space-y-2">
        {recent.map((item, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm p-3 flex items-center gap-3">
            <span className="text-xl">{item.type === "visit" ? "📅" : "📋"}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-on-surface text-sm truncate">{item.name}</p>
              <p className="text-xs text-on-surface-variant truncate">{item.sub}</p>
            </div>
            <p className="text-xs text-on-surface-variant shrink-0">{item.date}</p>
          </div>
        ))}
      </div>
    </>}

    <div className="grid grid-cols-2 gap-3">
      <button onClick={() => setPage("education")}
        className="bg-surface-low border border-outline-variant/40 py-3 rounded-2xl text-sm font-bold text-on-surface active:scale-95 transition-transform flex items-center justify-center gap-2">
        📚 التثقيف الصحي
      </button>
      <button onClick={() => setPage("medicines")}
        className="bg-surface-low border border-outline-variant/40 py-3 rounded-2xl text-sm font-bold text-on-surface active:scale-95 transition-transform flex items-center justify-center gap-2">
        💊 دليل الأدوية
      </button>
    </div>
  </>;
}
