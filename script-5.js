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
  if(!src){ alert('لا يوجد ملف للعرض'); return; }
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
    alert('تعذّر الوصول إلى الملف من التخزين.');
    return;
  }
  alert('مصدر المرفق غير معرّف.');
}
function getCurrentAttachmentCount(){ return ATTACHED.length; }
async function uploadFileToStorage(file, folder='uploads'){
  if(!sb) throw new Error('Supabase not initialized');
  const name = sanitizeFileName(file.name);
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2,8);
  const filepath = `${folder.replace(/^\/+|\/+$/g,'')}/${timestamp}_${random}_${name}`;
  const { data, error } = await sb.storage.from('request-attachments').upload(filepath, file, { cacheControl:'3600', upsert:false });
  if(error){
    const msg = error.message || error.error_description || error.error || JSON.stringify(error);
    throw new Error(`Storage upload failed: ${msg}`);
  }
  return data?.path || filepath;
}
async function uploadAttachments(files, folder='uploads'){
  const paths = [];
  for(const f of files){ paths.push(await uploadFileToStorage(f, folder)); }
  return paths;
}
async function openAttachment(rowIndex, attIndex){
  const x = (window._arcRows||[])[rowIndex];
  if(!x){ alert('تعذّر فتح الطلب.'); return; }
  let atts = [];
  try{ atts = JSON.parse(x.attachments_data||'[]'); }catch(e){ atts = []; }
  const src = atts[attIndex];
  if(!src){ alert('لا يوجد مرفق.'); return; }
  await openSourceInNewTab(src);
}
async function downloadArchiveAttachment(rowIndex, attIndex){
  const x = (window._arcRows||[])[rowIndex];
  if(!x){ alert('تعذّر فتح الطلب.'); return; }
  let atts = [];
  try{ atts = JSON.parse(x.attachments_data||'[]'); }catch(e){ atts = []; }
  const src = atts[attIndex];
  if(!src){ alert('لا يوجد مرفق.'); return; }
  try{
    const bytes = await getAttachmentBytes(src);
    dl(new Blob([bytes], { type:getAttachmentMime(src) }), getAttachmentLabel(src));
  }catch(e){
    alert('تعذّر تنزيل المرفق.');
    console.error(e);
  }
}
async function printArchiveAttachment(rowIndex, attIndex){
  const x = (window._arcRows||[])[rowIndex];
  if(!x){ alert('تعذّر فتح الطلب.'); return; }
  let atts = [];
  try{ atts = JSON.parse(x.attachments_data||'[]'); }catch(e){ atts = []; }
  const src = atts[attIndex];
  if(!src){ alert('لا يوجد مرفق.'); return; }
  try{
    const bytes = await getAttachmentBytes(src);
    const blob = new Blob([bytes], { type:getAttachmentMime(src) });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if(!w){ alert('المتصفح منع فتح نافذة الطباعة. اسمح بالـ popups وجرب تاني.'); return; }
    w.onload = function(){ try{ w.focus(); w.print(); }catch(e){} };
    setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} }, 900);
  }catch(e){
    alert('تعذّر طباعة المرفق.');
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
    if(!pngBlob) throw new Error('تعذّر تحويل الصورة إلى PNG');
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
  if(!x){ throw new Error('تعذّر فتح الطلب.'); }
  const atts = getArchiveRowAttachments(x);
  if(!atts.length){ throw new Error('لا توجد مرفقات للدمج.'); }
  if(!window.PDFLib || !window.PDFLib.PDFDocument){
    throw new Error('مكتبة دمج ملفات PDF غير متاحة.');
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
      throw new Error('نوع مرفق غير مدعوم للدمج: '+getAttachmentLabel(att));
    }
  }
  return await merged.save();
}
async function downloadArchiveAttachmentsMerged(rowIndex){
  const x = (window._arcRows||[])[rowIndex];
  if(!x){ alert('تعذّر فتح الطلب.'); return; }
  try{
    const bytes = await mergeArchiveAttachmentBytes(rowIndex);
    const reqNo = displayRequestNo(x.req_no) || 'request';
    dl(new Blob([bytes], { type:'application/pdf' }), `مرفقات_${reqNo}.pdf`);
  }catch(e){
    alert('تعذّر دمج المرفقات. تأكد أن المرفقات PDF أو صور مدعومة.');
    console.error(e);
  }
}
async function printArchiveAttachmentsMerged(rowIndex){
  try{
    const bytes = await mergeArchiveAttachmentBytes(rowIndex);
    const blob = new Blob([bytes], { type:'application/pdf' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if(!w){ alert('المتصفح منع فتح نافذة الطباعة. اسمح بالـ popups وجرب تاني.'); return; }
    w.onload = function(){ try{ w.focus(); w.print(); }catch(e){} };
    setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} }, 900);
  }catch(e){
    alert('تعذّر دمج المرفقات للطباعة. تأكد أن المرفقات PDF أو صور مدعومة.');
    console.error(e);
  }
}
async function openAttachmentByRow(rowIndex, field){
  const x = (window._arcRows||[])[rowIndex];
  if(!x){ alert('تعذّر فتح الطلب.'); return; }
  const src = x[field];
  if(!src){ alert('لا يوجد ملف.'); return; }
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
    err.textContent='الإعداد غير مكتمل — لازم تضيف بيانات Supabase الأول (راجع دليل الإعداد).';
    err.style.display='block';
    return;
  }
  const info = USER_MAP[uname];
  if(!info){
    err.textContent='اسم المستخدم أو كلمة المرور غير صحيحة';
    err.style.display='block';
    document.getElementById('login-pass').value=''; document.getElementById('login-pass').focus();
    return;
  }
  const ob = btn ? btn.textContent : '';
  if(btn){ btn.disabled=true; btn.textContent='جاري الدخول...'; }
  try{
    const { data, error } = await sb.auth.signInWithPassword({ email:info.email, password:p });
    if(error || !(data && data.session)){
      err.textContent='اسم المستخدم أو كلمة المرور غير صحيحة';
      err.style.display='block';
      document.getElementById('login-pass').value=''; document.getElementById('login-pass').focus();
    } else {
      CURRENT = { user:uname, ...info };
      err.style.display='none';
      enterApp();
    }
  }catch(e){
    err.textContent='خطأ اتصال بالسيرفر — حاول تاني';
    err.style.display='block';
    console.error(e);
  }
  if(btn){ btn.disabled=false; btn.textContent=ob; }
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
  document.getElementById('tb-name').textContent = CURRENT.name_en || CURRENT.name;
  document.getElementById('tb-role').textContent = CURRENT.dept_en || CURRENT.dept || '';
  // الاسم والقسم بيتعبّوا أوتوماتيك حسب الحساب
  document.getElementById('d-name').value = CURRENT.name;
  document.getElementById('d-dept').value = CURRENT.dept || (CURRENT.role==='accountant'?'قسم الحسابات':'قسم المبيعات');

  const isAcc = CURRENT.role==='accountant';
  const isViewer = CURRENT.role==='viewer';
  // الأرشيف متاح للجميع: المبيعات يشوف طلباته (عرض فقط)، المحاسب يشوف الكل ويتحكّم
  document.getElementById('nav-arc').style.display = '';
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
      label: r.doc_type==='cancel' ? 'طلب إلغاء واسترداد' : 'طلب صرف',
      value: displayRequestNo(r.req_no) || '—',
      ltr:true
    }));
    if(fresh.length > 8) details.push({ label:'و طلبات أخرى', value:'+' + (fresh.length-8) });
    showMessageDialog({
      title:'تم تحويل طلبك ✅',
      subtitle:'Request Transferred',
      message: fresh.length===1
        ? 'تم تحويل المبلغ الخاص بطلبك ورفع إثبات التحويل. يمكنك عرض الإثبات من إدارة الطلبات.'
        : `تم تحويل المبالغ الخاصة بعدد ${fresh.length} من طلباتك ورفع إثبات التحويل. يمكنك عرضها من إدارة الطلبات.`,
      details,
      note:'الطلبات المحوّلة تظهر باللون الأخضر داخل إدارة الطلبات.',
      confirmText:'تم'
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
function showPage(p){
  ['cancel','disb','arc'].forEach(x=>{
    document.getElementById('page-'+x).classList.toggle('on', x===p);
    document.getElementById('nav-'+(x==='arc'?'arc':x)).classList.toggle('on', x===p);
  });
  document.getElementById('nav-cancel').classList.toggle('on', p==='cancel');
  document.getElementById('nav-disb').classList.toggle('on', p==='disb');
  document.getElementById('nav-arc').classList.toggle('on', p==='arc');
  if (p==='arc') loadArchive();
  window.scrollTo(0,0);
}

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
  let a=toAr(whole); if(cents>0)a+=' و'+cents+' درهم'; a+=' ريال قطري فقط لا غير';
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
  document.getElementById('refund-total').textContent = t.toLocaleString('en-US',{minimumFractionDigits:2});
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
  alert(`لقد وصلت للحد الأقصى للمدخلات.\n\nفي نسخة الاختبار الحالية الحد الأعلى هو ${MAX_DISB_TABLE_ROWS} صفاً. الصفوف الزائدة عن ${DISB_MAIN_PRINT_ROWS} ستظهر في ملحق تفاصيل الفواتير عند الطباعة.`);
  return false;
}
function ensureDisbRowsPrintable(){
  const count = getDisbTableRowsCount();
  if(count <= MAX_DISB_TABLE_ROWS) return true;
  alert(`لا يمكن طباعة الطلب بعدد الصفوف الحالي.\n\nالعدد الحالي: ${count}\nالحد الأقصى في نسخة الاختبار: ${MAX_DISB_TABLE_ROWS} صفاً.`);
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
    supplierLabel.textContent = hasAppendix ? 'إجمالي كل الصفوف · All Rows Total' : 'الإجمالي · Total';
  }
  if(clientLabel){
    clientLabel.textContent = hasAppendix ? 'إجمالي كل صفوف مركز التكلفة · All Rows Total' : 'إجمالي مركز التكلفة · Total Cost Center';
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
    <div class="sec-title"><span class="ar">فواتير المورد - التفاصيل الكاملة</span><span class="en">Supplier Invoices - Full Details</span></div>
    <table class="appendix-table">
      <thead><tr><th style="width:10%">#</th><th style="width:36%">المورّد<small>Supplier</small></th><th style="width:32%">رقم الفاتورة<small>Invoice No.</small></th><th style="width:22%">المبلغ ر.ق<small>Amount QAR</small></th></tr></thead>
      <tbody>${rows.map(r=>`
        <tr><td class="num">${r.idx}</td><td>${escapeHtml(r.supplier || '—')}</td><td>${escapeHtml(r.invoice || '—')}</td><td class="num">${escapeHtml(r.amount || '0.00')}</td></tr>
      `).join('')}</tbody>
      <tfoot><tr class="appendix-total"><td colspan="3">الإجمالي · Total</td><td class="num">${escapeHtml(document.getElementById('supplier-total')?.textContent || '0.00')}</td></tr></tfoot>
    </table>`;
}
function renderAppendixClientRows(rows){
  if(!rows.length) return '';
  return `
    <div class="sec-title"><span class="ar">مركز التكلفة - التفاصيل الكاملة</span><span class="en">Cost Center - Full Details</span></div>
    <table class="appendix-table">
      <thead><tr><th style="width:10%">#</th><th style="width:58%"><span dir="rtl">رقم فاتورة العميل</span> - <span dir="ltr">Odoo</span><small>Client Invoice No. - Odoo</small></th><th style="width:32%">النصيب ر.ق<small>Share QAR</small></th></tr></thead>
      <tbody>${rows.map(r=>`
        <tr><td class="num">${r.idx}</td><td>${escapeHtml(r.invoice || '—')}</td><td class="num">${escapeHtml(r.share || '0.00')}</td></tr>
      `).join('')}</tbody>
      <tfoot><tr class="appendix-total"><td colspan="2">إجمالي مركز التكلفة · Total Cost Center</td><td class="num">${escapeHtml(document.getElementById('client-total')?.textContent || '0.00')}</td></tr></tfoot>
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
      <div><b>ملحق تفاصيل الفواتير</b><small>Invoice Details Appendix</small></div>
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
    <td><input type="text" class="s-name" list="supplier-names" placeholder="اسم المورّد" value="${supplier}"></td>
    <td><input type="text" class="s-inv"  placeholder="رقم الفاتورة" value="${inv}"></td>
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
  document.getElementById('supplier-total').textContent = t.toLocaleString('en-US',{minimumFractionDigits:2});
  if(typeof updateMatch==='function') updateMatch();
}
addSupplierRow(); // start with one row

/* ── فواتير العميل — نصيب كل فاتورة من فاتورة المورّد ── */
function addClientRow(inv='',amt='', skipLimit=false){
  if(!skipLimit && !canAddDisbTableRow()) return;
  const tb=document.getElementById('client-rows');
  const tr=document.createElement('tr');
  tr.innerHTML=`
    <td><input type="text" class="c-inv" placeholder="رقم فاتورة العميل - ‎Odoo" value="${inv}"></td>
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
  document.getElementById('client-total').textContent = t.toLocaleString('en-US',{minimumFractionDigits:2});
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
  const appendixHint = hasAppendix ? '<span class="appendix-hint">التفاصيل الكاملة في الملحق التالي · See appendix</span>' : '';
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
    box.innerHTML='✓ إجمالي مركز التكلفة مطابق لإجمالي فاتورة المورّد <small>('+sup.toLocaleString('en-US',{minimumFractionDigits:2})+' ر.ق)</small>'+appendixHint;
  } else {
    box.className='match-note bad';
    const sign = diff>0 ? 'أكبر' : 'أقل';
    box.innerHTML='✗ الإجمالي لا يساوي إجمالي فاتورة المورّد — '+sign+' بمقدار <small>'+Math.abs(diff).toLocaleString('en-US',{minimumFractionDigits:2})+' ر.ق</small>'+appendixHint;
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
  return '(محفوظ)';
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
        <button class="att-btn" onclick="previewAttachment(${i})">معاينة</button>
        <button class="att-btn" onclick="downloadAttachment(${i})">تنزيل</button>
        <button class="rm" onclick="removeFile(${i})">✕</button>
      </div>
    </div>`).join('');
}
function removeFile(i){ ATTACHED.splice(i,1); renderAttach(); }
async function previewAttachment(i){
  const attachment = ATTACHED[i];
  if(!attachment){ alert('لا يوجد مرفق.'); return; }
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
  if(!attachment){ alert('لا يوجد مرفق.'); return; }
  try{
    const bytes = await getAttachmentBytes(attachment);
    const name = getAttachmentLabel(attachment) || `attachment_${i+1}.pdf`;
    dl(new Blob([bytes], { type:getAttachmentMime(attachment) }), name);
  }catch(e){
    alert('تعذّر تنزيل المرفق.');
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
  if(!x) return true;
  if(x.cancelled) return false;
  if(CURRENT && CURRENT.role === 'accountant') return true;
  return isOwnRequest(x) && !isApprovedRequest(x);
}
function setDocumentLocked(kind, locked){
  const doc = document.getElementById(kind === 'cancel' ? 'doc-cancel' : 'doc-disb');
  if(doc){
    doc.dataset.locked = locked ? '1' : '0';
    doc.querySelectorAll('input, textarea, select, button').forEach(el=>{
      if(el.classList.contains('no-lock')) return;
      el.disabled = !!locked;
    });
    doc.querySelectorAll('.attach-zone').forEach(el=>{
      el.style.pointerEvents = locked ? 'none' : '';
      el.style.opacity = locked ? '.55' : '';
    });
  }
  const saveBtn = document.getElementById(kind + '-save-btn');
  if(saveBtn) saveBtn.disabled = !!locked;
  const signBtn = document.getElementById(kind + '-sign-btn');
  if(signBtn) signBtn.disabled = !!locked;
  if(kind === 'disb' && typeof updateCostCenterDisabledUI === 'function') updateCostCenterDisabledUI();
}
function applyArchiveEditLock(kind, request){
  const locked = VIEW_ONLY || !!(request && !canCurrentEditRequest(request));
  setDocumentLocked(kind, locked);
  if(VIEW_ONLY){
    const status = document.getElementById(kind + '-pdf-status');
    if(status) status.textContent = 'أنت تعرض الطلب للقراءة فقط — اختر «تعديل الطلب» من الأرشيف للتعديل عليه.';
    return;
  }
  if(locked && CURRENT && CURRENT.role !== 'accountant'){
    if(kind === 'disb'){
      const status = document.getElementById('disb-pdf-status');
      if(status) status.textContent = 'هذا الطلب معتمد من الحسابات، متاح للطباعة فقط ولا يمكن تعديله.';
    }
  }
}

// أول حرفين من الاسم (مونوغرام التوقيع)
// خريطة الاسم (عربي أو إنجليزي) → الحروف الأولى بالإنجليزي (للإمضاء بخط اليد)
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
    .filter(Boolean).map(c=>c.toUpperCase()).join('.');
}
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

