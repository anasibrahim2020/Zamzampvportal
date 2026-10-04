/* ══════════════════════════════════════════════════════════
   التحصيل النقدي — الكاش المستلم من العملاء
   الموظف يسجّل ما استلمه، والمحاسب يستلمه منه ثم يودعه في البنك
   بصورة إيصال. التحصيلات مرئية للجميع كوعاء واحد.
══════════════════════════════════════════════════════════ */

let CASH_ROWS   = [];
let CASH_LOADED = false;
let CASH_FILTER = { q:'', emp:'', status:'open', sort:'new' };
let CASH_SEL    = new Set();   // المحدّد في وضع الاستلام أو الإيداع
let CASH_MODE   = null;        // 'receive' | 'deposit' | null

const CASH_ICONS = {
  vault:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="2"></rect><path d="M3 10h18"></path><circle cx="12" cy="14.5" r="2"></circle></svg>',
  check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>',
  bank:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-6 9 6"></path><path d="M5 10v9"></path><path d="M19 10v9"></path><path d="M9 10v9"></path><path d="M15 10v9"></path><path d="M3 20h18"></path></svg>',
  excel:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M7 10l5 5 5-5"></path><path d="M12 15V3"></path></svg>',
  clip:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.4 11.6-8.5 8.5a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"></path></svg>',
  move:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3 4 7l4 4"></path><path d="M4 7h16"></path><path d="m16 21 4-4-4-4"></path><path d="M20 17H4"></path></svg>'
};

/* ── الصلاحيات: المحاسب يستلم ويودع، والإدارة تعرض فقط ── */
function cashCanWrite(){ return !!CURRENT && CURRENT.role !== 'viewer'; }
function cashIsAccountant(){ return !!CURRENT && CURRENT.role === 'accountant'; }
// الموظف يعدّل ويحذف إيصاله ما دام المحاسب لم يستلمه بعد
function cashCanEdit(row){
  if(!cashCanWrite() || !row) return false;
  if(row.status !== 'with_employee') return false;
  if(cashIsAccountant()) return true;
  return row.created_by === CURRENT.name;
}

// الحائز الحالي للنقدية: من انتقلت إليه بالنقل، وإلا صاحب المرحلة —
// الموظف الذي استلمها من العميل قبل استلام المحاسب، والمحاسب بعده.
function cashHolder(row){
  if(!row) return '';
  if(row.held_by) return row.held_by;
  return (row.status === 'with_employee') ? (row.created_by || '') : (row.received_by || '');
}
function cashPending(row){ return !!row && row.handover_state === 'pending'; }
// من يصحّ نقل العهدة إليه: زملاء المرحلة نفسها، عدا نفسي
function cashPeers(){
  try{
    const role = CURRENT && CURRENT.role;
    if(role !== 'sales' && role !== 'accountant') return [];
    return Object.values(USER_MAP)
      .filter(u => u.role === role && u.name !== CURRENT.name)
      .map(u => u.name);
  }catch(e){ return []; }
}

function cashStatus(row){
  if(!row) return { key:'with_employee', label:'مع الموظف', cls:'st-emp' };
  if(row.status === 'deposited')       return { key:'deposited',       label:'مودعة',       cls:'st-dep'  };
  if(cashPending(row))                 return { key:'handover', label:'قيد التسليم', cls:'st-move' };
  if(row.status === 'with_accountant') return { key:'with_accountant', label:'مع المحاسب', cls:'st-acct' };
  return { key:'with_employee', label:'مع الموظف', cls:'st-emp' };
}

// ما زال ضمن التحصيل: لم يصل البنك بعد
function cashInVault(row){ return cashStatus(row).key !== 'deposited'; }

function cashFmtDate(v){
  if(!v) return '—';
  const d = new Date(String(v).slice(0,10) + 'T00:00:00');
  if(Number.isNaN(d.getTime())) return v;
  const p = n => String(n).padStart(2,'0');
  return p(d.getDate())+'-'+p(d.getMonth()+1)+'-'+d.getFullYear();
}
function cashAgeNote(v){
  if(!v) return '';
  const d = new Date(String(v).slice(0,10) + 'T00:00:00');
  if(Number.isNaN(d.getTime())) return '';
  const today = new Date(); today.setHours(0,0,0,0);
  const n = Math.round((today - d) / 86400000);
  if(n <= 0) return t('اليوم');
  if(n === 1) return t('منذ يوم');
  if(n === 2) return t('منذ يومين');
  if(n <= 10) return t('منذ {n} أيام').replace('{n}', n);
  return t('منذ {n} يومًا').replace('{n}', n);
}

/* ══════════════════════════════════════════
   التحميل
══════════════════════════════════════════ */
async function loadCash(){
  const body = document.getElementById('cash-body');
  if(!body || !CURRENT) return;

  cashRenderHead();

  if(!SB_ON){ body.innerHTML = homeEmpty(CASH_ICONS.vault, 'الحفظ السحابي غير مفعّل', '—'); return; }
  body.innerHTML = `<div class="h-loading">${t('جاري التحميل...')}</div>`;
  try{
    const { data, error } = await sb.from('cash_receipts')
      .select('*').order('id', { ascending:false }).limit(3000);
    if(error) throw error;
    CASH_ROWS = data || [];
    CASH_LOADED = true;
    renderCash();
  }catch(e){
    console.error(e);
    body.innerHTML = homeEmpty(CASH_ICONS.vault, 'تعذّر تحميل التحصيلات', 'شغّل ملف schema-cash.sql في Supabase');
  }
}

/* رأس الصفحة: العنوان والأزرار. تُستدعى من التحميل ومن كل رسم،
   حتى يتبع الرأسُ اللغةَ عند تبديلها كبقية الصفحة. */
function cashRenderHead(){
  const greet = document.getElementById('cash-greet');
  const sub   = document.getElementById('cash-sub');
  const acts  = document.getElementById('cash-actions');
  if(greet) greet.textContent = t('التحصيل النقدي');
  if(sub)   sub.textContent   = t('الكاش المستلم من العملاء');
  if(acts) acts.innerHTML =
    `<button class="hbtn ghost" onclick="cashExport()">${CASH_ICONS.excel}${t('تصدير')}</button>` +
    (cashCanWrite() ? `<button class="hbtn primary" onclick="openCashForm()">${ARC_ICONS.plus}${t('تسجيل كاش')}</button>` : '');
}

