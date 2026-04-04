import { useState, useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Input } from "./components/ui";

const API = import.meta.env.VITE_LAMBDA_URL.replace("/v1/messages", "");
const GROUPS = ["CHW", "Supervisor", "Admin"];

const GROUP_COLORS = {
  CHW:        "bg-blue-100 text-blue-700",
  Supervisor: "bg-purple-100 text-purple-700",
  Admin:      "bg-amber-100 text-amber-700",
  "—":        "bg-gray-100 text-gray-500",
};

const STATUS_COLORS = {
  CONFIRMED:         "bg-green-100 text-green-700",
  FORCE_CHANGE_PASSWORD: "bg-orange-100 text-orange-700",
};

async function authHeader() {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export default function AdminPanel() {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ username: "", tempPassword: "", group: "CHW" });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]         = useState("");

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/admin/users`, { headers: await authHeader() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(data.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function createUser(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/admin/users`, {
        method: "POST",
        headers: await authHeader(),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message);
      setShowForm(false);
      setForm({ username: "", tempPassword: "", group: "CHW" });
      loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function changeGroup(username, newGroup, oldGroup) {
    try {
      const res = await fetch(`${API}/admin/users/${encodeURIComponent(username)}/group`, {
        method: "PUT",
        headers: await authHeader(),
        body: JSON.stringify({ newGroup, oldGroup }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message);
      setUsers(prev => prev.map(u => u.username === username ? { ...u, group: newGroup } : u));
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleUser(username, enabled) {
    try {
      const res = await fetch(`${API}/admin/users/${encodeURIComponent(username)}/toggle`, {
        method: "PUT",
        headers: await authHeader(),
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message);
      setUsers(prev => prev.map(u => u.username === username ? { ...u, enabled: !enabled } : u));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-4 right-4 max-w-md mx-auto bg-secondary-container text-on-secondary-container rounded-2xl px-4 py-3 text-sm font-bold z-50 shadow-lg text-center">
          ✓ {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-on-surface">لوحة الإدارة</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">{users.length} مستخدم</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-gradient-to-l from-primary to-primary-container text-white px-4 py-2.5 rounded-2xl font-bold text-sm shadow-md active:scale-95 transition-transform"
        >
          + مستخدم جديد
        </button>
      </div>

      {/* Create User Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-outline-variant/30 p-5">
          <h3 className="font-bold text-on-surface mb-4">إنشاء مستخدم جديد</h3>
          <form onSubmit={createUser} className="space-y-3">
            <Input
              label="اسم المستخدم"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="مثال: ahmed_chw"
              required
            />
            <div>
              <Input
                label="كلمة المرور المؤقتة"
                value={form.tempPassword}
                onChange={e => setForm(f => ({ ...f, tempPassword: e.target.value }))}
                placeholder="8 أحرف على الأقل وتشمل أرقاماً"
                minLength={8}
                required
              />
              <p className="text-xs text-on-surface-variant mt-1">أخبر المستخدم بهذه الكلمة — سيُطلب منه تغييرها عند أول دخول</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">الصلاحية</label>
              <select
                value={form.group}
                onChange={e => setForm(f => ({ ...f, group: e.target.value }))}
                className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary bg-white"
              >
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            {error && <p className="text-red-600 text-xs bg-red-50 rounded-xl p-3">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={submitting}
                className="flex-1 bg-gradient-to-l from-primary to-primary-container text-white py-3 rounded-xl font-bold text-sm disabled:opacity-60">
                {submitting ? "جاري الإنشاء..." : "إنشاء المستخدم"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setError(""); }}
                className="px-4 py-3 rounded-xl border border-outline-variant text-on-surface-variant text-sm font-medium">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error */}
      {error && !showForm && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Users List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.username} className={`bg-white rounded-2xl shadow-sm border border-outline-variant/30 p-4 ${!u.enabled ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-on-surface">{u.username}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${GROUP_COLORS[u.group] || GROUP_COLORS["—"]}`}>
                      {u.group}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[u.status] || "bg-gray-100 text-gray-500"}`}>
                      {u.status === "CONFIRMED" ? "مفعّل" : u.status === "FORCE_CHANGE_PASSWORD" ? "بانتظار تغيير كلمة المرور" : u.status}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1">
                    أُنشئ: {new Date(u.created).toLocaleDateString("ar-SA")}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Change group */}
                  <select
                    value={u.group}
                    onChange={e => changeGroup(u.username, e.target.value, u.group)}
                    className="text-xs border border-outline-variant rounded-lg px-2 py-1.5 bg-white text-on-surface focus:outline-none focus:border-primary"
                  >
                    {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>

                  {/* Enable/Disable */}
                  <button
                    onClick={() => toggleUser(u.username, u.enabled)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-bold transition ${
                      u.enabled
                        ? "bg-red-50 text-red-600 border border-red-100"
                        : "bg-green-50 text-green-600 border border-green-100"
                    }`}
                  >
                    {u.enabled ? "تعطيل" : "تفعيل"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
