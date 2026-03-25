import { useState, useEffect } from "react";
import { CONDITIONS } from "./data/conditions";
import { MEDICINES, MEDICINE_CATEGORIES } from "./data/medicines";
import { useAuth } from "./auth/useAuth";
import LoginScreen from "./auth/LoginScreen";
import AdminPanel from "./AdminPanel";
import SupervisorView from "./SupervisorView";

// Tabs that require a logged-in user
const PROTECTED_TABS = ["diagnosis", "referrals", "visits", "admin", "supervisor"];

// ── CONFIG ── swap LAMBDA_URL with your AWS Lambda endpoint in production
const LAMBDA_URL = import.meta.env.VITE_LAMBDA_URL;
const MODEL = "gemini-2.5-flash-lite";

const URGENCY = {
 urgent: { label: "عاجل 🔴", cls: "bg-red-100 text-red-700 border-red-200" },
 semi: { label: "شبه عاجل 🟡", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
 routine: { label: "روتيني 🟢", cls: "bg-green-100 text-green-700 border-green-200" },
};

const NAV_BASE = [
 { id: "home", icon: "🏠", label: "الرئيسية" },
 { id: "diagnosis", icon: "🔬", label: "التشخيص" },
 { id: "education", icon: "📚", label: "التثقيف" },
 { id: "medicines", icon: "💊", label: "الأدوية" },
 { id: "referrals", icon: "📋", label: "الإحالات" },
 { id: "visits", icon: "📅", label: "السجل" },
];

function Input({ label, ...props }) {
 return (
 <div>
 {label && <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">{label}</label>}
 <input className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white text-on-surface placeholder:text-gray-400 transition" {...props} />
 </div>
 );
}

function TextArea({ label, ...props }) {
 return (
 <div>
 {label && <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">{label}</label>}
 <textarea className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none bg-white text-on-surface placeholder:text-gray-400 transition" {...props} />
 </div>
 );
}

function Card({ children, className = "" }) {
 return <div className={`bg-white rounded-2xl shadow-sm p-5 ${className}`}>{children}</div>;
}

function SectionTitle({ children }) {
 return <p className="text-xs font-bold text-primary border-b border-surface-container pb-2 mb-3 uppercase tracking-wide">{children}</p>;
}

export default function App() {
 const { user, role, loading: authLoading, logout, recheckSession } = useAuth();
 const [page, setPage] = useState("disclaimer");
 const [patient, setPatient] = useState({ name: "", age: "", sex: "male", complaint: "", temp: "", pulse: "", bp: "", symptoms: "", duration: "" });
 const [result, setResult] = useState(null);
 const [loading, setLoading] = useState(false);
 const [referrals, setReferrals] = useState(() => { try { return JSON.parse(localStorage.getItem("chw_referrals") || "[]"); } catch { return []; } });
 const [visits, setVisits] = useState(() => { try { return JSON.parse(localStorage.getItem("chw_visits") || "[]"); } catch { return []; } });
 const [refForm, setRefForm] = useState(null);
 const [visitForm, setVisitForm] = useState(null);
 const [condition, setCondition] = useState(null);
 const [isOnline, setIsOnline] = useState(navigator.onLine);
 const [medSearch, setMedSearch] = useState("");
 const [medCategory, setMedCategory] = useState("الكل");
 const [medicine, setMedicine] = useState(null);
 const [validationErrors, setValidationErrors] = useState([]);

 useEffect(() => {
   const handleOnline = () => setIsOnline(true);
   const handleOffline = () => setIsOnline(false);
   window.addEventListener('online', handleOnline);
   window.addEventListener('offline', handleOffline);
   return () => {
     window.removeEventListener('online', handleOnline);
     window.removeEventListener('offline', handleOffline);
   };
 }, []);

 useEffect(() => { localStorage.setItem("chw_referrals", JSON.stringify(referrals)); }, [referrals]);
 useEffect(() => { localStorage.setItem("chw_visits", JSON.stringify(visits)); }, [visits]);

 const exportData = () => {
   const lines = ["=== سجل الإحالات ===", ...referrals.map(r => `${r.date} | ${r.name} | ${URGENCY[r.urgency]?.label} | ${r.reason}`), "", "=== سجل الزيارات ===", ...visits.map(v => `${v.date} | ${v.name} | ${v.diagnosis} | ${v.treatment}`)];
   navigator.clipboard.writeText(lines.join("\n"));
 };

 const p = (k, v) => { setPatient(prev => ({ ...prev, [k]: v })); setValidationErrors([]); };
 const today = () => new Date().toLocaleDateString("ar-SA");

 // ── INPUT VALIDATION — only blocks truly impossible values ──
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
       const res = await fetch(LAMBDA_URL, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ provider, model: MODEL, max_tokens: 1000, messages: [{ role: "user", content: buildPrompt() }] }),
         signal: controller.signal
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
     // Headers
     if (trimmed.includes('###')) return <h3 key={i} className="font-black text-primary text-base mt-4 mb-2 border-b border-primary-light pb-1">{trimmed.replace(/###/g, '').trim()}</h3>;
     // Bullet points
     if (trimmed.startsWith('*') || trimmed.startsWith('-')) return <p key={i} className="pr-4 py-0.5 text-gray-700">• {trimmed.replace(/[*|-]/g, '').trim()}</p>;
     // Bold text
     const formatted = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900">$1</strong>');
     return <p key={i} className="leading-7 text-gray-700" dangerouslySetInnerHTML={{ __html: formatted }} />;
   });
 };

 const analyze = async () => {
   const errors = validateInputs();
   if (errors.length > 0) {
     setValidationErrors(errors);
     return;
   }
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
   setPage("diagnosis");
 };

 // ── AUTH GATING ─────────────────────────────────────────
 // While Amplify checks cached tokens, show a spinner
 if (authLoading) return (
   <div dir="rtl" className="min-h-screen bg-surface flex items-center justify-center">
     <div className="text-center">
       <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
       <p className="text-on-surface-variant text-sm">جارٍ التحقق...</p>
     </div>
   </div>
 );

 // If user tries to go to a protected tab without logging in, show login screen
 if (PROTECTED_TABS.includes(page) && !user) return (
   <LoginScreen onLogin={() => { recheckSession(); }} />
 );

 // ── DISCLAIMER ──────────────────────────────────────────
 if (page === "disclaimer") return (
 <div dir="rtl" className="min-h-screen bg-surface flex items-center justify-center p-5 relative overflow-hidden">
   <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full bg-primary opacity-5 blur-[100px] pointer-events-none" />
   <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary opacity-5 blur-[80px] pointer-events-none" />
   <div className="max-w-sm w-full relative z-10">
     <div className="text-center mb-8">
       <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary to-primary-container rounded-3xl shadow-lg shadow-primary/20 mb-4 text-4xl">🏥</div>
       <h1 className="text-2xl font-black text-on-surface tracking-tight">مساعد العاملين الصحيين</h1>
       <p className="text-sm text-on-surface-variant mt-1 font-medium">أداة دعم طبي ميداني — اليمن</p>
     </div>
     <div className="bg-white rounded-3xl p-6 mb-4 shadow-sm border border-outline-variant/30">
       <div className="flex justify-center mb-4">
         <div className="bg-red-100 rounded-full p-3 text-3xl">⚠️</div>
       </div>
       <h2 className="text-lg font-black text-on-surface text-center mb-1">تنبيه طبي هام</h2>
       <p className="text-xs text-on-surface-variant text-center mb-4">يرجى قراءة الشروط قبل المتابعة</p>
       <div className="space-y-3 text-sm text-on-surface-variant leading-6">
         <div className="flex gap-3 items-start">
           <span className="text-primary text-base mt-0.5">🩺</span>
           <p>هذا التطبيق <strong className="text-on-surface">أداة دعم للعاملين الصحيين المدرّبين فقط</strong>، وليس بديلاً عن الطبيب أو التشخيص المتخصص.</p>
         </div>
         <div className="flex gap-3 items-start">
           <span className="text-primary text-base mt-0.5">🚨</span>
           <p>في الطوارئ — اتصل بالخدمات الطبية الميدانية فوراً.</p>
         </div>
         <div className="flex gap-3 items-start">
           <span className="text-primary text-base mt-0.5">📶</span>
           <p>يعمل التطبيق في وضع محدود بدون إنترنت. التشخيص يتطلب اتصالاً.</p>
         </div>
       </div>
     </div>
     <button onClick={() => setPage("home")} className="w-full bg-gradient-to-l from-primary to-primary-container text-white py-4 rounded-full font-black text-base active:scale-95 transition-transform shadow-lg shadow-primary/20">
       أوافق وأرغب في المتابعة ←
     </button>
   </div>
 </div>
 );

 // ── MAIN LAYOUT ─────────────────────────────────────────
 return (
 <div dir="rtl" className="min-h-screen bg-surface flex flex-col max-w-md mx-auto relative">

 {!isOnline && (
   <div className="bg-red-600 text-white text-center py-1.5 text-xs font-bold z-30 sticky top-0">
     📵 غير متصل — التشخيص غير متاح
   </div>
 )}

 {/* Header */}
 <header className="bg-white/90 backdrop-blur-md border-b border-outline-variant/40 px-5 py-3 flex items-center justify-between sticky top-0 z-20">
 <div>
 <h1 className="font-black text-base text-primary leading-tight tracking-tight">مساعد العاملين الصحيين</h1>
 <p className="text-on-surface-variant text-xs font-medium">أداة دعم طبي ميداني — اليمن</p>
 </div>
 <div className="flex items-center gap-2">
   <span className={`text-xs px-3 py-1 rounded-full font-bold ${isOnline ? "bg-secondary-container text-on-secondary-container" : "bg-red-100 text-red-700"}`}>
     {isOnline ? "🟢 متصل" : "🔴 غير متصل"}
   </span>
   {user && (
     <button
       onClick={logout}
       className="text-xs px-3 py-1 rounded-full font-bold bg-surface-container text-on-surface-variant border border-outline-variant/40 hover:bg-red-50 hover:text-red-600 transition"
       title={`خروج (${user.username})`}
     >
       خروج
     </button>
   )}
 </div>
 </header>

 {/* Content */}
 <main className="flex-1 overflow-y-auto pb-24 px-4 py-5 space-y-4">

 {/* HOME */}
 {page === "home" && <>
 <h2 className="text-xl font-black text-on-surface tracking-tight">تقييم مريض جديد</h2>
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

 <button
 onClick={analyze}
 disabled={loading || !isOnline || !patient.name || !patient.complaint || !patient.symptoms}
 className="w-full bg-gradient-to-l from-primary to-primary-container text-white py-4 rounded-full font-black text-base disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
 >
 {loading ? <><span className="animate-spin inline-block">⏳</span> جارٍ التحليل...</> : "🔬 تحليل وتشخيص"}
 </button>
 {(!isOnline) && <p className="text-center text-xs text-red-600 font-bold">📵 التشخيص غير متاح بدون اتصال</p>}
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

 {/* DIAGNOSIS */}
 {page === "diagnosis" && <>
 <div className="flex items-center justify-between">
 <h2 className="text-xl font-black text-on-surface tracking-tight">نتائج التشخيص</h2>
 <button onClick={() => { setPage("home"); setResult(null); }} className="text-sm font-bold text-primary bg-primary-light px-3 py-1.5 rounded-full">+ مريض جديد</button>
 </div>
 {loading && (
 <Card className="text-center py-10">
 <div className="text-4xl animate-pulse mb-3">🔬</div>
 <p className="text-green-700 font-medium">جارٍ تحليل الحالة...</p>
 <p className="text-gray-400 text-xs mt-1">قد يستغرق هذا بضع ثوانٍ</p>
 </Card>
 )}
 {result && !loading && <>
 {/* Patient info header — always shown */}
 <div className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm">
   <span className="text-2xl">👤</span>
   <div>
     <p className="font-bold text-on-surface text-sm">{patient.name}</p>
     <p className="text-xs text-on-surface-variant">{patient.age} سنة · {patient.sex === "male" ? "ذكر" : "أنثى"} · {patient.complaint}</p>
   </div>
 </div>

 {/* PROBE response — insufficient data */}
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

 {/* DIAGNOSIS response — sufficient data */}
 {!result.includes("##PROBE##") && (
 <Card className="border border-primary-light">
 <div className="text-sm text-gray-700 leading-8">
   {renderMarkdown(result.replace("##DIAGNOSIS##", "").trim())}
 </div>
 <button
  onClick={() => navigator.clipboard.writeText(result.replace("##DIAGNOSIS##", "").trim())}
  className="mt-4 w-full text-xs font-bold text-primary py-2 border border-primary-light rounded-xl hover:bg-surface-low transition"
 >
  نسخ النتائج 📋
 </button>
 </Card>
 )}
 <div className="grid grid-cols-2 gap-3">
 <button
 onClick={() => { setRefForm({ name: patient.name, urgency: "urgent", reason: patient.complaint }); setPage("referrals"); }}
 className="bg-red-50 text-red-700 border border-red-100 py-3 rounded-2xl text-sm font-bold active:scale-95 transition-transform"
 >📋 إحالة المريض</button>
 <button
 onClick={() => { setVisitForm({ name: patient.name, date: today(), diagnosis: "", treatment: "", followUp: "" }); setPage("visits"); }}
 className="bg-surface-low text-primary border border-primary-light py-3 rounded-2xl text-sm font-bold active:scale-95 transition-transform"
 >📅 تسجيل الزيارة</button>
 </div>
 </>}
 {!result && !loading && (
 <Card className="text-center py-10">
 <div className="text-4xl mb-3">🔬</div>
 <p className="text-on-surface-variant text-sm">لا يوجد تشخيص بعد</p>
 <button onClick={() => setPage("home")} className="mt-3 text-primary font-bold text-sm">← أدخل بيانات المريض</button>
 </Card>
 )}
 </>}

 {/* EDUCATION */}
 {page === "education" && <>
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
 </>}

 {/* MEDICINES */}
 {page === "medicines" && <>
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
   {MEDICINES.filter(m => (medCategory === "الكل" || m.category === medCategory) && (medSearch === "" || m.name.includes(medSearch) || m.en.toLowerCase().includes(medSearch.toLowerCase()))).map((m, i) => (
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
   {MEDICINES.filter(m => (medCategory === "الكل" || m.category === medCategory) && (medSearch === "" || m.name.includes(medSearch) || m.en.toLowerCase().includes(medSearch.toLowerCase()))).length === 0 && (
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
 </>}

 {/* REFERRALS */}
 {page === "referrals" && <>
 <div className="flex items-center justify-between">
 <h2 className="text-xl font-black text-on-surface tracking-tight">الإحالات <span className="text-on-surface-variant font-medium text-base">({referrals.length})</span></h2>
 <button onClick={() => setRefForm({ name: "", urgency: "urgent", reason: "" })} className="bg-primary text-white text-xs px-4 py-2 rounded-full font-bold shadow-sm shadow-primary/20">+ إضافة</button>
 </div>
 {refForm && (
 <Card className="border border-green-200">
 <SectionTitle>إحالة جديدة</SectionTitle>
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
 <button onClick={() => { if (refForm.name) { setReferrals([{ ...refForm, date: today() }, ...referrals]); setRefForm(null); } }} className="flex-1 bg-gradient-to-l from-primary to-primary-container text-white py-2.5 rounded-full text-sm font-bold shadow-sm">حفظ</button>
 <button onClick={() => setRefForm(null)} className="flex-1 bg-surface-container text-on-surface-variant py-2.5 rounded-full text-sm font-medium">إلغاء</button>
 </div>
 </div>
 </Card>
 )}
 {referrals.length === 0 && !refForm ? (
 <Card className="text-center py-10">
 <div className="text-4xl mb-3">📋</div>
 <p className="text-sm text-gray-400">لا توجد إحالات مسجلة</p>
 </Card>
 ) : referrals.map((r, i) => (
 <div key={i} className={`rounded-xl p-4 border ${URGENCY[r.urgency]?.cls || ""}`}>
 <div className="flex items-center justify-between mb-1.5">
 <p className="font-semibold text-sm">{r.name}</p>
 <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${URGENCY[r.urgency]?.cls || ""}`}>{URGENCY[r.urgency]?.label}</span>
 </div>
 <p className="text-sm opacity-80">{r.reason}</p>
 <p className="text-xs opacity-50 mt-1">{r.date}</p>
 </div>
 ))}
 </>}

 {/* VISITS */}
 {page === "visits" && <>
 <div className="flex items-center justify-between">
 <h2 className="text-xl font-black text-on-surface tracking-tight">سجل الزيارات <span className="text-on-surface-variant font-medium text-base">({visits.length})</span></h2>
 <div className="flex gap-2">
   {(visits.length > 0 || referrals.length > 0) && <button onClick={exportData} className="bg-surface-high text-primary text-xs px-3 py-2 rounded-full font-bold border border-primary-light">تصدير 📋</button>}
   <button onClick={() => setVisitForm({ name: "", date: today(), diagnosis: "", treatment: "", followUp: "" })} className="bg-primary text-white text-xs px-4 py-2 rounded-full font-bold shadow-sm shadow-primary/20">+ تسجيل</button>
 </div>
 </div>
 {visitForm && (
 <Card className="border border-green-200">
 <SectionTitle>تسجيل زيارة جديدة</SectionTitle>
 <div className="space-y-3">
 <Input placeholder="اسم المريض" value={visitForm.name} onChange={e => setVisitForm({ ...visitForm, name: e.target.value })} />
 <Input placeholder="التشخيص" value={visitForm.diagnosis} onChange={e => setVisitForm({ ...visitForm, diagnosis: e.target.value })} />
 <Input placeholder="العلاج المُعطى" value={visitForm.treatment} onChange={e => setVisitForm({ ...visitForm, treatment: e.target.value })} />
 <Input placeholder="متابعة مطلوبة؟" value={visitForm.followUp} onChange={e => setVisitForm({ ...visitForm, followUp: e.target.value })} />
 <div className="flex gap-2">
 <button onClick={() => { if (visitForm.name) { setVisits([{ ...visitForm }, ...visits]); setVisitForm(null); } }} className="flex-1 bg-gradient-to-l from-primary to-primary-container text-white py-2.5 rounded-full text-sm font-bold shadow-sm">حفظ</button>
 <button onClick={() => setVisitForm(null)} className="flex-1 bg-surface-container text-on-surface-variant py-2.5 rounded-full text-sm font-medium">إلغاء</button>
 </div>
 </div>
 </Card>
 )}
 {visits.length === 0 && !visitForm ? (
 <Card className="text-center py-10">
 <div className="text-4xl mb-3">📅</div>
 <p className="text-sm text-gray-400">لا توجد زيارات مسجلة</p>
 </Card>
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

 {/* SUPERVISOR VIEW */}
 {page === "supervisor" && ["Supervisor","Admin"].includes(role) && <SupervisorView />}

 {/* ADMIN PANEL */}
 {page === "admin" && role === "Admin" && <AdminPanel />}

 </main>

 {/* Bottom Nav */}
 <nav className="fixed bottom-0 right-0 left-0 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-outline-variant/30 flex z-20 rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-safe">
 {[
   ...NAV_BASE,
   ...(["Supervisor","Admin"].includes(role) ? [{ id: "supervisor", icon: "📊", label: "المتابعة" }] : []),
   ...(role === "Admin" ? [{ id: "admin", icon: "⚙️", label: "الإدارة" }] : []),
 ].map(item => (
 <button key={item.id} onClick={() => { setPage(item.id); if (item.id !== "education") setCondition(null); if (item.id !== "medicines") setMedicine(null); }}
 className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-all active:scale-90 ${page === item.id ? "text-primary" : "text-on-surface-variant/50"}`}>
 <div className={`flex items-center justify-center rounded-2xl transition-all ${page === item.id ? "bg-primary-light px-3 py-1" : "px-3 py-1"}`}>
   <span className="text-lg leading-none">{item.icon}</span>
 </div>
 <span className={`text-[10px] leading-none mt-0.5 ${page === item.id ? "font-black" : "font-medium"}`}>{item.label}</span>
 </button>
 ))}
 </nav>
 </div>
 );
}
