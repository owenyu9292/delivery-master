// ══════════════════════════════════════
// 과거 데이터 입력
// ══════════════════════════════════════
let pastZoneCount = 0;

function openPastDataModal() {
  pastZoneCount = 0;
  document.getElementById('past-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('past-depart').value = '';
  document.getElementById('past-arrive').value = '';
  document.getElementById('past-exp-qty').value = '';
  document.getElementById('past-memo').value = '';
  document.getElementById('past-zones-wrap').innerHTML = '';
  // 기본 구역 추가
  zoneCfg.filter(z=>z.active).forEach(z=>addPastZone(z.name, z.type));
  openModal('m-past-data');
}

function addPastZone(name='', type='general') {
  const idx = pastZoneCount++;
  const wrap = document.getElementById('past-zones-wrap');
  const div = document.createElement('div');
  div.className = 'card';
  div.style.marginBottom = '8px';
  div.id = 'past-zone-'+idx;
  div.innerHTML = `
    <div class="row" style="margin-bottom:8px;">
      <input class="inp" value="${name}" placeholder="구역명" id="pz-name-${idx}"
        style="flex:1;margin-bottom:0;font-size:13px;">
      <button onclick="document.getElementById('past-zone-${idx}').remove();"
        style="background:var(--red-dim);border:1px solid rgba(248,81,73,.3);color:var(--red);
        border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px;margin-left:6px;">삭제</button>
    </div>
    <div class="btn-row" style="margin-bottom:8px;">
      <div style="flex:1;">
        <label class="inp-lbl">시작 시각</label>
        <input type="time" class="inp" id="pz-start-${idx}" style="margin-bottom:0;">
      </div>
      <div style="flex:1;margin-left:8px;">
        <label class="inp-lbl">종료 시각</label>
        <input type="time" class="inp" id="pz-end-${idx}" style="margin-bottom:0;">
      </div>
    </div>
    <label class="inp-lbl">배송 수량</label>
    <input type="number" class="inp" id="pz-qty-${idx}" placeholder="수량" inputmode="numeric" style="margin-bottom:0;">
    ${type==='miju' ? `
    <label class="inp-lbl" style="margin-top:8px;">A구간 (1,2,3동) — 예) 45 32 28</label>
    <input type="text" class="inp" id="pz-miju-${idx}" placeholder="45 32 28" style="margin-bottom:0;">
    ` : ''}
  `;
  wrap.appendChild(div);
}

function savePastData() {
  const date = document.getElementById('past-date').value;
  if (!date) { toast('날짜를 입력해주세요'); return; }

  const depart = document.getElementById('past-depart').value;
  const arrive = document.getElementById('past-arrive').value;
  const expQty = parseInt(document.getElementById('past-exp-qty').value)||0;
  const memo = document.getElementById('past-memo').value.trim();

  // 구역 데이터 수집
  const results = [];
  const zones = document.querySelectorAll('[id^="past-zone-"]');
  zones.forEach((z,i)=>{
    const idx = z.id.split('-')[2];
    const name = document.getElementById('pz-name-'+idx)?.value||'';
    const start = document.getElementById('pz-start-'+idx)?.value||'';
    const end = document.getElementById('pz-end-'+idx)?.value||'';
    const qty = parseInt(document.getElementById('pz-qty-'+idx)?.value)||0;
    const mijuRaw = document.getElementById('pz-miju-'+idx)?.value||'';

    if (!name || !qty) return;

    let realMin = 0;
    if (start && end) {
      const [sh,sm] = start.split(':').map(Number);
      const [eh,em] = end.split(':').map(Number);
      realMin = (eh*60+em) - (sh*60+sm);
      if (realMin < 0) realMin += 1440;
    }

    let mijuData = null;
    if (mijuRaw) {
      const parts = mijuRaw.trim().split(/[\s.\-,]+/);
      if (parts.length>=3) {
        mijuData = {
          a1:parseInt(parts[0])||0,
          a2:parseInt(parts[1])||0,
          a3:parseInt(parts[2])||0,
          bTotal: qty-(parseInt(parts[0])||0)-(parseInt(parts[1])||0)-(parseInt(parts[2])||0)
        };
      }
    }

    results.push({
      zIdx: i,
      name,
      type: mijuData ? 'miju' : 'general',
      startTime: date+'T'+(start||'00:00')+':00',
      endTime: date+'T'+(end||'00:00')+':00',
      qty,
      realMin,
      totalMin: realMin+5,
      rEff: realMin>0 ? Math.round((qty/realMin)*60) : '-',
      tEff: (realMin+5)>0 ? Math.round((qty/(realMin+5))*60) : '-',
      cEff: realMin>0 ? Math.round((qty/realMin)*60) : '-',
      eventMin: 0,
      mijuData,
    });
  });

  if (results.length===0) { toast('구역 데이터를 입력해주세요'); return; }

  const totalQty = results.reduce((s,r)=>s+r.qty,0);
  const driveMin = (depart&&arrive) ? (()=>{
    const [dh,dm] = depart.split(':').map(Number);
    const [ah,am] = arrive.split(':').map(Number);
    let m = (ah*60+am)-(dh*60+dm);
    return m<0?m+1440:m;
  })() : 0;

  const pastState = {
    phase:'finished',
    departTime: depart ? date+'T'+depart+':00' : null,
    arriveTime: arrive ? date+'T'+arrive+':00' : null,
    driveMin,
    expQty,
    zones: results.map(r=>({name:r.name,type:r.type,qty:r.qty})),
    results,
    events:[],
    helpers:[],
    miju:{a1:0,a2:0,a3:0,bTotal:0},
    finishTime: results[results.length-1]?.endTime||null,
  };

  const summary = {
    date,
    dayOfWeek: new Date(date).getDay(),
    totalQty,
    expQty,
    scanMiss: totalQty-expQty,
    driveMin,
    overallEff: (() => {
      const allMin = results.reduce((s,r)=>s+r.realMin,0);
      return allMin>0 ? Math.round((totalQty/allMin)*60) : 0;
    })(),
    zones: Object.fromEntries(results.map(r=>[r.name,{
      type:r.type, qty:r.qty, realMin:r.realMin,
      rEff:r.rEff, tEff:r.tEff, cEff:r.cEff,
      mijuData:r.mijuData
    }])),
    eventCount:0,
    memo,
    isPastData: true,
  };

  const reportText = buildPastReportText(date, pastState, summary);
  const data = { date, state:pastState, reportText, summary, savedAt:new Date().toISOString(), isPastData:true };

  localStorage.setItem('report_'+date, JSON.stringify(data));
  const dates = JSON.parse(localStorage.getItem('all_dates')||'[]');
  if (!dates.includes(date)) { dates.push(date); dates.sort(); localStorage.setItem('all_dates',JSON.stringify(dates)); }
  saveToAllData(date, data);

  closeModal('m-past-data');
  toast(date+' 데이터 저장 완료!');
}

