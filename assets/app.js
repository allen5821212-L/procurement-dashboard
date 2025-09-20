// v3.1: Personal Plan editor per buyer-week (category, target, actual, rate). Saves to localStorage, export CSV.
const DEFAULT_CONFIG = { rateGreen: 1.0, rateYellow: 0.95, ontimeGreen: 0.95, ontimeYellow: 0.9 };
const KEYS = { config: 'proc_dashboard_config_v3_1', plan: 'proc_dashboard_plan_v3_1' };

const state = {
  raw: [], filtered: [], buyer: 'ALL', week: null,
  charts: { bar: null, line: null },
  config: loadConfig(),
  plan: loadPlan(), // { "<buyer>|<week>": [ {category, target, actual} ] }
};

function loadConfig(){ try{ const s=localStorage.getItem(KEYS.config); if(s) return { ...DEFAULT_CONFIG, ...JSON.parse(s) }; }catch(e){} return { ...DEFAULT_CONFIG }; }
function saveConfig(){ localStorage.setItem(KEYS.config, JSON.stringify(state.config)); }

function loadPlan(){ try{ const s=localStorage.getItem(KEYS.plan); if(s) return JSON.parse(s); }catch(e){} return {}; }
function savePlan(){ localStorage.setItem(KEYS.plan, JSON.stringify(state.plan)); }

function planKey(){ return `${state.buyer || 'ALL'}|${state.week || 'ALL'}`; }
function getCurrentPlan(){ return state.plan[planKey()] || []; }
function setCurrentPlan(rows){ state.plan[planKey()] = rows; savePlan(); }

function money(n){ return n.toLocaleString('zh-TW', { style:'currency', currency:'TWD', maximumFractionDigits:0 }); }
function pctf(n){ return (n*100).toFixed(1)+'%'; }
function pctNumber(n){ return isFinite(n) ? (n*100).toFixed(1) : '0.0'; }
function badge(el, val, green, yellow){ el.className='chip ' + (val>=green?'green':val>=yellow?'yellow':'red'); el.textContent=(val>=green?'達標':val>=yellow?'接近':'未達標'); }

function parseCSV(text){
  const rows = text.split(/\r?\n/).filter(Boolean).map(r=>r.split(','));
  const [header, ...data] = rows;
  return data.map(cols => Object.fromEntries(cols.map((v,i)=>[header[i], v]))).map(r => ({
    date: r.date, week: r.week, buyer: r.buyer, category: r.category, item: r.item,
    qty: Number(r.qty||0), amount: Number(r.amount||0), target: Number(r.target||0),
    margin: Number(r.margin||0), ontime: r.ontime == '1' || r.ontime == 1 || String(r.ontime).includes('準')
  }));
}
async function loadCSV(path){ const text = await fetch(path).then(r=>r.text()); return parseCSV(text); }

async function loadXLSXFile(file){
  const data = await file.arrayBuffer(); const wb = XLSX.read(data,{type:'array'}); const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const mapKey = (k)=>({ '日期':'date','週別':'week','採購':'buyer','類別':'category','品名':'item','數量':'qty','金額':'amount','目標':'target','毛利率':'margin','交期':'ontime' }[k]||k);
  return json.map(r=>{ const o={}; for(const k in r) o[mapKey(k)] = r[k]; return {
    date: String(o.date||'').slice(0,10), week: String(o.week||''), buyer: String(o.buyer||''),
    category: String(o.category||''), item: String(o.item||''),
    qty: Number(o.qty||0), amount: Number(o.amount||0), target: Number(o.target||0),
    margin: Number(o.margin||0), ontime: (String(o.ontime).includes('1') || String(o.ontime).includes('準')),
  }; });
}

function unique(arr, key){ return [...new Set(arr.map(x=>x[key]))]; }
function groupBy(arr, key){ const m=new Map(); for(const r of arr){ const k=typeof key==='function'?key(r):r[key]; m.set(k,(m.get(k)||[]).concat(r)); } return m; }

