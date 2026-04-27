// ── DEPART ──
function doDepart() {
  const btn = document.getElementById('btn-depart');
  btn.disabled = true;
  const qtyRaw = document.getElementById('exp-qty').value.trim();
  const qty = parseInt(qtyRaw)||0;

  // 빈칸 방지
  if (qtyRaw === '') {
    toast('예상 수량을 입력해주세요');
    btn.disabled = false;
    return;
  }

  // 0 입력시 무보수 확인팝업
  if (qty === 0) {
    if (!confirm('수량 0 = 무보수 도우미 날로 설정합니다.\n계속하시겠습니까?')) {
      btn.disabled = false;
      return;
    }
  }

  // 오늘 자료 이미 있으면 경고 (일반 업무만)
  if (qty > 0) {
    const todayReport = localStorage.getItem('report_'+todayKey());
    if (todayReport) {
      if (!confirm('오늘 자료가 이미 저장되어 있습니다!\n새로 시작하면 기존 자료가 덮어씌워집니다.\n계속하시겠습니까?')) {
        btn.disabled = false;
        return;
      }
    }
  }

  S.departTime = new Date();
  S.expQty = qty;
  S.phase = 'driving';

  if (qty === 0) {
    S.isHelperDay = true;
    saveSt();
    addLog('p','진접 출발 (무보수 도우미)',ft(S.departTime),'수량 없음 · 시간만 기록');
    document.getElementById('depart-disp').textContent = ft(S.departTime);
    showStep('driving');
    setSt('driving','운전 중 (무보수 도우미)','진접 → 청량리');
    toast('출발! 오늘은 무보수 도우미 날 🤝');
  } else {
    S.isHelperDay = false;
    saveSt();
    addLog('g','진접 출발',ft(S.departTime),'예상 수량: '+qty+'개');
    document.getElementById('depart-disp').textContent = ft(S.departTime);
    showStep('driving');
    setSt('driving','운전 중','진접 → 청량리');
    toast('출발! 안전운전하세요 🚗');
  }
}


// ── ARRIVE ──
function doArrive() {
  const btn = document.getElementById('btn-arrive');
  btn.disabled = true;
  S.arriveTime = new Date();
  S.driveMin = minBetween(S.departTime, S.arriveTime);
  S.phase = 'zone_setup';
  // 구역 초기화
  S.zones = zoneCfg.filter(z=>z.active).map(z=>({...z, qty:0, startTime:null, endTime:null}));
  saveSt();
  addLog('b','청량리 도착',ft(S.arriveTime),'운전: '+fmtMin(S.driveMin));
  document.getElementById('drv-result').textContent = fmtMin(S.driveMin);
  document.getElementById('exp-disp').textContent = S.expQty+'개';
  renderZoneOrder();
  showStep('setup');
  setSt('active','구역 설정 중','오늘 구역 순서를 설정하세요');
  toast('도착! 운전 '+fmtMin(S.driveMin));
}

// ── ZONE ORDER ──
function renderZoneOrder() {
  const c = document.getElementById('zone-order');
  c.innerHTML = S.zones.map((z,i)=>`
    <div class="zone-card">
      <div class="zone-num on">${i+1}</div>
      <div class="zone-info">
        <div class="zone-name">${z.name}</div>
        <div class="zone-sub">${zTypeLabel(z.type)}</div>
      </div>
      <div class="zone-actions">
        ${i>0?`<button class="zone-mv" onclick="mvZone(${i},-1)">↑</button>`:''}
        ${i<S.zones.length-1?`<button class="zone-mv" onclick="mvZone(${i},1)">↓</button>`:''}
      </div>
    </div>
  `).join('');
}

function mvZone(i, dir) {
  const j = i+dir;
  if (j<0||j>=S.zones.length) return;
  [S.zones[i],S.zones[j]] = [S.zones[j],S.zones[i]];
  renderZoneOrder();
}

function zTypeLabel(t) {
  if (t==='miju') return '동별 수량 입력 (A/B구간)';
  if (t==='hils') return '오피스텔 · 정리 포함';
  if (t==='alt') return '비정규 구역';
  return '일반';
}

