// ── STATE ──
let S = {
  phase: 'before',
  departTime: null, arriveTime: null, driveMin: 0,
  expQty: 0,
  zones: [],
  zIdx: 0,
  zStart: null,
  cuStart: null, cuEnd: null,
  results: [],
  events: [],
  helpers: [],
  miju: { a1:0, a2:0, a3:0, bTotal:0 },
  finishTime: null,
};

let zoneCfg = loadZoneCfg();
let logs = [];
let helperType = null;
let pendingQty = null;

function loadZoneCfg() {
  const s = localStorage.getItem('zoneCfg');
  if (s) return JSON.parse(s);
  return [
    { id:1, name:'미주', type:'miju', active:true },
    { id:2, name:'힐스테이트', type:'hils', active:true },
    { id:3, name:'대체배송', type:'alt', active:true },
  ];
}
function saveZoneCfg() { localStorage.setItem('zoneCfg', JSON.stringify(zoneCfg)); }

function saveSt() {
  localStorage.setItem('st_' + todayKey(), JSON.stringify(S));
  localStorage.setItem('logs_' + todayKey(), JSON.stringify(logs));
}
function loadSt() {
  const s = localStorage.getItem('st_' + todayKey());
  const l = localStorage.getItem('logs_' + todayKey());
  if (s) {
    S = JSON.parse(s);
    if (S.departTime) S.departTime = new Date(S.departTime);
    if (S.arriveTime) S.arriveTime = new Date(S.arriveTime);
    if (S.zStart) S.zStart = new Date(S.zStart);
    if (S.cuStart) S.cuStart = new Date(S.cuStart);
    if (S.cuEnd) S.cuEnd = new Date(S.cuEnd);
    if (S.finishTime) S.finishTime = new Date(S.finishTime);
  }
  if (l) logs = JSON.parse(l);
}

function todayKey() {
  const d = new Date();
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}
function pad(n) { return String(n).padStart(2,'0'); }
function ft(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function minBetween(a,b) { return Math.round((new Date(b)-new Date(a))/60000); }
function fmtMin(m) { if(m<60) return m+'분'; return Math.floor(m/60)+'시간 '+(m%60)+'분'; }
function effCalc(qty,min) { if(!min||min<=0) return '-'; return Math.round((qty/min)*60); }