// ══════════════════════════════════════
// 분석 시스템
// ══════════════════════════════════════

let currentWeekOffset = 0;
let currentMonthOffset = 0;

// 주차 기준: 일요일~토요일
function getWeekRange(offset) {
  const now = new Date();
  const day = now.getDay(); // 0=일
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - day + (offset * 7));
  sunday.setHours(0,0,0,0);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  return { start: sunday, end: saturday };
}

function getMonthRange(offset) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset;
  const start = new Date(y, m, 1);
  const end = new Date(y, m+1, 0);
  return { start, end };
}

function dateStr(d) {
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}

function getDatesInRange(start, end) {
  const dates = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(dateStr(cur));
    cur.setDate(cur.getDate()+1);
  }
  return dates;
}

function getAllData() {
  return JSON.parse(localStorage.getItem('all_data')||'{}');
}

function getReportData(date) {
  const raw = localStorage.getItem('report_'+date);
  return raw ? JSON.parse(raw) : null;
}

// 서브탭 전환
function showRTab(tab) {
  ['today','week','month','search'].forEach(t=>{
    document.getElementById('rtab-'+t+'-content').style.display = t===tab?'block':'none';
    document.getElementById('rtab-'+t).classList.toggle('active', t===tab);
  });
  if (tab==='week') renderWeek();
  if (tab==='month') renderMonth();
  if (tab==='search') initSearch();
}

// ── 주간 분석 ──
function changeWeek(dir) {
  currentWeekOffset += dir;
  renderWeek();
}

function renderWeek() {
  const { start, end } = getWeekRange(currentWeekOffset);
  const days = ['일','월','화','수','목','금','토'];
  const titleEl = document.getElementById('week-title');
  titleEl.textContent = (start.getMonth()+1)+'월 '+start.getDate()+'일 ~ '+(end.getMonth()+1)+'월 '+end.getDate()+'일';

  const allData = getAllData();
  const dates = getDatesInRange(start, end);
  const workDates = dates.filter(d => allData[d]);

  if (workDates.length===0) {
    document.getElementById('week-content').innerHTML =
      '<div class="empty"><div class="empty-icon">📭</div><div class="empty-txt">이 주에 데이터가 없습니다</div></div>';
    return;
  }

  // 주간 통계 계산
  const totalQty = workDates.reduce((s,d)=>s+(allData[d].totalQty||0),0);
  const avgEff = workDates.reduce((s,d)=>s+(allData[d].overallEff||0),0) / workDates.length;
  const totalScanMiss = workDates.reduce((s,d)=>s+(allData[d].scanMiss||0),0);

  // 구역별 통계
  const zoneStats = {};
  workDates.forEach(d=>{
    const zones = allData[d].zones||{};
    Object.entries(zones).forEach(([name, z])=>{
      if (!zoneStats[name]) zoneStats[name] = {qty:0, realMin:0, days:0};
      zoneStats[name].qty += z.qty||0;
      zoneStats[name].realMin += z.realMin||0;
      zoneStats[name].days++;
    });
  });

  let html = `
  <div class="stat-grid">
    <div class="stat-box">
      <div class="stat-lbl">총 배송</div>
      <div class="stat-val" style="color:var(--accent);">${totalQty}</div>
      <div class="stat-sub">개</div>
    </div>
    <div class="stat-box">
      <div class="stat-lbl">근무일</div>
      <div class="stat-val" style="color:var(--accent2);">${workDates.length}</div>
      <div class="stat-sub">일</div>
    </div>
    <div class="stat-box">
      <div class="stat-lbl">평균 효율</div>
      <div class="stat-val" style="color:var(--amber);">${Math.round(avgEff)||'-'}</div>
      <div class="stat-sub">개/시간</div>
    </div>
    <div class="stat-box">
      <div class="stat-lbl">스캔미스</div>
      <div class="stat-val" style="color:var(--purple);">${totalScanMiss}</div>
      <div class="stat-sub">개</div>
    </div>
  </div>

  <div class="sec-title" style="margin:12px 0 8px;">구역별 효율</div>`;

  Object.entries(zoneStats).forEach(([name, z])=>{
    const eff = z.realMin>0 ? Math.round((z.qty/z.realMin)*60) : 0;
    html += `<div class="card" style="margin-bottom:8px;">
      <div class="row">
        <span style="font-weight:600;">${name}</span>
        <span class="badge badge-green">${eff}개/시간</span>
      </div>
      <div class="row"><span class="lbl">총 배송</span><span class="val dim">${z.qty}개</span></div>
      <div class="row"><span class="lbl">근무일</span><span class="val dim">${z.days}일</span></div>
    </div>`;
  });

  html += `<div class="sec-title" style="margin:12px 0 8px;">일별 현황</div>`;
  dates.forEach(d=>{
    const data = allData[d];
    const holiday = isHoliday(d);
    const dow = new Date(d).getDay();
    html += `<div class="card" style="margin-bottom:6px;">
      <div class="row">
        <span style="font-size:13px;font-weight:600;">${d.slice(5)} (${days[dow]})</span>
        ${data
          ? `<span class="badge badge-green">${data.totalQty}개</span>`
          : holiday
            ? `<span class="badge badge-red">${holiday}</span>`
            : `<span style="font-size:11px;color:var(--text3);">데이터 없음</span>`
        }
      </div>
      ${data ? `<div class="row"><span class="lbl">효율</span><span class="val dim">${data.overallEff||'-'}개/시간</span></div>` : ''}
    </div>`;
  });

  document.getElementById('week-content').innerHTML = html;
}