// ── START ZONE ──
function startFirstZone() { S.zIdx=0; startZone(); }
function doNextZone() { S.zIdx++; if(S.zIdx>=S.zones.length){doFinish();return;} startZone(); }

function startZone() {
  const z = S.zones[S.zIdx];
  S.zStart = new Date();
  S.cuStart = null; S.cuEnd = null;
  S.phase = 'working';
  z.startTime = S.zStart;
  saveSt();

  document.getElementById('wz-badge').textContent = (S.zIdx+1)+'구역';
  document.getElementById('wz-name').textContent = z.name;
  document.getElementById('wz-start').textContent = ft(S.zStart);

  // 이전구역 종료시각 저장 (이동시간 계산용)
  const prevEnd = S.zIdx>0&&S.results[S.zIdx-1]
    ? new Date(S.results[S.zIdx-1].endTime) : S.arriveTime;
  S.moveStartTime = new Date(prevEnd);

  // 힐스 또는 대체배송 = 정리선택 화면
  if (z.type==='hils' || z.type==='alt') {
    const titleEl = document.getElementById('choice-title');
    if (titleEl) titleEl.textContent = z.type==='alt' ? '정리 작업 여부 (대체배송)' : '정리 작업 여부';
    document.getElementById('hils-choice').style.display='block';
    document.getElementById('hils-cleanup').style.display='none';
    document.getElementById('miju-sec').style.display='none';
    document.getElementById('gen-sec').style.display='none';
  } else {
    document.getElementById('hils-choice').style.display='none';
    document.getElementById('hils-cleanup').style.display='none';
    if (z.type==='miju') {
      document.getElementById('miju-sec').style.display='block';
      document.getElementById('gen-sec').style.display='none';
      document.getElementById('miju-a').value='';
      document.getElementById('miju-total').value='';
      document.getElementById('miju-a-result').style.display='none';
      document.getElementById('miju-b-result').style.display='none';
      // 미주는 바로시작 = 이동시간 즉시 계산
      const mvM = minBetween(new Date(S.moveStartTime), S.zStart);
      updateMoveLog(mvM);
    } else {
      document.getElementById('miju-sec').style.display='none';
      document.getElementById('gen-sec').style.display='block';
      showGenSec();
      document.getElementById('gen-qty').value='';
      // 일반구역도 바로시작 = 이동시간 즉시 계산
      const mvG = minBetween(new Date(S.moveStartTime), S.zStart);
      updateMoveLog(mvG);
    }
  }

  showStep('working');
  addLog('pulse',(S.zIdx+1)+'구역 시작 · '+z.name, ft(S.zStart), '');
  setSt('active',(S.zIdx+1)+'구역 · '+z.name+' 작업중','시작: '+ft(S.zStart));

  // 잔여 수량 전구역 표시
  updateRemainQty();
}

function updateRemainQty() {
  updateRemainQtyWithInput();
}

function updateRemainQtyWithInput() {
  if (!S.expQty) {
    document.getElementById('remain-row').style.display='none';
    return;
  }
  const doneQty = S.results.reduce((s,r)=>s+r.qty, 0);

  let currentInput = 0;
  const z = S.zones[S.zIdx];
  if (z && z.type==='miju') {
    // 전체수량 입력 있으면 그걸로, 없으면 A구간 합계로
    const totalVal = parseInt(document.getElementById('miju-total')?.value)||0;
    const aTotal = (S.miju.a1||0)+(S.miju.a2||0)+(S.miju.a3||0);
    const mijuOscan = (S.oscan||[]).filter(o=>o.zIdx===S.zIdx).reduce((s,o)=>s+o.qty,0);
    const baseInput = totalVal > 0 ? totalVal : aTotal;
    currentInput = Math.max(0, baseInput - mijuOscan);
  } else {
    const genVal = parseInt(document.getElementById('gen-qty')?.value)||0;
    const oscanTotal = (S.oscan||[]).filter(o=>o.zIdx===S.zIdx).reduce((s,o)=>s+o.qty,0);
    const rawInput = S.zIdx>0
      ? genVal - S.results.reduce((s,r)=>s+r.qty,0) - oscanTotal
      : genVal - oscanTotal;
    currentInput = rawInput < 0 ? 0 : rawInput;
  }

  const remain = S.expQty - doneQty - currentInput;
  document.getElementById('remain-row').style.display='';
  document.getElementById('remain-qty').textContent =
    remain+'개 남음 / 완료: '+doneQty+'개'+(currentInput>0?' (입력중: '+currentInput+'개)':'');
}

