import { useState } from "react";
import DOMPurify from "dompurify";
import { fetchAuthSession } from "aws-amplify/auth";
import { Input, TextArea, Card, SectionTitle } from "../components/ui";
import { useOfflineQueue } from "../hooks/useOfflineQueue";
import { getPatientHistory } from "./RecordsPage";
import { URGENCY } from "../constants/urgency";

const LAMBDA_URL = import.meta.env.VITE_LAMBDA_URL;
const MODEL = "gemini-2.5-flash-lite";
const today = () => new Date().toLocaleDateString("ar-SA");

export default function DiagnosisPage({ isOnline, visits = [], referrals = [], setReferrals, setVisits, setPage, enqueue, pending }) {
  const [patient, setPatient] = useState({ name: "", age: "", sex: "male", complaint: "", temp: "", pulse: "", bp: "", symptoms: "", duration: "" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [copied, setCopied] = useState(false);
  const [refForm, setRefForm] = useState(null);
  const [visitForm, setVisitForm] = useState(null);
  const [savedMsg, setSavedMsg] = useState("");
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [selectedPatientHistory, setSelectedPatientHistory] = useState(null);
  const { enqueue: localEnqueue } = useOfflineQueue();
  const _enqueue = enqueue || localEnqueue;

  const allNames = [...new Set([
    ...visits.map(v => v.name).filter(Boolean),
    ...referrals.map(r => r.name).filter(Boolean),
  ])];

  const patientSuggestions = patientSearchQuery.trim()
    ? allNames.filter(n => n.toLowerCase().includes(patientSearchQuery.toLowerCase()))
    : [];

  const selectPreviousPatient = (name) => {
    const history = getPatientHistory(name, visits, referrals);
    const latest = history[0];
    if (latest) {
      setPatient(prev => ({
        ...prev,
        name: latest.name || prev.name,
        age: latest.age !== undefined ? String(latest.age) : prev.age,
        sex: latest.sex || prev.sex,
      }));
      setSelectedPatientHistory(history);
    }
    setPatientSearchOpen(false);
    setPatientSearchQuery("");
  };

  const p = (k, v) => { setPatient(prev => ({ ...prev, [k]: v })); setValidationErrors([]); };

  const validateInputs = () => {
    const errors = [];
    const age = Number(patient.age);
    if (!patient.age || isNaN(age) || age < 0 || age > 120)
      errors.push("العمر يجب أن يكون رقماً بين 0 و 120");
    if (patient.temp) {
      const t = Number(patient.temp);
      if (isNaN(t) || t < 30 || t > 45)
        errors.push("درجة الحرارة غير منطقية — يجب أن تكون بين 30 و 45°C");
    }
    if (patient.pulse) {
      const pulse = Number(patient.pulse);
      if (isNaN(pulse) || pulse < 20 || pulse > 300)
        errors.push("النبض غير منطقي — يجب أن يكون بين 20 و 300 نبضة/دقيقة");
    }
    if (patient.bp) {
      const bpMatch = patient.bp.match(/^(\d{2,3})\/(\d{2,3})$/);
      if (!bpMatch || Number(bpMatch[1]) < 50 || Number(bpMatch[1]) > 280 || Number(bpMatch[2]) < 20 || Number(bpMatch[2]) > 180)
        errors.push("ضغط الدم غير صحيح — أدخل بصيغة مثل 120/80");
    }
    return errors;
  };

  const buildPrompt = () => `أنت طبيب مساعد خبير تدعم عاملاً صحياً مجتمعياً في منطقة ريفية باليمن.

══════════════════════════════════
الخطوة الأولى (إلزامية): قيّم جودة البيانات قبل أي شيء آخر.

البيانات غير كافية إذا توفّر أي مما يلي:
- الأعراض مبهمة جداً أو كلمة واحدة فقط مثل "تعبان" أو "مريض"
- الشكوى لا تصف عرضاً طبياً واضحاً يمكن التصرف بناءً عليه
- النصوص تبدو عشوائية أو اختبارية أو لا معنى لها طبياً
- البيانات متناقضة أو مستحيلة فيزيولوجياً
- معلومات العمر أو الجنس تتعارض مع الشكوى (مثل: رجل يشكو من آلام الولادة)

══════════════════════════════════
إذا كانت البيانات غير كافية:
ابدأ ردك بالسطر التالي حرفياً ولا تغيره: ##PROBE##
ثم اكتب فقط هذين القسمين ولا شيء غيرهما — لا تشخيص، لا علاج، لا إجراءات:

### ❓ المعلومات غير كافية للتشخيص
اشرح في جملة أو جملتين بالعربية البسيطة لماذا لا يمكن تقديم تشخيص الآن.

### 🗣️ اسأل المريض هذه الأسئلة:
* (4-6 أسئلة محددة وعملية تساعد العامل الصحي على فهم الحالة بشكل أوضح)

══════════════════════════════════
إذا كانت البيانات كافية:
ابدأ ردك بالسطر التالي حرفياً ولا تغيره: ##DIAGNOSIS##
ثم قدّم التشخيص باللهجة اليمنية العامية البسيطة بهذا الترتيب:

### 🩺 التشخيص المحتمل
* (2-3 تشخيصات مرتبة حسب الاحتمالية مع سبب موجز)

### ⚠️ مستوى الخطورة
* (بسيط / متوسط / خطير / طوارئ — مع جملة تفسيرية)

### ⚡ الإجراءات الفورية
* (خطوات عملية واضحة يفعلها العامل الصحي الآن)

### 💊 العلاج المقترح
* (أدوية أو إجراءات متاحة محلياً بجرعات واضحة)

### 🚨 علامات الخطر — متى تُحيل فوراً
* (قائمة واضحة بعلامات الإحالة العاجلة)

### 🗣️ تعليمات للمريض
* (بكلام بسيط يفهمه المريض ويستطيع تذكره)

══════════════════════════════════
بيانات المريض:
- الاسم: ${patient.name} | العمر: ${patient.age} | الجنس: ${patient.sex === "male" ? "ذكر" : "أنثى"}
- الشكوى الرئيسية: ${patient.complaint}
- الأعراض: ${patient.symptoms}
- المدة: ${patient.duration || "غير محددة"}
- الحرارة: ${patient.temp || "—"}°C | النبض: ${patient.pulse || "—"} ن/د | ضغط الدم: ${patient.bp || "—"}`;

  const fetchWithRetry = async (provider, attempts = 2) => {
    for (let i = 0; i < attempts; i++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        const res = await fetch(LAMBDA_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
          body: JSON.stringify({ provider, model: MODEL, max_tokens: 1000, messages: [{ role: "user", content: buildPrompt() }] }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        clearTimeout(timeoutId);
        if (i === attempts - 1) throw err;
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  };

  const renderMarkdown = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <br key={i} />;
      if (trimmed.includes('###')) return <h3 key={i} className="font-black text-primary text-base mt-4 mb-2 border-b border-primary-light pb-1">{trimmed.replace(/###/g, '').trim()}</h3>;
      if (trimmed.startsWith('*') || trimmed.startsWith('-')) return <p key={i} className="pr-4 py-0.5 text-gray-700">• {trimmed.replace(/[*|-]/g, '').trim()}</p>;
      const formatted = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900">$1</strong>');
      return <p key={i} className="leading-7 text-gray-700" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatted) }} />;
    });
  };

  const analyze = async () => {
    const errors = validateInputs();
    if (errors.length > 0) { setValidationErrors(errors); return; }
    setValidationErrors([]);
    setLoading(true);
    setResult(null);
    try {
      const data = await fetchWithRetry("arabicai");
      setResult(data.content?.find(b => b.type === "text")?.text || "حدث خطأ في استجابة Arabic.ai.");
    } catch (err) {
      console.warn("Retrying with Anthropic...", err);
      try {
        const data = await fetchWithRetry("anthropic");
        setResult(data.content?.find(b => b.type === "text")?.text || "حدث خطأ في استجابة Anthropic.");
      } catch (err2) {
        setResult(`❌ ${err2.message === 'The user aborted a request.' ? 'انتهت المهلة (15 ثانية)' : err2.message || 'خطأ غير معروف'}. تحقق من الاتصال.`);
      }
    }
    setLoading(false);
  };

  return <>
    {!result && !loading && <>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-on-surface tracking-tight">تقييم مريض جديد</h2>
      </div>
      <button
        onClick={() => { setPatientSearchOpen(v => !v); setPatientSearchQuery(""); }}
        className="w-full bg-surface-container text-primary border border-primary-light py-2.5 rounded-full text-sm font-bold active:scale-95 transition-transform">
        🔍 بحث عن مريض سابق
      </button>

      {patientSearchOpen && (
        <Card className="border border-primary-light">
          <SectionTitle>بحث عن مريض سابق</SectionTitle>
          <Input
            placeholder="اكتب اسم المريض..."
            value={patientSearchQuery}
            onChange={e => setPatientSearchQuery(e.target.value)}
          />
          {patientSuggestions.length > 0 && (
            <div className="mt-2 space-y-1">
              {patientSuggestions.map((name, i) => (
                <button
                  key={i}
                  onClick={() => selectPreviousPatient(name)}
                  className="w-full text-right px-4 py-2.5 rounded-xl bg-surface-container hover:bg-primary-light text-sm font-medium text-on-surface transition">
                  👤 {name}
                </button>
              ))}
            </div>
          )}
          {patientSearchQuery.trim() && patientSuggestions.length === 0 && (
            <p className="text-xs text-on-surface-variant mt-2 text-center">لا توجد نتائج مطابقة</p>
          )}
        </Card>
      )}

      <Card>
        <SectionTitle>المعلومات الأساسية</SectionTitle>
        <div className="space-y-3">
          <Input label="اسم المريض *" placeholder="الاسم الكامل" value={patient.name} onChange={e => p("name", e.target.value)} />
          <div className="flex gap-3">
            <div className="flex-1"><Input label="العمر *" type="number" placeholder="سنوات" value={patient.age} onChange={e => p("age", e.target.value)} /></div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">الجنس</label>
              <select className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-primary text-on-surface transition" value={patient.sex} onChange={e => p("sex", e.target.value)}>
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
              </select>
            </div>
          </div>
          <Input label="الشكوى الرئيسية *" placeholder="مثال: حمى وصداع منذ يومين" value={patient.complaint} onChange={e => p("complaint", e.target.value)} />
        </div>
      </Card>

      <Card>
        <SectionTitle>العلامات الحيوية</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Input label="الحرارة °C" type="number" step="0.1" placeholder="37.0" value={patient.temp} onChange={e => p("temp", e.target.value)} />
          <Input label="النبض (ن/د)" type="number" placeholder="80" value={patient.pulse} onChange={e => p("pulse", e.target.value)} />
          <div className="col-span-2"><Input label="ضغط الدم" placeholder="120/80" value={patient.bp} onChange={e => p("bp", e.target.value)} /></div>
        </div>
      </Card>

      <Card>
        <SectionTitle>الأعراض التفصيلية</SectionTitle>
        <div className="space-y-3">
          <TextArea label="صف الأعراض بالتفصيل *" rows={3} placeholder="مثال: يشكو من صداع شديد في الرأس، حمى مرتفعة، وقشعريرة متقطعة..." value={patient.symptoms} onChange={e => p("symptoms", e.target.value)} />
          <Input label="مدة الأعراض" placeholder="مثال: 3 أيام" value={patient.duration} onChange={e => p("duration", e.target.value)} />
        </div>
      </Card>

      <button onClick={isOnline ? analyze : () => { const errors = validateInputs(); if (errors.length > 0) { setValidationErrors(errors); return; } _enqueue(patient); setSavedMsg("تم حفظ الحالة — سيتم التحليل تلقائياً عند عودة الاتصال"); }}
        disabled={loading || !patient.name || !patient.complaint || !patient.symptoms}
        className="w-full bg-gradient-to-l from-primary to-primary-container text-white py-4 rounded-full font-black text-base disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
        {isOnline ? "🔬 تحليل وتشخيص" : "💾 حفظ للتحليل لاحقاً"}
      </button>
      {savedMsg && !result && (
        <div className="bg-secondary-container text-on-secondary-container rounded-2xl px-4 py-3 text-sm font-bold text-center">
          ✓ {savedMsg}
        </div>
      )}
      {(!patient.name || !patient.complaint || !patient.symptoms) &&
        <p className="text-center text-xs text-on-surface-variant">* يرجى ملء الحقول الإلزامية أولاً</p>}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-xs font-black text-red-700 mb-2">⚠️ يرجى تصحيح الأخطاء التالية:</p>
          <ul className="space-y-1">
            {validationErrors.map((e, i) => <li key={i} className="text-xs text-red-600 flex gap-2"><span>•</span><span>{e}</span></li>)}
          </ul>
        </div>
      )}
    </>}

    {(result || loading) && <>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-on-surface tracking-tight">نتائج التشخيص</h2>
        <button onClick={() => { setResult(null); setPatient({ name: "", age: "", sex: "male", complaint: "", temp: "", pulse: "", bp: "", symptoms: "", duration: "" }); setSavedMsg(""); }}
          className="text-sm font-bold text-primary bg-primary-light px-3 py-1.5 rounded-full">+ مريض جديد</button>
      </div>
      {loading && (
        <Card className="text-center py-10">
          <div className="text-4xl animate-pulse mb-3">🔬</div>
          <p className="text-green-700 font-medium">جارٍ تحليل الحالة...</p>
          <p className="text-gray-400 text-xs mt-1">قد يستغرق هذا بضع ثوانٍ</p>
        </Card>
      )}
      {copied && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm px-4 py-2 rounded-full shadow-lg">تم النسخ ✓</div>
      )}
      {result && !loading && <>
        <div className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm">
          <span className="text-2xl">👤</span>
          <div>
            <p className="font-bold text-on-surface text-sm">{patient.name}</p>
            <p className="text-xs text-on-surface-variant">{patient.age} سنة · {patient.sex === "male" ? "ذكر" : "أنثى"} · {patient.complaint}</p>
          </div>
        </div>

        {result.includes("##PROBE##") && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-amber-200">
              <div className="w-10 h-10 rounded-xl bg-amber-200 flex items-center justify-center text-xl flex-shrink-0">❓</div>
              <div>
                <p className="font-black text-amber-900 text-sm">لا يمكن التشخيص — المعلومات غير كافية</p>
                <p className="text-xs text-amber-700">اسأل المريض الأسئلة أدناه ثم أعِد الإدخال</p>
              </div>
            </div>
            <div className="text-sm text-amber-900 leading-8">
              {renderMarkdown(result.replace("##PROBE##", "").trim())}
            </div>
            <button onClick={() => { setPage("home"); setResult(null); }}
              className="mt-4 w-full bg-amber-500 text-white py-3 rounded-full font-black text-sm active:scale-95 transition-transform">
              ← العودة لإعادة الإدخال
            </button>
          </div>
        )}

        {!result.includes("##PROBE##") && (
          <Card className="border border-primary-light">
            <div className="text-sm text-gray-700 leading-8">
              {renderMarkdown(result.replace("##DIAGNOSIS##", "").trim())}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(result.replace("##DIAGNOSIS##", "").trim()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}
                className="flex-1 text-xs font-bold text-primary py-2 border border-primary-light rounded-xl hover:bg-surface-low transition">
                نسخ النتائج 📋
              </button>
              <button
                onClick={() => { const text = `المريض: ${patient.name}\nالعمر: ${patient.age} سنة\nالشكوى: ${patient.complaint}\n\n${result.replace("##DIAGNOSIS##", "").replace("##PROBE##", "").trim()}`; window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank"); }}
                className="bg-green-50 text-green-700 border border-green-200 rounded-full px-4 py-2 text-sm font-bold">
                واتساب 📱
              </button>
            </div>
          </Card>
        )}

        {savedMsg && (
          <div className="bg-secondary-container text-on-secondary-container rounded-2xl px-4 py-3 text-sm font-bold text-center">
            ✓ {savedMsg}
          </div>
        )}

        {refForm && (
          <Card className="border border-red-200">
            <SectionTitle>إحالة المريض</SectionTitle>
            <div className="space-y-3">
              <Input placeholder="اسم المريض" value={refForm.name} onChange={e => setRefForm({ ...refForm, name: e.target.value })} />
              <div>
                <label className="text-xs font-semibold text-on-surface-variant block mb-1.5">مستوى الإلحاح</label>
                <select className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-primary text-on-surface transition" value={refForm.urgency} onChange={e => setRefForm({ ...refForm, urgency: e.target.value })}>
                  <option value="urgent">عاجل 🔴</option>
                  <option value="semi">شبه عاجل 🟡</option>
                  <option value="routine">روتيني 🟢</option>
                </select>
              </div>
              <TextArea rows={2} placeholder="سبب الإحالة..." value={refForm.reason} onChange={e => setRefForm({ ...refForm, reason: e.target.value })} />
              <div className="flex gap-2">
                <button onClick={() => { if (refForm.name) { setReferrals(prev => [{ ...refForm, date: today() }, ...prev]); setRefForm(null); setSavedMsg("تم حفظ الإحالة"); } }}
                  className="flex-1 bg-gradient-to-l from-primary to-primary-container text-white py-2.5 rounded-full text-sm font-bold">حفظ</button>
                <button onClick={() => setRefForm(null)} className="flex-1 bg-surface-container text-on-surface-variant py-2.5 rounded-full text-sm font-medium">إلغاء</button>
              </div>
            </div>
          </Card>
        )}

        {visitForm && (
          <Card className="border border-primary-light">
            <SectionTitle>تسجيل الزيارة</SectionTitle>
            <div className="space-y-3">
              <Input placeholder="اسم المريض" value={visitForm.name} onChange={e => setVisitForm({ ...visitForm, name: e.target.value })} />
              <Input placeholder="التشخيص" value={visitForm.diagnosis} onChange={e => setVisitForm({ ...visitForm, diagnosis: e.target.value })} />
              <Input placeholder="العلاج المُعطى" value={visitForm.treatment} onChange={e => setVisitForm({ ...visitForm, treatment: e.target.value })} />
              <Input placeholder="متابعة مطلوبة؟" value={visitForm.followUp} onChange={e => setVisitForm({ ...visitForm, followUp: e.target.value })} />
              <div className="flex gap-2">
                <button onClick={() => { if (visitForm.name) { setVisits(prev => [{ ...visitForm }, ...prev]); setVisitForm(null); setSavedMsg("تم حفظ الزيارة"); } }}
                  className="flex-1 bg-gradient-to-l from-primary to-primary-container text-white py-2.5 rounded-full text-sm font-bold">حفظ</button>
                <button onClick={() => setVisitForm(null)} className="flex-1 bg-surface-container text-on-surface-variant py-2.5 rounded-full text-sm font-medium">إلغاء</button>
              </div>
            </div>
          </Card>
        )}

        {!refForm && !visitForm && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { setRefForm({ name: patient.name, urgency: "urgent", reason: patient.complaint }); setSavedMsg(""); }}
              className="bg-red-50 text-red-700 border border-red-100 py-3 rounded-2xl text-sm font-bold active:scale-95 transition-transform">📋 إحالة المريض</button>
            <button onClick={() => { setVisitForm({ name: patient.name, date: today(), diagnosis: "", treatment: "", followUp: "" }); setSavedMsg(""); }}
              className="bg-surface-low text-primary border border-primary-light py-3 rounded-2xl text-sm font-bold active:scale-95 transition-transform">📅 تسجيل الزيارة</button>
          </div>
        )}
      </>}
    </>}
  </>;
}
