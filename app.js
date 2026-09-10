/* =========================================================
   SHARED
========================================================= */
const STATIONS = [
  { id:'A', name:'Station A — Central Plaza', distance:1.2, baseCrowd:0.72, trend: 1,  gridBase:0.50, gridTrend: 1,   power:50 },
  { id:'B', name:'Station B — Riverside Hub', distance:3.4, baseCrowd:0.30, trend:-1,  gridBase:0.82, gridTrend:-1,   power:60 },
  { id:'C', name:'Station C — Tech Park',     distance:2.1, baseCrowd:0.46, trend: 0,  gridBase:0.33, gridTrend: 0.3, power:40 },
];
const STCOLOR = { A:'var(--stA)', B:'var(--stB)', C:'var(--stC)' };
const BATTERY_CAP_KWH = 45;
const TARGET_SOC = 80;
const SPEED_KMH = 28;

function fmtClock(d){ return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0'); }
function clamp(v,lo,hi){ return Math.max(lo, Math.min(hi, v)); }
function tickClock(){ document.getElementById('clockNow').textContent = fmtClock(new Date()); }
tickClock(); setInterval(tickClock, 15000);

/* =========================================================
   TABS
========================================================= */
document.querySelectorAll('.tabbtn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tabbtn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.panel-view').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
  });
});

/* =========================================================
   TAB 1 — MY TRIP
========================================================= */
let state = { battery:22, priority:'urgent', lookahead:0 };

function crowdAt(st, t){
  const drift = st.trend * (t/60) * 0.35;
  const wobble = st.trend === 0 ? Math.sin(t/10) * 0.05 : 0;
  return clamp(st.baseCrowd + drift + wobble, 0.05, 0.97);
}
function gridAt(st, t){
  const drift = st.gridTrend * (t/60) * 0.30;
  return clamp(st.gridBase + drift, 0.05, 0.95);
}
function computeStation(st, battery, t){
  const crowd = crowdAt(st, t);
  const grid = gridAt(st, t);
  const wait = Math.round(crowd * 34);
  const travel = Math.round((st.distance / SPEED_KMH) * 60);
  const battNeeded = clamp(TARGET_SOC - battery, 5, 95);
  const energyNeeded = BATTERY_CAP_KWH * battNeeded/100;
  const chargeTime = Math.round((energyNeeded / st.power) * 60);
  const cost = Math.round(energyNeeded * (6 + grid*7));
  const total = travel + wait + chargeTime;
  return { ...st, crowd, grid, wait, travel, chargeTime, cost, total, energyNeeded };
}
function scoreStation(c, priority){
  switch(priority){
    case 'emergency': return c.total*2 + c.wait*1.5;
    case 'urgent':     return c.total;
    case 'economy':    return c.cost*3 + c.total*0.25;
    case 'eco':        return c.grid*140 + c.total*0.2;
  }
}
function barColor(v){
  const bad = 1-v;
  if(bad > 0.66) return 'var(--bad)';
  if(bad > 0.38) return 'var(--warm)';
  return 'var(--good)';
}

function renderTrip(){
  const now = new Date();
  const computed = STATIONS.map(st => computeStation(st, state.battery, state.lookahead));
  computed.forEach(c => c.score = scoreStation(c, state.priority));
  const best = computed.reduce((a,b)=> a.score <= b.score ? a : b);

  renderHero(best, now);
  renderStations(computed, best);
  renderPlans(computed, best, now);
}