// ── CLEANUP CHOICE ──
function startCleanup() {
  S.cuStart = new Date();
  // 이동시간 = 정리시작 - 이전구역 종료
  const mv = S.moveStartTime ? minBetween(new Date(S.moveStartTime), S.cuStart) : 0;
  updateMoveLog(mv);
  saveSt();
  document.getElementById('hils-choice').style.display='none';
  document.getElementById('hils-cleanup').style.display='block';
  document.getElementById('cu-start').textContent = ft(S.cuStart);
  document.getElementById('cu-end').textContent = '-';
  document.getElementById('btn-cu-end').disabled = false;
  addLog('cu','정리 시작',ft(S.cuStart),'이동: '+mv+'분');
  toast('정리 시작');
}

function skipCleanup() {
  const now = new Date();
  const mv = S.moveStartTime ? minBetween(new Date(S.moveStartTime), now) : 0;
  updateMoveLog(mv);
  S.cuStart = null;
  S.cuEnd = 'SKIP';
  saveSt();
  document.getElementById('hils-choice').style.display='none';
  document.getElementById('hils-cleanup').style.display='none';
  document.getElementById('gen-sec').style.display='block';
  addLog('cu','바로 배송 시작',ft(now),'이동: '+mv+'분');
  toast('바로 배송 시작');
}

function updateMoveLog(mv) {
  for (let i=logs.length-1; i>=0; i--) {
    if (logs[i].dot==='pulse') {
      logs[i].detail = mv>0 ? '이동: '+mv+'분' : '';
      break;
    }
  }
  saveSt();
}

// 미주 동별 수량 입력시 1구역 로그 업데이트
function updateMijuLog() {
  const a1=S.miju.a1||0, a2=S.miju.a2||0, a3=S.miju.a3||0;
  if (!a1&&!a2&&!a3) return;
  for (let i=logs.length-1; i>=0; i--) {
    if (logs[i].dot==='pulse' && logs[i].title.includes('미주')) {
      logs[i].detail = `1동:${a1} 2동:${a2} 3동:${a3} (A합계:${a1+a2+a3}개)`;
      break;
    }
  }
  saveSt();
  if (document.getElementById('page-log').classList.contains('active')) renderLog();
}

// ── CLEANUP END ──
function doCleanupEnd() {
  document.getElementById('btn-cu-end').disabled = true;
  S.cuEnd = new Date();
  saveSt();
  document.getElementById('cu-end').textContent = ft(S.cuEnd);
  const cm = minBetween(S.cuStart, S.cuEnd);
  document.getElementById('gen-sec').style.display='block';
  addLog('cu','정리 완료',ft(S.cuEnd),'정리: '+cm+'분');
  toast('정리 완료 · '+cm+'분');
}