function filter(){ const byBuyer = state.buyer==='ALL'?state.raw:state.raw.filter(r=>r.buyer===state.buyer); state.filtered = state.week ? byBuyer.filter(r=>r.week===state.week) : byBuyer; }

function summarize(){
  const totalAmt = state.filtered.reduce((s,r)=>s+r.amount,0);
  const totalTarget = state.filtered.reduce((s,r)=>s+r.target,0);
  const rate = totalTarget ? totalAmt/totalTarget : 0;
  const ontimeRate = state.filtered.length ? state.filtered.filter(r=>r.ontime).length / state.filtered.length : 0;
  const avgMargin = state.filtered.length ? state.filtered.reduce((s,r)=>s+r.margin,0)/state.filtered.length : 0;

  document.getElementById('kpiAmount').textContent = money(totalAmt);
  document.getElementById('kpiRate').textContent = pctf(rate);
  badge(document.getElementById('kpiRateChip'), rate, state.config.rateGreen, state.config.rateYellow);
  document.getElementById('kpiOnTime').textContent = pctf(ontimeRate);
  badge(document.getElementById('kpiOnTimeChip'), ontimeRate, state.config.ontimeGreen, state.config.ontimeYellow);
  document.getElementById('kpiMargin').textContent = pctf(avgMargin);
  document.getElementById('rateRule').textContent = `(綠 ≥ ${Math.round(state.config.rateGreen*100)}%，黃 ≥ ${Math.round(state.config.rateYellow*100)}%)`;
  document.getElementById('ontimeRule').textContent = `(綠 ≥ ${Math.round(state.config.ontimeGreen*100)}%，黃 ≥ ${Math.round(state.config.ontimeYellow*100)}%)`;
}

function drawCharts(){
  const ctxBar = document.getElementById('barByCategory').getContext('2d');
  const ctxLine = document.getElementById('lineTrend').getContext('2d');
  const catMap = groupBy(state.filtered, 'category');
  const catLabels = [...catMap.keys()]; const catValues = catLabels.map(k=>catMap.get(k).reduce((s,r)=>s+r.amount,0));
  document.getElementById('sumByCategoryInfo').textContent = `共 ${catLabels.length} 類，總金額 ${money(catValues.reduce((a,b)=>a+b,0))}`;
  if (state.charts.bar) state.charts.bar.destroy();
  state.charts.bar = new Chart(ctxBar, { type:'bar', data:{ labels:catLabels, datasets:[{ label:'金額', data:catValues }]}, options:{ responsive:true, plugins:{ legend:{ display:false } } } });
  const wkMap = groupBy(state.filtered,'week'); const wkLabels = [...wkMap.keys()].sort(); const wkValues = wkLabels.map(k=>wkMap.get(k).reduce((s,r)=>s+r.amount,0));
  document.getElementById('trendInfo').textContent = wkLabels.length ? `${wkLabels[0]} → ${wkLabels[wkLabels.length-1]}` : '—';
  if (state.charts.line) state.charts.line.destroy();
  state.charts.line = new Chart(ctxLine, { type:'line', data:{ labels:wkLabels, datasets:[{ label:'金額', data:wkValues, tension:.3, fill:false }]}, options:{ responsive:true, plugins:{ legend:{ display:false } } } });
}

function renderPivot(){
  const tbl = document.getElementById('pivotTable');
  const buyers = unique(state.filtered,'buyer').sort();
  const cats = unique(state.filtered,'category').sort();
  const sums = {};
  for (const b of buyers){ sums[b] = {}; for (const c of cats){ sums[b][c] = state.filtered.filter(r=>r.buyer===b && r.category===c).reduce((s,r)=>s+r.amount,0); } sums[b].TOTAL = Object.values(sums[b]).reduce((a,b)=>a+b,0); }
  const header = `<tr><th>採購</th>${cats.map(c=>`<th>${c}</th>`).join('')}<th>總計</th></tr>`;
  const rows = buyers.map(b=>{ const cells = cats.map(c=>`<td>${money(sums[b][c])}</td>`).join(''); return `<tr><td>${b}</td>${cells}<td>${money(sums[b].TOTAL)}</td></tr>`; }).join('');
  const totalRow = (()=>{ const totals={}; for (const c of cats){ totals[c] = buyers.reduce((s,b)=>s+sums[b][c],0); } const totalAll = Object.values(totals).reduce((a,b)=>a+b,0); return `<tr><td><b>總計</b></td>${cats.map(c=>`<td><b>${money(totals[c])}</b></td>`).join('')}<td><b>${money(totalAll)}</b></td></tr>`; })();
  tbl.innerHTML = header + rows + totalRow;
}