/* ══════════════════════════════════════════
   العرض
══════════════════════════════════════════ */
function cashEmployees(){
  const names = [];
  CASH_ROWS.forEach(r=>{ names.push(String(r.created_by||'').trim(), String(cashHolder(r)||'').trim()); });
  return [...new Set(names.filter(Boolean))].sort();
}
function cashFiltered(){
  const q = CASH_FILTER.q.trim().toLowerCase();
  let list = CASH_ROWS.filter(r=>{
    const k = cashStatus(r).key;
    if(CASH_FILTER.status === 'open'  && k === 'deposited')        return false;
    if(CASH_FILTER.status === 'emp'   && r.status !== 'with_employee')   return false;
    if(CASH_FILTER.status === 'acct'  && r.status !== 'with_accountant') return false;
    if(CASH_FILTER.status === 'move'  && k !== 'handover')         return false;
    if(CASH_FILTER.status === 'dep'   && k !== 'deposited')        return false;
    if(CASH_FILTER.emp && String(r.created_by||'') !== CASH_FILTER.emp) return false;
    if(q){
      const hay = [r.inv_no, r.created_by, r.deposit_no, r.note].join(' ').toLowerCase();
      if(hay.indexOf(q) < 0) return false;
    }
    return true;
  });
  const amt = r => Number(r.amount)||0;
  const day = r => String(r.receipt_date||'');
  if(CASH_FILTER.sort === 'amount')   list.sort((a,b)=> amt(b)-amt(a));
  else if(CASH_FILTER.sort === 'old') list.sort((a,b)=> day(a).localeCompare(day(b)) || (a.id||0)-(b.id||0));
  else                                list.sort((a,b)=> day(b).localeCompare(day(a)) || (b.id||0)-(a.id||0));
  return list;
}

function cashKpis(){
  const sum  = rows => rows.reduce((a,r)=>a+(Number(r.amount)||0), 0);
  const vault = CASH_ROWS.filter(cashInVault);
  const withEmp  = vault.filter(r=>cashStatus(r).key === 'with_employee');
  const withAcct = vault.filter(r=>r.status === 'with_accountant');
  const now = new Date();
  const monthKey = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  const deposited = CASH_ROWS.filter(r=> cashStatus(r).key === 'deposited'
    && String(r.deposited_at||'').slice(0,7) === monthKey);
  const depCount = new Set(deposited.map(r=>r.deposit_no).filter(Boolean)).size;
  const card = (cls, lbl, val, sub) =>
    `<div class="iv-kpi ${cls}"><span class="lbl">${t(lbl)}</span>
      <span class="val">${formatMoney(val)}<em>${t('ر.ق')}</em></span>
      <span class="sub">${sub}</span></div>`;
  return `<div class="iv-kpis">
    ${card('all','لم يُودَع بعد', sum(vault), cashCountLabel(vault.length))}
    ${card('week','مع الموظفين', sum(withEmp), cashCountLabel(withEmp.length) + ' · ' + t('بانتظار الاستلام'))}
    ${card('link','مع المحاسب', sum(withAcct), cashCountLabel(withAcct.length) + ' · ' + t('جاهزة للإيداع'))}
    ${card('paid','أُودِع هذا الشهر', sum(deposited), t('{n} إيداعًا').replace('{n}', depCount))}
  </div>`;
}
function cashCountLabel(n){
  if(!n) return t('لا إيصالات');
  if(n === 1) return t('إيصال واحد');
  if(n === 2) return t('إيصالان');
  if(n >= 3 && n <= 10) return t('{n} إيصالات').replace('{n}', n);
  return t('{n} إيصالًا').replace('{n}', n);
}

/* رصيد كل موظف: ما لم يستلمه المحاسب منه بعد */
function cashPerEmployee(){
  const map = {};
  // الحائز هو الأساس: لو سلّمها زميله وقبِلها، تنتقل إلى رصيد الزميل
  CASH_ROWS.filter(r=>r.status === 'with_employee').forEach(r=>{
    const k = String(cashHolder(r) || r.created_by || '—');
    map[k] = map[k] || { total:0, count:0 };
    map[k].total += Number(r.amount)||0;
    map[k].count += 1;
  });
  const names = cashEmployees();
  const rows = names.map(n=>({ name:n, total:(map[n]||{}).total||0, count:(map[n]||{}).count||0 }))
                    .sort((a,b)=> b.total - a.total);
  if(!rows.length) return '';
  return `<section class="h-sec">
    <div class="h-sec-hd"><b>${t('رصيد كل موظف')}</b><span>${t('ما لم يُسلَّم للمحاسب بعد')}</span>
      <em class="h-count">${formatMoney(rows.reduce((a,r)=>a+r.total,0))} ${t('ر.ق')}</em></div>
    <div class="cash-emps">${rows.map(r=>`
      <div class="cash-emp${r.total?'':' zero'}">
        ${personAvatar(r.name)}
        <div class="cash-emp-b"><b>${escapeHtml(personName(r.name))}</b>
          <span>${r.count ? cashCountLabel(r.count) : t('لا شيء بعهدته')}</span></div>
        <span class="cash-emp-v">${formatMoney(r.total)} <em>${t('ر.ق')}</em></span>
      </div>`).join('')}</div>
  </section>`;
}

function cashToolbar(){
  const sel = (id, val, opts) =>
    `<select class="arc-sel-f" id="${id}" onchange="cashSetFilter('${id}', this.value)">` +
    opts.map(o=>`<option value="${escAttr(o[0])}"${o[0]===val?' selected':''}>${escapeHtml(t(o[1]))}</option>`).join('') +
    '</select>';
  return `<div class="iv-tools">
    <input class="grow" type="search" id="cash-q" value="${escAttr(CASH_FILTER.q)}"
      oninput="cashSetFilter('cash-q', this.value)"
      placeholder="${escAttr(t('بحث برقم الفاتورة أو الموظف'))}">
    ${sel('cash-emp', CASH_FILTER.emp, [['','كل الموظفين']].concat(cashEmployees().map(n=>[n, personName(n)])))}
    ${sel('cash-status', CASH_FILTER.status,
      [['open','لم يُودَع'],['all','الكل'],['emp','مع الموظفين'],['acct','مع المحاسب'],
       ['move','قيد التسليم'],['dep','مودعة']])}
    ${sel('cash-sort', CASH_FILTER.sort, [['new','ترتيب: الأحدث'],['old','الأقدم'],['amount','الأعلى مبلغًا']])}
  </div>`;
}