function renderHero(best, now){
  document.getElementById('heroLetter').textContent = best.id;
  document.getElementById('heroLetter').style.background = `linear-gradient(150deg, ${STCOLOR[best.id]}, #1a2740)`;
  document.getElementById('heroBox').style.borderLeftColor = STCOLOR[best.id];
  document.getElementById('heroName').textContent = best.name.split('—')[0].trim();

  const arrive = new Date(now.getTime() + best.travel*60000);
  const done = new Date(arrive.getTime() + best.wait*60000 + best.chargeTime*60000);

  document.getElementById('heroHeadline').textContent =
    `Go to ${best.name.split('—')[0].trim()} → arrive ${fmtClock(arrive)} → charge complete by ${fmtClock(done)}.`;
  document.getElementById('mArrive').textContent = fmtClock(arrive);
  document.getElementById('mDone').textContent = fmtClock(done);
  document.getElementById('mTotal').textContent = best.total + ' min';
  document.getElementById('mCost').textContent = best.cost + ' cr';

  const why = [];
  why.push(`${Math.round(best.crowd*100)}% predicted crowd, about ${best.wait} min waiting`);
  why.push(`${Math.round(best.grid*100)}% grid demand at this station right now`);
  if(state.priority==='emergency') why.push('Emergency mode: minimizing total time above all else');
  if(state.priority==='economy') why.push(`Estimated ${best.cost} credits — cheapest viable option`);
  if(state.priority==='eco') why.push('Eco mode: chosen for lower grid strain, not just speed');
  if(state.lookahead>0) why.push(`Forecast adjusted for +${state.lookahead} min from now`);
  document.getElementById('whyList').innerHTML = why.map(w=>`<li>${w}</li>`).join('');
}

function renderStations(computed, best){
  const wrap = document.getElementById('stationCards');
  wrap.innerHTML = computed.map(c => {
    const isBest = c.id === best.id;
    const spark = [0,15,30,45,60].map(t=>{
      const cv = crowdAt(STATIONS.find(s=>s.id===c.id), t);
      const isNow = t === state.lookahead;
      return `<i class="${isNow?'now':''}" style="height:${8+cv*18}px"></i>`;
    }).join('');
    return `
    <div class="scard ${isBest?'best':''}">
      <div class="top-bar" style="background:${STCOLOR[c.id]}"></div>
      ${isBest?'<div class="badge-best">Recommended</div>':''}
      <div class="sname">${c.name}</div>
      <div class="sdist">${c.distance} km away · ${c.power} kW charger</div>

      <div class="metric-row">
        <div class="mrow-top"><span>Predicted crowd</span><b>${Math.round(c.crowd*100)}%</b></div>
        <div class="bar-track"><div class="bar-fill" style="width:${c.crowd*100}%;background:${barColor(c.crowd)}"></div></div>
      </div>
      <div class="metric-row">
        <div class="mrow-top"><span>Grid demand</span><b>${Math.round(c.grid*100)}%</b></div>
        <div class="bar-track"><div class="bar-fill" style="width:${c.grid*100}%;background:${barColor(c.grid)}"></div></div>
      </div>

      <div class="spark">${spark}</div>

      <div class="stat-grid">
        <div class="stat"><div class="n">${c.wait} min</div><div class="l">wait time</div></div>
        <div class="stat"><div class="n">${c.chargeTime} min</div><div class="l">charge time</div></div>
        <div class="stat"><div class="n">${c.total} min</div><div class="l">total time</div></div>
        <div class="stat"><div class="n">${c.cost} cr</div><div class="l">est. cost</div></div>
      </div>
    </div>`;
  }).join('');
}