function renderRaw(){
  const tbl = document.getElementById('rawTable');
  const header = `<tr><th>日期</th><th>週別</th><th>採購</th><th>類別</th><th>品名</th><th>數量</th><th>金額</th><th>目標</th><th>毛利率</th><th>交期</th></tr>`;
  const rows = state.filtered.map(r=>`<tr>
    <td>${r.date}</td><td>${r.week}</td><td>${r.buyer}</td><td>${r.category}</td>
    <td>${r.item}</td><td>${r.qty}</td><td>${money(r.amount)}</td><td>${money(r.target)}</td>
    <td>${pctf(r.margin)}</td><td>${r.ontime ? '準時' : '延遲'}</td>
  </tr>`).join('');
  tbl.innerHTML = header + rows;
}

function populateBuyers(){
  const sel = document.getElementById('buyerSelect');
  const buyers = ['ALL', ...unique(state.raw,'buyer').sort()];
  sel.innerHTML = buyers.map(b=>`<option value="${b}">${b}</option>`).join('');
}

/* ---------- Settings Dialog ---------- */
function initSettingsDialog(){
  const dlg = document.getElementById('settingsDialog');
  const btn = document.getElementById('settingsBtn');
  const save = document.getElementById('settingsSave');
  const cancel = document.getElementById('settingsCancel');
  const rateG = document.getElementById('rateGreen');
  const rateY = document.getElementById('rateYellow');
  const onG = document.getElementById('ontimeGreen');
  const onY = document.getElementById('ontimeYellow');
  function syncInputs(){ rateG.value=state.config.rateGreen; rateY.value=state.config.rateYellow; onG.value=state.config.ontimeGreen; onY.value=state.config.ontimeYellow; }
  btn.addEventListener('click', ()=>{ syncInputs(); dlg.showModal(); });
  cancel.addEventListener('click', (e)=>{ e.preventDefault(); dlg.close(); });
  save.addEventListener('click', (e)=>{ e.preventDefault(); state.config.rateGreen=parseFloat(rateG.value||1); state.config.rateYellow=parseFloat(rateY.value||0.95); state.config.ontimeGreen=parseFloat(onG.value||0.95); state.config.ontimeYellow=parseFloat(onY.value||0.9); localStorage.setItem(KEYS.config, JSON.stringify(state.config)); dlg.close(); summarize(); });
}

/* ---------- Upload ---------- */
function initUpload(){
  const btn = document.getElementById('uploadBtn');
  const input = document.getElementById('uploadInput');
  btn.addEventListener('click', ()=> input.click());
  input.addEventListener('change', async (e)=>{
    const file = e.target.files[0]; if(!file) return;
    const name = file.name.toLowerCase();
    try{
      if (name.endsWith('.csv')){ const text = await file.text(); state.raw = parseCSV(text); }
      else { state.raw = await loadXLSXFile(file); }
      state.buyer='ALL'; state.week=null; populateBuyers(); filter(); summarize(); drawCharts(); renderPivot(); renderRaw();
    }catch(err){ alert('讀取檔案時發生錯誤：'+err.message); } finally { input.value=''; }
  });
}

/* ---------- Sources ---------- */
async function initSources(){
  try{
    const meta = await fetch('./data/sources.json').then(r=>r.json());
    const sel = document.getElementById('sourceSelect');
    sel.innerHTML = meta.options.map(o=>`<option value="${o.path}">${o.label}</option>`).join('');
    sel.value = meta.default;
    sel.addEventListener('change', e => loadSource(e.target.value));
    await loadSource(meta.default);
  }catch(e){ console.error('sources.json missing', e); }
}
async function loadSource(path){ state.raw = await loadCSV(path); state.buyer='ALL'; state.week=null; populateBuyers(); filter(); summarize(); drawCharts(); renderPivot(); renderRaw(); }

