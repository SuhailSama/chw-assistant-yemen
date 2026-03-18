import { useState, useEffect } from "react";

// ── CONFIG ── swap LAMBDA_URL with your AWS Lambda endpoint in production
const LAMBDA_URL = import.meta.env.VITE_LAMBDA_URL;
const MODEL = "gemini-1.5-flash"; // Switched to Gemini

const CONDITIONS = [
 { name: "الملاريا", en: "Malaria", icon: "🦟",
 symptoms: "حمى متقطعة، قشعريرة، صداع شديد، تعرق، آلام عضلية وهزال",
 treatment: "مضادات الملاريا حسب البروتوكول المحلي (ACT)، راحة تامة، سوائل وفيرة، خافض حرارة",
 refer: "طفل أقل من 5 سنوات، فقدان الوعي، تشنجات، حمى فوق 40°C، قيء مستمر يمنع الدواء" },
 { name: "الإسهال والجفاف", en: "Diarrhea & Dehydration", icon: "💧",
 symptoms: "براز سائل متكرر، غثيان وقيء، ضعف عام، عطش شديد، جفاف الفم",
 treatment: "محلول معالجة الجفاف الفموي (ORS) فوراً — كوب كل إسهالة، استمرار الرضاعة للرضع",
 refer: "دم في البراز، جفاف شديد (عيون غائرة، جلد لا يرتد)، رضيع أقل من 6 أشهر، إغماء" },
 { name: "التهابات الجهاز التنفسي", en: "Respiratory Infections", icon: "🫁",
 symptoms: "سعال، حمى، ضيق تنفس، زكام، ألم حلق، بحة صوت",
 treatment: "راحة، سوائل دافئة، مسكنات الألم، استنشاق بخار الماء، العسل للسعال (أكبر من سنة)",
 refer: "ضيق تنفس شديد، زرقة الشفاه أو الأظافر، حمى فوق 39°C أكثر من 3 أيام، طفل صغير" },
 { name: "سوء التغذية", en: "Malnutrition", icon: "🍎",
 symptoms: "نقص واضح في الوزن، وذمة في القدمين والوجه، شعر هش وخفيف، إرهاق وخمول",
 treatment: "RUTF (الغذاء العلاجي الجاهز)، تغذية تدريجية ومتكررة، متابعة منتظمة لتسجيل الوزن",
 refer: "سوء تغذية حاد مع مضاعفات طبية، وذمة في الوجه، فقدان الشهية التام، طفل أقل من 6 أشهر" },
 { name: "الكوليرا", en: "Cholera", icon: "⚠️",
 symptoms: "إسهال مائي غزير مفاجئ (كماء الأرز)، قيء، جفاف سريع جداً، تقلصات عضلية",
 treatment: "ORS فوري وغزير جداً، عزل المريض، تعقيم كل ما لمسه، إبلاغ السلطات الصحية",
 refer: "فوري دائماً — الكوليرا حالة طوارئ صحية عامة تستلزم إحالة عاجلة وإبلاغ السلطات" },
 { name: "الجروح والإصابات", en: "Wounds & Injuries", icon: "🩹",
 symptoms: "جروح مفتوحة، نزيف، كسور محتملة، تورم وكدمات، ألم شديد موضعي",
 treatment: "إيقاف النزيف بالضغط المباشر، تنظيف الجرح بماء نظيف وصابون، ضمادة معقمة، تجنب تحريك الطرف المشتبه بكسره",
 refer: "كسور مشتبه بها، جروح عميقة تحتاج خياطة، نزيف لا يتوقف بعد 10 دقائق، إصابة رأس أو عمود فقري" },
 { name: "ارتفاع ضغط الدم", en: "Hypertension", icon: "❤️",
 symptoms: "صداع شديد في مؤخرة الرأس، دوار، ضبابية في الرؤية، خفقان، نزيف من الأنف",
 treatment: "راحة تامة، تجنب الملح والإجهاد، قياس الضغط بانتظام، الأدوية إن وُجدت",
 refer: "ضغط فوق 180/110، صداع شديد مع اضطراب رؤية أو إغماء، مريضة حامل مع ارتفاع الضغط" },
 { name: "الحمى غير المحددة", en: "Fever of Unknown Origin", icon: "🌡️",
 symptoms: "ارتفاع درجة الحرارة فوق 38°C، قشعريرة، تعب عام، فقدان الشهية",
 treatment: "خافض الحرارة (باراسيتامول)، سوائل وفيرة، راحة، رصد الحرارة كل 4 ساعات",
 refer: "حمى فوق 39.5°C، مستمرة أكثر من 3 أيام بلا سبب واضح، مصحوبة بطفح جلدي أو تصلب رقبة أو تشنجات" },
];

