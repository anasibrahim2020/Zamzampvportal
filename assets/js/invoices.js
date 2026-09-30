/* ══════════════════════════════════════════════════════════
   سجل فواتير الموردين
   الموظف بيسجّل الفاتورة أول ما توصله، والإدارة بتشوف المستحق
   قبل موعد التحويل. الربط بطلب الصرف اختياري تمامًا، وجدول
   requests ما بيتغيّرش ولا عمود.
══════════════════════════════════════════════════════════ */

let INV_ROWS     = [];    // كل الفواتير المحمّلة
let INV_REQ_MAP  = {};    // request_id ← صف الطلب المربوط (منه بتتحسب الحالة)
let INV_SUPS     = [];    // أسماء الموردين للاقتراح
let INV_LOADED   = false;
let INV_GROUPED  = false; // تجميع بالمورّد
let INV_FILTER   = { q:'', supplier:'', status:'due', sort:'due' };
let INV_PICKED   = [];    // الفواتير المعلّم عليها في طلب الصرف الحالي

const INV_ICONS = {
  receipt:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14v18l-3-2-3 2-3-2-3 2z"></path><path d="M9 8h6"></path><path d="M9 12h6"></path></svg>',
  check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>',
  excel:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M7 10l5 5 5-5"></path><path d="M12 15V3"></path></svg>',
  clip:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.4 11.6-8.5 8.5a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"></path></svg>'
};

/* ── صلاحيات: نفس منطق الطلبات بالحرف ── */
function invCanWrite(){ return !!CURRENT && CURRENT.role !== 'viewer'; }
function invCanManage(){ return !!CURRENT && CURRENT.role === 'accountant'; }
function invCanEditRow(row){
  if(!invCanWrite() || !row) return false;
  if(invCanManage()) return true;
  return row.created_by === CURRENT.name && !invLinkedRequest(row);
}

/* ── تواريخ ── */
function invIso(d){
  const p = n => String(n).padStart(2,'0');
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
}
function invToday(){ const d=new Date(); d.setHours(0,0,0,0); return d; }
function invEndOfWeek(){            // الخميس القادم — آخر أيام العمل
  const d = invToday();
  d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7));
  return invIso(d);
}
function invEndOfMonth(){
  const d = invToday();
  return invIso(new Date(d.getFullYear(), d.getMonth()+1, 0));
}
function invDaysLeft(due){
  if(!due) return null;
  const d = new Date(due + 'T00:00:00');
  if(Number.isNaN(d.getTime())) return null;
  return Math.round((d - invToday()) / 86400000);
}
function invFmtDate(v){
  if(!v) return '—';
  const d = new Date(v + 'T00:00:00');
  if(Number.isNaN(d.getTime())) return v;
  const p = n => String(n).padStart(2,'0');
  return p(d.getDate())+'-'+p(d.getMonth()+1)+'-'+d.getFullYear();
}
function invDueNote(due){
  const n = invDaysLeft(due);
  if(n === null) return t('بدون موعد');
  if(n < 0)  return t('متأخرة {n} يوم').replace('{n}', Math.abs(n));
  if(n === 0) return t('مستحقة اليوم');
  if(n === 1) return t('باقي يوم');
  return t('باقي {n} يوم').replace('{n}', n);
}

/* العدد بصيغته الصحيحة: مفرد ومثنى وجمع في العربي، ومفرد وجمع في الإنجليزي */
function invCountInv(n){
  if(n === 1) return t('فاتورة واحدة');
  if(n === 2) return t('فاتورتان');
  if(n >= 3 && n <= 10) return t('{n} فواتير').replace('{n}', n);
  return t('{n} فاتورة').replace('{n}', n);
}
function invCountSup(n){
  if(n === 1) return t('مورّد واحد');
  if(n === 2) return t('مورّدان');
  if(n >= 3 && n <= 10) return t('{n} موردين').replace('{n}', n);
  return t('{n} مورّدًا').replace('{n}', n);
}

/* ── مركز التكلفة مخزَّن JSON ── */
function invCostCenters(row){
  try{
    const v = JSON.parse(row?.cost_centers || '[]');
    return Array.isArray(v) ? v.filter(c=>c && (c.inv || c.amt)) : [];
  }catch(e){ return []; }
}
function invCostLabel(row){
  if(row.is_general) return { text:t('فاتورة عامة'), gen:true };
  const cc = invCostCenters(row);
  if(!cc.length) return { text:'—', gen:true };
  const first = cc[0].inv || '—';
  return { text: cc.length > 1 ? first + ' +' + (cc.length-1) : first, gen:false };
}

/* مركز تكلفة واحد = الفاتورة كلها على عميل واحد، فالنصيب هو المبلغ كله.
   بنملاه لوحده بدل ما الموظف يعيد كتابة نفس الرقم — ولو كتبه بإيده ما بنلمسوش. */
function invAutoShare(){
  if(!INV_FORM || INV_FORM.general) return;
  const rows = [...document.querySelectorAll('#iv-cc .qf-cc-row')];
  if(rows.length !== 1) return;
  const inv = rows[0].querySelector('.cc-inv');
  const amt = rows[0].querySelector('.cc-amt');
  if(!inv || !amt) return;
  if(!String(inv.value||'').trim()) return;
  if(parseAmt(amt.value) > 0) return;
  const total = parseAmt(document.getElementById('iv-amt')?.value || 0);
  if(!(total > 0)) return;
  amt.value = formatMoney(total);
  invRenderRemainder();
}
/* نفس القاعدة وقت الربط، للفواتير اللي اتسجّلت قبل كده بنصيب فاضي */
function invCostRowsFor(row){
  const cc = invCostCenters(row);
  if(cc.length === 1 && cc[0].inv && !(Number(cc[0].amt) > 0)){
    return [{ inv: cc[0].inv, amt: Number(row.amount) || 0 }];
  }
  return cc;
}

/* ── الحالة — بتتحسب، مش بتتكتب بإيد حد ── */
function invLinkedRequest(row){
  if(!row || !row.request_id) return null;
  const req = INV_REQ_MAP[row.request_id];
  if(!req || req.cancelled) return null;   // الطلب الملغى بيفكّ الربط تلقائيًا
  return req;
}
function invStatus(row){
  if(!row) return { key:'open', label:'مستحقة', cls:'st-pending' };
  if(row.status === 'excluded') return { key:'excluded', label:'مستبعدة', cls:'st-unsigned' };
  const req = invLinkedRequest(row);
  if(req && req.transfer_image) return { key:'paid',   label:'مسدّدة',      cls:'st-transferred' };
  if(req)                       return { key:'linked', label:'في طلب صرف', cls:'st-approved' };
  const n = invDaysLeft(row.due_date);
  if(n !== null && n < 0)       return { key:'late',   label:'متأخرة',     cls:'st-cancelled' };
  return { key:'open', label:'مستحقة', cls:'st-pending' };
}
// الفاتورة اللي لسه التزام علينا
function invIsOutstanding(row){
  const k = invStatus(row).key;
  return k !== 'paid' && k !== 'excluded';
}
// الفاتورة المتاحة للربط بطلب صرف جديد
function invIsLinkable(row){
  const k = invStatus(row).key;
  return k === 'open' || k === 'late';
}

