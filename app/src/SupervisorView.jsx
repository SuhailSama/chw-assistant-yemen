import { useState, useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { URGENCY } from "./constants/urgency";

const LAMBDA_URL = import.meta.env.VITE_LAMBDA_URL?.replace("/prod/v1/messages", "/prod");

async function getToken() {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() || null;
  } catch { return null; }
}

async function authFetch(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${LAMBDA_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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
      {r.chw && (
        <p className="text-xs text-on-surface-variant mb-1">العامل الصحي: {r.chw}</p>
      )}
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
      {v.chw && (
        <p className="text-xs text-on-surface-variant mb-1">العامل الصحي: {v.chw}</p>
      )}
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
  const [selectedCHW, setSelectedCHW] = useState("all");

  const [referrals, setReferrals] = useState([]);
  const [visits, setVisits] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!LAMBDA_URL) return;
    setLoading(true);
    setError(null);
    Promise.all([
      authFetch("/api/supervisor/summary").then(d => setSummary(d)).catch(() => {}),
      authFetch("/api/visits?chw=all").then(d => setVisits(d.visits || [])).catch(() => {}),
      authFetch("/api/referrals").then(d => setReferrals(d.referrals || [])).catch(() => {}),
    ])
      .catch(() => setError("تعذّر تحميل البيانات"))
      .finally(() => setLoading(false));
  }, []);

  // Derive CHW list from summary byCHW keys, fall back to scanning records
  const chwList = summary?.byCHW
    ? Object.keys(summary.byCHW)
    : [...new Set([
        ...visits.map(v => v.chw).filter(Boolean),
        ...referrals.map(r => r.chw).filter(Boolean),
      ])];

  const now = new Date();

  const activeReferrals = selectedCHW === "all"
    ? referrals
    : referrals.filter(r => r.chw === selectedCHW);

  const activeVisits = selectedCHW === "all"
    ? visits
    : visits.filter(v => v.chw === selectedCHW);

  const urgentCount = activeReferrals.filter((r) => r.urgency === "urgent").length;

  const visitsThisMonth = activeVisits.filter((v) => {
    if (!v.date) return false;
    const d = new Date(v.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const q = search.trim().toLowerCase();

  const filteredReferrals = q
    ? activeReferrals.filter((r) => (r.patientName || "").toLowerCase().includes(q))
    : activeReferrals;

  const filteredVisits = q
    ? activeVisits.filter((v) => (v.patientName || "").toLowerCase().includes(q))
    : activeVisits;

  return (
    <div className="min-h-screen bg-surface p-4" dir="rtl">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-black text-on-surface">لوحة المشرف</h1>
        <p className="text-xs text-on-surface-variant mt-0.5">عرض نشاط الفريق — للقراءة فقط</p>
      </div>

      {/* Loading spinner */}
      {loading && (
        <div className="flex items-center justify-center py-10">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <p className="text-center text-sm text-red-500 py-4">{error}</p>
      )}

      {!loading && (
        <>
          {/* CHW filter dropdown */}
          {chwList.length > 0 && (
            <div className="mb-4">
              <select
                value={selectedCHW}
                onChange={(e) => setSelectedCHW(e.target.value)}
                dir="rtl"
                className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white text-on-surface transition"
              >
                <option value="all">جميع العاملين الصحيين</option>
                {chwList.map(chw => (
                  <option key={chw} value={chw}>{chw}</option>
                ))}
              </select>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            <StatCard count={activeReferrals.length} label="إجمالي الإحالات" />
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
        </>
      )}
    </div>
  );
}