// ── MIJU PARSE ──
function parseMijuA() {
  const raw = document.getElementById('miju-a').value.trim();
  const el = document.getElementById('miju-a-result');
  if (!raw) { el.style.display='none'; return; }

  let res = {};

  // 패턴1: 점/대시/콤마로 세 숫자 구분 "25.85.69" or "25-85-69" or "25,85,69"
  // 숫자.숫자.숫자 형태 (동번호 아닌 수량 세 개)
  const sep3 = raw.trim().match(/^(\d{1,3})[.\-,](\d{1,3})[.\-,](\d{1,3})$/);
  if (sep3) {
    res['1동']=parseInt(sep3[1]);
    res['2동']=parseInt(sep3[2]);
    res['3동']=parseInt(sep3[3]);
  }

  // 패턴2: 공백 구분 세 숫자 "25 85 69"
  if (!Object.keys(res).length) {
    const parts = raw.trim().split(/\s+/);
    if (parts.length===3 && parts.every(p=>/^\d+$/.test(p))) {
      res['1동']=parseInt(parts[0]);
      res['2동']=parseInt(parts[1]);
      res['3동']=parseInt(parts[2]);
    }
  }

  // 패턴3: 동번호-수량 개별입력 "1-45 2-32 3-28" or "1 45 2 32 3 28"
  if (!Object.keys(res).length) {
    const indiv = [...raw.matchAll(/([1-8])\s*[-\.]\s*(\d{1,3})/g)];
    if (indiv.length>0) {
      indiv.forEach(m => res[m[1]+'동']=parseInt(m[2]));
    }
  }

  // 패턴4: 붙여쓰기 - 6자리 이하는 두자리씩 분리, 7자리 이상은 안내
  if (!Object.keys(res).length) {
    const digits = raw.replace(/\D/g,'');
    if (digits.length>=3 && digits.length<=6) {
      // 6자리 이하: 두자리씩 분리 (225689 → 22,56,89)
      const partLen = Math.floor(digits.length/3);
      const extra = digits.length % 3;
      // 균등하게 앞에서 나누기
      let parts = [];
      let idx = 0;
      for (let i=0; i<3; i++) {
        const len = partLen + (i < extra ? 1 : 0);
        parts.push(digits.slice(idx, idx+len));
        idx += len;
      }
      if (parts[0]&&parts[1]&&parts[2]) {
        res['1동']=parseInt(parts[0]);
        res['2동']=parseInt(parts[1]);
        res['3동']=parseInt(parts[2]);
      }
    } else if (digits.length>=7) {
      // 7자리 이상: 안내 메시지
      el.innerHTML = `<div style="color:var(--amber);font-size:12px;padding:4px 0;">
        ⚠️ 구분기호를 넣어주세요<br>
        <span style="color:var(--text2);">띄어쓰기: 35 52 125</span><br>
        <span style="color:var(--text2);">점 구분: 35.52.125</span><br>
        <span style="color:var(--text2);">대시 구분: 35-52-125</span>
      </div>`;
      el.style.display='block';
      return;
    }
  }

  if (!Object.keys(res).length) { el.style.display='none'; return; }

  S.miju.a1 = res['1동']||0;
  S.miju.a2 = res['2동']||0;
  S.miju.a3 = res['3동']||0;
  const aTotal = S.miju.a1+S.miju.a2+S.miju.a3;

  el.innerHTML = Object.entries(res).map(([k,v])=>
    `<div class="parse-row"><span class="pk">${k}</span><span class="pv">${v}개</span></div>`
  ).join('') +
  `<div class="parse-row" style="margin-top:4px;border-top:1px solid var(--accent2);">
    <span class="pk" style="color:var(--accent2);">A구간 합계</span>
    <span class="pv blue">${aTotal}개</span>
  </div>`;
  el.style.display='block';
  calcMijuB();
  updateMijuLog();
  updateRemainQtyWithInput();
}

function calcMijuB() {
  // 미주 전체수량 입력 시 잔여수량 즉시 반영
  updateRemainQtyWithInput();
  const total = parseInt(document.getElementById('miju-total').value);
  const aTotal = S.miju.a1+S.miju.a2+S.miju.a3;
  const el = document.getElementById('miju-b-result');
  if (!total||!aTotal) { el.style.display='none'; return; }
  S.miju.bTotal = total-aTotal;
  el.innerHTML = `
    <div class="parse-row"><span class="pk">A구간 (1,2,3동)</span><span class="pv">${aTotal}개</span></div>
    <div class="parse-row"><span class="pk">B구간 (5,6,7,8동)</span><span class="pv">${S.miju.bTotal}개</span></div>
    <div class="parse-row" style="margin-top:4px;border-top:1px solid var(--accent);">
      <span class="pk" style="color:var(--accent);">미주 전체</span>
      <span class="pv">${total}개</span>
    </div>`;
  el.style.display='block';
}