/* ══════════════════════════════════════════
   التحميل
══════════════════════════════════════════ */
async function loadInvoices(){
  const body = document.getElementById('inv-body');
  const hd   = document.getElementById('inv-actions');
  if(!body || !CURRENT) return;

  if(hd) hd.innerHTML = invCanWrite()
    ? `<button class="hbtn ghost" onclick="invExport()">${INV_ICONS.excel}${t('تصدير')}</button>
       <button class="hbtn primary" onclick="openInvoiceForm()">${ARC_ICONS.plus}${t('تسجيل فاتورة')}</button>`
    : `<button class="hbtn ghost" onclick="invExport()">${INV_ICONS.excel}${t('تصدير')}</button>`;

  const greet = document.getElementById('inv-greet');
  const sub   = document.getElementById('inv-sub');
  if(greet) greet.textContent = t('الفواتير المستحقة');
  if(sub)   sub.textContent   = t('كل فاتورة وصلت ولم تُسدَّد بعد');

  if(!SB_ON){ body.innerHTML = homeEmpty(INV_ICONS.receipt, 'الحفظ السحابي غير مفعّل', '—'); return; }
  body.innerHTML = `<div class="h-loading">${t('جاري التحميل...')}</div>`;

  try{
    let qy = sb.from('supplier_invoices').select('*').order('id', { ascending:false }).limit(2000);
    if(CURRENT.role === 'sales'){
      const names = Object.values(USER_MAP).filter(u=>u.role==='sales').map(u=>u.name);
      qy = qy.in('created_by', names);
    }
    const { data, error } = await qy;
    if(error) throw error;
    INV_ROWS = data || [];

    // الطلبات المربوطة — منها بتتحسب «في طلب صرف» و«مسدّدة»
    const ids = [...new Set(INV_ROWS.map(r=>r.request_id).filter(Boolean))];
    INV_REQ_MAP = {};
    if(ids.length){
      const { data:reqs } = await sb.from('requests')
        .select('id,req_no,transfer_image,cancelled,accounts_signed_by').in('id', ids);
      (reqs||[]).forEach(r=>{ INV_REQ_MAP[r.id] = r; });
    }
    INV_SUPS = [...new Set(INV_ROWS.map(r=>String(r.supplier||'').trim()).filter(Boolean))].sort();
    INV_LOADED = true;
    renderInvoices();
  }catch(e){
    console.error(e);
    body.innerHTML = homeEmpty(INV_ICONS.receipt, 'تعذّر تحميل سجل الفواتير', 'شغّل ملف schema-invoices.sql في Supabase');
  }
}

/* ══════════════════════════════════════════
   العرض
══════════════════════════════════════════ */
function invFiltered(){
  const q = INV_FILTER.q.trim().toLowerCase();
  let list = INV_ROWS.filter(r=>{
    const st = invStatus(r).key;
    if(INV_FILTER.status === 'due'      && !invIsOutstanding(r)) return false;
    if(INV_FILTER.status === 'late'     && st !== 'late')        return false;
    if(INV_FILTER.status === 'linked'   && st !== 'linked')      return false;
    if(INV_FILTER.status === 'paid'     && st !== 'paid')        return false;
    if(INV_FILTER.status === 'excluded' && st !== 'excluded')    return false;
    if(INV_FILTER.supplier && String(r.supplier||'') !== INV_FILTER.supplier) return false;
    if(q){
      const hay = [r.supplier, r.inv_no, r.descr, r.req_no,
                   invCostCenters(r).map(c=>c.inv).join(' ')].join(' ').toLowerCase();
      if(hay.indexOf(q) < 0) return false;
    }
    return true;
  });
  const amt = r => Number(r.amount)||0;
  const due = r => r.due_date ? new Date(r.due_date+'T00:00:00').getTime() : 8.64e15;
  if(INV_FILTER.sort === 'amount')    list.sort((a,b)=> amt(b)-amt(a));
  else if(INV_FILTER.sort === 'new')  list.sort((a,b)=> (b.id||0)-(a.id||0));
  else                                list.sort((a,b)=> due(a)-due(b) || amt(b)-amt(a));
  return list;
}

function invKpiBar(){
  const live = INV_ROWS.filter(invIsOutstanding);
  const sum  = rows => rows.reduce((a,r)=>a+(Number(r.amount)||0), 0);
  const weekEnd = invEndOfWeek();
  const inWeek = live.filter(r=> r.due_date && r.due_date <= weekEnd);
  const late   = live.filter(r=> invStatus(r).key === 'late');
  const linked = live.filter(r=> invStatus(r).key === 'linked');
  const sups   = new Set(live.map(r=>r.supplier)).size;
  const card = (cls, lbl, val, sub) =>
    `<div class="iv-kpi ${cls}"><span class="lbl">${t(lbl)}</span>
      <span class="val">${formatMoney(val)}<em>${t('ر.ق')}</em></span>
      <span class="sub">${sub}</span></div>`;
  return `<div class="iv-kpis">
    ${card('all','إجمالي غير مسدّد', sum(live),
        invCountInv(live.length) + ' · ' + invCountSup(sups))}
    ${card('week','مستحق هذا الأسبوع', sum(inWeek),
        t('حتى {d}').replace('{d}', invFmtDate(weekEnd)) + ' · ' + invCountInv(inWeek.length))}
    ${card('late','متأخر عن موعده', sum(late), invCountInv(late.length))}
    ${card('link','مُدرَج في طلبات صرف', sum(linked),
        invCountInv(linked.length) + ' · ' + t('بانتظار التحويل'))}
  </div>`;
}

function invToolbar(){
  const sel = (id, val, opts) =>
    `<select id="${id}" onchange="invSetFilter('${id}', this.value)">` +
    opts.map(o=>`<option value="${o[0]}"${o[0]===val?' selected':''}>${t(o[1])}</option>`).join('') +
    '</select>';
  return `<div class="iv-tools">
    <input class="grow" type="search" id="inv-q" value="${escAttr(INV_FILTER.q)}"
      oninput="invSetFilter('inv-q', this.value)"
      placeholder="${escAttr(t('بحث برقم الفاتورة أو المورّد أو مركز التكلفة'))}">
    ${sel('inv-supplier', INV_FILTER.supplier,
        [['', 'كل الموردين']].concat(INV_SUPS.map(s=>[s, s])))}
    ${sel('inv-status', INV_FILTER.status,
        [['due','غير مسدّدة'],['all','الكل'],['late','متأخرة'],['linked','في طلب صرف'],
         ['paid','مسدّدة'],['excluded','مستبعدة']])}
    ${sel('inv-sort', INV_FILTER.sort,
        [['due','ترتيب: الأقرب استحقاقًا'],['amount','الأعلى مبلغًا'],['new','الأحدث تسجيلًا']])}
    <button class="hbtn sm ghost" onclick="invToggleGroup()">${ARC_ICONS.layers}${t(INV_GROUPED?'بدون تجميع':'تجميع بالمورّد')}</button>
  </div>`;
}