function cashRow(row){
  const st  = cashStatus(row);
  const sel = CASH_SEL.has(row.id);
  const pickable = cashRowPickable(row);
  const box = CASH_MODE
    ? (pickable
        ? `<input type="checkbox" ${sel?'checked':''} onclick="event.stopPropagation();cashToggle(${row.id})">`
        : '<span class="ck-slot"></span>')
    : '<span class="ck-slot"></span>';
  const act = (!CASH_MODE && cashCanEdit(row))
    ? `<button class="hbtn sm ghost" onclick="event.stopPropagation();openCashForm(${row.id})">${t('تعديل')}</button>`
    : '';
  const click = CASH_MODE && pickable ? `cashToggle(${row.id})` : `cashOpen(${row.id})`;
  return `<div class="cashrow${sel?' sel':''}${st.key==='deposited'?' done':''}"
      role="button" tabindex="0" onclick="${click}"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${click}}">
    ${box}
    <span class="cash-no">${escapeHtml(row.inv_no||'—')}</span>
    <div class="cash-who">${personAvatar(row.created_by)}
      <div class="cash-who-b"><b>${escapeHtml(personName(row.created_by||'—'))}</b>
        <span>${escapeHtml(row.note || t('استلام نقدي من عميل'))}</span></div></div>
    <span class="cash-dt">${cashFmtDate(row.receipt_date)}<i>${escapeHtml(cashAgeNote(row.receipt_date))}</i></span>
    <span class="cash-amt">${formatMoney(row.amount)} <em>${t('ر.ق')}</em></span>
    <span class="cash-st"><span class="arc-status ${st.cls}"><i></i>${t(st.label)}</span>
      ${row.deposit_no ? `<span class="lk">${escapeHtml(row.deposit_no)}</span>`
        : st.key==='handover' ? `<span class="lk">${t('إلى')} ${escapeHtml(personName(row.handover_to||''))}</span>`
        : (st.key==='with_accountant' && cashHolder(row) ? `<span class="lk">${escapeHtml(personName(cashHolder(row)))}</span>` : '')}</span>
    <span class="cash-act">${act}</span>
  </div>`;
}
// الصف قابل للتحديد حسب الوضع: الاستلام لما مع الموظف، والإيداع لما مع المحاسب
function cashRowPickable(row){
  if(CASH_MODE === 'receive') return cashStatus(row).key === 'with_employee';
  if(CASH_MODE === 'deposit'){
    return row.status === 'with_accountant' && !cashPending(row)
        && cashHolder(row) === (CURRENT && CURRENT.name);
  }
  // النقل: ما بعهدتي في مرحلتي، ولا شيء قيد النقل
  if(CASH_MODE === 'handover'){
    return row.status === cashMyStage() && !cashPending(row)
        && cashHolder(row) === (CURRENT && CURRENT.name);
  }
  return false;
}
// ما بعهدتي الآن — مرحلتي حسب دوري
function cashMyStage(){
  return (CURRENT && CURRENT.role === 'accountant') ? 'with_accountant' : 'with_employee';
}
function cashMine(){
  return CASH_ROWS.filter(r=> r.status === cashMyStage() && !cashPending(r)
    && cashHolder(r) === (CURRENT && CURRENT.name));
}
// طلبات نقل واردة إليّ بانتظار قبولي
function cashIncoming(){
  return CASH_ROWS.filter(r=> cashPending(r) && r.handover_to === (CURRENT && CURRENT.name));
}

function renderCash(){
  const body = document.getElementById('cash-body');
  if(!body) return;
  cashRenderHead();
  const list = cashFiltered();
  const inner = list.length
    ? list.map(cashRow).join('')
    : homeEmpty(CASH_ICONS.vault, 'لا توجد إيصالات بهذا الفلتر',
        CASH_ROWS.length ? 'غيّر الفلتر أو البحث' : 'ابدأ بتسجيل أول استلام');

  const shown = list.filter(cashInVault).reduce((a,r)=>a+(Number(r.amount)||0), 0);
  const picked = CASH_ROWS.filter(r=>CASH_SEL.has(r.id));
  const pickedSum = picked.reduce((a,r)=>a+(Number(r.amount)||0), 0);

  let bar = '';
  if(CASH_MODE){
    const act = CASH_MODE === 'receive'
      ? { fn:'cashConfirmReceive()', icon:CASH_ICONS.check, label:'استلام الكاش' }
      : CASH_MODE === 'handover'
        ? { fn:'openHandoverForm()', icon:CASH_ICONS.move, label:'تسليم العهدة' }
        : { fn:'openDepositForm()',  icon:CASH_ICONS.bank, label:'إيداع في البنك' };
    bar = `<div class="cash-selbar">
      <span>${t('المحدّد:')} ${cashCountLabel(picked.length)}</span>
      <b>${formatMoney(pickedSum)} ${t('ر.ق')}</b>
      <button class="hbtn ghost" onclick="cashExitMode()">${t('إلغاء')}</button>
      <button class="hbtn primary" ${picked.length?'':'disabled style="opacity:.55;cursor:default"'}
        onclick="${act.fn}">${act.icon}${t(act.label)}</button>
    </div>`;
  } else if(list.length){
    bar = `<div class="h-paybar"><span>${t('لم يُودَع بعد')}</span>
      <b>${formatMoney(shown)} ${t('ر.ق')}</b>${cashModeButtons()}</div>`;
  }

  body.innerHTML = cashIncomingPanel() + cashKpis() + cashPerEmployee()
    + `<section class="h-sec">${cashToolbar()}${inner}${bar}</section>`;
  if(typeof translateStaticNodes === 'function') translateStaticNodes();
}
function cashModeButtons(){
  if(!cashCanWrite()) return '';
  const mine  = cashMine().length;
  const peers = cashPeers().length;
  const emp   = CASH_ROWS.filter(r=>cashStatus(r).key === 'with_employee').length;
  let out = '';
  if(cashIsAccountant() && emp)
    out += `<button class="hbtn ghost" onclick="cashEnterMode('receive')">${CASH_ICONS.check}${t('استلام من الموظفين')}</button>`;
  if(mine && peers)
    out += `<button class="hbtn ghost" onclick="cashEnterMode('handover')">${CASH_ICONS.move}${t('تسليم لزميل')}</button>`;
  if(cashIsAccountant() && mine)
    out += `<button class="hbtn primary" onclick="cashEnterMode('deposit')">${CASH_ICONS.bank}${t('إيداع في البنك')}</button>`;
  return out;
}

