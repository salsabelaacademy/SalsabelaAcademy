export const finalPolishTranslations = {
  en: {
    message_storage_error:"The database could not save your message. Your draft is preserved; the administrator can run the safe storage check.",
    api_endpoint_missing:
      "This API route is missing on the running server. Deploy the matching backend files and restart the app.",
    api_response_invalid:
      "The server returned a page or invalid data instead of API JSON. Check the app address, proxy and running backend.",
    request_timeout:
      "The server took too long to respond. Check connectivity and retry.",
    network_unavailable:
      "The browser could not connect to the server. Check your internet connection and the running app.",
    database_unavailable:
      "The server could not connect to its database. Check DATABASE_URL and database availability.",
    request_forbidden: "This account does not have permission for this action.",
    origin_rejected:
      "The server rejected the page origin. Configure the exact HTTPS app address in the allowed origins; do not disable origin protection.",
    service_unavailable:
      "The server returned an error. Open connection diagnostics and check server logs.",
    diagnostics: "Connection diagnostics",
    diagnosticHint:
      "Safe checks of this running server. No credentials are shown.",
    check_schema: "Database updates",
    check_gemini: "Gemini configuration",
    check_mail: "Email configuration",
    ready: "Ready",
    needsSetup: "Needs setup",
    migrationCommands:
      "Apply the documented dashboard, email and single-report migrations to the correct database, then restart the app.",
    providerUntested:
      "These checks confirm settings and schema only. Provider credentials have not been tested.",

    schema_update_required:
      "The database needs the dashboard update. Ask the academy administrator to apply the documented migrations, then restart the app.",
    session_expired: "Your session has expired. Sign in again.",
    failed: "The service could not be reached. Please try again.",
    ai_credentials:
      "Google rejected the AI request. The administrator should check the API key, model access and project billing or quota.",
    aiSetup:
      "Set GEMINI_API_KEY in the server environment, then restart the running app. No key is entered in this form.",
    missing: "Missing server settings",
    invalidOrigin:
      "FRONTEND_URL must be the public HTTPS address of the academy.",
    personal: "Personal information",
    contact: "Contact and location",
    learning: "Language and lesson times",
    about: "About you",
    photo: "Update portrait",
    account: "Your account",
    details:
      "Keep your details up to date so your lessons and messages reach you correctly.",
    connectionRetry: "Check connection again",
    emailSetup:
      "Verify the sending domain in Resend and restart the app after updating server settings.",
  },
  ar: {
    message_storage_error:"تعذّر حفظ رسالتك في قاعدة البيانات. بقيت مسودتك؛ يمكن للمدير إجراء فحص الحفظ الآمن.",
    api_endpoint_missing:
      "مسار الخدمة غير موجود في الخادم الحالي. ارفع ملفات الخادم المطابقة للتحديث ثم أعد تشغيل التطبيق.",
    api_response_invalid:
      "أعاد الخادم صفحة أو بيانات غير صالحة بدل بيانات الخدمة. راجع عنوان التطبيق وإعدادات الوكيل والخادم الجاري تشغيله.",
    request_timeout: "تأخر الخادم في الرد. راجع الاتصال وحاول مرة أخرى.",
    network_unavailable:
      "لم يستطع المتصفح الوصول إلى الخادم. راجع اتصال الإنترنت وتشغيل التطبيق.",
    database_unavailable:
      "تعذّر اتصال الخادم بقاعدة البيانات. راجع DATABASE_URL وحالة قاعدة البيانات.",
    request_forbidden: "لا يملك هذا الحساب صلاحية تنفيذ الإجراء.",
    origin_rejected:
      "رفض الخادم عنوان الصفحة. أضف عنوان التطبيق HTTPS الصحيح إلى العناوين المسموح بها، ولا تعطّل حماية المصدر.",
    service_unavailable:
      "أعاد الخادم خطأ. افتح تشخيص الاتصال وراجع سجل الخادم.",
    diagnostics: "تشخيص الاتصال",
    diagnosticHint: "فحص آمن للخادم الجاري تشغيله؛ لا تظهر أي مفاتيح.",
    check_schema: "تحديثات قاعدة البيانات",
    check_gemini: "إعداد Gemini",
    check_mail: "إعداد البريد",
    ready: "جاهز",
    needsSetup: "يحتاج إعدادًا",
    migrationCommands:
      "طبّق تحديثات dashboard وemail وsingle-report الموضحة في التقرير على قاعدة البيانات الصحيحة، ثم أعد تشغيل التطبيق.",
    providerUntested:
      "هذا الفحص يؤكد الإعدادات والمخطط فقط؛ لم تُختبر صلاحية المفاتيح لدى موفّر الخدمة.",

    schema_update_required:
      "تحتاج قاعدة البيانات إلى تحديث الداشبورد. على مدير الأكاديمية تنفيذ أوامر التحديث الموضحة في التقرير ثم إعادة تشغيل التطبيق.",
    session_expired: "انتهت جلستك. سجّل الدخول مرة أخرى.",
    failed: "تعذّر الاتصال بالخدمة. حاول مرة أخرى.",
    ai_credentials:
      "رفضت Google طلب المساعد. راجع مفتاح API وإتاحة النموذج والفوترة أو حد الاستخدام في مشروع Google.",
    aiSetup:
      "أضف GEMINI_API_KEY إلى بيئة الخادم ثم أعد تشغيل التطبيق. لا يُكتب المفتاح في هذا النموذج.",
    missing: "إعدادات الخادم الناقصة",
    invalidOrigin:
      "يجب أن يكون FRONTEND_URL عنوان الأكاديمية العام الذي يبدأ بـ HTTPS.",
    personal: "المعلومات الشخصية",
    contact: "التواصل والإقامة",
    learning: "اللغة ومواعيد الحصص",
    about: "نبذة عنك",
    photo: "تحديث الصورة",
    account: "حسابك",
    details: "حدّث بياناتك لتصلك مواعيد الحصص ورسائل الأكاديمية بصورة صحيحة.",
    connectionRetry: "إعادة فحص الاتصال",
    emailSetup:
      "وثّق نطاق الإرسال في Resend وأعد تشغيل التطبيق بعد تحديث إعدادات الخادم.",
  },
};