// ── ZONE END ──
function doZoneEnd() {
  const z = S.zones[S.zIdx];
  let qty = 0;
  if (z.type==='miju') {
    const mijuTotal = parseInt(document.getElementById('miju-total').value);
    if (!mijuTotal||mijuTotal<=0) { toast('미주 전체 수량을 입력해주세요'); return; }
    const oscanMiju = (S.oscan||[]).filter(o=>o.zIdx===S.zIdx).reduce((s,o)=>s+o.qty,0);
    if (S.zIdx>0) {
      // 2구역 이후 미주: 전체수량 - 이전구역 합계
      const doneQty = S.results.reduce((s,r)=>s+r.qty,0);
      qty = mijuTotal - doneQty - oscanMiju;
      if (qty<0) qty = mijuTotal - doneQty;
      S.expQty = mijuTotal; // 전체수량으로 예상수량 업데이트
      updateRemainQty(); // 즉시 반영
    } else {
      qty = mijuTotal - oscanMiju;
    }
    if (qty<=0) { toast('수량이 0 이하입니다. 확인해주세요'); return; }
  } else {
    const totalInput = parseInt(document.getElementById('gen-qty').value);
    if (!totalInput||totalInput<=0) { toast('수량을 입력해주세요'); return; }
    const oscanTotal = (S.oscan||[]).filter(o=>o.zIdx===S.zIdx).reduce((s,o)=>s+o.qty,0);
    if (S.zIdx>0) {
      // 2구역부터 자동계산
      const doneQty = S.results.reduce((s,r)=>s+r.qty,0);
      qty = totalInput - doneQty - oscanTotal;
      if (qty<0) {
        // 경고만 하고 진행은 가능하게
        // 오스캔이 있을 수 있으므로 오스캔 합계 제외하고 재계산
        qty = totalInput - doneQty;
        if (qty < 0) qty = 0;
      }
      S.expQty = totalInput; // 전체수량으로 예상수량 업데이트
    } else {
      // 1구역도 오스캔 차감
      qty = totalInput - oscanTotal;
      if (qty < 0) qty = 0;
    }
  }
  // 힐스/대체배송 정리 체크
  if ((z.type==='hils'||z.type==='alt') && !S.cuEnd) {
    toast('정리 끝 버튼을 먼저 눌러주세요'); return;
  }
  if (S.cuEnd==='SKIP') S.cuEnd = null;

  // 전구역 수량 0이면 도우미 무보수 자동 확정
  const totalInput2 = z.type==='miju'
    ? parseInt(document.getElementById('miju-total').value)||0
    : parseInt(document.getElementById('gen-qty').value)||0;
  if (totalInput2===0) {
    // 도우미 무보수로 자동 저장
    S.helpers.push({ id:Date.now(), type:'give', min:0, zIdx:S.zIdx, time:new Date().toISOString(), autoDetected:true });
    addLog('p','도우미(자동): 무보수 배송', ft(new Date()), '수량 0 자동 감지', S.zIdx);
    saveSt();
    toast('수량 0 → 도우미 무보수 자동 기록됨');
    return;
  }

  const now = new Date();
  // 실제 배송 시작 시각 계산
  // 힐스/대체: 정리끝(cuEnd) 이후부터, 바로시작(SKIP처리후null)이면 zStart
  // 미주/일반: zStart 기준
  let actualStart;
  if ((z.type==='hils'||z.type==='alt') && S.cuEnd && S.cuEnd!=='SKIP') {
    actualStart = new Date(S.cuEnd);
  } else {
    actualStart = new Date(S.zStart);
  }
  const realMin = minBetween(actualStart, now);
  // 전체 효율: 1구역은 진접출발부터, 2구역~은 이전구역 종료부터
  const totalBase = S.zIdx===0 ? new Date(S.departTime) : new Date(S.results[S.zIdx-1].endTime);
  const totalMin = minBetween(totalBase, now);

  const zoneEvents = S.events.filter(e=>e.zIdx===S.zIdx);
  const evMin = zoneEvents.reduce((s,e)=>s+(e.min||0),0);
  const corrMin = realMin-evMin;
  const rEff = effCalc(qty,realMin);
  const tEff = effCalc(qty,totalMin);
  const cEff = corrMin>0 ? effCalc(qty,corrMin) : '-';

  pendingQty = { qty, z, now, realMin, totalMin, evMin, corrMin, rEff, tEff, cEff, actualStart };

  let html = `<div class="parse-box" style="display:block;">
    <div class="parse-row"><span class="pk">구역</span><span class="pv">${z.name}</span></div>
    <div class="parse-row"><span class="pk">수량</span><span class="pv">${qty}개</span></div>
    <div class="parse-row"><span class="pk">종료 시각</span><span class="pv">${ft(now)}</span></div>
    <div class="parse-row"><span class="pk">실제 작업</span><span class="pv">${fmtMin(realMin)}</span></div>`;
  if (z.type==='miju') {
    const aT = S.miju.a1+S.miju.a2+S.miju.a3;
    html += `<div class="parse-row"><span class="pk">A구간</span><span class="pv">${aT}개</span></div>
    <div class="parse-row"><span class="pk">B구간</span><span class="pv">${S.miju.bTotal}개</span></div>`;
  }
  html += `<div class="parse-row"><span class="pk">예상 효율</span><span class="pv">${rEff}개/시간</span></div>
  </div>`;

  // 마지막 구역 완료 시에만 수량 안내
  const doneQty2 = S.results.reduce((s,r)=>s+r.qty,0);
  const isLastZone = S.zIdx === S.zones.filter(z=>z.active).length - 1;
  const totalAfter = doneQty2 + qty;
  const diff2 = totalAfter - S.expQty;
  if (isLastZone) {
    const diffColor = diff2 >= 0 ? 'var(--accent)' : 'var(--amber)';
    const diffText = diff2 >= 0 ? `+${diff2}개 (스캔미스)` : `${diff2}개 (예상보다 적음)`;
    html += `<div style="margin-top:8px;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;">
      <div style="font-size:12px;color:var(--text2);margin-bottom:4px;">📊 최종 수량 확인</div>
      <div style="display:flex;justify-content:space-between;">
        <span style="font-size:12px;color:var(--text2);">예상</span>
        <span style="font-size:13px;font-weight:600;">${S.expQty}개</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="font-size:12px;color:var(--text2);">실제 합계</span>
        <span style="font-size:13px;font-weight:600;">${totalAfter}개</span>
      </div>
      <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);margin-top:4px;padding-top:4px;">
        <span style="font-size:12px;color:var(--text2);">차이</span>
        <span style="font-size:13px;font-weight:700;color:${diffColor};">${diffText}</span>
      </div>
    </div>`;
  }

  document.getElementById('confirm-content').innerHTML = html;
  openModal('m-confirm');
}

