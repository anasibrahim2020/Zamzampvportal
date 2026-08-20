/* ══════════════════════════════════════════
   i18n — عربي / English
   المفتاح هو النص العربي نفسه، والقيمة هي الترجمة الإنجليزية.
   لو مفيش ترجمة لنص، بيرجع العربي زي ما هو (fallback آمن).
══════════════════════════════════════════ */
const LANG_KEY = 'zamzam_lang';
let LANG = 'ar';
try{ LANG = localStorage.getItem(LANG_KEY) || 'ar'; }catch(e){ LANG = 'ar'; }

const I18N_EN = {
  'جاري تجهيز الملف...':'Preparing the file…',
  'تعذّر تجهيز ملف الطلب.':'Could not prepare the request file.',
  // رسائل تشخيص رفع المرفقات
  'تعذّر الوصول إلى خادم التخزين':'Could not reach the storage server',
  'لم يصل الطلب إلى الخادم من الأساس، والسبب غالبًا أحد الآتي:':'The request never reached the server. The cause is most likely one of the following:',
  '• انقطاع الاتصال بالإنترنت أثناء الرفع.':'• The internet connection dropped during the upload.',
  '• حجب شبكة المكتب أو الجدار الناري للنطاق supabase.co':'• The office network or firewall is blocking the supabase.co domain.',
  '• إضافة في المتصفح تمنع الطلبات (مانع الإعلانات أو حماية الخصوصية).':'• A browser extension is blocking the request (an ad blocker or privacy guard).',
  'جرّب من شبكة أخرى أو من بيانات الهاتف للتأكد.':'Try another network, or your phone’s mobile data, to confirm.',
  'الخادم رفض الرفع لعدم وجود صلاحية':'The server refused the upload for lack of permission',
  'سياسات التخزين تحتاج مراجعة، أو انتهت جلسة الدخول. سجّل الخروج والدخول مرة أخرى، فإن استمرت المشكلة فالمطلوب ضبط سياسات Storage.':'The storage policies need review, or your session has expired. Sign out and back in; if the problem persists, the Storage policies must be configured.',
  'حجم الملف أكبر من الحد المسموح به':'The file exceeds the maximum allowed size',
  'اضغط الملف أو ارفعه بجودة أقل ثم أعد المحاولة.':'Compress the file or upload it at a lower quality, then try again.',
  'نوع الملف غير مقبول':'The file type is not accepted',
  'المسموح: ملفات PDF والصور فقط.':'Only PDF files and images are allowed.',
  'مساحة التخزين غير موجودة على الخادم.':'The storage space does not exist on the server.',
  'يلزم إنشاء bucket باسم request-attachments في Supabase Storage.':'A bucket named request-attachments must be created in Supabase Storage.',
  'يوجد ملف بنفس الاسم بالفعل':'A file with the same name already exists',
  'أعد المحاولة، وسيُحفظ باسم جديد.':'Try again and it will be saved under a new name.',
  'تعذّر رفع الملف':'Could not upload the file',
  'تفاصيل الخطأ:':'Error details:',
  'تعذّر رفع المرفقات':'Could not upload the attachments',
  'فعّل إشعارات الطلبات':'Enable request notifications',
  'يصلك إشعار فوري على جهازك عند كل حدث يخصّك، حتى والبوابة مغلقة.':'Get an instant notification on your device for anything that concerns you, even with the portal closed.',
  'طلب جديد بانتظار اعتمادك':'A new request awaiting your approval',
  'اعتماد طلبك وتحويله':'Your request approved and transferred',
  'تعليق جديد على طلب':'A new comment on a request',
  'يمكنك إيقافها في أي وقت من إعدادات المتصفح.':'You can turn them off any time in your browser settings.',
  'تفعيل الإشعارات':'Enable notifications',
  'ليس الآن':'Not now',
  'تم تفعيل الإشعارات':'Notifications enabled',
  'سيصلك إشعار على هذا الجهاز عند كل حدث يخصّك.':'This device will now receive notifications that concern you.',
  'لاستقبال إشعارات الطلبات على iPhone، يلزم إضافة البوابة إلى الشاشة الرئيسية أولاً.':'To receive notifications on iPhone, add the portal to your Home Screen first.',
  'الخطوة ١':'Step 1',
  'الخطوة ٢':'Step 2',
  'الخطوة ٣':'Step 3',
  'افتح قائمة المشاركة في Safari':'Tap the Share button in Safari',
  'اختر «إضافة إلى الشاشة الرئيسية»':'Choose "Add to Home Screen"',
  'افتح البوابة من الأيقونة الجديدة':'Open the portal from the new icon',
  'سيظهر بعدها طلب تفعيل الإشعارات.':'The enable prompt will appear after that.',
  'المحاسب':'Accountant',
  'الموظف':'Employee',
  'الإشعارات':'Notifications',
  'تحديد الكل كمقروء':'Mark all as read',
  'لا توجد إشعارات':'No notifications',
  'تم اعتماد طلبك':'Your request was approved',
  'تعليق جديد':'New comment',
  'اضغط للتوقيع':'Click to sign',
  'مقدّم':'By',
  'تعديل طلب قائم':'Editing an existing request',
  'عرض فقط':'View only',
  'مقدّم الطلب':'Requester',
  'جاهزة للتحويل':'Ready for transfer',
  'طلبات موقّعة لم تُعتمد بعد':'Signed, awaiting approval',
  'طلبات معتمدة لم تُحوّل بعد':'Approved, awaiting transfer',
  'طلبات قيد التنفيذ':'Requests in progress',
  'طلبات محوّلة':'Transferred requests',
  'أحدث التحويلات':'Most recent transfers',
  'هذا الطلب من إنشاء موظف آخر — متاح للعرض والطباعة والاعتماد فقط، ولا يمكن تعديله.': 'This request was created by another employee — view, print and approve only; it cannot be edited.',
  'هذا الطلب من إنشاء موظف آخر ولا يمكن تعديله. يمكنك عرضه وطباعته واعتماده فقط.': 'This request was created by another employee and cannot be edited. You may view, print and approve it.',
  'هذا الطلب ملغي — متاح للعرض والطباعة فقط.': 'This request is cancelled — view and print only.',
  /* ── تسجيل الدخول والهيدر ── */
  'زمزم للحج والعمرة · Zamzam':'Zamzam Hajj & Umrah',
  'زمزم للحج والعمرة':'Zamzam Hajj & Umrah',
  'زمزم للحج والعمرة · Zamzam Hajj &amp; Umrah':'Zamzam Hajj &amp; Umrah',
  'زمزم للحج والعمرة · Zamzam Hajj & Umrah':'Zamzam Hajj & Umrah',
  'اسم المستخدم · Username':'Username',
  'كلمة المرور · Password':'Password',
  'دخول · Login':'Login',
  'أدخل اسم المستخدم':'Enter your username',
  'أدخل كلمة المرور':'Enter your password',
  'اسم المستخدم أو كلمة المرور غير صحيحة':'Incorrect username or password',
  'خروج · Logout':'Logout',
  'جاري الدخول...':'Signing in...',
  'خطأ اتصال بالسيرفر — حاول تاني':'Connection error — please try again',
  'الإعداد غير مكتمل — يلزم إضافة بيانات Supabase أولاً (راجع دليل الإعداد).':'Setup incomplete — Supabase credentials are required first (see the setup guide).',

  /* ── التنقّل ── */
  'طلب صرف':'Payment Request',
  'طلب إلغاء واسترداد':'Cancellation / Refund',
  'إدارة الطلبات':'Requests Management',

  /* ── أزرار المستند ── */
  'مسح':'Clear',
  'توقيع إلكتروني':'e-Signature',
  'طباعة':'Print',
  'تقديم الطلب':'Submit Request',
  'إضافة فاتورة مورّد':'Add Supplier Invoice',
  'إضافة فاتورة عميل':'Add Client Invoice',
  'فاتورة عامة':'General Invoice',
  'اضغط لإرفاق الفواتير':'Click to attach invoices',
  'تعطيل مطابقة مركز التكلفة للفاتورة العامة':'Disable cost-center matching for a general invoice',
  'مثال: طباعة':'e.g. Printing',
  'اعتماد الحسابات':'Approve (Accounts)',

  /* ── رؤوس المستندات ── */
  'نموذج طلب صرف':'Payment Request',
  'طلب إلغاء فاتورة / استرجاع':'Invoice Cancellation / Refund Request',
  'هذا الطلب وثيقة رسمية · Official Document':'Official Document',
  'التاريخ · Date':'Date',
  'رقم الطلب · Request No.':'Request No.',

  /* ── حقول النماذج (المطابقة للنسخة الإنجليزية الموجودة) ── */
  'رقم الفاتورة المراد إلغاؤها':'Invoice Ref. No.',
  'رقم الموبايل':'Mobile No.',
  'بنود الإلغاء':'Cancellation Allocation',
  'تقرير الإلغاء':'Cancellation Report',
  'رقم الهاتف للتحويل الفوري':'Fawran Mobile No.',
  'رقم الآيبان (IBAN)':'Bank IBAN',
  'ملاحظات / توصية':'Notes / Recommendation',
  'توقيع العميل':'Customer Signature',
  'توقيع العميل (يُوقّع عند الاستلام)':'Customer signature (signed on receipt)',
  '✓ تم التوقيع إلكترونيًا':'✓ ELECTRONICALLY SIGNED',
  'مقدم الطلب — المبيعات':'Requested By · Sales',
  '✓ معتمد — إدارة الحسابات':'✓ APPROVED · ACCOUNTS',
  'اعتماد المحاسب':'Accounts Dept.',
  'الشروط والأحكام':'Terms & Conditions',
  'اسم مقدم الطلب':'Requester Name',
  'القسم':'Department',
  'المشروع':'Project',
  'فواتير المورّد المرفقة':'Supplier Invoices',
  'مركز التكلفة':'Cost Center',
  'إجمالي المبلغ المطلوب صرفه':'Total Amount to Pay',
  'مرفقات':'Attachments',
  'مقدم الطلب':'Requested By',
  'إدارة الحسابات':'Accounts Dept.',
  'لم يتم التوقيع بعد':'Not signed yet',
  'بانتظار اعتماد الحسابات':'Awaiting accounts approval',
  'حساب العميل المستفيد (لصرف المبلغ المسترجع)':'Beneficiary Account for Refund',
  'رقم فاتورة العميل':'Client Invoice No.',
  'الرجاء إلغاء الفاتورة وإرجاع المبلغ المستحق ...':'Please cancel the invoice and refund the due amount ...',

  /* ── بنود الإلغاء ── */
  'تذاكر':'Tickets',
  'تأشيرة':'Visa',
  'فنادق':'Hotels',
  'مواصلات':'Transportation',
  'باقة سياحية':'Tours Package',
  'باقة حج':'Hajj Package',
  'باقة عمرة':'Umrah Package',
  'أخرى':'Other',
  'إلغاء الفاتورة بالكامل':'Full Invoice Cancellation',
  'تحويل فوراً':'Fawran / Instant Transfer',
  'حساب بنكي':'Bank Account',
  'البند · Description':'Description',
  'المبلغ المسترجع (ر.ق) · Refund Amount':'Refund Amount (QAR)',
  'تذاكر · Tickets':'Tickets',
  'تأشيرة · Visa':'Visa',
  'فنادق · Hotels':'Hotels',
  'مواصلات · Transportation':'Transportation',
  'باقة سياحية · Tours Package':'Tours Package',
  'باقة حج · Hajj Package':'Hajj Package',
  'باقة عمرة · Umrah Package':'Umrah Package',
  'أخرى · Other':'Other',
  'الإجمالي · Total':'Total',
  'إجمالي مركز التكلفة · Total Cost Center':'Total Cost Center',

  /* ── جداول الفواتير ── */
  'المورّد':'Supplier',
  'رقم الفاتورة':'Invoice No.',
  'المبلغ (ر.ق)':'Amount (QAR)',
  'نصيب الفاتورة من فاتورة المورّد (ر.ق)':'Share of Supplier Invoice (QAR)',
  'اسم المورّد':'Supplier name',
  'رقم فاتورة العميل - ‎Odoo':'Client Invoice No. - Odoo',
  'إجمالي كل الصفوف · All Rows Total':'All Rows Total',
  'إجمالي كل صفوف مركز التكلفة · All Rows Total':'Cost Center — All Rows Total',

  /* ── الشروط والأحكام ── */
  'تُطبع الشروط والأحكام على ظهر الورقة (صفحة مستقلة) · Printed on the back side':'Terms & Conditions are printed on the back side (separate page)',
  'تطبق الشروط الإضافية المتعلقة بحجوزات الفنادق والمواصلات في سند الحجز.':'Additional terms relating to hotel and transportation bookings apply as stated in the booking voucher.',
  'حجوزات أوقات الذروة (المواسم والعطلات والإجازات الرسمية) غير قابلة للإلغاء، ويمكن التغيير قبل عشرة أيام أو أكثر من موعد السفر مع خصم 50% إذا كان التغيير خلال فترة أقل من ذلك.':'Peak-season bookings (high seasons, holidays and official vacations) are non-cancellable. Changes are permitted ten days or more before the travel date; changes made within a shorter period are subject to a 50% deduction.',
  'حجوزات موسم العمرة (من منتصف شعبان حتى نهاية رمضان) غير قابلة للتغيير أو الإلغاء ولا يمكن استرداد المبلغ.':'Umrah-season bookings (from mid-Sha\'ban until the end of Ramadan) are non-changeable, non-cancellable and non-refundable.',
  'يُصرف الشيك باسم صاحب الفاتورة بعد استرداد المبالغ من الجهات المختصة، ويسقط حق المطالبة بعد مرور ستة أشهر من تاريخ الفاتورة.':'The cheque is issued in the invoice holder\'s name after the amounts are recovered from the relevant parties. The right to claim lapses six months after the invoice date.',
  'في حالة سداد العميل بالبطاقات البنكية يتم خصم المصروفات البنكية من المبلغ المسترجع.':'If the customer paid by bank card, the bank charges are deducted from the refunded amount.',

  /* ── إدارة الطلبات — الجدول ── */
  'تحديث':'Refresh',
  'تحديث الأرشيف':'Refresh requests',
  'تحويل مجمّع':'Grouped Transfer',
  'ربط أكثر من طلب بإثبات تحويل واحد':'Link several requests to a single transfer proof',
  'الكل':'All',
  'طلبات الصرف':'Payment Requests',
  'طلبات الإلغاء والاسترداد':'Cancellation / Refund',
  'المُلغاة / المسحوبة':'Cancelled / Withdrawn',
  'بحث باسم الموقّع أو مقدم الطلب أو المورد أو رقم الطلب ...':'Search by signer, requester, supplier or request no. ...',
  'فلتر بتاريخ تقديم الطلب':'Filter by submission date',
  'بيانات الطلب':'Request Details',
  'تفاصيل الدفع':'Payment Details',
  'المراجعة':'Review',
  'المرفقات والإجراءات':'Files & Actions',
  'سجل الطلب':'History',
  'رقم الطلب':'Request No.',
  'النوع':'Type',
  'التاريخ':'Date',
  'رقم الفاتورة / المورّد':'Invoice No. / Supplier',
  'المبلغ':'Amount',
  'التوقيع':'Signature',
  'الاعتماد':'Approval',
  'تعليقات':'Comments',
  'إثبات التحويل':'Transfer Proof',
  'المرفقات':'Attachments',
  'إجراءات':'Actions',
  'التوقيت':'Time',
  '— اضغط تحديث لعرض الطلبات —':'— Press Refresh to load requests —',
  'لا توجد طلبات':'No requests found',
  'جاري التحميل...':'Loading...',
  '— الأرشيف غير مفعّل —':'— Archive is not enabled —',

  /* ── شارات وحالات ── */
  '<span class="badge cancel-doc">إلغاء</span>':'<span class="badge cancel-doc">Cancel</span>',
  '<span class="badge disb-doc">صرف</span>':'<span class="badge disb-doc">Payment</span>',
  '<span class="badge unsigned">غير موقّع</span>':'<span class="badge unsigned">Unsigned</span>',
  ' <span class="badge cancel-doc">ملغى</span>':' <span class="badge cancel-doc">Cancelled</span>',
  '<span style="color:#d9415f;font-size:11px;font-weight:700">ملغى</span>':'<span style="color:#d9415f;font-size:11px;font-weight:700">Cancelled</span>',
  'الحالة: بانتظار اعتماد الحسابات':'Status: awaiting accounts approval',
  'لم يعتمد بعد':'Not approved yet',
  'إثبات التحويل — تم التحويل':'Transfer proof — transferred',
  'رفع إثبات التحويل':'Upload transfer proof',
  'عرض توقيت الطلب':'Show request timeline',
  'سجل التوقيت':'Timeline',
  'وقت التوقيع':'Signed at',
  'وقت الاعتماد':'Approved at',
  'معتمد بواسطة':'Approved by',
  'الموقّع':'Signed by',

  /* ── قوائم الإجراءات ── */
  'إجراءات الطلب':'Request actions',
  'عرض الطلب':'View request',
  'طباعة الطلب':'Print request',
  'تنزيل الطلب PDF':'Download request PDF',
  'تعديل الطلب':'Edit request',
  'إلغاء الاعتماد':'Revoke approval',
  'إلغاء الطلب':'Cancel request',
  'عرض المرفقات':'View attachments',
  'تنزيل الكل PDF':'Download all as PDF',
  'طباعة الكل PDF':'Print all as PDF',
  'معاينة':'Preview',
  'تنزيل':'Download',
  'حذف':'Delete',
  'تعليقات الطلب':'Request comments',
  'عرض طلبات المجموعة':'Show group requests',
  'حذف الإثبات من هذا الطلب':'Remove proof from this request',
  'حذف الإثبات من كل المجموعة':'Remove proof from the whole group',
  'عدد الطلبات':'Requests count',
  'إجمالي المجموعة':'Group total',
  'مرجع التحويل':'Transfer reference',
  'رقم المجموعة':'Group No.',
  'مجموعة التحويل':'Transfer group',
  'إجمالي المبلغ':'Total amount',
  'تحويل مجمّع — اضغط لعرض طلبات المجموعة':'Grouped transfer — click to show the group requests',
  'تحديد الطلب لتحويل مجمّع':'Select request for a grouped transfer',
  'تحديد كل المعروض':'Select all shown',
  'إلغاء تحديد الكل':'Clear selection',
  'إنهاء':'Done',
  'رفع إثبات تحويل مجمّع':'Upload grouped transfer proof',
  'طلب محدد · إجمالي':'selected · total',
  'إلغاء الفلتر':'Clear filter',
  'مجموعة تحويل':'Transfer group',
  'طلبات':'requests',
  'طلبات بتحويل واحد · إجمالي':'requests in one transfer · total',
  'مرجع:':'Ref:',
  'ر.ق':'QAR',

  /* ── نافذة التحويل المجمّع ── */
  'تحويل مجمّع — إثبات واحد لعدة طلبات':'Grouped transfer — one proof for several requests',
  'إجمالي المبلغ المحوّل':'Total transferred',
  'مرجع التحويل / ملاحظة (اختياري)':'Transfer reference / note (optional)',
  'مثال: تحويل بنكي رقم 123456':'e.g. Bank transfer no. 123456',
  'اضغط لاختيار إثبات التحويل':'Click to choose the transfer proof',
  'صورة أو PDF — بحد أقصى 2 ميجابايت':'Image or PDF — 2 MB max',
  'اضغط للتغيير':'Click to change',
  'رفع الإثبات للكل':'Upload proof for all',
  'الملف أكبر من 2 ميجابايت':'File is larger than 2 MB',
  'اختر ملفاً أصغر':'Choose a smaller file',
  '<b style="color:#d9415f">الملف أكبر من 2 ميجابايت</b><small>اختر ملفاً أصغر</small>':'<b style="color:#d9415f">File is larger than 2 MB</b><small>Choose a smaller file</small>',
  'اختر طلبين على الأقل':'Select at least two requests',
  'التحويل المجمّع بيربط أكتر من طلب بإثبات تحويل واحد. حدّد طلبين أو أكتر.':'A grouped transfer links more than one request to a single transfer proof. Please select two or more requests.',
  'تم إنشاء التحويل المجمّع':'Grouped transfer created',
  'تم ربط الطلبات المحددة بإثبات تحويل واحد، وأُرسل إشعار لأصحاب الطلبات.':'The selected requests were linked to a single transfer proof, and their owners have been notified.',
  'جاري رفع إثبات التحويل وربط الطلبات...':'Uploading the transfer proof and linking requests...',
  'تعذّر إتمام التحويل المجمّع':'Could not complete the grouped transfer',
  'حصل خطأ أثناء رفع الإثبات أو ربط الطلبات. تحقّق من الاتصال وحاول مرة أخرى.':'An error occurred while uploading the proof or linking the requests. Check your connection and try again.',
  'حذف التحويل المجمّع':'Delete grouped transfer',
  'سيتم حذف إثبات التحويل من جميع طلبات المجموعة وفكّ ارتباطها. لن تتأثر الطلبات نفسها، ويمكن رفع إثبات جديد لاحقًا.':'The transfer proof will be removed from every request in the group and the grouping will be undone. The requests themselves are not affected, and you can upload a new proof afterwards.',
  'حذف المجموعة':'Delete group',
  'جاري حذف التحويل المجمّع...':'Deleting the grouped transfer...',
  'تم حذف إثبات التحويل من كل طلبات المجموعة.':'The transfer proof was removed from all requests in the group.',
  'حصل خطأ أثناء حذف المجموعة. حاول مرة أخرى.':'An error occurred while deleting the group. Please try again.',
  'الميزة تحتاج تجهيز قاعدة البيانات':'This feature needs a database update',
  'أعمدة التحويل المجمّع غير موجودة في جدول requests. يُرجى تنفيذ الأوامر التالية مرة واحدة في Supabase > SQL Editor:\n\n':'The grouped-transfer columns are missing from the requests table. Run the following once in Supabase > SQL Editor:\n\n',
  'أعمدة التحويل المجمّع غير موجودة. يُرجى تنفيذ الأوامر التالية في Supabase > SQL Editor:\n\n':'The grouped-transfer columns are missing. Run the following in Supabase > SQL Editor:\n\n',
  'التحويل المجمّع متاح للمحاسب فقط.':'Grouped transfers are available to the accountant only.',

  /* ── التوقيع والاعتماد ── */
  'تم التوقيع الإلكتروني':'Signed electronically',
  'تم تسجيل توقيعك الإلكتروني على الطلب بنجاح.':'Your e-signature has been recorded on the request.',
  'يمكنك الآن تقديم الطلب أو طباعته حسب الإجراء المطلوب.':'You can now submit or print the request as needed.',
  'اعتماد الطلب':'Approve request',
  'تأكيد اعتماد الطلب':'Confirm approval',
  'هل تريد اعتماد هذا الطلب من إدارة الحسابات الآن؟':'Approve this request on behalf of the Accounts Dept. now?',
  'سيظهر اعتمادك على الطلب ويصبح متاحاً للطباعة فقط.':'Your approval will appear on the request and it becomes print-only.',
  'تم اعتماد الطلب':'Request approved',
  'تم اعتماد الطلب من إدارة الحسابات وحفظه في الأرشيف.':'The request has been approved by the Accounts Dept. and saved to the archive.',
  'الطلب الآن متاح للطباعة.':'The request is now available for printing.',
  'جاري الاعتماد...':'Approving...',
  'اعتماد الحسابات متاح للمحاسب فقط.':'Accounts approval is available to the accountant only.',
  'إلغاء الاعتماد متاح للمحاسب فقط.':'Revoking approval is available to the accountant only.',
  'تأكيد إلغاء الاعتماد':'Confirm revoking approval',
  'هل تريد إلغاء اعتماد الحسابات لهذا الطلب؟ سيرجع الطلب لحالة «غير معتمد» ويصبح قابلاً للتعديل من جديد.':'Revoke the accounts approval for this request? It returns to the "not approved" state and becomes editable again.',
  'يمكن إعادة اعتماد الطلب لاحقاً في أي وقت.':'The request can be approved again at any time.',
  'هذا الطلب غير معتمد أصلاً.':'This request is not approved.',
  'هذا الطلب معتمد بالفعل.':'This request is already approved.',
  'هذا الطلب معتمد':'Request already approved',
  'هذا الطلب ملغى':'Request cancelled',
  'هذا الطلب ملغى، لا يمكن اعتماده.':'This request is cancelled and cannot be approved.',
  'هذا الطلب ملغى، لا يمكن تعديل اعتماده.':'This request is cancelled; its approval cannot be changed.',
  'تعذّر حفظ الاعتماد — اتأكد إن سياسة التعديل (update) متفعّلة في Supabase (راجع كود SQL في التعليمات).':'Could not save the approval — make sure the update policy is enabled in Supabase (see the SQL in the setup guide).',
  'تعذّر حفظ الاعتماد — تأكد من تفعيل سياسة التعديل (update) في Supabase.':'Could not save the approval — make sure the update policy is enabled in Supabase.',
  'تعذّر إلغاء الاعتماد — تأكد من تفعيل سياسة التعديل (update) في Supabase.':'Could not revoke the approval — make sure the update policy is enabled in Supabase.',
  'التوقيع الإلكتروني مطلوب':'e-Signature required',
  'لا يمكن تقديم الطلب قبل التوقيع إلكترونيًا. الرجاء الضغط على زر «توقيع إلكتروني» أولاً، ثم تقديم الطلب.':'The request cannot be submitted before it is signed electronically. Please press "e-Signature" first, then submit.',

  /* ── التقديم والحفظ ── */
  'جاري التقديم...':'Submitting...',
  'تم تقديم الطلب':'Request submitted',
  'تم تقديم الطلب بنجاح، وأصبح متاحاً في إدارة الطلبات.':'The request was submitted successfully and is now available in Requests Management.',
  'تم تحديث الطلب':'Request updated',
  'تم تحديث بيانات الطلب بنجاح، والتعديلات متاحة الآن في إدارة الطلبات.':'The request was updated successfully; the changes are now visible in Requests Management.',
  'حقول إلزامية ناقصة':'Missing required fields',
  'لا يمكن تقديم الطلب قبل استكمال التالي:\n\n':'The request cannot be submitted until the following are completed:\n\n',
  'التوقيع إلكترونيًا':'Sign the request electronically',
  'إضافة فاتورة مورّد مكتملة (اسم المورّد ورقم الفاتورة والمبلغ)':'Add a complete supplier invoice (supplier name, invoice number and amount)',
  'إضافة فاتورة العميل ومبلغها (أو تفعيل «فاتورة عامة»)':'Add the client invoice and its amount, or enable "General Invoice"',
  'إدخال إجمالي المبلغ المطلوب صرفه':'Enter the total amount to be paid',
  'تعذّر الحفظ — اتأكد إنك مسجّل دخول وإن جدول requests متظبط في Supabase.':'Could not save — make sure you are signed in and that the requests table is set up in Supabase.',
  'الحفظ السحابي غير مفعّل — الطلب جاهز للطباعة والتحميل والإرسال على Teams. لتفعيل الأرشيف أضف بيانات Supabase في إعدادات الملف.':'Cloud saving is not enabled — the request is ready to print, download and share. To enable the archive, add your Supabase credentials in the settings.',
  'صلاحية العرض فقط':'View-only account',
  'حسابك مخصّص للعرض والطباعة فقط، ولا يمكنك تقديم أو تعديل الطلبات.':'Your account is for viewing and printing only; you cannot submit or edit requests.',
  'حسابك مخصّص للعرض والطباعة فقط، ولا يمكنك التوقيع على الطلبات.':'Your account is for viewing and printing only; you cannot sign requests.',

  /* ── التعديل والإلغاء ── */
  'تعذّر التعديل':'Cannot edit',
  'هذا الطلب ملغي ولا يمكن تعديله.':'This request is cancelled and cannot be edited.',
  'هذا الطلب معتمد من إدارة الحسابات، متاح للطباعة فقط ولا يمكن تعديله.':'This request is approved by the Accounts Dept.; it is print-only and cannot be edited.',
  'هذا الطلب معتمد من الحسابات، متاح للطباعة فقط ولا يمكن تعديله.':'This request is approved by Accounts; it is print-only and cannot be edited.',
  'أنت على وشك فتح الطلب للتعديل عليه. أي تغيير تقوم بحفظه سيستبدل البيانات الحالية للطلب في الأرشيف.':'You are about to open this request for editing. Any change you save will replace the current data in the archive.',
  'تأكد من صحة التعديلات قبل الحفظ.':'Please review your changes before saving.',
  'متابعة التعديل':'Continue editing',
  'أنت تعرض الطلب للقراءة فقط — اختر «تعديل الطلب» من الأرشيف للتعديل عليه.':'You are viewing this request in read-only mode — choose "Edit request" from the archive to modify it.',
  'تأكيد إلغاء الطلب':'Confirm cancelling the request',
  'هل تريد إلغاء هذا الطلب؟':'Cancel this request?',
  'سيتم الاحتفاظ بالطلب داخل الأرشيف مع علامة ملغى.':'The request stays in the archive marked as cancelled.',
  'لا يمكن إلغاء هذا الطلب.\n\nيمكن للمبيعات إلغاء الطلب قبل اعتماد الحسابات فقط.':'This request cannot be cancelled.\n\nSales can only cancel a request before accounts approval.',
  'تعذّر الإلغاء — تأكد من إضافة عمود cancelled في جدول requests (راجع التعليمات) ومن تفعيل سياسة التعديل.':'Could not cancel — make sure the "cancelled" column exists in the requests table and the update policy is enabled.',
  'لا يمكن تعديل هذا الطلب.\n\nتم اعتماد الطلب من إدارة الحسابات أو لا تملك صلاحية تعديله.':'This request cannot be edited.\n\nIt is approved by the Accounts Dept., or you do not have permission to edit it.',
  'يجب تسجيل الدخول أولاً.':'Please sign in first.',
  'تعذّر فتح الطلب.':'Could not open the request.',

  /* ── إثبات التحويل ── */
  'الملف كبير':'File too large',
  'حجم إثبات التحويل أكبر من الحد المسموح (2 ميجابايت). الرجاء اختيار ملف أصغر.':'The transfer proof exceeds the 2 MB limit. Please choose a smaller file.',
  'تم رفع إثبات التحويل':'Transfer proof uploaded',
  'تم حفظ إثبات التحويل بنجاح، وأُرسل إشعار لمقدّم الطلب بأن طلبه تم تحويله.':'The transfer proof was saved and the requester has been notified that their request was transferred.',
  'تعذّر رفع إثبات التحويل. تحقّق من الاتصال وحاول مرة أخرى.':'Could not upload the transfer proof. Check your connection and try again.',
  'حذف إثبات التحويل':'Delete transfer proof',
  'هل تريد حذف إثبات التحويل الحالي؟ سيمكنك بعدها رفع إثبات جديد.':'Delete the current transfer proof? You will be able to upload a new one afterwards.',
  'هل تريد حذف إثبات التحويل من هذا الطلب فقط؟ سيخرج الطلب من مجموعة التحويل، وباقي طلبات المجموعة تفضل كما هي.':'Remove the transfer proof from this request only? It will leave the transfer group, and the other requests in the group are unchanged.',
  'تم الحذف':'Deleted',
  'تم حذف إثبات التحويل. يمكنك الآن رفع إثبات جديد.':'The transfer proof was deleted. You can upload a new one now.',
  'تعذّر الحذف':'Could not delete',
  'حصل خطأ أثناء الحذف. حاول مرة أخرى.':'An error occurred while deleting. Please try again.',
  'تعذّر الحذف. تحقّق من الاتصال وحاول مرة أخرى.':'Could not delete. Check your connection and try again.',
  'حصل خطأ أثناء تنزيل إثبات التحويل.':'An error occurred while downloading the transfer proof.',
  'تم تحويل طلبك':'Your request was transferred',
  'تم تحويل المبلغ الخاص بطلبك ورفع إثبات التحويل. يمكنك عرض الإثبات من إدارة الطلبات.':'The amount for your request has been transferred and the proof uploaded. You can view it in Requests Management.',
  'الطلبات المحوّلة تظهر باللون الأخضر داخل إدارة الطلبات.':'Transferred requests appear in green inside Requests Management.',
  'و طلبات أخرى':'and other requests',
  'صاحب الطلب':'Requester',
  'نوع الطلب':'Request type',
  'طلب إلغاء':'Cancellation request',

  /* ── المرفقات وملفات PDF ── */
  'لا يوجد مرفق.':'No attachment found.',
  'لا يوجد ملف.':'No file found.',
  'لا يوجد ملف للعرض':'No file to display',
  'مصدر المرفق غير معرّف.':'Unknown attachment source.',
  'تعذّر الوصول إلى الملف من التخزين.':'Could not reach the file in storage.',
  'تعذّر تنزيل المرفق.':'Could not download the attachment.',
  'تعذّر طباعة المرفق.':'Could not print the attachment.',
  'المتصفح منع فتح نافذة الطباعة. اسمح بالـ popups وجرب تاني.':'The browser blocked the print window. Please allow pop-ups and try again.',
  'لا توجد مرفقات للدمج.':'There are no attachments to merge.',
  'مكتبة دمج ملفات PDF غير متاحة.':'The PDF merge library is unavailable.',
  'نوع مرفق غير مدعوم للدمج: ':'Unsupported attachment type for merging: ',
  'نوع المرفق غير مدعوم':'Unsupported attachment type',
  'تعذّر دمج المرفقات. تأكد أن المرفقات PDF أو صور مدعومة.':'Could not merge the attachments. Make sure they are PDFs or supported images.',
  'تعذّر دمج المرفقات للطباعة. تأكد أن المرفقات PDF أو صور مدعومة.':'Could not merge the attachments for printing. Make sure they are PDFs or supported images.',
  'تعذّر تحويل الصورة إلى PNG':'Could not convert the image to PNG',
  'فشل جلب Blob URL':'Failed to fetch the blob URL',
  'فشل جلب رابط المرفق':'Failed to fetch the attachment URL',
  'فشل جلب ملف التخزين':'Failed to fetch the stored file',
  'فشل تحويل مسار التخزين إلى رابط':'Failed to resolve the storage path to a URL',
  '(محفوظ)':'(saved)',
  'تعذّر التنزيل':'Could not download',
  'حصل خطأ أثناء تجهيز نسخة الطلب PDF. حاول مرة أخرى.':'An error occurred while preparing the request PDF. Please try again.',
  'جاري تجهيز نسخة الطلب PDF...':'Preparing the request PDF...',
  'جاري التجهيز...':'Preparing...',
  'تنبيه — بيانات غير محفوظة':'Warning — unsaved data',
  'يستخدم إنشاء نسخة PDF شاشة النموذج مؤقتًا، مما يؤدي إلى مسح البيانات المُدخلة وغير المحفوظة حاليًا.':'Preparing the request PDF temporarily uses the form screen, which will clear the unsaved data currently typed into the form.',
  'احفظ أو قدّم طلبك أولاً لو محتاج تحتفظ بالبيانات.':'Save or submit your request first if you need to keep that data.',
  'متابعة التنزيل':'Continue download',
  'نسخة الطلب جاهزة للتنزيل كـ PDF منفصل. المرفقات متاحة من قائمة المرفقات.':'The request copy is ready as a separate PDF. Attachments are available from the attachments menu.',
  '<span class="appendix-hint">التفاصيل الكاملة في الملحق التالي · See appendix</span>':'<span class="appendix-hint">Full details in the following appendix · See appendix</span>',

  /* ── التعليقات ── */
  'اكتب تعليقك هنا ...':'Write your comment here ...',
  'لا يمكن ترك التعليق فارغاً.':'The comment cannot be empty.',
  'لا يمكن إضافة تعليق على هذا الطلب.':'You cannot add a comment to this request.',
  'لا يمكن تعديل هذا التعليق.':'You cannot edit this comment.',
  'لا يمكنك حذف هذا التعليق.':'You cannot delete this comment.',
  'التعليق لم يعد موجوداً (ربما حُذف).':'The comment no longer exists (it may have been deleted).',
  'حذف التعليق':'Delete comment',
  'هل تريد حذف هذا التعليق نهائياً؟':'Delete this comment permanently?',
  'تعذّر حفظ التعليق — تأكد من إضافة عمود comments_data وتفعيل سياسة التعديل في Supabase.\n\nSQL:\nALTER TABLE requests ADD COLUMN IF NOT EXISTS comments_data TEXT;':'Could not save the comment — make sure the comments_data column exists and the update policy is enabled in Supabase.\n\nSQL:\nALTER TABLE requests ADD COLUMN IF NOT EXISTS comments_data TEXT;',
  ' بعد — أضف أول تعليق بالأسفل.':' yet — add the first comment below.',
  'الجميع':'Everyone',
  'الإدارة فقط':'Management only',
  'الموظفين':'Staff',
  'يظهر لكل المستخدمين':'Visible to all users',
  'المحاسب وفريق الإدارة فقط':'Accountant and management team only',
  'المحاسب والمبيعات فقط':'Accountant and sales only',

  /* ── أزرار عامة ── */
  'تأكيد':'Confirm',
  'تراجع':'Cancel',
  'رجوع':'Back',
  'حسنًا':'OK',
  'تم':'Done',
  'إغلاق':'Close',
  'غير مسموح':'Not allowed',
  'هذه الخاصية للمحاسب فقط.':'This feature is available to the accountant only.',
  'خطأ اتصال':'Connection error',
  'خطأ اتصال بـ Supabase.':'Supabase connection error.',
  'الأرشيف غير مفعّل':'Archive not enabled',
  'الأرشيف غير مفعّل.':'Archive is not enabled.',
  'لا يمكن رفع إثبات التحويل بدون اتصال بقاعدة البيانات.':'The transfer proof cannot be uploaded without a database connection.',

  /* ── الأدوار والأقسام ── */
  'المحاسبة':'Accounting',
  'المبيعات':'Sales',
  'الإدارة':'Management',
  'الإدارة المالية':'Finance Dept.',
  'قسم المبيعات':'Sales Dept.',
  'قسم العمليات':'Operations Dept.',
  'قسم الحسابات':'Accounts Dept.',
  'فريق الإدارة':'Management Team',

  /* ── مطابقة مركز التكلفة ── */
  '✓ إجمالي مركز التكلفة مطابق لإجمالي فاتورة المورّد <small>(':'✓ Cost center total matches the supplier invoice total <small>(',
  '✗ الإجمالي لا يساوي إجمالي فاتورة المورّد —':'✗ Total does not match the supplier invoice total —',
  ' بمقدار <small>':' by <small>',
  ' ر.ق)</small>':' QAR)</small>',
  ' ر.ق</small>':' QAR</small>',
  'أكبر':'higher',
  'أقل':'lower',

  /* ── رسائل Supabase ── */
  '<div class="arc-note">الأرشيف السحابي غير مفعّل بعد. الطلبات تشتغل وتطبع وتتحمّل عادي.<br>لحفظ الطلبات وعرضها هنا للجميع، أضف رابط ومفتاح Supabase في أعلى كود الملف.</div>':'<div class="arc-note">The cloud archive is not enabled yet. Requests still work, print and download normally.<br>To save requests and show them here for everyone, add your Supabase URL and key at the top of the script file.</div>',
  '\n\nيلزم تنفيذ أمر SQL التالي في Supabase > SQL Editor:\nALTER TABLE requests ADD COLUMN IF NOT EXISTS attachments_data TEXT;\nALTER TABLE requests ADD COLUMN IF NOT EXISTS transfer_image TEXT;':'\n\nYou need to run this SQL in Supabase > SQL Editor:\nALTER TABLE requests ADD COLUMN IF NOT EXISTS attachments_data TEXT;\nALTER TABLE requests ADD COLUMN IF NOT EXISTS transfer_image TEXT;',
  '\n\nفي طلب ملغي قديم بنفس الرقم. اضغط حفظ مرة تانية بعد تحديث الصفحة، ولو استمر الخطأ افتح الطلب الملغي من الأرشيف وألغيه مرة أخرى لتحرير الرقم.':'\n\nAn older cancelled request uses the same number. Refresh the page and save again; if the error persists, open the cancelled request from the archive and cancel it again to release the number.',
  'تعذّر حفظ الصورة.\n\nيُرجى تنفيذ أمر SQL التالي في Supabase > SQL Editor:\n\nALTER TABLE requests ADD COLUMN IF NOT EXISTS transfer_image TEXT;\nALTER TABLE requests ADD COLUMN IF NOT EXISTS attachments_data TEXT;':'Could not save the image.\n\nRun this SQL in Supabase > SQL Editor:\n\nALTER TABLE requests ADD COLUMN IF NOT EXISTS transfer_image TEXT;\nALTER TABLE requests ADD COLUMN IF NOT EXISTS attachments_data TEXT;',
  'تعذّر تحميل بيانات مجموعات التحويل':'Could not load transfer-group data',
  'خطأ: عمود غير موجود في الجدول. يُرجى تنفيذ أمر SQL التالي في Supabase:<br><code style="font-size:10px;direction:ltr;display:block;background:#f5f5f5;padding:6px;margin-top:4px">ALTER TABLE requests ADD COLUMN IF NOT EXISTS transfer_image TEXT;<br>ALTER TABLE requests ADD COLUMN IF NOT EXISTS attachments_data TEXT;<br>ALTER TABLE requests ADD COLUMN IF NOT EXISTS cancelled BOOLEAN DEFAULT FALSE;<br>ALTER TABLE requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();</code>':'Error: a column is missing from the table. Run this SQL in Supabase:<br><code style="font-size:10px;direction:ltr;display:block;background:#f5f5f5;padding:6px;margin-top:4px">ALTER TABLE requests ADD COLUMN IF NOT EXISTS transfer_image TEXT;<br>ALTER TABLE requests ADD COLUMN IF NOT EXISTS attachments_data TEXT;<br>ALTER TABLE requests ADD COLUMN IF NOT EXISTS cancelled BOOLEAN DEFAULT FALSE;<br>ALTER TABLE requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();</code>',

  /* ── الملحق ── */
  'ملحق تفاصيل الفواتير':'Invoice Details Appendix',
  'فواتير المورد - التفاصيل الكاملة':'Supplier Invoices — Full Details',
  'مركز التكلفة - التفاصيل الكاملة':'Cost Center — Full Details',
  'النصيب ر.ق':'Share QAR',
  'المبلغ ر.ق':'Amount QAR',


  /* ── تكملة ── */
  ' · مرجع: ':' · Ref: ',
  ' درهم':' dirhams',
  ' ريال قطري فقط لا غير':' Qatari Riyals only',
  ' و':' and ',
  'صفر':'Zero',
  'إجمالي':'Total',
  'إضافة تعليق':'Add comment',
  'إلغاء':'Cancel',
  'حفظ':'Save',
  'اضغط للاعتماد':'Click to approve',
  'اضغط لإلغاء الاعتماد':'Click to revoke approval',
  'التعليقات متاحة للقراءة فقط.':'Comments are read-only.',
  'لا توجد تعليقات':'No comments',
  'يظهر لـ':'Visible to',
  'التوقيت:':'Time:',
  'بواسطة:':'By:',
  'الحالة: معتمد من الحسابات':'Status: approved by Accounts',
  'طلبات بإثبات واحد':'requests with one proof',
  'مرفق':'Attachment',
  'مرفقات_':'Attachments_',
  'يجب ':'',
  'تم تحويل المبالغ الخاصة بعدد {n} من طلباتك ورفع إثبات التحويل. يمكنك عرضها من إدارة الطلبات.':'The amounts for {n} of your requests have been transferred and the proof uploaded. You can view them in Requests Management.',
  'لا يمكن طباعة الطلب بعدد الصفوف الحالي.\n\nالعدد الحالي: {n}\nالحد الأقصى: {max} صفاً.':'The request cannot be printed with the current number of rows.\n\nCurrent: {n}\nMaximum: {max} rows.',
  'لقد وصلت للحد الأقصى للمدخلات.\n\nالحد الأعلى هو {max} صفاً. الصفوف الزائدة عن {main} ستظهر في ملحق تفاصيل الفواتير عند الطباعة.':'You have reached the maximum number of entries.\n\nThe limit is {max} rows. Rows beyond {main} appear in the invoice details appendix when printing.',

  'صرف':'Payment',
  'إلغاء الفاتورة':'Cancel',
  'ملغى':'Cancelled',


  'تاريخ التقديم':'Submitted at',

  'توقيت اعتماد الحسابات':'Accounts approval',

  'الحالة':'Status',
  'اللغة':'Language',
  'تسجيل الخروج':'Sign out',
  'معتمد':'Approved',
  'بانتظار التوقيع':'Awaiting signature',
  'بانتظار الاعتماد':'Awaiting approval',
  'معتمد — بانتظار التحويل':'Approved — awaiting transfer',
  'تم التحويل':'Transferred',
  'كل الطلبات':'All requests',
  'قيد المراجعة':'Under review',
  'عرض':'Showing',
  'من':'of',
  'طلب':'requests',
  'الحد الأقصى للعرض 200 طلب — استخدم البحث أو فلتر التاريخ':'Showing the first 200 — use search or the date filter to narrow down',

  'الرئيسية':'Home',
  'المورّد / مقدّم الطلب':'Supplier / Requester',
  'كل الأنواع':'All types',
  'الأحدث أولاً':'Newest first',
  'الأقدم أولاً':'Oldest first',
  'الأعلى مبلغاً':'Highest amount',
  'الأطول انتظاراً':'Longest waiting',
  'ترتيب':'Sort',
  'أهلاً':'Hi',
  'طلب صرف جديد':'New payment request',
  'مطلوب منك':'Needs your action',
  'بانتظار اعتمادك':'Awaiting your approval',
  'مفيش طلبات مستنية اعتمادك':'Nothing awaiting your approval',
  'لا توجد مهام معلّقة':'No pending tasks',
  'جاهز للتحويل':'Ready to transfer',
  'معتمد ولم يُحوّل':'Approved, not yet transferred',
  'إجمالي جاهز للتحويل':'Total ready to transfer',
  'مفيش طلبات جاهزة للتحويل':'No requests ready to transfer',
  'هتظهر هنا بعد الاعتماد':'They appear here once approved',
  'اعتماد':'Approve',
  'مراجعة واعتماد':'Review & approve',
  'رفع الإثبات':'Upload proof',
  'إثبات':'Proof',
  'طلباتي':'My requests',
  'قيد التنفيذ':'In progress',
  'مفيش طلبات قيد التنفيذ':'No requests in progress',
  'ابدأ بطلب صرف جديد':'Start with a new payment request',
  'تم تحويلها':'Transferred',
  'آخر التحويلات':'Latest transfers',
  'عرض الكل':'View all',
  'اليوم':'today',
  'من يوم':'1 day ago',
  'يوم':'days',
  'من {n} يوم':'{n} days ago',
  'حاول مرة أخرى':'Please try again',

  /* ── زر اللغة ── */
  'English':'العربية',
};