function renderPlans(computed, best, now){
  const nearest = [...computed].sort((a,b)=>a.distance-b.distance)[0];
  const alt = [...computed].filter(c=>c.id!==nearest.id).sort((a,b)=>a.score-b.score)[0];
  const planA = nearest;

  const t2 = state.lookahead + 20;
  const computedLater = STATIONS.map(st=>computeStation(st, state.battery, t2));
  computedLater.forEach(c=>c.score=scoreStation(c, state.priority));
  const planBStation = computedLater.reduce((a,b)=>a.score<=b.score?a:b);
  const planBTotal = 20 + planBStation.total;

  const planC = alt;

  const partialNeed = clamp(50 - state.battery, 5, 95);
  const partialEnergy = BATTERY_CAP_KWH * partialNeed/100;
  const partialChargeTime = Math.round((partialEnergy/nearest.power)*60);
  const partialCost = Math.round(partialEnergy*(6+nearest.grid*7));
  const remainingCompute = computeStation(STATIONS.find(s=>s.id===best.id), 50, state.lookahead + nearest.travel + partialChargeTime);
  const planDTotal = nearest.travel + partialChargeTime + remainingCompute.travel + remainingCompute.wait + remainingCompute.chargeTime;
  const planDCost = partialCost + remainingCompute.cost;

  const plans = [
    { key:'A', title:'Plan A · Charge now', desc:`Go straight to the nearest station (${nearest.id}) and charge to 80%.`, total: planA.total, cost: planA.cost, wait: planA.wait },
    { key:'B', title:'Plan B · Wait 20 min', desc:`Hold for 20 min, then head to the best-scoring station once crowds shift.`, total: planBTotal, cost: planBStation.cost, wait: planBStation.wait },
    { key:'C', title:'Plan C · Alternate station', desc:`Skip the nearest option and go to ${planC.id}, trading distance for less wait.`, total: planC.total, cost: planC.cost, wait: planC.wait },
    { key:'D', title:'Plan D · Partial + top-up', desc:`Quick-charge to 50% now at ${nearest.id}, top up later at ${best.id}.`, total: planDTotal, cost: planDCost, wait: nearest.wait },
  ];
  plans.forEach(p => p.score = state.priority==='economy' ? p.cost*3+p.total*0.25
                              : state.priority==='eco' ? p.total*0.4
                              : state.priority==='emergency' ? p.total*2+p.wait*1.5
                              : p.total);
  const winner = plans.reduce((a,b)=> a.score<=b.score ? a : b);

  document.getElementById('planCards').innerHTML = plans.map(p=>{
    const win = p.key===winner.key;
    return `
    <div class="pcard ${win?'win':''}">
      ${win?'<div class="win-badge">Best fit</div>':''}
      <div class="ptitle">${p.title}</div>
      <div class="pdesc">${p.desc}</div>
      <div class="prow"><span>Total time</span><b>${p.total} min</b></div>
      <div class="prow"><span>Waiting</span><b>${p.wait} min</b></div>
      <div class="prow"><span>Est. cost</span><b>${p.cost} cr</b></div>
    </div>`;
  }).join('');
}

const batterySlider = document.getElementById('batterySlider');
function syncBatteryFill(){
  const pct = (batterySlider.value - batterySlider.min) / (batterySlider.max - batterySlider.min) * 100;
  batterySlider.style.setProperty('--fill', pct + '%');
}
batterySlider.addEventListener('input', e=>{
  state.battery = Number(e.target.value);
  document.getElementById('batteryVal').textContent = state.battery;
  syncBatteryFill();
  renderTrip();
});
syncBatteryFill();

