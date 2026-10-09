# تركيب تحديث المحادثات والتشخيص

اقرأ التقرير والخطوات الكاملة في docs/messenger-completion-and-runtime-check-ar.md.

- انسخ الملفات المطابقة للنسخة المرفقة، واحتفظ بقاعدة البيانات وSecrets.
- من مجلد package.json: npm ci ثم npm run check ثم npm run lint ثم npm run build.
- أوقف العملية القديمة وأعد تشغيل npm run dev للمعاينة أو npm start للإنتاج.
- افحص: npm run api:check -- https://YOUR-CURRENT-APP-HOST
- 401 لمساري التشخيص دون تسجيل دخول متوقع؛ 404 ليس متوقعًا.
- لا توجد ترحيلات SQL جديدة أو ملفات مطلوب حذفها لهذا التعديل.
- اختبر مفاتيح Gemini والبريد على خادمك؛ الاختبارات المرفقة لا تتصل بمزودين حقيقيين.
