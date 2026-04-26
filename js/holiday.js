// ══════════════════════════════════════
// 휴무 시스템
// ══════════════════════════════════════

// 기본 4주 패턴 (0=일,1=월,...6=토)
const DEFAULT_HOLIDAY_PATTERN = [
  [0,1],  // 1주차: 일,월
  [1],    // 2주차: 월
  [0],    // 3주차: 일
  [],     // 4주차: 없음
];

const KOREAN_HOLIDAYS = {
  // 구정/추석은 매년 다르므로 설정에서 관리
};

function loadHolidaySettings() {
  const s = localStorage.getItem('holiday_settings');
  if (s) return JSON.parse(s);
  return {
    pattern: DEFAULT_HOLIDAY_PATTERN,
    special: [], // [{date:'2026-02-01', reason:'구정'}]
    patternStart: null, // 패턴 시작 주의 일요일
  };
}

function saveHolidaySettings(h) {
  localStorage.setItem('holiday_settings', JSON.stringify(h));
}

function isHoliday(dateStr) {
  const h = loadHolidaySettings();

  // 특별 휴무 체크
  const special = h.special.find(s=>s.date===dateStr);
  if (special) return special.reason||'특별휴무';

  // 정기 패턴 체크
  const d = new Date(dateStr);
  const dow = d.getDay();
  const weekNum = getWeekNumInMonth(d);
  const patternIdx = (weekNum-1) % 4;
  const pattern = h.pattern[patternIdx]||[];
  if (pattern.includes(dow)) return '정기휴무';

  return null;
}

function getWeekNumInMonth(d) {
  // 해당 월의 첫 일요일 기준 주차 계산
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const firstSunday = first.getDay()===0 ? first : new Date(first.setDate(first.getDate()+(7-first.getDay())%7));
  if (d < firstSunday) return 0;
  return Math.floor((d-firstSunday)/(7*24*60*60*1000))+1;
}

// ── 설정 달력 ──
let calOffset = 0;

function changeCalMonth(dir) {
  calOffset += dir;
  renderSettingsCal();
}

function renderSettingsCal() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + calOffset;
  const target = new Date(y, m, 1);
  const titleEl = document.getElementById('cal-title');
  if (!titleEl) return;
  titleEl.textContent = target.getFullYear()+'년 '+(target.getMonth()+1)+'월';

  const firstDay = target.getDay(); // 0=일
  const lastDate = new Date(target.getFullYear(), target.getMonth()+1, 0).getDate();
  const allData = getAllData();
  const h = loadHolidaySettings();

  let cells = '';
  // 빈 칸
  for (let i=0; i<firstDay; i++) {
    cells += '<div></div>';
  }
  // 날짜
  for (let d=1; d<=lastDate; d++) {
    const dateStr2 = target.getFullYear()+'-'+pad(target.getMonth()+1)+'-'+pad(d);
    const dow = new Date(dateStr2).getDay();
    const holiday = isHoliday(dateStr2);
    const hasData = !!allData[dateStr2];
    const isToday = dateStr2 === new Date().toISOString().split('T')[0];

    let bg = 'var(--surface2)';
    let color = dow===0 ? 'var(--red)' : dow===6 ? 'var(--accent2)' : 'var(--text)';
    let border = isToday ? '1px solid var(--accent)' : '1px solid transparent';
    let dot = '';

    if (holiday==='정기휴무') { bg='rgba(248,81,73,0.15)'; color='var(--red)'; }
    else if (holiday) { bg='rgba(210,153,34,0.15)'; color='var(--amber)'; }
    else if (hasData) { dot='<div style="width:4px;height:4px;border-radius:50%;background:var(--accent);margin:1px auto 0;"></div>'; }

    cells += `<div onclick="onCalDayClick('${dateStr2}')"
      style="text-align:center;padding:5px 2px;border-radius:6px;cursor:pointer;background:${bg};border:${border};min-height:36px;">
      <div style="font-size:12px;font-weight:600;color:${color};">${d}</div>
      ${dot}
    </div>`;
  }

  const grid = document.getElementById('cal-grid');
  if (grid) grid.innerHTML = cells;
}

function onCalDayClick(dateStr2) {
  // 특별 휴무 날짜 자동 입력
  const inp = document.getElementById('special-date');
  if (inp) {
    inp.value = dateStr2;
    // 사유 입력창으로 포커스
    const reason = document.getElementById('special-reason');
    if (reason) reason.focus();
    toast(dateStr2+' 선택됨 · 사유 입력 후 추가');
  }
}

function renderHolidayPattern() {
  const h = loadHolidaySettings();
  const days = ['일','월','화','수','목','금','토'];
  const c = document.getElementById('holiday-pattern');
  if (!c) return;
  c.innerHTML = h.pattern.map((week,i)=>`
    <div class="row" style="margin-bottom:8px;">
      <span class="lbl">${i+1}주차</span>
      <div style="display:flex;gap:4px;flex-wrap:wrap;">
        ${[0,1,2,3,4,5,6].map(d=>`
          <button onclick="toggleHolidayDay(${i},${d})"
            style="padding:4px 8px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid;
            ${week.includes(d)
              ? 'background:var(--red-dim);color:var(--red);border-color:rgba(248,81,73,.3);'
              : 'background:var(--surface2);color:var(--text3);border-color:var(--border);'}">
            ${days[d]}
          </button>`).join('')}
      </div>
    </div>`).join('');
}

function toggleHolidayDay(weekIdx, day) {
  const h = loadHolidaySettings();
  const week = h.pattern[weekIdx];
  if (week.includes(day)) {
    h.pattern[weekIdx] = week.filter(d=>d!==day);
  } else {
    h.pattern[weekIdx] = [...week, day].sort();
  }
  saveHolidaySettings(h);
  renderHolidayPattern();
  renderSettingsCal();
  toast('휴무 패턴 저장됨');
}

function addSpecialHoliday() {
  const date = document.getElementById('special-date').value;
  const reason = document.getElementById('special-reason').value.trim()||'특별휴무';
  if (!date) { toast('날짜를 선택해주세요'); return; }
  const h = loadHolidaySettings();
  if (h.special.find(s=>s.date===date)) { toast('이미 등록된 날짜입니다'); return; }
  h.special.push({date, reason});
  h.special.sort((a,b)=>a.date.localeCompare(b.date));
  saveHolidaySettings(h);
  renderSpecialHolidays();
  renderSettingsCal();
  document.getElementById('special-date').value='';
  document.getElementById('special-reason').value='';
  toast('특별 휴무 추가됨');
}

function renderSpecialHolidays() {
  const h = loadHolidaySettings();
  const c = document.getElementById('special-holiday-list');
  if (!c) return;
  if (!h.special.length) { c.innerHTML=''; return; }
  c.innerHTML = h.special.map((s,i)=>`
    <div class="row" style="padding:6px 0;border-bottom:1px solid var(--border);">
      <div>
        <span style="font-size:13px;font-weight:600;">${s.date}</span>
        <span style="font-size:11px;color:var(--text2);margin-left:8px;">${s.reason}</span>
      </div>
      <button onclick="removeSpecialHoliday(${i})"
        style="background:var(--red-dim);border:1px solid rgba(248,81,73,.3);color:var(--red);border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;">
        삭제
      </button>
    </div>`).join('');
}

function removeSpecialHoliday(idx) {
  const h = loadHolidaySettings();
  h.special.splice(idx,1);
  saveHolidaySettings(h);
  renderSpecialHolidays();
  renderSettingsCal();
  toast('삭제됨');
}