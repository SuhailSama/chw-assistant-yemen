import { useState } from 'react';
import { signIn, confirmSignIn } from 'aws-amplify/auth';

// LoginScreen handles two states:
// 1. Normal login (username + password)
// 2. Force-change-password (Cognito requires this on first login for admin-created accounts)
export default function LoginScreen({ onLogin }) {
  const [step, setStep]         = useState('login'); // 'login' | 'new-password'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPass, setNewPass]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await signIn({ username: username.trim(), password });
      if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        // Admin created this account with a temp password — user must set their own
        setStep('new-password');
      } else if (result.isSignedIn) {
        onLogin();
      }
    } catch (err) {
      setError(getArabicError(err.name));
    } finally {
      setLoading(false);
    }
  }

  async function handleNewPassword(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await confirmSignIn({ challengeResponse: newPass });
      if (result.isSignedIn) onLogin();
    } catch (err) {
      setError(getArabicError(err.name));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface to-surface-container flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm">
        {/* Logo / header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-container rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl">🏥</span>
          </div>
          <h1 className="text-2xl font-bold text-on-surface">مساعد العاملين الصحيين</h1>
          <p className="text-on-surface-variant text-sm mt-1">اليمن</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl p-6">
          {step === 'login' ? (
            <>
              <h2 className="text-lg font-bold text-on-surface mb-5">تسجيل الدخول</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-1">اسم المستخدم</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full border border-outline-variant rounded-xl px-4 py-3 text-on-surface bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="أدخل اسم المستخدم"
                    autoComplete="username"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-1">كلمة المرور</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full border border-outline-variant rounded-xl px-4 py-3 text-on-surface bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="أدخل كلمة المرور"
                    autoComplete="current-password"
                    required
                  />
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-l from-primary to-primary-container text-white font-bold py-3 rounded-xl shadow-md disabled:opacity-60"
                >
                  {loading ? 'جاري التحقق...' : 'دخول'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-on-surface mb-2">تغيير كلمة المرور</h2>
              <p className="text-sm text-on-surface-variant mb-5">هذه أول مرة تدخل — يرجى تعيين كلمة مرور جديدة</p>
              <form onSubmit={handleNewPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-1">كلمة المرور الجديدة</label>
                  <input
                    type="password"
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    className="w-full border border-outline-variant rounded-xl px-4 py-3 text-on-surface bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="8 أحرف على الأقل، تشمل أرقاماً"
                    minLength={8}
                    required
                  />
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-l from-primary to-primary-container text-white font-bold py-3 rounded-xl shadow-md disabled:opacity-60"
                >
                  {loading ? 'جاري الحفظ...' : 'حفظ وتسجيل الدخول'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-on-surface-variant mt-6 opacity-60">
          للمساعدة تواصل مع المشرف
        </p>
      </div>
    </div>
  );
}

// Translate Cognito error codes to Arabic
function getArabicError(name) {
  const map = {
    NotAuthorizedException:      'اسم المستخدم أو كلمة المرور غير صحيحة',
    UserNotFoundException:        'هذا المستخدم غير موجود',
    UserNotConfirmedException:    'الحساب لم يُفعَّل بعد — تواصل مع المشرف',
    PasswordResetRequiredException: 'كلمة المرور منتهية — تواصل مع المشرف',
    TooManyRequestsException:    'محاولات كثيرة جداً — انتظر دقيقة وحاول مجدداً',
    InvalidPasswordException:    'كلمة المرور ضعيفة — يجب 8 أحرف على الأقل وتشمل أرقاماً',
    LimitExceededException:      'تجاوزت عدد المحاولات المسموح بها — حاول لاحقاً',
  };
  return map[name] || 'خطأ غير متوقع — حاول مرة أخرى';
}
