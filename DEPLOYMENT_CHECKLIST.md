# Deployment Checklist — قائمة التحقق من النشر

## 1. AWS IAM & Permissions — أذونات AWS
- [ ] Create an IAM user for GitHub Actions with programmatic access.
- [ ] Attach `AmazonS3FullAccess`, `CloudFrontFullAccess`, `AWSLambda_FullAccess`, and `AmazonSSMFullAccess` (or restrictive policies for production).
- [ ] قم بإنشاء مستخدم IAM لـ GitHub Actions مع وصول برمجي.
- [ ] امنح الأذونات اللازمة لـ S3 و CloudFront و Lambda و SSM.

## 2. Environment Variables & Secrets — المتغيرات والسرّيات
- [ ] Set GitHub Secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`, `CLOUDFRONT_DISTRIBUTION_ID`, `LAMBDA_FUNCTION_NAME`.
- [ ] Create `ANTHROPIC_API_KEY` and `ALLOWED_ORIGIN` in **AWS SSM Parameter Store** (SecureString).
- [ ] تعيين أسرار GitHub Secrets المطلوبة.
- [ ] إضافة `ANTHROPIC_API_KEY` و `ALLOWED_ORIGIN` في مخزن معلمات SSM (SecureString).

## 3. Deployment & Testing — النشر والاختبار
- [ ] Run `npm run build:lambda` and check if `lambda.zip` is created.
- [ ] Apply Terraform: `terraform init` -> `terraform apply`.
- [ ] Test Lambda endpoint:
  ```bash
  curl -X POST https://<api-gateway-url>/prod/v1/messages \
    -H "Content-Type: application/json" \
    -d '{"model":"claude-sonnet-4-20250514","messages":[{"role":"user","content":"test"}]}'
  ```
- [ ] تحقق من إنشاء `lambda.zip`.
- [ ] تنفيذ Terraform لنشر البنية التحتية.
- [ ] اختبر نقطة نهاية Lambda باستخدام `curl`.

## 4. Verification & Smoke Test — التحقق واختبار التشغيل
- [ ] Verify PWA: Open CloudFront URL on Android Chrome -> "Add to Home Screen".
- [ ] Verify Disclaimer Screen appears on first launch.
- [ ] Test Patient Intake: Fill name, age, complaint, symptoms.
- [ ] Test Diagnosis: Ensure AI returns a result (uses Lambda proxy).
- [ ] Test Logs: Ensure Referral and Visit logs persist in browser storage.
- [ ] تحقق من PWA: افتح رابط CloudFront على Chrome أندرويد وأضف للشاشة الرئيسية.
- [ ] تحقق من شاشة إخلاء المسؤولية عند أول تشغيل.
- [ ] اختبر إدخال مريض جديد وتشخيص الذكاء الاصطناعي.
- [ ] اختبر سجلات الإحالة والزيارات.

## 5. Domain (Optional) — النطاق (اختياري)
- [ ] Create an AWS Certificate Manager (ACM) cert in `us-east-1` (for CloudFront).
- [ ] Map custom domain in Route53 to CloudFront distribution.
- [ ] إنشاء شهادة ACM في منطقة `us-east-1` لـ CloudFront.
- [ ] ربط النطاق في Route53 بتوزيع CloudFront.