function confirmZone() {
  closeModal('m-confirm');
  const { qty, z, now, realMin, totalMin, evMin, corrMin, rEff, tEff, cEff } = pendingQty;
  const result = {
    zIdx: S.zIdx, name: z.name, type: z.type,
    startTime: S.zStart, endTime: now,
    cuStart: S.cuStart, cuEnd: S.cuEnd,
    qty, realMin, totalMin, evMin, corrMin, rEff, tEff, cEff,
    mijuData: z.type==='miju' ? {...S.miju} : null,
    events: S.events.filter(e=>e.zIdx===S.zIdx),
  };
  S.results.push(result);
  z.qty=qty; z.endTime=now;
  S.phase='between';
  saveSt();

  const realMinSafe = isNaN(realMin)||realMin<0 ? 0 : realMin;
  const rEffSafe = isNaN(rEff)||rEff==='-' ? '-' : rEff;
  addLog('g', z.name+' 완료', ft(now), qty+'개 · '+fmtMin(realMinSafe)+' · '+rEffSafe+'개/시간', S.zIdx);
  showStep('between');

  // 요약
  const hasNext = S.zIdx+1<S.zones.length;
  document.getElementById('between-summary').innerHTML = `
    <div class="stat-grid">
      <div class="stat-box"><div class="stat-lbl">배송 수량</div><div class="stat-val" style="color:var(--accent);">${qty}</div><div class="stat-sub">개</div></div>
      <div class="stat-box"><div class="stat-lbl">실제 효율</div><div class="stat-val" style="color:var(--accent2);">${rEff}</div><div class="stat-sub">개/시간</div></div>
    </div>
    <div class="card">
      <div class="eff-row"><span class="eff-lbl">실제 배송 효율</span><span class="eff-val" style="color:var(--accent);">${rEff}개/시간</span></div>
      <div class="eff-row"><span class="eff-lbl">전체 업무 효율</span><span class="eff-val" style="color:var(--accent2);">${tEff}개/시간</span></div>
      <div class="eff-row"><span class="eff-lbl">이벤트 보정 효율</span><span class="eff-val" style="color:var(--amber);">${cEff}개/시간</span></div>
    </div>`;

  if (hasNext) {
    const nz = S.zones[S.zIdx+1];
    document.getElementById('next-zone-card').innerHTML = `
      <div class="zone-card"><div class="zone-num on">${S.zIdx+2}</div>
      <div class="zone-info"><div class="zone-name">${nz.name}</div><div class="zone-sub">${zTypeLabel(nz.type)}</div></div></div>`;
    document.getElementById('btn-next').style.display='';
  } else {
    document.getElementById('next-zone-card').innerHTML = '<div style="color:var(--text2);font-size:13px;padding:8px 0;">마지막 구역 완료</div>';
    document.getElementById('btn-next').style.display='none';
  }
  setSt('warn', z.name+' 완료','다음 구역 준비 중');
  toast(z.name+' 완료! '+qty+'개 🎉');
}

