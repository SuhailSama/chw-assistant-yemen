import { useState } from "react";
import { URGENCY } from "../constants/urgency";
import { Card, Input, TextArea, SectionTitle } from "../components/ui";

const today = () => new Date().toLocaleDateString("ar-SA");

export default function RecordsPage({ referrals, visits, setReferrals, setVisits }) {
  const [refForm, setRefForm] = useState(null);
  const [visitForm, setVisitForm] = useState(null);
  const [recordsTab, setRecordsTab] = useState("referrals");

  const exportData = () => {
    const lines = [
      "=== سجل الإحالات ===",
      ...referrals.map(r => `${r.date} | ${r.name} | ${URGENCY[r.urgency]?.label} | ${r.reason}`),
      "",
      "=== سجل الزيارات ===",
      ...visits.map(v => `${v.date} | ${v.name} | ${v.diagnosis} | ${v.treatment}`),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
  };

  return <>
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-black text-on-surface tracking-tight">السجلات</h2>
      {(visits.length > 0 || referrals.length > 0) &&
        <button onClick={exportData} className="bg-surface-high text-primary text-xs px-3 py-2 rounded-full font-bold border border-primary-light">تصدير 📋</button>}
    </div>

    <div className="flex bg-surface-container rounded-2xl p-1 gap-1">
      <button onClick={() => setRecordsTab("referrals")}
        className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${recordsTab === "referrals" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant"}`}>
        📋 الإحالات ({referrals.length})
      </button>
      <button onClick={() => setRecordsTab("visits")}
        className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${recordsTab === "visits" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant"}`}>
        📅 الزيارات ({visits.length})
      </button>
    </div>

    {recordsTab === "referrals" && <>
      <button onClick={() => setRefForm({ name: "", urgency: "urgent", reason: "" })}
        className="w-full bg-primary text-white py-2.5 rounded-full text-sm font-bold shadow-sm shadow-primary/20">+ إحالة جديدة</button>
      {refForm && (
        <Card className="border border-red-200">
          <SectionTitle>إحالة جديدة</SectionTitle>
          <div className="space-y-3">
            <Input placeholder="اسم المريض" value={refForm.name} onChange={e => setRefForm({ ...refForm, name: e.target.value })} />
            <select className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-primary text-on-surface transition" value={refForm.urgency} onChange={e => setRefForm({ ...refForm, urgency: e.target.value })}>
              <option value="urgent">عاجل 🔴</option><option value="semi">شبه عاجل 🟡</option><option value="routine">روتيني 🟢</option>
            </select>
            <TextArea rows={2} placeholder="سبب الإحالة..." value={refForm.reason} onChange={e => setRefForm({ ...refForm, reason: e.target.value })} />
            <div className="flex gap-2">
              <button onClick={() => { if (refForm.name) { setReferrals(prev => [{ ...refForm, date: today() }, ...prev]); setRefForm(null); } }}
                className="flex-1 bg-gradient-to-l from-primary to-primary-container text-white py-2.5 rounded-full text-sm font-bold">حفظ</button>
              <button onClick={() => setRefForm(null)} className="flex-1 bg-surface-container text-on-surface-variant py-2.5 rounded-full text-sm font-medium">إلغاء</button>
            </div>
          </div>
        </Card>
      )}
      {referrals.length === 0 ? (
        <Card className="text-center py-10"><div className="text-4xl mb-3">📋</div><p className="text-sm text-gray-400">لا توجد إحالات مسجلة</p></Card>
      ) : referrals.map((r, i) => (
        <div key={i} className={`rounded-2xl p-4 border ${URGENCY[r.urgency]?.cls || ""}`}>
          <div className="flex items-center justify-between mb-1.5">
            <p className="font-semibold text-sm">{r.name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${URGENCY[r.urgency]?.cls || ""}`}>{URGENCY[r.urgency]?.label}</span>
          </div>
          <p className="text-sm opacity-80">{r.reason}</p>
          <p className="text-xs opacity-50 mt-1">{r.date}</p>
        </div>
      ))}
    </>}

    {recordsTab === "visits" && <>
      <button onClick={() => setVisitForm({ name: "", date: today(), diagnosis: "", treatment: "", followUp: "" })}
        className="w-full bg-primary text-white py-2.5 rounded-full text-sm font-bold shadow-sm shadow-primary/20">+ تسجيل زيارة</button>
      {visitForm && (
        <Card className="border border-primary-light">
          <SectionTitle>تسجيل زيارة جديدة</SectionTitle>
          <div className="space-y-3">
            <Input placeholder="اسم المريض" value={visitForm.name} onChange={e => setVisitForm({ ...visitForm, name: e.target.value })} />
            <Input placeholder="التشخيص" value={visitForm.diagnosis} onChange={e => setVisitForm({ ...visitForm, diagnosis: e.target.value })} />
            <Input placeholder="العلاج المُعطى" value={visitForm.treatment} onChange={e => setVisitForm({ ...visitForm, treatment: e.target.value })} />
            <Input placeholder="متابعة مطلوبة؟" value={visitForm.followUp} onChange={e => setVisitForm({ ...visitForm, followUp: e.target.value })} />
            <div className="flex gap-2">
              <button onClick={() => { if (visitForm.name) { setVisits(prev => [{ ...visitForm }, ...prev]); setVisitForm(null); } }}
                className="flex-1 bg-gradient-to-l from-primary to-primary-container text-white py-2.5 rounded-full text-sm font-bold">حفظ</button>
              <button onClick={() => setVisitForm(null)} className="flex-1 bg-surface-container text-on-surface-variant py-2.5 rounded-full text-sm font-medium">إلغاء</button>
            </div>
          </div>
        </Card>
      )}
      {visits.length === 0 ? (
        <Card className="text-center py-10"><div className="text-4xl mb-3">📅</div><p className="text-sm text-gray-400">لا توجد زيارات مسجلة</p></Card>
      ) : visits.map((v, i) => (
        <Card key={i}>
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-gray-800 text-sm">{v.name}</p>
            <p className="text-xs text-gray-400">{v.date}</p>
          </div>
          {v.diagnosis && <p className="text-sm text-gray-600">🔬 {v.diagnosis}</p>}
          {v.treatment && <p className="text-sm text-gray-600 mt-0.5">💊 {v.treatment}</p>}
          {v.followUp && <p className="text-sm text-blue-600 mt-0.5">📌 {v.followUp}</p>}
        </Card>
      ))}
    </>}
  </>;
}
