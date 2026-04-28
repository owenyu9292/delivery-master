// ── EVENTS ──
function setEvType(t) { document.getElementById('ev-type').value=t; }
function saveEvent() {
  const type = document.getElementById('ev-type').value.trim();
  const min = parseInt(document.getElementById('ev-min').value)||0;
  const memo = document.getElementById('ev-memo').value.trim();
  if (!type) { toast('이벤트 종류를 입력해주세요'); return; }

  // 선완료 수량
  let preQty = 0;
  if (type === '선완료') {
    preQty = parseInt(document.getElementById('ev-pre-qty')?.value)||0;
    const box = document.getElementById('pre-complete-box');
    if (box) box.style.display='none';
  }

  const ev = { zIdx:S.zIdx, zoneName:S.zones[S.zIdx]?.name||'', type, min, memo, preQty, time:new Date().toISOString() };
  S.events.push(ev);
  saveSt();

  const detail = type==='선완료'
    ? (preQty>0 ? preQty+'개 내일 배송' : '내일 배송')
    : min+'분'+(memo?' · '+memo:'');
  addLog('a','이벤트: '+type, ft(new Date(ev.time)), detail, undefined, true);
  closeModal('m-event');
  document.getElementById('ev-type').value='';
  document.getElementById('ev-min').value='';
  document.getElementById('ev-memo').value='';
  if (document.getElementById('ev-pre-qty')) document.getElementById('ev-pre-qty').value='';
  toast('이벤트 기록 완료');
}

// ── HELPERS ──
function setHelper(t) {
  helperType=t;
  ['give','paid','trade'].forEach(h=>{
    document.getElementById('h-'+h+'-box').style.display = h===t?'block':'none';
    document.getElementById('h-'+h+'-btn').style.opacity = h===t?'1':'0.5';
  });
}
function saveHelper() {
  if (!helperType) { toast('유형을 선택해주세요'); return; }
  const min = helperType==='give' ? parseInt(document.getElementById('h-min').value)||0 : 0;
  const labels = {give:'도움 제공(무보수)', paid:'유료 도움 받기', trade:'상계 교환'};
  const id = Date.now();
  S.helpers.push({ id, type:helperType, min, zIdx:S.zIdx, time:new Date().toISOString() });
  saveSt();
  addLog('p','도우미: '+labels[helperType], ft(new Date()), helperType==='give'?min+'분 (취소하려면 로그탭 확인)':'');
  closeModal('m-helper');
  toast('도우미 기록 완료');
}

function removeHelper(id) {
  S.helpers = S.helpers.filter(h=>h.id!==id);
  saveSt();
  // 로그에서도 제거 (마지막 도우미 로그)
  renderLog();
  toast('도우미 기록 삭제됨');
  openHelperLogModal();
}

function openHelperLogModal() {
  const helpers = S.helpers.filter(h=>h.zIdx===S.zIdx);
  if (helpers.length===0) { closeModal('m-helper-log'); return; }
  // 간단히 toast로 표시
  toast('도우미 '+helpers.length+'건 기록됨');
}