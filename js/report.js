// ── REPORT ──
function buildReport() {
  const n = new Date();
  const days=['일','월','화','수','목','금','토'];
  const dateStr = n.getFullYear()+'년 '+(n.getMonth()+1)+'월 '+n.getDate()+'일 '+days[n.getDay()]+'요일';
  const totalQty = S.results.reduce((s,r)=>s+r.qty,0);
  const scanned = S.expQty;
  const diff = totalQty-scanned;
  const finish = S.finishTime ? new Date(S.finishTime) : n;
  const allRealMin = S.results.reduce((s,r)=>s+r.realMin,0);
  const overallEff = effCalc(totalQty, allRealMin);

  let t = `━━━━━━━━━━━━━━━━━━━━━━━━
📦 일일 택배 마스터 Report
━━━━━━━━━━━━━━━━━━━━━━━━
날짜: ${dateStr}

[통합 분석]
총 배송 수량: ${totalQty}개
예상 수량:   ${scanned}개 (스캔미스 +${diff}개)
전체 업무:   진접 ${ft(new Date(S.departTime))} 출발
             최종 종료 ${ft(finish)}
순수 운전:   진접→청량리 ${fmtMin(S.driveMin)}
전체 평균:   시간당 ${overallEff}개

[구역별 상세]`;

  S.results.forEach((r,i)=>{
    t += `\n${i+1}구역 (${r.name})`;
    t += `\n  시작 ${ft(new Date(r.startTime))} ~ 종료 ${ft(new Date(r.endTime))}`;
    t += `\n  실제 배송 소요: ${fmtMin(r.realMin)}`;
    t += `\n  배송 수량: ${r.qty}개`;
    if (r.type==='miju'&&r.mijuData) {
      const aT = r.mijuData.a1+r.mijuData.a2+r.mijuData.a3;
      // A구간 소요시간 계산 (시작~B구간 시작 추정: A합계/전체*실제시간)
      const aMin = r.realMin>0 ? Math.round(r.realMin*(aT/r.qty)) : 0;
      const bMin = r.realMin - aMin;
      const aEff = aMin>0 ? Math.round((aT/aMin)*60) : '-';
      const bEff = bMin>0 ? Math.round((r.mijuData.bTotal/bMin)*60) : '-';
      t += `\n  A구간(1,2,3동): ${aT}개 / 약 ${fmtMin(aMin)} / ${aEff}개/시간`;
      t += `\n  B구간(5,6,7,8동): ${r.mijuData.bTotal}개 / 약 ${fmtMin(bMin)} / ${bEff}개/시간`;
    }
    if (r.type==='hils'&&r.cuStart&&r.cuEnd) {
      const cm = minBetween(r.cuStart,r.cuEnd);
      t += `\n  정리: ${ft(new Date(r.cuStart))} ~ ${ft(new Date(r.cuEnd))} (${cm}분)`;
    }
    if (r.type==='alt') t += `\n  ⚠️ 비정규 구역`;
    // 오스캔 있으면 표시
    const zoneOscan = (S.oscan||[]).filter(o=>o.zIdx===i);
    if (zoneOscan.length>0) {
      const oTotal = zoneOscan.reduce((s,o)=>s+o.qty,0);
      t += `\n  오스캔 차감: -${oTotal}개`;
    }
  });

  if (S.events.length>0) {
    t += `\n\n[이벤트]`;
    S.events.forEach(e=>{
      t += `\n  ${ft(new Date(e.time))} ${e.type} ${e.min}분`;
      if (e.memo) t += ` · ${e.memo}`;
      t += ` / ${e.zoneName}`;
    });
  }

  t += `\n\n[상세 효율]`;
  S.results.forEach((r,i)=>{
    t += `\n${i+1}구역 ${r.name}:`;
    t += `\n  실제 배송 효율:  시간당 ${r.rEff}개`;
    t += `\n  전체 업무 효율:  시간당 ${r.tEff}개`;
    t += `\n  이벤트 보정 효율: 시간당 ${r.cEff}개`;
  });

  const reg = S.results.filter(r=>r.type!=='alt');
  if (reg.length>0) {
    const rq = reg.reduce((s,r)=>s+r.qty,0);
    const rm = reg.reduce((s,r)=>s+r.realMin,0);
    t += `\n\n[정규 효율 (대체배송 제외)]\n  시간당 ${effCalc(rq,rm)}개`;
  }

  // 도우미 상계
  const givenMin = S.helpers.filter(h=>h.type==='give').reduce((s,h)=>s+h.min,0);
  const tradeCount = S.helpers.filter(h=>h.type==='trade').length;
  if (givenMin>0||tradeCount>0) {
    t += `\n\n[도우미 현황]`;
    if (givenMin>0) t += `\n  도움 제공(무보수): ${fmtMin(givenMin)}`;
    if (tradeCount>0) t += `\n  상계 교환: ${tradeCount}건`;
  }

  t += `\n━━━━━━━━━━━━━━━━━━━━━━━━`;

  document.getElementById('report-box').innerHTML = `
    <div class="report-box">${t}</div>
    <div class="btn-row">
      <button class="btn btn-gray btn-half btn-sm" onclick="copyReport()">📋 복사</button>
      <button class="btn btn-blue btn-half btn-sm" onclick="shareReport()">📤 공유</button>
    </div>
    <button class="btn btn-amber btn-sm" style="margin-top:8px;" onclick="openGmailModal()">📧 Gmail 백업</button>
  `;

  // 로컬 저장
  const key = todayKey();
  const data = {
    date: key,
    state: JSON.parse(JSON.stringify(S)),
    reportText: t,
    savedAt: new Date().toISOString(),
    summary: buildSummary()
  };
  localStorage.setItem('report_'+key, JSON.stringify(data));
  const dates = JSON.parse(localStorage.getItem('all_dates')||'[]');
  if (!dates.includes(key)) { dates.push(key); dates.sort(); localStorage.setItem('all_dates',JSON.stringify(dates)); }

  // 통합 파일 업데이트
  saveToAllData(key, data);
}