function signDoc(kind){
  if(!CURRENT) return;
  if(CURRENT.role==='viewer'){
    showMessageDialog({ title:'صلاحية العرض فقط', message:'حسابك مخصّص للعرض والطباعة فقط، ولا يمكنك التوقيع على الطلبات.', confirmText:'حسنًا' });
    return;
  }
  const now=new Date();
  const dt = stampDate(now);
  SIGNED[kind] = { name:CURRENT.name, user:CURRENT.user, time:now.toISOString(), label:dt };
  document.getElementById(kind+'-sig-ph').style.display='none';
  document.getElementById(kind+'-sig-stamp').classList.add('on');
  document.getElementById(kind+'-sig-mono').textContent = initials(CURRENT.name);
  document.getElementById(kind+'-sig-name').textContent = CURRENT.name;
  document.getElementById(kind+'-sig-meta').textContent = dt;
  showMessageDialog({
    title:'تم التوقيع الإلكتروني',
    message:'تم تسجيل توقيعك الإلكتروني على الطلب بنجاح.',
    details:[
      { label:'الموقّع', value:CURRENT.name },
      { label:'وقت التوقيع', value:dt, ltr:true }
    ],
    note:'يمكنك الآن تقديم الطلب أو طباعته حسب الإجراء المطلوب.',
    confirmText:'حسنًا'
  });
}
function signCancelDoc(){ return signDoc('cancel'); }
function signDisbDoc(){ return signDoc('disb'); }

// اعتماد إدارة الحسابات (للمحاسب فقط) — من النموذج أو من الأرشيف، لطلب الصرف أو الإلغاء
async function signAccountsFor(kind){
  if(!CURRENT || CURRENT.role!=='accountant'){ alert('اعتماد الحسابات متاح للمحاسب فقط.'); return; }
  const pfx = kind === 'cancel' ? 'cancel' : 'disb';
  const now=new Date();
  const dt = stampDate(now);
  setAccSign(pfx, { name:CURRENT.name, time:now.toISOString(), label:dt });
  document.getElementById(pfx+'-acc-ph').style.display='none';
  document.getElementById(pfx+'-acc-stamp').classList.add('on');
  document.getElementById(pfx+'-acc-mono').textContent = initials(CURRENT.name);
  document.getElementById(pfx+'-acc-name').textContent = CURRENT.name;
  document.getElementById(pfx+'-acc-meta').textContent = dt;
  if(EDIT_ID && SB_ON){
    const btn=document.getElementById(pfx+'-acc-btn'); const o=btn?btn.textContent:'';
    if(btn){ btn.disabled=true; btn.textContent='جاري الاعتماد...'; }
    try{
      const { error } = await sb.from('requests').update({
        accounts_signed_by: CURRENT.name, accounts_signed_at: now.toISOString()
      }).eq('id', EDIT_ID);
      if(error){ console.error(error); alert('تعذّر حفظ الاعتماد — اتأكد إن سياسة التعديل (update) متفعّلة في Supabase (راجع كود SQL في التعليمات).'); }
      else {
        if(EDIT_REQUEST){
          EDIT_REQUEST = { ...EDIT_REQUEST, accounts_signed_by: CURRENT.name, accounts_signed_at: now.toISOString() };
        }
        showMessageDialog({
          title:'تم اعتماد الطلب',
          message:'تم اعتماد الطلب من إدارة الحسابات وحفظه في الأرشيف.',
          details:[
            { label:'رقم الطلب', value: displayRequestNo(EDIT_REQUEST?.req_no) || '—', ltr:true },
            { label:'معتمد بواسطة', value: CURRENT.name },
            { label:'وقت الاعتماد', value: dt, ltr:true }
          ],
          note:'الطلب الآن متاح للطباعة.',
          confirmText:'حسنًا'
        });
      }
    }catch(e){ alert('خطأ اتصال بـ Supabase.'); console.error(e); }
    if(btn){ btn.disabled=false; btn.textContent=o; }
  }
}
async function signCancelAccounts(){ return signAccountsFor('cancel'); }
async function signDisbAccounts(){ return signAccountsFor('disb'); }