document.getElementById('priorityGrid').addEventListener('click', e=>{
  const btn = e.target.closest('.pbtn');
  if(!btn) return;
  document.querySelectorAll('.pbtn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  state.priority = btn.dataset.p;
  renderTrip();
});

document.getElementById('lookRow').addEventListener('click', e=>{
  const btn = e.target.closest('.lbtn');
  if(!btn) return;
  document.querySelectorAll('.lbtn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  state.lookahead = Number(btn.dataset.t);
  renderTrip();
});

renderTrip();

/* =========================================================
   TAB 2 — NETWORK IMPACT
========================================================= */
function mulberry32(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const TIME_STEPS = [0,10,20,30,40,50,60];
const OVERLOAD_THRESHOLD = 4;
const N_DRIVERS = 20;

function buildScenario(seed){
  const rand = mulberry32(seed);
  const drivers = [];
  for(let i=0;i<N_DRIVERS;i++){
    const arrival = Math.floor(rand()*54);
    const r = rand();
    const preferred = r < 0.45 ? 'A' : (r < 0.75 ? 'C' : 'B');
    const duration = 15 + Math.floor(rand()*20);
    drivers.push({ id:i+1, arrival, preferred, duration });
  }
  return drivers;
}

function activeAt(assignments, drivers, station, t){
  let n = 0;
  for(const d of drivers){
    if(assignments[d.id] === station && d.arrival <= t && t < d.arrival + d.duration) n++;
  }
  return n;
}

function runNaive(drivers){
  const assignments = {};
  drivers.forEach(d => assignments[d.id] = d.preferred);
  return assignments;
}

function runCoordinated(drivers){
  const assignments = {};
  const sorted = [...drivers].sort((a,b)=>a.arrival-b.arrival);
  const log = [];
  for(const d of sorted){
    const currentLoad = {};
    STATIONS.forEach(s => currentLoad[s.id] = activeAt(assignments, sorted.filter(x=>assignments[x.id]!==undefined), s.id, d.arrival));
    let target = d.preferred;
    if(currentLoad[d.preferred] >= OVERLOAD_THRESHOLD){
      const alts = STATIONS.map(s=>s.id).filter(id=>id!==d.preferred);
      alts.sort((a,b)=>currentLoad[a]-currentLoad[b]);
      const chosen = alts[0];
      if(currentLoad[chosen] < currentLoad[d.preferred]){
        const avoided = clamp((currentLoad[d.preferred]-currentLoad[chosen])*4, 4, 24);
        log.push({ id:d.id, from:d.preferred, to:chosen, avoided });
        target = chosen;
      }
    }
    assignments[d.id] = target;
  }
  return { assignments, log };
}

function seriesFor(assignments, drivers){
  const series = { A:[], B:[], C:[] };
  TIME_STEPS.forEach(t=>{
    STATIONS.forEach(s=>{
      series[s.id].push(activeAt(assignments, drivers, s.id, t));
    });
  });
  return series;
}

function drawChart(svgEl, series){
  const maxVal = Math.max(6, ...Object.values(series).flat());
  const w = 320, h = 140, padL = 22, padB = 18, padT = 10, padR = 6;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const xFor = i => padL + (i/(TIME_STEPS.length-1)) * plotW;
  const yFor = v => padT + plotH - (v/maxVal)*plotH;

  let svg = '';
  // gridlines
  for(let g=0; g<=maxVal; g+=Math.ceil(maxVal/4)){
    const y = yFor(g);
    svg += `<line x1="${padL}" y1="${y}" x2="${w-padR}" y2="${y}" stroke="#1c2740" stroke-width="1"/>`;
    svg += `<text x="2" y="${y+3}" font-size="8" fill="#8C9AB8" font-family="Space Grotesk">${g}</text>`;
  }
  TIME_STEPS.forEach((t,i)=>{
    svg += `<text x="${xFor(i)-6}" y="${h-4}" font-size="8" fill="#8C9AB8" font-family="Space Grotesk">${t}m</text>`;
  });

  ['A','B','C'].forEach(id=>{
    const pts = series[id].map((v,i)=>`${xFor(i)},${yFor(v)}`).join(' ');
    svg += `<polyline points="${pts}" fill="none" stroke="${id==='A'?'#4CC9F0':id==='B'?'#FFB238':'#B98CE0'}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    series[id].forEach((v,i)=>{
      svg += `<circle cx="${xFor(i)}" cy="${yFor(v)}" r="2.4" fill="${id==='A'?'#4CC9F0':id==='B'?'#FFB238':'#B98CE0'}"/>`;
    });
  });
  svgEl.innerHTML = svg;
}

function renderNetwork(seed){
  const drivers = buildScenario(seed);
  const naiveAssign = runNaive(drivers);
  const { assignments: coordAssign, log } = runCoordinated(drivers);

  const naiveSeries = seriesFor(naiveAssign, drivers);
  const coordSeries = seriesFor(coordAssign, drivers);

  drawChart(document.getElementById('chartNaive'), naiveSeries);
  drawChart(document.getElementById('chartCoord'), coordSeries);

  const peakNaive = Math.max(...Object.values(naiveSeries).flat());
  const peakCoord = Math.max(...Object.values(coordSeries).flat());
  const reduction = peakNaive > 0 ? Math.round((peakNaive-peakCoord)/peakNaive*100) : 0;

  document.getElementById('peakNaive').textContent = peakNaive;
  document.getElementById('peakCoord').textContent = peakCoord;
  document.getElementById('reduction').innerHTML = Math.max(reduction,0) + '<small>%</small>';

  const logList = document.getElementById('logList');
  if(log.length === 0){
    logList.innerHTML = `<li>No redirects needed this run — demand stayed under the overload threshold.</li>`;
  } else {
    logList.innerHTML = log.slice(0,6).map(l=>
      `<li><span>Driver <b>#${l.id}</b> redirected Station ${l.from} → Station ${l.to}</span><span class="tag">-${l.avoided} min wait</span></li>`
    ).join('');
  }
}

let netSeed = 42;
renderNetwork(netSeed);

document.getElementById('rerunBtn').addEventListener('click', function(){
  netSeed = Math.floor(Math.random()*100000);
  this.classList.add('spin');
  setTimeout(()=>this.classList.remove('spin'), 500);
  renderNetwork(netSeed);
});