function buildSummary() {
  // 분석용 요약 데이터
  const totalQty = S.results.reduce((s,r)=>s+r.qty,0);
  const allRealMin = S.results.reduce((s,r)=>s+r.realMin,0);
  const zoneData = {};
  S.results.forEach(r=>{
    zoneData[r.name] = {
      type: r.type,
      qty: r.qty,
      realMin: r.realMin,
      totalMin: r.totalMin,
      rEff: r.rEff,
      tEff: r.tEff,
      cEff: r.cEff,
      eventMin: r.eventMin,
      mijuData: r.mijuData||null,
    };
  });
  return {
    date: todayKey(),
    dayOfWeek: new Date().getDay(),
    totalQty,
    expQty: S.expQty,
    scanMiss: totalQty - S.expQty,
    driveMin: S.driveMin,
    overallEff: effCalc(totalQty, allRealMin),
    zones: zoneData,
    eventCount: S.events.length,
    eventTypes: S.events.map(e=>e.type),
    helperGiveMin: S.helpers.filter(h=>h.type==='give').reduce((s,h)=>s+h.min,0),
    helperReceive: S.helpers.filter(h=>h.type==='paid'||h.type==='trade').length,
    isHelperDay: totalQty===0 && S.helpers.length>0,
  };
}

function saveToAllData(key, data) {
  try {
    const all = JSON.parse(localStorage.getItem('all_data')||'{}');
    all[key] = data.summary;
    localStorage.setItem('all_data', JSON.stringify(all));
  } catch(e) { console.error('all_data 저장 오류:', e); }
}

