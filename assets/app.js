// Lightweight dashboard using vanilla JS + Chart.js + SheetJS
const state = {
  raw: [],
  filtered: [],
  buyer: 'ALL',
  week: null,
  charts: { bar: null, line: null },
};

function money(n){ return n.toLocaleString('zh-TW', { style:'currency', currency:'TWD', maximumFractionDigits:0 }); }
function pct(n){ return (n*100).toFixed(1)+'%'; }

function badge(el, rate){
  el.className = 'chip ' + (rate >= 1 ? 'green' : rate >= 0.95 ? 'yellow' : 'red');
  el.textContent = rate >= 1 ? '達標' : rate >= 0.95 ? '接近' : '未達標';
}

async function loadCSV(path){
  const text = await fetch(path).then(r=>r.text());
  // Simple CSV parser
  const rows = text.split(/\r?\n/).filter(Boolean).map(r=>r.split(','));
  const [header, ...data] = rows;
  return data.map(cols => Object.fromEntries(cols.map((v,i)=>[header[i], v]))).map(r => ({
    date: r.date,
    week: r.week,
    buyer: r.buyer,
    category: r.category,
    item: r.item,
    qty: Number(r.qty||0),
    amount: Number(r.amount||0),
    target: Number(r.target||0),
    margin: Number(r.margin||0),
    ontime: r.ontime === '1',
  }));
}

function unique(arr, key){ return [...new Set(arr.map(x=>x[key]))]; }

function filter(){
  const byBuyer = state.buyer === 'ALL' ? state.raw : state.raw.filter(r=>r.buyer===state.buyer);
  const byWeek = state.week ? byBuyer.filter(r=>r.week===state.week) : byBuyer;
  state.filtered = byWeek;
}

function summarize(){
  const totalAmt = state.filtered.reduce((s,r)=>s+r.amount,0);
  const totalTarget = state.filtered.reduce((s,r)=>s+r.target,0);
  const rate = totalTarget ? totalAmt/totalTarget : 0;
  const ontimeRate = state.filtered.length ? state.filtered.filter(r=>r.ontime).length / state.filtered.length : 0;
  const avgMargin = state.filtered.length ? state.filtered.reduce((s,r)=>s+r.margin,0)/state.filtered.length : 0;

  document.getElementById('kpiAmount').textContent = money(totalAmt);
  document.getElementById('kpiRate').textContent = pct(rate);
  badge(document.getElementById('kpiRateChip'), rate);
  document.getElementById('kpiOnTime').textContent = pct(ontimeRate);
  badge(document.getElementById('kpiOnTimeChip'), ontimeRate);
  document.getElementById('kpiMargin').textContent = pct(avgMargin);
}

function groupBy(arr, key){
  const m = new Map();
  for (const r of arr){
    const k = typeof key === 'function' ? key(r) : r[key];
    m.set(k, (m.get(k)||[]).concat(r));
  }
  return m;
}

function drawCharts(){
  const ctxBar = document.getElementById('barByCategory').getContext('2d');
  const ctxLine = document.getElementById('lineTrend').getContext('2d');

  // Category bar
  const catMap = groupBy(state.filtered, 'category');
  const catLabels = [...catMap.keys()];
  const catValues = catLabels.map(k=>catMap.get(k).reduce((s,r)=>s+r.amount,0));

  document.getElementById('sumByCategoryInfo').textContent = `共 ${catLabels.length} 類，總金額 ${money(catValues.reduce((a,b)=>a+b,0))}`;

  if (state.charts.bar) state.charts.bar.destroy();
  state.charts.bar = new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels: catLabels,
      datasets: [{ label: '金額', data: catValues }]
    },
    options: { responsive:true, plugins:{ legend:{ display:false } }, scales:{ x:{ ticks:{ color:'#9ca3af'}}, y:{ ticks:{ color:'#9ca3af'}}} }
  });

  // Weekly line
  const wkMap = groupBy(state.filtered, 'week');
  const wkLabels = [...wkMap.keys()].sort();
  const wkValues = wkLabels.map(k=>wkMap.get(k).reduce((s,r)=>s+r.amount,0));
  document.getElementById('trendInfo').textContent = wkLabels.length ? `${wkLabels[0]} → ${wkLabels[wkLabels.length-1]}` : '—';

  if (state.charts.line) state.charts.line.destroy();
  state.charts.line = new Chart(ctxLine, {
    type: 'line',
    data: { labels: wkLabels, datasets: [{ label:'金額', data: wkValues, tension:.3, fill:false }]},
    options: { responsive:true, plugins:{ legend:{ display:false } }, scales:{ x:{ ticks:{ color:'#9ca3af'}}, y:{ ticks:{ color:'#9ca3af'}}} }
  });
}

