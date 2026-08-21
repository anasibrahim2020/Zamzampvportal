/* ══════════════════════════════════════════
   CONFIG — عدّل دي حسب احتياجك
══════════════════════════════════════════ */

// 1) المستخدمون — اسم الدخول ← الإيميل/الاسم/الصلاحية (مفيش أي باسورد في الملف)
//    الباسوردات بتتخزّن مشفّرة على Supabase. تقدر تغيّر الأسماء المعروضة هنا.
// phone = رقم الواتساب بصيغة دولية بدون + (مثال قطر: 974XXXXXXXX) — يُستخدم لإشعارات الواتساب
const USER_MAP = {
  'admin':        { email:'admin@zamzam.app',        name:'أنس إبراهيم', name_en:'Anas Ibrahim',  role:'accountant', dept:'الإدارة المالية', dept_en:'Finance Department', phone:'' },
  'ahmed_taha':   { email:'ahmed_taha@zamzam.app',   name:'أحمد طه',     name_en:'Ahmed Taha',    role:'sales',      dept:'قسم العمليات',    dept_en:'Operation Department', phone:'' },
  'amr_mohamed':  { email:'amr_mohamed@zamzam.app',  name:'عمرو محمد',    name_en:'Amr Mohamed',   role:'sales',      dept:'قسم المبيعات',    dept_en:'Sales Department', phone:'' },
  'ibrahim_sabl': { email:'ibrahim_sabl@zamzam.app', name:'إبراهيم سبل',  name_en:'Ibrahim Sabl',  role:'viewer',     dept:'فريق الإدارة',    dept_en:'Management Team', phone:'' },
};

// 2) Supabase — لازم تكمّلهم عشان الدخول والأرشيف يشتغلوا (المفتاح ده آمن يتحط هنا)
if(typeof buildUserNameMap === 'function') buildUserNameMap(USER_MAP);

const SUPABASE_URL = 'https://piwuyaskrvuhblenixhf.supabase.co';   // رابط المشروع
const SUPABASE_KEY = 'sb_publishable_Qx-F2nQVr10ynaw1JC87sQ_u2ZCJRKt';   // anon / publishable key
const SB_ON = !!(SUPABASE_URL && SUPABASE_KEY);
const sb = SB_ON ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

function sanitizeFileName(name){
  return String(name||'').trim()
    .replace(/[^a-zA-Z0-9_.-]/g,'_')
    .replace(/_+/g,'_')
    .replace(/^_+|_+$/g,'');
}
function isDataUrl(value){ return typeof value==='string' && value.startsWith('data:'); }
function isHttpUrl(value){ return typeof value==='string' && /^https?:\/\//i.test(value); }
function isStoragePath(value){ return typeof value==='string' && !isDataUrl(value) && !isHttpUrl(value) && value.length>0; }
function dataUrlToBlob(dataUrl){
  const [meta, data] = String(dataUrl||'').split(',',2);
  const mime = meta.match(/data:([^;]+);/)?.[1] || 'application/octet-stream';
  const binary = atob(data||'');
  const arr = new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++){ arr[i] = binary.charCodeAt(i); }
  return new Blob([arr], { type: mime });
}
async function resolveStorageUrl(path){
  if(!sb || !isStoragePath(path)) return null;
  const { data: signed, error: signedErr } = await sb.storage.from('request-attachments').createSignedUrl(path, 300);
  if(!signedErr && signed?.signedUrl){ return signed.signedUrl; }
  const { data } = sb.storage.from('request-attachments').getPublicUrl(path);
  if(data?.publicUrl){ return data.publicUrl; }
  return null;
}
async function openSourceInNewTab(src){
  if(!src){ alert(t('لا يوجد ملف للعرض')); return; }
  if(isDataUrl(src)){
    const blob = dataUrlToBlob(src);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(()=>URL.revokeObjectURL(url), 40000);
    return;
  }
  if(isHttpUrl(src)){
    window.open(src, '_blank');
    return;
  }
  if(isStoragePath(src)){
    const url = await resolveStorageUrl(src);
    if(url){ window.open(url, '_blank'); return; }
    alert(t('تعذّر الوصول إلى الملف من التخزين.'));
    return;
  }
  alert(t('مصدر المرفق غير معرّف.'));
}
function getCurrentAttachmentCount(){ return ATTACHED.length; }
async function uploadFileToStorage(file, folder='uploads'){
  if(!sb) throw new Error('Supabase not initialized');
  const name = sanitizeFileName(file.name);
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2,8);
  const filepath = `${folder.replace(/^\/+|\/+$/g,'')}/${timestamp}_${random}_${name}`;
  // الشبكات المكتبية بتقطع الرفع أحيانًا، فنعيد المحاولة مرتين بفاصل متزايد
  let error = null, data = null;
  for(let attempt=0; attempt<3; attempt++){
    if(attempt>0) await new Promise(r=>setTimeout(r, attempt*1200));
    ({ data, error } = await sb.storage.from('request-attachments')
      .upload(filepath, file, { cacheControl:'3600', upsert:false }));
    if(!error) return data?.path || filepath;
    if(!isNetworkError(error)) break;   // خطأ حقيقي من السيرفر: مفيش فايدة من الإعادة
  }
  throw new Error(describeUploadError(error, file));
}
// "Failed to fetch" معناها إن المتصفح ماوصلش للسيرفر أصلًا — مش رفض منه
function isNetworkError(error){
  const m = String(error?.message || error || '').toLowerCase();
  return m.includes('failed to fetch') || m.includes('networkerror')
      || m.includes('load failed') || m.includes('network request failed');
}
// رسالة تشخيص دقيقة بدل التخمين — كل حالة ولها سببها الحقيقي
function describeUploadError(error, file){
  const raw = error?.message || error?.error_description || error?.error || JSON.stringify(error||{});
  const m = String(raw).toLowerCase();
  const nm = file?.name ? ` (${file.name})` : '';
  if(isNetworkError(error)){
    return t('تعذّر الوصول إلى خادم التخزين') + nm + '.\n\n'
      + t('لم يصل الطلب إلى الخادم من الأساس، والسبب غالبًا أحد الآتي:') + '\n'
      + t('• انقطاع الاتصال بالإنترنت أثناء الرفع.') + '\n'
      + t('• حجب شبكة المكتب أو الجدار الناري للنطاق supabase.co') + '\n'
      + t('• إضافة في المتصفح تمنع الطلبات (مانع الإعلانات أو حماية الخصوصية).') + '\n\n'
      + t('جرّب من شبكة أخرى أو من بيانات الهاتف للتأكد.');
  }
  if(m.includes('row-level security') || m.includes('unauthorized') || m.includes('accessdenied')){
    return t('الخادم رفض الرفع لعدم وجود صلاحية') + nm + '.\n\n'
      + t('سياسات التخزين تحتاج مراجعة، أو انتهت جلسة الدخول. سجّل الخروج والدخول مرة أخرى، فإن استمرت المشكلة فالمطلوب ضبط سياسات Storage.');
  }
  if(m.includes('exceeded') || m.includes('too large') || m.includes('413')){
    return t('حجم الملف أكبر من الحد المسموح به') + nm + '.\n\n'
      + t('اضغط الملف أو ارفعه بجودة أقل ثم أعد المحاولة.');
  }
  if(m.includes('mime') || m.includes('invalid_mime') || m.includes('content type')){
    return t('نوع الملف غير مقبول') + nm + '.\n\n' + t('المسموح: ملفات PDF والصور فقط.');
  }
  if(m.includes('bucket not found') || m.includes('nosuchbucket')){
    return t('مساحة التخزين غير موجودة على الخادم.') + '\n\n'
      + t('يلزم إنشاء bucket باسم request-attachments في Supabase Storage.');
  }
  if(m.includes('already exists') || m.includes('duplicate')){
    return t('يوجد ملف بنفس الاسم بالفعل') + nm + '.\n\n' + t('أعد المحاولة، وسيُحفظ باسم جديد.');
  }
  return t('تعذّر رفع الملف') + nm + '.\n\n' + t('تفاصيل الخطأ:') + '\n' + raw;
}
async function uploadAttachments(files, folder='uploads'){
  const paths = [];
  for(const f of files){ paths.push(await uploadFileToStorage(f, folder)); }
  return paths;
}
async function openAttachment(rowIndex, attIndex){
  const x = (window._arcRows||[])[rowIndex];
  if(!x){ alert(t('تعذّر فتح الطلب.')); return; }
  let atts = [];
  try{ atts = JSON.parse(x.attachments_data||'[]'); }catch(e){ atts = []; }
  const src = atts[attIndex];
  if(!src){ alert(t('لا يوجد مرفق.')); return; }
  await openSourceInNewTab(src);
}
async function downloadArchiveAttachment(rowIndex, attIndex){
  const x = (window._arcRows||[])[rowIndex];
  if(!x){ alert(t('تعذّر فتح الطلب.')); return; }
  let atts = [];
  try{ atts = JSON.parse(x.attachments_data||'[]'); }catch(e){ atts = []; }
  const src = atts[attIndex];
  if(!src){ alert(t('لا يوجد مرفق.')); return; }
  try{
    const bytes = await getAttachmentBytes(src);
    dl(new Blob([bytes], { type:getAttachmentMime(src) }), getAttachmentLabel(src));
  }catch(e){
    alert(t('تعذّر تنزيل المرفق.'));
    console.error(e);
  }
}
async function printArchiveAttachment(rowIndex, attIndex){
  const x = (window._arcRows||[])[rowIndex];
  if(!x){ alert(t('تعذّر فتح الطلب.')); return; }
  let atts = [];
  try{ atts = JSON.parse(x.attachments_data||'[]'); }catch(e){ atts = []; }
  const src = atts[attIndex];
  if(!src){ alert(t('لا يوجد مرفق.')); return; }
  try{
    const bytes = await getAttachmentBytes(src);
    const blob = new Blob([bytes], { type:getAttachmentMime(src) });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if(!w){ alert(t('منع المتصفح فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.')); return; }
    w.onload = function(){ try{ w.focus(); w.print(); }catch(e){} };
    setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} }, 900);
  }catch(e){
    alert(t('تعذّر طباعة المرفق.'));
    console.error(e);
  }
}
async function bytesToPngBytes(bytes, mime){
  const blob = new Blob([bytes], { type:mime || 'image/*' });
  const url = URL.createObjectURL(blob);
  try{
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const pngBlob = await new Promise(resolve=>canvas.toBlob(resolve, 'image/png'));
    if(!pngBlob) throw new Error(t('تعذّر تحويل الصورة إلى PNG'));
    return await pngBlob.arrayBuffer();
  }finally{
    URL.revokeObjectURL(url);
  }
}
async function addImageAttachmentToPdf(merged, bytes, mime){
  let image;
  const lowerMime = String(mime||'').toLowerCase();
  if(lowerMime.includes('jpeg') || lowerMime.includes('jpg')){
    image = await merged.embedJpg(bytes);
  } else if(lowerMime.includes('png')){
    image = await merged.embedPng(bytes);
  } else {
    const pngBytes = await bytesToPngBytes(bytes, mime);
    image = await merged.embedPng(pngBytes);
  }
  const page = merged.addPage([image.width, image.height]);
  page.drawImage(image, { x:0, y:0, width:image.width, height:image.height });
}
async function mergeArchiveAttachmentBytes(rowIndex){
  const x = (window._arcRows||[])[rowIndex];
  if(!x){ throw new Error(t('تعذّر فتح الطلب.')); }
  const atts = getArchiveRowAttachments(x);
  if(!atts.length){ throw new Error(t('لا توجد مرفقات للدمج.')); }
  if(!window.PDFLib || !window.PDFLib.PDFDocument){
    throw new Error(t('مكتبة دمج ملفات PDF غير متاحة.'));
  }
  const merged = await PDFLib.PDFDocument.create();
  for(let i=0;i<atts.length;i++){
    const att = atts[i];
    const bytes = await getAttachmentBytes(att);
    const mime = getAttachmentMime(att);
    if(mime === 'application/pdf'){
      const srcDoc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption:true });
      const pages = await merged.copyPages(srcDoc, srcDoc.getPageIndices());
      pages.forEach(page => merged.addPage(page));
    } else if(mime.startsWith('image/')){
      await addImageAttachmentToPdf(merged, bytes, mime);
    } else {
      throw new Error(t('نوع مرفق غير مدعوم للدمج: ')+getAttachmentLabel(att));
    }
  }
  return await merged.save();
}
async function downloadArchiveAttachmentsMerged(rowIndex){
  const x = (window._arcRows||[])[rowIndex];
  if(!x){ alert(t('تعذّر فتح الطلب.')); return; }
  try{
    const bytes = await mergeArchiveAttachmentBytes(rowIndex);
    const reqNo = displayRequestNo(x.req_no) || 'request';
    dl(new Blob([bytes], { type:'application/pdf' }), `${t('مرفقات_')}${reqNo}.pdf`);
  }catch(e){
    alert(t('تعذّر دمج المرفقات. تأكد أن المرفقات PDF أو صور مدعومة.'));
    console.error(e);
  }
}
async function printArchiveAttachmentsMerged(rowIndex){
  try{
    const bytes = await mergeArchiveAttachmentBytes(rowIndex);
    const blob = new Blob([bytes], { type:'application/pdf' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if(!w){ alert(t('منع المتصفح فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.')); return; }
    w.onload = function(){ try{ w.focus(); w.print(); }catch(e){} };
    setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} }, 900);
  }catch(e){
    alert(t('تعذّر دمج المرفقات للطباعة. تأكد أن المرفقات PDF أو صور مدعومة.'));
    console.error(e);
  }
}
async function openAttachmentByRow(rowIndex, field){
  const x = (window._arcRows||[])[rowIndex];
  if(!x){ alert(t('تعذّر فتح الطلب.')); return; }
  const src = x[field];
  if(!src){ alert(t('لا يوجد ملف.')); return; }
  await openSourceInNewTab(src);
}

/* ══════════════════════════════════════════
   AUTH
══════════════════════════════════════════ */
let CURRENT = null;

function _mapUser(email){
  const k = Object.keys(USER_MAP).find(u => USER_MAP[u].email.toLowerCase() === (email||'').toLowerCase());
  return k ? { user:k, ...USER_MAP[k] } : null;
}

async function doLogin(){
  const uname = document.getElementById('login-user').value.trim().toLowerCase();
  const p     = document.getElementById('login-pass').value;
  const err   = document.getElementById('login-error');
  const btn   = document.querySelector('.login-btn');
  if(!SB_ON){
    err.textContent=t('الإعداد غير مكتمل — يلزم إضافة بيانات Supabase أولاً (راجع دليل الإعداد).');
    err.style.display='block';
    return;
  }
  const info = USER_MAP[uname];
  if(!info){
    err.textContent=t('اسم المستخدم أو كلمة المرور غير صحيحة');
    err.style.display='block';
    document.getElementById('login-pass').value=''; document.getElementById('login-pass').focus();
    return;
  }
  const ob = btn ? btn.innerHTML : '';
  if(btn){ btn.disabled=true; btn.textContent=t('جاري الدخول...'); }
  try{
    const { data, error } = await sb.auth.signInWithPassword({ email:info.email, password:p });
    if(error || !(data && data.session)){
      err.textContent=t('اسم المستخدم أو كلمة المرور غير صحيحة');
      err.style.display='block';
      document.getElementById('login-pass').value=''; document.getElementById('login-pass').focus();
    } else {
      CURRENT = { user:uname, ...info };
      err.style.display='none';
      enterApp();
    }
  }catch(e){
    err.textContent=t('تعذّر الاتصال بالخادم — حاول مرة أخرى');
    err.style.display='block';
    console.error(e);
  }
  if(btn){ btn.disabled=false; btn.innerHTML=ob; }
}

async function doLogout(){
  try{ if(sb) await sb.auth.signOut(); }catch(e){}
  CURRENT = null;
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('app').style.display='none';
  document.getElementById('login-user').value='';
  document.getElementById('login-pass').value='';
}

function enterApp(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('tb-name').textContent = personName(CURRENT.name);
  document.getElementById('tb-role').textContent = personName(CURRENT.dept || '');
  if(typeof syncUserChip==='function') syncUserChip();
  // الاسم والقسم بيتعبّوا أوتوماتيك حسب الحساب
  document.getElementById('d-name').value = personName(CURRENT.name);
  document.getElementById('d-dept').value = personName(CURRENT.dept || (CURRENT.role==='accountant'?'قسم الحسابات':'قسم المبيعات'));

  const isAcc = CURRENT.role==='accountant';
  const isViewer = CURRENT.role==='viewer';
  // الأرشيف متاح للجميع: المبيعات يشوف طلباته (عرض فقط)، المحاسب يشوف الكل ويتحكّم
  document.getElementById('nav-arc').style.display = '';
  showPage('home');
  // حساب العرض فقط (إبراهيم): يدخل إدارة الطلبات كاملة بدون إنشاء أو تعديل
  document.getElementById('nav-disb').style.display   = isViewer ? 'none' : '';
  document.getElementById('nav-cancel').style.display = isViewer ? 'none' : '';
  if(isViewer){
    setDocumentLocked('disb', true);
    setDocumentLocked('cancel', true);
    showPage('arc');
  }
  // أزرار اعتماد الحسابات تظهر للمحاسب فقط
  document.getElementById('disb-acc-btn-row').style.display = isAcc ? '' : 'none';
  const cAccRow = document.getElementById('cancel-acc-btn-row');
  if(cAccRow) cAccRow.style.display = 'none';
  // نسخ صورة اللوجو للترويسة المكرّرة في طلب الإلغاء
  const sl = document.getElementById('src-logo');
  if(sl){ document.querySelectorAll('img.zlogo').forEach(i=>{ if(!i.src) i.src = sl.src; }); }
  // تحميل أسماء الموردين السابقة للاقتراح التلقائي
  loadSupplierNames();
  refreshNextRequestNumbers();
  startArchiveAutoRefresh();
  // إشعار مقدم الطلب عند فتح البورتال بأن طلبه تم تحويله
  notifyTransferredRequests();
  loadNotifs();                       // إشعارات الجرس
  if(!window.__NOTIF_TIMER) window.__NOTIF_TIMER = setInterval(loadNotifs, 60000);
  // تسجيل إشعارات Push للجهاز (تظهر حتى والتطبيق مقفول)
  if(typeof initPush === 'function') initPush(CURRENT);
}

// إشعار صاحب الطلب أول ما يفتح البورتال إنّ طلبه تم تحويله (رُفع إثبات التحويل)
// التتبّع على مستوى الحساب عبر عمود transfer_seen في Supabase (يظهر مرة واحدة مهما تغيّر الجهاز/المتصفح)
async function notifyTransferredRequests(){
  if(!SB_ON || !CURRENT) return;
  // الإشعار لمقدّم الطلب (المبيعات) فقط — المحاسب هو اللي بيرفع إثبات التحويل
  if(CURRENT.role !== 'sales') return;
  try{
    const { data:rows, error } = await sb.from('requests')
      .select('id,req_no,doc_type,created_by,transfer_image,transfer_seen,cancelled')
      .eq('created_by', CURRENT.name)
      .not('transfer_image','is',null)
      .or('transfer_seen.is.null,transfer_seen.eq.false')
      .order('id',{ascending:false}).limit(100);
    if(error || !Array.isArray(rows)) return;
    const fresh = rows.filter(r=>r.transfer_image && !r.cancelled && !r.transfer_seen);
    if(!fresh.length) return;
    const details = fresh.slice(0,8).map(r=>({
      label: r.doc_type==='cancel' ? t('طلب إلغاء واسترداد') : t('طلب صرف'),
      value: displayRequestNo(r.req_no) || '—',
      ltr:true
    }));
    if(fresh.length > 8) details.push({ label:t('و طلبات أخرى'), value:'+' + (fresh.length-8) });
    showMessageDialog({
      title:t('تم تحويل طلبك'),
      subtitle:'Request Transferred',
      message: fresh.length===1
        ? t('تم تحويل المبلغ الخاص بطلبك ورفع إثبات التحويل. يمكنك عرض الإثبات من إدارة الطلبات.')
        : t('تم تحويل المبالغ الخاصة بعدد {n} من طلباتك ورفع إثبات التحويل. يمكنك عرضها من إدارة الطلبات.').replace('{n}', fresh.length),
      details,
      note:t('الطلبات المحوّلة تظهر باللون الأخضر داخل إدارة الطلبات.'),
      confirmText:t('حسنًا')
    });
    // تعليم الطلبات كمقروءة على مستوى الحساب (مش هتظهر تاني على أي جهاز)
    const ids = fresh.map(r=>r.id);
    try{ await sb.from('requests').update({ transfer_seen:true }).in('id', ids); }catch(e){}
  }catch(e){ /* الإشعار غير حرج — لا يؤثر على عمل البورتال */ }
}

// اقتراح أسماء الموردين من الطلبات السابقة (autocomplete)
async function loadSupplierNames(){
  if(!SB_ON) return;
  try{
    const { data:rows } = await sb.from('requests')
      .select('supplier_invoices').eq('doc_type','disb')
      .order('id',{ascending:false}).limit(400);
    if(!Array.isArray(rows)) return;
    const names = new Set();
    rows.forEach(r=>{
      try{
        (JSON.parse(r.supplier_invoices||'[]')||[]).forEach(s=>{
          const n=(s.supplier||'').trim(); if(n) names.add(n);
        });
      }catch(e){}
    });
    const dl = document.getElementById('supplier-names');
    if(dl) dl.innerHTML = [...names].sort().map(n=>`<option value="${n.replace(/"/g,'&quot;')}">`).join('');
  }catch(e){ /* لا يؤثر على عمل النموذج */ }
}

// استعادة الجلسة لو المستخدم مسجّل دخول بالفعل
(async function(){
  if(!SB_ON) return;
  try{
    const { data } = await sb.auth.getSession();
    const u = data && data.session ? data.session.user : null;
    if(u){ const m=_mapUser(u.email); if(m){ CURRENT=m; enterApp(); } }
  }catch(e){}
})();

/* ══════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════ */
const APP_PAGES = ['home','cancel','disb','arc'];
// الصفحة الأم لكل شاشة — الرجوع بيوديك لها.
// الرئيسية مالهاش أم، فالرجوع منها بيخرج من التطبيق زي ما هو متوقّع.
let PAGE_PARENT = { home:null, disb:'home', cancel:'home', arc:'home' };
function setFormParent(parent){ PAGE_PARENT.disb = parent; PAGE_PARENT.cancel = parent; }
function currentPage(){
  return APP_PAGES.find(x=>document.getElementById('page-'+x)?.classList.contains('on')) || 'home';
}
function showPage(p, opts){
  if(APP_PAGES.indexOf(p) < 0) p = 'home';
  APP_PAGES.forEach(x=>{
    document.getElementById('page-'+x).classList.toggle('on', x===p);
    document.getElementById('nav-'+(x==='arc'?'arc':x)).classList.toggle('on', x===p);
  });
  document.getElementById('nav-cancel').classList.toggle('on', p==='cancel');
  document.getElementById('nav-disb').classList.toggle('on', p==='disb');
  document.getElementById('nav-arc').classList.toggle('on', p==='arc');
  if (p==='arc') loadArchive();
  if (p==='home') loadHome();
  window.scrollTo(0,0);
  if(!(opts && opts.fromHistory)){
    try{
      if((history.state && history.state.page) !== p) history.pushState({page:p}, '', '#'+p);
    }catch(e){}
  }
}
// الرجوع (زرار المتصفح أو السحب من الحافة)
window.addEventListener('popstate', ()=>{
  // ① نافذة مفتوحة؟ تتقفل ونفضل مكاننا
  const ov = document.querySelector('#app-confirm-overlay,#app-comments-overlay,#app-group-overlay');
  if(ov){
    ov.remove();
    const shown = currentPage();
    try{ history.pushState({page:shown}, '', '#'+shown); }catch(e){}
    return;
  }
  // ② قايمة منبثقة مفتوحة؟ تتقفل
  const pop = document.getElementById('arc-menu-pop');
  if(pop && pop.classList.contains('on')){
    closeArchiveMenu();
    const shown = currentPage();
    try{ history.pushState({page:shown}, '', '#'+shown); }catch(e){}
    return;
  }
  // ③ الرجوع للصفحة الأم
  const shown  = currentPage();
  const parent = PAGE_PARENT[shown];
  if(!parent) return;                    // الرئيسية: نسيب المتصفح يخرج
  showPage(parent, {fromHistory:true});
  try{ history.pushState({page:parent}, '', '#'+parent); }catch(e){}
});
(function initHistory(){
  try{
    const h = (location.hash||'').replace('#','');
    const p = APP_PAGES.indexOf(h)>=0 ? h : 'home';
    history.replaceState({page:p}, '', '#'+p);
  }catch(e){}
})();

/* ══════════════════════════════════════════
   DATES
══════════════════════════════════════════ */
const _t = new Date();
const _pad = n => String(n).padStart(2,'0');
const TODAY = _t.getFullYear()+'-'+_pad(_t.getMonth()+1)+'-'+_pad(_t.getDate());
document.getElementById('c-date').value = TODAY;
document.getElementById('d-date').value = TODAY;