function buildPastReportText(date, state, summary) {
  const d = new Date(date);
  const days=['일','월','화','수','목','금','토'];
  let t = `━━━━━━━━━━━━━━━━━━━━━━━━
📦 일일 택배 마스터 Report
━━━━━━━━━━━━━━━━━━━━━━━━
날짜: ${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 ${days[d.getDay()]}요일
※ 과거 데이터 입력

[통합 분석]
총 배송 수량: ${summary.totalQty}개
예상 수량:   ${summary.expQty}개 (스캔미스 +${summary.scanMiss}개)
순수 운전:   진접→청량리 ${fmtMin(summary.driveMin)}
전체 평균:   시간당 ${summary.overallEff}개

[구역별 상세]`;

  state.results.forEach((r,i)=>{
    t += `
${i+1}구역 (${r.name})`;
    if (r.startTime&&r.endTime) {
      t += `
  시작 ${r.startTime.slice(11,16)} ~ 종료 ${r.endTime.slice(11,16)}`;
      t += `
  실제 배송 소요: ${fmtMin(r.realMin)}`;
    }
    t += `
  배송 수량: ${r.qty}개`;
    if (r.mijuData) {
      const aT = r.mijuData.a1+r.mijuData.a2+r.mijuData.a3;
      t += `
  A구간(1,2,3동): ${aT}개`;
      t += `
  B구간(5,6,7,8동): ${r.mijuData.bTotal}개`;
    }
  });

  if (summary.memo) t += `

[메모]
  ${summary.memo}`;
  t += `
━━━━━━━━━━━━━━━━━━━━━━━━`;
  return t;
}

// ══════════════════════════════════════
// PWA 설치
// ══════════════════════════════════════
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('pwa-install-btn');
  const guide = document.getElementById('pwa-guide');
  if (btn) { btn.style.display=''; guide.style.display='none'; }
});

window.addEventListener('appinstalled', ()=>{
  deferredPrompt = null;
  const btn = document.getElementById('pwa-install-btn');
  const msg = document.getElementById('pwa-installed-msg');
  const guide = document.getElementById('pwa-guide');
  if (btn) btn.style.display='none';
  if (msg) msg.style.display='block';
  if (guide) guide.style.display='none';
  toast('앱 설치 완료! 홈화면을 확인해주세요 📱');
});

