// ── INIT ──
window.addEventListener('DOMContentLoaded', ()=>{
  try {
    startClock();
    initDate();
    loadSt();

    if (S.phase!=='before') {
      if (confirm('이전 작업이 있습니다. 이어서 하시겠습니까?')) {
        restoreState();
        renderLog();
      } else {
        doReset();
      }
    }

    document.querySelectorAll('.modal-bg').forEach(bg=>{
      bg.addEventListener('click', e=>{ if(e.target===bg) bg.classList.remove('open'); });
    });
  } catch(e) {
    recordErrorLog('DOMContentLoaded', e);
    alert('앱 시작 오류가 기록되었습니다. 설정의 에러로그를 확인해주세요.');
  }
});

// ── SERVICE WORKER 등록 ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/delivery-master/season2/sw.js')
      .then(reg => console.log('SW 등록 완료:', reg.scope))
      .catch(err => {
        recordErrorLog('serviceWorker.register', err);
        console.log('SW 등록 실패:', err);
      });
  });
}