/* ---------- Personal Plan Dialog ---------- */
function initPlanDialog(){
  const dlg = document.getElementById('planDialog');
  const btn = document.getElementById('planBtn');
  const title = document.getElementById('planTitle');
  const addRow = document.getElementById('planAddRow');
  const tbody = document.querySelector('#planTable tbody');
  const sumTarget = document.getElementById('planSumTarget');
  const sumActual = document.getElementById('planSumActual');
  const sumRate = document.getElementById('planSumRate');
  const exportBtn = document.getElementById('planExport');
  const saveBtn = document.getElementById('planSave');
  const cancelBtn = document.getElementById('planCancel');

  function compute(){
    let t=0, a=0;
    tbody.querySelectorAll('tr').forEach(tr=>{
      const target = parseFloat(tr.querySelector('input[data-field="target"]').value||'0');
      const actual = parseFloat(tr.querySelector('input[data-field="actual"]').value||'0');
      t += target; a += actual;
      const rateCell = tr.querySelector('[data-cell="rate"]');
      const rate = target ? actual/target : 0;
      rateCell.textContent = pctNumber(rate)+'%';
      rateCell.className = (rate>=state.config.rateGreen?'green':rate>=state.config.rateYellow?'yellow':'red') + ' chip';
    });
    sumTarget.textContent = money(t);
    sumActual.textContent = money(a);
    const r = t? (a/t) : 0;
    sumRate.textContent = pctNumber(r)+'%';
    sumRate.className = (r>=state.config.rateGreen?'green':r>=state.config.rateYellow?'yellow':'red') + ' chip';
  }

  function row(category='', target=0, actual=0){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="btn w-full" value="${category}" data-field="category"/></td>
      <td><input class="btn w-full" type="number" step="1" value="${target}" data-field="target"/></td>
      <td><input class="btn w-full" type="number" step="1" value="${actual}" data-field="actual"/></td>
      <td><span data-cell="rate" class="chip">0.0%</span></td>
      <td><button type="button" class="btn" data-action="del">刪除</button></td>
    `;
    tr.addEventListener('input', compute);
    tr.querySelector('[data-action="del"]').addEventListener('click', ()=>{ tr.remove(); compute(); });
    tbody.appendChild(tr);
  }

  function load(){
    tbody.innerHTML='';
    const key = planKey();
    title.textContent = `採購：${state.buyer || 'ALL'}　週別：${state.week || 'ALL'}　(Key: ${key})`;
    const rows = getCurrentPlan();
    if (rows.length===0) { row('CPU', 500000, 0); row('GPU', 800000, 0); }
    else { rows.forEach(r=>row(r.category, r.target, r.actual)); }
    compute();
  }

  btn.addEventListener('click', ()=>{ load(); dlg.showModal(); });
  addRow.addEventListener('click', ()=>{ row('', 0, 0); compute(); });

  exportBtn.addEventListener('click', ()=>{
    const rows = [];
    tbody.querySelectorAll('tr').forEach(tr=>{
      rows.push({
        category: tr.querySelector('input[data-field="category"]').value,
        target: parseFloat(tr.querySelector('input[data-field="target"]').value||'0'),
        actual: parseFloat(tr.querySelector('input[data-field="actual"]').value||'0'),
      });
    });
    const header = 'buyer,week,category,target,actual,rate\n';
    const key = planKey().split('|');
    const csv = header + rows.map(r=>[state.buyer, state.week, r.category, r.target, r.actual, (r.target? (r.actual/r.target) : 0)].join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`個人目標_${state.buyer}_${state.week||'ALL'}.csv`; a.click(); URL.revokeObjectURL(url);
  });

  saveBtn.addEventListener('click', (e)=>{
    e.preventDefault();
    const rows = [];
    tbody.querySelectorAll('tr').forEach(tr=>{
      rows.push({
        category: tr.querySelector('input[data-field="category"]').value,
        target: parseFloat(tr.querySelector('input[data-field="target"]').value||'0'),
        actual: parseFloat(tr.querySelector('input[data-field="actual"]').value||'0'),
      });
    });
    setCurrentPlan(rows);
    dlg.close();
  });
  cancelBtn.addEventListener('click', (e)=>{ e.preventDefault(); dlg.close(); });
}

/* ---------- Report (reuse from v3) ---------- */
function buildPersonalReport(){
  // Combine plan totals with KPI highlights, then export multipage PDF
  const buyer = state.buyer==='ALL' ? '全體採購' : state.buyer;
  const week = state.week || '全部週別';
  const topN = Math.max(3, Math.min(20, parseInt(document.getElementById('topNInput').value||'5')));
  const data = [...state.filtered].sort((a,b)=>b.amount-a.amount);
  const top = data.slice(0, topN);
  const delayed = state.filtered.filter(r=>!r.ontime).slice(0, topN);
  const catMap = groupBy(state.filtered, 'category');
  const catRows = [...catMap.keys()].map(c=>({ category:c, amount:[...catMap.get(c)].reduce((s,r)=>s+r.amount,0) })).sort((a,b)=>b.amount-a.amount);

  const totalAmt = state.filtered.reduce((s,r)=>s+r.amount,0);
  const totalTarget = state.filtered.reduce((s,r)=>s+r.target,0);
  const rate = totalTarget ? totalAmt/totalTarget : 0;
  const ontimeRate = state.filtered.length ? state.filtered.filter(r=>r.ontime).length/state.filtered.length : 0;
  const avgMargin = state.filtered.length ? state.filtered.reduce((s,r)=>s+r.margin,0)/state.filtered.length : 0;

  const highlights = [];
  if (rate>=state.config.rateGreen) highlights.push('✅ 達成率達標（綠）');
  else if (rate>=state.config.rateYellow) highlights.push('⚠️ 達成率接近門檻（黃）');
  else highlights.push('❌ 達成率未達標（紅）');
  if (ontimeRate>=state.config.ontimeGreen) highlights.push('✅ 交期準時率達標（綠）');
  else if (ontimeRate>=state.config.ontimeYellow) highlights.push('⚠️ 交期準時率接近門檻（黃）');
  else highlights.push('❌ 交期準時率未達標（紅）');

  // Include Plan totals
  const planRows = getCurrentPlan();
  const planT = planRows.reduce((s,r)=>s + (parseFloat(r.target)||0), 0);
  const planA = planRows.reduce((s,r)=>s + (parseFloat(r.actual)||0), 0);
  const planR = planT ? planA/planT : 0;

  const reportRoot = document.getElementById('reportRoot') || (function(){
    const div = document.createElement('div'); div.id='reportRoot'; document.body.appendChild(div); return div;
  })();
  reportRoot.innerHTML=''; reportRoot.style.display='block';
  reportRoot.insertAdjacentHTML('beforeend', `
    <div class="section">
      <h1>採購個人週報</h1>
      <div class="small">報告對象：${buyer}｜週別：${week}</div>
      <div class="kv" style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px">
        <div>總採購金額：<b>${money(totalAmt)}</b></div>
        <div>達成率（實績/目標）：<b>${pctNumber(rate)}%</b></div>
        <div>交期達成率：<b>${pctNumber(ontimeRate)}%</b></div>
        <div>平均毛利率：<b>${pctNumber(avgMargin)}%</b></div>
      </div>
      <div class="section">
        <h2>重點摘要</h2>
        <ul style="margin:0; padding-left:18px">
          ${highlights.map(h=>`<li>${h}</li>`).join('')}
          <li>個人目標/實績（表單）：目前合計 <b>${money(planA)}</b> / 目標 <b>${money(planT)}</b>（達成 <b>${pctNumber(planR)}%</b>）</li>
        </ul>
      </div>
    </div>
  `);
  // Plan table
  reportRoot.insertAdjacentHTML('beforeend', `
    <div class="section">
      <h2>個人目標 / 實績（依產品分類）</h2>
      <table>
        <thead><tr><th>產品分類</th><th>目標金額</th><th>實際金額</th><th>達成率</th></tr></thead>
        <tbody>
          ${planRows.map(r=>`<tr><td>${r.category||''}</td><td>${money(parseFloat(r.target)||0)}</td><td>${money(parseFloat(r.actual)||0)}</td><td>${pctNumber((r.target? (r.actual/r.target):0))}%</td></tr>`).join('') || `<tr><td colspan="4">（尚未填寫）</td></tr>`}
        </tbody>
      </table>
    </div>
  `);
  // Top N items
  reportRoot.insertAdjacentHTML('beforeend', `
    <div class="section">
      <h2>Top ${topN} 金額品項</h2>
      <table>
        <thead><tr><th>品名</th><th>類別</th><th>金額</th><th>毛利率</th><th>交期</th></tr></thead>
        <tbody>
          ${top.map(r=>`<tr><td>${r.item}</td><td>${r.category}</td><td>${money(r.amount)}</td><td>${pctNumber(r.margin)}%</td><td>${r.ontime?'準時':'延遲'}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  `);

  // Export multipage PDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p','pt','a4');
  const nodes = Array.from(reportRoot.children);
  const pageWidth = doc.internal.pageSize.getWidth(), pageHeight = doc.internal.pageSize.getHeight();
  const margin = 24;

  function addNodeToPDF(node, cb){
    html2canvas(node, { scale: 2 }).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const ratio = Math.min((pageWidth - margin*2)/canvas.width, (pageHeight - margin*2)/canvas.height);
      const w = canvas.width * ratio, h = canvas.height * ratio;
      doc.addImage(imgData, 'PNG', (pageWidth - w)/2, margin, w, h);
      cb();
    });
  }

  let i=0;
  function next(){
    if (i>=nodes.length){ doc.save(`個人報告_${state.buyer}_${state.week||'ALL'}.pdf`); reportRoot.style.display='none'; return; }
    if (i>0) doc.addPage();
    addNodeToPDF(nodes[i++], next);
  }
  next();
}