function renderPivot(){
  const tbl = document.getElementById('pivotTable');
  const buyers = unique(state.filtered,'buyer').sort();
  const cats = unique(state.filtered,'category').sort();
  const sums = {};
  for (const b of buyers){
    sums[b] = {};
    for (const c of cats){
      sums[b][c] = state.filtered.filter(r=>r.buyer===b && r.category===c).reduce((s,r)=>s+r.amount,0);
    }
    sums[b].TOTAL = Object.values(sums[b]).reduce((a,b)=>a+b,0);
  }
  const header = `<tr><th>採購</th>${cats.map(c=>`<th>${c}</th>`).join('')}<th>總計</th></tr>`;
  const rows = buyers.map(b=>{
    const cells = cats.map(c=>`<td>${money(sums[b][c])}</td>`).join('');
    return `<tr><td>${b}</td>${cells}<td>${money(sums[b].TOTAL)}</td></tr>`;
  }).join('');
  const totalRow = (()=>{
    const totals = {};
    for (const c of cats){
      totals[c] = buyers.reduce((s,b)=>s+sums[b][c],0);
    }
    const totalAll = Object.values(totals).reduce((a,b)=>a+b,0);
    return `<tr><td><b>總計</b></td>${cats.map(c=>`<td><b>${money(totals[c])}</b></td>`).join('')}<td><b>${money(totalAll)}</b></td></tr>`;
  })();
  tbl.innerHTML = header + rows + totalRow;
}

function renderRaw(){
  const tbl = document.getElementById('rawTable');
  const header = `<tr><th>日期</th><th>週別</th><th>採購</th><th>類別</th><th>品名</th><th>數量</th><th>金額</th><th>目標</th><th>毛利率</th><th>交期</th></tr>`;
  const rows = state.filtered.map(r=>`<tr>
    <td>${r.date}</td>
    <td>${r.week}</td>
    <td>${r.buyer}</td>
    <td>${r.category}</td>
    <td>${r.item}</td>
    <td>${r.qty}</td>
    <td>${money(r.amount)}</td>
    <td>${money(r.target)}</td>
    <td>${pct(r.margin)}</td>
    <td>${r.ontime ? '準時' : '延遲'}</td>
  </tr>`).join('');
  tbl.innerHTML = header + rows;
}

function populateBuyers(){
  const sel = document.getElementById('buyerSelect');
  const buyers = ['ALL', ...unique(state.raw,'buyer').sort()];
  sel.innerHTML = buyers.map(b=>`<option value="${b}">${b}</option>`).join('');
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
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    doc.addImage(imgData, 'PNG', (pageWidth - w)/2, 20, w, h);
    doc.save(`採購週報_${state.buyer}_${state.week||'ALL'}.pdf`);
  });
}

function exportXLSX(){
  const rows = state.filtered.map(r=>({
    日期: r.date, 週別: r.week, 採購: r.buyer, 類別: r.category, 品名: r.item,
    數量: r.qty, 金額: r.amount, 目標: r.target, 毛利率: r.margin, 交期: r.ontime ? '準時' : '延遲'
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '週報');
  XLSX.writeFile(wb, `採購週報_${state.buyer}_${state.week||'ALL'}.xlsx`);
}

async function main(){
  state.raw = await loadCSV('./data/sample.csv');
  populateBuyers();

  const buyerSelect = document.getElementById('buyerSelect');
  buyerSelect.addEventListener('change', e => { state.buyer = e.target.value; filter(); summarize(); drawCharts(); renderPivot(); renderRaw(); });

  const weekInput = document.getElementById('weekInput');
  weekInput.addEventListener('change', e => { state.week = e.target.value; filter(); summarize(); drawCharts(); renderPivot(); renderRaw(); });

  document.getElementById('resetBtn').addEventListener('click', () => {
    state.buyer = 'ALL'; buyerSelect.value = 'ALL';
    state.week = null; weekInput.value = '';
    filter(); summarize(); drawCharts(); renderPivot(); renderRaw();
  });
  document.getElementById('exportPDFBtn').addEventListener('click', exportPDF);
  document.getElementById('exportXLSXBtn').addEventListener('click', exportXLSX);

  filter(); summarize(); drawCharts(); renderPivot(); renderRaw();
}

main();
