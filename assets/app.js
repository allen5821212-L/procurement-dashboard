// v3: adds Report Builder (Top N, cover, highlights)
const DEFAULT_CONFIG = { rateGreen: 1.0, rateYellow: 0.95, ontimeGreen: 0.95, ontimeYellow: 0.9 };
const KEYS = { config: 'proc_dashboard_config_v3' };

const state = {
  raw: [], filtered: [], buyer: 'ALL', week: null,
  charts: { bar: null, line: null },
  config: loadConfig(),
};

function loadConfig(){ try{ const s=localStorage.getItem(KEYS.config); if(s) return { ...DEFAULT_CONFIG, ...JSON.parse(s) }; }catch(e){} return { ...DEFAULT_CONFIG }; }
function saveConfig(){ localStorage.setItem(KEYS.config, JSON.stringify(state.config)); }

function money(n){ return n.toLocaleString('zh-TW', { style:'currency', currency:'TWD', maximumFractionDigits:0 }); }
function pct(n){ return (n*100).toFixed(1)+'%'; }
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
  document.getElementById('kpiRate').textContent = pct(rate);
  badge(document.getElementById('kpiRateChip'), rate, state.config.rateGreen, state.config.rateYellow);
  document.getElementById('kpiOnTime').textContent = pct(ontimeRate);
  badge(document.getElementById('kpiOnTimeChip'), ontimeRate, state.config.ontimeGreen, state.config.ontimeYellow);
  document.getElementById('kpiMargin').textContent = pct(avgMargin);
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
    <td>${pct(r.margin)}</td><td>${r.ontime ? '準時' : '延遲'}</td>
  </tr>`).join('');
  tbl.innerHTML = header + rows;
}

function populateBuyers(){
  const sel = document.getElementById('buyerSelect');
  const buyers = ['ALL', ...unique(state.raw,'buyer').sort()];
  sel.innerHTML = buyers.map(b=>`<option value="${b}">${b}</option>`).join('');
}

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
  save.addEventListener('click', (e)=>{ e.preventDefault(); state.config.rateGreen=parseFloat(rateG.value||1); state.config.rateYellow=parseFloat(rateY.value||0.95); state.config.ontimeGreen=parseFloat(onG.value||0.95); state.config.ontimeYellow=parseFloat(onY.value||0.9); saveConfig(); dlg.close(); summarize(); });
}

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

function exportPDF(){
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
}
function exportXLSX(){
  const rows = state.filtered.map(r=>({
    日期: r.date, 週別: r.week, 採購: r.buyer, 類別: r.category, 品名: r.item,
    數量: r.qty, 金額: r.amount, 目標: r.target, 毛利率: r.margin, 交期: r.ontime ? '準時' : '延遲'
  }));
  const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '週報'); XLSX.writeFile(wb, `採購週報_${state.buyer}_${state.week||'ALL'}.xlsx`);
}

function buildPersonalReport(){
  // Build a minimal, clean report inside #reportRoot and export as multipage PDF
  const buyer = state.buyer==='ALL' ? '全體採購' : state.buyer;
  const week = state.week || '全部週別';
  const topN = Math.max(3, Math.min(20, parseInt(document.getElementById('topNInput').value||'5')));
  const data = [...state.filtered].sort((a,b)=>b.amount-a.amount);
  const top = data.slice(0, topN);
  const delayed = state.filtered.filter(r=>!r.ontime).slice(0, topN);
  const catMap = groupBy(state.filtered, 'category');
  const catRows = [...catMap.keys()].map(c=>({ category:c, amount:[...catMap.get(c)].reduce((s,r)=>s+r.amount,0) })).sort((a,b)=>b.amount-a.amount);

  // KPIs
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

  const root = document.getElementById('reportRoot'); root.innerHTML=''; root.style.display='block';
  // Cover
  root.insertAdjacentHTML('beforeend', `
    <div class="section">
      <h1>採購個人週報</h1>
      <div class="small">報告對象：${buyer}｜週別：${week}</div>
      <div class="kv" style="margin-top:10px">
        <div>總採購金額：<b>${money(totalAmt)}</b></div>
        <div>達成率：<b>${pct(rate)}</b></div>
        <div>交期達成率：<b>${pct(ontimeRate)}</b></div>
        <div>平均毛利率：<b>${pct(avgMargin)}</b></div>
      </div>
      <div class="section">
        <h2>重點摘要</h2>
        <ul style="margin:0; padding-left:18px">
          ${highlights.map(h=>`<li>${h}</li>`).join('')}
        </ul>
      </div>
    </div>
  `);
  // Top N items
  root.insertAdjacentHTML('beforeend', `
    <div class="section">
      <h2>Top ${topN} 金額品項</h2>
      <table>
        <thead><tr><th>品名</th><th>類別</th><th>金額</th><th>毛利率</th><th>交期</th></tr></thead>
        <tbody>
          ${top.map(r=>`<tr><td>${r.item}</td><td>${r.category}</td><td>${money(r.amount)}</td><td>${pct(r.margin)}</td><td>${r.ontime?'準時':'延遲'}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  `);
  // Category breakdown
  root.insertAdjacentHTML('beforeend', `
    <div class="section">
      <h2>類別貢獻</h2>
      <table>
        <thead><tr><th>類別</th><th>金額</th><th>占比</th></tr></thead>
        <tbody>
          ${catRows.map(r=>`<tr><td>${r.category}</td><td>${money(r.amount)}</td><td>${((r.amount/Math.max(1,totalAmt))*100).toFixed(1)}%</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  `);
  // Delays
  root.insertAdjacentHTML('beforeend', `
    <div class="section">
      <h2>延遲清單（最多 ${topN} 筆）</h2>
      <table>
        <thead><tr><th>日期</th><th>品名</th><th>類別</th><th>金額</th></tr></thead>
        <tbody>
          ${delayed.map(r=>`<tr><td>${r.date}</td><td>${r.item}</td><td>${r.category}</td><td>${money(r.amount)}</td></tr>`).join('') || `<tr><td colspan="4">本期無延遲</td></tr>`}
        </tbody>
      </table>
      <div class="small">建議：優先追蹤高金額且延遲的品項，與供應商協調交期與配額。</div>
    </div>
  `);

  // Export multipage PDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p','pt','a4');
  const nodes = Array.from(root.children);
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
    if (i>=nodes.length){ doc.save(`個人報告_${state.buyer}_${state.week||'ALL'}.pdf`); root.style.display='none'; return; }
    if (i>0) doc.addPage();
    addNodeToPDF(nodes[i++], next);
  }
  next();
}

async function main(){
  // init
  initSettingsDialog();
  initUpload();
  document.getElementById('buyerSelect').addEventListener('change', e => { state.buyer = e.target.value; filter(); summarize(); drawCharts(); renderPivot(); renderRaw(); });
  document.getElementById('weekInput').addEventListener('change', e => { state.week = e.target.value; filter(); summarize(); drawCharts(); renderPivot(); renderRaw(); });
  document.getElementById('resetBtn').addEventListener('click', () => {
    state.buyer = 'ALL'; document.getElementById('buyerSelect').value='ALL';
    state.week = null; document.getElementById('weekInput').value='';
    filter(); summarize(); drawCharts(); renderPivot(); renderRaw();
  });
  document.getElementById('exportPDFBtn').addEventListener('click', exportPDF);
  document.getElementById('exportXLSXBtn').addEventListener('click', exportXLSX);
  document.getElementById('buildReportBtn').addEventListener('click', buildPersonalReport);
  await initSources();
}

main();