function installPWA() {
  if (!deferredPrompt) { toast('설치 준비 중... 잠시 후 다시 시도해주세요'); return; }
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(result=>{
    if (result.outcome==='accepted') toast('설치 완료!');
    deferredPrompt = null;
  });
}

// ── 오스캔 ──
function openOscanModal() {
  document.getElementById('oscan-qty').value='';
  document.getElementById('oscan-reason').value='';
  openModal('m-oscan');
}

function saveOscan() {
  const qty = parseInt(document.getElementById('oscan-qty').value)||0;
  const reason = document.getElementById('oscan-reason').value.trim()||'오스캔';
  if (!qty||qty<=0) { toast('차감 수량을 입력해주세요'); return; }

  if (!S.oscan) S.oscan = [];
  S.oscan.push({ zIdx:S.zIdx, qty, reason, time:new Date().toISOString() });
  saveSt();

  addLog('b','오스캔 차감: -'+qty+'개', ft(new Date()), reason, S.zIdx);
  closeModal('m-oscan');

  // 즉시 반영
  renderOscanBox();
  updateRemainQtyWithInput();
  toast('오스캔 -'+qty+'개 차감됨');
}

// 오스캔 현황 박스 항상 렌더링
function renderOscanBox() {
  const box = document.getElementById('gen-auto-box');
  const info = document.getElementById('gen-auto-info');
  if (!box||!info) return;

  const zoneOscan = (S.oscan||[]).filter(o=>o.zIdx===S.zIdx);
  const oscanTotal = zoneOscan.reduce((s,o)=>s+o.qty,0);
  const doneQty = S.results.reduce((s,r)=>s+r.qty,0);
  const totalInput = parseInt(document.getElementById('gen-qty')?.value)||0;

  // 오스캔 없고 입력값도 없으면 숨김
  if (oscanTotal===0 && !totalInput) { info.style.display='none'; return; }

  info.style.display='block';
  let html = '';

  if (totalInput>0) {
    if (S.zIdx>0) {
      html += `<div class="parse-row"><span class="pk">전체 입력</span><span class="pv">${totalInput}개</span></div>`;
      html += `<div class="parse-row"><span class="pk">이전 구역 합계</span><span class="pv">-${doneQty}개</span></div>`;
    }
  }

  if (oscanTotal>0) {
    html += `<div class="parse-row"><span class="pk">오스캔 차감</span><span class="pv" style="color:var(--red);">-${oscanTotal}개</span></div>`;
    zoneOscan.forEach(o=>{
      html += `<div class="parse-row" style="padding-left:8px;"><span class="pk" style="font-size:11px;color:var(--text3);">${o.reason}</span><span class="pv" style="font-size:11px;color:var(--red);">-${o.qty}</span></div>`;
    });
  }

  if (totalInput>0 || oscanTotal>0) {
    const rawQty = S.zIdx>0
      ? totalInput - doneQty - oscanTotal
      : totalInput - oscanTotal;
    if (rawQty < 0) {
      html += `<div class="parse-row" style="border-top:1px solid var(--amber);margin-top:4px;">
        <span class="pk" style="color:var(--amber);">⚠️ 전체수량이 이전구역보다 적음</span>
        <span class="pv" style="color:var(--amber);">${rawQty}개</span>
      </div>`;
    } else {
      html += `<div class="parse-row" style="border-top:1px solid var(--accent);margin-top:4px;">
        <span class="pk" style="color:var(--accent);">실제 배송 수량</span>
        <span class="pv" style="color:var(--accent);font-size:16px;">${rawQty}개</span>
      </div>`;
    }
  } else if (oscanTotal>0) {
    html += `<div class="parse-row"><span class="pk" style="color:var(--text2);">전체 수량 입력 후 최종 확인</span><span class="pv"></span></div>`;
  }

  box.innerHTML = html;
}

// ── 2구역부터 전체수량 자동 계산 ──
function calcAutoQty() {
  renderOscanBox();
  updateRemainQty();
}

function showGenSec() {
  document.getElementById('gen-sec').style.display='block';
  const label = document.getElementById('gen-qty-label');
  if (S.zIdx>0) {
    if (label) label.textContent = '전체 수량 입력 (이전구역 자동 차감)';
  } else {
    if (label) label.textContent = '배송 수량';
  }
  document.getElementById('gen-qty').value='';
  // 현재 구역 오스캔만 표시 (이전 구역 오스캔 숨김)
  const box = document.getElementById('gen-auto-box');
  const info = document.getElementById('gen-auto-info');
  const currentOscan = (S.oscan||[]).filter(o=>o.zIdx===S.zIdx);
  if (currentOscan.length === 0) {
    // 현재 구역 오스캔 없으면 박스 숨김
    if (info) info.style.display='none';
  } else {
    renderOscanBox();
  }
  updateRemainQty();
}