// ── FINISH ──
function doFinish() {
  S.finishTime = new Date();
  S.phase='finished';
  saveSt();

  if (S.isHelperDay) {
    addLog('p','업무 종료 (무보수 도우미)',ft(S.finishTime),'수고하셨습니다!');
    showStep('done');
    setSt('','무보수 도우미 종료','');
    buildHelperDayReport();
    toast('수고하셨습니다! 🤝');
  } else {
    addLog('g','업무 종료',ft(S.finishTime),'오늘 수고하셨습니다!');
    showStep('done');
    setSt('','업무 종료','');
    buildReport();
    toast('수고하셨습니다! 🎉');
  }
}

function buildHelperDayReport() {
  const n = new Date();
  const days=['일','월','화','수','목','금','토'];
  const dateStr = n.getFullYear()+'년 '+(n.getMonth()+1)+'월 '+n.getDate()+'일 '+days[n.getDay()]+'요일';
  const totalMin = S.finishTime && S.departTime
    ? minBetween(S.departTime, S.finishTime) : 0;

  const t = `━━━━━━━━━━━━━━━━━━━━━━━━
📦 일일 택배 마스터 Report
━━━━━━━━━━━━━━━━━━━━━━━━
날짜: ${dateStr}
※ 무보수 도우미 날

[업무 기록]
진접 출발: ${ft(new Date(S.departTime))}
최종 종료: ${ft(new Date(S.finishTime))}
총 소요: ${fmtMin(totalMin)}

[수량/효율]
수량: 없음 (무보수)
효율: 미산출
━━━━━━━━━━━━━━━━━━━━━━━━`;

  const key = todayKey();
  const summary = {
    date: key,
    dayOfWeek: new Date().getDay(),
    totalQty: 0,
    expQty: 0,
    scanMiss: 0,
    driveMin: S.driveMin||0,
    overallEff: 0,
    zones: {},
    isHelperDay: true,
  };

  const data = {
    date: key,
    state: JSON.parse(JSON.stringify(S)),
    reportText: t,
    summary,
    savedAt: new Date().toISOString(),
    isHelperDay: true,
  };

  localStorage.setItem('report_'+key, JSON.stringify(data));
  const dates = JSON.parse(localStorage.getItem('all_dates')||'[]');
  if (!dates.includes(key)) { dates.push(key); dates.sort(); localStorage.setItem('all_dates',JSON.stringify(dates)); }
  saveToAllData(key, data);

  document.getElementById('report-box').innerHTML = `
    <div class="report-box">${t}</div>
    <div class="btn-row">
      <button class="btn btn-gray btn-half btn-sm" onclick="copyReport()">📋 복사</button>
      <button class="btn btn-blue btn-half btn-sm" onclick="shareReport()">📤 공유</button>
    </div>
  `;
}