function copyReport() {
  const el = document.querySelector('.report-box');
  if (!el) return;
  const text = el.textContent;

  // 방법1: 최신 클립보드 API
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
      .then(()=>toast('📋 복사됐습니다'))
      .catch(()=>fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  // 방법2: textarea 선택 방식 (file:// 환경 포함)
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, 99999);
  try {
    const ok = document.execCommand('copy');
    toast(ok ? '📋 복사됐습니다' : '복사 실패 - 직접 선택해주세요');
  } catch(e) {
    toast('복사 실패 - 직접 선택해주세요');
  }
  document.body.removeChild(ta);
}
function shareReport() {
  const el = document.querySelector('.report-box');
  if (!el) return;
  if (navigator.share && /Android|iPhone/i.test(navigator.userAgent)) {
    navigator.share({title:'배송 마스터 리포트', text:el.textContent});
  } else {
    copyReport();
  }
}
// ── GMAIL 백업 ──
function openGmailModal() {
  const dates = JSON.parse(localStorage.getItem('all_dates')||'[]');
  const list = document.getElementById('gmail-unsent-list');

  if (dates.length===0) {
    list.innerHTML='<div style="text-align:center;color:var(--text2);padding:16px;">저장된 데이터가 없습니다</div>';
    document.getElementById('btn-send-all').style.display='none';
    openModal('m-gmail');
    return;
  }

  const items = dates.map(d=>{
    const data = JSON.parse(localStorage.getItem('report_'+d)||'{}');
    const sent = localStorage.getItem('gmail_sent_'+d);
    return { date:d, sent:!!sent, data };
  }).sort((a,b)=>b.date.localeCompare(a.date));

  const unsentCount = items.filter(i=>!i.sent).length;
  document.getElementById('btn-send-all').style.display = unsentCount>0?'':'none';

  list.innerHTML = items.map(i=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
      <div>
        <div style="font-size:13px;font-weight:600;">${i.date}</div>
        <div style="font-size:11px;color:var(--text2);">${i.data.state?.results?.reduce((s,r)=>s+r.qty,0)||0}개 배송</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        ${i.sent
          ? '<span style="font-size:11px;color:var(--accent);">✅ 전송완료</span>'
          : '<span style="font-size:11px;color:var(--amber);">⬜ 미전송</span>'
        }
        <button class="btn btn-gray btn-sm" style="padding:5px 10px;font-size:11px;" onclick="sendSingleGmail('${i.date}')">전송</button>
      </div>
    </div>
  `).join('');

  openModal('m-gmail');
}

function sendSingleGmail(date) {
  const gmail = localStorage.getItem('gmail')||'';
  if (!gmail) { toast('설정에서 Gmail 주소를 먼저 입력해주세요'); return; }
  const data = JSON.parse(localStorage.getItem('report_'+date)||'{}');
  if (!data.reportText) { toast('리포트 데이터가 없습니다'); return; }

  // mailto 방식 (앱 비밀번호 없이도 기본 메일 앱 열림)
  const subject = encodeURIComponent('배송마스터_'+date);
  const body = encodeURIComponent(data.reportText);
  const mailto = 'mailto:'+gmail+'?subject='+subject+'&body='+body;
  window.open(mailto);

  // 전송 완료 표시
  localStorage.setItem('gmail_sent_'+date, new Date().toISOString());
  toast(date+' 전송 완료');
  setTimeout(()=>openGmailModal(), 500);
}

function sendAllGmail() {
  const dates = JSON.parse(localStorage.getItem('all_dates')||'[]');
  const unsent = dates.filter(d=>!localStorage.getItem('gmail_sent_'+d));
  if (unsent.length===0) { toast('미전송 리포트가 없습니다'); return; }
  // 순차적으로 전송
  unsent.forEach((d,i)=>{
    setTimeout(()=>sendSingleGmail(d), i*1500);
  });
}


// ── SETTINGS ──
function renderSettings() {
  const c = document.getElementById('zone-settings');
  const defaultIds = [1,2,3]; // 기본 구역 ID (삭제 불가)
  c.innerHTML = zoneCfg.map((z,i)=>`
    <div class="card" style="margin-bottom:8px;">
      <div class="row">
        <input value="${z.name}" onchange="zoneCfg[${i}].name=this.value;saveZoneCfg();"
          style="background:transparent;border:none;color:var(--text);font-size:15px;font-weight:600;font-family:inherit;flex:1;outline:none;">
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
            <input type="checkbox" ${z.active?'checked':''} onchange="zoneCfg[${i}].active=this.checked;saveZoneCfg();">
            <span style="font-size:12px;color:var(--text2);">활성</span>
          </label>
          ${!defaultIds.includes(z.id) ? `
          <button onclick="deleteZone(${i})"
            style="background:var(--red-dim);border:1px solid rgba(248,81,73,.3);color:var(--red);
            border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;">삭제</button>
          ` : ''}
        </div>
      </div>
    </div>`).join('');
  const g = localStorage.getItem('gmail')||'';
  document.getElementById('g-email').value = g;
  renderHolidayPattern();
  renderSpecialHolidays();
  renderSettingsCal();
}

function deleteZone(idx) {
  const z = zoneCfg[idx];
  if (!z) return;
  if (!confirm(z.name+' 구역을 삭제하시겠습니까?')) return;
  zoneCfg.splice(idx, 1);
  saveZoneCfg();
  renderSettings();
  toast(z.name+' 구역 삭제됨');
}

function addZoneSetting() {
  zoneCfg.push({id:Date.now(),name:'새 구역',type:'general',active:true});
  saveZoneCfg(); renderSettings();
}

function saveGmail() {
  const e = document.getElementById('g-email').value.trim();
  if (!e) { toast('Gmail 주소를 입력해주세요'); return; }
  localStorage.setItem('gmail', e);
  localStorage.setItem('gpass', document.getElementById('g-pass').value);
  toast('Gmail 설정 저장 완료');
}

// ── EXPORT/IMPORT ──
function doExport() {
  try {
    const dates = JSON.parse(localStorage.getItem('all_dates')||'[]');
    if (dates.length===0) { toast('저장된 데이터가 없습니다'); return; }
    const all = dates.map(d=>{
      const raw = localStorage.getItem('report_'+d);
      return raw ? JSON.parse(raw) : null;
    }).filter(Boolean);

    // 통합 파일 (Claude 분석용)
    const allData = JSON.parse(localStorage.getItem('all_data')||'{}');

    const exportObj = {
      exportedAt: new Date().toISOString(),
      totalDays: all.length,
      summaries: allData,   // 분석용 요약 (Claude에게 줄 것)
      details: all,         // 상세 데이터 전체
    };

    const jsonStr = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([jsonStr], {type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '배송마스터_전체_'+todayKey()+'.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
    toast('내보내기 완료 · '+all.length+'일치');
  } catch(e) {
    toast('내보내기 오류: '+e.message);
  }
}

function doImport() {
  try {
    const inp = document.createElement('input');
    inp.type='file';
    inp.accept='.json';
    inp.style.display='none';
    document.body.appendChild(inp);
    inp.onchange = e=>{
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = ev=>{
        try {
          const d = JSON.parse(ev.target.result);
          const arr = Array.isArray(d)?d:[d];
          let count = 0;
          arr.forEach(item=>{
            if (item && item.date) {
              localStorage.setItem('report_'+item.date, JSON.stringify(item));
              const dates = JSON.parse(localStorage.getItem('all_dates')||'[]');
              if (!dates.includes(item.date)) {
                dates.push(item.date);
                dates.sort();
                localStorage.setItem('all_dates', JSON.stringify(dates));
              }
              count++;
            }
          });
          toast(count+'일치 가져오기 완료');
        } catch(e) {
          toast('파일 형식 오류: '+e.message);
        }
        document.body.removeChild(inp);
      };
      r.onerror = ()=>{ toast('파일 읽기 오류'); document.body.removeChild(inp); };
      r.readAsText(f, 'utf-8');
    };
    inp.click();
  } catch(e) {
    toast('가져오기 오류: '+e.message);
  }
}

// ── RESET ──
function openResetModal() { openModal('m-reset'); }

function doResetConfirmed() {
  closeModal('m-reset');
  // 즉시 실행 - confirm() 없음
  const tKey = todayKey();
  localStorage.removeItem('st_'+tKey);
  localStorage.removeItem('logs_'+tKey);
  localStorage.removeItem('report_'+tKey);
  // all_data에서도 삭제
  try {
    const allData = JSON.parse(localStorage.getItem('all_data')||'{}');
    delete allData[tKey];
    localStorage.setItem('all_data', JSON.stringify(allData));
    const dates = JSON.parse(localStorage.getItem('all_dates')||'[]');
    const newDates = dates.filter(d=>d!==tKey);
    localStorage.setItem('all_dates', JSON.stringify(newDates));
  } catch(e) {}
  S = {
    phase:'before', departTime:null, arriveTime:null, driveMin:0,
    expQty:0, zones:[], zIdx:0, zStart:null,
    cuStart:null, cuEnd:null, results:[], events:[], helpers:[],
    miju:{a1:0,a2:0,a3:0,bTotal:0}, finishTime:null,
  };
  logs=[];
  pendingQty=null;
  helperType=null;

  ['before','driving','setup','working','between','done'].forEach(s=>{
    const el=document.getElementById('s-'+s);
    if(el) el.style.display='none';
  });
  document.getElementById('s-before').style.display='block';
  document.getElementById('btn-depart').disabled=false;
  document.getElementById('exp-qty').value='';
  document.getElementById('hils-choice').style.display='none';
  document.getElementById('hils-cleanup').style.display='none';
  document.getElementById('miju-sec').style.display='none';
  document.getElementById('gen-sec').style.display='none';

  // 버튼 전체 초기화
  document.getElementById('btn-depart').disabled = false;
  document.getElementById('btn-arrive').disabled = false;
  const cuEnd = document.getElementById('btn-cu-end');
  if (cuEnd) cuEnd.disabled = false;
  const zoneEnd = document.getElementById('btn-zone-end');
  if (zoneEnd) zoneEnd.disabled = false;

  setSt('','업무 시작 전','진접 출발 버튼을 눌러 시작하세요');
  gotoPage('main');
  renderLog();
  toast('초기화 완료');
}

// 구버전 호환
function doReset(x) { openResetModal(); }

// ── LOG ──
function addLog(dot, title, time, detail, zIdx, isEvent) {
  logs.push({dot, title, time, detail, zIdx, isEvent:!!isEvent});
  saveSt();
}
function renderLog() {
  const c = document.getElementById('log-box');
  if (!logs.length) {
    c.innerHTML='<div class="empty"><div class="empty-icon">📋</div><div class="empty-txt">아직 기록이 없습니다</div></div>';
    return;
  }
  c.innerHTML = logs.map((l,i)=>`
    <div class="log-item">
      <div class="log-dot ${l.dot}"></div>
      <div class="log-body">
        <div class="log-title">${l.title}</div>
        <div class="log-time">${l.time}</div>
        ${l.detail?`<div class="log-detail">${l.detail}</div>`:''}
        <div style="display:flex;gap:6px;margin-top:5px;flex-wrap:wrap;">
          ${l.dot==='g'&&l.zIdx!==undefined?`
            <button onclick="openLogEvent(${l.zIdx})"
              style="background:var(--amber-dim);border:1px solid rgba(210,153,34,.3);color:var(--amber);
              border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;">⚠️ 이벤트 추가</button>
            <button onclick="openLogHelper(${l.zIdx})"
              style="background:rgba(188,140,255,.12);border:1px solid rgba(188,140,255,.3);color:var(--purple);
              border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;">🤝 도우미 추가</button>
          `:''}
          ${l.dot==='a'&&l.isEvent?
            `<button onclick="removeEventByLogIdx(${i})"
              style="background:var(--red-dim);border:1px solid rgba(248,81,73,.3);color:var(--red);
              border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;">삭제</button>`
            :''}
          ${l.dot==='p'?
            `<button onclick="removeHelperByLogIdx(${i})"
              style="background:var(--red-dim);border:1px solid rgba(248,81,73,.3);color:var(--red);
              border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;">취소</button>`
            :''}
        </div>
      </div>
    </div>`).join('');
}

// ── 로그 이벤트 추가 ──
let logEventZoneIdx = null;

function openLogEvent(zIdx) {
  logEventZoneIdx = zIdx;
  const zone = S.zones[zIdx];
  const info = document.getElementById('log-event-zone-info');
  if (info) info.textContent = (zIdx+1)+'구역 · '+(zone?.name||'');
  document.getElementById('log-ev-type').value='';
  document.getElementById('log-ev-min').value='';
  document.getElementById('log-ev-memo').value='';
  openModal('m-log-event');
}

function setLogEvType(t) { document.getElementById('log-ev-type').value=t; }

function saveLogEvent() {
  const type = document.getElementById('log-ev-type').value.trim();
  const min = parseInt(document.getElementById('log-ev-min').value)||0;
  const memo = document.getElementById('log-ev-memo').value.trim();

  if (!type) { toast('이벤트 종류를 입력해주세요'); return; }
  if (logEventZoneIdx === null) { toast('구역 정보 없음'); return; }

  const zone = S.zones[logEventZoneIdx];
  const ev = {
    zIdx: logEventZoneIdx,
    zoneName: zone?.name||'',
    type, min, memo,
    time: new Date().toISOString(),
    addedFromLog: true,
  };
  S.events.push(ev);

  // 해당 구역 결과 보정 효율 재계산
  const result = S.results.find(r=>r.zIdx===logEventZoneIdx);
  if (result) {
    const zoneEvents = S.events.filter(e=>e.zIdx===logEventZoneIdx);
    result.eventMin = zoneEvents.reduce((s,e)=>s+(e.min||0),0);
    result.correctedMin = result.realMin - result.eventMin;
    result.cEff = result.correctedMin>0 ? effCalc(result.qty, result.correctedMin) : '-';
  }

  saveSt();
  // 해당 구역 완료 로그 바로 아래에 삽입
  insertLogAfterZone(logEventZoneIdx, {
    dot:'a', title:'이벤트(추가): '+type,
    time: ft(new Date(ev.time)),
    detail: min+'분'+(memo?' · '+memo:''),
    zIdx: logEventZoneIdx,
    isEvent: true
  });
  closeModal('m-log-event');
  renderLog();
  toast('이벤트 추가 완료 · 보정 효율 재계산됨');
}

let logHelperZoneIdx = null;

function openLogHelper(zIdx) {
  logHelperZoneIdx = zIdx;
  helperType = null;
  // 도우미 박스 초기화
  ['give','paid','trade'].forEach(h=>{
    const box = document.getElementById('h-'+h+'-box');
    const btn = document.getElementById('h-'+h+'-btn');
    if (box) box.style.display='none';
    if (btn) btn.style.opacity='0.5';
  });
  const hMin = document.getElementById('h-min');
  if (hMin) hMin.value='';
  // 저장 버튼을 로그용으로 교체
  const saveBtn = document.querySelector('#m-helper .btn-blue');
  if (saveBtn) saveBtn.setAttribute('onclick','saveLogHelper()');
  openModal('m-helper');
}

function saveLogHelper() {
  if (!helperType) { toast('유형을 선택해주세요'); return; }
  const min = helperType==='give' ? parseInt(document.getElementById('h-min').value)||0 : 0;
  const labels = {give:'도움 제공(무보수)', paid:'유료 도움 받기', trade:'상계 교환'};
  const zIdx = logHelperZoneIdx !== null ? logHelperZoneIdx : S.zIdx;
  const id = Date.now();
  S.helpers.push({ id, type:helperType, min, zIdx, time:new Date().toISOString() });
  saveSt();

  insertLogAfterZone(zIdx, {
    dot:'p',
    title:'도우미: '+labels[helperType],
    time: ft(new Date()),
    detail: helperType==='give' ? min+'분' : '',
    zIdx,
    isEvent: false
  });

  closeModal('m-helper');
  // 저장 버튼 원래대로 복원
  const saveBtn = document.querySelector('#m-helper .btn-blue');
  if (saveBtn) saveBtn.setAttribute('onclick','saveHelper()');
  logHelperZoneIdx = null;
  renderLog();
  toast('도우미 추가 완료');
}

function insertLogAfterZone(zIdx, logItem) {
  // 해당 구역 완료 로그 위치 찾기
  // 구역 완료 로그는 dot='g'이고 zIdx가 일치하는 것
  let insertIdx = -1;
  for (let i=0; i<logs.length; i++) {
    if (logs[i].dot==='g' && logs[i].zIdx===zIdx) {
      insertIdx = i;
      break;
    }
  }
  if (insertIdx === -1) {
    // 못 찾으면 맨 뒤에 추가
    logs.push(logItem);
  } else {
    // 해당 구역 완료 로그 다음에
    // 이미 있는 이벤트들 뒤에 삽입
    let pos = insertIdx + 1;
    while (pos < logs.length && logs[pos].zIdx===zIdx && logs[pos].isEvent) {
      pos++;
    }
    logs.splice(pos, 0, logItem);
  }
  saveSt();
}

function removeEventByLogIdx(logIdx) {
  // 해당 로그의 이벤트 순서 찾기
  const evLogCount = logs.slice(0, logIdx+1).filter(l=>l.dot==='a').length;
  const evIdx = evLogCount - 1;
  if (evIdx < 0 || evIdx >= S.events.length) { toast('이벤트를 찾을 수 없습니다'); return; }

  const ev = S.events[evIdx];
  const zIdx = ev.zIdx;

  // 이벤트 삭제
  S.events.splice(evIdx, 1);
  logs.splice(logIdx, 1);

  // 해당 구역 보정 효율 재계산
  const result = S.results.find(r=>r.zIdx===zIdx);
  if (result) {
    const zoneEvents = S.events.filter(e=>e.zIdx===zIdx);
    result.eventMin = zoneEvents.reduce((s,e)=>s+(e.min||0),0);
    result.correctedMin = result.realMin - result.eventMin;
    result.cEff = result.correctedMin>0 ? effCalc(result.qty, result.correctedMin) : '-';
  }

  saveSt();
  renderLog();
  toast('이벤트 삭제됨 · 보정 효율 재계산됨');
}

function removeHelperByLogIdx(logIdx) {
  // 도우미 로그 순서로 helpers에서 제거
  const helperLogCount = logs.slice(0,logIdx+1).filter(l=>l.dot==='p').length;
  if (S.helpers.length>=helperLogCount) {
    const helperIdx = helperLogCount-1;
    S.helpers.splice(helperIdx,1);
    logs.splice(logIdx,1);
    saveSt();
    renderLog();
    toast('도우미 기록 취소됨');
  } else {
    // helpers에 없어도 로그는 삭제
    logs.splice(logIdx,1);
    saveSt();
    renderLog();
    toast('기록 취소됨');
  }
}

// ── MODAL ──
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── TOAST ──
function toast(msg) {
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2500);
}

// ── RESTORE STATE ──
function restoreState() {
  switch(S.phase) {
    case 'driving':
      document.getElementById('depart-disp').textContent = ft(new Date(S.departTime));
      showStep('driving');
      setSt('driving','운전 중','진접 → 청량리');
      break;
    case 'zone_setup':
      document.getElementById('drv-result').textContent = fmtMin(S.driveMin);
      document.getElementById('exp-disp').textContent = S.expQty+'개';
      renderZoneOrder();
      showStep('setup');
      setSt('active','구역 설정 중','');
      break;
    case 'working':
      const z = S.zones[S.zIdx];
      if (!z) return;
      document.getElementById('wz-badge').textContent=(S.zIdx+1)+'구역';
      document.getElementById('wz-name').textContent=z.name;
      document.getElementById('wz-start').textContent=ft(new Date(S.zStart));
      if (z.type==='hils') {
        document.getElementById('hils-cleanup').style.display='block';
        if (S.cuStart) document.getElementById('cu-start').textContent=ft(new Date(S.cuStart));
        if (S.cuEnd) {
          document.getElementById('cu-end').textContent=ft(new Date(S.cuEnd));
          document.getElementById('btn-cu-end').disabled=true;
          document.getElementById('gen-sec').style.display='block';
        }
      } else if (z.type==='miju') {
        document.getElementById('miju-sec').style.display='block';
      } else {
        document.getElementById('gen-sec').style.display='block';
      }
      showStep('working');
      updateRemainQty();
      setSt('active',(S.zIdx+1)+'구역 · '+z.name+' 작업중','복구됨');
      break;
    case 'between': showStep('between'); break;
    case 'finished': showStep('done'); buildReport(); break;
  }
}

// ── 키패드 자동 닫힘 ──
function blurAll() { document.activeElement && document.activeElement.blur(); }

// 예상수량 엔터
document.addEventListener('DOMContentLoaded', ()=>{
  const expQty = document.getElementById('exp-qty');
  if (expQty) expQty.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key==='Go'||e.keyCode===13){ blurAll(); setTimeout(doDepart,100); }});

  // 미주 A구간 엔터 → 다음 입력창으로
  const mijuA = document.getElementById('miju-a');
  if (mijuA) mijuA.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.keyCode===13){ blurAll(); document.getElementById('miju-total').focus(); }});

  // 미주 전체수량 엔터 → 키패드 닫힘
  const mijuT = document.getElementById('miju-total');
  if (mijuT) mijuT.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.keyCode===13){ blurAll(); }});

  // 일반수량 엔터 → 키패드 닫힘
  const genQty = document.getElementById('gen-qty');
  if (genQty) genQty.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.keyCode===13){ blurAll(); }});

  // 입력창 외부 터치 시 키패드 닫힘
  document.addEventListener('touchstart', e=>{
    if (!e.target.matches('input, textarea')) blurAll();
  }, { passive: true });
});