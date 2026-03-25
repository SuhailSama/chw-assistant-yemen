import { useState, useMemo } from "react";

const URGENCY = {
  urgent: { label: "عاجل 🔴", cls: "bg-red-100 text-red-700 border-red-200" },
  semi: { label: "شبه عاجل 🟡", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  routine: { label: "روتيني 🟢", cls: "bg-green-100 text-green-700 border-green-200" },
};

function readLocal(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function StatCard({ count, label }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
      <p className="text-2xl font-black text-primary">{count}</p>
      <p className="text-xs text-on-surface-variant">{label}</p>
    </div>
  );
}

function SearchBar({ value, onChange }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="ابحث باسم المريض..."
      dir="rtl"
      className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white text-on-surface placeholder:text-gray-400 transition"
    />
  );
}

function ReferralCard({ referral: r }) {
  const u = URGENCY[r.urgency] || URGENCY.routine;
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 border border-outline-variant" dir="rtl">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-sm text-on-surface">{r.patientName || "—"}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${u.cls}`}>
          {u.label}
        </span>
      </div>
      <p className="text-xs text-on-surface-variant mb-1">
        {r.facility ? `المرفق: ${r.facility}` : ""}
      </p>
      <p className="text-xs text-on-surface-variant mb-1">
        {r.reason ? `السبب: ${r.reason}` : ""}
      </p>
      {r.date && (
        <p className="text-xs text-gray-400 mt-1">{new Date(r.date).toLocaleDateString("ar-YE")}</p>
      )}
    </div>
  );
}

function VisitCard({ visit: v }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 border border-outline-variant" dir="rtl">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-sm text-on-surface">{v.patientName || "—"}</span>
        {v.date && (
          <span className="text-xs text-gray-400">{new Date(v.date).toLocaleDateString("ar-YE")}</span>
        )}
      </div>
      {v.complaint && (
        <p className="text-xs text-on-surface-variant mb-1">الشكوى: {v.complaint}</p>
      )}
      {v.notes && (
        <p className="text-xs text-on-surface-variant">ملاحظات: {v.notes}</p>
      )}
    </div>
  );
}

export default function SupervisorView() {
  const [tab, setTab] = useState("referrals");
  const [search, setSearch] = useState("");

  const referrals = useMemo(() => readLocal("chw_referrals"), []);
  const visits = useMemo(() => readLocal("chw_visits"), []);

  const now = new Date();
  const thisMonth = referrals.filter((r) => {
    if (!r.date) return false;
    const d = new Date(r.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const urgentCount = referrals.filter((r) => r.urgency === "urgent").length;

  const visitsThisMonth = visits.filter((v) => {
    if (!v.date) return false;
    const d = new Date(v.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const q = search.trim().toLowerCase();

  const filteredReferrals = q
    ? referrals.filter((r) => (r.patientName || "").toLowerCase().includes(q))
    : referrals;

  const filteredVisits = q
    ? visits.filter((v) => (v.patientName || "").toLowerCase().includes(q))
    : visits;

  return (
    <div className="min-h-screen bg-surface p-4" dir="rtl">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-black text-on-surface">لوحة المشرف</h1>
        <p className="text-xs text-on-surface-variant mt-0.5">عرض نشاط الفريق — للقراءة فقط</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <StatCard count={referrals.length} label="إجمالي الإحالات" />
        <StatCard count={urgentCount} label="إحالات عاجلة" />
        <StatCard count={visitsThisMonth} label="زيارات هذا الشهر" />
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchBar value={search} onChange={setSearch} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { id: "referrals", label: "الإحالات" },
          { id: "visits", label: "الزيارات" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${
              tab === t.id
                ? "bg-primary text-white shadow-sm"
                : "bg-white text-on-surface-variant border border-outline-variant"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {tab === "referrals" ? (
          filteredReferrals.length === 0 ? (
            <p className="text-center text-sm text-on-surface-variant py-8">لا توجد إحالات</p>
          ) : (
            filteredReferrals.map((r, i) => <ReferralCard key={r.id ?? i} referral={r} />)
          )
        ) : filteredVisits.length === 0 ? (
          <p className="text-center text-sm text-on-surface-variant py-8">لا توجد زيارات</p>
        ) : (
          filteredVisits.map((v, i) => <VisitCard key={v.id ?? i} visit={v} />)
        )}
      </div>
    </div>
  );
}
