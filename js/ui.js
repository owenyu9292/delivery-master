// ── CLOCK ──
function startClock() {
  setInterval(() => {
    const n = new Date();
    document.getElementById('live-clock').textContent = pad(n.getHours())+':'+pad(n.getMinutes())+':'+pad(n.getSeconds());
    if (S.phase==='driving'&&S.departTime) {
      const d = Math.floor((n-new Date(S.departTime))/1000);
      const el = document.getElementById('drv-elapsed');
      if (el) el.textContent = pad(Math.floor(d/60))+':'+pad(d%60);
    }
    if (S.phase==='working'&&S.zStart) {
      const d = Math.floor((n-new Date(S.zStart))/1000);
      const el = document.getElementById('wz-elapsed');
      if (el) el.textContent = pad(Math.floor(d/60))+':'+pad(d%60);
    }
  }, 1000);
}

function initDate() {
  const n = new Date();
  const days = ['일','월','화','수','목','금','토'];
  document.getElementById('today-txt').textContent =
    n.getFullYear()+'년 '+(n.getMonth()+1)+'월 '+n.getDate()+'일 '+days[n.getDay()]+'요일';
}

// ── PAGE ──
function gotoPage(id) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  ['main','log','report','settings'].forEach((n,i)=>{
    document.querySelectorAll('.nav-tab')[i].classList.toggle('active', n===id);
  });
  if (id==='log') renderLog();
  if (id==='settings') renderSettings();
  if (id==='report') showRTab('today');
}

function showStep(id) {
  ['before','driving','setup','working','between','done'].forEach(s=>{
    const el = document.getElementById('s-'+s);
    if (el) el.style.display = 'none';
  });
  const t = document.getElementById('s-'+id);
  if (t) t.style.display = 'block';
}

function setSt(dotCls, txt, sub) {
  const d = document.getElementById('sdot');
  d.className = 'status-dot' + (dotCls?' '+dotCls:'');
  document.getElementById('stxt').textContent = txt;
  document.getElementById('ssub').textContent = sub||'';
}