function invRow(row){
  const st = invStatus(row);
  const cc = invCostLabel(row);
  const n  = invDaysLeft(row.due_date);
  const lateCls = (n !== null && n < 0 && st.key !== 'paid') ? ' is-late' : '';
  const who = personName(row.created_by||'');
  const req = invLinkedRequest(row);
  const act = invCanEditRow(row)
    ? `<button class="hbtn sm ghost" onclick="event.stopPropagation();openInvoiceForm(${row.id})">${t('تعديل')}</button>`
    : '';
  return `<div class="ivrow${st.key==='paid'||st.key==='excluded'?' is-paid':''}"
      role="button" tabindex="0" onclick="invOpen(${row.id})"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();invOpen(${row.id})}">
    <span class="ivrow-no">${escapeHtml(row.inv_no||'—')}</span>
    <div class="ivrow-main"><b>${escapeHtml(row.descr||'—')}</b>
      <span>${escapeHtml(row.supplier||'—')} · ${t('سجّلها')} ${escapeHtml(who)}</span></div>
    <span class="ivrow-cc${cc.gen?' gen':''}">${escapeHtml(cc.text)}</span>
    <span class="ivrow-due${lateCls}">${invFmtDate(row.due_date)}<i>${escapeHtml(invDueNote(row.due_date))}</i></span>
    <span class="ivrow-amt">${formatMoney(row.amount)} <em>${t('ر.ق')}</em></span>
    <span class="ivrow-st"><span class="arc-status ${st.cls}"><i></i>${t(st.label)}</span>
      ${req?`<span class="lk">${escapeHtml(displayRequestNo(req.req_no)||'')}</span>`:''}</span>
    <span class="ivrow-act">${act}</span>
  </div>`;
}

function renderInvoices(){
  const body = document.getElementById('inv-body');
  if(!body) return;
  const list = invFiltered();
  let inner;
  if(!list.length){
    inner = homeEmpty(INV_ICONS.receipt, 'لا توجد فواتير بهذا الفلتر',
      INV_ROWS.length ? 'غيّر الفلتر أو البحث' : 'ابدأ بتسجيل أول فاتورة');
  } else if(INV_GROUPED){
    const groups = {};
    list.forEach(r=>{ (groups[r.supplier] = groups[r.supplier] || []).push(r); });
    const order = Object.keys(groups).sort((a,b)=>
      groups[b].reduce((s,r)=>s+(Number(r.amount)||0),0) - groups[a].reduce((s,r)=>s+(Number(r.amount)||0),0));
    inner = order.map(name=>{
      const g   = groups[name];
      const tot = g.filter(invIsOutstanding).reduce((s,r)=>s+(Number(r.amount)||0),0);
      return `<div class="iv-grp"><b>${escapeHtml(name||'—')}</b>
          <span class="cnt">${g.length}</span>
          <span class="sum">${formatMoney(tot)} <em>${t('ر.ق')}</em></span></div>`
        + g.map(invRow).join('');
    }).join('');
  } else {
    inner = list.map(invRow).join('');
  }
  const shown = list.filter(invIsOutstanding).reduce((s,r)=>s+(Number(r.amount)||0), 0);
  const bar = list.length
    ? `<div class="h-paybar"><span>${t('إجمالي غير المسدّد الظاهر')}</span>
         <b>${formatMoney(shown)} ${t('ر.ق')}</b></div>` : '';

  body.innerHTML = invKpiBar() + invUpcoming()
    + `<section class="h-sec">${invToolbar()}${inner}${bar}</section>`;
  if(typeof translateStaticNodes === 'function') translateStaticNodes();
}

/* لوحة الالتزامات القادمة — توزيع المستحق على الأسابيع */
function invUpcoming(){
  const live = INV_ROWS.filter(invIsOutstanding);
  if(!live.length) return '';
  const weekEnd = invEndOfWeek();
  const next = new Date(weekEnd + 'T00:00:00'); next.setDate(next.getDate() + 7);
  const nextEnd = invIso(next);
  const sum = rows => rows.reduce((a,r)=>a+(Number(r.amount)||0), 0);

  const lateR = live.filter(r=> invStatus(r).key === 'late');
  const wk1   = live.filter(r=> r.due_date && r.due_date <= weekEnd && invStatus(r).key !== 'late');
  const wk2   = live.filter(r=> r.due_date && r.due_date > weekEnd && r.due_date <= nextEnd);
  const rest  = live.filter(r=> !r.due_date || r.due_date > nextEnd);
  const total = sum(live) || 1;

  const line = (cls, name, note, rows) => {
    const v = sum(rows);
    if(!rows.length) return '';
    return `<div class="iv-bar-line ${cls}">
      <span class="nm">${t(name)}<i>${note} · ${invCountInv(rows.length)}</i></span>
      <div class="iv-bar-track"><div class="iv-bar-fill" style="width:${Math.max(1, v/total*100).toFixed(1)}%"></div></div>
      <span class="vl">${formatMoney(v)} <em>${t('ر.ق')}</em></span></div>`;
  };
  const body = line('w0','متأخرة', t('فات موعدها'), lateR)
    + line('w1','هذا الأسبوع', t('حتى {d}').replace('{d}', invFmtDate(weekEnd)), wk1)
    + line('w2','الأسبوع القادم', t('حتى {d}').replace('{d}', invFmtDate(nextEnd)), wk2)
    + line('w3','لاحقًا', t('بعد {d}').replace('{d}', invFmtDate(nextEnd)), rest);
  if(!body) return '';
  return `<section class="h-sec">
    <div class="h-sec-hd"><b>${t('الالتزامات القادمة')}</b><span>${t('توزيع المستحق على الأسابيع')}</span>
      <em class="h-count">${formatMoney(sum(live))} ${t('ر.ق')}</em></div>
    <div class="iv-bars">${body}</div></section>`;
}