/* ══════════════════════════════════════════
   REQUEST PDF (attachments stay separate)
══════════════════════════════════════════ */
async function generateRequestPDF(docId='doc-disb'){
  commitValuesForPrint();
  await document.fonts.ready;
  const el=document.getElementById(docId);
  const hidden = [...el.querySelectorAll('.attach-zone, .attach-list, #attach-list, .attach-item, #disb-attach-sec, .add-row-btn')];
  const originalDisplay = hidden.map(node=>[node, node.style.display]);
  const originalStyles = {
    width: el.style.width,
    maxWidth: el.style.maxWidth,
    margin: el.style.margin,
    boxShadow: el.style.boxShadow,
    borderRadius: el.style.borderRadius,
    transform: el.style.transform,
  };
  hidden.forEach(node=>node.style.display='none');
  el.style.width = '210mm';
  el.style.maxWidth = '210mm';
  el.style.margin = '0 auto';
  el.style.boxShadow = 'none';
  el.style.borderRadius = '0';
  el.style.transform = 'none';
  const captureScale = 3;
  let canvas;
  try{
    await new Promise(requestAnimationFrame);
    canvas = await html2canvas(el,{scale:captureScale,backgroundColor:'#ffffff',useCORS:true,
      scrollX:0,
      scrollY:0,
      windowWidth:el.scrollWidth,
      windowHeight:el.scrollHeight,
      ignoreElements:(n)=>n.classList&&n.classList.contains('no-print')});
  }finally{
    originalDisplay.forEach(([node, value])=>{ node.style.display = value; });
    el.style.width = originalStyles.width;
    el.style.maxWidth = originalStyles.maxWidth;
    el.style.margin = originalStyles.margin;
    el.style.boxShadow = originalStyles.boxShadow;
    el.style.borderRadius = originalStyles.borderRadius;
    el.style.transform = originalStyles.transform;
  }
  const img = canvas.toDataURL('image/png');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p','mm','a4');
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const PX_TO_MM = 0.2645833333;
  const canvasWidthMm = canvas.width * PX_TO_MM;
  const canvasHeightMm = canvas.height * PX_TO_MM;
  const pdfScale = canvasWidthMm > 0 ? Math.min(1, pw / canvasWidthMm) : 1;
  const imgW = canvasWidthMm * pdfScale;
  const imgH = canvasHeightMm * pdfScale;
  const offsetX = Math.max(0, (pw - imgW) / 2);
  const totalPages = Math.ceil(imgH / ph);
  for(let pageIndex = 0; pageIndex < totalPages; pageIndex++){
    if(pageIndex > 0) pdf.addPage();
    pdf.addImage(img, 'PNG', offsetX, -ph * pageIndex, imgW, imgH);
  }
  return pdf.output('arraybuffer');
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
      if(!res.ok) throw new Error('فشل جلب Blob URL');
      return await res.arrayBuffer();
    }
    if(isHttpUrl(attachment)){
      const res = await fetch(attachment);
      if(!res.ok) throw new Error('فشل جلب رابط المرفق');
      return await res.arrayBuffer();
    }
    if(isStoragePath(attachment)){
      const url = await resolveStorageUrl(attachment);
      if(!url) throw new Error('فشل تحويل مسار التخزين إلى رابط');
      const res = await fetch(url);
      if(!res.ok) throw new Error('فشل جلب ملف التخزين');
      return await res.arrayBuffer();
    }
  }
  if(attachment && typeof attachment.arrayBuffer==='function'){
    return await attachment.arrayBuffer();
  }
  throw new Error('نوع المرفق غير مدعوم');
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
    desc: tr.querySelector('td')?.textContent||'',
    amount: parseAmt(tr.querySelector('.r-amt')?.value||0),
  })).filter(r=>r.amount);
  return {
    doc_type:'cancel',
    req_no: document.getElementById('c-reqno').value,
    req_date: document.getElementById('c-date').value||null,
    customer_no: document.getElementById('c-custno')?.value||null,
    mobile: document.getElementById('c-mobile').value||null,
    invoice_ref: document.getElementById('c-invref').value||null,
    name: document.getElementById('c-custname')?.value||null,
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
    name: document.getElementById('d-name').value||null,
    department: document.getElementById('d-dept').value||null,
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
    showMessageDialog({ title:'صلاحية العرض فقط', message:'حسابك مخصّص للعرض والطباعة فقط، ولا يمكنك تقديم أو تعديل الطلبات.', confirmText:'حسنًا' });
    return;
  }
  // لا يمكن التقديم بدون توقيع إلكتروني
  if(!rec.signed_by){
    showMessageDialog({
      title:'التوقيع الإلكتروني مطلوب',
      subtitle:'Signature Required',
      message:'لا يمكن تقديم الطلب قبل التوقيع إلكترونيًا. الرجاء الضغط على زر «توقيع إلكتروني» أولاً، ثم تقديم الطلب.',
      confirmText:'حسنًا'
    });
    return;
  }
  const btn = document.getElementById(kind+'-save-btn');
  if(!SB_ON){
    alert('الحفظ السحابي غير مفعّل — الطلب جاهز للطباعة والتحميل والإرسال على Teams. لتفعيل الأرشيف أضف بيانات Supabase في إعدادات الملف.');
    return;
  }
  if(EDIT_ID && EDIT_REQUEST?.cancelled){
    EDIT_ID = null;
    EDIT_REQUEST = null;
  }
  if(EDIT_ID && !canCurrentEditRequest(EDIT_REQUEST)){
    alert('لا يمكن تعديل هذا الطلب.\n\nتم اعتماد الطلب من إدارة الحسابات أو لا تملك صلاحية تعديله.');
    return;
  }
  btn.disabled=true; const o=btn.textContent; btn.textContent='جاري التقديم...';
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
        title: EDIT_ID ? 'تم تحديث الطلب' : 'تم تقديم الطلب',
        message: EDIT_ID
          ? 'تم تحديث بيانات الطلب بنجاح، والتعديلات متاحة الآن في إدارة الطلبات.'
          : 'تم تقديم الطلب بنجاح، وأصبح متاحاً في إدارة الطلبات.',
        details:[
          { label:'رقم الطلب', value: rec.req_no || '—', ltr:true }
        ],
        confirmText:'حسنًا'
      });
      if(EDIT_ID && EDIT_REQUEST) EDIT_REQUEST = { ...EDIT_REQUEST, ...rec };
      if(!EDIT_ID && data?.id){
        EDIT_ID = data.id;
        EDIT_REQUEST = { ...rec, id:data.id };
      }
    }
    else { console.error(error); 
      let msg = 'تعذّر الحفظ — اتأكد إنك مسجّل دخول وإن جدول requests متظبط في Supabase.';
      if(error.message && error.message.includes('column')){ msg += '\n\nتحتاج تشغّل الـ SQL ده في Supabase > SQL Editor:\nALTER TABLE requests ADD COLUMN IF NOT EXISTS attachments_data TEXT;\nALTER TABLE requests ADD COLUMN IF NOT EXISTS transfer_image TEXT;'; }
      if(error.code === '23505' || /duplicate|unique/i.test(error.message||'')){
        msg += '\n\nفي طلب ملغي قديم بنفس الرقم. اضغط حفظ مرة تانية بعد تحديث الصفحة، ولو استمر الخطأ افتح الطلب الملغي من الأرشيف وألغيه مرة أخرى لتحرير الرقم.';
      }
      alert(msg); 
    }
  }catch(e){ alert('خطأ اتصال بـ Supabase.'); console.error(e); }
  btn.disabled=false; btn.textContent=o;
}

async function saveCancelDoc(){
  return persistRequestRecord('cancel', collectCancel());
}

// الحقول الإلزامية لطلب الصرف — ترجع قائمة بالناقص
function validateDisbRequest(){
  const errs = [];
  // 1) التوقيع الإلكتروني
  if(!SIGNED.disb) errs.push('التوقيع إلكترونيًا');
  // 2) فاتورة مورّد مكتملة (اسم + رقم فاتورة + مبلغ)
  const supRows = [...document.querySelectorAll('#supplier-rows tr')].map(tr=>({
    name: (tr.querySelector('.s-name')?.value||'').trim(),
    inv:  (tr.querySelector('.s-inv')?.value||'').trim(),
    amt:  parseAmt(tr.querySelector('.s-amt')?.value||0),
  }));
  if(!supRows.some(r=> r.name && r.inv && r.amt>0))
    errs.push('إضافة فاتورة مورّد مكتملة (اسم المورّد ورقم الفاتورة والمبلغ)');
  // 3) في حالة عدم تفعيل «فاتورة عامة» → فاتورة عميل + مبلغ
  const generalInvoice = !!document.getElementById('d-cost-disabled')?.checked;
  if(!generalInvoice){
    const cliRows = [...document.querySelectorAll('#client-rows tr')].map(tr=>({
      inv: (tr.querySelector('.c-inv')?.value||'').trim(),
      amt: parseAmt(tr.querySelector('.c-amt')?.value||0),
    }));
    if(!cliRows.some(r=> r.inv && r.amt>0))
      errs.push('إضافة فاتورة العميل ومبلغها (أو تفعيل «فاتورة عامة»)');
  }
  // 4) إجمالي المبلغ المطلوب صرفه
  if(!(parseAmt(document.getElementById('d-amt')?.value||0) > 0))
    errs.push('إدخال إجمالي المبلغ المطلوب صرفه');
  return errs;
}