/* ══════════════════════════════════════════
   AMOUNT → WORDS (EN + AR)
══════════════════════════════════════════ */
const ones_en=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
const tens_en=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
function b1000_en(n){ if(n<20)return ones_en[n]; if(n<100)return tens_en[Math.floor(n/10)]+(n%10?' '+ones_en[n%10]:''); return ones_en[Math.floor(n/100)]+' Hundred'+(n%100?' '+b1000_en(n%100):''); }
function toEn(n){ if(n===0)return'Zero'; let r=''; if(n>=1000000){r+=b1000_en(Math.floor(n/1000000))+' Million ';n%=1000000;} if(n>=1000){r+=b1000_en(Math.floor(n/1000))+' Thousand ';n%=1000;} if(n>0)r+=b1000_en(n); return r.trim(); }

const ones_ar=['','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة','عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر'];
const tens_ar=['','','عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون'];
const hund_ar=['','مائة','مائتان','ثلاثمائة','أربعمائة','خمسمائة','ستمائة','سبعمائة','ثمانمائة','تسعمائة'];
function b1000_ar(n){ if(n===0)return''; if(n<20)return ones_ar[n]; if(n<100){const t=tens_ar[Math.floor(n/10)];return n%10?ones_ar[n%10]+' و'+t:t;} const h=hund_ar[Math.floor(n/100)]; const r=n%100; return r?h+' و'+b1000_ar(r):h; }
function thou_ar(n){ if(n===1)return'ألف'; if(n===2)return'ألفان'; if(n<=10)return ones_ar[n]+' آلاف'; return b1000_ar(n)+' ألفاً'; }
function mil_ar(n){ if(n===1)return'مليون'; if(n===2)return'مليونان'; if(n<=10)return ones_ar[n]+' ملايين'; return b1000_ar(n)+' مليوناً'; }
function toAr(n){ if(n===0)return'صفر'; const p=[]; if(n>=1000000){p.push(mil_ar(Math.floor(n/1000000)));n%=1000000;} if(n>=1000){p.push(thou_ar(Math.floor(n/1000)));n%=1000;} if(n>0)p.push(b1000_ar(n)); return p.join(' و'); }

function fmtAmt(raw){ const neg=/^\s*-/.test(raw)?'-':''; let c=raw.replace(/[^0-9.]/g,''); const d=c.indexOf('.'); let i=d>=0?c.slice(0,d):c; let dec=d>=0?c.slice(d+1,d+3):null; i=i.replace(/\B(?=(\d{3})+(?!\d))/g,','); return neg+(dec!==null?i+'.'+dec:i); }
function parseAmt(s){ const n=parseFloat(String(s).replace(/,/g,'')); return isNaN(n)?0:n; }
function limitPrintText(el){
  const max = parseInt(el.dataset.printMax || el.maxLength || '0', 10);
  if(max > 0 && el.value.length > max) el.value = el.value.slice(0, max);
}
function fitPrintText(value, max=85){
  return String(value == null ? '' : value).slice(0, max);
}

function handleAmt(el){
  const pos=el.selectionStart, oldLen=el.value.length;
  const f=fmtAmt(el.value); el.value=f;
  const np=Math.max(0,pos+(f.length-oldLen)); el.setSelectionRange(np,np);
  updateDisbWords(f);
}
function updateDisbWords(val){
  const we=document.getElementById('d-words-en'), wa=document.getElementById('d-words-ar'), wr=document.getElementById('d-words');
  const n=parseAmt(val);
  if(!val||n===0){ we.textContent=''; wa.textContent=''; wr.classList.add('empty'); return; }
  const whole=Math.floor(n), cents=Math.round((n-whole)*100);
  let e='QAR '+toEn(whole); if(cents>0)e+=' and '+cents+'/100'; e+=' Only';
  let a=toAr(whole); if(cents>0)a+=t(' و')+cents+t(' درهم'); a+=t(' ريال قطري فقط لا غير');
  we.textContent=e; wa.textContent=a; wr.classList.remove('empty');
}

/* ══════════════════════════════════════════
   CANCELLATION — checkboxes + refund total
══════════════════════════════════════════ */
document.querySelectorAll('#c-alloc .chk input').forEach(cb=>{
  cb.addEventListener('change',()=> cb.closest('.chk').classList.toggle('on', cb.checked));
});
function recalcRefund(){
  let t=0;
  document.querySelectorAll('#refund-rows .r-amt').forEach(i=> t+=parseAmt(i.value));
  document.getElementById('refund-total').textContent = docAmount(t);
}

/* ══════════════════════════════════════════
   DISBURSEMENT — supplier rows
══════════════════════════════════════════ */
const DISB_MAIN_PRINT_ROWS = 6;
const MAX_DISB_TABLE_ROWS = 24;
function getDisbTableRowsCount(){
  return document.querySelectorAll('#supplier-rows tr').length + document.querySelectorAll('#client-rows tr').length;
}
function canAddDisbTableRow(){
  if(getDisbTableRowsCount() < MAX_DISB_TABLE_ROWS) return true;
  alert(t('لقد وصلت للحد الأقصى للمدخلات.\n\nالحد الأعلى هو {max} صفاً. الصفوف الزائدة عن {main} ستظهر في ملحق تفاصيل الفواتير عند الطباعة.').replace('{max}', MAX_DISB_TABLE_ROWS).replace('{main}', DISB_MAIN_PRINT_ROWS));
  return false;
}
function ensureDisbRowsPrintable(){
  const count = getDisbTableRowsCount();
  if(count <= MAX_DISB_TABLE_ROWS) return true;
  alert(t('لا يمكن طباعة الطلب بعدد الصفوف الحالي.\n\nالعدد الحالي: {n}\nالحد الأقصى: {max} صفاً.').replace('{n}', count).replace('{max}', MAX_DISB_TABLE_ROWS));
  return false;
}
function getDisbSupplierRows(){
  return [...document.querySelectorAll('#supplier-rows tr')].map((tr, idx)=>({
    idx: idx + 1,
    supplier: tr.querySelector('.s-name')?.value || '',
    invoice: tr.querySelector('.s-inv')?.value || '',
    amount: tr.querySelector('.s-amt')?.value || '0.00',
    tr
  }));
}
function getDisbClientRows(){
  return [...document.querySelectorAll('#client-rows tr')].map((tr, idx)=>({
    idx: idx + 1,
    invoice: tr.querySelector('.c-inv')?.value || '',
    share: tr.querySelector('.c-amt')?.value || '0.00',
    tr
  }));
}
// «طلب جديد» لازم يبدأ من نموذج فاضي — قبل كده كان بيفتح الصفحة
// بس فبيسيب بيانات آخر طلب اتفتح، وده خطر في نظام مالي.
// التنقّل من الشريط العلوي: «طلب صرف» معناها «عايز أعمل طلب صرف».
// لو النموذج شايل طلب محفوظ (EDIT_ID) نبدأ جديد — الطلب محفوظ في الأرشيف
// ومش هنخسر حاجة. لو شايل مسوّدة مش محفوظة نسيبها زي ما هي.
function goToForm(kind){
  setFormParent('home');
  if(EDIT_ID) startNewRequest(kind);
  else showPage(kind === 'cancel' ? 'cancel' : 'disb');
}
// لافتة توضّح وضع النموذج: تعديل طلب قائم / عرض فقط / (فاضي = طلب جديد)
function updateFormMode(kind){
  const bar = document.getElementById(kind + '-mode');
  if(!bar) return;
  if(VIEW_ONLY && EDIT_REQUEST){
    bar.className = 'form-mode view on';
    bar.textContent = t('عرض فقط') + ' — ' + (displayRequestNo(EDIT_REQUEST.req_no) || '');
  } else if(EDIT_ID && EDIT_REQUEST){
    bar.className = 'form-mode edit on';
    bar.textContent = t('تعديل طلب قائم') + ' — ' + (displayRequestNo(EDIT_REQUEST.req_no) || '');
  } else {
    bar.className = 'form-mode';
    bar.textContent = '';
  }
}
function startNewRequest(kind){
  setFormParent('home');
  if(kind === 'cancel'){ clearCancel(); showPage('cancel'); }
  else { clearDisb(); showPage('disb'); }
}
function clearDisbPrintAppendix(){
  document.getElementById('doc-disb')?.classList.remove('has-appendix','short-disb');
  document.querySelectorAll('#supplier-rows tr, #client-rows tr').forEach(tr=>tr.classList.remove('print-main-overflow'));
  setDisbMainTotalLabels(false);
  const appendix = document.getElementById('disb-appendix');
  if(appendix){
    appendix.classList.remove('on');
    appendix.innerHTML = '';
  }
}
function setDisbMainTotalLabels(hasAppendix){
  const supplierLabel = document.getElementById('supplier-total-label');
  const clientLabel = document.getElementById('client-total-label');
  if(supplierLabel){
    supplierLabel.textContent = hasAppendix ? t('إجمالي كل الصفوف · All Rows Total') : t('الإجمالي · Total');
  }
  if(clientLabel){
    clientLabel.textContent = hasAppendix ? t('إجمالي كل صفوف مركز التكلفة · All Rows Total') : t('إجمالي مركز التكلفة · Total Cost Center');
  }
}
function markDisbMainRowsForPrint(supplierRows, clientRows){
  let printed = 0;
  [...supplierRows, ...clientRows].forEach(row=>{
    printed += 1;
    row.tr.classList.toggle('print-main-overflow', printed > DISB_MAIN_PRINT_ROWS);
  });
}
function renderAppendixSupplierRows(rows){
  if(!rows.length) return '';
  return `
    <div class="sec-title"><span class="ar">${t('فواتير المورد - التفاصيل الكاملة')}</span><span class="en">Supplier Invoices - Full Details</span></div>
    <table class="appendix-table">
      <thead><tr><th style="width:10%">#</th><th style="width:36%">${t('المورّد')}<small>Supplier</small></th><th style="width:32%">${t('رقم الفاتورة')}<small>Invoice No.</small></th><th style="width:22%">${t('المبلغ ر.ق')}<small>Amount QAR</small></th></tr></thead>
      <tbody>${rows.map(r=>`
        <tr><td class="num">${r.idx}</td><td>${escapeHtml(r.supplier || '—')}</td><td>${escapeHtml(r.invoice || '—')}</td><td class="num">${escapeHtml(r.amount || '0.00')}</td></tr>
      `).join('')}</tbody>
      <tfoot><tr class="appendix-total"><td colspan="3">${t('الإجمالي · Total')}</td><td class="num">${escapeHtml(document.getElementById('supplier-total')?.textContent || '0.00')}</td></tr></tfoot>
    </table>`;
}
function renderAppendixClientRows(rows){
  if(!rows.length) return '';
  return `
    <div class="sec-title"><span class="ar">${t('مركز التكلفة - التفاصيل الكاملة')}</span><span class="en">Cost Center - Full Details</span></div>
    <table class="appendix-table">
      <thead><tr><th style="width:10%">#</th><th style="width:58%"><span dir="rtl">${t('رقم فاتورة العميل')}</span> - <span dir="ltr">Odoo</span><small>Client Invoice No. - Odoo</small></th><th style="width:32%">${t('النصيب ر.ق')}<small>Share QAR</small></th></tr></thead>
      <tbody>${rows.map(r=>`
        <tr><td class="num">${r.idx}</td><td>${escapeHtml(r.invoice || '—')}</td><td class="num">${escapeHtml(r.share || '0.00')}</td></tr>
      `).join('')}</tbody>
      <tfoot><tr class="appendix-total"><td colspan="2">${t('إجمالي مركز التكلفة · Total Cost Center')}</td><td class="num">${escapeHtml(document.getElementById('client-total')?.textContent || '0.00')}</td></tr></tfoot>
    </table>`;
}
function prepareDisbPrintAppendix(){
  clearDisbPrintAppendix();
  const supplierRows = getDisbSupplierRows();
  const clientRows = getDisbClientRows();
  const totalRows = supplierRows.length + clientRows.length;
  const doc = document.getElementById('doc-disb');
  if(totalRows <= DISB_MAIN_PRINT_ROWS){
    doc?.classList.toggle('short-disb', totalRows <= 2);
    return;
  }
  markDisbMainRowsForPrint(supplierRows, clientRows);
  setDisbMainTotalLabels(true);
  doc?.classList.add('has-appendix');
  const appendix = document.getElementById('disb-appendix');
  if(!appendix) return;
  const reqNo = document.getElementById('d-reqno')?.value || 'PV';
  appendix.innerHTML = `
    <div class="appendix-head">
      <div><b>${t('ملحق تفاصيل الفواتير')}</b><small>Invoice Details Appendix</small></div>
      <span>${escapeHtml(reqNo)}</span>
    </div>
    ${renderAppendixSupplierRows(supplierRows)}
    ${renderAppendixClientRows(clientRows)}
  `;
  appendix.classList.add('on');
}
function addSupplierRow(supplier='',inv='',amt='', skipLimit=false){
  if(!skipLimit && !canAddDisbTableRow()) return;
  const tb=document.getElementById('supplier-rows');
  const tr=document.createElement('tr');
  tr.innerHTML=`
    <td><input type="text" class="s-name" list="supplier-names" placeholder="${t('اسم المورّد')}" data-i18n-attr="placeholder|اسم المورّد" value="${supplier}"></td>
    <td><input type="text" class="s-inv"  placeholder="${t('رقم الفاتورة')}" data-i18n-attr="placeholder|رقم الفاتورة" value="${inv}"></td>
    <td class="amt-cell"><input type="text" class="s-amt" placeholder="0.00" value="${amt}" oninput="handleSupplierAmt(this)"></td>
    <td class="no-print"><button class="del-row" onclick="this.closest('tr').remove();recalcSupplier()">✕</button></td>`;
  tb.appendChild(tr);
  if(typeof updateMatch==='function') updateMatch();
}
function handleSupplierAmt(el){
  const pos=el.selectionStart, oldLen=el.value.length;
  const f=fmtAmt(el.value); el.value=f;
  const np=Math.max(0,pos+(f.length-oldLen)); el.setSelectionRange(np,np);
  recalcSupplier();
}
function recalcSupplier(){
  let t=0;
  document.querySelectorAll('#supplier-rows .s-amt').forEach(i=> t+=parseAmt(i.value));
  document.getElementById('supplier-total').textContent = docAmount(t);
  if(typeof updateMatch==='function') updateMatch();
}
addSupplierRow(); // start with one row

/* ── فواتير العميل — نصيب كل فاتورة من فاتورة المورّد ── */
function addClientRow(inv='',amt='', skipLimit=false){
  if(!skipLimit && !canAddDisbTableRow()) return;
  const tb=document.getElementById('client-rows');
  const tr=document.createElement('tr');
  tr.innerHTML=`
    <td><input type="text" class="c-inv" placeholder="${t('رقم فاتورة العميل - ‎Odoo')}" data-i18n-attr="placeholder|رقم فاتورة العميل - ‎Odoo" value="${inv}"></td>
    <td class="amt-cell"><input type="text" class="c-amt" placeholder="0.00" value="${amt}" oninput="handleClientAmt(this)"></td>
    <td class="no-print"><button class="del-row" onclick="this.closest('tr').remove();recalcClient()">✕</button></td>`;
  tb.appendChild(tr);
  if(typeof updateMatch==='function') updateMatch();
}
function handleClientAmt(el){
  const pos=el.selectionStart, oldLen=el.value.length;
  const f=fmtAmt(el.value); el.value=f;
  const np=Math.max(0,pos+(f.length-oldLen)); el.setSelectionRange(np,np);
  recalcClient();
}
function recalcClient(){
  let t=0;
  document.querySelectorAll('#client-rows .c-amt').forEach(i=> t+=parseAmt(i.value));
  document.getElementById('client-total').textContent = docAmount(t);
  updateMatch();
}
function isCostCenterDisabled(){
  return !!document.getElementById('d-cost-disabled')?.checked;
}
function updateCostCenterDisabledUI(){
  const off = isCostCenterDisabled();
  const doc = document.getElementById('doc-disb');
  const locked = doc?.dataset.locked === '1';
  if(doc) doc.classList.toggle('cost-center-disabled', off);
  document.querySelectorAll('#client-rows input').forEach(input=>{ input.disabled = locked || off; });
  const addBtn = document.getElementById('add-client-row-btn');
  if(addBtn) addBtn.disabled = locked || off;
}
function toggleCostCenter(){
  updateCostCenterDisabledUI();
  updateMatch();
}
function updateMatch(){
  const sup = parseAmt(document.getElementById('supplier-total').textContent);
  const cli = parseAmt(document.getElementById('client-total').textContent);
  const box = document.getElementById('client-match');
  if(!box) return;
  const hasAppendix = getDisbTableRowsCount() > DISB_MAIN_PRINT_ROWS;
  const appendixHint = hasAppendix ? t('<span class="appendix-hint">التفاصيل الكاملة في الملحق التالي · See appendix</span>') : '';
  updateCostCenterDisabledUI();
  if(isCostCenterDisabled()){
    box.style.display='none';
    box.innerHTML='';
    return;
  }
  if(sup===0 && cli===0){
    if(!hasAppendix){ box.style.display='none'; return; }
    box.style.display='flex';
    box.className='match-note info';
    box.innerHTML=appendixHint;
    return;
  }
  box.style.display='flex';
  const diff = Math.round((cli - sup)*100)/100;
  if(Math.abs(diff) < 0.005){
    box.className='match-note ok';
    box.innerHTML=t('✓ إجمالي مركز التكلفة مطابق لإجمالي فاتورة المورّد <small>(')+sup.toLocaleString('en-US',{minimumFractionDigits:2})+t(' ر.ق)</small>')+appendixHint;
  } else {
    box.className='match-note bad';
    const sign = diff>0 ? t('أكبر') : t('أقل');
    box.innerHTML=t('✗ الإجمالي لا يساوي إجمالي فاتورة المورّد —')+' '+sign+t(' بمقدار <small>')+Math.abs(diff).toLocaleString('en-US',{minimumFractionDigits:2})+t(' ر.ق</small>')+appendixHint;
  }
}
addClientRow(); // أول صف

/* ── طريقة استرجاع المبلغ (تحويل فوري / حساب بنكي) ── */
function setPayout(m){
  const fawran = m==='fawran';
  document.getElementById('c-pill-fawran').classList.toggle('on', fawran);
  document.getElementById('c-pill-bank').classList.toggle('on', !fawran);
  document.getElementById('c-field-fawran').classList.toggle('on', fawran);
  document.getElementById('c-field-bank').classList.toggle('on', !fawran);
}

