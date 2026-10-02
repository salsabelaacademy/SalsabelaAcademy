# تفعيل Zoom وGoogle بعد نقل سلسبيلا

هذه الخطوات تُنفّذ على حساباتك عند جاهزيتها. الاختبارات البرمجية تستخدم ردودًا محاكية داخل الاختبارات فقط، ولا تثبت نجاح ربط حساب إنتاجي لم تضف مفاتيحه.

## Zoom خطوة بخطوة

1. افتح https://marketplace.zoom.us/ وسجّل الدخول بحساب مالك الأكاديمية.
2. من Develop / Build App اختر **Server-to-Server OAuth** لإدارة حسابك نفسه. لا تختَر Meeting SDK أو JWT القديم.
3. سمّه Salsabela Academy، وأكمل معلومات المالك/المطوّر والبريد المطلوب.
4. من App Credentials انسخ **Account ID** إلى `ZOOM_ACCOUNT_ID`، و**Client ID** إلى `ZOOM_CLIENT_ID`، و**Client Secret** إلى `ZOOM_CLIENT_SECRET` في أسرار الخادم فقط.
5. في Scopes أضف الصلاحيات الدقيقة الآتية:

| Scope | العملية الفعلية |
| --- | --- |
| `meeting:write:meeting:admin` | إنشاء اجتماع |
| `meeting:update:meeting:admin` | تعديل الموعد دون إنشاء اجتماع آخر |
| `meeting:delete:meeting:admin` | إلغاء الاجتماع |
| `meeting:read:list_meetings:admin` | المصالحة بعد فقد رد الإنشاء لمنع التكرار |
| `meeting:read:meeting:admin` | فحص الاجتماع واستعادة معرّفه ورابط بدء المالك |
| `user:read:user:admin` | اختبار حساب المضيف |

6. فعّل التطبيق من Activation. ضع بريد المضيف/معرّفه داخل الحساب نفسه في `ZOOM_HOST_USER_ID`.
7. أضف `INTEGRATION_ENCRYPTION_KEY` و`FRONTEND_URL` بحسب دليل النشر، ثم أعد تشغيل الخادم.
8. ادخل كمسؤول إلى `/admin/integrations` أو `/ar/admin/integrations`، واختر Zoom → Connect ثم Test connection.
9. أنشئ درس اختبار لبياناتك المصرح بها، راقب المهمة حتى النجاح، ثم افحصه داخل Zoom. أعد الجدولة وتأكد من ثبات معرّف الاجتماع، ثم ألغِه وتحقق من الإلغاء.

لا يحتاج هذا التطبيق Redirect URI أو Webhook URL في Zoom؛ لا توجد webhooks مفعلة. التعديل المباشر داخل Zoom لا يُستورد تلقائيًا للموقع. قيود الترخيص وعدد/مدة الاجتماعات يحددها حساب Zoom.

رابط بدء المضيف يُسترجع عند ضغط المسؤول على بدء الاجتماع فقط؛ لا يُحفظ في القوائم ولا يُرسل للطالب. لا يمكن تشغيل Zoom للمضيف دون أن يصل رابط البدء إلى متصفحه هو، لكنه ليس مفتاح API ولا يُتاح للطلاب. إذا ضاع رد إنشاء اجتماع، يتوقف المسار الغامض للمراجعة بدل إنشاء نسخة ثانية، ويمكن للمسؤول اعتماد معرّف اجتماع مطابق بعد فحص العلامة.

المراجع: https://developers.zoom.us/docs/internal-apps/create/ وhttps://developers.zoom.us/docs/integrations/oauth-scopes-granular/ .

## Google Cloud خطوة بخطوة

1. افتح https://console.cloud.google.com/ بحساب الأكاديمية وأنشئ مشروعًا مخصصًا.
2. من APIs & Services → Library فعّل **Google Calendar API** و**Google Classroom API** و**Google Drive API**.
3. افتح Google Auth Platform / OAuth consent screen وأدخل اسم الأكاديمية وبريد الدعم وبريد المطوّر والنطاق المصرح به `salsabela.com`.
4. استخدم Internal فقط إذا كان حساب Workspace وسياسات المؤسسة تسمح بذلك. وإلا اختر External، وأضف حساب المسؤول إلى Test users خلال الاختبار.
5. جهّز رابط صفحة رئيسية وسياسة خصوصية حقيقية مطابقة لممارسات الأكاديمية. لا تضع رابط سياسة فارغة لمجرد تجاوز فحص Google؛ نشر سياسة الخصوصية واعتماد محتواها يبقى مسؤولية المالك قبل طلب اعتماد التطبيق.
6. في Data Access أضف النطاقات المطلوبة أدناه فقط.
7. في Credentials / Clients اختر Create OAuth client ID → **Web application**.
8. أضف Authorized redirect URI التالي حرفيًا:

   `https://salsabela.com/api/integrations/google/callback`

   للمحلي يمكن إضافة `http://localhost:5000/api/integrations/google/callback`. ولمعاينة Replit أضف أصل HTTPS الحقيقي للمعاينة متبوعًا بالمسار نفسه، واضبط FRONTEND_URL لذلك الأصل أثناء المعاينة. لا تضف `dashboard.salsabela.com` callback؛ المصادقة تبقى على الأصل الأساسي.
