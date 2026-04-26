// ── INIT ──
window.addEventListener('DOMContentLoaded', ()=>{
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
});

// ── SERVICE WORKER 등록 ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/delivery-master/sw.js')
      .then(reg => console.log('SW 등록 완료:', reg.scope))
      .catch(err => console.log('SW 등록 실패:', err));
  });
}