// ── 월간 분석 ──
function changeMonth(dir) {
  currentMonthOffset += dir;
  renderMonth();
}

function renderMonth() {
  const { start, end } = getMonthRange(currentMonthOffset);
  const y = start.getFullYear();
  const m = start.getMonth()+1;
  document.getElementById('month-title').textContent = y+'년 '+m+'월';

  const allData = getAllData();
  const dates = getDatesInRange(start, end);
  const workDates = dates.filter(d=>allData[d] && !allData[d].isHelperDay && allData[d].totalQty>0);

  if (workDates.length===0) {
    document.getElementById('month-content').innerHTML =
      '<div class="empty"><div class="empty-icon">📭</div><div class="empty-txt">이 달에 데이터가 없습니다</div></div>';
    return;
  }

  const totalQty = workDates.reduce((s,d)=>s+(allData[d].totalQty||0),0);
  // 비정상 효율 제외 (overallEff > 300 이상은 제외)
  const validEffDates = workDates.filter(d=>(allData[d].overallEff||0) < 300 && (allData[d].overallEff||0) > 0);
  const avgEff = validEffDates.length > 0
    ? Math.round(validEffDates.reduce((s,d)=>s+(allData[d].overallEff||0),0) / validEffDates.length)
    : 0;
  const totalScanMiss = workDates.reduce((s,d)=>s+(allData[d].scanMiss||0),0);
  const maxDay = workDates.reduce((a,b)=>(allData[a]?.totalQty||0)>(allData[b]?.totalQty||0)?a:b);
  const minDay = workDates.reduce((a,b)=>(allData[a]?.totalQty||0)<(allData[b]?.totalQty||0)?a:b);

  // 구역별 월간 통계
  const zoneStats = {};
  workDates.forEach(d=>{
    const zones = allData[d].zones||{};
    Object.entries(zones).forEach(([name,z])=>{
      if (!zoneStats[name]) zoneStats[name]={qty:0,realMin:0,days:0,effs:[]};
      zoneStats[name].qty+=z.qty||0;
      zoneStats[name].realMin+=z.realMin||0;
      zoneStats[name].days++;
      // 비정상 효율 필터링 (realMin < 5분이면 제외)
      if(z.rEff&&z.rEff!=='-'&&z.realMin>=5) zoneStats[name].effs.push(z.rEff);
    });
  });

  // 요일별 평균
  const dowStats = Array(7).fill(null).map(()=>({qty:0,cnt:0}));
  const dowNames = ['일','월','화','수','목','금','토'];
  workDates.forEach(d=>{
    const dow = new Date(d).getDay();
    dowStats[dow].qty += allData[d].totalQty||0;
    dowStats[dow].cnt++;
  });

  let html = `
  <div class="stat-grid">
    <div class="stat-box">
      <div class="stat-lbl">총 배송</div>
      <div class="stat-val" style="color:var(--accent);">${totalQty}</div>
      <div class="stat-sub">개</div>
    </div>
    <div class="stat-box">
      <div class="stat-lbl">근무일</div>
      <div class="stat-val" style="color:var(--accent2);">${workDates.length}</div>
      <div class="stat-sub">일</div>
    </div>
    <div class="stat-box">
      <div class="stat-lbl">평균 효율</div>
      <div class="stat-val" style="color:var(--amber);">${avgEff||'-'}</div>
      <div class="stat-sub">개/시간</div>
    </div>
    <div class="stat-box">
      <div class="stat-lbl">스캔미스</div>
      <div class="stat-val" style="color:var(--purple);">${totalScanMiss}</div>
      <div class="stat-sub">개</div>
    </div>
  </div>

  <div class="card" style="margin-bottom:10px;">
    <div class="eff-row"><span class="eff-lbl">최다 배송일</span><span class="eff-val" style="color:var(--accent);">${maxDay} (${allData[maxDay]?.totalQty}개)</span></div>
    <div class="eff-row"><span class="eff-lbl">최소 배송일</span><span class="eff-val" style="color:var(--text2);">${minDay} (${allData[minDay]?.totalQty}개)</span></div>
    <div class="eff-row"><span class="eff-lbl">일 평균 배송</span><span class="eff-val" style="color:var(--accent2);">${Math.round(totalQty/workDates.length)}개</span></div>
  </div>

  <div class="sec-title" style="margin:12px 0 8px;">구역별 월간 효율</div>`;

  Object.entries(zoneStats).forEach(([name,z])=>{
    const eff = z.realMin>0 ? Math.round((z.qty/z.realMin)*60) : 0;
    const avgEff2 = z.effs.length>0 ? Math.round(z.effs.reduce((a,b)=>a+b,0)/z.effs.length) : eff;
    html += `<div class="card" style="margin-bottom:8px;">
      <div class="row"><span style="font-weight:600;">${name}</span><span class="badge badge-green">${avgEff2}개/시간</span></div>
      <div class="row"><span class="lbl">월 총 배송</span><span class="val dim">${z.qty}개</span></div>
      <div class="row"><span class="lbl">근무일</span><span class="val dim">${z.days}일</span></div>
    </div>`;
  });

  html += `<div class="sec-title" style="margin:12px 0 8px;">요일별 평균</div>
  <div class="card">`;
  dowNames.forEach((name,i)=>{
    if (dowStats[i].cnt>0) {
      const avg = Math.round(dowStats[i].qty/dowStats[i].cnt);
      html += `<div class="eff-row">
        <span class="eff-lbl">${name}요일 (${dowStats[i].cnt}일)</span>
        <span class="eff-val" style="color:var(--accent);">${avg}개/일</span>
      </div>`;
    }
  });
  html += '</div>';

  document.getElementById('month-content').innerHTML = html;
}

// ── 날짜 조회 ──
function initSearch() {
  const today = todayKey();
  document.getElementById('search-date').value = today;
  searchDate();
}

function searchDate() {
  const date = document.getElementById('search-date').value;
  if (!date) return;
  const data = getReportData(date);
  const el = document.getElementById('search-result');

  if (!data) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><div class="empty-txt">해당 날짜 데이터가 없습니다</div></div>';
    return;
  }

  const t = data.reportText||'';
  el.innerHTML = `
    <div class="report-box">${t}</div>
    <button class="btn btn-gray btn-sm" onclick="fallbackCopy(document.querySelector('.report-box').textContent)" style="margin-top:8px;">📋 복사</button>
  `;
}