9. انسخ Client ID وClient Secret إلى `GOOGLE_CLIENT_ID` و`GOOGLE_CLIENT_SECRET`. لا تحتاج JavaScript OAuth client في الواجهة لهذا التنفيذ.
10. أضف مفتاح التشفير الثابت، وأعد تشغيل الخادم.
11. وأنت مسجّل كمسؤول في الأكاديمية، افتح صفحة التكاملات واربط Calendar وClassroom وDrive كلًا على حدة بالحساب نفسه. اطلب فقط صلاحيات الخدمة التي توصلها.
12. شغّل Test connection. جرّب درسًا وتقويمًا حقيقيين عند جاهزيتك؛ حساب الاختبار يجب أن يكون مصرحًا لك باستخدامه.
13. قبل الإطلاق راجع متطلبات Google Verification وPublishing Status للصلاحيات المختارة؛ وضع Testing ليس حلًا دائمًا وقد تنتهي صلاحية منح refresh token وفق إعداد الحساب والصلاحيات.

| الصلاحية الكاملة | السبب |
| --- | --- |
| `https://www.googleapis.com/auth/calendar.events.owned` | إنشاء/تعديل/إلغاء أحداث التقويم المملوك للحساب |
| `https://www.googleapis.com/auth/classroom.courses.readonly` | عرض الدورات والتحقق من هوية المقرر |
| `https://www.googleapis.com/auth/classroom.rosters` | فحص عضوية المقرر وإرسال دعوة طالب مقبول ونشط |
| `https://www.googleapis.com/auth/drive.metadata.readonly` | فحص بيانات الملف وصلاحياته قبل إتاحته |

لا توجد Gmail scopes أو domain-wide delegation. صلاحية Drive للبيانات الوصفية أوسع من ملف منفرد لأن الإدخال بمعرّف ملف موجود، لكنها لا تتيح تنزيل المحتوى أو تغيير المشاركة. Google قد يطلب التحقق من هذا النطاق.

## Classroom وDrive: ما يحتاج عملًا منك

- استخدم مقررات يملكها/يدرّسها حساب Google الخاص بمالك الأكاديمية. لا يوجد حساب معلم مستقل في منصتنا.
- اربط تسجيل طالب نشط في برنامج بمقرر، ثم أرسل دعوته. تظهر **Invited** إلى أن يؤكد Google العضوية؛ صاحب الأكاديمية لا يستطيع الموافقة بدل الطالب.
- لإزالة عضوية Google Classroom نهائيًا استخدم Google نفسه؛ حذف الوصول داخل الموقع ليس بديلًا عن تغيير عضوية المزود.
- في Drive اجعل المشاركة **Restricted** وامنح بريد الطالب وصولًا مباشرًا. أرفق المورد بوحدة منهج، ثم عيّنه لتسجيل الطالب في البرنامج نفسه.
- تُرفض الملفات العامة أو المشاركة عبر مجموعة/نطاق في مسار الموارد الخاصة. كل طلب فتح يعيد فحص التخصيص والصلاحية المباشرة.
- إزالة التخصيص تمنع فتحه من المنصة، لكنها لا تلغي مشاركة موجودة في Google أو نسخة سبق تنزيلها. أزل إذن المشاركة من Drive عند الحاجة؛ التطبيق لا يطلب صلاحية تعديل المشاركة.
- فصل إحدى خدمات Google يحذف المنح المحلية للخدمات الثلاث لأن إلغاء Google للمنحة قد يؤثر في التطبيق كله. أعد ربط الخدمات المطلوبة.

مرجع OAuth الرسمي: https://developers.google.com/identity/protocols/oauth2/web-server . التفاصيل الفنية لسلوك المصالحة والمهام محفوظة أيضًا في `docs/integration-operations.md`.