function cashSetFilter(id, value){
  if(id === 'cash-q')      CASH_FILTER.q = value;
  if(id === 'cash-emp')    CASH_FILTER.emp = value;
  if(id === 'cash-status') CASH_FILTER.status = value;
  if(id === 'cash-sort')   CASH_FILTER.sort = value;
  renderCash();
  if(id === 'cash-q'){
    const el = document.getElementById('cash-q');
    if(el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }
}
function cashEnterMode(mode){
  // التسليم لأي زميل يحوز نقدية؛ الاستلام والإيداع للمحاسب وحده
  if(mode === 'handover'){ if(!cashCanWrite()) return; }
  else if(!cashIsAccountant()) return;
  CASH_MODE = mode; CASH_SEL.clear();
  CASH_FILTER.status = (mode === 'receive') ? 'emp'
                     : (mode === 'handover') ? (cashMyStage() === 'with_employee' ? 'emp' : 'acct')
                     : 'acct';
  CASH_FILTER.emp = '';
  renderCash();
}
function cashExitMode(){ CASH_MODE = null; CASH_SEL.clear(); renderCash(); }
function cashToggle(id){
  const row = CASH_ROWS.find(r=>r.id===id);
  if(!row || !cashRowPickable(row)) return;
  if(CASH_SEL.has(id)) CASH_SEL.delete(id); else CASH_SEL.add(id);
  renderCash();
}

/* ── تفاصيل الإيصال ── */
function cashOpen(id){
  const row = CASH_ROWS.find(r=>r.id===id);
  if(!row) return;
  const st = cashStatus(row);
  const details = [
    { label:t('رقم فاتورة العميل'), value: row.inv_no || '—', ltr:true },
    { label:t('المبلغ'),            value: formatMoney(row.amount) + ' ' + t('ر.ق'), ltr:true },
    { label:t('تاريخ الاستلام'),    value: cashFmtDate(row.receipt_date), ltr:true },
    { label:t('الموظف'),            value: personName(row.created_by||'—') },
    { label:t('الحالة'),            value: t(st.label) }
  ];
  if(row.received_by) details.push({ label:t('استلمه'), value: personName(row.received_by) });
  if(row.deposit_no){
    details.push({ label:t('رقم الإيداع'), value: row.deposit_no, ltr:true });
    if(row.deposit_bank) details.push({ label:t('البنك'), value: row.deposit_bank });
  }
  if(row.note) details.push({ label:t('ملاحظة'), value: row.note });
  showMessageDialog({
    title: row.inv_no || t('تفاصيل الإيصال'),
    subtitle: 'Cash Receipt', message: '', details, confirmText: t('حسنًا')
  });
}

/* ══════════════════════════════════════════
   تسجيل / تعديل إيصال
══════════════════════════════════════════ */
let CASH_FORM = null;

function openCashForm(id){
  if(!cashCanWrite()){
    showMessageDialog({ title:t('صلاحية العرض فقط'),
      message:t('حسابك مخصّص للعرض والطباعة فقط، ولا يمكنك تسجيل الكاش.'), confirmText:t('حسنًا') });
    return;
  }
  const row = id ? CASH_ROWS.find(r=>r.id===id) : null;
  if(id && !cashCanEdit(row)){
    showMessageDialog({ title:t('لا يمكن التعديل'),
      message:t('استلم المحاسب هذا الإيصال، أو سجّله موظف آخر.'), confirmText:t('حسنًا') });
    return;
  }
  CASH_FORM = { id: row ? row.id : null };
  const old = document.getElementById('app-confirm-overlay');
  if(old) old.remove();
  const ov = document.createElement('div');
  ov.id = 'app-confirm-overlay'; ov.dir = 'rtl';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,19,33,.55);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);overflow:auto;';
  ov.innerHTML = `
    <div class="acd-card" role="dialog" aria-modal="true" style="width:min(520px,100%);max-height:92vh;display:flex;flex-direction:column">
      <div class="acd-head iv-head">
        <div>
          <div class="acd-title" data-i18n="${row ? 'تعديل إيصال كاش' : 'تسجيل كاش مستلم'}">${row ? t('تعديل إيصال كاش') : t('تسجيل كاش مستلم')}</div>
          <div class="acd-cap">Cash Receipt</div>
        </div>
        <span class="iv-mark"><img src="assets/images/image-5fa147e6c3d5.png" alt="Zamzam"></span>
      </div>
      <div class="acd-body" style="overflow:auto">
        <div class="qf-grid">
          <div class="sec-title full"><span class="ar" data-i18n="بيانات الاستلام">${t('بيانات الاستلام')}</span><span class="en">Receipt Details</span></div>
          <div class="qf-f">
            <label><span class="ar" data-i18n="رقم فاتورة العميل">${t('رقم فاتورة العميل')}</span><span class="en">Client Invoice No.</span> <em class="req">*</em></label>
            <input type="text" id="cash-inv" class="ltr" value="${escAttr(row?row.inv_no:'')}" placeholder="INV_2026_0000"
              data-i18n-attr="placeholder|INV_2026_0000">
          </div>
          <div class="qf-f">
            <label><span class="ar" data-i18n="المبلغ (ر.ق)">${t('المبلغ (ر.ق)')}</span><span class="en">Amount QAR</span> <em class="req">*</em></label>
            <input type="text" id="cash-amt" class="ltr" inputmode="decimal" style="font-weight:700"
              value="${row?formatMoney(row.amount):''}" oninput="cashFmtField(this)" placeholder="0.00">
          </div>
          <div class="qf-f full">
            <label><span class="ar" data-i18n="تاريخ الاستلام">${t('تاريخ الاستلام')}</span><span class="en">Date</span></label>
            <input type="date" id="cash-date" value="${escAttr(row?(String(row.receipt_date||'').slice(0,10)):TODAY)}">
          </div>
          <div class="qf-f full">
            <label><span class="ar" data-i18n="ملاحظة">${t('ملاحظة')}</span><span class="en">Note</span></label>
            <input type="text" id="cash-note" value="${escAttr(row?(row.note||''):'')}"
              placeholder="${escAttr(t('اختياري'))}" data-i18n-attr="placeholder|اختياري">
          </div>
          <div class="qf-err" id="cash-err" style="display:none"></div>
        </div>
      </div>
      <div class="acd-foot">
        <button class="acd-btn acd-cancel" onclick="cashCloseForm()" data-i18n="رجوع">${t('رجوع')}</button>
        ${row ? `<button class="acd-btn" style="background:var(--n0);border:1px solid var(--stop-line);color:var(--stop)" onclick="cashDelete(${row.id})" data-i18n="حذف">${t('حذف')}</button>` : ''}
        <button class="acd-btn acd-confirm" id="cash-save" onclick="saveCashReceipt()" data-i18n="حفظ">${t('حفظ')}</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e=>{ if(e.target === ov) cashCloseForm(); });
  document.getElementById('cash-inv')?.focus();
}
function cashCloseForm(){ document.getElementById('app-confirm-overlay')?.remove(); CASH_FORM = null; }
function cashFmtField(el){
  const pos = el.selectionStart, oldLen = el.value.length;
  el.value = fmtAmt(el.value);
  const np = Math.max(0, pos + (el.value.length - oldLen));
  el.setSelectionRange(np, np);
}
function cashShowErr(msg){
  const box = document.getElementById('cash-err');
  if(!box) return;
  box.textContent = msg;
  box.style.display = msg ? 'block' : 'none';
}

async function saveCashReceipt(){
  if(!CASH_FORM) return;
  const invNo  = (document.getElementById('cash-inv')?.value || '').trim();
  const amount = parseAmt(document.getElementById('cash-amt')?.value || 0);
  const date   = document.getElementById('cash-date')?.value || TODAY;
  const note   = (document.getElementById('cash-note')?.value || '').trim();

  const miss = [];
  if(!invNo) miss.push(t('رقم فاتورة العميل'));
  if(!(amount > 0)) miss.push(t('المبلغ'));
  if(miss.length){ cashShowErr(t('ناقص: ') + miss.join('، ')); return; }
  cashShowErr('');

  const btn = document.getElementById('cash-save');
  if(btn){ btn.disabled = true; btn.textContent = t('جاري الحفظ...'); }
  try{
    const rec = { inv_no:invNo, amount, receipt_date:date, note: note || null,
                  updated_at: new Date().toISOString() };
    let res;
    if(CASH_FORM.id){
      res = await sb.from('cash_receipts').update(rec).eq('id', CASH_FORM.id);
    }else{
      rec.created_by = CURRENT?.name || null;
      rec.status = 'with_employee';
      res = await sb.from('cash_receipts').insert(rec);
    }
    if(res && res.error){
      console.error(res.error);
      cashShowErr(t('تعذّر الحفظ — ') + (res.error.message || ''));
      if(btn){ btn.disabled = false; btn.textContent = t('حفظ'); }
      return;
    }
    const wasEdit = !!CASH_FORM.id;
    cashCloseForm();
    await loadCash();
    showMessageDialog({
      title: wasEdit ? t('تم تحديث الإيصال') : t('تم تسجيل الكاش'),
      subtitle:'Cash Receipt', message:'',
      details:[
        { label:t('رقم فاتورة العميل'), value:invNo, ltr:true },
        { label:t('المبلغ'), value: formatMoney(amount) + ' ' + t('ر.ق'), ltr:true }
      ],
      confirmText:t('حسنًا')
    });
  }catch(e){
    console.error(e);
    cashShowErr(t('خطأ اتصال — حاول مرة أخرى.'));
    if(btn){ btn.disabled = false; btn.textContent = t('حفظ'); }
  }
}

async function cashDelete(id){
  const row = CASH_ROWS.find(r=>r.id===id);
  if(!row || !cashCanEdit(row)) return;
  cashCloseForm();
  const ok = await showConfirmDialog({
    title: t('حذف الإيصال'),
    message: t('يُحذف الإيصال نهائيًا ويخرج من التحصيلات. لا يمكن حذفه بعد استلام المحاسب له.'),
    confirmText: t('حذف'), danger: true
  });
  if(!ok) return;
  const { error } = await sb.from('cash_receipts').delete().eq('id', id);
  if(error){
    console.error(error);
    showMessageDialog({ title:t('تعذّر الحذف'), message:error.message||'', confirmText:t('حسنًا') });
    return;
  }
  loadCash();
}

/* ══════════════════════════════════════════
   استلام المحاسب
══════════════════════════════════════════ */
async function cashConfirmReceive(){
  const picked = CASH_ROWS.filter(r=>CASH_SEL.has(r.id) && cashStatus(r).key === 'with_employee');
  if(!picked.length) return;
  const total = picked.reduce((a,r)=>a+(Number(r.amount)||0), 0);
  const names = [...new Set(picked.map(r=>personName(r.created_by||'')))].join('، ');
  const ok = await showConfirmDialog({
    title: t('تأكيد استلام الكاش'),
    message: t('يُسجَّل استلامك للمبلغ، ويصل إشعار لكل موظف سلّمك، وللإدارة.'),
    details: [
      { label:t('عدد الإيصالات'), value: cashCountLabel(picked.length) },
      { label:t('الإجمالي'), value: formatMoney(total) + ' ' + t('ر.ق'), ltr:true },
      { label:t('من'), value: names }
    ],
    confirmText: t('استلام')
  });
  if(!ok) return;
  const { error } = await sb.from('cash_receipts').update({
    status:'with_accountant',
    received_by: CURRENT?.name || null,
    received_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).in('id', picked.map(r=>r.id));
  if(error){
    console.error(error);
    showMessageDialog({ title:t('تعذّر الاستلام'), message:error.message||'', confirmText:t('حسنًا') });
    return;
  }
  cashExitMode();
  await loadCash();
  showMessageDialog({ title:t('تم استلام الكاش'), subtitle:'Cash Received', message:'',
    details:[{ label:t('الإجمالي'), value: formatMoney(total) + ' ' + t('ر.ق'), ltr:true }],
    confirmText:t('حسنًا') });
}

/* ══════════════════════════════════════════
   الإيداع في البنك
══════════════════════════════════════════ */
let DEP_FORM = null;

function openDepositForm(){
  const picked = CASH_ROWS.filter(r=>CASH_SEL.has(r.id) && cashStatus(r).key === 'with_accountant');
  if(!picked.length) return;
  DEP_FORM = { ids: picked.map(r=>r.id), file:null };
  const total = picked.reduce((a,r)=>a+(Number(r.amount)||0), 0);
  const old = document.getElementById('app-confirm-overlay');
  if(old) old.remove();
  const ov = document.createElement('div');
  ov.id = 'app-confirm-overlay'; ov.dir = 'rtl';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,19,33,.55);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);overflow:auto;';
  ov.innerHTML = `
    <div class="acd-card" role="dialog" aria-modal="true" style="width:min(580px,100%);max-height:92vh;display:flex;flex-direction:column">
      <div class="acd-head iv-head">
        <div><div class="acd-title" data-i18n="إيداع في البنك">${t('إيداع في البنك')}</div>
        <div class="acd-cap">Bank Deposit</div></div>
        <span class="iv-mark"><img src="assets/images/image-5fa147e6c3d5.png" alt="Zamzam"></span>
      </div>
      <div class="acd-body" style="overflow:auto">
        <div class="qf-grid">
          <div class="sec-title full"><span class="ar" data-i18n="الإيصالات المودعة">${t('الإيصالات المودعة')}</span><span class="en">Receipts</span></div>
          <div class="qf-f full" style="gap:0">
            <div class="dep-list">${picked.map(r=>`
              <div class="pk-row"><span style="width:0"></span>
                <span class="pk-no">${escapeHtml(r.inv_no||'—')}</span>
                <div class="pk-main"><b>${escapeHtml(personName(r.created_by||'—'))}</b>
                  <span>${cashFmtDate(r.receipt_date)}</span></div>
                <span class="pk-cc"></span>
                <span class="pk-amt">${formatMoney(r.amount)} <em>${t('ر.ق')}</em></span>
              </div>`).join('')}</div>
            <div class="pk-sum"><span data-i18n="إجمالي الإيداع">${t('إجمالي الإيداع')}</span><b>${formatMoney(total)} ${t('ر.ق')}</b></div>
          </div>
          <div class="sec-title full"><span class="ar" data-i18n="بيانات الإيداع">${t('بيانات الإيداع')}</span><span class="en">Deposit</span></div>
          <div class="qf-f">
            <label><span class="ar" data-i18n="تاريخ الإيداع">${t('تاريخ الإيداع')}</span><span class="en">Date</span></label>
            <input type="date" id="dep-date" value="${TODAY}">
          </div>
          <div class="qf-f">
            <label><span class="ar" data-i18n="البنك / الحساب">${t('البنك / الحساب')}</span><span class="en">Bank</span></label>
            <input type="text" id="dep-bank" placeholder="${escAttr(t('مثال: QNB — 1234'))}" data-i18n-attr="placeholder|مثال: QNB — 1234">
          </div>
          <div class="attach-zone iv-drop full" id="dep-drop" role="button" tabindex="0"
            onclick="document.getElementById('dep-file').click()"
            onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();document.getElementById('dep-file').click()}">
            <div class="big">${CASH_ICONS.clip}<span id="dep-drop-txt" data-i18n="صورة إيصال الإيداع — مطلوبة">${t('صورة إيصال الإيداع — مطلوبة')}</span></div>
          </div>
          <input type="file" id="dep-file" accept="application/pdf,image/*" style="display:none" onchange="depFilePicked(this)">
          <div class="qf-err" id="dep-err" style="display:none"></div>
        </div>
      </div>
      <div class="acd-foot">
        <button class="acd-btn acd-cancel" onclick="depClose()" data-i18n="رجوع">${t('رجوع')}</button>
        <button class="acd-btn acd-confirm" id="dep-save" onclick="saveDeposit()" data-i18n="تأكيد الإيداع">${t('تأكيد الإيداع')}</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e=>{ if(e.target === ov) depClose(); });
}
function depClose(){ document.getElementById('app-confirm-overlay')?.remove(); DEP_FORM = null; }
function depFilePicked(input){
  const f = input.files && input.files[0];
  if(!DEP_FORM) return;
  DEP_FORM.file = f || null;
  const txt = document.getElementById('dep-drop-txt');
  const drop = document.getElementById('dep-drop');
  if(txt){
    if(f){ txt.removeAttribute('data-i18n'); txt.textContent = f.name; }
    else { txt.setAttribute('data-i18n','صورة إيصال الإيداع — مطلوبة'); txt.textContent = t('صورة إيصال الإيداع — مطلوبة'); }
  }
  if(drop) drop.classList.toggle('has', !!f);
}
function depShowErr(msg){
  const box = document.getElementById('dep-err');
  if(!box) return;
  box.textContent = msg; box.style.display = msg ? 'block' : 'none';
}

