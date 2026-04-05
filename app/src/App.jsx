import { useState, useEffect } from "react";
import { useAuth } from "./auth/useAuth";
import LoginScreen from "./auth/LoginScreen";
import AdminPanel from "./AdminPanel";
import SupervisorView from "./SupervisorView";
import Header from "./components/layout/Header";
import BottomNav from "./components/layout/BottomNav";
import ErrorBoundary from "./components/ErrorBoundary";
import HomePage from "./pages/HomePage";
import DiagnosisPage from "./pages/DiagnosisPage";
import EducationPage from "./pages/EducationPage";
import MedicinesPage from "./pages/MedicinesPage";
import RecordsPage from "./pages/RecordsPage";
import { useOfflineQueue } from "./hooks/useOfflineQueue";

const PROTECTED_TABS = ["diagnosis", "records", "admin", "supervisor"];

export default function App() {
  const { user, role, loading: authLoading, logout, recheckSession } = useAuth();
  const [page, setPage] = useState("disclaimer");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [referrals, setReferrals] = useState(() => { try { return JSON.parse(localStorage.getItem("chw_referrals") || "[]"); } catch { return []; } });
  const [visits, setVisits] = useState(() => { try { return JSON.parse(localStorage.getItem("chw_visits") || "[]"); } catch { return []; } });
  const { enqueue, pending, processQueue } = useOfflineQueue();

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

  useEffect(() => {
    const handleOnlineProcess = () => {
      processQueue(async (_patientData) => {
        // Auto-process: navigate to diagnosis page so user can review
        // Actual AI call requires user context; we just clear the queue on reconnect
      });
    };
    window.addEventListener('online', handleOnlineProcess);
    return () => window.removeEventListener('online', handleOnlineProcess);
  }, [processQueue]);

  useEffect(() => { localStorage.setItem("chw_referrals", JSON.stringify(referrals)); }, [referrals]);
  useEffect(() => { localStorage.setItem("chw_visits", JSON.stringify(visits)); }, [visits]);

  if (authLoading) return (
    <div dir="rtl" className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-on-surface-variant text-sm">جارٍ التحقق...</p>
      </div>
    </div>
  );

  if (PROTECTED_TABS.includes(page) && !user) return (
    <LoginScreen onLogin={() => { recheckSession(); }} />
  );

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

  return (
    <div dir="rtl" className="min-h-screen bg-surface flex flex-col max-w-md mx-auto relative">
      <Header isOnline={isOnline} user={user} logout={logout} />
      <main className="flex-1 overflow-y-auto pb-24 px-4 py-5 space-y-4">
        {page === "home"       && <ErrorBoundary><HomePage user={user} visits={visits} referrals={referrals} setPage={setPage} pending={pending} /></ErrorBoundary>}
        {page === "diagnosis"  && <ErrorBoundary><DiagnosisPage isOnline={isOnline} setReferrals={setReferrals} setVisits={setVisits} setPage={setPage} enqueue={enqueue} pending={pending} /></ErrorBoundary>}
        {page === "education"  && <ErrorBoundary><EducationPage /></ErrorBoundary>}
        {page === "medicines"  && <ErrorBoundary><MedicinesPage /></ErrorBoundary>}
        {page === "records"    && <ErrorBoundary><RecordsPage referrals={referrals} visits={visits} setReferrals={setReferrals} setVisits={setVisits} /></ErrorBoundary>}
        {page === "supervisor" && ["Supervisor", "Admin"].includes(role) && <ErrorBoundary><SupervisorView /></ErrorBoundary>}
        {page === "admin"      && role === "Admin" && <ErrorBoundary><AdminPanel /></ErrorBoundary>}
      </main>
      <BottomNav page={page} setPage={setPage} role={role} pending={pending} />
    </div>
  );
}
