# Deployment Checklist — قائمة التحقق من النشر

## 1. Supabase — قاعدة البيانات والمصادقة
- [x] Project created, schema applied (`supabase/migrations`), edge functions deployed.
- [ ] Add the secret `GEMINI_API_KEY` under Edge Functions → Secrets (key from Google AI Studio).
- [ ] Create the first admin: Authentication → Users → Add user, email `<username>@chw-assistant.local`, tick "Auto Confirm User".
- [ ] Promote that user in the SQL editor:
  ```sql
  update auth.users
  set raw_app_meta_data = raw_app_meta_data || '{"username":"<username>","role":"Admin"}'
  where email = '<username>@chw-assistant.local';
  ```
- [ ] أضف المفتاح السري `GEMINI_API_KEY` في إعدادات Edge Functions.
- [ ] أنشئ أول مستخدم مدير من لوحة Supabase ثم امنحه صلاحية Admin.

## 2. GitHub Pages — الاستضافة
- [ ] Repo Settings → Pages → Source: **GitHub Actions**.
- [ ] Merge to `main` (or run the "Deploy Pipeline" workflow manually).
- [ ] فعّل GitHub Pages من إعدادات المستودع واختر "GitHub Actions" كمصدر.

## 3. Verification & Smoke Test — التحقق واختبار التشغيل
- [ ] Verify PWA: open the Pages URL on Android Chrome → "Add to Home Screen".
- [ ] Verify Disclaimer Screen appears on first launch.
- [ ] Log in as admin, create a CHW, log in as the CHW and set a new password.
- [ ] Test Diagnosis: ensure AI returns a result.
- [ ] Test Logs: add a visit in airplane mode, reconnect, confirm it appears in the supervisor view.
- [ ] تحقق من PWA: افتح الرابط على Chrome أندرويد وأضف للشاشة الرئيسية.
- [ ] تحقق من شاشة إخلاء المسؤولية عند أول تشغيل.
- [ ] اختبر إنشاء مستخدم جديد وتغيير كلمة المرور عند أول دخول.
- [ ] اختبر التشخيص وسجلات الإحالة والزيارات بدون اتصال ثم مع الاتصال.

## 4. Keep-Alive — منع الإيقاف التلقائي
- [ ] Confirm the "Supabase Keep-Alive" workflow is enabled in the Actions tab.
- [ ] تأكد من تفعيل مهمة Keep-Alive في تبويب Actions.