/* رقم الإيداع التالي: DEP-0001 */
function nextDepositNo(){
  let max = 0;
  CASH_ROWS.forEach(r=>{
    const m = String(r.deposit_no||'').match(/^DEP-(\d+)$/i);
    if(m) max = Math.max(max, parseInt(m[1], 10) || 0);
  });
  return 'DEP-' + String(max + 1).padStart(4, '0');
}

async function saveDeposit(){
  if(!DEP_FORM) return;
  if(!DEP_FORM.file){ depShowErr(t('صورة إيصال الإيداع مطلوبة قبل التأكيد.')); return; }
  const bank = (document.getElementById('dep-bank')?.value || '').trim();
  const date = document.getElementById('dep-date')?.value || TODAY;
  depShowErr('');
  const btn = document.getElementById('dep-save');
  if(btn){ btn.disabled = true; btn.textContent = t('جاري الحفظ...'); }
  try{
    const paths = await uploadAttachments([DEP_FORM.file], 'cash-deposits');
    const depNo = nextDepositNo();
    const { error } = await sb.from('cash_receipts').update({
      status:'deposited',
      deposit_no: depNo,
      deposit_bank: bank || null,
      deposit_image: paths[0] || null,
      deposited_by: CURRENT?.name || null,
      deposited_at: new Date(date + 'T12:00:00').toISOString(),
      updated_at: new Date().toISOString()
    }).in('id', DEP_FORM.ids);
    if(error){
      console.error(error);
      depShowErr(t('تعذّر الحفظ — ') + (error.message || ''));
      if(btn){ btn.disabled = false; btn.textContent = t('تأكيد الإيداع'); }
      return;
    }
    const total = CASH_ROWS.filter(r=>DEP_FORM.ids.includes(r.id))
      .reduce((a,r)=>a+(Number(r.amount)||0), 0);
    depClose();
    cashExitMode();
    await loadCash();
    showMessageDialog({
      title: t('تم الإيداع'), subtitle:'Bank Deposit', message:'',
      details:[
        { label:t('رقم الإيداع'), value: depNo, ltr:true },
        { label:t('الإجمالي'), value: formatMoney(total) + ' ' + t('ر.ق'), ltr:true },
        ...(bank ? [{ label:t('البنك'), value: bank }] : [])
      ],
      confirmText:t('حسنًا')
    });
  }catch(e){
    console.error(e);
    depShowErr(t('تعذّر رفع صورة الإيداع — حاول مرة أخرى.'));
    if(btn){ btn.disabled = false; btn.textContent = t('تأكيد الإيداع'); }
  }
}