const URGENCY = {
 urgent: { label: "عاجل 🔴", cls: "bg-red-100 text-red-700 border-red-200" },
 semi: { label: "شبه عاجل 🟡", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
 routine: { label: "روتيني 🟢", cls: "bg-green-100 text-green-700 border-green-200" },
};

const NAV = [
 { id: "home", icon: "🏠", label: "الرئيسية" },
 { id: "diagnosis", icon: "🔬", label: "التشخيص" },
 { id: "education", icon: "📚", label: "التثقيف" },
 { id: "referrals", icon: "📋", label: "الإحالات" },
 { id: "visits", icon: "📅", label: "السجل" },
];

function Input({ label, ...props }) {
 return (
 <div>
 {label && <label className="block text-xs text-gray-500 mb-1">{label}</label>}
 <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400 bg-white" {...props} />
 </div>
 );
}

function TextArea({ label, ...props }) {
 return (
 <div>
 {label && <label className="block text-xs text-gray-500 mb-1">{label}</label>}
 <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400 resize-none bg-white" {...props} />
 </div>
 );
}

function Card({ children, className = "" }) {
 return <div className={`bg-white rounded-xl shadow-sm p-4 ${className}`}>{children}</div>;
}

function SectionTitle({ children }) {
 return <p className="text-xs font-bold text-green-700 border-b border-gray-100 pb-2 mb-3">{children}</p>;
}

export default function App() {
 const [page, setPage] = useState("disclaimer");
 const [patient, setPatient] = useState({ name: "", age: "", sex: "male", complaint: "", temp: "", pulse: "", bp: "", symptoms: "", duration: "" });
 const [result, setResult] = useState(null);
 const [loading, setLoading] = useState(false);
 const [referrals, setReferrals] = useState([]);
 const [visits, setVisits] = useState([]);
 const [refForm, setRefForm] = useState(null);
 const [visitForm, setVisitForm] = useState(null);
 const [condition, setCondition] = useState(null);
 const [isOnline, setIsOnline] = useState(navigator.onLine);

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

 const p = (k, v) => setPatient(prev => ({ ...prev, [k]: v }));
 const today = () => new Date().toLocaleDateString("ar-SA");

 const buildPrompt = () => `أنت طبيب مساعد خبير تدعم عاملاً صحياً مجتمعياً في منطقة ريفية باليمن حيث لا يوجد وصول للمستشفيات أو الأطباء. قدّم تشخيصاً احتمالياً وتوصيات عملية باللهجة اليمنية العامية البسيطة.

بيانات المريض:
- الاسم: ${patient.name} | العمر: ${patient.age} | الجنس: ${patient.sex === "male" ? "ذكر" : "أنثى"}
- الشكوى الرئيسية: ${patient.complaint}
- الأعراض: ${patient.symptoms}
- المدة: ${patient.duration}
- الحرارة: ${patient.temp || "—"}°C | النبض: ${patient.pulse || "—"} ن/د | ضغط الدم: ${patient.bp || "—"}

أجب بهذا الترتيب بالضبط:

**🩺 التشخيص المحتمل**
(أذكر 2-3 تشخيصات محتملة مرتبة حسب الاحتمالية مع سبب موجز لكل منها)

**⚠️ مستوى الخطورة**
(بسيط / متوسط / خطير / طوارئ — مع جملة تفسيرية)

**⚡ الإجراءات الفورية**
(ماذا يفعل العامل الصحي الآن — خطوات عملية واضحة)

**💊 العلاج المقترح**
(أدوية أو إجراءات متاحة محلياً بجرعات واضحة إن أمكن)

**🚨 علامات الخطر — متى تُحيل فوراً**
(قائمة واضحة بعلامات تستوجب الإحالة العاجلة)

**🗣️ تعليمات للمريض**
(بكلام بسيط يفهمه المريض ويستطيع تذكره)

تنبيه: هذا موقف ميداني طارئ. كن دقيقاً وعملياً وواضحاً. نبّه بشكل صريح إذا كانت الحالة تستدعي إحالة عاجلة.`;

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

 const analyze = async () => {
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

 // ── DISCLAIMER ──────────────────────────────────────────
 if (page === "disclaimer") return (
 <div dir="rtl" className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-5">
 <div className="max-w-sm w-full">
 <div className="text-center mb-6">
 <div className="text-7xl mb-3">🏥</div>
 <h1 className="text-2xl font-bold text-green-800">مساعد العاملين الصحيين</h1>
 <p className="text-sm text-gray-500 mt-1">أداة دعم طبي ميداني — اليمن</p>
 </div>
 <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 mb-5">
 <h2 className="text-base font-bold text-amber-800 mb-2 flex items-center gap-2">⚠️ تنبيه طبي هام</h2>
 <p className="text-sm text-amber-800 leading-7">
 هذا التطبيق <strong>أداة دعم للعاملين الصحيين المدرّبين فقط</strong>، وليس بديلاً عن الطبيب أو التشخيص الطبي المتخصص.
 يجب دائماً الرجوع إلى مختص طبي متى أمكن ذلك.
 القرار الطبي النهائي يعود للعامل الصحي المدرّب، وليس للتطبيق.
 </p>
 </div>
 <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5 text-xs text-blue-700 flex gap-2">
 <span>📶</span>
 <span>يعمل التطبيق في وضع محدود بدون إنترنت (التثقيف الصحي والسجلات فقط). التشخيص يتطلب اتصالاً.</span>
 </div>
 <button onClick={() => setPage("home")} className="w-full bg-green-600 text-white py-3.5 rounded-xl font-bold text-base hover:bg-green-700 active:bg-green-800 transition shadow-sm">
 أفهم وأوافق — ابدأ التطبيق
 </button>
 </div>
 </div>
 );

 // ── MAIN LAYOUT ─────────────────────────────────────────
 return (
 <div dir="rtl" className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative">

 {!isOnline && (
   <div className="bg-red-600 text-white text-center py-2 text-xs font-bold z-30 sticky top-0">
     أنت غير متصل — التشخيص غير متاح، التثقيف الصحي يعمل
   </div>
 )}

 {/* Header */}
 <header className="bg-green-700 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-md">
 <div>
 <h1 className="font-bold text-sm leading-tight">مساعد العاملين الصحيين</h1>
 <p className="text-green-300 text-xs">أداة دعم طبي ميداني</p>
 </div>
 <div className="flex items-center gap-2">
 <span className={`text-xs px-2 py-0.5 rounded-full ${isOnline ? "bg-green-600 text-green-200" : "bg-red-500 text-red-100"}`}>
   {isOnline ? "🟢 متصل" : "🔴 غير متصل"}
 </span>
 <span className="text-2xl">🏥</span>
 </div>
 </header>

 {/* Content */}
 <main className="flex-1 overflow-y-auto pb-20 px-4 py-4 space-y-4">

 {/* HOME */}
 {page === "home" && <>
 <h2 className="text-lg font-bold text-gray-800">تقييم مريض جديد</h2>
 <Card>
 <SectionTitle>المعلومات الأساسية</SectionTitle>
 <div className="space-y-3">
 <Input label="اسم المريض *" placeholder="الاسم الكامل" value={patient.name} onChange={e => p("name", e.target.value)} />
 <div className="flex gap-3">
 <div className="flex-1"><Input label="العمر *" type="number" placeholder="سنوات" value={patient.age} onChange={e => p("age", e.target.value)} /></div>
 <div className="flex-1">
 <label className="block text-xs text-gray-500 mb-1">الجنس</label>
 <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-400" value={patient.sex} onChange={e => p("sex", e.target.value)}>
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
 className="w-full bg-green-600 text-white py-3.5 rounded-xl font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-700 active:bg-green-800 transition shadow-sm flex items-center justify-center gap-2"
 >
 {loading ? <><span className="animate-spin inline-block">⏳</span> جارٍ التحليل...</> : "🔬 تحليل وتشخيص"}
 </button>
 {(!isOnline) && <p className="text-center text-xs text-red-500 font-bold">التشخيص غير متاح في وضع عدم الاتصال</p>}
 {(!patient.name || !patient.complaint || !patient.symptoms) &&
 <p className="text-center text-xs text-gray-400">* يرجى ملء الحقول الإلزامية أولاً</p>}
 </>}

 {/* DIAGNOSIS */}
 {page === "diagnosis" && <>
 <div className="flex items-center justify-between">
 <h2 className="text-lg font-bold text-gray-800">نتائج التشخيص</h2>
 <button onClick={() => { setPage("home"); setResult(null); }} className="text-green-600 text-sm font-semibold">+ مريض جديد</button>
 </div>
 {loading && (
 <Card className="text-center py-10">
 <div className="text-4xl animate-pulse mb-3">🔬</div>
 <p className="text-green-700 font-medium">جارٍ تحليل الحالة...</p>
 <p className="text-gray-400 text-xs mt-1">قد يستغرق هذا بضع ثوانٍ</p>
 </Card>
 )}
 {result && !loading && <>
 <Card className="border border-green-100">
 <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
 <span className="text-lg">👤</span>
 <div>
 <p className="font-semibold text-gray-800 text-sm">{patient.name}</p>
 <p className="text-xs text-gray-400">{patient.age} سنة · {patient.sex === "male" ? "ذكر" : "أنثى"} · {patient.complaint}</p>
 </div>
 </div>
 <div className="text-sm text-gray-700 leading-8 whitespace-pre-wrap">{result}</div>
 <button 
  onClick={() => navigator.clipboard.writeText(result)}
  className="mt-4 w-full text-xs text-gray-500 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
 >
  نسخ النتائج 📋
 </button>
 </Card>
 <div className="grid grid-cols-2 gap-3">
 <button
 onClick={() => { setRefForm({ name: patient.name, urgency: "urgent", reason: patient.complaint }); setPage("referrals"); }}
 className="bg-red-50 text-red-700 border border-red-200 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-100 transition"
 >📋 إحالة المريض</button>
 <button
 onClick={() => { setVisitForm({ name: patient.name, date: today(), diagnosis: "", treatment: "", followUp: "" }); setPage("visits"); }}
 className="bg-blue-50 text-blue-700 border border-blue-200 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-100 transition"
 >📅 تسجيل الزيارة</button>
 </div>
 </>}
 {!result && !loading && (
 <Card className="text-center py-10">
 <div className="text-4xl mb-3">🔬</div>
 <p className="text-gray-400 text-sm">لا يوجد تشخيص بعد</p>
 <button onClick={() => setPage("home")} className="mt-3 text-green-600 font-semibold text-sm">← أدخل بيانات المريض</button>
 </Card>
 )}
 </>}

 {/* EDUCATION */}
 {page === "education" && <>
 <h2 className="text-lg font-bold text-gray-800">التثقيف الصحي</h2>
 {condition === null ? (
 <div className="space-y-2">
 {CONDITIONS.map((c, i) => (
 <button key={i} onClick={() => setCondition(i)} className="w-full bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 text-right hover:shadow-md active:bg-gray-50 transition">
 <span className="text-3xl w-10 text-center">{c.icon}</span>
 <div className="flex-1">
 <p className="font-semibold text-gray-800 text-sm">{c.name}</p>
 <p className="text-xs text-gray-400">{c.en}</p>
 </div>
 <span className="text-gray-300 text-lg">‹</span>
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
 <p className="text-xs font-bold text-green-700 mb-1.5">🩺 الأعراض</p>
 <p className="text-sm text-gray-700 leading-6">{CONDITIONS[condition].symptoms}</p>
 </div>
 <div>
 <p className="text-xs font-bold text-blue-700 mb-1.5">💊 العلاج</p>
 <p className="text-sm text-gray-700 leading-6">{CONDITIONS[condition].treatment}</p>
 </div>
 <div className="bg-red-50 border border-red-100 rounded-xl p-3">
 <p className="text-xs font-bold text-red-700 mb-1.5">🚨 متى تُحيل المريض فوراً</p>
 <p className="text-sm text-red-700 leading-6">{CONDITIONS[condition].refer}</p>
 </div>
 </div>
 <button onClick={() => setCondition(null)} className="mt-4 w-full text-green-600 font-semibold text-sm py-2 border border-green-200 rounded-lg hover:bg-green-50">← العودة للقائمة</button>
 </Card>
 )}
 </>}

 {/* REFERRALS */}
 {page === "referrals" && <>
 <div className="flex items-center justify-between">
 <h2 className="text-lg font-bold text-gray-800">الإحالات ({referrals.length})</h2>
 <button onClick={() => setRefForm({ name: "", urgency: "urgent", reason: "" })} className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold">+ إضافة</button>
 </div>
 {refForm && (
 <Card className="border border-green-200">
 <SectionTitle>إحالة جديدة</SectionTitle>
 <div className="space-y-3">
 <Input placeholder="اسم المريض" value={refForm.name} onChange={e => setRefForm({ ...refForm, name: e.target.value })} />
 <div>
 <label className="text-xs text-gray-500 block mb-1">مستوى الإلحاح</label>
 <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-400" value={refForm.urgency} onChange={e => setRefForm({ ...refForm, urgency: e.target.value })}>
 <option value="urgent">عاجل 🔴</option>
 <option value="semi">شبه عاجل 🟡</option>
 <option value="routine">روتيني 🟢</option>
 </select>
 </div>
 <TextArea rows={2} placeholder="سبب الإحالة..." value={refForm.reason} onChange={e => setRefForm({ ...refForm, reason: e.target.value })} />
 <div className="flex gap-2">
 <button onClick={() => { if (refForm.name) { setReferrals([{ ...refForm, date: today() }, ...referrals]); setRefForm(null); } }} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-semibold">حفظ</button>
 <button onClick={() => setRefForm(null)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">إلغاء</button>
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
 <h2 className="text-lg font-bold text-gray-800">سجل الزيارات ({visits.length})</h2>
 <button onClick={() => setVisitForm({ name: "", date: today(), diagnosis: "", treatment: "", followUp: "" })} className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold">+ تسجيل</button>
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
 <button onClick={() => { if (visitForm.name) { setVisits([{ ...visitForm }, ...visits]); setVisitForm(null); } }} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-semibold">حفظ</button>
 <button onClick={() => setVisitForm(null)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">إلغاء</button>
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
 </main>

 {/* Bottom Nav */}
 <nav className="fixed bottom-0 right-0 left-0 max-w-md mx-auto bg-white border-t border-gray-200 flex z-20 shadow-lg">
 {NAV.map(item => (
 <button key={item.id} onClick={() => { setPage(item.id); if (item.id !== "education") setCondition(null); }}
 className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition ${page === item.id ? "text-green-600" : "text-gray-400"}`}>
 <span className="text-xl leading-none">{item.icon}</span>
 <span className={`text-xs leading-none ${page === item.id ? "font-bold" : ""}`}>{item.label}</span>
 {page === item.id && <span className="w-1 h-1 rounded-full bg-green-500 mt-0.5" />}
 </button>
 ))}
 </nav>
 </div>
 );
}