function invSetFilter(id, value){
  if(id === 'inv-q')        INV_FILTER.q = value;
  if(id === 'inv-supplier') INV_FILTER.supplier = value;
  if(id === 'inv-status')   INV_FILTER.status = value;
  if(id === 'inv-sort')     INV_FILTER.sort = value;
  const keep = (id === 'inv-q');
  renderInvoices();
  if(keep){
    const el = document.getElementById('inv-q');
    if(el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }
}
function invToggleGroup(){ INV_GROUPED = !INV_GROUPED; renderInvoices(); }

/* ── تفاصيل الفاتورة ── */
function invOpen(id){
  const row = INV_ROWS.find(r=>r.id===id);
  if(!row) return;
  const st  = invStatus(row);
  const req = invLinkedRequest(row);
  const cc  = invCostCenters(row);
  const details = [
    { label:t('المورّد'),        value: row.supplier || '—' },
    { label:t('رقم الفاتورة'),   value: row.inv_no || '—', ltr:true },
    { label:t('المبلغ'),         value: formatMoney(row.amount) + ' ' + t('ر.ق'), ltr:true },
    { label:t('تاريخ الفاتورة'), value: invFmtDate(row.inv_date), ltr:true },
    { label:t('موعد الدفع'),     value: invFmtDate(row.due_date) + ' · ' + invDueNote(row.due_date) },
    { label:t('مركز التكلفة'),   value: row.is_general ? t('فاتورة عامة')
        : (cc.map(c=>c.inv).filter(Boolean).join('، ') || '—') },
    { label:t('الحالة'),         value: t(st.label) + (req ? ' · ' + (displayRequestNo(req.req_no)||'') : '') },
    { label:t('سجّلها'),         value: personName(row.created_by||'') }
  ];
  showMessageDialog({
    title: row.descr || t('تفاصيل الفاتورة'),
    subtitle: 'Supplier Invoice',
    message: '',
    details,
    confirmText: t('حسنًا')
  });
}

/* ══════════════════════════════════════════
   تسجيل / تعديل فاتورة
══════════════════════════════════════════ */
let INV_FORM = null;

function openInvoiceForm(id){
  if(!invCanWrite()){
    showMessageDialog({ title:t('صلاحية العرض فقط'),
      message:t('حسابك مخصّص للعرض والطباعة فقط، ولا يمكنك تسجيل الفواتير.'), confirmText:t('حسنًا') });
    return;
  }
  const row = id ? INV_ROWS.find(r=>r.id===id) : null;
  if(id && !invCanEditRow(row)){
    showMessageDialog({ title:t('لا يمكن التعديل'),
      message:t('الفاتورة مربوطة بطلب صرف، أو سجّلها موظف آخر.'), confirmText:t('حسنًا') });
    return;
  }
  INV_FORM = {
    id: row ? row.id : null,
    cc: row ? (row.is_general ? [] : invCostCenters(row)) : [{ inv:'', amt:'' }],
    general: row ? !!row.is_general : false,
    due: row ? (row.due_date || '') : invEndOfMonth(),
    dueMode: row ? (row.due_date ? 'date' : 'none') : 'month',
    file: null,
    attachment: row ? (row.attachment || null) : null
  };
  const old = document.getElementById('app-confirm-overlay');
  if(old) old.remove();
  const ov = document.createElement('div');
  ov.id = 'app-confirm-overlay';
  ov.dir = 'rtl';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,19,33,.55);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);overflow:auto;';
  ov.innerHTML = `
    <div class="acd-card" role="dialog" aria-modal="true" style="width:min(560px,100%);max-height:92vh;display:flex;flex-direction:column">
      <div class="acd-head iv-head">
        <div>
          <div class="acd-title" data-i18n="${row ? 'تعديل فاتورة مورّد' : 'تسجيل فاتورة مورّد'}">${row ? t('تعديل فاتورة مورّد') : t('تسجيل فاتورة مورّد')}</div>
          <div class="acd-cap">Supplier Invoice</div>
        </div>
        <span class="iv-mark"><img src="assets/images/image-5fa147e6c3d5.png" alt="Zamzam"></span>
      </div>
      <div class="acd-body" style="overflow:auto">
        <div class="qf-grid">
          <div class="sec-title full"><span class="ar" data-i18n="بيانات الفاتورة">${t('بيانات الفاتورة')}</span><span class="en">Invoice Details</span></div>
          <div class="qf-f">
            <label><span class="ar" data-i18n="المورّد">${t('المورّد')}</span><span class="en">Supplier</span> <em class="req">*</em></label>
            <input type="text" id="iv-sup" list="iv-sup-list" value="${escAttr(row?row.supplier:'')}"
              placeholder="${escAttr(t('اكتب أو اختر'))}" data-i18n-attr="placeholder|اكتب أو اختر">
            <datalist id="iv-sup-list">${INV_SUPS.map(s=>`<option value="${escAttr(s)}"></option>`).join('')}</datalist>
          </div>
          <div class="qf-f">
            <label><span class="ar" data-i18n="رقم الفاتورة">${t('رقم الفاتورة')}</span><span class="en">Invoice No.</span> <em class="req">*</em></label>
            <input type="text" id="iv-no" class="ltr" value="${escAttr(row?row.inv_no:'')}">
          </div>
          <div class="qf-f full">
            <label><span class="ar" data-i18n="بيان مختصر">${t('بيان مختصر')}</span><span class="en">Description</span> <em class="req">*</em></label>
            <input type="text" id="iv-desc" value="${escAttr(row?row.descr:'')}"
              placeholder="${escAttr(t('مثال: إقامة مكة — الدفعة الأولى'))}" data-i18n-attr="placeholder|مثال: إقامة مكة — الدفعة الأولى">
          </div>
          <div class="qf-f">
            <label><span class="ar" data-i18n="المبلغ (ر.ق)">${t('المبلغ (ر.ق)')}</span><span class="en">Amount QAR</span> <em class="req">*</em></label>
            <input type="text" id="iv-amt" class="ltr" inputmode="decimal" style="font-weight:700"
              value="${row?formatMoney(row.amount):''}" oninput="invFmtField(this)" placeholder="0.00">
          </div>
          <div class="qf-f">
            <label><span class="ar" data-i18n="تاريخ الفاتورة">${t('تاريخ الفاتورة')}</span><span class="en">Invoice Date</span></label>
            <input type="date" id="iv-date" value="${escAttr(row?(row.inv_date||''):TODAY)}">
          </div>
          <div class="qf-f full">
            <label><span class="ar" data-i18n="موعد الدفع المتوقّع">${t('موعد الدفع المتوقّع')}</span><span class="en">Expected Payment</span></label>
            <div class="qf-chips" id="iv-due-chips"></div>
            <input type="date" id="iv-due" value="${escAttr(INV_FORM.due)}"
              style="margin-top:6px;${INV_FORM.dueMode==='date'?'':'display:none'}" onchange="invDuePicked(this.value)">
          </div>
          <div class="sec-title full"><span class="ar" data-i18n="مركز التكلفة">${t('مركز التكلفة')}</span><span class="en">Cost Center</span></div>
          <div class="qf-f full">
            <label><span class="ar" data-i18n="رقم فاتورة العميل - ‎Odoo">${t('رقم فاتورة العميل - ‎Odoo')}</span><span class="en">Client Invoice No.</span></label>
            <div id="iv-cc"></div>
            <div class="cost-actions iv-cost-actions">
              <button type="button" class="add-row-btn" onclick="invAddCc()">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>
                <span data-i18n="إضافة مركز تكلفة">${t('إضافة مركز تكلفة')}</span></button>
              <label class="cost-toggle">
                <input type="checkbox" id="iv-general" ${INV_FORM.general?'checked':''} onchange="invToggleGeneral(this.checked)">
                <span data-i18n="فاتورة عامة">${t('فاتورة عامة')}</span></label>
              <span class="qf-rem" id="iv-rem"></span>
            </div>
          </div>
          <div class="attach-zone iv-drop full${INV_FORM.attachment?' has':''}" id="iv-drop"
            role="button" tabindex="0" onclick="document.getElementById('iv-file').click()"
            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();document.getElementById('iv-file').click()}">
            <div class="big">${INV_ICONS.clip}<span id="iv-drop-txt" data-i18n="${INV_FORM.attachment ? 'مرفق محفوظ — اضغط للاستبدال' : 'صورة الفاتورة (اختياري)'}">${INV_FORM.attachment ? t('مرفق محفوظ — اضغط للاستبدال') : t('صورة الفاتورة (اختياري)')}</span></div>
          </div>
          <input type="file" id="iv-file" accept="application/pdf,image/*" style="display:none" onchange="invFilePicked(this)">
          <div class="qf-err" id="iv-err" style="display:none"></div>
        </div>
      </div>
      <div class="acd-foot">
        <button class="acd-btn acd-cancel" onclick="invCloseForm()" data-i18n="رجوع">${t('رجوع')}</button>
        ${row && invCanManage() ? `<button class="acd-btn" style="background:var(--n0);border:1px solid var(--stop-line);color:var(--stop)" onclick="invExclude(${row.id})">${t(row.status==='excluded'?'إرجاع للسجل':'استبعاد')}</button>` : ''}
        <button class="acd-btn acd-confirm" id="iv-save" onclick="saveInvoice()" data-i18n="حفظ">${t('حفظ')}</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e=>{ if(e.target === ov) invCloseForm(); });
  invRenderDueChips();
  invRenderCc();
  document.getElementById('iv-sup')?.focus();
}
function invCloseForm(){
  document.getElementById('app-confirm-overlay')?.remove();
  INV_FORM = null;
}
function invFmtField(el){
  const pos = el.selectionStart, oldLen = el.value.length;
  el.value = fmtAmt(el.value);
  const np = Math.max(0, pos + (el.value.length - oldLen));
  el.setSelectionRange(np, np);
  if(el.id === 'iv-amt') invAutoShare();
  invRenderRemainder();
}
function invRenderDueChips(){
  const box = document.getElementById('iv-due-chips');
  if(!box || !INV_FORM) return;
  const chips = [['week','آخر الأسبوع'],['month','آخر الشهر'],['date','تاريخ محدّد'],['none','غير محدّد']];
  box.innerHTML = chips.map(c=>
    `<button type="button" class="qf-chip${INV_FORM.dueMode===c[0]?' on':''}" onclick="invSetDue('${c[0]}')" data-i18n="${c[1]}">${t(c[1])}</button>`
  ).join('') + `<span class="qf-rem" style="color:var(--txt-3)">${INV_FORM.due?invFmtDate(INV_FORM.due):t('بدون موعد')}</span>`;
}
function invSetDue(mode){
  if(!INV_FORM) return;
  INV_FORM.dueMode = mode;
  if(mode === 'week')  INV_FORM.due = invEndOfWeek();
  if(mode === 'month') INV_FORM.due = invEndOfMonth();
  if(mode === 'none')  INV_FORM.due = '';
  const picker = document.getElementById('iv-due');
  if(picker){
    picker.style.display = (mode === 'date') ? '' : 'none';
    if(mode !== 'date') picker.value = INV_FORM.due;
    else if(!picker.value) picker.value = invEndOfMonth();
    if(mode === 'date') INV_FORM.due = picker.value;
  }
  invRenderDueChips();
}
function invDuePicked(v){ if(INV_FORM){ INV_FORM.due = v; INV_FORM.dueMode = 'date'; invRenderDueChips(); } }
function invToggleGeneral(on){
  if(!INV_FORM) return;
  INV_FORM.general = !!on;
  invRenderCc();
}
function invAddCc(){
  if(!INV_FORM) return;
  invCollectCc();
  if(INV_FORM.general){
    INV_FORM.general = false;
    const g = document.getElementById('iv-general'); if(g) g.checked = false;
  }
  INV_FORM.cc.push({ inv:'', amt:'' });
  invRenderCc();
}
function invDelCc(i){
  if(!INV_FORM) return;
  invCollectCc();
  INV_FORM.cc.splice(i, 1);
  invRenderCc();
}
function invCollectCc(){
  if(!INV_FORM) return;
  const rows = [...document.querySelectorAll('#iv-cc .qf-cc-row')];
  if(!rows.length) return;
  INV_FORM.cc = rows.map(r=>({
    inv: r.querySelector('.cc-inv')?.value || '',
    amt: r.querySelector('.cc-amt')?.value || ''
  }));
}
function invRenderCc(){
  const box = document.getElementById('iv-cc');
  if(!box || !INV_FORM) return;
  if(INV_FORM.general){ box.innerHTML = ''; invRenderRemainder(); return; }
  box.innerHTML = INV_FORM.cc.map((c,i)=>`
    <div class="qf-cc-row">
      <input type="text" class="cc-inv ltr" value="${escAttr(c.inv||'')}" placeholder="INV/2026/0000" onchange="invAutoShare()">
      <input type="text" class="cc-amt ltr" value="${escAttr(c.amt||'')}" inputmode="decimal"
        placeholder="${escAttr(t('النصيب'))}" data-i18n-attr="placeholder|النصيب" oninput="invFmtField(this)">
      <button type="button" class="del" onclick="invDelCc(${i})" aria-label="${escAttr(t('حذف'))}">✕</button>
    </div>`).join('');
  invRenderRemainder();
}
function invRenderRemainder(){
  const box = document.getElementById('iv-rem');
  if(!box || !INV_FORM) return;
  if(INV_FORM.general){ box.textContent = ''; box.className = 'qf-rem'; return; }
  const total = parseAmt(document.getElementById('iv-amt')?.value || 0);
  let done = 0;
  document.querySelectorAll('#iv-cc .cc-amt').forEach(i=> done += parseAmt(i.value));
  const rem = total - done;
  if(!total && !done){ box.textContent = ''; return; }
  box.className = 'qf-rem' + (Math.abs(rem) > 0.009 ? ' bad' : '');
  box.textContent = Math.abs(rem) > 0.009
    ? t('متبقٍ {v}').replace('{v}', formatMoney(rem))
    : t('مطابق ✓');
}
function invFilePicked(input){
  const f = input.files && input.files[0];
  if(!INV_FORM) return;
  INV_FORM.file = f || null;
  const drop = document.getElementById('iv-drop');
  const txt  = document.getElementById('iv-drop-txt');
  if(txt){
    const key = INV_FORM.attachment ? 'مرفق محفوظ — اضغط للاستبدال' : 'صورة الفاتورة (اختياري)';
    if(f){ txt.removeAttribute('data-i18n'); txt.textContent = f.name; }
    else { txt.setAttribute('data-i18n', key); txt.textContent = t(key); }
  }
  if(drop) drop.classList.toggle('has', !!(f || INV_FORM.attachment));
  if(drop) drop.classList.add('attach-zone');
}
function invShowErr(msg){
  const box = document.getElementById('iv-err');
  if(!box) return;
  box.textContent = msg;
  box.style.display = msg ? 'block' : 'none';
  if(msg) box.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

async function saveInvoice(){
  if(!INV_FORM) return;
  invCollectCc();
  const supplier = (document.getElementById('iv-sup')?.value || '').trim();
  const invNo    = (document.getElementById('iv-no')?.value || '').trim();
  const descr    = (document.getElementById('iv-desc')?.value || '').trim();
  const amount   = parseAmt(document.getElementById('iv-amt')?.value || 0);
  const invDate  = document.getElementById('iv-date')?.value || null;
  const general  = !!document.getElementById('iv-general')?.checked;

  const miss = [];
  if(!supplier) miss.push(t('المورّد'));
  if(!invNo)    miss.push(t('رقم الفاتورة'));
  if(!descr)    miss.push(t('بيان مختصر'));
  if(!(amount > 0)) miss.push(t('المبلغ'));
  if(miss.length){ invShowErr(t('ناقص: ') + miss.join('، ')); return; }

  const cc = general ? [] : INV_FORM.cc
    .map(c=>({ inv:String(c.inv||'').trim(), amt:parseAmt(c.amt) }))
    .filter(c=> c.inv || c.amt);
  if(cc.length === 1 && cc[0].inv && !(cc[0].amt > 0)) cc[0].amt = amount;
  const ccSum = cc.reduce((a,c)=>a+c.amt, 0);
  if(ccSum - amount > 0.009){
    invShowErr(t('مجموع مراكز التكلفة أكبر من مبلغ الفاتورة.'));
    return;
  }
  invShowErr('');

  const btn = document.getElementById('iv-save');
  if(btn){ btn.disabled = true; btn.textContent = t('جاري الحفظ...'); }
  try{
    let attachment = INV_FORM.attachment;
    if(INV_FORM.file){
      const paths = await uploadAttachments([INV_FORM.file], 'supplier-invoices');
      attachment = paths[0] || attachment;
    }
    const rec = {
      supplier, inv_no:invNo, descr, amount,
      inv_date: invDate || null,
      due_date: INV_FORM.due || null,
      cost_centers: JSON.stringify(cc),
      is_general: general,
      attachment: attachment || null,
      updated_at: new Date().toISOString()
    };
    let res;
    if(INV_FORM.id){
      res = await sb.from('supplier_invoices').update(rec).eq('id', INV_FORM.id);
    }else{
      rec.created_by = CURRENT?.name || null;
      rec.status = 'open';
      res = await sb.from('supplier_invoices').insert(rec);
    }
    if(res && res.error){
      if(res.error.code === '23505' || /duplicate key|already exists/i.test(res.error.message||'')){
        invShowErr(t('الفاتورة دي مسجّلة قبل كده لنفس المورّد بنفس الرقم.'));
      }else{
        console.error(res.error);
        invShowErr(t('تعذّر الحفظ — ') + (res.error.message || ''));
      }
      if(btn){ btn.disabled = false; btn.textContent = t('حفظ'); }
      return;
    }
    const wasEdit = !!INV_FORM.id;
    invCloseForm();
    await loadInvoices();
    showMessageDialog({
      title: wasEdit ? t('تم تحديث الفاتورة') : t('تم تسجيل الفاتورة'),
      subtitle: 'Supplier Invoice',
      message: '',
      details:[
        { label:t('المورّد'),      value: supplier },
        { label:t('رقم الفاتورة'), value: invNo, ltr:true },
        { label:t('المبلغ'),       value: formatMoney(amount) + ' ' + t('ر.ق'), ltr:true }
      ],
      confirmText:t('حسنًا')
    });
  }catch(e){
    console.error(e);
    invShowErr(t('خطأ اتصال — حاول مرة أخرى.'));
    if(btn){ btn.disabled = false; btn.textContent = t('حفظ'); }
  }
}

async function invExclude(id){
  const row = INV_ROWS.find(r=>r.id===id);
  if(!row) return;
  const back = row.status === 'excluded';
  invCloseForm();
  const ok = await showConfirmDialog({
    title: back ? t('إرجاع الفاتورة للسجل') : t('استبعاد الفاتورة'),
    message: back
      ? t('هترجع الفاتورة لقائمة المستحق وتُحتسب في الإجمالي.')
      : t('الفاتورة هتخرج من إجمالي المستحق، وهتفضل في السجل للرجوع إليها.'),
    confirmText: back ? t('إرجاع') : t('استبعاد'),
    danger: !back
  });
  if(!ok) return;
  const { error } = await sb.from('supplier_invoices')
    .update({ status: back ? 'open' : 'excluded', updated_at:new Date().toISOString() }).eq('id', id);
  if(error){
    console.error(error);
    showMessageDialog({ title:t('تعذّر التنفيذ'), message:error.message||'', confirmText:t('حسنًا') });
    return;
  }
  loadInvoices();
}

/* ── تصدير CSV ── */
function invExport(){
  const list = invFiltered();
  if(!list.length){
    showMessageDialog({ title:t('لا توجد بيانات للتصدير'), message:'', confirmText:t('حسنًا') });
    return;
  }
  const head = ['رقم الفاتورة','المورّد','البيان','المبلغ','تاريخ الفاتورة','موعد الدفع',
                'مركز التكلفة','الحالة','رقم طلب الصرف','سجّلها'].map(t);
  const rows = list.map(r=>{
    const st  = invStatus(r);
    const req = invLinkedRequest(r);
    return [r.inv_no, r.supplier, r.descr, Number(r.amount)||0, r.inv_date||'', r.due_date||'',
            r.is_general ? t('فاتورة عامة') : invCostCenters(r).map(c=>c.inv).join(' | '),
            t(st.label), req ? (displayRequestNo(req.req_no)||'') : '', personName(r.created_by||'')];
  });
  const esc = v => '"' + String(v==null?'':v).replace(/"/g,'""') + '"';
  const csv = '﻿' + [head, ...rows].map(r=>r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'supplier-invoices-' + TODAY + '.csv';
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ══════════════════════════════════════════
   الربط بطلب الصرف
══════════════════════════════════════════ */
function invLinkableRows(){
  return INV_ROWS.filter(invIsLinkable);
}
async function invEnsureLoaded(){
  if(INV_LOADED || !SB_ON || !CURRENT) return;
  try{
    let qy = sb.from('supplier_invoices').select('*').order('id',{ascending:false}).limit(2000);
    if(CURRENT.role === 'sales'){
      const names = Object.values(USER_MAP).filter(u=>u.role==='sales').map(u=>u.name);
      qy = qy.in('created_by', names);
    }
    const { data, error } = await qy;
    if(error) throw error;
    INV_ROWS = data || [];
    const ids = [...new Set(INV_ROWS.map(r=>r.request_id).filter(Boolean))];
    INV_REQ_MAP = {};
    if(ids.length){
      const { data:reqs } = await sb.from('requests')
        .select('id,req_no,transfer_image,cancelled,accounts_signed_by').in('id', ids);
      (reqs||[]).forEach(r=>{ INV_REQ_MAP[r.id] = r; });
    }
    INV_SUPS = [...new Set(INV_ROWS.map(r=>String(r.supplier||'').trim()).filter(Boolean))].sort();
    INV_LOADED = true;
  }catch(e){ console.error(e); }
}

// بيتنادى من showPage كل ما صفحة طلب الصرف تظهر
async function onDisbPageShown(){
  renderInvImportBar();
  await invEnsureLoaded();
  renderInvImportBar();
}
function renderInvImportBar(){
  const bar = document.getElementById('inv-import');
  if(!bar) return;
  if(!SB_ON || !invCanWrite() || VIEW_ONLY){ bar.style.display = 'none'; return; }
  const open = invLinkableRows();
  const total = open.reduce((a,r)=>a+(Number(r.amount)||0), 0);
  bar.style.display = '';
  bar.innerHTML = `<svg class="lead" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14v18l-3-2-3 2-3-2-3 2z"></path><path d="M9 11h6"></path></svg>
    <p>${open.length
        ? t('عندك {c} مسجّلة غير مسدّدة').replace('{c}', invCountInv(open.length)) + ' — ' + formatMoney(total) + ' ' + t('ر.ق')
        : t('مفيش فواتير مسجّلة متاحة للربط')}</p>
    <button type="button" class="hbtn sm primary" onclick="openInvoicePicker()" ${open.length?'':'disabled style="opacity:.55;cursor:default"'}>
      ${ARC_ICONS.plus}${t('اختيار من الفواتير المسجّلة')}</button>`;
}

let INV_PICK_Q = '';
function openInvoicePicker(){
  INV_PICK_Q = '';
  invRenderPicker(new Set());
}
function invRenderPicker(selected){
  const old = document.getElementById('app-confirm-overlay');
  if(old) old.remove();
  const ov = document.createElement('div');
  ov.id = 'app-confirm-overlay';
  ov.dir = 'rtl';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,19,33,.55);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';
  ov.innerHTML = `
    <div class="acd-card" role="dialog" aria-modal="true" style="width:min(620px,100%);max-height:92vh;display:flex;flex-direction:column">
      <div class="acd-head iv-head">
        <div>
          <div class="acd-title" data-i18n="اختيار من الفواتير المسجّلة">${t('اختيار من الفواتير المسجّلة')}</div>
          <div class="acd-cap">Supplier Invoices</div>
        </div>
        <span class="iv-mark"><img src="assets/images/image-5fa147e6c3d5.png" alt="Zamzam"></span>
      </div>
      <div class="acd-body" style="overflow:auto">
        <div class="pk-search"><input type="search" id="pk-q" value="${escAttr(INV_PICK_Q)}"
          oninput="invPickSearch(this.value)" placeholder="${escAttr(t('بحث — الطلب الواحد لمورّد واحد'))}" data-i18n-attr="placeholder|بحث — الطلب الواحد لمورّد واحد"></div>
        <div class="pk-list" id="pk-list"></div>
        <div class="pk-sum"><span id="pk-count"></span><b id="pk-total"></b></div>
      </div>
      <div class="acd-foot">
        <button class="acd-btn acd-cancel" onclick="document.getElementById('app-confirm-overlay')?.remove()" data-i18n="رجوع">${t('رجوع')}</button>
        <button class="acd-btn acd-confirm" id="pk-ok" onclick="invApplyPick()" data-i18n="إضافة للطلب">${t('إضافة للطلب')}</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e=>{ if(e.target === ov) ov.remove(); });
  ov._sel = selected || new Set();
  invPaintPicker();
}
function invPickSearch(v){ INV_PICK_Q = v; invPaintPicker(); }
function invPickedSet(){
  return document.getElementById('app-confirm-overlay')?._sel || new Set();
}
function invPaintPicker(){
  const list = document.getElementById('pk-list');
  if(!list) return;
  const sel = invPickedSet();
  // مورّد واحد لكل طلب — زي الوضع الحالي بالحرف
  let lockSup = null;
  if(sel.size){
    const first = INV_ROWS.find(r=>sel.has(r.id));
    lockSup = first ? String(first.supplier||'').trim() : null;
  }
  if(!lockSup){
    const typed = (document.querySelector('#supplier-rows .s-name')?.value || '').trim();
    if(typed) lockSup = typed;
  }
  const q = INV_PICK_Q.trim().toLowerCase();
  const rows = invLinkableRows().filter(r=>{
    if(!q) return true;
    return [r.supplier, r.inv_no, r.descr].join(' ').toLowerCase().indexOf(q) >= 0;
  }).sort((a,b)=>{
    const da = a.due_date || '9999-12-31', db = b.due_date || '9999-12-31';
    return da.localeCompare(db);
  });
  if(!rows.length){
    list.innerHTML = `<div class="pk-empty">${t('مفيش فواتير متاحة للربط')}</div>`;
  }else{
    list.innerHTML = rows.map(r=>{
      const cc = invCostLabel(r);
      const blocked = lockSup && String(r.supplier||'').trim() !== lockSup;
      const on = sel.has(r.id);
      return `<div class="pk-row" style="${blocked?'opacity:.45':''}" onclick="${blocked?'':`invTogglePick(${r.id})`}">
        <input type="checkbox" ${on?'checked':''} ${blocked?'disabled':''} onclick="event.stopPropagation();invTogglePick(${r.id})">
        <span class="pk-no">${escapeHtml(r.inv_no||'—')}</span>
        <div class="pk-main"><b>${escapeHtml(r.descr||'—')}</b>
          <span>${escapeHtml(r.supplier||'')} · ${escapeHtml(invDueNote(r.due_date))}</span></div>
        <span class="pk-cc">${escapeHtml(cc.text)}</span>
        <span class="pk-amt">${formatMoney(r.amount)} <em>${t('ر.ق')}</em></span>
      </div>`;
    }).join('');
  }
  const picked = INV_ROWS.filter(r=>sel.has(r.id));
  const total  = picked.reduce((a,r)=>a+(Number(r.amount)||0), 0);
  const c = document.getElementById('pk-count');
  const b = document.getElementById('pk-total');
  const ok = document.getElementById('pk-ok');
  if(c) c.textContent = t('المحدّد: {c}').replace('{c}', invCountInv(picked.length));
  if(b) b.textContent = formatMoney(total) + ' ' + t('ر.ق');
  if(ok){ ok.disabled = !picked.length; ok.style.opacity = picked.length ? '' : '.55'; }
}
function invTogglePick(id){
  const sel = invPickedSet();
  if(sel.has(id)) sel.delete(id); else sel.add(id);
  invPaintPicker();
}