/* ══════════════════════════════════════════
   تسليم العهدة بين الزملاء
   المال لا ينتقل إلا بقبول المستلِم. الرفض يُعيده كما كان.
══════════════════════════════════════════ */
let HO_FORM = null;

function nextHandoverNo(){
  let max = 0;
  CASH_ROWS.forEach(r=>{
    const m = String(r.handover_no||'').match(/^HO-(\d+)$/i);
    if(m) max = Math.max(max, parseInt(m[1], 10) || 0);
  });
  return 'HO-' + String(max + 1).padStart(4, '0');
}

function openHandoverForm(){
  const picked = CASH_ROWS.filter(r=>CASH_SEL.has(r.id) && cashRowPickable(r));
  if(!picked.length) return;
  const others = cashPeers();
  if(!others.length){
    showMessageDialog({ title:t('لا يوجد زميل آخر'),
      message:t('التسليم يحتاج زميلًا آخر بنفس الدور.'), confirmText:t('حسنًا') });
    return;
  }
  HO_FORM = { ids: picked.map(r=>r.id) };
  const total = picked.reduce((a,r)=>a+(Number(r.amount)||0), 0);
  const old = document.getElementById('app-confirm-overlay');
  if(old) old.remove();
  const ov = document.createElement('div');
  ov.id = 'app-confirm-overlay'; ov.dir = 'rtl';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,19,33,.55);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);overflow:auto;';
  ov.innerHTML = `
    <div class="acd-card" role="dialog" aria-modal="true" style="width:min(560px,100%);max-height:92vh;display:flex;flex-direction:column">
      <div class="acd-head iv-head">
        <div><div class="acd-title" data-i18n="تسليم العهدة">${t('تسليم العهدة')}</div>
        <div class="acd-cap">Cash Handover</div></div>
        <span class="iv-mark"><img src="assets/images/image-5fa147e6c3d5.png" alt="Zamzam"></span>
      </div>
      <div class="acd-body" style="overflow:auto">
        <div class="qf-grid">
          <div class="sec-title full"><span class="ar" data-i18n="الإيصالات المسلَّمة">${t('الإيصالات المسلَّمة')}</span><span class="en">Receipts</span></div>
          <div class="qf-f full" style="gap:0">
            <div class="dep-list">${picked.map(r=>`
              <div class="pk-row"><span style="width:0"></span>
                <span class="pk-no">${escapeHtml(r.inv_no||'—')}</span>
                <div class="pk-main"><b>${escapeHtml(personName(r.created_by||'—'))}</b>
                  <span>${cashFmtDate(r.receipt_date)}</span></div>
                <span class="pk-cc"></span>
                <span class="pk-amt">${formatMoney(r.amount)} <em>${t('ر.ق')}</em></span>
              </div>`).join('')}</div>
            <div class="pk-sum"><span data-i18n="إجمالي التسليم">${t('إجمالي التسليم')}</span><b>${formatMoney(total)} ${t('ر.ق')}</b></div>
          </div>
          <div class="sec-title full"><span class="ar" data-i18n="المستلِم">${t('المستلِم')}</span><span class="en">Recipient</span></div>
          <div class="qf-f full">
            <label><span class="ar" data-i18n="الزميل المستلِم">${t('الزميل المستلِم')}</span><span class="en">Accountant</span> <em class="req">*</em></label>
            <select id="ho-to">${others.map(n=>`<option value="${escAttr(n)}">${escapeHtml(personName(n))}</option>`).join('')}</select>
          </div>
          <div class="qf-f full">
            <label><span class="ar" data-i18n="ملاحظة">${t('ملاحظة')}</span><span class="en">Note</span></label>
            <input type="text" id="ho-note" placeholder="${escAttr(t('اختياري'))}" data-i18n-attr="placeholder|اختياري">
          </div>
          <div class="qf-err" id="ho-err" style="display:none"></div>
          <p class="opt-hint full" data-i18n="لا تنتقل العهدة إلا بعد قبول المستلِم. حتى ذلك الحين تبقى باسمك.">${t('لا تنتقل العهدة إلا بعد قبول المستلِم. حتى ذلك الحين تبقى باسمك.')}</p>
        </div>
      </div>
      <div class="acd-foot">
        <button class="acd-btn acd-cancel" onclick="hoClose()" data-i18n="رجوع">${t('رجوع')}</button>
        <button class="acd-btn acd-confirm" id="ho-save" onclick="sendHandover()" data-i18n="إرسال الطلب">${t('إرسال الطلب')}</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e=>{ if(e.target === ov) hoClose(); });
}
function hoClose(){ document.getElementById('app-confirm-overlay')?.remove(); HO_FORM = null; }

async function sendHandover(){
  if(!HO_FORM) return;
  const to = document.getElementById('ho-to')?.value || '';
  const note = (document.getElementById('ho-note')?.value || '').trim();
  if(!to){ const e=document.getElementById('ho-err'); if(e){ e.textContent=t('اختر الزميل المستلِم.'); e.style.display='block'; } return; }
  const btn = document.getElementById('ho-save');
  if(btn){ btn.disabled = true; btn.textContent = t('جاري الإرسال...'); }
  try{
    const no = nextHandoverNo();
    const { error } = await sb.from('cash_receipts').update({
      handover_no: no, handover_to: to,
      handover_by: CURRENT?.name || null,
      handover_at: new Date().toISOString(),
      handover_state: 'pending',
      handover_note: note || null,
      updated_at: new Date().toISOString()
    }).in('id', HO_FORM.ids);
    if(error){
      console.error(error);
      const e=document.getElementById('ho-err'); if(e){ e.textContent=t('تعذّر الإرسال — ') + (error.message||''); e.style.display='block'; }
      if(btn){ btn.disabled = false; btn.textContent = t('إرسال الطلب'); }
      return;
    }
    const total = CASH_ROWS.filter(r=>HO_FORM.ids.includes(r.id)).reduce((a,r)=>a+(Number(r.amount)||0), 0);
    hoClose(); cashExitMode(); await loadCash();
    showMessageDialog({ title:t('أُرسل طلب التسليم'), subtitle:'Cash Handover', message:'',
      details:[
        { label:t('رقم التسليم'), value:no, ltr:true },
        { label:t('إلى'), value: personName(to) },
        { label:t('الإجمالي'), value: formatMoney(total) + ' ' + t('ر.ق'), ltr:true }
      ],
      note: t('تبقى العهدة باسمك حتى يقبلها المستلِم.'),
      confirmText:t('حسنًا') });
  }catch(e){
    console.error(e);
    const el=document.getElementById('ho-err'); if(el){ el.textContent=t('خطأ اتصال — حاول مرة أخرى.'); el.style.display='block'; }
    if(btn){ btn.disabled = false; btn.textContent = t('إرسال الطلب'); }
  }
}

/* لوحة الطلبات الواردة: تظهر للمحاسب المستلِم فقط */
function cashIncomingPanel(){
  const rows = cashIncoming();
  if(!rows.length) return '';
  const groups = {};
  rows.forEach(r=>{ const k = r.handover_no || '—'; (groups[k] = groups[k] || []).push(r); });
  return Object.keys(groups).map(no=>{
    const g = groups[no];
    const total = g.reduce((a,r)=>a+(Number(r.amount)||0), 0);
    const from = personName(g[0].handover_by || '');
    const note = g[0].handover_note ? ` · ${escapeHtml(g[0].handover_note)}` : '';
    return `<section class="h-sec ho-in">
      <div class="h-sec-hd"><b>${t('تسليم عهدة بانتظار قبولك')}</b>
        <span>${escapeHtml(no)} · ${t('من')} ${escapeHtml(from)}${note}</span>
        <em class="h-count">${formatMoney(total)} ${t('ر.ق')}</em></div>
      <div class="ho-body">
        <div class="ho-sum">${cashCountLabel(g.length)} · <b>${formatMoney(total)} ${t('ر.ق')}</b></div>
        <div class="ho-acts">
          <button class="hbtn ghost" onclick="rejectHandover('${escAttr(no)}')">${t('رفض')}</button>
          <button class="hbtn primary" onclick="acceptHandover('${escAttr(no)}')">${CASH_ICONS.check}${t('قبول الاستلام')}</button>
        </div>
      </div>
    </section>`;
  }).join('');
}

async function acceptHandover(no){
  const rows = cashIncoming().filter(r=>String(r.handover_no||'') === no);
  if(!rows.length) return;
  const total = rows.reduce((a,r)=>a+(Number(r.amount)||0), 0);
  const from = personName(rows[0].handover_by || '');
  const ok = await showConfirmDialog({
    title: t('قبول استلام العهدة'),
    message: t('بقبولك تنتقل النقدية إلى عهدتك، ويصل إشعار للزميل المرسِل وللإدارة.'),
    details:[
      { label:t('رقم التسليم'), value:no, ltr:true },
      { label:t('من'), value:from },
      { label:t('الإجمالي'), value: formatMoney(total) + ' ' + t('ر.ق'), ltr:true }
    ],
    confirmText: t('قبول')
  });
  if(!ok) return;
  const { error } = await sb.from('cash_receipts').update({
    held_by: CURRENT?.name || null,
    handover_state: null,
    handover_done_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).in('id', rows.map(r=>r.id));
  if(error){
    console.error(error);
    showMessageDialog({ title:t('تعذّر القبول'), message:error.message||'', confirmText:t('حسنًا') });
    return;
  }
  await loadCash();
  showMessageDialog({ title:t('تم استلام العهدة'), subtitle:'Cash Handover', message:'',
    details:[{ label:t('الإجمالي'), value: formatMoney(total) + ' ' + t('ر.ق'), ltr:true }],
    confirmText:t('حسنًا') });
}

async function rejectHandover(no){
  const rows = cashIncoming().filter(r=>String(r.handover_no||'') === no);
  if(!rows.length) return;
  const from = personName(rows[0].handover_by || '');
  const ok = await showConfirmDialog({
    title: t('رفض التسليم'),
    message: t('تبقى النقدية في عهدة المرسِل كما هي، ويصله إشعار بالرفض.'),
    details:[{ label:t('من'), value:from }],
    confirmText: t('رفض'), danger: true
  });
  if(!ok) return;
  const { error } = await sb.from('cash_receipts').update({
    handover_state: null, handover_to: null,
    handover_done_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).in('id', rows.map(r=>r.id));
  if(error){
    console.error(error);
    showMessageDialog({ title:t('تعذّر الرفض'), message:error.message||'', confirmText:t('حسنًا') });
    return;
  }
  await loadCash();
}

/* ── تصدير ── */
function cashExport(){
  const list = cashFiltered();
  if(!list.length){
    showMessageDialog({ title:t('لا توجد بيانات للتصدير'), message:'', confirmText:t('حسنًا') });
    return;
  }
  const head = ['رقم فاتورة العميل','المبلغ','تاريخ الاستلام','الموظف','الحالة',
                'استلمه','رقم الإيداع','البنك','تاريخ الإيداع','ملاحظة'].map(t);
  const rows = list.map(r=>[
    r.inv_no, Number(r.amount)||0, r.receipt_date||'', personName(r.created_by||''),
    t(cashStatus(r).label), personName(r.received_by||''), r.deposit_no||'',
    r.deposit_bank||'', String(r.deposited_at||'').slice(0,10), r.note||''
  ]);
  const esc = v => '"' + String(v==null?'':v).replace(/"/g,'""') + '"';
  const csv = '﻿' + [head, ...rows].map(r=>r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'cash-vault-' + TODAY + '.csv';
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
