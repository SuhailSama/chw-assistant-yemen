export default function Header({ isOnline, user, logout }) {
  return (
    <>
      {!isOnline && (
        <div className="bg-red-600 text-white text-center py-1.5 text-xs font-bold z-30 sticky top-0">
          📵 غير متصل — التشخيص غير متاح
        </div>
      )}
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
    </>
  );
}