/* ══════════════════════════════════════════
   ATTACHMENTS
══════════════════════════════════════════ */
let ATTACHED = [];
const ATTACH_ICONS = {
  file:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path></svg>',
  clip:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.4 11.6-8.5 8.5a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"></path></svg>'
};
function escapeHtml(value){
  return String(value||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}
function getAttachmentLabel(attachment){
  if(typeof attachment==='string'){
    return attachment.split('/').pop() || attachment;
  }
  return attachment && attachment.name ? attachment.name : 'attachment.pdf';
}
function getAttachmentSize(attachment){
  if(attachment instanceof Blob && typeof attachment.size==='number'){
    return `${(attachment.size/1024).toFixed(0)} KB`;
  }
  return t('(محفوظ)');
}
function getAttachmentMime(attachment){
  if(attachment instanceof Blob && attachment.type) return attachment.type;
  const name = getAttachmentLabel(attachment).toLowerCase();
  if(name.endsWith('.pdf')) return 'application/pdf';
  if(/\.(jpe?g)$/i.test(name)) return 'image/jpeg';
  if(/\.png$/i.test(name)) return 'image/png';
  if(/\.gif$/i.test(name)) return 'image/gif';
  if(/\.webp$/i.test(name)) return 'image/webp';
  if(/\.bmp$/i.test(name)) return 'image/bmp';
  if(/\.svg$/i.test(name)) return 'image/svg+xml';
  if(/\.(heic|heif)$/i.test(name)) return 'image/heic';
  return 'application/octet-stream';
}
function isAllowedInvoiceAttachment(file){
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  return type === 'application/pdf'
    || type.startsWith('image/')
    || /\.(pdf|jpe?g|png|gif|webp|bmp|svg|heic|heif)$/i.test(name);
}
function addFiles(fileList){
  for (const f of fileList){
    if (isAllowedInvoiceAttachment(f)){
      ATTACHED.push(f);
    }
  }
  renderAttach();
}
function renderAttach(){
  const box=document.getElementById('attach-list');
  box.innerHTML = ATTACHED.map((f,i)=>`
    <div class="attach-item">
      <span class="ico">${typeof f==='string' ? ATTACH_ICONS.clip : ATTACH_ICONS.file}</span>
      <span class="nm">${escapeHtml(getAttachmentLabel(f))}</span>
      <span class="sz">${escapeHtml(getAttachmentSize(f))}</span>
      <div class="attach-actions no-print">
        <button class="att-btn" onclick="previewAttachment(${i})">${t('معاينة')}</button>
        <button class="att-btn" onclick="downloadAttachment(${i})">${t('تنزيل')}</button>
        <button class="rm" onclick="removeFile(${i})">✕</button>
      </div>
    </div>`).join('');
}
function removeFile(i){ ATTACHED.splice(i,1); renderAttach(); }
async function previewAttachment(i){
  const attachment = ATTACHED[i];
  if(!attachment){ alert(t('لا يوجد مرفق.')); return; }
  if(attachment instanceof Blob){
    const url = URL.createObjectURL(attachment);
    window.open(url, '_blank');
    setTimeout(()=>URL.revokeObjectURL(url), 40000);
    return;
  }
  await openSourceInNewTab(attachment);
}
async function downloadAttachment(i){
  const attachment = ATTACHED[i];
  if(!attachment){ alert(t('لا يوجد مرفق.')); return; }
  try{
    const bytes = await getAttachmentBytes(attachment);
    const name = getAttachmentLabel(attachment) || `attachment_${i+1}.pdf`;
    dl(new Blob([bytes], { type:getAttachmentMime(attachment) }), name);
  }catch(e){
    alert(t('تعذّر تنزيل المرفق.'));
    console.error(e);
  }
}

/* ══════════════════════════════════════════
   ELECTRONIC SIGNATURE
══════════════════════════════════════════ */
let SIGNED = { cancel:null, disb:null };
let ACC_SIGN = { cancel:null, disb:null }; // اعتماد الحسابات مفصول لكل نوع طلب
let EDIT_ID  = null;      // id الطلب المفتوح من الأرشيف (لو موجود)
let EDIT_REQUEST = null;  // بيانات الطلب المفتوح من الأرشيف
let VIEW_ONLY = false;    // فتح الطلب للعرض فقط (بدون تعديل)
function getAccSign(kind){ return ACC_SIGN[kind] || null; }
function setAccSign(kind, value){ ACC_SIGN[kind] = value || null; }
function isApprovedRequest(x){ return !!(x && x.accounts_signed_by); }
function isOwnRequest(x){ return !!(CURRENT && x && x.created_by === CURRENT.name); }
function canCurrentEditRequest(x){
  if(CURRENT && CURRENT.role === 'viewer') return false;   // حساب العرض فقط
  if(!x) return true;                                      // طلب جديد
  if(x.cancelled) return false;                            // ملغي = مقفول للجميع
  if(!isOwnRequest(x)) return false;                       // مش صاحب الطلب = مقفول (المحاسب كمان)
  if(isApprovedRequest(x)) return false;                   // معتمد = مقفول حتى لصاحبه
  return true;                                             // صاحبه وقبل الاعتماد = يعدّل
}
function setDocumentLocked(kind, locked){
  const doc = document.getElementById(kind === 'cancel' ? 'doc-cancel' : 'doc-disb');
  if(doc){
    doc.dataset.locked = locked ? '1' : '0';
    doc.querySelectorAll('input, textarea, select, button').forEach(el=>{
      if(el.classList.contains('no-lock')) return;
      // الاعتماد والطباعة شغّالين دايمًا حتى لو الطلب مقفول للتعديل
      if(/-acc-btn$/.test(el.id || '')) return;
      if(el.classList.contains('btn-print')) return;
      el.disabled = !!locked;
    });
    doc.querySelectorAll('.attach-zone').forEach(el=>{
      el.style.pointerEvents = locked ? 'none' : '';
      el.style.opacity = locked ? '.55' : '';
    });
  }
  const saveBtn = document.getElementById(kind + '-save-btn');
  if(saveBtn) saveBtn.disabled = !!locked;
  if(kind === 'disb' && typeof updateCostCenterDisabledUI === 'function') updateCostCenterDisabledUI();
}
function applyArchiveEditLock(kind, request){
  updateFormMode(kind);
  setTimeout(refreshPadStates,0);
  const locked = VIEW_ONLY || !!(request && !canCurrentEditRequest(request));
  setDocumentLocked(kind, locked);
  if(VIEW_ONLY){
    const status = document.getElementById(kind + '-pdf-status');
    if(status) status.textContent = t('أنت تعرض الطلب للقراءة فقط — اختر «تعديل الطلب» من الأرشيف للتعديل عليه.');
    return;
  }
  if(locked && request){
    const status = document.getElementById(kind + '-pdf-status');
    if(status){
      status.textContent = request.cancelled
        ? t('هذا الطلب ملغي — متاح للعرض والطباعة فقط.')
        : (!isOwnRequest(request)
            ? t('هذا الطلب من إنشاء موظف آخر — متاح للعرض والطباعة والاعتماد فقط، ولا يمكن تعديله.')
            : t('هذا الطلب معتمد من الحسابات، متاح للطباعة فقط ولا يمكن تعديله.'));
    }
  }
}

// أول حرفين من الاسم (مونوغرام التوقيع)
// خريطة الاسم (عربي أو إنجليزي) → الحروف الأولى بالإنجليزي (للإمضاء بخط اليد)
// تحويل أول حرف عربي لما يقابله لاتينيًا — التوقيع لاتيني دائمًا
const AR2LAT = {
  'ا':'A','أ':'A','إ':'I','آ':'A','ء':'A','ع':'A',
  'ب':'B','ت':'T','ث':'T','ط':'T','ظ':'Z',
  'ج':'J','ح':'H','خ':'K','ه':'H','ة':'H',
  'د':'D','ذ':'D','ض':'D','ر':'R','ز':'Z',
  'س':'S','ش':'S','ص':'S','غ':'G','ف':'F','ق':'Q',
  'ك':'K','ل':'L','م':'M','ن':'N','و':'W','ي':'Y','ى':'Y'
};
function latinInitial(ch){
  if(!ch) return '';
  if(AR2LAT[ch]) return AR2LAT[ch];
  const up = String(ch).toUpperCase();
  return /^[A-Z]$/.test(up) ? up : '';
}
const INITIALS_MAP = (function(){
  const m = {};
  Object.values(USER_MAP).forEach(u=>{
    const en = String(u.name_en||'').trim();
    const p  = en.split(/\s+/).filter(Boolean);
    const ini = dottedInitials(p);
    if(ini){ m[String(u.name||'').trim()] = ini; m[en] = ini; }
  });
  return m;
})();
// الحرفان الأولان مفصولان بنقطة: مثال "Anas Ibrahim" → "A.I"
function dottedInitials(parts){
  return [parts[0]&&parts[0][0], parts[1]&&parts[1][0]]
    .filter(Boolean).map(latinInitial).filter(Boolean).join('.');
}
// ═══ أفاتار الموظف: أحرف أولى + تلميح باسمه الكامل عند المرور ═══
// التلميح عنصر واحد في body لأن .arc-wrap عليها overflow:hidden وكان هيتقص.
function personAvatar(name){
  const full = personName(name || '') || '—';
  return `<span class="pav" data-name="${escAttr(full)}" role="img" aria-label="${escAttr(full)}">${escapeHtml(initials(name))}</span>`;
}
let PAV_TIP = null;
function pavTip(){
  if(!PAV_TIP){
    PAV_TIP = document.createElement('div');
    PAV_TIP.id = 'pav-tip';
    document.body.appendChild(PAV_TIP);
  }
  return PAV_TIP;
}
function showPavTip(el){
  const name = el.getAttribute('data-name'); if(!name) return;
  const tip = pavTip();
  tip.textContent = name;
  tip.classList.add('on');
  const r = el.getBoundingClientRect();
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let left = r.left + r.width/2 - w/2;
  left = Math.max(8, Math.min(left, innerWidth - w - 8));
  let top = r.top - h - 8;
  if(top < 8) top = r.bottom + 8;              // لو مفيش مكان فوق، تحت
  tip.style.left = left + 'px';
  tip.style.top  = top + 'px';
}
function hidePavTip(){ if(PAV_TIP) PAV_TIP.classList.remove('on'); }
document.addEventListener('mouseover', e=>{
  if(!e.target.closest) return;
  const a = e.target.closest('.pav');
  if(a){ showPavTip(a); return; }
  const n = e.target.closest('.pav-name');
  if(n && n.scrollWidth > n.clientWidth + 1) showPavTip(n);   // بس لو الاسم مقصوص
});
document.addEventListener('mouseout', e=>{
  if(e.target.closest && (e.target.closest('.pav') || e.target.closest('.pav-name'))) hidePavTip();
});
document.addEventListener('focusin',  e=>{ const a=e.target.closest&&e.target.closest('.pav'); if(a) showPavTip(a); });
document.addEventListener('focusout', hidePavTip);
window.addEventListener('scroll', hidePavTip, true);
function initials(name){
  const key = String(name||'').trim();
  if(INITIALS_MAP[key]) return INITIALS_MAP[key];
  const parts = key.split(/\s+/).filter(Boolean);
  // الحروف الأولى من أول كلمتين، بالإنجليزي دائمًا (Capital) ومفصولة بنقطة
  return dottedInitials(parts);
}
// التاريخ والساعة بالإنجليزي: 05/06/2026 · 02:15 PM
function stampDate(d){
  d = d ? (d instanceof Date ? d : new Date(d)) : new Date();
  if(isNaN(d)) d = new Date();
  const p = n => String(n).padStart(2,'0');
  const dd=p(d.getDate()), mm=p(d.getMonth()+1), yy=d.getFullYear();
  let h=d.getHours(); const min=p(d.getMinutes()); const ap=h>=12?'PM':'AM';
  h=h%12; if(h===0) h=12;
  return `${dd}/${mm}/${yy} · ${p(h)}:${min} ${ap}`;
}

// المبلغ يتكتب زي ما هو، ولما تسيب الحقل يتنسّق لخانتين عشريتين
// عشان يبقى على نفس صيغة الإجمالي (3,333 → 3,333.00).
document.addEventListener('blur', (e)=>{
  const el = e.target;
  if(!el || !el.classList) return;
  if(!el.classList.contains('s-amt') && !el.classList.contains('c-amt')
     && !el.classList.contains('r-amt') && !el.classList.contains('amt-input')) return;
  const raw = String(el.value||'').replace(/,/g,'').trim();
  if(raw === '') return;
  const n = Number(raw);
  if(!isFinite(n)) return;
  el.value = docAmount(n);
}, true);
// اعتماد الحسابات من الخانة نفسها — نفس منطق التوقيع
// اعتماد إدارة الحسابات (للمحاسب فقط) — من النموذج أو من الأرشيف، لطلب الصرف أو الإلغاء
async function signAccountsFor(kind){
  if(!CURRENT || CURRENT.role!=='accountant'){ alert(t('اعتماد الحسابات متاح للمحاسب فقط.')); return; }
  const pfx = kind === 'cancel' ? 'cancel' : 'disb';
  const now=new Date();
  const dt = stampDate(now);
  setAccSign(pfx, { name:CURRENT.name, time:now.toISOString(), label:dt });
  document.getElementById(pfx+'-acc-ph').style.display='none';
  document.getElementById(pfx+'-acc-stamp').classList.add('on');
  document.getElementById(pfx+'-acc-mono').textContent = initials(CURRENT.name);
  document.getElementById(pfx+'-acc-name').textContent = personName(CURRENT.name);
  document.getElementById(pfx+'-acc-meta').textContent = dt;
  refreshPadStates();
  if(typeof loadNotifs==='function') setTimeout(loadNotifs, 800);
  if(EDIT_ID && SB_ON){
    const btn=document.getElementById(pfx+'-acc-btn'); const o=btn?btn.innerHTML:'';
    if(btn){ btn.disabled=true; btn.textContent=t('جاري الاعتماد...'); }
    try{
      const { error } = await sb.from('requests').update({
        accounts_signed_by: CURRENT.name, accounts_signed_at: now.toISOString()
      }).eq('id', EDIT_ID);
      if(error){ console.error(error); alert(t('تعذّر حفظ الاعتماد — تأكّد من تفعيل سياسة التعديل (update) في Supabase (راجع كود SQL في التعليمات).')); }
      else {
        if(EDIT_REQUEST){
          EDIT_REQUEST = { ...EDIT_REQUEST, accounts_signed_by: CURRENT.name, accounts_signed_at: now.toISOString() };
        }
        showMessageDialog({
          title:t('تم اعتماد الطلب'),
          message:t('تم اعتماد الطلب من إدارة الحسابات وحفظه في الأرشيف.'),
          details:[
            { label:t('رقم الطلب'), value: displayRequestNo(EDIT_REQUEST?.req_no) || '—', ltr:true },
            { label:t('معتمد بواسطة'), value: CURRENT.name },
            { label:t('وقت الاعتماد'), value: dt, ltr:true }
          ],
          note:t('الطلب الآن متاح للطباعة.'),
          confirmText:t('حسنًا')
        });
      }
    }catch(e){ alert(t('خطأ اتصال بـ Supabase.')); console.error(e); }
    if(btn){ btn.disabled=false; btn.innerHTML=o; }
  }
}
/* سفاري يرجّع بعض الألوان المحسوبة بصيغة color(srgb …) — من color-mix
   أو أي دالة لون حديثة — وhtml2canvas 1.4.1 لا يعرف قراءتها فيفشل
   التصوير كله برسالة "unsupported color function". نحوّلها إلى rgb
   على النسخة المستنسخة قبل التصوير، فلا يبقى للمشكلة مصدر أصلاً.
   نكتبها بـ important لأن قواعد الطباعة تستخدمه، وبدونه لا يُطبَّق. */
const MODERN_COLOR_PROPS = [
  ['color','color'], ['backgroundColor','background-color'],
  ['borderTopColor','border-top-color'], ['borderRightColor','border-right-color'],
  ['borderBottomColor','border-bottom-color'], ['borderLeftColor','border-left-color'],
  ['outlineColor','outline-color'], ['boxShadow','box-shadow'],
  ['textDecorationColor','text-decoration-color'], ['columnRuleColor','column-rule-color'],
  ['caretColor','caret-color'], ['fill','fill'], ['stroke','stroke'],
  ['backgroundImage','background-image'],
];
function normalizeModernColors(doc){
  const chan = (x)=> Math.round(Math.min(1, Math.max(0, parseFloat(x) || 0)) * 255);
  const conv = (v)=> v.replace(
    /color\(\s*(?:srgb|srgb-linear|display-p3|a98-rgb|prophoto-rgb|rec2020)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.%]+))?\s*\)/g,
    (_m, r, g, b, a)=> a === undefined
      ? `rgb(${chan(r)}, ${chan(g)}, ${chan(b)})`
      : `rgba(${chan(r)}, ${chan(g)}, ${chan(b)}, ${parseFloat(a)})`);
  const view = doc.defaultView || window;
  const nodes = [doc.documentElement, doc.body, ...doc.querySelectorAll('*')];
  for(const node of nodes){
    if(!node || !node.style) continue;
    let cs; try{ cs = view.getComputedStyle(node); }catch(_e){ continue; }
    if(!cs) continue;
    for(const [js, css] of MODERN_COLOR_PROPS){
      const val = cs[js];
      if(val && val.indexOf('color(') !== -1) node.style.setProperty(css, conv(val), 'important');
    }
  }
}
/* النسخة الفعلية المخزَّنة على الجهاز — تُلحَق برسائل الأعطال حتى
   نعرف فوراً إن كان الجهاز يشغّل نسخة قديمة بدل التخمين. */