/* أسماء المستخدمين: عربي ← إنجليزي (تُبنى من USER_MAP) */
const NAME_EN = {};
function buildUserNameMap(map){
  try{
    Object.values(map || {}).forEach(u=>{
      if(u && u.name && u.name_en) NAME_EN[u.name] = u.name_en;
      if(u && u.dept && u.dept_en) NAME_EN[u.dept] = u.dept_en;
    });
  }catch(e){}
}
/* اسم شخص/قسم كما يُعرض حسب اللغة (المخزَّن في قاعدة البيانات لا يتغيّر) */
function personName(n){
  if(LANG !== 'en' || !n) return n || '';
  return NAME_EN[n] || I18N_EN[n] || n;
}

/* ترجمة نص: المفتاح هو النص العربي نفسه */
function t(s){
  if(LANG !== 'en' || s == null) return s;
  const hit = I18N_EN[s];
  return hit === undefined ? s : hit;
}
function isEnglish(){ return LANG === 'en'; }

/* عناصر الصفحة الثابتة: <span data-i18n="النص العربي"> */
function translateStaticNodes(root){
  (root || document).querySelectorAll('[data-i18n]').forEach(el=>{
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  (root || document).querySelectorAll('[data-i18n-attr]').forEach(el=>{
    // القيمة بالشكل: attr|النص العربي  (ويمكن فصل أكثر من واحد بـ ;;)
    el.getAttribute('data-i18n-attr').split(';;').forEach(part=>{
      const idx = part.indexOf('|');
      if(idx < 0) return;
      el.setAttribute(part.slice(0, idx), t(part.slice(idx+1)));
    });
  });
}

/* تطبيق اللغة على الصفحة كلها */
function applyLanguage(opts){
  const o = opts || {};
  const html = document.documentElement;
  html.setAttribute('lang', LANG);
  html.setAttribute('dir', LANG === 'en' ? 'ltr' : 'rtl');
  html.classList.toggle('lang-en', LANG === 'en');
  // وقت الطباعة العنوان بيبقى رقم الطلب (منه بياخد المتصفح اسم ملف الـPDF)،
  // وتجهيز الوثيقة ثنائية اللغة بينادي الدالة دي، فلازم نسيب العنوان زي ما هو.
  if(!window.PRINT_TITLE_ACTIVE){
    document.title = LANG === 'en' ? 'Zamzam Hajj & Umrah · زمزم' : 'زمزم للحج والعمرة · Zamzam';
  }
  translateStaticNodes();
  const globe = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18"></path><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"></path></svg>';
  ['login-lang-btn'].forEach(id=>{
    const btn = document.getElementById(id);
    if(!btn) return;
    btn.innerHTML = globe + '<span>' + (LANG === 'en' ? 'ع' : 'EN') + '</span>';
    const tip = LANG === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية';
    btn.setAttribute('title', tip);
    btn.setAttribute('aria-label', tip);
  });
  if(typeof syncUserChip === 'function') syncUserChip();
  if(typeof refreshPadStates === 'function') refreshPadStates();   // دعوة التوقيع تتترجم مع اللغة
  if(!o.skipDynamic && typeof refreshDynamicUI === 'function'){
    refreshDynamicUI();
    translateStaticNodes();   // العناصر اللي اتولدت من جديد
  }
}

function setLanguage(lang, opts){
  LANG = (lang === 'en') ? 'en' : 'ar';
  try{ localStorage.setItem(LANG_KEY, LANG); }catch(e){}
  applyLanguage(opts);
}
function toggleLanguage(){ setLanguage(LANG === 'en' ? 'ar' : 'en'); }

/* أثناء الطباعة/تجهيز PDF: الوثيقة تفضل ثنائية اللغة (عربي + إنجليزي) */
let _langBeforePrint = null;
function beginBilingualDocument(){
  if(LANG !== 'en') return false;
  _langBeforePrint = LANG;
  LANG = 'ar';
  applyLanguage({ skipDynamic:true });
  document.documentElement.classList.add('printing-bilingual');
  return true;
}
function endBilingualDocument(){
  document.documentElement.classList.remove('printing-bilingual');
  if(_langBeforePrint === null) return;
  LANG = _langBeforePrint;
  _langBeforePrint = null;
  applyLanguage({ skipDynamic:true });
}

document.addEventListener('DOMContentLoaded', ()=>applyLanguage({ skipDynamic:true }));