function initPlanButton(){ document.getElementById('planBtn').addEventListener('click', ()=>{}); }

/* ---------- Main ---------- */
async function main(){
  // Init settings/upload/sources
  initSettingsDialog();
  initUpload();
  await initSources();

  // Filters
  document.getElementById('buyerSelect').addEventListener('change', e => { state.buyer = e.target.value; filter(); summarize(); drawCharts(); renderPivot(); renderRaw(); });
  document.getElementById('weekInput').addEventListener('change', e => { state.week = e.target.value; filter(); summarize(); drawCharts(); renderPivot(); renderRaw(); });
  document.getElementById('resetBtn').addEventListener('click', () => {
    state.buyer = 'ALL'; document.getElementById('buyerSelect').value='ALL';
    state.week = null; document.getElementById('weekInput').value='';
    filter(); summarize(); drawCharts(); renderPivot(); renderRaw();
  });

  // Report / exports
  document.getElementById('exportPDFBtn').addEventListener('click', ()=>{
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','pt','a4');
    const root = document.body;
    html2canvas(root, { scale: 2 }).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const w = canvas.width * ratio, h = canvas.height * ratio;
      doc.addImage(imgData, 'PNG', (pageWidth - w)/2, 20, w, h);
      doc.save(`採購週報_${state.buyer}_${state.week||'ALL'}.pdf`);
    });
  });
  document.getElementById('exportXLSXBtn').addEventListener('click', ()=>{
    const rows = state.filtered.map(r=>({
      日期: r.date, 週別: r.week, 採購: r.buyer, 類別: r.category, 品名: r.item,
      數量: r.qty, 金額: r.amount, 目標: r.target, 毛利率: r.margin, 交期: r.ontime ? '準時' : '延遲'
    }));
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '週報'); XLSX.writeFile(wb, `採購週報_${state.buyer}_${state.week||'ALL'}.xlsx`);
  });
  document.getElementById('buildReportBtn').addEventListener('click', buildPersonalReport);

  // Plan dialog
  initPlanDialog();
}

main();
