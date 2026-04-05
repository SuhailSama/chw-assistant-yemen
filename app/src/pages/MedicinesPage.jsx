import { useState } from "react";
import { MEDICINES, MEDICINE_CATEGORIES } from "../data/medicines";
import { Card } from "../components/ui";

export default function MedicinesPage() {
  const [medSearch, setMedSearch] = useState("");
  const [medCategory, setMedCategory] = useState("الكل");
  const [medicine, setMedicine] = useState(null);

  const filtered = MEDICINES.filter(m =>
    (medCategory === "الكل" || m.category === medCategory) &&
    (medSearch === "" || m.name.includes(medSearch) || m.en.toLowerCase().includes(medSearch.toLowerCase()))
  );

  return <>
    <h2 className="text-xl font-black text-on-surface tracking-tight">دليل الأدوية</h2>
    {medicine === null ? (
      <>
        <input
          className="w-full border border-outline-variant rounded-full px-5 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white text-on-surface placeholder:text-gray-400 transition"
          placeholder="🔍 ابحث عن دواء..."
          value={medSearch}
          onChange={e => setMedSearch(e.target.value)}
        />
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {MEDICINE_CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setMedCategory(cat)}
              className={`flex-shrink-0 text-xs px-4 py-1.5 rounded-full border font-semibold transition ${medCategory === cat ? "bg-primary text-white border-primary shadow-sm" : "bg-white text-on-surface-variant border-outline-variant"}`}>
              {cat}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {filtered.map((m, i) => (
            <button key={i} onClick={() => setMedicine(i)} className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 text-right active:bg-surface-low active:scale-[0.99] transition-all">
              <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-2xl flex-shrink-0">{m.icon}</div>
              <div className="flex-1">
                <p className="font-bold text-on-surface text-sm">{m.name}</p>
                <p className="text-xs text-on-surface-variant">{m.en}</p>
                <span className="text-xs text-primary bg-primary-light px-2 py-0.5 rounded-full font-medium">{m.category}</span>
              </div>
              <span className="text-outline-variant text-lg font-light">‹</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <Card className="text-center py-8"><p className="text-gray-400 text-sm">لا توجد نتائج</p></Card>
          )}
        </div>
      </>
    ) : (
      <Card>
        <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-100">
          <span className="text-4xl">{MEDICINES[medicine].icon}</span>
          <div>
            <h3 className="font-bold text-gray-800">{MEDICINES[medicine].name}</h3>
            <p className="text-xs text-gray-400">{MEDICINES[medicine].en}</p>
            <span className="text-xs text-primary bg-primary-light px-2 py-0.5 rounded-full font-medium">{MEDICINES[medicine].category}</span>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold text-primary mb-1.5 uppercase tracking-wide">💊 الاستخدام</p>
            <p className="text-sm text-on-surface-variant leading-6">{MEDICINES[medicine].use}</p>
          </div>
          <div className="bg-surface-low border border-primary-light rounded-2xl p-4">
            <p className="text-xs font-bold text-primary mb-1.5 uppercase tracking-wide">📏 الجرعة</p>
            <p className="text-sm text-on-surface leading-7 whitespace-pre-line">{MEDICINES[medicine].dose}</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
            <p className="text-xs font-bold text-red-700 mb-1.5 uppercase tracking-wide">⚠️ تحذيرات وموانع</p>
            <p className="text-sm text-red-700 leading-6">{MEDICINES[medicine].caution}</p>
          </div>
        </div>
        <button onClick={() => setMedicine(null)} className="mt-4 w-full text-primary font-bold text-sm py-2.5 border border-primary-light rounded-xl hover:bg-surface-low transition">← العودة للقائمة</button>
      </Card>
    )}
  </>;
}
