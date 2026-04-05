import { useState } from "react";
import { CONDITIONS } from "../data/conditions";
import { Card } from "../components/ui";

export default function EducationPage() {
  const [condition, setCondition] = useState(null);

  return <>
    <h2 className="text-xl font-black text-on-surface tracking-tight">التثقيف الصحي</h2>
    {condition === null ? (
      <div className="space-y-2">
        {CONDITIONS.map((c, i) => (
          <button key={i} onClick={() => setCondition(i)} className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 text-right active:bg-surface-low active:scale-[0.99] transition-all">
            <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-2xl flex-shrink-0">{c.icon}</div>
            <div className="flex-1">
              <p className="font-bold text-on-surface text-sm">{c.name}</p>
              <p className="text-xs text-on-surface-variant">{c.en}</p>
            </div>
            <span className="text-outline-variant text-lg font-light">‹</span>
          </button>
        ))}
      </div>
    ) : (
      <Card>
        <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-100">
          <span className="text-4xl">{CONDITIONS[condition].icon}</span>
          <div>
            <h3 className="font-bold text-gray-800">{CONDITIONS[condition].name}</h3>
            <p className="text-xs text-gray-400">{CONDITIONS[condition].en}</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold text-secondary mb-1.5 uppercase tracking-wide">🩺 الأعراض</p>
            <p className="text-sm text-on-surface-variant leading-6">{CONDITIONS[condition].symptoms}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-primary mb-1.5 uppercase tracking-wide">💊 العلاج</p>
            <p className="text-sm text-on-surface-variant leading-6">{CONDITIONS[condition].treatment}</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
            <p className="text-xs font-bold text-red-700 mb-1.5 uppercase tracking-wide">🚨 متى تُحيل فوراً</p>
            <p className="text-sm text-red-700 leading-6">{CONDITIONS[condition].refer}</p>
          </div>
        </div>
        <button onClick={() => setCondition(null)} className="mt-4 w-full text-primary font-bold text-sm py-2.5 border border-primary-light rounded-xl hover:bg-surface-low transition">← العودة للقائمة</button>
      </Card>
    )}
  </>;
}