async function saveDisbDoc(){
  const errs = validateDisbRequest();
  if(errs.length){
    showMessageDialog({
      title:'حقول إلزامية ناقصة',
      subtitle:'Required Fields',
      message:'لا يمكن تقديم الطلب قبل استكمال التالي:\n\n'
        + errs.map((e,i)=>`${i+1}- يجب ${e}`).join('\n'),
      confirmText:'حسنًا'
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
      alert(`تعذّر رفع المرفقات.\n\nسبب الخطأ:\n${e.message || e}\n\nغالباً تحتاج تتأكد أن bucket باسم request-attachments موجود في Supabase Storage وأن سياسة الرفع مفعّلة للمستخدمين المسجلين.`);
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
const ARC_COLS = 12;
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
  more:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="19" cy="12" r="1.5"></circle></svg>',
  sign:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>',
  trash:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M6 6l1 16h10l1-16"></path></svg>'
};
function setArcTab(t){
  if(t === 'cancelled' && (!CURRENT || CURRENT.role !== 'accountant')) t = 'all';
  ARC_TAB=t;
  ['all','cancel','disb','cancelled'].forEach(x=>{
    const tab = document.getElementById('atab-'+x);
    if(tab) tab.classList.toggle('on',x===t);
  });
  loadArchive();
}
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
function showConfirmDialog({ title, message, details=[], note='', confirmText='تأكيد', cancelText='رجوع', danger=false, showCancel=true, subtitle }){
  return new Promise(resolve=>{
    const old = document.getElementById('app-confirm-overlay');
    if(old) old.remove();
    const overlay = document.createElement('div');
    overlay.id = 'app-confirm-overlay';
    overlay.dir = 'rtl';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,19,33,.55);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';
    const accent = danger ? '#E0526B' : '#2C8B8E';
    const accentSoft = danger ? 'rgba(224,82,107,.28)' : 'rgba(44,139,142,.28)';
    const caption = subtitle !== undefined ? subtitle : (showCancel ? 'Confirmation' : 'Notification');
    const detailsHtml = details.length ? `<div class="acd-details">${details.map((d, idx)=>`
      <div class="acd-row"${idx === details.length - 1 ? '' : ' data-sep="1"'}>
        <span class="acd-row-label">${escapeHtml(d.label)}</span>
        <b class="acd-row-value" style="direction:${d.ltr?'ltr':'rtl'};">${escapeHtml(d.value || '—')}</b>
      </div>`).join('')}</div>` : '';
    overlay.innerHTML = `
      <style>
        @keyframes acdFade{from{opacity:0}to{opacity:1}}
        @keyframes acdPop{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}
        #app-confirm-overlay{animation:acdFade .18s ease both;}
        #app-confirm-overlay .acd-card{width:min(460px,100%);background:#fff;border-radius:20px;box-shadow:0 1px 1px rgba(20,24,46,.04),0 18px 48px -12px rgba(20,24,46,.32),0 40px 80px -24px rgba(20,24,46,.22);overflow:hidden;font-family:'Cairo','Montserrat',sans-serif;animation:acdPop .26s cubic-bezier(.2,.8,.25,1) both;}
        #app-confirm-overlay .acd-head{position:relative;padding:22px 24px 20px;background:linear-gradient(120deg,#2F817C 0%,#326F82 48%,#3E3A72 100%);color:#fff;}
        #app-confirm-overlay .acd-head::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,rgba(255,255,255,.0),rgba(255,255,255,.35),rgba(255,255,255,.0));}
        #app-confirm-overlay .acd-title{font-size:18px;font-weight:800;line-height:1.45;}
        #app-confirm-overlay .acd-cap{font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;opacity:.72;margin-top:3px;}
        #app-confirm-overlay .acd-body{padding:20px 24px 6px;}
        #app-confirm-overlay .acd-msg{font-size:14.5px;font-weight:600;color:#1B2233;line-height:1.9;white-space:pre-line;}
        #app-confirm-overlay .acd-details{margin-top:16px;border:1px solid #E8EEF5;border-radius:14px;background:#F7FAFD;overflow:hidden;}
        #app-confirm-overlay .acd-row{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:11px 14px;}
        #app-confirm-overlay .acd-row[data-sep]{border-bottom:1px solid #EAF0F6;}
        #app-confirm-overlay .acd-row-label{font-size:11.5px;font-weight:700;color:#64748B;}
        #app-confirm-overlay .acd-row-value{font-size:13px;font-weight:800;color:#3E3A72;}
        #app-confirm-overlay .acd-note{margin-top:14px;color:#64748B;font-size:12px;line-height:1.75;}
        #app-confirm-overlay .acd-foot{display:flex;gap:10px;justify-content:flex-start;padding:18px 24px 22px;}
        #app-confirm-overlay .acd-btn{border:none;border-radius:12px;padding:11px 24px;font-family:'Cairo',sans-serif;font-size:13.5px;font-weight:800;cursor:pointer;transition:transform .12s ease,box-shadow .15s ease,background .15s ease;}
        #app-confirm-overlay .acd-btn:active{transform:translateY(1px);}
        #app-confirm-overlay .acd-btn:focus-visible{outline:2px solid ${accent};outline-offset:2px;}
        #app-confirm-overlay .acd-confirm{background:${accent};color:#fff;box-shadow:0 10px 22px -6px ${accentSoft};}
        #app-confirm-overlay .acd-confirm:hover{filter:brightness(1.05);box-shadow:0 14px 28px -8px ${accentSoft};}
        #app-confirm-overlay .acd-cancel{background:#fff;border:1.5px solid #DCE4EE;color:#3E3A72;}
        #app-confirm-overlay .acd-cancel:hover{background:#F4F7FB;border-color:#C7D3E1;}
      </style>
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
function showMessageDialog({ title, message, details=[], note='', confirmText='تم', subtitle }){
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
function positionArchivePopover(pop, btn){
  const r = btn.getBoundingClientRect();
  const width = pop.offsetWidth || 240;
  let left = r.right - width;
  left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
  pop.style.left = left + 'px';
  pop.style.top = (r.bottom + 10) + 'px';
}
function showArchiveTimePopover(btn, submittedAt, approvedAt){
  const pop = document.getElementById('arc-time-pop');
  if(!pop) return;
  closeArchiveMenu();
  pop.innerHTML = `
    <div class="pop-title"><span>تفاصيل التوقيت</span><small>Timeline</small></div>
    <div class="arc-time-row"><span>تقديم الطلب</span><b>${submittedAt || '—'}</b></div>
    <div class="arc-time-row"><span>اعتماد الحسابات</span><b>${approvedAt || 'لم يعتمد بعد'}</b></div>
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
  all:   { label:'الجميع',      hint:'يظهر لكل المستخدمين' },
  mgmt:  { label:'الإدارة فقط', hint:'المحاسب وفريق الإدارة فقط' },
  staff: { label:'الموظفين',    hint:'المحاسب والمبيعات فقط' },
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
function canModifyComment(row, c){
  if(!CURRENT || !row || !c) return false;
  if(row.accounts_signed_by || row.cancelled) return false;
  return c.user === CURRENT.user;
}
function commentRoleLabel(role){
  return role === 'accountant' ? 'المحاسبة'
    : role === 'viewer' ? 'الإدارة'
    : role === 'sales' ? 'المبيعات' : '';
}
function commentVisBadge(v){
  const m = COMMENT_VIS[v] || COMMENT_VIS.all;
  return `<span class="cmt-vis-badge cmt-${v||'all'}">${escapeHtml(m.label)}</span>`;
}
async function persistComments(row, comments){
  if(!SB_ON){ alert('الأرشيف غير مفعّل.'); return false; }
  const json = JSON.stringify(comments);
  const { error } = await sb.from('requests').update({ comments_data: json }).eq('id', row.id);
  if(error){
    console.error(error);
    alert('تعذّر حفظ التعليق — تأكد من إضافة عمود comments_data وتفعيل سياسة التعديل في Supabase.\n\nSQL:\nALTER TABLE requests ADD COLUMN IF NOT EXISTS comments_data TEXT;');
    return false;
  }
  row.comments_data = json;
  if(EDIT_ID === row.id && EDIT_REQUEST) EDIT_REQUEST = { ...EDIT_REQUEST, comments_data: json };
  return true;
}
function openCommentsDialog(i){
  const x = (window._arcRows||[])[i];
  if(!x){ alert('تعذّر فتح الطلب.'); return; }
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
          <div class="cmt-item-hd"><div class="cmt-who"><b>${escapeHtml(c.by||'—')}</b><span class="cmt-role">${escapeHtml(commentRoleLabel(c.role))}</span></div>${commentVisBadge(c.visibility)}</div>
          <textarea id="cmt-edit-input" rows="3" maxlength="500" class="cmt-edit-area">${escapeHtml(c.text||'')}</textarea>
          <div class="cmt-foot"><span class="cmt-time">${escapeHtml(when)}</span>
            <span class="cmt-actions">
              <button class="cmt-link save" onclick="saveEditComment(${i}, '${escAttr(c.id)}')">حفظ</button>
              <button class="cmt-link" onclick="cancelEditComment(${i})">إلغاء</button>
            </span>
          </div>
        </div>`;
    }
    const canMod = canModifyComment(x, c);
    return `
      <div class="cmt-item">
        <div class="cmt-item-hd"><div class="cmt-who"><b>${escapeHtml(c.by||'—')}</b><span class="cmt-role">${escapeHtml(commentRoleLabel(c.role))}</span></div>${commentVisBadge(c.visibility)}</div>
        <div class="cmt-text">${escapeHtml(c.text||'')}</div>
        <div class="cmt-foot"><span class="cmt-time">${escapeHtml(when)}</span>
          ${canMod ? `<span class="cmt-actions">
            <button class="cmt-link" onclick="startEditComment(${i}, '${escAttr(c.id)}')">تعديل</button>
            <button class="cmt-link danger" onclick="deleteComment(${i}, '${escAttr(c.id)}')">حذف</button>
          </span>` : ''}
        </div>
      </div>`;
  }).join('') : `<div class="cmt-empty">لا توجد تعليقات${canAdd ? ' بعد — أضف أول تعليق بالأسفل.' : '.'}</div>`;

  const addHtml = canAdd ? `
    <div class="cmt-add">
      <textarea id="cmt-input" rows="3" maxlength="500" placeholder="اكتب تعليقك هنا ..."></textarea>
      <div class="cmt-vis-row">
        <span class="cmt-vis-lbl">يظهر لـ</span>
        ${Object.entries(COMMENT_VIS).map(([k,m],idx)=>`<label class="cmt-vis-opt" title="${escAttr(m.hint)}"><input type="radio" name="cmt-vis" value="${k}"${idx===0?' checked':''}><span>${escapeHtml(m.label)}</span></label>`).join('')}
      </div>
      <button class="cmt-submit" onclick="addComment(${i})">إضافة تعليق</button>
    </div>` : `<div class="cmt-locked">${x.cancelled ? 'هذا الطلب ملغى' : 'هذا الطلب معتمد'} — التعليقات متاحة للقراءة فقط.</div>`;

  const overlay = document.createElement('div');
  overlay.id = 'app-comments-overlay';
  overlay.dir = 'rtl';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(15,19,33,.55);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';
  overlay.innerHTML = `
    <style>
      @keyframes cmtFade{from{opacity:0}to{opacity:1}}
      @keyframes cmtPop{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}
      #app-comments-overlay{animation:cmtFade .18s ease both;font-family:'Cairo','Montserrat',sans-serif;}
      #app-comments-overlay .cmt-card{width:min(520px,100%);max-height:88vh;display:flex;flex-direction:column;background:#fff;border-radius:20px;box-shadow:0 1px 1px rgba(20,24,46,.04),0 18px 48px -12px rgba(20,24,46,.32),0 40px 80px -24px rgba(20,24,46,.22);overflow:hidden;animation:cmtPop .26s cubic-bezier(.2,.8,.25,1) both;}
      #app-comments-overlay .cmt-head{position:relative;padding:20px 24px 18px;background:linear-gradient(120deg,#2F817C 0%,#326F82 48%,#3E3A72 100%);color:#fff;display:flex;justify-content:space-between;align-items:center;gap:12px;}
      #app-comments-overlay .cmt-head::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.35),rgba(255,255,255,0));}
      #app-comments-overlay .cmt-htitle{font-size:17px;font-weight:800;}
      #app-comments-overlay .cmt-hcap{font-family:'Montserrat',sans-serif;font-size:10px;font-weight:700;letter-spacing:1.4px;opacity:.72;margin-top:2px;direction:ltr;}
      #app-comments-overlay .cmt-x{background:rgba(255,255,255,.16);border:none;color:#fff;width:32px;height:32px;border-radius:10px;font-size:18px;cursor:pointer;line-height:1;transition:background .15s ease;}
      #app-comments-overlay .cmt-x:hover{background:rgba(255,255,255,.28);}
      #app-comments-overlay .cmt-body{padding:16px 20px;overflow-y:auto;display:flex;flex-direction:column;gap:12px;background:#F7FAFD;}
      #app-comments-overlay .cmt-empty{text-align:center;color:#64748B;font-size:13px;font-weight:600;padding:22px 8px;}
      #app-comments-overlay .cmt-item{background:#fff;border:1px solid #E8EEF5;border-radius:14px;padding:12px 14px;}
      #app-comments-overlay .cmt-item.editing{border-color:#2C8B8E;box-shadow:0 0 0 3px rgba(44,139,142,.12);}
      #app-comments-overlay .cmt-item-hd{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:7px;}
      #app-comments-overlay .cmt-who b{font-size:13px;font-weight:800;color:#3E3A72;}
      #app-comments-overlay .cmt-role{font-size:11px;color:#64748B;margin-right:6px;}
      #app-comments-overlay .cmt-vis-badge{font-size:10.5px;font-weight:800;padding:3px 9px;border-radius:999px;white-space:nowrap;}
      #app-comments-overlay .cmt-all{background:#EAF3FF;color:#2563EB;}
      #app-comments-overlay .cmt-mgmt{background:#F3EEFF;color:#6B46C1;}
      #app-comments-overlay .cmt-staff{background:#E7F7F0;color:#1E9E78;}
      #app-comments-overlay .cmt-text{font-size:13.5px;font-weight:600;color:#1B2233;line-height:1.85;white-space:pre-wrap;word-break:break-word;}
      #app-comments-overlay .cmt-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:8px;}
      #app-comments-overlay .cmt-time{font-size:11px;color:#94A3B8;direction:ltr;}
      #app-comments-overlay .cmt-actions{display:flex;gap:6px;}
      #app-comments-overlay .cmt-link{background:none;border:none;font-family:'Cairo',sans-serif;font-size:12px;font-weight:800;color:#2C8B8E;cursor:pointer;padding:3px 7px;border-radius:8px;}
      #app-comments-overlay .cmt-link:hover{background:#EAF3F3;}
      #app-comments-overlay .cmt-link.danger{color:#E0526B;}
      #app-comments-overlay .cmt-link.danger:hover{background:#FCEBEF;}
      #app-comments-overlay textarea{width:100%;box-sizing:border-box;border:1.5px solid #DCE4EE;border-radius:12px;padding:10px 12px;font-family:'Cairo',sans-serif;font-size:13.5px;resize:vertical;outline:none;background:#fff;}
      #app-comments-overlay textarea:focus{border-color:#2C8B8E;box-shadow:0 0 0 3px rgba(44,139,142,.12);}
      #app-comments-overlay .cmt-add{border-top:1px solid #E8EEF5;padding:14px 20px 18px;background:#fff;display:flex;flex-direction:column;gap:10px;}
      #app-comments-overlay .cmt-vis-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;}
      #app-comments-overlay .cmt-vis-lbl{font-size:12px;font-weight:800;color:#64748B;}
      #app-comments-overlay .cmt-vis-opt{display:flex;align-items:center;gap:5px;font-size:12.5px;font-weight:700;color:#3E3A72;background:#F4F7FB;border:1.5px solid #E2E9F2;border-radius:10px;padding:6px 11px;cursor:pointer;}
      #app-comments-overlay .cmt-vis-opt:has(input:checked){border-color:#2C8B8E;background:#EAF6F5;color:#1F6F6B;}
      #app-comments-overlay .cmt-vis-opt input{accent-color:#2C8B8E;}
      #app-comments-overlay .cmt-submit{align-self:flex-start;background:#2C8B8E;color:#fff;border:none;border-radius:12px;padding:10px 22px;font-family:'Cairo',sans-serif;font-size:13.5px;font-weight:800;cursor:pointer;box-shadow:0 10px 22px -6px rgba(44,139,142,.28);transition:filter .15s ease;}
      #app-comments-overlay .cmt-submit:hover{filter:brightness(1.06);}
      #app-comments-overlay .cmt-locked{border-top:1px solid #E8EEF5;padding:16px 20px;background:#fff;color:#64748B;font-size:12.5px;font-weight:700;text-align:center;}
    </style>
    <div class="cmt-card" role="dialog" aria-modal="true">
      <div class="cmt-head">
        <div><div class="cmt-htitle">تعليقات الطلب</div><div class="cmt-hcap">${escAttr(reqNo)} · COMMENTS</div></div>
        <button class="cmt-x" onclick="closeCommentsOverlay()" aria-label="إغلاق">✕</button>
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
  if(!canAddComment(x)){ alert('لا يمكن إضافة تعليق على هذا الطلب.'); return; }
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
  if(!text){ alert('لا يمكن ترك التعليق فارغاً.'); return; }
  const comments = await fetchLatestComments(x);
  const c = comments.find(k=>k.id===id);
  if(!c){ alert('التعليق لم يعد موجوداً (ربما حُذف).'); COMMENT_EDIT=null; renderCommentsOverlay(i); return; }
  if(!canModifyComment(x, c)){ alert('لا يمكن تعديل هذا التعليق.'); COMMENT_EDIT=null; renderCommentsOverlay(i); return; }
  c.text = text;
  c.edited_at = new Date().toISOString();
  if(await persistComments(x, comments)){ COMMENT_EDIT = null; renderCommentsOverlay(i); loadArchive(); }
}
async function deleteComment(i, id){
  const x=(window._arcRows||[])[i]; if(!x) return;
  const localC = getRequestComments(x).find(k=>k.id===id);
  if(!localC || !canModifyComment(x, localC)){ alert('لا يمكنك حذف هذا التعليق.'); return; }
  const ok = await showConfirmDialog({
    title:'حذف التعليق',
    message:'هل تريد حذف هذا التعليق نهائياً؟',
    confirmText:'حذف',
    cancelText:'تراجع',
    danger:true
  });
  if(!ok){ renderCommentsOverlay(i); return; }
  const comments = await fetchLatestComments(x);
  const c = comments.find(k=>k.id===id);
  if(!c){ COMMENT_EDIT=null; renderCommentsOverlay(i); return; }   // اتحذف بالفعل
  if(!canModifyComment(x, c)){ alert('لا يمكنك حذف هذا التعليق.'); renderCommentsOverlay(i); return; }
  const next = comments.filter(k=>k.id!==id);
  if(await persistComments(x, next)){ COMMENT_EDIT = null; renderCommentsOverlay(i); loadArchive(); }
}

function showArchiveAttachmentsMenu(btn, rowIndex){
  const row = (window._arcRows||[])[rowIndex];
  const atts = getArchiveRowAttachments(row);
  if(!atts.length) return;
  const mergedActions = `
    ${archiveMenuButton('تنزيل الكل PDF', ARC_ICONS.download, `downloadArchiveAttachmentsMerged(${rowIndex})`)}
    ${archiveMenuButton('طباعة الكل PDF', ARC_ICONS.print, `printArchiveAttachmentsMerged(${rowIndex})`)}
    <div class="arc-menu-sep"></div>
  `;
  const html = mergedActions + atts.map((_, ai)=>`
    ${ai>0?'<div class="arc-menu-sep"></div>':''}
    <div class="arc-time-row"><span>مرفق ${ai+1}</span><b>Attachment ${ai+1}</b></div>
    ${archiveMenuButton('معاينة', ARC_ICONS.view, `openAttachment(${rowIndex}, ${ai})`)}
    ${archiveMenuButton('تنزيل', ARC_ICONS.download, `downloadArchiveAttachment(${rowIndex}, ${ai})`)}
    ${archiveMenuButton('طباعة', ARC_ICONS.print, `printArchiveAttachment(${rowIndex}, ${ai})`)}
  `).join('');
  showArchiveMenu(btn, 'المرفقات', `${atts.length} file${atts.length>1?'s':''}`, html);
}
function showArchiveActionsMenu(btn, rowIndex){
  const x = (window._arcRows||[])[rowIndex];
  if(!x) return;
  const isAcc = CURRENT && CURRENT.role==='accountant';
  const canEdit = isAcc || canCurrentEditRequest(x);
  let html = '';
  // عرض الطلب (قراءة فقط) + طباعة الطلب متاحان دائماً
  html += archiveMenuButton('عرض الطلب', ARC_ICONS.view, `viewFromArchive(${rowIndex})`);
  html += archiveMenuButton('طباعة الطلب', ARC_ICONS.print, `reprintFromArchive(${rowIndex})`);
  // تعديل الطلب ثم إلغاء الطلب (لمن يملك صلاحية التعديل فقط)
  if(canEdit){
    html += '<div class="arc-menu-sep"></div>';
    html += archiveMenuButton('تعديل الطلب', ARC_ICONS.sign, `editFromArchive(${rowIndex})`);
    // إلغاء الاعتماد: للمحاسب فقط على الطلبات المعتمدة غير الملغاة — يرجّع الطلب «غير معتمد»
    if(isAcc && x.accounts_signed_by && !x.cancelled){
      html += archiveMenuButton('إلغاء الاعتماد', ARC_ICONS.sign, `revokeApproval(${rowIndex})`, true);
    }
    html += archiveMenuButton('إلغاء الطلب', ARC_ICONS.trash, `cancelRequest(${rowIndex})`, true);
  }
  showArchiveMenu(btn, 'إجراءات الطلب', escAttr(displayRequestNo(x.req_no) || 'Request'), html);
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
    if(document.getElementById('arc-menu-pop')?.classList.contains('on')) return;
    if(document.getElementById('arc-time-pop')?.classList.contains('on')) return;
    loadArchive(true);   // تحديث صامت
  }, 30000);
}
async function loadArchive(silent=false){
  const body=document.getElementById('arc-body');
  const note=document.getElementById('arc-note-slot');
  closeArchiveTimePopover();
  closeArchiveMenu();
  note.innerHTML='';
  const isAcc = CURRENT && CURRENT.role==='accountant';
  // من يرى كل الطلبات (شامل الملغية): المحاسب + حساب العرض فقط
  const canSeeAll = isAcc || (CURRENT && CURRENT.role==='viewer');
  const cancelledTab = document.getElementById('atab-cancelled');
  if(cancelledTab) cancelledTab.style.display = canSeeAll ? '' : 'none';
  if(!canSeeAll && ARC_TAB === 'cancelled') ARC_TAB = 'all';
  ['all','cancel','disb','cancelled'].forEach(x=>{
    const tab = document.getElementById('atab-'+x);
    if(tab) tab.classList.toggle('on',x===ARC_TAB);
  });
  if(!SB_ON){
    note.innerHTML='<div class="arc-note">الأرشيف السحابي غير مفعّل بعد. الطلبات تشتغل وتطبع وتتحمّل عادي.<br>لحفظ الطلبات وعرضها هنا للجميع، أضف رابط ومفتاح Supabase في أعلى كود الملف.</div>';
    body.innerHTML=`<tr><td colspan="${ARC_COLS}" class="arc-empty">— الأرشيف غير مفعّل —</td></tr>`;
    return;
  }
  if(!silent) body.innerHTML=`<tr><td colspan="${ARC_COLS}" class="arc-empty">جاري التحميل...</td></tr>`;
  try{
    let qy = sb.from('requests').select('*').order('id',{ascending:false}).limit(200);
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
    if(search) qy = qy.or(`name.ilike.*${search}*,created_by.ilike.*${search}*,signed_by.ilike.*${search}*,req_no.ilike.*${search}*,beneficiary.ilike.*${search}*,supplier_invoices.ilike.*${search}*`);
    const { data:rows, error } = await qy;
    if(error){ 
      console.error(error); 
      let errMsg = 'خطأ اتصال';
      if(error.message && error.message.includes('column')){
        errMsg = 'خطأ: عمود غير موجود في الجدول. شغّل الـ SQL ده في Supabase:<br><code style="font-size:10px;direction:ltr;display:block;background:#f5f5f5;padding:6px;margin-top:4px">ALTER TABLE requests ADD COLUMN IF NOT EXISTS transfer_image TEXT;<br>ALTER TABLE requests ADD COLUMN IF NOT EXISTS attachments_data TEXT;<br>ALTER TABLE requests ADD COLUMN IF NOT EXISTS cancelled BOOLEAN DEFAULT FALSE;<br>ALTER TABLE requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();</code>';
        note.innerHTML = `<div class="arc-note">${errMsg}</div>`;
      }
      body.innerHTML=`<tr><td colspan="${ARC_COLS}" class="arc-empty">خطأ اتصال</td></tr>`; return; 
    }
    if(!Array.isArray(rows)||rows.length===0){ body.innerHTML=`<tr><td colspan="${ARC_COLS}" class="arc-empty">لا توجد طلبات</td></tr>`; return; }
    // الطلبات الملغية تظهر في تبويب «الملغاة / المسحوبة» فقط؛ باقي التبويبات تستثنيها
    const reqNum = r => extractRequestNoNumber(r.doc_type==='cancel' ? 'cancel' : 'disb', r.req_no);
    const list = (ARC_TAB==='cancelled' ? rows.filter(x=>x.cancelled) : rows.filter(x=>!x.cancelled))
      .slice()
      .sort((a,b)=> (reqNum(b)-reqNum(a)) || ((b.id||0)-(a.id||0)));   // ترتيب حسب الرقم: الأجدد فوق والأقدم تحت
    if(list.length===0){ body.innerHTML=`<tr><td colspan="${ARC_COLS}" class="arc-empty">لا توجد طلبات</td></tr>`; return; }
    window._arcRows = list;
    body.innerHTML=list.map((x,i)=>{
      const type=x.doc_type==='cancel'
        ?'<span class="badge cancel-doc">إلغاء</span>'
        :'<span class="badge disb-doc">صرف</span>';
      // حالة التوقيع (مقدم الطلب فقط)
      let sig = x.signed_by
        ?`<span class="badge signed"><span class="ok-mark">✓</span>${x.signed_by}</span>`
        :'<span class="badge unsigned">غير موقّع</span>';
      if(x.cancelled) sig += ' <span class="badge cancel-doc">ملغى</span>';
      // عمود الاعتماد
      const accTitle = x.accounts_signed_by
        ? `الحالة: معتمد من الحسابات\nبواسطة: ${x.accounts_signed_by}${x.accounts_signed_at ? `\nالتوقيت: ${formatArchiveDateTime(x.accounts_signed_at)}` : ''}`
        : 'الحالة: بانتظار اعتماد الحسابات';
      let accCol = x.accounts_signed_by
        ? `<span class="arc-approval-status approved" title="${escAttr(accTitle)}" aria-label="${escAttr(accTitle)}">${ARC_ICONS.sign}</span>`
        : `<span class="arc-approval-status pending" title="${escAttr(accTitle)}" aria-label="${escAttr(accTitle)}">${ARC_ICONS.sign}<span class="hourglass">${ARC_ICONS.hourglass}</span></span>`;
      if(isAcc && !x.accounts_signed_by && !x.cancelled){
        accCol = `<button class="arc-approval-status pending clickable" onclick="approveFromArchive(${i})" title="${escAttr(accTitle)} - اضغط للاعتماد" aria-label="${escAttr(accTitle)} - اضغط للاعتماد">${ARC_ICONS.sign}<span class="hourglass">${ARC_ICONS.hourglass}</span></button>`;
      } else if(isAcc && x.accounts_signed_by && !x.cancelled){
        // الطلب معتمد: المحاسب يضغط على القلم لإلغاء الاعتماد
        accCol = `<button class="arc-approval-status approved clickable" onclick="revokeApproval(${i})" title="${escAttr(accTitle)} - اضغط لإلغاء الاعتماد" aria-label="${escAttr(accTitle)} - اضغط لإلغاء الاعتماد">${ARC_ICONS.sign}</button>`;
      }
      // عمود إثبات التحويل
      let imgCol = '';
      if(x.transfer_image){
        // الضغط على الأيقونة يفتح قائمة: معاينة / تنزيل / حذف (الحذف للمحاسب)
        imgCol = `<button class="arc-mini icon-only transferred arc-menu-btn" onclick="showTransferProofMenu(this, ${i})" title="إثبات التحويل — تم التحويل" aria-label="إثبات التحويل — تم التحويل">${ARC_ICONS.file}</button>`;
      } else if(isAcc && x.accounts_signed_by && !x.cancelled){
        imgCol = `<button class="arc-mini icon-only" onclick="uploadTransferImage(${i})" title="رفع إثبات التحويل" aria-label="رفع إثبات التحويل">${ARC_ICONS.upload}</button>`;
      } else {
          imgCol = '<span class="arc-empty-mark">—</span>';
      }
      // عمود المرفقات (PDF): ملخص هادئ بدل أزرار كثيرة داخل الصف
      const atts = getArchiveRowAttachments(x);
      const attachCol = atts.length
        ? `<button class="arc-mini arc-file-pill arc-menu-btn" onclick="showArchiveAttachmentsMenu(this, ${i})" title="عرض المرفقات" aria-label="عرض ${atts.length} من المرفقات">${ARC_ICONS.paperclip}<b>${atts.length}</b></button>`
        : '<span class="arc-empty-mark">—</span>';
      // عمود التعليقات: أيقونة فقط (مع عدّاد التعليقات الظاهرة للمستخدم الحالي)
      const visComments = getVisibleComments(x);
      const commentCol = `<button class="arc-mini ${visComments.length?'arc-file-pill':'icon-only'}" onclick="openCommentsDialog(${i})" title="تعليقات الطلب" aria-label="تعليقات الطلب${visComments.length?' ('+visComments.length+')':''}">${ARC_ICONS.comment}${visComments.length?`<b>${visComments.length}</b>`:''}</button>`;
      // الإجراءات
      let act;
      if(!isAcc){
        if(x.accounts_signed_by){
          // الطلب المعتمد للمبيعات: طباعة فقط، بدون تعديل.
          act = `<button class="arc-mini icon-only arc-menu-btn" onclick="showArchiveActionsMenu(this, ${i})" title="إجراءات الطلب" aria-label="إجراءات الطلب">${ARC_ICONS.more}</button>`;
        } else {
          // الطلب غير المعتمد: المبيعات تقدر تفتح وتعدل أو تلغي.
          act = `<button class="arc-mini icon-only arc-menu-btn" onclick="showArchiveActionsMenu(this, ${i})" title="إجراءات الطلب" aria-label="إجراءات الطلب">${ARC_ICONS.more}</button>`;
        }
      } else if(x.cancelled){
        act = '<span style="color:#d9415f;font-size:11px;font-weight:700">ملغى</span>';
      } else {
        act = `<button class="arc-mini icon-only arc-menu-btn" onclick="showArchiveActionsMenu(this, ${i})" title="إجراءات الطلب" aria-label="إجراءات الطلب">${ARC_ICONS.more}</button>`;
      }
      const ref = x.doc_type==='cancel' ? (x.invoice_ref||'—') : (x.beneficiary||'—');
      const submittedAt = formatArchiveDateTime(x.created_at || x.signed_at || x.req_date);
      const approvedAt = x.accounts_signed_at ? formatArchiveDateTime(x.accounts_signed_at) : 'لم يعتمد بعد';
      const timeBtn = `<button class="arc-mini icon-only arc-time-btn" onclick="showArchiveTimePopover(this, '${escAttr(submittedAt)}', '${escAttr(approvedAt)}')" title="عرض توقيت الطلب" aria-label="عرض توقيت الطلب">${ARC_ICONS.clock}</button>`;
      const rowClass = (x.transfer_image && !x.cancelled) ? ' class="arc-transferred"' : '';
      return `<tr${rowClass}${x.cancelled?' style="opacity:.55"':''}>
        <td><b style="color:var(--indigo);font-size:13px">${displayRequestNo(x.req_no)||'—'}</b></td>
        <td>${type}</td>
        <td>${x.req_date||'—'}</td>
        <td class="arc-ref">${ref}</td>
        <td class="arc-amount">${x.amount?Number(x.amount).toLocaleString('en-US',{minimumFractionDigits:2}):'—'}</td>
        <td>${sig}</td>
        <td style="text-align:center">${accCol}</td>
        <td style="text-align:center">${commentCol}</td>
        <td style="text-align:center">${imgCol}</td>
        <td class="arc-files-cell">${attachCol}</td>
        <td><div class="arc-act">${act}</div></td>
        <td class="arc-time-cell">${timeBtn}</td>
      </tr>`;
    }).join('');
  }catch(e){ body.innerHTML=`<tr><td colspan="${ARC_COLS}" class="arc-empty">خطأ اتصال</td></tr>`; }
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
  if(!x){ alert('تعذّر فتح الطلب.'); return; }
  if(CURRENT && CURRENT.role !== 'accountant' && !canCurrentEditRequest(x)){
    showMessageDialog({
      title:'تعذّر التعديل',
      message: x.cancelled
        ? 'هذا الطلب ملغي ولا يمكن تعديله.'
        : 'هذا الطلب معتمد من إدارة الحسابات، متاح للطباعة فقط ولا يمكن تعديله.',
      confirmText:'حسنًا'
    });
    return;
  }
  const ok = await showConfirmDialog({
    title:'تعديل الطلب',
    message:'أنت على وشك فتح الطلب للتعديل عليه. أي تغيير تقوم بحفظه سيستبدل البيانات الحالية للطلب في الأرشيف.',
    details:[
      { label:'رقم الطلب', value: displayRequestNo(x.req_no) || '—', ltr:true }
    ],
    note:'تأكد من صحة التعديلات قبل الحفظ.',
    confirmText:'متابعة التعديل',
    cancelText:'رجوع',
    danger:true
  });
  if(!ok) return;
  VIEW_ONLY = false;
  openFromArchive(i);
}

function openFromArchive(i){
  if(!CURRENT){ return; }
  const x = (window._arcRows||[])[i];
  if(!x){ alert('تعذّر فتح الطلب.'); return; }
  if(!VIEW_ONLY && CURRENT.role !== 'accountant' && !canCurrentEditRequest(x)){
    alert('هذا الطلب معتمد من الحسابات، متاح للطباعة فقط ولا يمكن تعديله.');
    return;
  }
  if(x.doc_type==='cancel'){ loadCancelFromRow(x); showPage('cancel'); }
  else { loadDisbFromRow(x); showPage('disb'); }
}

// إعادة طباعة الطلب من الأرشيف (متاح لموظف المبيعات)
function reprintFromArchive(i){
  VIEW_ONLY = true;
  const x = (window._arcRows||[])[i];
  if(!x){ alert('تعذّر فتح الطلب.'); return; }
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

// رفع إثبات التحويل (المحاسب فقط بعد الاعتماد)
async function uploadTransferImage(i){
  if(!CURRENT || CURRENT.role!=='accountant'){ alert('هذه الخاصية للمحاسب فقط.'); return; }
  const x=(window._arcRows||[])[i]; if(!x) return;
  if(!SB_ON){ alert('الأرشيف غير مفعّل.'); return; }
  // إنشاء input file مخفي
  const inp = document.createElement('input');
  inp.type='file'; inp.accept='image/*,application/pdf';
  inp.onchange=async function(){
    const file=inp.files[0]; if(!file) return;
    if(file.size>2*1024*1024){
      await showMessageDialog({ title:'الملف كبير', message:'حجم إثبات التحويل أكبر من الحد المسموح (2 ميجابايت). الرجاء اختيار ملف أصغر.', confirmText:'حسنًا' });
      return;
    }
    try{
      const path = await uploadFileToStorage(file, 'transfer-images');
      const { error } = await sb.from('requests').update({ transfer_image:path }).eq('id', x.id);
      if(error){ console.error(error);
        alert('تعذّر حفظ الصورة.\n\nشغّل الـ SQL ده في Supabase > SQL Editor:\n\nALTER TABLE requests ADD COLUMN IF NOT EXISTS transfer_image TEXT;\nALTER TABLE requests ADD COLUMN IF NOT EXISTS attachments_data TEXT;');
        return;
      }
      loadArchive();
      await showMessageDialog({
        title:'تم رفع إثبات التحويل ✅',
        subtitle:'Transfer Proof Uploaded',
        message:'تم حفظ إثبات التحويل بنجاح، وأُرسل إشعار لمقدّم الطلب بأن طلبه تم تحويله.',
        confirmText:'تم'
      });
    }catch(e){ await showMessageDialog({ title:'خطأ اتصال', message:'تعذّر رفع إثبات التحويل. تحقّق من الاتصال وحاول مرة أخرى.', confirmText:'حسنًا' }); console.error(e); }
  };
  inp.click();
}

// قائمة إثبات التحويل: معاينة / تنزيل / حذف (الحذف للمحاسب فقط)
function showTransferProofMenu(btn, rowIndex){
  const x = (window._arcRows||[])[rowIndex];
  if(!x || !x.transfer_image) return;
  const isAcc = CURRENT && CURRENT.role==='accountant';
  let html = archiveMenuButton('معاينة', ARC_ICONS.view, `openAttachmentByRow(${rowIndex}, 'transfer_image')`)
    + archiveMenuButton('تنزيل', ARC_ICONS.download, `downloadTransferImage(${rowIndex})`);
  if(isAcc && !x.cancelled){
    html += '<div class="arc-menu-sep"></div>'
      + archiveMenuButton('حذف', ARC_ICONS.trash, `deleteTransferImage(${rowIndex})`, true);
  }
  showArchiveMenu(btn, 'إثبات التحويل', 'Transfer Proof', html);
}

// تنزيل إثبات التحويل
async function downloadTransferImage(rowIndex){
  const x = (window._arcRows||[])[rowIndex];
  if(!x || !x.transfer_image){ return; }
  try{
    const bytes = await getAttachmentBytes(x.transfer_image);
    dl(new Blob([bytes], { type:getAttachmentMime(x.transfer_image) }), getAttachmentLabel(x.transfer_image));
  }catch(e){ console.error(e); await showMessageDialog({ title:'تعذّر التنزيل', message:'حصل خطأ أثناء تنزيل إثبات التحويل.', confirmText:'حسنًا' }); }
}

// حذف إثبات التحويل (المحاسب فقط) — يسمح برفع غيره
async function deleteTransferImage(rowIndex){
  if(!CURRENT || CURRENT.role!=='accountant'){ await showMessageDialog({ title:'غير مسموح', message:'هذه الخاصية للمحاسب فقط.', confirmText:'حسنًا' }); return; }
  const x = (window._arcRows||[])[rowIndex];
  if(!x || !x.transfer_image || !SB_ON) return;
  const ok = await showConfirmDialog({
    title:'حذف إثبات التحويل',
    message:'هل تريد حذف إثبات التحويل الحالي؟ سيمكنك بعدها رفع إثبات جديد.',
    details:[{ label:'رقم الطلب', value: displayRequestNo(x.req_no)||'—', ltr:true }],
    confirmText:'حذف', cancelText:'رجوع', danger:true
  });
  if(!ok) return;
  try{
    const { error } = await sb.from('requests').update({ transfer_image:null, transfer_seen:false }).eq('id', x.id);
    if(error){ console.error(error); await showMessageDialog({ title:'تعذّر الحذف', message:'حصل خطأ أثناء الحذف. حاول مرة أخرى.', confirmText:'حسنًا' }); return; }
    loadArchive();
    await showMessageDialog({ title:'تم الحذف ✅', message:'تم حذف إثبات التحويل. يمكنك الآن رفع إثبات جديد.', confirmText:'تم' });
  }catch(e){ console.error(e); await showMessageDialog({ title:'خطأ اتصال', message:'تعذّر الحذف. تحقّق من الاتصال وحاول مرة أخرى.', confirmText:'حسنًا' }); }
}

// إلغاء طلب — المحاسب يقدر يلغي، والمبيعات تقدر تلغي طلبها قبل اعتماد الحسابات فقط.
async function cancelRequest(i){
  if(!CURRENT){ alert('لازم تسجل دخول أولاً.'); return; }
  const x=(window._arcRows||[])[i]; if(!x) return;
  const isAcc = CURRENT.role === 'accountant';
  const canSalesCancel = isOwnRequest(x) && !isApprovedRequest(x) && !x.cancelled;
  if(!isAcc && !canSalesCancel){
    alert('لا يمكن إلغاء هذا الطلب.\n\nالمبيعات تقدر تلغي الطلب فقط قبل اعتماد الحسابات.');
    return;
  }
  const ok = await showConfirmDialog({
    title:'تأكيد إلغاء الطلب',
    message:'هل تريد إلغاء هذا الطلب؟',
    details:[
      { label:'رقم الطلب', value:displayRequestNo(x.req_no), ltr:true },
      { label:'صاحب الطلب', value:x.name || x.created_by || '—' },
      { label:'نوع الطلب', value:x.doc_type === 'cancel' ? 'طلب إلغاء' : 'طلب صرف' }
    ],
    note:'سيتم الاحتفاظ بالطلب داخل الأرشيف مع علامة ملغى.',
    confirmText:'إلغاء الطلب',
    cancelText:'تراجع',
    danger:true
  });
  if(!ok) return;
  if(!SB_ON){ alert('الأرشيف غير مفعّل.'); return; }
  try{
    const { error } = await sb.from('requests').update({
      cancelled:true,
      req_no: cancelledStorageRequestNo(x)
    }).eq('id', x.id);
    if(error){ console.error(error); alert('تعذّر الإلغاء — تأكد من إضافة عمود cancelled في جدول requests (راجع التعليمات) ومن تفعيل سياسة التعديل.'); return; }
    x.cancelled = true;
    x.req_no = cancelledStorageRequestNo(x);
    if(EDIT_ID === x.id){
      EDIT_ID = null;
      EDIT_REQUEST = null;
      setDocumentLocked(x.doc_type === 'cancel' ? 'cancel' : 'disb', false);
    }
    loadArchive();
    refreshNextRequestNo(x.doc_type === 'cancel' ? 'cancel' : 'disb');
  }catch(e){ alert('خطأ اتصال بـ Supabase.'); console.error(e); }
}

// اعتماد الطلب مباشرةً من الأرشيف — المحاسب فقط — بدون فتح النموذج أو تغيير الصفحة
async function approveFromArchive(i){
  if(!CURRENT || CURRENT.role !== 'accountant'){ alert('اعتماد الحسابات متاح للمحاسب فقط.'); return; }
  const x=(window._arcRows||[])[i]; if(!x) return;
  if(x.accounts_signed_by){ alert('هذا الطلب معتمد بالفعل.'); return; }
  if(x.cancelled){ alert('هذا الطلب ملغى، لا يمكن اعتماده.'); return; }
  const kind = x.doc_type === 'cancel' ? 'cancel' : 'disb';
  const ok = await showConfirmDialog({
    title:'تأكيد اعتماد الطلب',
    message:'هل تريد اعتماد هذا الطلب من إدارة الحسابات الآن؟',
    details:[
      { label:'رقم الطلب', value:displayRequestNo(x.req_no), ltr:true },
      { label:'صاحب الطلب', value:x.name || x.created_by || '—' },
      { label:'نوع الطلب', value:kind === 'cancel' ? 'طلب إلغاء' : 'طلب صرف' }
    ],
    note:'سيظهر اعتمادك على الطلب ويصبح متاحاً للطباعة فقط.',
    confirmText:'اعتماد الطلب',
    cancelText:'تراجع'
  });
  if(!ok) return;
  if(!SB_ON){ alert('الأرشيف غير مفعّل.'); return; }
  const now = new Date();
  try{
    const { error } = await sb.from('requests').update({
      accounts_signed_by: CURRENT.name,
      accounts_signed_at: now.toISOString()
    }).eq('id', x.id);
    if(error){ console.error(error); alert('تعذّر حفظ الاعتماد — تأكد من تفعيل سياسة التعديل (update) في Supabase.'); return; }
    x.accounts_signed_by = CURRENT.name;
    x.accounts_signed_at = now.toISOString();
    if(EDIT_ID === x.id && EDIT_REQUEST){
      EDIT_REQUEST = { ...EDIT_REQUEST, accounts_signed_by: CURRENT.name, accounts_signed_at: now.toISOString() };
    }
    showMessageDialog({
      title:'تم اعتماد الطلب',
      message:'تم اعتماد الطلب من إدارة الحسابات وحفظه في الأرشيف.',
      details:[
        { label:'رقم الطلب', value: displayRequestNo(x.req_no) || '—', ltr:true },
        { label:'معتمد بواسطة', value: CURRENT.name },
        { label:'وقت الاعتماد', value: stampDate(now), ltr:true }
      ],
      note:'الطلب الآن متاح للطباعة.',
      confirmText:'حسنًا'
    });
    loadArchive();
  }catch(e){ alert('خطأ اتصال بـ Supabase.'); console.error(e); }
}

// إلغاء اعتماد الحسابات — المحاسب فقط — يرجّع الطلب «غير معتمد» ويفكّ القفل
async function revokeApproval(i){
  if(!CURRENT || CURRENT.role !== 'accountant'){ alert('إلغاء الاعتماد متاح للمحاسب فقط.'); return; }
  const x=(window._arcRows||[])[i]; if(!x) return;
  if(!x.accounts_signed_by){ alert('هذا الطلب غير معتمد أصلاً.'); return; }
  if(x.cancelled){ alert('هذا الطلب ملغى، لا يمكن تعديل اعتماده.'); return; }
  const ok = await showConfirmDialog({
    title:'تأكيد إلغاء الاعتماد',
    message:'هل تريد إلغاء اعتماد الحسابات لهذا الطلب؟ سيرجع الطلب لحالة «غير معتمد» ويصبح قابلاً للتعديل من جديد.',
    details:[
      { label:'رقم الطلب', value:displayRequestNo(x.req_no), ltr:true },
      { label:'معتمد بواسطة', value:x.accounts_signed_by || '—' },
      { label:'نوع الطلب', value:x.doc_type === 'cancel' ? 'طلب إلغاء' : 'طلب صرف' }
    ],
    note:'يمكن إعادة اعتماد الطلب لاحقاً في أي وقت.',
    confirmText:'إلغاء الاعتماد',
    cancelText:'تراجع',
    danger:true
  });
  if(!ok) return;
  if(!SB_ON){ alert('الأرشيف غير مفعّل.'); return; }
  try{
    const { error } = await sb.from('requests').update({
      accounts_signed_by:null,
      accounts_signed_at:null
    }).eq('id', x.id);
    if(error){ console.error(error); alert('تعذّر إلغاء الاعتماد — تأكد من تفعيل سياسة التعديل (update) في Supabase.'); return; }
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
  }catch(e){ alert('خطأ اتصال بـ Supabase.'); console.error(e); }
}

function loadDisbFromRow(x){
  EDIT_ID = x.id || null;
  EDIT_REQUEST = x;
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.value = v==null?'':v; };
  set('d-reqno', displayRequestNo(x.req_no));
  set('d-date',  x.req_date);
  set('d-name',  x.name);
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
    document.getElementById('disb-sig-name').textContent = x.signed_by;
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
    document.getElementById('disb-acc-name').textContent = x.accounts_signed_by;
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
  set('c-custno', x.customer_no);
  set('c-mobile', x.mobile);
  set('c-invref', x.invoice_ref);
  set('c-custname', x.name);
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
    const tr=[...rows].find(t=>(t.querySelector('td')?.textContent||'').trim()===String(item.desc||'').trim());
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
    document.getElementById('cancel-sig-name').textContent = x.signed_by;
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
    document.getElementById('cancel-acc-name').textContent = x.accounts_signed_by;
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
  refreshNextRequestNo('cancel');
}
function clearDisb(){
  VIEW_ONLY = false;
  setDocumentLocked('disb', false);
  ['d-project','d-amt'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('d-name').value = CURRENT?.name||'';
  document.getElementById('d-dept').value = CURRENT?.dept||'';
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
  refreshNextRequestNo('disb');
}

function getPrintFilename(type, reqNo){
  const fallback = type === 'cancel' ? 'RR' : 'PV';
  const value = reqNo || document.getElementById(type === 'cancel' ? 'c-reqno' : 'd-reqno')?.value || fallback;
  return value ? value.replace(/\s+/g,'_') : fallback;
}
function restoreTitleLater(title){
  setTimeout(()=>{ document.title = title; }, 1000);
}

/* === طباعة طلب الإلغاء: مسار مستقل تماماً عن PDF طلب الصرف === */
async function printCancelDoc(reqNo){
  const origTitle = document.title;
  document.title = getPrintFilename('cancel', reqNo);
  commitValuesForPrint();
  window.print();
  restoreTitleLater(origTitle);
}

/* === طباعة طلب الصرف: وحده يجهّز PDF الطلب والمرفقات المنفصلة === */
async function printDisbDoc(reqNo){
  if(!ensureDisbRowsPrintable()) return;
  const origTitle = document.title;
  document.title = getPrintFilename('disb', reqNo);
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
  restoreTitleLater(origTitle);
}

/* جسر توافق للأرشيف وأي استدعاءات قديمة */
async function printDoc(type, reqNo){
  return type === 'cancel' ? printCancelDoc(reqNo) : printDisbDoc(reqNo);
}

function updateRequestPdfStatus(){
  const note = document.getElementById('disb-pdf-status');
  if(!note) return;
  if(window.LAST_REQUEST_PDF){
    note.textContent = 'نسخة الطلب جاهزة للتنزيل كـ PDF منفصل. المرفقات متاحة من قائمة المرفقات.';
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
  if(document.getElementById('page-disb')?.classList.contains('on')){
    prepareDisbPrintAppendix();
  }
});
window.addEventListener('afterprint', ()=>{
  clearDisbPrintAppendix();
});

/* === تأمين إضافي وقت الطباعة ===
   قبل أي طباعة بنثبّت القيمة اللي المستخدم كتبها جوه الـ value attribute نفسه،
   عشان حتى لو حصل أي إعادة رسم أو نسخ للصفحة، اللي اتكتب يفضل ظاهر في المطبوع.
   ده مع إخفاء الـ placeholder في CSS بيضمن إن الطلب الفاضي يطلع فاضي،
   والطلب المليان يطلع بكل بياناته من غير ما يبان "صفر" أو قيمة وهمية. */
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