function invApplyPick(){
  const sel = invPickedSet();
  const picked = INV_ROWS.filter(r=>sel.has(r.id));
  if(!picked.length) return;

  // الحد الأقصى لصفوف الطلب — نفس الحد الموجود أصلاً
  const supEmpty = invRowIsEmpty('#supplier-rows tr', ['.s-name','.s-inv','.s-amt']);
  const cliEmpty = invRowIsEmpty('#client-rows tr', ['.c-inv','.c-amt']);
  const ccCount  = picked.reduce((a,r)=> a + (r.is_general ? 0 : invCostRowsFor(r).filter(c=>c.inv||c.amt).length), 0);
  const after = getDisbTableRowsCount() - (supEmpty?1:0) - (cliEmpty?1:0) + picked.length + ccCount;
  if(after > MAX_DISB_TABLE_ROWS){
    document.getElementById('app-confirm-overlay')?.remove();
    showMessageDialog({
      title:t('عدد الصفوف أكبر من الحد'),
      message:t('الطلب الواحد بيستحمل {max} صفًا. اختَر فواتير أقل أو قسّمها على أكتر من طلب.')
        .replace('{max}', MAX_DISB_TABLE_ROWS),
      confirmText:t('حسنًا')
    });
    return;
  }

  if(supEmpty) document.querySelector('#supplier-rows tr')?.remove();
  if(cliEmpty) document.querySelector('#client-rows tr')?.remove();

  let anyCc = false;
  picked.forEach(r=>{
    addSupplierRow(escAttr(r.supplier||''), escAttr(r.inv_no||''), formatMoney(r.amount), true);
    if(!r.is_general){
      // أول مركز في المجموعة بس بياخد اسم الفاتورة — يكفي إنه يعلّم بداية
      // المجموعة، والباقي تحته. ده بيمنع تكرار الرقم في كل سطر.
      let first = true;
      invCostRowsFor(r).forEach(c=>{
        if(!c.inv && !c.amt) return;
        anyCc = true;
        addClientRow(escAttr(c.inv||''), c.amt ? formatMoney(c.amt) : '', true,
                     first ? (r.inv_no || '') : '');
        first = false;
      });
    }
  });
  if(!document.querySelector('#client-rows tr')) addClientRow('', '', true);

  // فاتورة عامة لكل المختار → نفعّل مفتاح «فاتورة عامة» زي ما الموظف كان هيعمل
  const allGeneral = picked.every(r=>r.is_general);
  const costToggle = document.getElementById('d-cost-disabled');
  if(costToggle && allGeneral && !anyCc && !costToggle.checked){
    costToggle.checked = true;
    if(typeof toggleCostCenter === 'function') toggleCostCenter();
  }

  recalcSupplier();
  recalcClient();

  // الإجمالي المطلوب صرفه — بنملاه لو فاضي بس، ما بنلغيش رقم كتبه الموظف
  const amtEl = document.getElementById('d-amt');
  if(amtEl && !parseAmt(amtEl.value)){
    const total = picked.reduce((a,r)=>a+(Number(r.amount)||0), 0);
    amtEl.value = formatMoney(total);
    if(typeof handleAmt === 'function') handleAmt(amtEl);
    else if(typeof updateDisbWords === 'function') updateDisbWords(amtEl.value);
  }

  INV_PICKED = [...new Set(INV_PICKED.concat(picked.map(r=>r.id)))];
  document.getElementById('app-confirm-overlay')?.remove();
  invMarkLinkedRows();
  renderInvImportBar();
}
function invRowIsEmpty(sel, fields){
  const rows = document.querySelectorAll(sel);
  if(rows.length !== 1) return false;
  return fields.every(f=> !(rows[0].querySelector(f)?.value || '').trim());
}
// شارة «مربوطة» جنب رقم الفاتورة داخل جدول الطلب — no-print فمابتطبعش
function invMarkLinkedRows(){
  const nums = new Set(INV_ROWS.filter(r=>INV_PICKED.includes(r.id))
    .map(r=>String(r.inv_no||'').trim()));
  document.querySelectorAll('#supplier-rows tr').forEach(tr=>{
    tr.querySelector('.lk-badge')?.remove();
    const v = (tr.querySelector('.s-inv')?.value || '').trim();
    if(!v || !nums.has(v)) return;
    const cell = tr.querySelector('.s-inv')?.parentElement;
    if(!cell) return;
    const b = document.createElement('span');
    b.className = 'lk-badge no-print';
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>${t('مربوطة')}`;
    cell.appendChild(b);
  });
}
function invClearPicked(){
  INV_PICKED = [];
  document.querySelectorAll('#supplier-rows .lk-badge').forEach(b=>b.remove());
  renderInvImportBar();
}

/* بيتنادى بعد حفظ طلب الصرف — بيربط الفواتير المختارة بالطلب */
async function syncLinkedInvoices(requestId, reqNo){
  if(!SB_ON || !requestId || !INV_PICKED.length) return;
  const ids = INV_PICKED.slice();
  try{
    const { error } = await sb.from('supplier_invoices').update({
      request_id: requestId,
      req_no: reqNo || null,
      linked_at: new Date().toISOString(),
      linked_by: CURRENT?.name || null,
      updated_at: new Date().toISOString()
    }).in('id', ids);
    if(error){ console.error(error); return; }
    INV_PICKED = [];
    INV_LOADED = false;   // نعيد التحميل عشان الحالات تتحدّث
  }catch(e){ console.error(e); }
}