async function activeCacheVersion(){
  try{
    const keys = await caches.keys();
    const hit = keys.find(k => k.indexOf('zamzam-v') === 0);
    return hit || '—';
  }catch(_e){ return '—'; }
}
/* تلتقط عنصراً واحداً وتُرجع الكانفس مع حدود القص الآمنة داخله */
async function captureDocElement(el, captureScale){
  const hidden = [...el.querySelectorAll('.attach-zone, .attach-list, #attach-list, .attach-item, #disb-attach-sec, .add-row-btn')];
  const originalDisplay = hidden.map(node=>[node, node.style.display]);
  const originalStyles = {
    width: el.style.width, maxWidth: el.style.maxWidth, margin: el.style.margin,
    boxShadow: el.style.boxShadow, borderRadius: el.style.borderRadius, transform: el.style.transform,
  };
  hidden.forEach(node=>node.style.display='none');
  el.style.width = '210mm'; el.style.maxWidth = '210mm'; el.style.margin = '0 auto';
  el.style.boxShadow = 'none'; el.style.borderRadius = '0'; el.style.transform = 'none';
  const safeBreaks = [];
  let capturedHeight = 0, canvas;
  try{
    await new Promise(requestAnimationFrame);
    capturedHeight = el.scrollHeight || el.getBoundingClientRect().height || 0;
    const top = el.getBoundingClientRect().top;
    el.querySelectorAll('.doc-body > *, .inv-table tr, .refund-table tr, .appendix-table tr')
      .forEach(node=>{
        const r = node.getBoundingClientRect();
        if(r.height > 0) safeBreaks.push(r.bottom - top);
      });
    safeBreaks.sort((a,b)=>a-b);
    canvas = await html2canvas(el,{scale:captureScale,backgroundColor:'#ffffff',useCORS:true,
      onclone:(cloneDoc)=>{ try{ normalizeModernColors(cloneDoc); }catch(_e){} },
      scrollX:0, scrollY:0, windowWidth:el.scrollWidth, windowHeight:el.scrollHeight,
      ignoreElements:(n)=>n.classList&&n.classList.contains('no-print')});
  }finally{
    originalDisplay.forEach(([node, value])=>{ node.style.display = value; });
    el.style.width = originalStyles.width; el.style.maxWidth = originalStyles.maxWidth;
    el.style.margin = originalStyles.margin; el.style.boxShadow = originalStyles.boxShadow;
    el.style.borderRadius = originalStyles.borderRadius; el.style.transform = originalStyles.transform;
  }
  return { canvas, safeBreaks, capturedHeight };
}
async function generateRequestPDF(docId='doc-disb', opts={}){
  const captureScale = opts.scale || 3;
  const imgFormat = (opts.format || 'PNG').toUpperCase();
  const imgQuality = opts.quality || 0.92;
  commitValuesForPrint();
  await document.fonts.ready;
  const el = document.getElementById(docId);
  if(!el) throw new Error('doc not found: ' + docId);

  // الملحق شقيق للوثيقة لا ابن لها، فلا يدخل في تصويرها. نلتقطه على حدة
  // ونضيفه صفحاتٍ تالية، وإلا نزل الملف بالصفحة الأولى وحدها.
  const parts = [el];
  if(docId === 'doc-disb'){
    const ap = document.getElementById('disb-appendix');
    if(ap && ap.classList.contains('on') && (ap.innerHTML||'').trim()) parts.push(ap);
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p','mm','a4');
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const PX_TO_MM = 0.2645833333;
  const cut = document.createElement('canvas');
  const cx  = cut.getContext('2d');
  let firstPage = true;

  for(const part of parts){
    const { canvas, safeBreaks, capturedHeight } = await captureDocElement(part, captureScale);
    if(!canvas || !canvas.width || !canvas.height) continue;
    const canvasWidthMm  = canvas.width  * PX_TO_MM;
    const canvasHeightMm = canvas.height * PX_TO_MM;
    // العرض دائماً عرض A4 كامل — لا تصغير يترك هوامش بيضاء
    const pdfScale = canvasWidthMm > 0 ? Math.min(1, pw / canvasWidthMm) : 1;
    const imgW = canvasWidthMm * pdfScale;
    const imgH = canvasHeightMm * pdfScale;
    const offsetX = Math.max(0, (pw - imgW) / 2);

    const pxPerMm  = canvas.height / imgH;
    const pageHeight = ph * pxPerMm;
    const domToPx  = capturedHeight > 0 ? canvas.height / capturedHeight : 0;
    const breaksPx = domToPx ? safeBreaks.map(v=>v*domToPx) : [];
    const MIN_FILL = pageHeight * 0.55;

    const slices = [];
    let y = 0, guard = 0;
    while(y < canvas.height - 1 && guard++ < 60){
      let end = y + pageHeight;
      if(end >= canvas.height){ end = canvas.height; }
      else {
        const fits = breaksPx.filter(b => b > y + MIN_FILL && b <= end);
        if(fits.length) end = fits[fits.length - 1];
      }
      slices.push({ y, h: Math.max(1, Math.round(end - y)) });
      y = end;
    }

    for(const sl of slices){
      if(!firstPage) pdf.addPage();
      firstPage = false;
      cut.width = canvas.width; cut.height = sl.h;
      cx.fillStyle = '#ffffff';
      cx.fillRect(0, 0, cut.width, cut.height);
      cx.drawImage(canvas, 0, sl.y, canvas.width, sl.h, 0, 0, canvas.width, sl.h);
      const img = imgFormat === 'JPEG' ? cut.toDataURL('image/jpeg', imgQuality) : cut.toDataURL('image/png');
      pdf.addImage(img, imgFormat, offsetX, 0, imgW, sl.h / pxPerMm);
    }
  }
  return pdf.output('arraybuffer');
}

async function signDisbAccounts(){ return signAccountsFor('disb'); }

async function signCancelAccounts(){ return signAccountsFor('cancel'); }

function signAccFromPad(kind){
  if(!CURRENT || CURRENT.role !== 'accountant') return;
  const doc = document.getElementById(kind === 'cancel' ? 'doc-cancel' : 'doc-disb');
  if(doc && doc.dataset.locked === '1' && !EDIT_ID) return;
  if(ACC_SIGN[kind]) return;
  signAccountsFor(kind);
}
// حالة الخانات: نضيف صنف يوضّح إن الضغط متاح دلوقتي أو لأ
function refreshPadStates(){
  const PEN   = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>';
  const paint = (pad, ready, icon, label) => {
    if(!pad) return;
    pad.classList.toggle('pad-ready', !!ready);
    let cta = pad.querySelector('.pad-cta');
    if(!ready){ if(cta) cta.remove(); return; }
    if(!cta){
      cta = document.createElement('span');
      cta.className = 'pad-cta no-print';
      pad.appendChild(cta);
    }
    cta.innerHTML = icon + '<b></b>';
    cta.querySelector('b').textContent = label;
  };
  ['disb','cancel'].forEach(k=>{
    const doc = document.getElementById(k === 'cancel' ? 'doc-cancel' : 'doc-disb');
    const locked = doc && doc.dataset.locked === '1';
    paint(document.getElementById(k+'-sig-pad'),
          !locked && !SIGNED[k] && CURRENT && CURRENT.role !== 'viewer',
          PEN, t('اضغط للتوقيع'));
    paint(document.getElementById(k+'-acc-pad'),
          !ACC_SIGN[k] && CURRENT && CURRENT.role === 'accountant',
          CHECK, t('اضغط للاعتماد'));
  });
}
function signFromPad(kind){
  const doc = document.getElementById(kind === 'cancel' ? 'doc-cancel' : 'doc-disb');
  if(doc && doc.dataset.locked === '1') return;
  if(SIGNED[kind]) return;
  signDoc(kind);
}
function signDoc(kind){
  if(!CURRENT) return;
  if(CURRENT.role==='viewer'){
    showMessageDialog({ title:t('صلاحية العرض فقط'), message:t('حسابك مخصّص للعرض والطباعة فقط، ولا يمكنك التوقيع على الطلبات.'), confirmText:t('حسنًا') });
    return;
  }
  const now=new Date();
  const dt = stampDate(now);
  SIGNED[kind] = { name:CURRENT.name, user:CURRENT.user, time:now.toISOString(), label:dt };
  document.getElementById(kind+'-sig-ph').style.display='none';
  document.getElementById(kind+'-sig-stamp').classList.add('on');
  document.getElementById(kind+'-sig-mono').textContent = initials(CURRENT.name);
  document.getElementById(kind+'-sig-name').textContent = personName(CURRENT.name);
  document.getElementById(kind+'-sig-meta').textContent = dt;
  refreshPadStates();
  if(typeof loadNotifs==='function') setTimeout(loadNotifs, 800);
  showMessageDialog({
    title:t('تم التوقيع الإلكتروني'),
    message:t('تم تسجيل توقيعك الإلكتروني على الطلب بنجاح.'),
    details:[
      { label:t('الموقّع'), value:CURRENT.name },
      { label:t('وقت التوقيع'), value:dt, ltr:true }
    ],
    note:t('يمكنك الآن تقديم الطلب أو طباعته حسب الإجراء المطلوب.'),
    confirmText:t('حسنًا')
  });
}
async function getAttachmentBytes(attachment){
  if(attachment instanceof Blob){
    return await attachment.arrayBuffer();
  }
  if(typeof attachment==='string'){
    if(isDataUrl(attachment)){
      return await dataUrlToBlob(attachment).arrayBuffer();
    }
    if(attachment.startsWith('blob:')){
      const res = await fetch(attachment);
      if(!res.ok) throw new Error(t('فشل جلب Blob URL'));
      return await res.arrayBuffer();
    }
    if(isHttpUrl(attachment)){
      const res = await fetch(attachment);
      if(!res.ok) throw new Error(t('فشل جلب رابط المرفق'));
      return await res.arrayBuffer();
    }
    if(isStoragePath(attachment)){
      const url = await resolveStorageUrl(attachment);
      if(!url) throw new Error(t('فشل تحويل مسار التخزين إلى رابط'));
      const res = await fetch(url);
      if(!res.ok) throw new Error(t('فشل جلب ملف التخزين'));
      return await res.arrayBuffer();
    }
  }
  if(attachment && typeof attachment.arrayBuffer==='function'){
    return await attachment.arrayBuffer();
  }
  throw new Error(t('نوع المرفق غير مدعوم'));
}
function dl(blob,name){ const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download=name; a.click(); URL.revokeObjectURL(u); }

/* ══════════════════════════════════════════
   COLLECT + SAVE TO ARCHIVE
══════════════════════════════════════════ */
function collectCancel(){
  const accSign = getAccSign('cancel');
  const alloc=[...document.querySelectorAll('#c-alloc .chk input:checked')].map(i=>i.value);
  const method = (document.querySelector('input[name="c-payout"]:checked')?.value)||'fawran';
  const account = method==='bank'
    ? (document.getElementById('c-iban').value||null)
    : (document.getElementById('c-fawran-phone').value||null);
  const refund=[...document.querySelectorAll('#refund-rows tr')].map(tr=>({
    desc: tr.getAttribute('data-refund-key') || tr.querySelector('td')?.textContent||'',
    amount: parseAmt(tr.querySelector('.r-amt')?.value||0),
  })).filter(r=>r.amount);
  return {
    doc_type:'cancel',
    req_no: document.getElementById('c-reqno').value,
    req_date: document.getElementById('c-date').value||null,
    mobile: document.getElementById('c-mobile').value||null,
    invoice_ref: document.getElementById('c-invref').value||null,
    allocation: alloc.join(', '),
    full_invoice: document.getElementById('c-fullinv').checked,
    amount: parseAmt(document.getElementById('refund-total').textContent)||null,
    refund_method: method,
    refund_account: account,
    refund_json: JSON.stringify(refund),
    notes: fitPrintText(document.getElementById('c-notes').value, 85)||null,
    created_by: CURRENT?.name||null,
    signed_by: SIGNED.cancel?.name||null,
    signed_at: SIGNED.cancel?.time||null,
    accounts_signed_by: accSign?.name||null,
    accounts_signed_at: accSign?.time||null,
  };
}
function collectDisb(){
  const accSign = getAccSign('disb');
  const sup=[...document.querySelectorAll('#supplier-rows tr')].map(tr=>({
    supplier: tr.querySelector('.s-name')?.value||'',
    invoice:  tr.querySelector('.s-inv')?.value||'',
    amount:   parseAmt(tr.querySelector('.s-amt')?.value||0),
  })).filter(r=>r.supplier||r.invoice||r.amount);
  const cli=[...document.querySelectorAll('#client-rows tr')].map(tr=>({
    invoice: tr.querySelector('.c-inv')?.value||'',
    share:   parseAmt(tr.querySelector('.c-amt')?.value||0),
  })).filter(r=>r.invoice||r.share);
  return {
    doc_type:'disb',
    req_no: document.getElementById('d-reqno').value,
    req_date: document.getElementById('d-date').value||null,
    name: (CURRENT && CURRENT.name) || document.getElementById('d-name').value || null,
    department: (CURRENT && CURRENT.dept) || document.getElementById('d-dept').value || null,
    project: document.getElementById('d-project').value||null,
    beneficiary: (sup[0] && sup[0].supplier) || null,
    client_invoices: cli.map(c=>c.invoice).filter(Boolean).join(', ')||null,
    client_inv_json: JSON.stringify(cli),
    supplier_invoices: JSON.stringify(sup),
    amount: parseAmt(document.getElementById('d-amt').value)||null,
    attachments_count: getCurrentAttachmentCount(),
    created_by: CURRENT?.name||null,
    signed_by: SIGNED.disb?.name||null,
    signed_at: SIGNED.disb?.time||null,
    accounts_signed_by: accSign?.name||null,
    accounts_signed_at: accSign?.time||null,
  };
}

function requestPrefix(kind){ return kind === 'cancel' ? 'RR' : 'PV'; }
function requestInputId(kind){ return kind === 'cancel' ? 'c-reqno' : 'd-reqno'; }
function formatRequestNo(kind, num){
  return `${requestPrefix(kind)}-${String(num).padStart(4,'0')}`;
}
function extractRequestNoNumber(kind, value){
  const m = displayRequestNo(value).match(new RegExp(`^${requestPrefix(kind)}-(\\d+)$`, 'i'));
  return m ? parseInt(m[1], 10) || 0 : 0;
}
function displayRequestNo(value){
  return String(value||'').trim().replace(/__cancelled_\d+$/i, '');
}
function cancelledStorageRequestNo(row){
  const base = displayRequestNo(row?.req_no);
  if(!base) return row?.req_no || null;
  if(String(row?.req_no||'').includes('__cancelled_')) return row.req_no;
  return `${base}__cancelled_${row?.id || Date.now()}`;
}
async function releaseCancelledRequestNo(reqNo){
  if(!SB_ON || !reqNo) return;
  const base = displayRequestNo(reqNo);
  const { data:rows, error } = await sb.from('requests')
    .select('id,req_no,cancelled')
    .eq('req_no', base)
    .eq('cancelled', true)
    .limit(20);
  if(error) throw error;
  for(const row of (Array.isArray(rows) ? rows : [])){
    const { error:updateError } = await sb.from('requests')
      .update({ req_no: cancelledStorageRequestNo(row) })
      .eq('id', row.id);
    if(updateError) throw updateError;
  }
}
async function getNextRequestNo(kind){
  if(!SB_ON) return formatRequestNo(kind, 1);
  const docType = kind === 'cancel' ? 'cancel' : 'disb';
  const { data, error } = await sb.from('requests')
    .select('req_no')
    .eq('doc_type', docType)
    .or('cancelled.is.null,cancelled.eq.false')
    .not('req_no', 'is', null)
    .limit(1000);
  if(error) throw error;
  // أرقام الطلبات النشطة المستخدمة حالياً (الملغية مستثناة من الاستعلام فوق)
  const used = new Set(
    (Array.isArray(data) ? data : [])
      .map(row => extractRequestNoNumber(kind, row.req_no))
      .filter(n => n > 0)
  );
  // أصغر رقم متاح: يملأ الفجوات الناتجة عن إلغاء طلب فيرجع رقمه للاستخدام
  let next = 1;
  while(used.has(next)) next++;
  return formatRequestNo(kind, next);
}
async function assignNextRequestNo(kind, rec){
  if(EDIT_ID) return rec.req_no;
  const next = await getNextRequestNo(kind);
  rec.req_no = next;
  const input = document.getElementById(requestInputId(kind));
  if(input) input.value = next;
  return next;
}
async function refreshNextRequestNo(kind){
  if(EDIT_ID) return;
  const input = document.getElementById(requestInputId(kind));
  if(!input) return;
  try{ input.value = await getNextRequestNo(kind); }catch(e){}
}
function refreshNextRequestNumbers(){
  refreshNextRequestNo('cancel');
  refreshNextRequestNo('disb');
}

async function persistRequestRecord(kind, rec){
  if(CURRENT && CURRENT.role==='viewer'){
    showMessageDialog({ title:t('صلاحية العرض فقط'), message:t('حسابك مخصّص للعرض والطباعة فقط، ولا يمكنك تقديم أو تعديل الطلبات.'), confirmText:t('حسنًا') });
    return;
  }
  // لا يمكن التقديم بدون توقيع إلكتروني
  if(!rec.signed_by){
    showMessageDialog({
      title:t('التوقيع الإلكتروني مطلوب'),
      subtitle:'Signature Required',
      message:t('لا يمكن تقديم الطلب قبل التوقيع إلكترونيًا. الرجاء الضغط على زر «توقيع إلكتروني» أولاً، ثم تقديم الطلب.'),
      confirmText:t('حسنًا')
    });
    return;
  }
  const btn = document.getElementById(kind+'-save-btn');
  if(!SB_ON){
    alert(t('الحفظ السحابي غير مفعّل — الطلب جاهز للطباعة والتحميل والإرسال على Teams. لتفعيل الأرشيف أضف بيانات Supabase في إعدادات الملف.'));
    return;
  }
  if(EDIT_ID && EDIT_REQUEST?.cancelled){
    EDIT_ID = null;
    EDIT_REQUEST = null;
  }
  if(EDIT_ID && !canCurrentEditRequest(EDIT_REQUEST)){
    alert(t('لا يمكن تعديل هذا الطلب.\n\nتم اعتماد الطلب من إدارة الحسابات أو لا تملك صلاحية تعديله.'));
    return;
  }
  btn.disabled=true; const o=btn.innerHTML; btn.textContent=t('جاري التقديم...');
  try{
    if(!EDIT_ID){
      await assignNextRequestNo(kind, rec);
      await releaseCancelledRequestNo(rec.req_no);
    }
    const result = EDIT_ID
      ? await sb.from('requests').update(rec).eq('id', EDIT_ID)
      : await sb.from('requests').insert([rec]).select('id').single();
    const { data, error } = result;
    if(!error){
      showMessageDialog({
        title: EDIT_ID ? t('تم تحديث الطلب') : t('تم تقديم الطلب'),
        message: EDIT_ID
          ? t('تم تحديث بيانات الطلب بنجاح، والتعديلات متاحة الآن في إدارة الطلبات.')
          : t('تم تقديم الطلب بنجاح، وأصبح متاحاً في إدارة الطلبات.'),
        details:[
          { label:t('رقم الطلب'), value: rec.req_no || '—', ltr:true }
        ],
        confirmText:t('حسنًا')
      });
      if(EDIT_ID && EDIT_REQUEST) EDIT_REQUEST = { ...EDIT_REQUEST, ...rec };
      if(!EDIT_ID && data?.id){
        EDIT_ID = data.id;
        EDIT_REQUEST = { ...rec, id:data.id };
      }
    }
    else { console.error(error); 
      let msg = t('تعذّر الحفظ — تأكّد من تسجيل دخولك ومن أن جدول requests مهيّأ في Supabase.');
      if(error.message && error.message.includes('column')){ msg += t('\n\nيلزم تنفيذ أمر SQL التالي في Supabase > SQL Editor:\nALTER TABLE requests ADD COLUMN IF NOT EXISTS attachments_data TEXT;\nALTER TABLE requests ADD COLUMN IF NOT EXISTS transfer_image TEXT;'); }
      if(error.code === '23505' || /duplicate|unique/i.test(error.message||'')){
        msg += t('\n\nيوجد طلب ملغى قديم بالرقم نفسه. اضغط حفظ مرة أخرى بعد تحديث الصفحة، فإن استمر الخطأ فافتح الطلب الملغى من الأرشيف وألغِه مرة أخرى لتحرير الرقم.');
      }
      alert(msg); 
    }
  }catch(e){ alert(t('خطأ اتصال بـ Supabase.')); console.error(e); }
  btn.disabled=false; btn.innerHTML=o;
}

async function saveCancelDoc(){
  return persistRequestRecord('cancel', collectCancel());
}

// الحقول الإلزامية لطلب الصرف — ترجع قائمة بالناقص
function validateDisbRequest(){
  const errs = [];
  // 1) التوقيع الإلكتروني
  if(!SIGNED.disb) errs.push(t('التوقيع إلكترونيًا'));
  // 2) فاتورة مورّد مكتملة (اسم + رقم فاتورة + مبلغ)
  const supRows = [...document.querySelectorAll('#supplier-rows tr')].map(tr=>({
    name: (tr.querySelector('.s-name')?.value||'').trim(),
    inv:  (tr.querySelector('.s-inv')?.value||'').trim(),
    amt:  parseAmt(tr.querySelector('.s-amt')?.value||0),
  }));
  if(!supRows.some(r=> r.name && r.inv && r.amt>0))
    errs.push(t('إضافة فاتورة مورّد مكتملة (اسم المورّد ورقم الفاتورة والمبلغ)'));
  // 3) في حالة عدم تفعيل «فاتورة عامة» → فاتورة عميل + مبلغ
  const generalInvoice = !!document.getElementById('d-cost-disabled')?.checked;
  if(!generalInvoice){
    const cliRows = [...document.querySelectorAll('#client-rows tr')].map(tr=>({
      inv: (tr.querySelector('.c-inv')?.value||'').trim(),
      amt: parseAmt(tr.querySelector('.c-amt')?.value||0),
    }));
    if(!cliRows.some(r=> r.inv && r.amt>0))
      errs.push(t('إضافة فاتورة العميل ومبلغها (أو تفعيل «فاتورة عامة»)'));
  }
  // 4) إجمالي المبلغ المطلوب صرفه
  if(!(parseAmt(document.getElementById('d-amt')?.value||0) > 0))
    errs.push(t('إدخال إجمالي المبلغ المطلوب صرفه'));
  return errs;
}

async function saveDisbDoc(){
  const errs = validateDisbRequest();
  if(errs.length){
    showMessageDialog({
      title:t('حقول إلزامية ناقصة'),
      subtitle:'Required Fields',
      message:t('لا يمكن تقديم الطلب قبل استكمال التالي:\n\n')
        + errs.map((e,i)=>`${i+1}- ${t('يجب ')}${e}`).join('\n'),
      confirmText:t('حسنًا')
    });
    return;
  }
  const rec = collectDisb();
  const savedPaths = ATTACHED.filter(a=>typeof a==='string');
  const newFiles = ATTACHED.filter(a=>a instanceof Blob);
  if(newFiles.length>0){
    try{
      const paths = await uploadAttachments(newFiles, 'request-attachments');
      rec.attachments_data = JSON.stringify([...savedPaths, ...paths]);
    }catch(e){
      console.error(e);
      alert(t('تعذّر رفع المرفقات') + '\n\n' + (e.message || e));
      return;
    }
  } else {
    // ATTACHED هي المرجع: لو فضلت مرفقات نحفظها، ولو اتشالت كلها تبقى المرفقات فاضية فعلاً
    rec.attachments_data = savedPaths.length>0 ? JSON.stringify(savedPaths) : null;
  }
  return persistRequestRecord('disb', rec);
}

/* ══════════════════════════════════════════
   ARCHIVE
══════════════════════════════════════════ */
let ARC_TAB='all';
const ARC_COLS = 11;
let ARC_STATUS = null;   // فلتر الحالة من شريط الملخّص
const ARC_ICONS = {
  comment:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
  view:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"></path><circle cx="12" cy="12" r="2.5"></circle></svg>',
  download:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>',
  print:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V3h10v5"></path><path d="M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><path d="M7 14h10v7H7z"></path></svg>',
  upload:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V10"></path><path d="m7 15 5-5 5 5"></path><path d="M5 5h14"></path></svg>',
  file:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path></svg>',
  paperclip:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.4 11.6-8.5 8.5a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"></path></svg>',
  clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>',
  hourglass:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h12"></path><path d="M6 22h12"></path><path d="M7 2v6l5 4 5-4V2"></path><path d="M7 22v-6l5-4 5 4v6"></path></svg>',
  plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>',
  more:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="19" cy="12" r="1.5"></circle></svg>',
  sign:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>',
  trash:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M6 6l1 16h10l1-16"></path></svg>',
  layers:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5z"></path><path d="m3 12 9 5 9-5"></path><path d="m3 16.5 9 5 9-5"></path></svg>',
  doc:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6z"></path><path d="M9 9h6"></path><path d="M9 13h6"></path><path d="M9 17h4"></path></svg>',
  list:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="M3 6h.01"></path><path d="M3 12h.01"></path><path d="M3 18h.01"></path></svg>'
};
function setArcTab(t){
  if(t === 'cancelled' && (!CURRENT || CURRENT.role !== 'accountant')) t = 'all';
  ARC_TAB=t;
  const sel=document.getElementById('arc-type'); if(sel && sel.value!==t) sel.value=t;
  loadArchive();
}
let ARC_SORT='new';
function setArcSort(v){ ARC_SORT=v; loadArchive(); }
function formatArchiveDateTime(value){
  if(!value) return '—';
  const d = new Date(value);
  if(Number.isNaN(d.getTime())) return value || '—';
  const p = n => String(n).padStart(2,'0');
  return `${p(d.getDate())}-${p(d.getMonth()+1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function escAttr(value){
  return String(value ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function showConfirmDialog({ title, message, details=[], note='', confirmText=t('تأكيد'), cancelText=t('رجوع'), danger=false, showCancel=true, subtitle }){
  return new Promise(resolve=>{
    const old = document.getElementById('app-confirm-overlay');
    if(old) old.remove();
    const overlay = document.createElement('div');
    overlay.id = 'app-confirm-overlay';
    overlay.dir = 'rtl';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,19,33,.55);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';
    const accent = danger ? '#B34A63' : '#2C8B8E';
    const accentSoft = danger ? 'rgba(224,82,107,.28)' : 'rgba(44,139,142,.28)';
    const caption = subtitle !== undefined ? subtitle : (showCancel ? 'Confirmation' : 'Notification');
    const detailsHtml = details.length ? `<div class="acd-details">${details.map((d, idx)=>`
      <div class="acd-row"${idx === details.length - 1 ? '' : ' data-sep="1"'}>
        <span class="acd-row-label">${escapeHtml(d.label)}</span>
        <b class="acd-row-value" style="direction:${d.ltr?'ltr':'rtl'};">${escapeHtml(d.value || '—')}</b>
      </div>`).join('')}</div>` : '';
    overlay.innerHTML = `
      <div class="acd-card" role="dialog" aria-modal="true">
        <div class="acd-head">
          <div class="acd-title">${escapeHtml(title)}</div>
          ${caption ? `<div class="acd-cap">${escapeHtml(caption)}</div>` : ''}
        </div>
        <div class="acd-body">
          <div class="acd-msg">${escapeHtml(message)}</div>
          ${detailsHtml}
          ${note ? `<div class="acd-note">${escapeHtml(note)}</div>` : ''}
        </div>
        <div class="acd-foot">
          ${showCancel ? `<button data-action="cancel" class="acd-btn acd-cancel">${escapeHtml(cancelText)}</button>` : ''}
          <button data-action="confirm" class="acd-btn acd-confirm">${escapeHtml(confirmText)}</button>
        </div>
      </div>`;
    const close = value => { document.removeEventListener('keydown', onKey); overlay.remove(); resolve(value); };
    overlay.addEventListener('click', e=>{ if(e.target === overlay) close(false); });
    overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', ()=>close(false));
    overlay.querySelector('[data-action="confirm"]').addEventListener('click', ()=>close(true));
    const onKey = e=>{
      if(e.key === 'Escape') close(false);
      if(e.key === 'Enter') close(true);
    };
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    (overlay.querySelector(showCancel ? '[data-action="cancel"]' : '[data-action="confirm"]')).focus();
  });
}
function showMessageDialog({ title, message, details=[], note='', confirmText=t('تم'), subtitle }){
  return showConfirmDialog({ title, message, details, note, confirmText, subtitle, showCancel:false, danger:false });
}
function getArchiveSubmittedDateRange(){
  const value = document.getElementById('arc-submitted-date')?.value;
  if(!value) return null;
  const start = new Date(value + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start:start.toISOString(), end:end.toISOString() };
}
function closeArchiveTimePopover(){
  const pop = document.getElementById('arc-time-pop');
  if(pop) pop.classList.remove('on');
}
function closeArchiveMenu(){
  const pop = document.getElementById('arc-menu-pop');
  if(pop) pop.classList.remove('on');
}
// المنبثقة بتتموضع بالنسبة للزرار اللي فتحها. بنحتفظ بالزرار عشان
// نعيد التموضع مع الاسكرول بدل ما تفضل واقفة مكانها والصف بيتحرك.
let POP_ANCHORS = new Map();
function positionArchivePopover(pop, btn){
  const r = btn.getBoundingClientRect();
  const width  = pop.offsetWidth  || 240;
  const height = pop.offsetHeight || 200;
  let left = r.right - width;
  left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
  // لو مفيش مكان تحت، نفتحها فوق الزرار
  let top = r.bottom + 10;
  if(top + height > window.innerHeight - 12 && r.top - height - 10 > 12){
    top = r.top - height - 10;
  }
  pop.style.left = left + 'px';
  pop.style.top  = top + 'px';
  POP_ANCHORS.set(pop.id, btn);
}
// القوايم المنبثقة بتتقفل مع الاسكرول — ده السلوك المتعارف عليه،
// وأضمن من ملاحقة الزرار عبر حاويات زحلقة مختلفة.
function closeOpenPopovers(){
  ['arc-menu-pop','arc-time-pop'].forEach(id=>{
    const pop = document.getElementById(id);
    if(pop && pop.classList.contains('on')) pop.classList.remove('on');
  });
}
document.addEventListener('scroll', closeOpenPopovers, true);
window.addEventListener('resize', closeOpenPopovers);
function showArchiveTimePopover(btn, submittedAt, approvedAt){
  const pop = document.getElementById('arc-time-pop');
  if(!pop) return;
  closeArchiveMenu();
  pop.innerHTML = `
    <div class="pop-title"><span>${t('سجل التوقيت')}</span><small>Timeline</small></div>
    <div class="arc-time-row"><span>${t('تاريخ التقديم')}</span><b>${submittedAt || '—'}</b></div>
    <div class="arc-time-row"><span>${t('توقيت اعتماد الحسابات')}</span><b>${approvedAt || t('لم يعتمد بعد')}</b></div>
  `;
  pop.classList.add('on');
  positionArchivePopover(pop, btn);
}
function archiveMenuButton(label, icon, action, danger=false){
  return `<button class="arc-menu-item${danger?' danger':''}" onclick="${action}; closeArchiveMenu();"><span>${label}</span>${icon}</button>`;
}
function showArchiveMenu(btn, title, subtitle, html){
  const pop = document.getElementById('arc-menu-pop');
  if(!pop) return;
  closeArchiveTimePopover();
  pop.innerHTML = `<div class="pop-title"><span>${title}</span><small>${subtitle||'Actions'}</small></div>${html}`;
  pop.classList.add('on');
  positionArchivePopover(pop, btn);
}
function getArchiveRowAttachments(row){
  if(!row || !row.attachments_data) return [];
  try{
    const atts = JSON.parse(row.attachments_data);
    return Array.isArray(atts) ? atts : [];
  }catch(e){
    return [];
  }
}
/* ══════════════════════════════════════════
   تعليقات الطلب (Comments) — مع مستويات ظهور
══════════════════════════════════════════ */
// مستويات الظهور: الكاتب يشوف تعليقه دائمًا
//  all   = الجميع
//  mgmt  = الإدارة فقط  → المحاسب + فريق الإدارة (viewer)
//  staff = الموظفين     → المحاسب + المبيعات (sales)
const COMMENT_VIS = {
  all:   { label:t('الجميع'),      hint:t('يظهر لكل المستخدمين') },
  mgmt:  { label:t('الإدارة فقط'), hint:t('المحاسب وفريق الإدارة فقط') },
  staff: { label:t('الموظفين'),    hint:t('المحاسب والمبيعات فقط') },
};
let COMMENT_EDIT = null; // id التعليق قيد التعديل (داخل نافذة التعليقات)

function getRequestComments(row){
  if(!row || !row.comments_data) return [];
  try{ const a = JSON.parse(row.comments_data); return Array.isArray(a) ? a : []; }catch(e){ return []; }
}
function canSeeComment(c){
  if(!CURRENT || !c) return false;
  if(c.user && c.user === CURRENT.user) return true;            // الكاتب يشوف تعليقه دائمًا
  const role = CURRENT.role;
  if(c.visibility === 'all')   return true;
  if(c.visibility === 'mgmt')  return role === 'accountant' || role === 'viewer';
  if(c.visibility === 'staff') return role === 'accountant' || role === 'sales';
  return role === 'accountant';                                 // قيمة غير معروفة: للمحاسب فقط (آمن)
}
function getVisibleComments(row){ return getRequestComments(row).filter(canSeeComment); }
// إضافة تعليق: قبل الاعتماد الجميع يكتب؛ بعد الاعتماد المحاسب + الإدارة فقط؛ الملغى مقفول للكل
function canAddComment(row){
  if(!CURRENT || !row || row.cancelled) return false;
  if(row.accounts_signed_by) return CURRENT.role === 'accountant' || CURRENT.role === 'viewer';
  return true;
}
// تعديل/حذف: قبل الاعتماد وغير الملغى فقط، والكاتب نفسه فقط
// تعدّل تعليقك أو تمسحه طالما لسه مسموح لك تكتب تعليق على الطلب:
// قبل الاعتماد الجميع، وبعده المحاسب والإدارة، والملغى مقفول للكل.
// فالموظف مايعدّلش بعد ما الطلب يتعتمد، والمحاسب يعدّل عادي.
function canModifyComment(row, c){
  if(!CURRENT || !row || !c) return false;
  if(c.user !== CURRENT.user) return false;
  return canAddComment(row);
}
function commentRoleLabel(role){
  return role === 'accountant' ? t('المحاسبة')
    : role === 'viewer' ? t('الإدارة')
    : role === 'sales' ? t('المبيعات') : '';
}
function commentVisBadge(v){
  const m = COMMENT_VIS[v] || COMMENT_VIS.all;
  return `<span class="cmt-vis-badge cmt-${v||'all'}">${escapeHtml(m.label)}</span>`;
}
async function persistComments(row, comments){
  if(!SB_ON){ alert(t('الأرشيف غير مفعّل.')); return false; }
  const json = JSON.stringify(comments);
  const { error } = await sb.from('requests').update({ comments_data: json }).eq('id', row.id);
  if(error){
    console.error(error);
    alert(t('تعذّر حفظ التعليق — تأكد من إضافة عمود comments_data وتفعيل سياسة التعديل في Supabase.\n\nSQL:\nALTER TABLE requests ADD COLUMN IF NOT EXISTS comments_data TEXT;'));
    return false;
  }
  row.comments_data = json;
  if(EDIT_ID === row.id && EDIT_REQUEST) EDIT_REQUEST = { ...EDIT_REQUEST, comments_data: json };
  return true;
}
function openCommentsDialog(i){
  const x = (window._arcRows||[])[i];
  if(!x){ alert(t('تعذّر فتح الطلب.')); return; }
  COMMENT_EDIT = null;
  renderCommentsOverlay(i);
}
function closeCommentsOverlay(){
  COMMENT_EDIT = null;
  document.getElementById('app-comments-overlay')?.remove();
}
function renderCommentsOverlay(i){
  const x = (window._arcRows||[])[i];
  if(!x) return;
  document.getElementById('app-comments-overlay')?.remove();
  const visible = getVisibleComments(x);
  const canAdd = canAddComment(x);
  const reqNo = displayRequestNo(x.req_no) || 'Request';

  const listHtml = visible.length ? visible.map(c=>{
    const when = formatArchiveDateTime(c.at);
    const editing = COMMENT_EDIT === c.id && canModifyComment(x, c);
    if(editing){
      return `
        <div class="cmt-item editing">
          <div class="cmt-item-hd"><div class="cmt-who"><b>${escapeHtml(personName(c.by)||'—')}</b><span class="cmt-role">${escapeHtml(commentRoleLabel(c.role))}</span></div>${commentVisBadge(c.visibility)}</div>
          <textarea id="cmt-edit-input" rows="3" maxlength="500" class="cmt-edit-area">${escapeHtml(c.text||'')}</textarea>
          <div class="cmt-foot"><span class="cmt-time">${escapeHtml(when)}</span>
            <span class="cmt-actions">
              <button class="cmt-link save" onclick="saveEditComment(${i}, '${escAttr(c.id)}')">${t('حفظ')}</button>
              <button class="cmt-link" onclick="cancelEditComment(${i})">${t('إلغاء')}</button>
            </span>
          </div>
        </div>`;
    }
    const canMod = canModifyComment(x, c);
    return `
      <div class="cmt-item">
        <div class="cmt-item-hd"><div class="cmt-who"><b>${escapeHtml(personName(c.by)||'—')}</b><span class="cmt-role">${escapeHtml(commentRoleLabel(c.role))}</span></div>${commentVisBadge(c.visibility)}</div>
        <div class="cmt-text">${escapeHtml(c.text||'')}</div>
        <div class="cmt-foot"><span class="cmt-time">${escapeHtml(when)}</span>
          ${canMod ? `<span class="cmt-actions">
            <button class="cmt-link" onclick="startEditComment(${i}, '${escAttr(c.id)}')">${t('تعديل')}</button>
            <button class="cmt-link danger" onclick="deleteComment(${i}, '${escAttr(c.id)}')">${t('حذف')}</button>
          </span>` : ''}
        </div>
      </div>`;
  }).join('') : `<div class="cmt-empty">${t('لا توجد تعليقات')}${canAdd ? t(' بعد — أضف أول تعليق بالأسفل.') : '.'}</div>`;

  const addHtml = canAdd ? `
    <div class="cmt-add">
      <textarea id="cmt-input" rows="3" maxlength="500" placeholder="${t('اكتب تعليقك هنا ...')}"></textarea>
      <div class="cmt-vis-row">
        <span class="cmt-vis-lbl">${t('يظهر لـ')}</span>
        ${Object.entries(COMMENT_VIS).map(([k,m],idx)=>`<label class="cmt-vis-opt" title="${escAttr(m.hint)}"><input type="radio" name="cmt-vis" value="${k}"${idx===0?' checked':''}><span>${escapeHtml(m.label)}</span></label>`).join('')}
      </div>
      <button class="cmt-submit" onclick="addComment(${i})">${t('إضافة تعليق')}</button>
    </div>` : `<div class="cmt-locked">${x.cancelled ? t('هذا الطلب ملغى') : t('هذا الطلب معتمد')} — ${t('التعليقات متاحة للقراءة فقط.')}</div>`;

  const overlay = document.createElement('div');
  overlay.id = 'app-comments-overlay';
  overlay.dir = 'rtl';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(15,19,33,.55);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';
  overlay.innerHTML = `
    <div class="cmt-card" role="dialog" aria-modal="true">
      <div class="cmt-head">
        <div><div class="cmt-htitle">${t('تعليقات الطلب')}</div><div class="cmt-hcap">${escAttr(reqNo)} · COMMENTS</div></div>
        <button class="cmt-x" onclick="closeCommentsOverlay()" aria-label="${t('إغلاق')}">✕</button>
      </div>
      <div class="cmt-body">${listHtml}</div>
      ${addHtml}
    </div>`;
  overlay.addEventListener('click', e=>{ if(e.target === overlay) closeCommentsOverlay(); });
  document.body.appendChild(overlay);
  const focusEl = COMMENT_EDIT ? overlay.querySelector('#cmt-edit-input') : overlay.querySelector('#cmt-input');
  if(focusEl){ focusEl.focus(); }
}
// يجيب أحدث نسخة من التعليقات من السيرفر قبل الكتابة — يمنع الكتابة فوق تعليقات أضافها غيرك
async function fetchLatestComments(row){
  if(!SB_ON || !row) return getRequestComments(row);
  try{
    const { data, error } = await sb.from('requests').select('comments_data').eq('id', row.id).single();
    if(!error && data) row.comments_data = data.comments_data;
  }catch(e){ /* نكمّل بالنسخة المحلية */ }
  return getRequestComments(row);
}
async function addComment(i){
  const x=(window._arcRows||[])[i]; if(!x) return;
  if(!canAddComment(x)){ alert(t('لا يمكن إضافة تعليق على هذا الطلب.')); return; }
  const ta = document.getElementById('cmt-input');
  const text = (ta?.value || '').trim();
  if(!text){ ta?.focus(); return; }
  const visibility = document.querySelector('#app-comments-overlay input[name="cmt-vis"]:checked')?.value || 'all';
  const comments = await fetchLatestComments(x);
  comments.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    text, by: CURRENT.name, user: CURRENT.user, role: CURRENT.role,
    at: new Date().toISOString(), visibility
  });
  if(await persistComments(x, comments)){ COMMENT_EDIT = null; renderCommentsOverlay(i); loadArchive(); }
}
function startEditComment(i, id){ COMMENT_EDIT = id; renderCommentsOverlay(i); }
function cancelEditComment(i){ COMMENT_EDIT = null; renderCommentsOverlay(i); }
async function saveEditComment(i, id){
  const x=(window._arcRows||[])[i]; if(!x) return;
  const text = (document.getElementById('cmt-edit-input')?.value || '').trim();
  if(!text){ alert(t('لا يمكن ترك التعليق فارغاً.')); return; }
  const comments = await fetchLatestComments(x);
  const c = comments.find(k=>k.id===id);
  if(!c){ alert(t('التعليق لم يعد موجوداً (ربما حُذف).')); COMMENT_EDIT=null; renderCommentsOverlay(i); return; }
  if(!canModifyComment(x, c)){ alert(t('لا يمكن تعديل هذا التعليق.')); COMMENT_EDIT=null; renderCommentsOverlay(i); return; }
  c.text = text;
  c.edited_at = new Date().toISOString();
  if(await persistComments(x, comments)){ COMMENT_EDIT = null; renderCommentsOverlay(i); loadArchive(); }
}
async function deleteComment(i, id){
  const x=(window._arcRows||[])[i]; if(!x) return;
  const localC = getRequestComments(x).find(k=>k.id===id);
  if(!localC || !canModifyComment(x, localC)){ alert(t('لا يمكنك حذف هذا التعليق.')); return; }
  const ok = await showConfirmDialog({
    title:t('حذف التعليق'),
    message:t('هل تريد حذف هذا التعليق نهائياً؟'),
    confirmText:t('حذف'),
    cancelText:t('تراجع'),
    danger:true
  });
  if(!ok){ renderCommentsOverlay(i); return; }
  const comments = await fetchLatestComments(x);
  const c = comments.find(k=>k.id===id);
  if(!c){ COMMENT_EDIT=null; renderCommentsOverlay(i); return; }   // اتحذف بالفعل
  if(!canModifyComment(x, c)){ alert(t('لا يمكنك حذف هذا التعليق.')); renderCommentsOverlay(i); return; }
  const next = comments.filter(k=>k.id!==id);
  if(await persistComments(x, next)){ COMMENT_EDIT = null; renderCommentsOverlay(i); loadArchive(); }
}

function showArchiveAttachmentsMenu(btn, rowIndex){
  const row = (window._arcRows||[])[rowIndex];
  const atts = getArchiveRowAttachments(row);
  if(!atts.length) return;
  const mergedActions = `
    ${archiveMenuButton(t('تنزيل الكل PDF'), ARC_ICONS.download, `downloadArchiveAttachmentsMerged(${rowIndex})`)}
    ${archiveMenuButton(t('طباعة الكل PDF'), ARC_ICONS.print, `printArchiveAttachmentsMerged(${rowIndex})`)}
    <div class="arc-menu-sep"></div>
  `;
  const html = mergedActions + atts.map((_, ai)=>`
    ${ai>0?'<div class="arc-menu-sep"></div>':''}
    <div class="arc-time-row"><span>${t('مرفق')} ${ai+1}</span><b>${isEnglish()?'':'Attachment '+(ai+1)}</b></div>
    ${archiveMenuButton(t('معاينة'), ARC_ICONS.view, `openAttachment(${rowIndex}, ${ai})`)}
    ${archiveMenuButton(t('تنزيل'), ARC_ICONS.download, `downloadArchiveAttachment(${rowIndex}, ${ai})`)}
    ${archiveMenuButton(t('طباعة'), ARC_ICONS.print, `printArchiveAttachment(${rowIndex}, ${ai})`)}
  `).join('');
  showArchiveMenu(btn, t('المرفقات'), `${atts.length} file${atts.length>1?'s':''}`, html);
}
function showArchiveActionsMenu(btn, rowIndex){
  const x = (window._arcRows||[])[rowIndex];
  if(!x) return;
  const isAcc = CURRENT && CURRENT.role==='accountant';
  // التعديل لصاحب الطلب قبل الاعتماد فقط — المحاسب يعتمد ويطبع ولا يعدّل
  const canEdit   = canCurrentEditRequest(x);
  const canRevoke = isAcc && x.accounts_signed_by && !x.cancelled;
  const canCancel = !x.cancelled && (isAcc || canEdit);
  let html = '';
  // عرض الطلب (قراءة فقط) + طباعة الطلب متاحان دائماً
  html += archiveMenuButton(t('عرض الطلب'), ARC_ICONS.view, `viewFromArchive(${rowIndex})`);
  html += archiveMenuButton(t('طباعة الطلب'), ARC_ICONS.print, `reprintFromArchive(${rowIndex})`);
  html += archiveMenuButton(t('تنزيل الطلب PDF'), ARC_ICONS.download, `downloadRequestPDF(${rowIndex})`);
  html += archiveMenuButton(t('سجل التوقيت'), ARC_ICONS.clock, `showArchiveTimeFromMenu(this, ${rowIndex})`);
  // تعديل الطلب ثم إلغاء الطلب (لمن يملك صلاحية التعديل فقط)
  if(canEdit || canRevoke || canCancel){
    html += '<div class="arc-menu-sep"></div>';
    if(canEdit){
      html += archiveMenuButton(t('تعديل الطلب'), ARC_ICONS.sign, `editFromArchive(${rowIndex})`);
    }
    // إلغاء الاعتماد: للمحاسب فقط على الطلبات المعتمدة غير الملغاة — يرجّع الطلب «غير معتمد»
    if(canRevoke){
      html += archiveMenuButton(t('إلغاء الاعتماد'), ARC_ICONS.sign, `revokeApproval(${rowIndex})`, true);
    }
    if(canCancel){
      html += archiveMenuButton(t('إلغاء الطلب'), ARC_ICONS.trash, `cancelRequest(${rowIndex})`, true);
    }
  }
  showArchiveMenu(btn, t('إجراءات الطلب'), escAttr(displayRequestNo(x.req_no) || 'Request'), html);
}
document.addEventListener('click', e=>{
  if(e.target.closest('.arc-time-btn') || e.target.closest('#arc-time-pop')) return;
  closeArchiveTimePopover();
  if(e.target.closest('.arc-menu-btn') || e.target.closest('#arc-menu-pop')) return;
  closeArchiveMenu();
});
// تحديث تلقائي لإدارة الطلبات كل 30 ثانية لإظهار الطلبات الجديدة — بهدوء وبدون إزعاج
let ARC_AUTO_REFRESH = null;
function startArchiveAutoRefresh(){
  if(ARC_AUTO_REFRESH) return;
  ARC_AUTO_REFRESH = setInterval(()=>{
    if(!CURRENT || !SB_ON) return;
    if(!document.getElementById('page-arc')?.classList.contains('on')) return;       // فقط عند فتح الأرشيف
    // لا تحدّث أثناء فتح قائمة أو نافذة حتى لا تتكسر أو تُغلق
    if(document.getElementById('app-comments-overlay') || document.getElementById('app-confirm-overlay')) return;
    if(document.getElementById('app-group-overlay') || document.getElementById('app-busy-overlay')) return;
    if(ARC_SELECT_MODE) return;   // لا تحدّث أثناء تحديد طلبات التحويل المجمّع
    if(document.getElementById('arc-menu-pop')?.classList.contains('on')) return;
    if(document.getElementById('arc-time-pop')?.classList.contains('on')) return;
    loadArchive(true);   // تحديث صامت
    loadNotifs();        // وتحديث الإشعارات معاه
  }, 30000);
}
async function loadArchive(silent=false){
  const body=document.getElementById('arc-body');
  const note=document.getElementById('arc-note-slot');
  closeArchiveTimePopover();
  closeArchiveMenu();
  note.innerHTML='';
  const isAcc = CURRENT && CURRENT.role==='accountant';
  if(!isAcc && ARC_SELECT_MODE) exitTransferSelectMode();   // وضع التحويل المجمّع للمحاسب فقط
  const bulkBtn = document.getElementById('arc-bulk-btn');
  if(bulkBtn){
    bulkBtn.style.display = isAcc ? '' : 'none';
    bulkBtn.classList.toggle('on', !!ARC_SELECT_MODE);
  }
  // من يرى كل الطلبات (شامل الملغية): المحاسب + حساب العرض فقط
  const canSeeAll = isAcc || (CURRENT && CURRENT.role==='viewer');
  const typeSel = document.getElementById('arc-type');
  const cancelledOpt = typeSel ? typeSel.querySelector('option[value="cancelled"]') : null;
  if(cancelledOpt) cancelledOpt.hidden = !canSeeAll;
  if(!canSeeAll && ARC_TAB === 'cancelled') ARC_TAB = 'all';
  if(typeSel && typeSel.value !== ARC_TAB) typeSel.value = ARC_TAB;
  if(!SB_ON){
    note.innerHTML=t('<div class="arc-note">الأرشيف السحابي غير مفعّل بعد. الطلبات تعمل وتُطبع وتُحمّل بشكل طبيعي.<br>لحفظ الطلبات وعرضها هنا للجميع، أضف رابط ومفتاح Supabase في أعلى كود الملف.</div>');
    body.innerHTML=`<div class="arc-empty">${t('— الأرشيف غير مفعّل —')}</div>`;
    return;
  }
  if(!silent) body.innerHTML=`<div class="arc-empty">${t('جاري التحميل...')}</div>`;
  try{
    await ensureTransferColumns();   // أعمدة التحويل المجمّع موجودة؟ (فحص مرة واحدة لكل جلسة)
    let qy = sb.from('requests').select('*').order('id',{ascending:false}).limit(1000);
    if(ARC_TAB==='cancelled') qy = qy.eq('cancelled', true);
    else if(ARC_TAB!=='all') qy = qy.eq('doc_type', ARC_TAB);
    // المبيعات يشوفوا طلبات بعض فقط (عرض/طباعة/تحميل) — مش طلبات المحاسب؛ التعديل لصاحب الطلب فقط
    // المحاسب وحساب العرض يشوفوا الكل. الطلبات الملغية للمحاسب والعرض فقط (تُفلتر بالأسفل)
    if(CURRENT && CURRENT.role === 'sales'){
      const salesNames = Object.values(USER_MAP).filter(u=>u.role==='sales').map(u=>u.name);
      qy = qy.in('created_by', salesNames);
    }
    const submittedRange = getArchiveSubmittedDateRange();
    if(submittedRange) qy = qy.gte('created_at', submittedRange.start).lt('created_at', submittedRange.end);
    const search=document.getElementById('arc-search').value.trim();
    if(search){
      const orParts = [`name.ilike.*${search}*`,`created_by.ilike.*${search}*`,`signed_by.ilike.*${search}*`,`req_no.ilike.*${search}*`,`beneficiary.ilike.*${search}*`,`supplier_invoices.ilike.*${search}*`];
      if(TRANSFER_COLS_OK) orParts.push(`transfer_group.ilike.*${search}*`);   // البحث برقم مجموعة التحويل
      qy = qy.or(orParts.join(','));
    }
    const { data:rows, error } = await qy;
    if(error){ 
      console.error(error); 
      let errMsg = t('خطأ اتصال');
      if(error.message && error.message.includes('column')){
        errMsg = t('خطأ: عمود غير موجود في الجدول. يُرجى تنفيذ أمر SQL التالي في Supabase:<br><code style="font-size:10px;direction:ltr;display:block;background:#f5f5f5;padding:6px;margin-top:4px">ALTER TABLE requests ADD COLUMN IF NOT EXISTS transfer_image TEXT;<br>ALTER TABLE requests ADD COLUMN IF NOT EXISTS attachments_data TEXT;<br>ALTER TABLE requests ADD COLUMN IF NOT EXISTS cancelled BOOLEAN DEFAULT FALSE;<br>ALTER TABLE requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();</code>');
        note.innerHTML = `<div class="arc-note">${errMsg}</div>`;
      }
      body.innerHTML=`<div class="arc-empty">${t('خطأ اتصال')}</div>`; return; 
    }
    if(!Array.isArray(rows)||rows.length===0){ body.innerHTML=`<div class="arc-empty">${t('لا توجد طلبات')}</div>`; return; }
    // الطلبات الملغية تظهر في تبويب «الملغاة / المسحوبة» فقط؛ باقي التبويبات تستثنيها
    const reqNum = r => extractRequestNoNumber(r.doc_type==='cancel' ? 'cancel' : 'disb', r.req_no);
    let list = (ARC_TAB==='cancelled' ? rows.filter(x=>x.cancelled) : rows.filter(x=>!x.cancelled))
      .slice()
      .sort((a,b)=> (reqNum(b)-reqNum(a)) || ((b.id||0)-(a.id||0)));   // ترتيب حسب الرقم: الأجدد فوق والأقدم تحت
    renderArchiveSummary(list);
    const shown = !ARC_STATUS ? list : list.filter(r=>{
      const k = requestStatus(r).key;
      return ARC_STATUS==='review' ? (k==='pending'||k==='unsigned') : k===ARC_STATUS;
    });
    renderArchiveCount(shown.length, list.length, rows.length);
    if(shown.length===0){ body.innerHTML=`<div class="arc-empty">${t('لا توجد طلبات')}</div>`; window._arcRows=[]; return; }
    list = shown;
    await loadTransferGroupsFor(list);          // بيانات مجموعات التحويل الظاهرة في القائمة
    applyArchiveSort(list, reqNum);            // ترتيب المستخدم
    sortTransferGroupsTogether(list);   // طلبات التحويل الواحد تفضل ورا بعض ككتلة واحدة
    window._arcRows = list;
    renderTransferGroupNote(note, search);      // لافتة ملخّص عند فلترة مجموعة تحويل
    const headHtml = `<div class="rl-head">
      <span class="rl-c rl-no">${t('رقم الطلب')}</span>
      <span class="rl-c rl-party">${t('المورّد')}</span>
      <span class="rl-c rl-who">${t('مقدّم')}</span>
      <span class="rl-c rl-date">${t('التاريخ')}</span>
      <span class="rl-c rl-amt">${t('المبلغ')}</span>
      <span class="rl-c rl-st">${t('الحالة')}</span>
      <span class="rl-c rl-act"></span>
    </div>`;
    body.innerHTML = headHtml + list.map((x,i)=>{
      const st = requestStatus(x);
      const groupId = x.transfer_group || '';
      const groupInfo = groupId ? (window._arcGroups||{})[groupId] : null;
      const groupCount = groupInfo ? groupInfo.rows.length : (groupId ? 1 : 0);
      const blockGid = (!x.cancelled && groupId) ? groupId : '';
      const gidAt = k => { const r = list[k]; return (r && !r.cancelled && r.transfer_group) ? r.transfer_group : ''; };
      const isBlockFirst = !!blockGid && blockGid !== gidAt(i-1);
      const isBlockLast  = !!blockGid && blockGid !== gidAt(i+1);
      const atts = getArchiveRowAttachments(x);
      const visComments = getVisibleComments(x);
      const days = requestAgeDays(x);
      const ageCls = days>=7 ? 'age-late' : days>=3 ? 'age-warn' : 'age-ok';
      // التقادم إشارة فعل — مالوش معنى على طلب اتحوّل أو اتلغى
      const showAge = !x.cancelled && !x.transfer_image;

      // الفعل التالي كأيقونة موحّدة المكان
      let actIcon = '';
      if(isAcc && !x.accounts_signed_by && !x.cancelled)
        actIcon = `<button class="rl-go review" onclick="event.stopPropagation();reviewFromHome(${x.id})" title="${escAttr(t('مراجعة واعتماد'))}">${ARC_ICONS.sign}</button>`;
      else if(isAcc && x.accounts_signed_by && !x.transfer_image && !x.cancelled)
        actIcon = `<button class="rl-go upload" onclick="event.stopPropagation();uploadTransferImage(${i})" title="${escAttr(t('رفع الإثبات'))}">${ARC_ICONS.upload}</button>`;
      else if(x.transfer_image)
        actIcon = `<button class="rl-go proof" onclick="event.stopPropagation();showTransferProofMenu(this, ${i})" title="${escAttr(t('إثبات التحويل'))}">${ARC_ICONS.file}</button>`;
      else actIcon = '<span class="rl-go-slot"></span>';

      const sel = (ARC_SELECT_MODE && isTransferSelectable(x))
        ? `<label class="rq-sel" onclick="event.stopPropagation()"><input type="checkbox"${ARC_SELECTED.has(x.id)?' checked':''} onchange="toggleTransferSelection(${x.id}, this.checked, this)"><span></span></label>` : '';

      const cls=['rl-row'];
      if(blockGid) cls.push('rl-grp');
      if(isBlockFirst) cls.push('rl-grp-first');
      if(isBlockLast) cls.push('rl-grp-last');
      if(x.cancelled) cls.push('rl-cancelled');
      // تظليل خفيف للي لسه محتاج إجراء: غير معتمد أغمق شوية، ومعتمد بدون إثبات أخف
      if(!x.cancelled){
        if(!x.accounts_signed_by) cls.push('rl-need-approve');
        else if(!x.transfer_image) cls.push('rl-need-proof');
      }
      if(ARC_SELECT_MODE && ARC_SELECTED.has(x.id)) cls.push('rl-selected');
      const style = groupId ? ` style="${transferGroupVars(groupId)}"` : '';

      const gHead = isBlockFirst ? `<div class="rl-ghead"${style}>
          <span class="rl-ghead-t">${ARC_ICONS.layers}<b>${t('تحويل مجمّع')}</b><em>${escAttr(blockGid)}</em></span>
          <span class="rl-ghead-s">${groupCount} ${t('طلبات')} · ${t('إجمالي')} <b>${formatMoney(groupInfo?groupInfo.total:x.amount)}</b> ${t('ر.ق')}${groupInfo&&groupInfo.note?` · ${t('مرجع:')} ${escapeHtml(groupInfo.note)}`:''}</span>
        </div>` : '';

      return gHead + `<div class="${cls.join(' ')}"${style} onclick="viewFromArchive(${i})" role="button" tabindex="0">
        <span class="rl-c rl-no">${sel}
          <b>${displayRequestNo(x.req_no)||'—'}</b>
          ${x.doc_type==='cancel'?`<span class="rl-tag is-cancel">${t('إلغاء')}</span>`:''}
          ${groupId&&!x.cancelled?`<button class="rl-grp-chip" onclick="event.stopPropagation();filterByTransferGroup('${escAttr(groupId)}')" title="${escAttr(t('تحويل مجمّع'))}">${ARC_ICONS.layers}</button>`:''}
        </span>
        <span class="rl-c rl-party">
          <span class="rl-sup pav-name" data-name="${escAttr(x.doc_type==='cancel' ? (x.invoice_ref||'—') : (x.beneficiary||'—'))}">${escapeHtml(x.doc_type==='cancel' ? (x.invoice_ref||'—') : (x.beneficiary||'—'))}</span>
        </span>
        <span class="rl-c rl-who">${personAvatar(x.created_by)}</span>
        <span class="rl-c rl-date"><span class="rl-dt">${x.req_date||'—'}</span><em class="rl-age ${showAge?ageCls:'is-blank'}">${showAge?(days===0?t('اليوم'):days===1?t('من يوم'):t('من {n} يوم').replace('{n}',days)):''}</em></span>
        <span class="rl-c rl-amt">${x.amount?formatMoney(x.amount):'—'}</span>
        <span class="rl-c rl-st"><span class="arc-status ${st.cls}"><i></i>${t(st.label)}</span></span>
        <span class="rl-c rl-act">
          <span class="rl-counts">
            ${atts.length?`<button class="rl-cnt" onclick="event.stopPropagation();showArchiveAttachmentsMenu(this, ${i})" title="${escAttr(t('المرفقات'))}">${ARC_ICONS.paperclip}${atts.length}</button>`:''}
            <button class="rl-cnt${visComments.length?'':' is-empty'}" onclick="event.stopPropagation();openCommentsDialog(${i})" title="${escAttr(visComments.length?t('تعليقات'):t('إضافة تعليق'))}">${ARC_ICONS.comment}${visComments.length||''}</button>
          </span>${actIcon}
          <button class="rl-more" onclick="event.stopPropagation();showArchiveActionsMenu(this, ${i})" title="${escAttr(t('إجراءات'))}">${ARC_ICONS.more}</button>
        </span>
      </div>` + (isBlockLast ? '<div class="rl-gend"'+style+'></div>' : '');
    }).join('');
    pruneTransferSelection(list);
    updateTransferSelectUI();
  }catch(e){ body.innerHTML=`<div class="arc-empty">${t('خطأ اتصال')}</div>`; }
}

/* ══════════════════════════════════════════
   فتح طلب من الأرشيف (عرض / طباعة / اعتماد)
══════════════════════════════════════════ */
// عرض الطلب من الأرشيف للقراءة فقط (بدون تعديل)
function viewFromArchive(i){
  VIEW_ONLY = true;
  openFromArchive(i);
}

// تعديل الطلب من الأرشيف (مع تنبيه أن الحفظ سيستبدل البيانات الحالية)
async function editFromArchive(i){
  const x = (window._arcRows||[])[i];
  if(!x){ alert(t('تعذّر فتح الطلب.')); return; }
  if(!canCurrentEditRequest(x)){
    showMessageDialog({
      title:t('تعذّر التعديل'),
      message: x.cancelled
        ? t('هذا الطلب ملغي ولا يمكن تعديله.')
        : (!isOwnRequest(x)
            ? t('هذا الطلب من إنشاء موظف آخر ولا يمكن تعديله. يمكنك عرضه وطباعته واعتماده فقط.')
            : t('هذا الطلب معتمد من إدارة الحسابات، متاح للطباعة فقط ولا يمكن تعديله.')),
      confirmText:t('حسنًا')
    });
    return;
  }
  const ok = await showConfirmDialog({
    title:t('تعديل الطلب'),
    message:t('أنت على وشك فتح الطلب للتعديل عليه. أي تغيير تقوم بحفظه سيستبدل البيانات الحالية للطلب في الأرشيف.'),
    details:[
      { label:t('رقم الطلب'), value: displayRequestNo(x.req_no) || '—', ltr:true }
    ],
    note:t('تأكد من صحة التعديلات قبل الحفظ.'),
    confirmText:t('متابعة التعديل'),
    cancelText:t('رجوع'),
    danger:true
  });
  if(!ok) return;
  VIEW_ONLY = false;
  openFromArchive(i);
}

function openFromArchive(i){
  if(!CURRENT){ return; }
  const x = (window._arcRows||[])[i];
  if(!x){ alert(t('تعذّر فتح الطلب.')); return; }
  if(!VIEW_ONLY && CURRENT.role !== 'accountant' && !canCurrentEditRequest(x)){
    alert(t('هذا الطلب معتمد من الحسابات، متاح للطباعة فقط ولا يمكن تعديله.'));
    return;
  }
  setFormParent('arc');                       // الرجوع يرجّعك للأرشيف
  if(x.doc_type==='cancel'){ loadCancelFromRow(x); showPage('cancel'); }
  else { loadDisbFromRow(x); showPage('disb'); }
}

// إعادة طباعة الطلب من الأرشيف (متاح لموظف المبيعات)
function reprintFromArchive(i){
  VIEW_ONLY = true;
  const x = (window._arcRows||[])[i];
  if(!x){ alert(t('تعذّر فتح الطلب.')); return; }
  const isAcc = CURRENT && CURRENT.role==='accountant';
  if(x.doc_type==='cancel'){
    loadCancelFromRow(x);
    showPage('cancel');
  } else {
    loadDisbFromRow(x);
    showPage('disb');
  }
  setTimeout(()=>printDoc(x.doc_type, displayRequestNo(x.req_no)), 400);
}

// تنزيل الطلب PDF من الأرشيف
// بنعدّي على نفس مسار الطباعة: نحمّل الطلب في الوثيقة ونخلّي المتصفح
// يرسمها، وبعدين generateRequestPDF بتصوّرها بـhtml2canvas وتحطها صورة
// في الـPDF. فالعربي بيتحفظ زي ما هو معروض بالظبط — مافيش نص بيتكتب
// حرف حرف في jsPDF عشان يتعكس.
async function downloadRequestPDF(i){
  const x = (window._arcRows||[])[i];
  if(!x){ alert(t('تعذّر فتح الطلب.')); return; }
  const no = displayRequestNo(x.req_no) || (x.doc_type==='cancel' ? 'RR' : 'PV');
  VIEW_ONLY = true;
  if(x.doc_type==='cancel'){ loadCancelFromRow(x); showPage('cancel'); }
  else                     { loadDisbFromRow(x);   showPage('disb');   }
  const busy = t('جاري تجهيز الملف...');
  let note = null;
  try{
    note = document.createElement('div');
    note.className = 'dl-busy no-print';
    note.textContent = busy;
    document.body.appendChild(note);
    // نفس مهلة الطباعة عشان الوثيقة تترسم بالكامل قبل التصوير
    await new Promise(r=>setTimeout(r, 400));
    if(x.doc_type!=='cancel' && typeof prepareDisbPrintAppendix === 'function') prepareDisbPrintAppendix();
    const bytes = await generateRequestPDF(x.doc_type==='cancel' ? 'doc-cancel' : 'doc-disb');
    dl(new Blob([bytes], { type:'application/pdf' }), no.replace(/\s+/g,'_') + '.pdf');
  }catch(e){
    console.error(e);
    const ver = await activeCacheVersion();
    alert(t('تعذّر تجهيز ملف الطلب.') + '\n\n' + (e.message || e) + '\n\n[' + ver + ']');
  }finally{
    if(note) note.remove();
    if(x.doc_type!=='cancel' && typeof clearDisbPrintAppendix === 'function') clearDisbPrintAppendix();
  }
}

// رفع إثبات التحويل (المحاسب فقط بعد الاعتماد)
async function uploadTransferImage(i){
  if(!CURRENT || CURRENT.role!=='accountant'){ alert(t('هذه الخاصية للمحاسب فقط.')); return; }
  const x=(window._arcRows||[])[i]; if(!x) return;
  if(!SB_ON){ alert(t('الأرشيف غير مفعّل.')); return; }
  // إنشاء input file مخفي
  const inp = document.createElement('input');
  inp.type='file'; inp.accept='image/*,application/pdf';
  inp.onchange=async function(){
    const file=inp.files[0]; if(!file) return;
    if(file.size>2*1024*1024){
      await showMessageDialog({ title:t('الملف كبير'), message:t('حجم إثبات التحويل أكبر من الحد المسموح (2 ميجابايت). الرجاء اختيار ملف أصغر.'), confirmText:t('حسنًا') });
      return;
    }
    try{
      const path = await uploadFileToStorage(file, 'transfer-images');
      const { error } = await sb.from('requests').update({ transfer_image:path }).eq('id', x.id);
      if(error){ console.error(error);
        alert(t('تعذّر حفظ الصورة.\n\nيُرجى تنفيذ أمر SQL التالي في Supabase > SQL Editor:\n\nALTER TABLE requests ADD COLUMN IF NOT EXISTS transfer_image TEXT;\nALTER TABLE requests ADD COLUMN IF NOT EXISTS attachments_data TEXT;'));
        return;
      }
      loadArchive();
      await showMessageDialog({
        title:t('تم رفع إثبات التحويل'),
        subtitle:'Transfer Proof Uploaded',
        message:t('تم حفظ إثبات التحويل بنجاح، وأُرسل إشعار لمقدّم الطلب بأن طلبه تم تحويله.'),
        confirmText:t('حسنًا')
      });
    }catch(e){ await showMessageDialog({ title:t('خطأ اتصال'), message:t('تعذّر رفع إثبات التحويل. تحقّق من الاتصال وحاول مرة أخرى.'), confirmText:t('حسنًا') }); console.error(e); }
  };
  inp.click();
}

// قائمة إثبات التحويل: معاينة / تنزيل / طلبات المجموعة / حذف (الحذف للمحاسب فقط)
function showTransferProofMenu(btn, rowIndex){
  const x = (window._arcRows||[])[rowIndex];
  if(!x || !x.transfer_image) return;
  const isAcc = CURRENT && CURRENT.role==='accountant';
  const gid = x.transfer_group || '';
  const info = gid ? (window._arcGroups||{})[gid] : null;
  let html = archiveMenuButton(t('معاينة'), ARC_ICONS.view, `openAttachmentByRow(${rowIndex}, 'transfer_image')`)
    + archiveMenuButton(t('تنزيل'), ARC_ICONS.download, `downloadTransferImage(${rowIndex})`);
  if(gid){
    html += '<div class="arc-menu-sep"></div>'
      + `<div class="arc-time-row"><span>${t('عدد الطلبات')}</span><b>${info ? info.rows.length : 1}</b></div>`
      + `<div class="arc-time-row"><span>${t('إجمالي المجموعة')}</span><b>${info ? formatMoney(info.total) : '—'}</b></div>`
      + (x.transfer_group_note ? `<div class="arc-time-row"><span>${t('مرجع التحويل')}</span><b>${escapeHtml(x.transfer_group_note)}</b></div>` : '')
      + archiveMenuButton(t('عرض طلبات المجموعة'), ARC_ICONS.list, `filterByTransferGroup('${escAttr(gid)}')`);
  }
  if(isAcc && !x.cancelled){
    html += '<div class="arc-menu-sep"></div>'
      + archiveMenuButton(gid ? t('حذف الإثبات من هذا الطلب') : t('حذف'), ARC_ICONS.trash, `deleteTransferImage(${rowIndex})`, true);
    if(gid) html += archiveMenuButton(t('حذف الإثبات من كل المجموعة'), ARC_ICONS.trash, `deleteTransferGroup('${escAttr(gid)}')`, true);
  }
  showArchiveMenu(btn, gid ? `${t('تحويل مجمّع')} · ${gid}` : t('إثبات التحويل'), gid ? 'Grouped Transfer' : 'Transfer Proof', html);
}

// تنزيل إثبات التحويل
async function downloadTransferImage(rowIndex){
  const x = (window._arcRows||[])[rowIndex];
  if(!x || !x.transfer_image){ return; }
  try{
    const bytes = await getAttachmentBytes(x.transfer_image);
    dl(new Blob([bytes], { type:getAttachmentMime(x.transfer_image) }), getAttachmentLabel(x.transfer_image));
  }catch(e){ console.error(e); await showMessageDialog({ title:t('تعذّر التنزيل'), message:t('حدث خطأ أثناء تنزيل إثبات التحويل.'), confirmText:t('حسنًا') }); }
}

// حذف إثبات التحويل (المحاسب فقط) — يسمح برفع غيره
async function deleteTransferImage(rowIndex){
  if(!CURRENT || CURRENT.role!=='accountant'){ await showMessageDialog({ title:t('غير مسموح'), message:t('هذه الخاصية للمحاسب فقط.'), confirmText:t('حسنًا') }); return; }
  const x = (window._arcRows||[])[rowIndex];
  if(!x || !x.transfer_image || !SB_ON) return;
  const ok = await showConfirmDialog({
    title:t('حذف إثبات التحويل'),
    message: x.transfer_group
      ? t('هل تريد حذف إثبات التحويل من هذا الطلب فقط؟ سيخرج الطلب من مجموعة التحويل، وباقي طلبات المجموعة تفضل كما هي.')
      : t('هل تريد حذف إثبات التحويل الحالي؟ سيمكنك بعدها رفع إثبات جديد.'),
    details:[
      { label:t('رقم الطلب'), value: displayRequestNo(x.req_no)||'—', ltr:true },
      ...(x.transfer_group ? [{ label:t('مجموعة التحويل'), value:x.transfer_group, ltr:true }] : [])
    ],
    confirmText:t('حذف'), cancelText:t('رجوع'), danger:true
  });
  if(!ok) return;
  try{
    // أعمدة المجموعة تتصفّر فقط لو موجودة في قاعدة البيانات (توافق مع النسخ قبل تشغيل الـSQL)
    const patch = TRANSFER_COLS_OK
      ? { transfer_image:null, transfer_seen:false, transfer_group:null, transfer_group_at:null, transfer_group_note:null }
      : { transfer_image:null, transfer_seen:false };
    const { error } = await sb.from('requests').update(patch).eq('id', x.id);
    if(error){ console.error(error); await showMessageDialog({ title:t('تعذّر الحذف'), message:t('حدث خطأ أثناء الحذف. حاول مرة أخرى.'), confirmText:t('حسنًا') }); return; }
    loadArchive();
    await showMessageDialog({ title:t('تم الحذف'), message:t('تم حذف إثبات التحويل. يمكنك الآن رفع إثبات جديد.'), confirmText:t('حسنًا') });
  }catch(e){ console.error(e); await showMessageDialog({ title:t('خطأ اتصال'), message:t('تعذّر الحذف. تحقّق من الاتصال وحاول مرة أخرى.'), confirmText:t('حسنًا') }); }
}

// إلغاء طلب — المحاسب يقدر يلغي، والمبيعات تقدر تلغي طلبها قبل اعتماد الحسابات فقط.
async function cancelRequest(i){
  if(!CURRENT){ alert(t('يجب تسجيل الدخول أولاً.')); return; }
  const x=(window._arcRows||[])[i]; if(!x) return;
  const isAcc = CURRENT.role === 'accountant';
  const canSalesCancel = isOwnRequest(x) && !isApprovedRequest(x) && !x.cancelled;
  if(!isAcc && !canSalesCancel){
    alert(t('لا يمكن إلغاء هذا الطلب.\n\nيمكن للمبيعات إلغاء الطلب قبل اعتماد الحسابات فقط.'));
    return;
  }
  const ok = await showConfirmDialog({
    title:t('تأكيد إلغاء الطلب'),
    message:t('هل تريد إلغاء هذا الطلب؟'),
    details:[
      { label:t('رقم الطلب'), value:displayRequestNo(x.req_no), ltr:true },
      { label:t('صاحب الطلب'), value:x.name || x.created_by || '—' },
      { label:t('نوع الطلب'), value:x.doc_type === 'cancel' ? t('طلب إلغاء') : t('طلب صرف') }
    ],
    note:t('سيتم الاحتفاظ بالطلب داخل الأرشيف مع علامة ملغى.'),
    confirmText:t('إلغاء الطلب'),
    cancelText:t('تراجع'),
    danger:true
  });
  if(!ok) return;
  if(!SB_ON){ alert(t('الأرشيف غير مفعّل.')); return; }
  try{
    const { error } = await sb.from('requests').update({
      cancelled:true,
      req_no: cancelledStorageRequestNo(x)
    }).eq('id', x.id);
    if(error){ console.error(error); alert(t('تعذّر الإلغاء — تأكد من إضافة عمود cancelled في جدول requests (راجع التعليمات) ومن تفعيل سياسة التعديل.')); return; }
    x.cancelled = true;
    x.req_no = cancelledStorageRequestNo(x);
    if(EDIT_ID === x.id){
      EDIT_ID = null;
      EDIT_REQUEST = null;
      setDocumentLocked(x.doc_type === 'cancel' ? 'cancel' : 'disb', false);
    }
    loadArchive();
    refreshNextRequestNo(x.doc_type === 'cancel' ? 'cancel' : 'disb');
  }catch(e){ alert(t('خطأ اتصال بـ Supabase.')); console.error(e); }
}

// اعتماد الطلب مباشرةً من الأرشيف — المحاسب فقط — بدون فتح النموذج أو تغيير الصفحة
async function approveFromArchive(i){
  if(!CURRENT || CURRENT.role !== 'accountant'){ alert(t('اعتماد الحسابات متاح للمحاسب فقط.')); return; }
  const x=(window._arcRows||[])[i]; if(!x) return;
  if(x.accounts_signed_by){ alert(t('هذا الطلب معتمد بالفعل.')); return; }
  if(x.cancelled){ alert(t('هذا الطلب ملغى، لا يمكن اعتماده.')); return; }
  const kind = x.doc_type === 'cancel' ? 'cancel' : 'disb';
  const ok = await showConfirmDialog({
    title:t('تأكيد اعتماد الطلب'),
    message:t('هل تريد اعتماد هذا الطلب من إدارة الحسابات الآن؟'),
    details:[
      { label:t('رقم الطلب'), value:displayRequestNo(x.req_no), ltr:true },
      { label:t('صاحب الطلب'), value:x.name || x.created_by || '—' },
      { label:t('نوع الطلب'), value:kind === 'cancel' ? t('طلب إلغاء') : t('طلب صرف') }
    ],
    note:t('سيظهر اعتمادك على الطلب ويصبح متاحاً للطباعة فقط.'),
    confirmText:t('اعتماد الطلب'),
    cancelText:t('تراجع')
  });
  if(!ok) return;
  if(!SB_ON){ alert(t('الأرشيف غير مفعّل.')); return; }
  const now = new Date();
  try{
    const { error } = await sb.from('requests').update({
      accounts_signed_by: CURRENT.name,
      accounts_signed_at: now.toISOString()
    }).eq('id', x.id);
    if(error){ console.error(error); alert(t('تعذّر حفظ الاعتماد — تأكد من تفعيل سياسة التعديل (update) في Supabase.')); return; }
    x.accounts_signed_by = CURRENT.name;
    x.accounts_signed_at = now.toISOString();
    if(EDIT_ID === x.id && EDIT_REQUEST){
      EDIT_REQUEST = { ...EDIT_REQUEST, accounts_signed_by: CURRENT.name, accounts_signed_at: now.toISOString() };
    }
    showMessageDialog({
      title:t('تم اعتماد الطلب'),
      message:t('تم اعتماد الطلب من إدارة الحسابات وحفظه في الأرشيف.'),
      details:[
        { label:t('رقم الطلب'), value: displayRequestNo(x.req_no) || '—', ltr:true },
        { label:t('معتمد بواسطة'), value: CURRENT.name },
        { label:t('وقت الاعتماد'), value: stampDate(now), ltr:true }
      ],
      note:t('الطلب الآن متاح للطباعة.'),
      confirmText:t('حسنًا')
    });
    loadArchive();
  }catch(e){ alert(t('خطأ اتصال بـ Supabase.')); console.error(e); }
}

// إلغاء اعتماد الحسابات — المحاسب فقط — يرجّع الطلب «غير معتمد» ويفكّ القفل
async function revokeApproval(i){
  if(!CURRENT || CURRENT.role !== 'accountant'){ alert(t('إلغاء الاعتماد متاح للمحاسب فقط.')); return; }
  const x=(window._arcRows||[])[i]; if(!x) return;
  if(!x.accounts_signed_by){ alert(t('هذا الطلب غير معتمد أصلاً.')); return; }
  if(x.cancelled){ alert(t('هذا الطلب ملغى، لا يمكن تعديل اعتماده.')); return; }
  const ok = await showConfirmDialog({
    title:t('تأكيد إلغاء الاعتماد'),
    message:t('هل تريد إلغاء اعتماد الحسابات لهذا الطلب؟ سيرجع الطلب لحالة «غير معتمد» ويصبح قابلاً للتعديل من جديد.'),
    details:[
      { label:t('رقم الطلب'), value:displayRequestNo(x.req_no), ltr:true },
      { label:t('معتمد بواسطة'), value:x.accounts_signed_by || '—' },
      { label:t('نوع الطلب'), value:x.doc_type === 'cancel' ? t('طلب إلغاء') : t('طلب صرف') }
    ],
    note:t('يمكن إعادة اعتماد الطلب لاحقاً في أي وقت.'),
    confirmText:t('إلغاء الاعتماد'),
    cancelText:t('تراجع'),
    danger:true
  });
  if(!ok) return;
  if(!SB_ON){ alert(t('الأرشيف غير مفعّل.')); return; }
  try{
    const { error } = await sb.from('requests').update({
      accounts_signed_by:null,
      accounts_signed_at:null
    }).eq('id', x.id);
    if(error){ console.error(error); alert(t('تعذّر إلغاء الاعتماد — تأكد من تفعيل سياسة التعديل (update) في Supabase.')); return; }
    x.accounts_signed_by = null;
    x.accounts_signed_at = null;
    // لو الطلب مفتوح حالياً في المحرّر: حدّث ختم الاعتماد وأظهر زر الاعتماد وافكّ القفل
    const kind = x.doc_type === 'cancel' ? 'cancel' : 'disb';
    if(EDIT_ID === x.id){
      if(EDIT_REQUEST) EDIT_REQUEST = { ...EDIT_REQUEST, accounts_signed_by:null, accounts_signed_at:null };
      setAccSign(kind, null);
      document.getElementById(kind+'-acc-stamp')?.classList.remove('on');
      const ph=document.getElementById(kind+'-acc-ph'); if(ph) ph.style.display='block';
      const row=document.getElementById(kind+'-acc-btn-row'); if(row) row.style.display='flex';
      applyArchiveEditLock(kind, EDIT_REQUEST);
    }
    loadArchive();
  }catch(e){ alert(t('خطأ اتصال بـ Supabase.')); console.error(e); }
}

function loadDisbFromRow(x){
  EDIT_ID = x.id || null;
  EDIT_REQUEST = x;
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.value = v==null?'':v; };
  set('d-reqno', displayRequestNo(x.req_no));
  set('d-date',  x.req_date);
  set('d-name',  personName(x.name));
  set('d-dept',  x.department);
  set('d-project', x.project);
  set('d-amt', x.amount!=null ? fmtAmt(String(x.amount)) : '');
  // فواتير الموردين
  const sup=document.getElementById('supplier-rows'); sup.innerHTML='';
  let sarr=[]; try{ sarr=JSON.parse(x.supplier_invoices||'[]'); }catch(e){ sarr=[]; }
  if(!Array.isArray(sarr)||!sarr.length) sarr=[{supplier:'',invoice:'',amount:''}];
  sarr.forEach(s=>addSupplierRow(s.supplier||'', s.invoice||'', s.amount?fmtAmt(String(s.amount)):'', true));
  recalcSupplier();
  // فواتير العميل
  const cli=document.getElementById('client-rows'); cli.innerHTML='';
  let carr=[]; try{ carr=JSON.parse(x.client_inv_json||'[]'); }catch(e){ carr=[]; }
  if(!Array.isArray(carr)||!carr.length) carr=[{invoice:'',share:''}];
  carr.forEach(c=>addClientRow(c.invoice||'', c.share?fmtAmt(String(c.share)):'', true));
  recalcClient();
  // المرفقات المحفوظة — تُحمّل مباشرة لتكون ATTACHED هي المرجع الوحيد (تسمح بالحذف الصحيح)
  ATTACHED = [];
  try{ const _atts = JSON.parse(EDIT_REQUEST?.attachments_data || '[]'); if(Array.isArray(_atts)) ATTACHED = _atts.slice(); }catch(e){ ATTACHED = []; }
  renderAttach();
  window.LAST_REQUEST_PDF = null; updateRequestPdfStatus();
  // توقيع مقدّم الطلب
  if(x.signed_by){
    SIGNED.disb={ name:x.signed_by, time:x.signed_at, label:stampDate(x.signed_at) };
    document.getElementById('disb-sig-ph').style.display='none';
    document.getElementById('disb-sig-stamp').classList.add('on');
    document.getElementById('disb-sig-mono').textContent = initials(x.signed_by);
    document.getElementById('disb-sig-name').textContent = personName(x.signed_by);
    document.getElementById('disb-sig-meta').textContent = stampDate(x.signed_at);
  } else {
    SIGNED.disb=null;
    document.getElementById('disb-sig-stamp').classList.remove('on');
    document.getElementById('disb-sig-ph').style.display='block';
  }
  // اعتماد الحسابات
  if(x.accounts_signed_by){
    setAccSign('disb', { name:x.accounts_signed_by, time:x.accounts_signed_at, label:stampDate(x.accounts_signed_at) });
    document.getElementById('disb-acc-ph').style.display='none';
    document.getElementById('disb-acc-stamp').classList.add('on');
    document.getElementById('disb-acc-mono').textContent = initials(x.accounts_signed_by);
    document.getElementById('disb-acc-name').textContent = personName(x.accounts_signed_by);
    document.getElementById('disb-acc-meta').textContent = stampDate(x.accounts_signed_at);
  } else {
    setAccSign('disb', null);
    document.getElementById('disb-acc-stamp').classList.remove('on');
    document.getElementById('disb-acc-ph').style.display='block';
  }
  // زر الاعتماد يظهر للمحاسب فقط ولو لسه متعمدش
  const row=document.getElementById('disb-acc-btn-row');
  if(row) row.style.display = (CURRENT && CURRENT.role==='accountant' && !x.accounts_signed_by) ? 'flex' : 'none';
  updateMatch();
  applyArchiveEditLock('disb', x);
}

function loadCancelFromRow(x){
  EDIT_ID = x.id || null;
  EDIT_REQUEST = x;
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.value = v==null?'':v; };
  set('c-reqno', displayRequestNo(x.req_no));
  set('c-date',  x.req_date);
  set('c-mobile', x.mobile);
  set('c-invref', x.invoice_ref);
  set('c-notes', fitPrintText(x.notes, 85));
  document.getElementById('c-fullinv').checked = !!x.full_invoice;
  // الأنصبة (allocation)
  const allocSet = new Set(String(x.allocation||'').split(',').map(s=>s.trim()).filter(Boolean));
  document.querySelectorAll('#c-alloc .chk input').forEach(cb=>{
    const on=allocSet.has(cb.value); cb.checked=on; cb.closest('.chk').classList.toggle('on',on);
  });
  // بنود الاسترجاع
  const rows=document.querySelectorAll('#refund-rows tr');
  let rarr=[]; try{ rarr=JSON.parse(x.refund_json||'[]'); }catch(e){ rarr=[]; }
  rows.forEach(tr=>{ const a=tr.querySelector('.r-amt'); if(a) a.value=''; });
  rarr.forEach(item=>{
    const want=String(item.desc||'').trim();
    const tr=[...rows].find(r=>(r.getAttribute('data-refund-key')||'').trim()===want
      || (r.querySelector('td')?.textContent||'').trim()===want);
    if(tr){ const a=tr.querySelector('.r-amt'); if(a) a.value=item.amount?fmtAmt(String(item.amount)):''; }
  });
  recalcRefund();
  // طريقة الاسترجاع
  const method = x.refund_method==='bank' ? 'bank' : 'fawran';
  document.querySelectorAll('input[name="c-payout"]').forEach(r=>{ r.checked = (r.value===method); });
  setPayout(method);
  if(method==='bank') set('c-iban', x.refund_account); else set('c-fawran-phone', x.refund_account);
  // التوقيع
  if(x.signed_by){
    SIGNED.cancel={ name:x.signed_by, time:x.signed_at, label:stampDate(x.signed_at) };
    document.getElementById('cancel-sig-ph').style.display='none';
    document.getElementById('cancel-sig-stamp').classList.add('on');
    document.getElementById('cancel-sig-mono').textContent = initials(x.signed_by);
    document.getElementById('cancel-sig-name').textContent = personName(x.signed_by);
    document.getElementById('cancel-sig-meta').textContent = stampDate(x.signed_at);
  } else {
    SIGNED.cancel=null;
    document.getElementById('cancel-sig-stamp').classList.remove('on');
    document.getElementById('cancel-sig-ph').style.display='block';
  }
  // اعتماد الحسابات
  if(x.accounts_signed_by){
    setAccSign('cancel', { name:x.accounts_signed_by, time:x.accounts_signed_at, label:stampDate(x.accounts_signed_at) });
    document.getElementById('cancel-acc-ph').style.display='none';
    document.getElementById('cancel-acc-stamp').classList.add('on');
    document.getElementById('cancel-acc-mono').textContent = initials(x.accounts_signed_by);
    document.getElementById('cancel-acc-name').textContent = personName(x.accounts_signed_by);
    document.getElementById('cancel-acc-meta').textContent = stampDate(x.accounts_signed_at);
  } else {
    setAccSign('cancel', null);
    document.getElementById('cancel-acc-stamp').classList.remove('on');
    document.getElementById('cancel-acc-ph').style.display='block';
  }
  const cRow=document.getElementById('cancel-acc-btn-row');
  if(cRow) cRow.style.display = (CURRENT && CURRENT.role==='accountant' && !x.accounts_signed_by) ? 'flex' : 'none';
  applyArchiveEditLock('cancel', x);
}

/* ══════════════════════════════════════════
   CLEAR
══════════════════════════════════════════ */
function clearCancel(){
  VIEW_ONLY = false;
  setDocumentLocked('cancel', false);
  document.querySelectorAll('#page-cancel input[type=text],#page-cancel input[type=tel],#page-cancel textarea').forEach(i=>i.value='');
  document.getElementById('c-date').value=TODAY;
  document.getElementById('c-reqno').value='RR-0001';
  document.querySelectorAll('#c-alloc .chk input').forEach(cb=>{cb.checked=false;cb.closest('.chk').classList.remove('on');});
  document.getElementById('c-fullinv').checked=false;
  document.querySelectorAll('#refund-rows .r-amt').forEach(i=>i.value='');
  recalcRefund();
  // إعادة طريقة الاسترجاع للوضع الافتراضي (فوري)
  document.querySelectorAll('input[name="c-payout"]').forEach(r=>{ r.checked=(r.value==='fawran'); });
  setPayout('fawran');
  SIGNED.cancel=null;
  document.getElementById('cancel-sig-stamp').classList.remove('on');
  document.getElementById('cancel-sig-ph').style.display='block';
  // إعادة ضبط اعتماد الحسابات
  setAccSign('cancel', null);
  document.getElementById('cancel-acc-stamp').classList.remove('on');
  document.getElementById('cancel-acc-ph').style.display='block';
  const cRow=document.getElementById('cancel-acc-btn-row');
  if(cRow) cRow.style.display='none';
  EDIT_ID=null;
  EDIT_REQUEST=null;
  updateFormMode('cancel');
  refreshNextRequestNo('cancel');
}
function clearDisb(){
  VIEW_ONLY = false;
  setDocumentLocked('disb', false);
  ['d-project','d-amt'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('d-name').value = personName(CURRENT?.name||'');
  document.getElementById('d-dept').value = t(CURRENT?.dept||'');
  document.getElementById('d-date').value=TODAY;
  document.getElementById('d-reqno').value='PV-0001';
  document.getElementById('supplier-rows').innerHTML=''; addSupplierRow(); recalcSupplier();
  const costToggle = document.getElementById('d-cost-disabled');
  if(costToggle) costToggle.checked = false;
  document.getElementById('client-rows').innerHTML=''; addClientRow(); recalcClient();
  ATTACHED=[]; renderAttach();
  clearDisbPrintAppendix();
  window.LAST_REQUEST_PDF = null; updateRequestPdfStatus();
  updateDisbWords('');
  SIGNED.disb=null;
  document.getElementById('disb-sig-stamp').classList.remove('on');
  document.getElementById('disb-sig-ph').style.display='block';
  // إعادة ضبط اعتماد الحسابات
  setAccSign('disb', null);
  document.getElementById('disb-acc-stamp').classList.remove('on');
  document.getElementById('disb-acc-ph').style.display='block';
  const row=document.getElementById('disb-acc-btn-row');
  if(row) row.style.display = (CURRENT && CURRENT.role==='accountant') ? 'flex' : 'none';
  EDIT_ID=null;
  EDIT_REQUEST=null;
  updateFormMode('disb');
  refreshNextRequestNo('disb');
}

function getPrintFilename(type, reqNo){
  const fallback = type === 'cancel' ? 'RR' : 'PV';
  const value = reqNo || document.getElementById(type === 'cancel' ? 'c-reqno' : 'd-reqno')?.value || fallback;
  return value ? value.replace(/\s+/g,'_') : fallback;
}
/* اسم الملف وقت "حفظ كـ PDF" بياخده المتصفح من عنوان الصفحة،
   فبنخلّي العنوان رقم الطلب قبل الطباعة.
   الرجوع مربوط بـafterprint مش بمؤقّت: في سفاري والموبايل
   window.print() مابتوقفش التنفيذ، فمؤقّت الثانية كان بيرجّع
   العنوان والمستخدم لسه بيختار، فالملف يتسمّى باسم الموقع. */
let PRINT_TITLE_BACKUP = null;
function setPrintTitle(name){
  if(PRINT_TITLE_BACKUP === null) PRINT_TITLE_BACKUP = document.title;
  window.PRINT_TITLE_ACTIVE = true;
  document.title = name;
  // احتياطي بعيد لو afterprint ماحصلش: العنوان يفضل رقم الطلب لحد ساعتها وده مش ضار
  clearTimeout(setPrintTitle._t);
  setPrintTitle._t = setTimeout(restorePrintTitle, 300000);
}
function restorePrintTitle(){
  if(PRINT_TITLE_BACKUP === null) return;
  clearTimeout(setPrintTitle._t);
  window.PRINT_TITLE_ACTIVE = false;
  document.title = PRINT_TITLE_BACKUP;
  PRINT_TITLE_BACKUP = null;
}

/* === طباعة طلب الإلغاء: مسار مستقل تماماً عن PDF طلب الصرف === */
async function printCancelDoc(reqNo){
  setPrintTitle(getPrintFilename('cancel', reqNo));
  commitValuesForPrint();
  window.print();
}

/* === طباعة طلب الصرف: وحده يجهّز PDF الطلب والمرفقات المنفصلة === */
async function printDisbDoc(reqNo){
  if(!ensureDisbRowsPrintable()) return;
  setPrintTitle(getPrintFilename('disb', reqNo));
  commitValuesForPrint();
  prepareDisbPrintAppendix();
  if(getDisbTableRowsCount() <= DISB_MAIN_PRINT_ROWS){
    try{
      window.LAST_REQUEST_PDF = await generateRequestPDF('doc-disb');
      updateRequestPdfStatus();
    }catch(e){
      console.warn('Could not pre-generate disbursement PDF:', e);
    }
  } else {
    window.LAST_REQUEST_PDF = null;
    updateRequestPdfStatus();
  }
  window.print();
}

/* جسر توافق للأرشيف وأي استدعاءات قديمة */
async function printDoc(type, reqNo){
  return type === 'cancel' ? printCancelDoc(reqNo) : printDisbDoc(reqNo);
}

function updateRequestPdfStatus(){
  const note = document.getElementById('disb-pdf-status');
  if(!note) return;
  if(window.LAST_REQUEST_PDF){
    note.textContent = t('نسخة الطلب جاهزة للتنزيل كـ PDF منفصل. المرفقات متاحة من قائمة المرفقات.');
  } else {
    note.textContent = '';
  }
}

document.addEventListener('input', function(event){
  if(!event.target.closest || !event.target.closest('#doc-disb')) return;
  if(window.LAST_REQUEST_PDF){
    window.LAST_REQUEST_PDF = null;
    updateRequestPdfStatus();
  }
});
window.addEventListener('beforeprint', ()=>{
  // الطباعة ممكن تبدأ من غير زرار التطبيق (Cmd+P أو قائمة المتصفح)،
  // وساعتها مافيش حاجة سمّت الملف. بنسمّيه هنا لأن الحدث ده بيحصل
  // في كل الحالات. لو زرار التطبيق سمّاه بالفعل مابنلمسوش.
  if(PRINT_TITLE_BACKUP === null){
    const isCancel = document.getElementById('page-cancel')?.classList.contains('on');
    const isDisb   = document.getElementById('page-disb')?.classList.contains('on');
    if(isCancel || isDisb) setPrintTitle(getPrintFilename(isCancel ? 'cancel' : 'disb'));
  }
  if(typeof beginBilingualDocument === 'function') beginBilingualDocument();   // الوثيقة تُطبع عربي + إنجليزي دائماً
  if(document.getElementById('page-disb')?.classList.contains('on')){
    prepareDisbPrintAppendix();
  }
});
window.addEventListener('afterprint', ()=>{
  restorePrintTitle();
  clearDisbPrintAppendix();
  if(typeof endBilingualDocument === 'function') endBilingualDocument();
});

/* === تأمين إضافي وقت الطباعة ===
   قبل أي طباعة بنثبّت القيمة اللي المستخدم كتبها جوه الـ value attribute نفسه،
   عشان حتى لو حصل أي إعادة رسم أو نسخ للصفحة، اللي اتكتب يفضل ظاهر في المطبوع.
   ده مع إخفاء الـ placeholder في CSS بيضمن إن الطلب الفاضي يطلع فاضي،
   والطلب المليان يطلع بكل بياناته من غير ما يبان t("صفر") أو قيمة وهمية. */
function commitValuesForPrint(){
  document.querySelectorAll('input, textarea, select').forEach(function(el){
    if(el.type==='checkbox' || el.type==='radio'){
      if(el.checked) el.setAttribute('checked','checked'); else el.removeAttribute('checked');
      return;
    }
    if(el.tagName==='TEXTAREA'){ el.textContent = el.value; return; }
    if(el.tagName==='SELECT'){
      Array.prototype.forEach.call(el.options, function(o){
        if(o.selected) o.setAttribute('selected','selected'); else o.removeAttribute('selected');
      });
      return;
    }
    el.setAttribute('value', el.value);
  });
}
window.addEventListener('beforeprint', commitValuesForPrint);

/* ══════════════════════════════════════════
   تنزيل الطلب PDF مباشرة من إدارة الطلبات
   (نفس مسار توليد PDF المستخدم في الطباعة)
══════════════════════════════════════════ */
function showBusyOverlay(text){
  hideBusyOverlay();
  const ov = document.createElement('div');
  ov.id = 'app-busy-overlay';
  ov.dir = 'rtl';
  ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(15,19,33,.55);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';
  ov.innerHTML = `
    <div class="abz-card"><span class="abz-spin"></span><span>${escapeHtml(text||t('جاري التجهيز...'))}</span></div>`;
  document.body.appendChild(ov);
}
function hideBusyOverlay(){
  document.getElementById('app-busy-overlay')?.remove();
}

/* ══════════════════════════════════════════
   التحويل المجمّع — إثبات تحويل واحد لعدة طلبات
══════════════════════════════════════════ */
let ARC_SELECT_MODE = false;
let TRANSFER_COLS_OK = null;                 // هل أعمدة المجموعة موجودة في قاعدة البيانات؟
const ARC_SELECTED = new Set();              // ids الطلبات المحددة
const ARC_SELECTED_DATA = new Map();         // id → بيانات مختصرة (تفضل محفوظة رغم تغيّر الفلاتر)
const TRANSFER_GROUP_SQL = 'ALTER TABLE requests ADD COLUMN IF NOT EXISTS transfer_group TEXT;\nALTER TABLE requests ADD COLUMN IF NOT EXISTS transfer_group_at TIMESTAMPTZ;\nALTER TABLE requests ADD COLUMN IF NOT EXISTS transfer_group_note TEXT;';

// أرقام الوثيقة: نعرض الكسور لما تكون موجودة بس — 2222 مش 2222.00
function docAmount(n){
  const v = Number(n) || 0;
  const frac = Math.abs(v % 1) > 0.0000001;
  return v.toLocaleString('en-US', frac
    ? { minimumFractionDigits:2, maximumFractionDigits:2 }
    : { minimumFractionDigits:0, maximumFractionDigits:0 });
}
function formatMoney(n){
  const v = Number(n)||0;
  return v.toLocaleString('en-US',{ minimumFractionDigits:2, maximumFractionDigits:2 });
}
function transferGroupColor(gid){
  // لون واحد لكل المجموعات — هوية المجموعة رقمها وإطارها مش لونها
  return '#287E80';
}
// مزج لون المجموعة بالأبيض (k = نسبة اللون) لإنتاج درجات فاتحة
function mixWithWhite(hex, k){
  const c = i => Math.round(parseInt(hex.substr(i,2),16) * k + 255 * (1-k));
  return `rgb(${c(0)},${c(2)},${c(4)})`;
}
// متغيّرات لون الكتلة: اللون الأساسي + خلفية الصفوف + خلفية التمرير + لون الحدود الرفيعة
function transferGroupVars(gid){
  const hex = transferGroupColor(gid).replace('#','');
  return `--grp:#${hex};--grp-bg:${mixWithWhite(hex,0.045)};--grp-bg2:${mixWithWhite(hex,0.10)};--grp-line:${mixWithWhite(hex,0.28)}`;
}
// ترتيب القائمة بحيث تفضل طلبات كل تحويل مجمّع ورا بعض ككتلة واحدة،
// والكتلة تاخد مكان أعلى رقم طلب فيها عشان الترتيب العام ما يتلخبطش.
function sortTransferGroupsTogether(list){
  // بنحافظ على ترتيب المستخدم، وبنجمّع طلبات كل تحويل عند أول موضع ظهور للمجموعة
  const gidOf = r => (r && !r.cancelled && r.transfer_group) ? r.transfer_group : '';
  const idx = new Map(list.map((r,i)=>[r,i]));
  const anchor = {};
  list.forEach((r,i)=>{ const g=gidOf(r); if(g && !(g in anchor)) anchor[g]=i; });
  list.sort((a,b)=>{
    const ga=gidOf(a), gb=gidOf(b);
    const ka = ga ? anchor[ga] : idx.get(a);
    const kb = gb ? anchor[gb] : idx.get(b);
    if(ka !== kb) return ka - kb;
    if(ga !== gb) return ga < gb ? -1 : 1;
    return idx.get(a) - idx.get(b);
  });
  return list;
}
// الطلب صالح للتحويل المجمّع: معتمد من الحسابات، غير ملغي، ولسه مرفعلوش إثبات
function isTransferSelectable(x){
  return !!(x && x.id && x.accounts_signed_by && !x.cancelled && !x.transfer_image);
}
async function ensureTransferColumns(){
  if(TRANSFER_COLS_OK !== null) return TRANSFER_COLS_OK;
  if(!SB_ON){ TRANSFER_COLS_OK = false; return false; }
  try{
    const { error } = await sb.from('requests').select('transfer_group').limit(1);
    TRANSFER_COLS_OK = !error;
  }catch(e){ TRANSFER_COLS_OK = false; }
  return TRANSFER_COLS_OK;
}
async function loadTransferGroupsFor(list){
  window._arcGroups = {};
  if(!SB_ON || !TRANSFER_COLS_OK) return;
  const gids = [...new Set((list||[]).map(r=>r.transfer_group).filter(Boolean))];
  if(!gids.length) return;
  try{
    const { data, error } = await sb.from('requests')
      .select('id,req_no,doc_type,amount,created_by,transfer_group,transfer_group_at,transfer_group_note,cancelled')
      .in('transfer_group', gids).limit(500);
    if(error) throw error;
    (data||[]).filter(r=>!r.cancelled).forEach(r=>{
      const g = window._arcGroups[r.transfer_group] || (window._arcGroups[r.transfer_group] = { rows:[], total:0, note:'', at:null });
      g.rows.push(r);
      g.total += Number(r.amount)||0;
      if(!g.note && r.transfer_group_note) g.note = r.transfer_group_note;
      if(!g.at && r.transfer_group_at) g.at = r.transfer_group_at;
    });
  }catch(e){ console.warn(t('تعذّر تحميل بيانات مجموعات التحويل'), e); }
}
function renderTransferGroupNote(noteSlot, search){
  if(!noteSlot) return;
  const gid = String(search||'').trim().toUpperCase();
  if(!/^TRF-\d+$/.test(gid)) return;
  const info = (window._arcGroups||{})[gid];
  if(!info) return;
  noteSlot.innerHTML = `<div class="arc-note arc-group-note" style="--grp:${transferGroupColor(gid)}">
      <div class="agn-txt">
        <b>مجموعة تحويل ${escapeHtml(gid)}</b>
        <span>${info.rows.length} ${t('طلبات')} · ${t('إجمالي')} ${formatMoney(info.total)} ${t('ر.ق')}${info.at?' · '+formatArchiveDateTime(info.at):''}${info.note?t(' · مرجع: ')+escapeHtml(info.note):''}</span>
      </div>
      <button class="arc-group-clear" onclick="clearArchiveSearch()">${t('إلغاء الفلتر')}</button>
    </div>`;
}
function filterByTransferGroup(gid){
  closeArchiveMenu();
  const input = document.getElementById('arc-search');
  if(!input) return;
  input.value = gid;
  if(ARC_TAB !== 'all'){ setArcTab('all'); return; }
  loadArchive();
}
function clearArchiveSearch(){
  const input = document.getElementById('arc-search');
  if(input) input.value = '';
  loadArchive();
}

/* ── وضع التحديد ── */
function toggleTransferSelectMode(){
  if(!CURRENT || CURRENT.role!=='accountant'){
    showMessageDialog({ title:t('غير مسموح'), message:t('التحويل المجمّع متاح للمحاسب فقط.'), confirmText:t('حسنًا') });
    return;
  }
  if(TRANSFER_COLS_OK === false){
    showMessageDialog({
      title:t('الميزة تحتاج تجهيز قاعدة البيانات'),
      subtitle:'Setup Required',
      message:t('أعمدة التحويل المجمّع غير موجودة في جدول requests. يُرجى تنفيذ الأوامر التالية مرة واحدة في Supabase > SQL Editor:\n\n')+TRANSFER_GROUP_SQL,
      confirmText:t('حسنًا')
    });
    return;
  }
  ARC_SELECT_MODE = !ARC_SELECT_MODE;
  if(!ARC_SELECT_MODE){ ARC_SELECTED.clear(); ARC_SELECTED_DATA.clear(); }
  loadArchive();
}
function exitTransferSelectMode(){
  ARC_SELECT_MODE = false;
  ARC_SELECTED.clear();
  ARC_SELECTED_DATA.clear();
  const bulkBtn = document.getElementById('arc-bulk-btn');
  if(bulkBtn) bulkBtn.classList.remove('on');
  updateTransferSelectUI();
}
function cancelTransferSelectMode(){
  exitTransferSelectMode();
  loadArchive();
}
function toggleTransferSelection(id, checked, el){
  const x = (window._arcRows||[]).find(r=>r.id===id);
  if(checked){
    ARC_SELECTED.add(id);
    if(x) ARC_SELECTED_DATA.set(id, { id, req_no:displayRequestNo(x.req_no), amount:Number(x.amount)||0, created_by:x.created_by, doc_type:x.doc_type });
  } else {
    ARC_SELECTED.delete(id);
    ARC_SELECTED_DATA.delete(id);
  }
  // تلوين الصف المحدد بدون إعادة تحميل الجدول
  el?.closest('tr')?.classList.toggle('arc-row-selected', !!checked);
  updateTransferSelectUI();
}
function selectAllTransferCandidates(on){
  (window._arcRows||[]).filter(isTransferSelectable).forEach(r=>{
    if(on){
      ARC_SELECTED.add(r.id);
      ARC_SELECTED_DATA.set(r.id, { id:r.id, req_no:displayRequestNo(r.req_no), amount:Number(r.amount)||0, created_by:r.created_by, doc_type:r.doc_type });
    } else {
      ARC_SELECTED.delete(r.id);
      ARC_SELECTED_DATA.delete(r.id);
    }
  });
  loadArchive();
}
// إزالة أي تحديد لطلب بقى غير صالح (اتلغى أو اترفعله إثبات من جهاز تاني)
function pruneTransferSelection(list){
  if(!ARC_SELECT_MODE) return;
  (list||[]).forEach(r=>{
    if(ARC_SELECTED.has(r.id) && !isTransferSelectable(r)){
      ARC_SELECTED.delete(r.id);
      ARC_SELECTED_DATA.delete(r.id);
    }
  });
}
function updateTransferSelectUI(){
  const bar = document.getElementById('arc-select-bar');
  if(!bar) return;
  const isAcc = CURRENT && CURRENT.role==='accountant';
  if(!isAcc || !ARC_SELECT_MODE){
    bar.classList.remove('on');
    bar.innerHTML = '';
    document.body.classList.remove('arc-selecting');
    return;
  }
  const picked = [...ARC_SELECTED_DATA.values()];
  const total = picked.reduce((s,r)=>s+(Number(r.amount)||0), 0);
  const candidates = (window._arcRows||[]).filter(isTransferSelectable);
  const allOn = candidates.length>0 && candidates.every(r=>ARC_SELECTED.has(r.id));
  bar.innerHTML = `
    <div class="asb-info">
      <b>${picked.length}</b>
      <span>${t('طلب محدد · إجمالي')} <b class="asb-total">${formatMoney(total)}</b> ${t('ر.ق')}</span>
    </div>
    <div class="asb-actions">
      ${candidates.length ? `<button class="asb-btn ghost" onclick="selectAllTransferCandidates(${allOn?'false':'true'})">${allOn?t('إلغاء تحديد الكل'):t('تحديد كل المعروض')}</button>` : ''}
      <button class="asb-btn ghost" onclick="cancelTransferSelectMode()">${t('إنهاء')}</button>
      <button class="asb-btn go"${picked.length<2?' disabled':''} onclick="startGroupTransfer()">${t('رفع إثبات تحويل مجمّع')}</button>
    </div>`;
  bar.classList.add('on');
  document.body.classList.add('arc-selecting');
}

/* ── نافذة رفع الإثبات المجمّع ── */
function showGroupTransferDialog(rows, total){
  return new Promise(resolve=>{
    document.getElementById('app-group-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'app-group-overlay';
    overlay.dir = 'rtl';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,19,33,.55);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';
    overlay.innerHTML = `
      <div class="agd-card" role="dialog" aria-modal="true">
        <div class="agd-head">
          <div class="agd-title">${t('تحويل مجمّع — إثبات واحد لعدة طلبات')}</div>
          <div class="agd-cap">Grouped Transfer</div>
        </div>
        <div class="agd-body">
          <div class="agd-list">
            ${rows.map(r=>`<div class="agd-row">
              <div><div class="agd-no">${escapeHtml(r.req_no||'—')}</div><div class="agd-by">${escapeHtml(r.created_by||'—')}</div></div>
              <div class="agd-amt">${formatMoney(r.amount)}</div>
            </div>`).join('')}
          </div>
          <div class="agd-total"><span>${t('إجمالي المبلغ المحوّل')} (${rows.length} ${t('طلبات')})</span><b>${formatMoney(total)} QAR</b></div>
          <div class="agd-field">
            <label>${t('مرجع التحويل / ملاحظة (اختياري)')}</label>
            <input type="text" id="agd-note" placeholder="${t('مثال: تحويل بنكي رقم 123456')}" maxlength="80"/>
          </div>
          <div class="agd-file" id="agd-file-box">
            <b>${t('اضغط لاختيار إثبات التحويل')}</b>
            <small>${t('صورة أو PDF — بحد أقصى 2 ميجابايت')}</small>
          </div>
          <input type="file" id="agd-file" accept="image/*,application/pdf" style="display:none"/>
        </div>
        <div class="agd-foot">
          <button class="agd-btn agd-cancel" data-action="cancel">${t('رجوع')}</button>
          <button class="agd-btn agd-confirm" data-action="confirm" disabled>${t('رفع الإثبات للكل')}</button>
        </div>
      </div>`;
    const fileInput = overlay.querySelector('#agd-file');
    const fileBox = overlay.querySelector('#agd-file-box');
    const confirmBtn = overlay.querySelector('[data-action="confirm"]');
    fileBox.addEventListener('click', ()=>fileInput.click());
    fileInput.addEventListener('change', ()=>{
      const f = fileInput.files[0];
      if(!f) return;
      if(f.size > 2*1024*1024){
        fileBox.classList.remove('picked');
        fileBox.innerHTML = t('<b style="color:#d9415f">الملف أكبر من 2 ميجابايت</b><small>اختر ملفاً أصغر</small>');
        fileInput.value = '';
        confirmBtn.disabled = true;
        return;
      }
      fileBox.classList.add('picked');
      fileBox.innerHTML = `<b>${escapeHtml(f.name)}</b><small>${(f.size/1024).toFixed(0)} KB — ${t('اضغط للتغيير')}</small>`;
      confirmBtn.disabled = false;
    });
    const close = value => { document.removeEventListener('keydown', onKey); overlay.remove(); resolve(value); };
    const onKey = e=>{ if(e.key==='Escape') close(null); };
    overlay.addEventListener('click', e=>{ if(e.target===overlay) close(null); });
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', ()=>close(null));
    confirmBtn.addEventListener('click', ()=>{
      const f = fileInput.files[0];
      if(!f) return;
      close({ file:f, note:(overlay.querySelector('#agd-note').value||'').trim() });
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
  });
}
async function getNextTransferGroupNo(){
  const { data, error } = await sb.from('requests')
    .select('transfer_group').not('transfer_group','is',null).limit(2000);
  if(error) throw error;
  let max = 0;
  (data||[]).forEach(r=>{
    const m = String(r.transfer_group||'').match(/^TRF-(\d+)$/i);
    if(m){ const n = parseInt(m[1],10)||0; if(n>max) max = n; }
  });
  return `TRF-${String(max+1).padStart(4,'0')}`;
}
async function startGroupTransfer(){
  if(!CURRENT || CURRENT.role!=='accountant'){ await showMessageDialog({ title:t('غير مسموح'), message:t('التحويل المجمّع متاح للمحاسب فقط.'), confirmText:t('حسنًا') }); return; }
  if(!SB_ON){ await showMessageDialog({ title:t('الأرشيف غير مفعّل'), message:t('لا يمكن رفع إثبات التحويل بدون اتصال بقاعدة البيانات.'), confirmText:t('حسنًا') }); return; }
  const picked = [...ARC_SELECTED_DATA.values()];
  if(picked.length < 2){
    await showMessageDialog({ title:t('اختر طلبين على الأقل'), message:t('التحويل المجمّع يربط أكثر من طلب بإثبات تحويل واحد. حدّد طلبين أو أكثر.'), confirmText:t('حسنًا') });
    return;
  }
  const total = picked.reduce((s,r)=>s+(Number(r.amount)||0), 0);
  const result = await showGroupTransferDialog(picked, total);
  if(!result) return;
  showBusyOverlay(t('جاري رفع إثبات التحويل وربط الطلبات...'));
  try{
    const path = await uploadFileToStorage(result.file, 'transfer-images');
    const gid = await getNextTransferGroupNo();
    const ids = picked.map(r=>r.id);
    const { error } = await sb.from('requests').update({
      transfer_image: path,
      transfer_seen: false,
      transfer_group: gid,
      transfer_group_at: new Date().toISOString(),
      transfer_group_note: result.note || null
    }).in('id', ids);
    if(error) throw error;
    exitTransferSelectMode();
    loadArchive();
    hideBusyOverlay();
    await showMessageDialog({
      title:t('تم إنشاء التحويل المجمّع'),
      subtitle:'Grouped Transfer Created',
      message:t('تم ربط الطلبات المحددة بإثبات تحويل واحد، وأُرسل إشعار لأصحاب الطلبات.'),
      details:[
        { label:t('رقم المجموعة'), value:gid, ltr:true },
        { label:t('عدد الطلبات'), value:String(picked.length), ltr:true },
        { label:t('إجمالي المبلغ'), value:formatMoney(total)+' QAR', ltr:true },
        ...(result.note ? [{ label:t('مرجع التحويل'), value:result.note }] : [])
      ],
      confirmText:t('حسنًا')
    });
  }catch(e){
    console.error(e);
    hideBusyOverlay();
    const msg = String(e?.message||'');
    await showMessageDialog({
      title:t('تعذّر إتمام التحويل المجمّع'),
      message: /column|transfer_group/i.test(msg)
        ? t('أعمدة التحويل المجمّع غير موجودة. يُرجى تنفيذ الأوامر التالية في Supabase > SQL Editor:\n\n')+TRANSFER_GROUP_SQL
        : t('حدث خطأ أثناء رفع الإثبات أو ربط الطلبات. تحقّق من الاتصال وحاول مرة أخرى.'),
      confirmText:t('حسنًا')
    });
  } finally { hideBusyOverlay(); }
}
async function deleteTransferGroup(gid){
  if(!CURRENT || CURRENT.role!=='accountant'){ await showMessageDialog({ title:t('غير مسموح'), message:t('هذه الخاصية للمحاسب فقط.'), confirmText:t('حسنًا') }); return; }
  if(!gid || !SB_ON) return;
  const info = (window._arcGroups||{})[gid];
  const ok = await showConfirmDialog({
    title:t('حذف التحويل المجمّع'),
    message:t('سيتم حذف إثبات التحويل من جميع طلبات المجموعة وفكّ ارتباطها. لن تتأثر الطلبات نفسها، ويمكن رفع إثبات جديد لاحقًا.'),
    details:[
      { label:t('رقم المجموعة'), value:gid, ltr:true },
      { label:t('عدد الطلبات'), value:String(info ? info.rows.length : '—'), ltr:true }
    ],
    confirmText:t('حذف المجموعة'), cancelText:t('رجوع'), danger:true
  });
  if(!ok) return;
  showBusyOverlay(t('جاري حذف التحويل المجمّع...'));
  try{
    const { error } = await sb.from('requests').update({
      transfer_image:null, transfer_seen:false,
      transfer_group:null, transfer_group_at:null, transfer_group_note:null
    }).eq('transfer_group', gid);
    if(error) throw error;
    loadArchive();
    hideBusyOverlay();
    await showMessageDialog({ title:t('تم الحذف'), message:t('تم حذف إثبات التحويل من كل طلبات المجموعة.'), confirmText:t('حسنًا') });
  }catch(e){
    console.error(e);
    hideBusyOverlay();
    await showMessageDialog({ title:t('تعذّر الحذف'), message:t('حدث خطأ أثناء حذف المجموعة. حاول مرة أخرى.'), confirmText:t('حسنًا') });
  } finally { hideBusyOverlay(); }
}


/* ══════════════════════════════════════════
   تحديث الأجزاء الديناميكية بعد تبديل اللغة
══════════════════════════════════════════ */
function refreshDynamicUI(){
  try{
    if(CURRENT){
      const role = document.getElementById('tb-role');
      if(role) role.textContent = personName(CURRENT.dept || '');
      if(typeof syncUserChip==='function') syncUserChip();
      const nameEl = document.getElementById('tb-name');
      if(nameEl) nameEl.textContent = personName(CURRENT.name);
      const dName = document.getElementById('d-name');
      if(dName && !EDIT_ID) dName.value = personName(CURRENT.name);
      const dept = document.getElementById('d-dept');
      if(dept && !EDIT_ID) dept.value = personName(CURRENT.dept || '');
    }
    // أسماء التواقيع المعروضة تتحدّث مع اللغة (المخزَّن ما بيتغيّرش)
    ['disb','cancel'].forEach(k=>{
      const sg = SIGNED[k]; if(sg){ const el=document.getElementById(k+'-sig-name'); if(el) el.textContent = personName(sg.name); }
      const ac = getAccSign(k); if(ac){ const el=document.getElementById(k+'-acc-name'); if(el) el.textContent = personName(ac.name); }
    });
    if(typeof renderAttach === 'function') renderAttach();
    if(typeof updateDisbWords === 'function') updateDisbWords(document.getElementById('d-amt')?.value || '');
    if(typeof updateMatch === 'function') updateMatch();
    if(typeof updateCostCenterDisabledUI === 'function') updateCostCenterDisabledUI();
    if(typeof updateRequestPdfStatus === 'function') updateRequestPdfStatus();
    if(typeof setDisbMainTotalLabels === 'function') setDisbMainTotalLabels(!!document.getElementById('doc-disb')?.classList.contains('has-appendix'));
    if(typeof closeArchiveMenu === 'function') closeArchiveMenu();
    if(typeof closeArchiveTimePopover === 'function') closeArchiveTimePopover();
    if(document.getElementById('page-arc')?.classList.contains('on') && typeof loadArchive === 'function') loadArchive();
    if(typeof updateTransferSelectUI === 'function') updateTransferSelectUI();
  }catch(e){ console.warn('refreshDynamicUI', e); }
}

/* ══════════════════════════════════════════
   حالة الطلب + شريط الملخّص + عدّاد النتائج
══════════════════════════════════════════ */
// مرحلة واحدة واضحة بدل قراءة ثلاثة أعمدة
function requestStatus(x){
  if(!x) return { key:'unsigned', label:'بانتظار التوقيع', cls:'st-unsigned' };
  if(x.cancelled)          return { key:'cancelled',   label:'ملغى',                 cls:'st-cancelled' };
  if(x.transfer_image)     return { key:'transferred', label:'تم التحويل',            cls:'st-transferred' };
  if(x.accounts_signed_by) return { key:'approved',    label:'معتمد',                 cls:'st-approved' };
  if(x.signed_by)          return { key:'pending',     label:'بانتظار الاعتماد',       cls:'st-pending' };
  return                          { key:'unsigned',    label:'بانتظار التوقيع',        cls:'st-unsigned' };
}

// شريط الملخّص: عدد ومبلغ كل مرحلة، والضغط يفلتر الجدول
function renderArchiveSummary(list){
  const box = document.getElementById('arc-summary');
  if(!box) return;
  const live = (list||[]).filter(r=>!r.cancelled);
  const sum = rows => rows.reduce((a,r)=>a+(Number(r.amount)||0), 0);
  const review    = live.filter(r=>!r.accounts_signed_by);
  const approved  = live.filter(r=>r.accounts_signed_by && !r.transfer_image);
  const done      = live.filter(r=>r.transfer_image);
  const cards = [
    { key:null,          label:'كل الطلبات',           rows:live,     cls:'sm-all' },
    { key:'review',      label:'قيد المراجعة',          rows:review,   cls:'sm-review' },
    { key:'approved',    label:'معتمد — بانتظار التحويل', rows:approved, cls:'sm-approved' },
    { key:'transferred', label:'تم التحويل',            rows:done,     cls:'sm-done' },
  ];
  const active = k => ARC_STATUS===k || (k==='review' && (ARC_STATUS==='pending'||ARC_STATUS==='unsigned'));
  box.innerHTML = cards.map(c=>`
    <button class="arc-stat ${c.cls}${active(c.key)?' on':''}"
            onclick="setArchiveStatusFilter(${c.key===null?'null':`'${c.key}'`})"
            title="${escAttr(t(c.label))} — ${formatMoney(sum(c.rows))} ${t('ر.ق')}">
      <i class="stat-dot"></i>
      <span class="stat-n">${c.rows.length}</span>
      <span class="stat-txt"><b>${t(c.label)}</b><em>${formatMoney(sum(c.rows))} ${t('ر.ق')}</em></span>
    </button>`).join('<span class="arc-stat-sep"></span>');
}
function setArchiveStatusFilter(key){
  ARC_STATUS = (ARC_STATUS===key) ? null : key;
  loadArchive();
}
function renderArchiveCount(shown, afterTab, fetched){
  const el = document.getElementById('arc-count');
  if(!el) return;
  const capped = fetched >= 200;
  el.innerHTML = `${t('عرض')} <b>${shown}</b> ${t('من')} <b>${afterTab}</b> ${t('طلب')}`
    + (capped ? ` · <span class="arc-count-warn">${t('الحد الأقصى للعرض 200 طلب — استخدم البحث أو فلتر التاريخ')}</span>` : '');
}
// سجل التوقيت من قائمة الإجراءات
function showArchiveTimeFromMenu(btn, rowIndex){
  const x = (window._arcRows||[])[rowIndex];
  if(!x) return;
  // نقيس موضع الزر قبل ما القائمة تتقفل — بعد الإقفال القياس بيرجع أصفار
  const rect = btn.getBoundingClientRect();
  const anchor = { getBoundingClientRect: () => rect };
  closeArchiveMenu();
  showArchiveTimePopover(anchor, formatArchiveDateTime(x.created_at || x.signed_at || x.req_date),
    x.accounts_signed_at ? formatArchiveDateTime(x.accounts_signed_at) : t('لم يعتمد بعد'));
}

/* ══════════════════════════════════════════
   قائمة المستخدم في الشريط العلوي
══════════════════════════════════════════ */
function syncUserChip(){
  if(!CURRENT) return;
  const name = personName(CURRENT.name), role = personName(CURRENT.dept);
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  set('tb-avatar', initials(CURRENT.name));
  set('tbm-avatar', initials(CURRENT.name));
  set('tbm-name', name);
  set('tbm-role', role);
  const lang=document.getElementById('tbm-lang');
  if(lang) lang.textContent = isEnglish() ? 'English' : 'العربية';
}
// ═══════════════════════════════════════════════════════════
//  إشعارات داخل الموقع — الأحداث بتتشتق من بيانات الطلبات
//  نفسها، من غير جدول جديد. حالة «مقروء» محفوظة محليًا لكل
//  مستخدم كآخر وقت شافه.
// ═══════════════════════════════════════════════════════════
let NOTIFS = [];
function notifSeenKey(){ return 'zamzam-notif-seen-' + (CURRENT?.user || CURRENT?.name || 'x'); }
function notifSeenAt(){ try{ return localStorage.getItem(notifSeenKey()) || ''; }catch(e){ return ''; } }
function markNotifsSeen(){
  try{ localStorage.setItem(notifSeenKey(), new Date().toISOString()); }catch(e){}
  renderNotifBadge();
}
// بناء قائمة الأحداث اللي تخصّ المستخدم الحالي
function buildNotifs(rows){
  if(!CURRENT) return [];
  const me   = CURRENT.name;
  const role = CURRENT.role;
  const out  = [];
  const push = (at, icon, title, body, id) => { if(at) out.push({at, icon, title, body, id}); };

  (rows||[]).forEach(x=>{
    if(!x || x.cancelled) return;
    const no    = displayRequestNo(x.req_no) || '';
    const mine  = x.created_by === me;
    const party = x.doc_type === 'cancel' ? (x.invoice_ref||'') : (x.beneficiary||'');

    // 1) الموظف قدّم الطلب → المحاسب
    if(role === 'accountant' && x.signed_by && !x.accounts_signed_by){
      push(x.signed_at, 'clock', t('بانتظار اعتمادك'), no + (party ? ' · ' + party : ''), x.id);
    }
    // 2) المحاسب اعتمد → صاحب الطلب + الإدارة
    if(x.accounts_signed_by){
      if(mine)
        push(x.accounts_signed_at, 'check', t('تم اعتماد طلبك'),
             no + (party ? ' · ' + party : ''), x.id);
      else if(role === 'viewer')
        push(x.accounts_signed_at, 'check', t('طلب معتمد بانتظار التحويل'),
             no + ' · ' + t('اعتمده') + ' ' + personName(x.accounts_signed_by||'')
                + (party ? ' · ' + party : ''), x.id);
    }
    // 3) المحاسب رفع إثبات التحويل → صاحب الطلب وحده
    if(x.transfer_image && mine)
      push(x.transfer_group_at || x.accounts_signed_at, 'money', t('تم تحويل طلبك'),
           no + (party ? ' · ' + party : ''), x.id);

    // 4) التعليقات — حسب اختيار كاتبها وحده، من غير أي شرط إضافي
    getRequestComments(x).forEach(c=>{
      if(!c || !c.at || c.by === me) return;
      if(!canSeeComment(c)) return;
      push(c.at, 'comment', t('تعليق جديد'),
           no + ' · ' + personName(c.by||'') + ' — ' + String(c.text||'').slice(0, 48), x.id);
    });
  });

  out.sort((a,b)=> String(b.at).localeCompare(String(a.at)));
  return out.slice(0, 40);
}
async function loadNotifs(){
  if(!SB_ON || !CURRENT) return;
  try{
    let q = sb.from('requests')
      .select('id,req_no,doc_type,beneficiary,invoice_ref,created_by,signed_by,signed_at,accounts_signed_by,accounts_signed_at,transfer_image,transfer_group_at,comments_data,cancelled')
      .order('id',{ascending:false}).limit(120);
    if(CURRENT.role === 'sales') q = q.eq('created_by', CURRENT.name);
    const { data, error } = await q;
    if(error || !Array.isArray(data)) return;
    NOTIFS = buildNotifs(data);
    renderNotifBadge();
  }catch(e){}
}
function unreadNotifs(){
  const seen = notifSeenAt();
  return NOTIFS.filter(n => !seen || String(n.at) > seen);
}
function renderNotifBadge(){
  const b = document.getElementById('tb-bell-count');
  if(!b) return;
  const n = unreadNotifs().length;
  b.textContent = n > 99 ? '99+' : String(n);
  b.classList.toggle('on', n > 0);
  const btn = document.getElementById('tb-bell');
  if(btn) btn.setAttribute('aria-label', t('الإشعارات') + (n ? ' — ' + n : ''));
}
const NOTIF_ICONS = {
  clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>',
  check:'<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"></path></svg>',
  upload:'<svg viewBox="0 0 24 24"><path d="M12 19V5"></path><path d="m5 12 7-7 7 7"></path></svg>',
  money:'<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2.5"></circle></svg>',
  comment:'<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"></path></svg>'
};
function toggleNotifPanel(ev){
  if(ev) ev.stopPropagation();
  const panel = document.getElementById('tb-notif');
  if(!panel) return;
  const open = panel.classList.contains('on');
  closeUserMenu && closeUserMenu();
  if(open){ panel.classList.remove('on'); return; }
  const seen = notifSeenAt();
  panel.innerHTML = NOTIFS.length ? `
    <div class="ntf-head">
      <b>${escapeHtml(t('الإشعارات'))}</b>
      <button class="ntf-clear" onclick="markNotifsSeen();toggleNotifPanel(event)">${escapeHtml(t('تحديد الكل كمقروء'))}</button>
    </div>
    <div class="ntf-list">${NOTIFS.map(n=>`
      <button class="ntf-item${(!seen || String(n.at) > seen) ? ' unread' : ''}" onclick="openNotif(${n.id})">
        <span class="ntf-ic">${NOTIF_ICONS[n.icon]||''}</span>
        <span class="ntf-txt"><b>${escapeHtml(n.title)}</b><span>${escapeHtml(n.body)}</span>
          <em>${escapeHtml(formatArchiveDateTime ? formatArchiveDateTime(n.at) : String(n.at).slice(0,16))}</em></span>
      </button>`).join('')}</div>`
    : `<div class="ntf-empty">${escapeHtml(t('لا توجد إشعارات'))}</div>`;
  panel.classList.add('on');
  markNotifsSeen();
}
function closeNotifPanel(){ document.getElementById('tb-notif')?.classList.remove('on'); }
async function openNotif(id){
  closeNotifPanel();
  showPage('arc');
  await new Promise(r=>setTimeout(r,300));
  const i = (window._arcRows||[]).findIndex(r=>r.id===id);
  if(i >= 0){ VIEW_ONLY = true; openFromArchive(i); }
}
document.addEventListener('click', e=>{
  if(e.target.closest && (e.target.closest('#tb-notif') || e.target.closest('#tb-bell'))) return;
  closeNotifPanel();
});
function toggleUserMenu(e){
  if(e) e.stopPropagation();
  const menu=document.getElementById('tb-menu'), chip=document.getElementById('tb-chip');
  if(!menu) return;
  const on = menu.classList.toggle('on');
  chip?.setAttribute('aria-expanded', on ? 'true' : 'false');
  chip?.classList.toggle('on', on);
  if(on) syncUserChip();
}
function closeUserMenu(){
  document.getElementById('tb-menu')?.classList.remove('on');
  const chip=document.getElementById('tb-chip');
  chip?.setAttribute('aria-expanded','false');
  chip?.classList.remove('on');
}
document.addEventListener('click', e=>{ if(!e.target.closest('#tb-menu') && !e.target.closest('#tb-chip')) closeUserMenu(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeUserMenu(); });

/* ══════════════════════════════════════════
   الشاشة الرئيسية — طابور شغل حسب الدور
══════════════════════════════════════════ */
// كام يوم عدّى على الطلب؟ (التقادم — أهم مؤشر في أداة مالية)
function requestAgeDays(x){
  const d = new Date(x.created_at || x.signed_at || x.req_date);
  if(Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}
function ageChip(x){
  const d = requestAgeDays(x);
  const lvl = d>=7 ? 'age-late' : d>=3 ? 'age-warn' : 'age-ok';
  const txt = d===0 ? t('اليوم') : d===1 ? t('من يوم') : t('من {n} يوم').replace('{n}', d);
  return `<span class="age ${lvl}">${ARC_ICONS.clock}${txt}</span>`;
}
function homeRow(x, primary){
  const st = requestStatus(x);
  const atts = getArchiveRowAttachments(x).length;
  return `<div class="hrow" onclick="reviewFromHome(${x.id})" role="button" tabindex="0">
    <b class="hrow-no">${displayRequestNo(x.req_no)||'—'}</b>
    <div class="hrow-party"><span class="hrow-sup">${escapeHtml(x.doc_type==='cancel' ? (x.invoice_ref||'—') : (x.beneficiary||'—'))}</span>
      ${atts?`<span class="hrow-att">${ARC_ICONS.paperclip}${atts}</span>`:''}</div>
    <div class="hrow-who">${personAvatar(x.created_by)}</div>
    <div class="hrow-st"><span class="arc-status ${st.cls}"><i></i>${t(st.label)}</span></div>
    <div class="hrow-age">${ageChip(x)}</div>
    <div class="hrow-amt">${x.amount?formatMoney(x.amount):'—'} <em>${t('ر.ق')}</em></div>
    <div class="hrow-act">${primary||''}</div>
  </div>`;
}
function homeEmpty(icon, title, sub){
  return `<div class="h-empty">${icon}<b>${t(title)}</b><span>${t(sub)}</span></div>`;
}
async function loadHome(){
  const greet=document.getElementById('home-greet'), sub=document.getElementById('home-sub');
  const acts=document.getElementById('home-actions'), body=document.getElementById('home-body');
  if(!body || !CURRENT) return;
  const isAcc = CURRENT.role==='accountant', isViewer = CURRENT.role==='viewer';
  greet.textContent = `${t('أهلاً')} ${personName(CURRENT.name)}`;
  sub.textContent   = personName(CURRENT.dept||'');
  acts.innerHTML = isViewer ? '' :
    `<button class="hbtn ghost" onclick="startNewRequest('cancel')">${ARC_ICONS.file}${t('طلب إلغاء')}</button>
     <button class="hbtn primary" onclick="startNewRequest('disb')">${ARC_ICONS.plus}${t('طلب صرف جديد')}</button>`;
  if(!SB_ON){ body.innerHTML = homeEmpty(ARC_ICONS.file,'الأرشيف غير مفعّل','—'); return; }
  body.innerHTML = `<div class="h-loading">${t('جاري التحميل...')}</div>`;
  try{
    let qy = sb.from('requests').select('*').order('id',{ascending:false}).limit(1000);
    if(CURRENT.role==='sales'){
      const names = Object.values(USER_MAP).filter(u=>u.role==='sales').map(u=>u.name);
      qy = qy.in('created_by', names);
    }
    const { data, error } = await qy;
    if(error) throw error;
    const live = (data||[]).filter(r=>!r.cancelled);
    const byAge = (a,b)=> requestAgeDays(b)-requestAgeDays(a);
    let html='';
    if(isAcc){
      const pending  = live.filter(r=>!r.accounts_signed_by).sort(byAge);
      const toPay    = live.filter(r=>r.accounts_signed_by && !r.transfer_image).sort(byAge);
      const payTotal = toPay.reduce((a,r)=>a+(Number(r.amount)||0),0);
      html += homeSection('بانتظار اعتمادك', 'طلبات موقّعة لم تُعتمد بعد', pending.length,
        pending.length ? pending.map(x=>homeRow(x,
          `<button class="hbtn sm primary" onclick="event.stopPropagation();reviewFromHome(${x.id})">${t('مراجعة واعتماد')}</button>`)).join('')
        : homeEmpty(ARC_ICONS.sign,'لا توجد طلبات بانتظار اعتمادك','لا توجد مهام معلّقة'), false);
      html += homeSection('جاهزة للتحويل', 'طلبات معتمدة لم تُحوّل بعد', toPay.length,
        toPay.length ? `<div class="h-paybar"><span>${t('إجمالي جاهز للتحويل')}</span>
             <b>${formatMoney(payTotal)} ${t('ر.ق')}</b>
             <button class="hbtn primary" onclick="startBatchFromHome()">${ARC_ICONS.layers}${t('تحويل مجمّع')}</button></div>`
            + toPay.map(x=>homeRow(x,
              `<button class="hbtn sm ghost" onclick="event.stopPropagation();uploadProofFromHome(${x.id})">${ARC_ICONS.upload}${t('رفع الإثبات')}</button>`)).join('')
        : homeEmpty(ARC_ICONS.upload,'لا توجد طلبات جاهزة للتحويل','ستظهر هنا بعد الاعتماد'), false);
    } else {
      const mine = live.filter(r=>r.created_by===CURRENT.name).sort((a,b)=>(b.id||0)-(a.id||0));
      const waiting = mine.filter(r=>!r.transfer_image);
      html += homeSection('طلباتي', 'طلبات قيد التنفيذ', waiting.length,
        waiting.length ? waiting.map(x=>homeRow(x,'')).join('')
        : homeEmpty(ARC_ICONS.doc,'لا توجد طلبات قيد التنفيذ','ابدأ بطلب صرف جديد'), false);
      const done = mine.filter(r=>r.transfer_image);
      if(done.length) html += homeSection('طلبات محوّلة', 'أحدث التحويلات', done.length,
        done.map(x=>homeRow(x,'')).join(''), false);
    }
    body.innerHTML = html;
  }catch(e){ console.error(e); body.innerHTML = homeEmpty(ARC_ICONS.file,'خطأ اتصال','حاول مرة أخرى'); }
}
function homeSection(title, sub, count, inner, more){
  return `<section class="h-sec">
    <div class="h-sec-hd"><b>${t(title)}</b><span>${t(sub)}</span>
      ${count?`<em class="h-count">${count}</em>`:''}
      ${more?`<button class="h-all" onclick="showPage('arc')">${t('عرض الكل')}</button>`:''}</div>
    <div class="h-sec-body">${inner}</div></section>`;
}
// أفعال مباشرة من الرئيسية
async function approveFromHome(id){
  const i = await openArchiveRowById(id); if(i<0) return;
  await approveFromArchive(i); loadHome();
}
async function uploadProofFromHome(id){
  const i = await openArchiveRowById(id); if(i<0) return;
  await uploadTransferImage(i); loadHome();
}
function startBatchFromHome(){
  showPage('arc');
  setTimeout(()=>{ if(!ARC_SELECT_MODE) toggleTransferSelectMode(); }, 700);
}
// نجيب صفوف الأرشيف عشان نعيد استخدام نفس الأفعال
async function openArchiveRowById(id){
  if(!(window._arcRows||[]).some(r=>r.id===id)){
    try{
      const { data } = await sb.from('requests').select('*').order('id',{ascending:false}).limit(200);
      window._arcRows = (data||[]).filter(r=>!r.cancelled);
    }catch(e){ return -1; }
  }
  return (window._arcRows||[]).findIndex(r=>r.id===id);
}


// فتح الطلب من الرئيسية للمراجعة الكاملة قبل الاعتماد
async function reviewFromHome(id){
  const i = await openArchiveRowById(id);
  if(i < 0){ showMessageDialog({ title:t('تعذّر فتح الطلب.'), message:t('حاول مرة أخرى'), confirmText:t('حسنًا') }); return; }
  viewFromArchive(i);
  // نلفت النظر لزر الاعتماد جوه الوثيقة
  setTimeout(()=>{
    const kind = (window._arcRows[i].doc_type==='cancel') ? 'cancel' : 'disb';
    const row = document.getElementById(kind+'-acc-btn-row');
    if(row && row.style.display !== 'none'){
      row.scrollIntoView({ behavior:'smooth', block:'center' });
      const b = document.getElementById(kind+'-acc-btn');
      if(b){ b.classList.add('pulse'); setTimeout(()=>b.classList.remove('pulse'), 2400); }
    }
  }, 500);
}


// ترتيب القائمة حسب اختيار المستخدم
function applyArchiveSort(list, reqNum){
  const amt = r => Number(r.amount)||0;
  const when = r => new Date(r.created_at || r.signed_at || r.req_date || 0).getTime() || 0;
  if(ARC_SORT==='old')          list.sort((a,b)=> when(a)-when(b) || reqNum(a)-reqNum(b));
  else if(ARC_SORT==='amount')  list.sort((a,b)=> amt(b)-amt(a));
  else if(ARC_SORT==='aging')   list.sort((a,b)=> requestAgeDays(b)-requestAgeDays(a));
  else                          list.sort((a,b)=> (reqNum(b)-reqNum(a)) || ((b.id||0)-(a.id||0)));
  return list;
}
